import { exec } from 'child_process'
import { promisify } from 'util'
import type { PrinterInfo } from './api-client'

const execAsync = promisify(exec)

interface SystemPrinter {
  name: string
  displayName: string
  description?: string
  status?: number
  isDefault: boolean
  options?: Record<string, string>
}

interface DetectedPrinter extends PrinterInfo {
  systemName: string
  isDefault: boolean
  isOnline: boolean
  isZebra: boolean // True if this is a Zebra printer (uses ZPL)
  rawQueueName?: string // Name of RAW queue for direct ZPL printing (macOS/Linux)
}

class PrinterService {
  private printers: DetectedPrinter[] = []
  private lastRefresh: Date | null = null

  async detectPrinters(): Promise<DetectedPrinter[]> {
    try {
      let systemPrinters: SystemPrinter[] = []

      if (process.platform === 'win32') {
        systemPrinters = await this.detectWindowsPrinters()
      } else if (process.platform === 'darwin') {
        systemPrinters = await this.detectMacPrinters()
      } else {
        systemPrinters = await this.detectLinuxPrinters()
      }

      // Filter out RAW queues from the main printer list (they're auxiliary queues, not real printers)
      const filteredPrinters = systemPrinters.filter(p => {
        const name = p.name.toLowerCase()
        return !name.endsWith('_raw') && !name.includes('_raw_')
      })

      this.printers = filteredPrinters.map(p => this.enrichPrinterInfo(p))

      // On macOS/Linux, detect RAW queues for Zebra printers
      if (process.platform !== 'win32') {
        await this.detectRawQueues()
      }

      this.lastRefresh = new Date()

      console.log(`[Printer Service] Detected ${this.printers.length} printers`)
      return this.printers
    } catch (error) {
      console.error('[Printer Service] Detection failed:', error)
      return []
    }
  }

  /**
   * Detect RAW print queues for Zebra printers on macOS/Linux
   * RAW queues allow sending ZPL commands directly without driver conversion
   */
  private async detectRawQueues(): Promise<void> {
    try {
      // Get all printer queues
      const { stdout } = await execAsync('lpstat -p 2>/dev/null', { encoding: 'utf8' })
      const lines = stdout.split('\n')

      const rawQueues: string[] = []
      for (const line of lines) {
        const match = line.match(/(?:impresora|printer)\s+(\S+)/)
        if (match) {
          const queueName = match[1]
          if (queueName.toLowerCase().includes('raw') || queueName.toLowerCase().includes('_raw')) {
            rawQueues.push(queueName)
          }
        }
      }

      console.log(`[Printer Service] Found ${rawQueues.length} RAW queues: ${rawQueues.join(', ') || 'none'}`)

      // Assign RAW queues to Zebra printers
      for (const printer of this.printers) {
        if (printer.isZebra) {
          // Look for a RAW queue that matches this printer
          const matchingRaw = rawQueues.find(q =>
            q.toLowerCase().includes('zebra') ||
            q === 'Zebra_RAW'
          )

          if (matchingRaw) {
            printer.rawQueueName = matchingRaw
            console.log(`[Printer Service] Assigned RAW queue "${matchingRaw}" to Zebra printer "${printer.printerName}"`)
          } else {
            console.log(`[Printer Service] No RAW queue found for Zebra printer "${printer.printerName}"`)
          }
        }
      }
    } catch (error) {
      console.log('[Printer Service] RAW queue detection failed:', error)
    }
  }

  private async detectWindowsPrinters(): Promise<SystemPrinter[]> {
    try {
      // Use PowerShell to get printer information
      const { stdout } = await execAsync(
        'powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Type | ConvertTo-Json"',
        { encoding: 'utf8' }
      )

      if (!stdout.trim()) return []

      const printers = JSON.parse(stdout)
      const printerArray = Array.isArray(printers) ? printers : [printers]

      // Get default printer
      const { stdout: defaultPrinter } = await execAsync(
        'powershell -Command "(Get-WmiObject -Query \\"SELECT * FROM Win32_Printer WHERE Default=TRUE\\").Name"',
        { encoding: 'utf8' }
      )
      const defaultName = defaultPrinter.trim()

      return printerArray.map((p: { Name: string; DriverName?: string; PortName?: string; PrinterStatus?: number }) => ({
        name: p.Name,
        displayName: p.Name,
        description: p.DriverName,
        status: p.PrinterStatus,
        isDefault: p.Name === defaultName,
        options: {
          driverName: p.DriverName || '',
          portName: p.PortName || ''
        }
      }))
    } catch (error) {
      console.error('[Printer Service] Windows detection failed:', error)
      return []
    }
  }

  private async detectMacPrinters(): Promise<SystemPrinter[]> {
    try {
      const printersMap = new Map<string, SystemPrinter>() // Use map to avoid duplicates
      let defaultPrinter = ''

      // Method 1: Use lpstat -a to get ALL available printers (more reliable than -p)
      try {
        const { stdout } = await execAsync('lpstat -a 2>/dev/null', { encoding: 'utf8' })
        const lines = stdout.split('\n')

        console.log('[Printer Service] lpstat -a output:', stdout)

        for (const line of lines) {
          // Parse "PrinterName accepting requests since..." format
          const acceptMatch = line.match(/^(\S+)\s+(?:accepting|aceptando)/)
          if (acceptMatch) {
            const cupsName = acceptMatch[1]
            const displayName = cupsName.replace(/_/g, ' ')

            console.log(`[Printer Service] lpstat -a found: "${cupsName}" -> "${displayName}"`)

            printersMap.set(cupsName, {
              name: cupsName,
              displayName: displayName,
              isDefault: false,
              status: 0 // accepting = online
            })
          }
        }
      } catch (e) {
        console.log('[Printer Service] lpstat -a failed:', e)
      }

      // Method 1b: Also try lpstat -p for additional printers
      try {
        const { stdout } = await execAsync('lpstat -p -d 2>/dev/null', { encoding: 'utf8' })
        const lines = stdout.split('\n')

        console.log('[Printer Service] lpstat -p output:', stdout)

        for (const line of lines) {
          // Parse "printer PrinterName is idle." or similar (multiple language support)
          const printerMatch = line.match(/^(?:la\s+)?(?:impresora\s+)?printer\s+(\S+)|^(?:la\s+)?impresora\s+(\S+)\s+/)
          if (printerMatch) {
            const cupsName = printerMatch[1] || printerMatch[2]
            const displayName = cupsName.replace(/_/g, ' ')

            if (!printersMap.has(cupsName)) {
              console.log(`[Printer Service] lpstat -p found NEW: "${cupsName}" -> "${displayName}"`)
              printersMap.set(cupsName, {
                name: cupsName,
                displayName: displayName,
                isDefault: false,
                status: line.includes('idle') || line.includes('inactiva') ? 0 : 1
              })
            }
          }

          // Parse "system default destination: PrinterName" or Spanish equivalent
          const defaultMatch = line.match(/(?:system default destination|destino por omisión del sistema):\s*(\S+)/)
          if (defaultMatch) {
            defaultPrinter = defaultMatch[1]
          }
        }
      } catch (e) {
        console.log('[Printer Service] lpstat -p failed:', e)
      }

      // Method 2: Use lpstat -v for device URIs (catches network printers)
      try {
        const { stdout } = await execAsync('lpstat -v 2>/dev/null', { encoding: 'utf8' })
        const lines = stdout.split('\n')

        console.log('[Printer Service] lpstat -v output:', stdout)

        for (const line of lines) {
          // Parse "device for PrinterName: uri" format (works in both English and Spanish)
          const deviceMatch = line.match(/(?:device for|dispositivo para)\s+(\S+):\s*(\S+)/)
          if (deviceMatch) {
            const cupsName = deviceMatch[1]
            const uri = deviceMatch[2]
            const displayName = cupsName.replace(/_/g, ' ')

            console.log(`[Printer Service] lpstat -v found: "${cupsName}" -> URI: ${uri}`)

            if (!printersMap.has(cupsName)) {
              printersMap.set(cupsName, {
                name: cupsName,
                displayName: displayName,
                isDefault: false,
                status: 0,
                options: {
                  portName: uri
                }
              })
            } else {
              // Add URI to existing printer
              const existing = printersMap.get(cupsName)!
              existing.options = { ...existing.options, portName: uri }
            }
          }
        }
      } catch (e) {
        console.log('[Printer Service] lpstat -v failed:', e)
      }

      // Method 3: Use system_profiler to get additional printers and enrich data
      try {
        const { stdout } = await execAsync(
          'system_profiler SPPrintersDataType -json 2>/dev/null',
          { encoding: 'utf8' }
        )

        if (stdout.trim()) {
          const data = JSON.parse(stdout)
          const printerData = data.SPPrintersDataType || []

          console.log(`[Printer Service] system_profiler found ${printerData.length} printers`)

          for (const profilerPrinter of printerData) {
            const profilerName = profilerPrinter._name || ''
            const uri = profilerPrinter.uri || ''
            // Generate CUPS-compatible name
            const cupsName = profilerName.replace(/[^a-zA-Z0-9]/g, '_')

            console.log(`[Printer Service] system_profiler printer: "${profilerName}" (cups: "${cupsName}") URI: ${uri}`)

            // Detect connection type from URI
            const isNetwork = uri.startsWith('ipp://') ||
                             uri.startsWith('ipps://') ||
                             uri.startsWith('dnssd://') ||
                             uri.startsWith('socket://') ||
                             uri.includes('._tcp.') ||
                             uri.includes('._ipp') ||
                             uri.includes('network')

            // Find if this printer already exists in our map (check multiple name formats)
            let existingKey: string | null = null
            for (const [key, printer] of printersMap.entries()) {
              const keyLower = key.toLowerCase()
              const cupsNameLower = cupsName.toLowerCase()
              const profilerNameLower = profilerName.toLowerCase().replace(/\s+/g, '_')

              if (
                keyLower === cupsNameLower ||
                keyLower === profilerNameLower ||
                printer.displayName.toLowerCase() === profilerName.toLowerCase() ||
                printer.displayName.toLowerCase().replace(/\s+/g, '_') === profilerNameLower
              ) {
                existingKey = key
                break
              }
            }

            if (existingKey) {
              // Enrich existing printer with additional info
              const existingPrinter = printersMap.get(existingKey)!
              existingPrinter.description = profilerPrinter.ppd || profilerPrinter._name
              existingPrinter.options = {
                ...existingPrinter.options,
                driverName: profilerPrinter.ppd || '',
                portName: uri || existingPrinter.options?.portName || '',
                isNetwork: isNetwork ? 'true' : 'false'
              }
              if (profilerPrinter.default === 'yes' || profilerPrinter.default === 'Yes') {
                existingPrinter.isDefault = true
              }
              console.log(`[Printer Service] Enriched existing printer: "${existingKey}"`)
            } else {
              // Add as new printer (system_profiler found it but lpstat didn't)
              console.log(`[Printer Service] Adding NEW printer from system_profiler: "${profilerName}"`)
              printersMap.set(cupsName, {
                name: cupsName,
                displayName: profilerName,
                description: profilerPrinter.ppd || profilerName,
                isDefault: profilerPrinter.default === 'yes' || profilerPrinter.default === 'Yes',
                status: profilerPrinter.status === 'idle' ? 0 : 1,
                options: {
                  driverName: profilerPrinter.ppd || '',
                  portName: uri,
                  isNetwork: isNetwork ? 'true' : 'false'
                }
              })
            }
          }
        }
      } catch (e) {
        console.log('[Printer Service] system_profiler failed:', e)
      }

      // Convert map to array
      const printers = Array.from(printersMap.values())

      console.log(`[Printer Service] macOS: Total ${printers.length} printers detected`)
      printers.forEach((p, i) => console.log(`[Printer Service]   [${i + 1}] ${p.name} (${p.displayName}) - ${p.options?.portName || 'no URI'}`))

      // Mark default printer
      return printers.map(p => ({
        ...p,
        isDefault: p.name === defaultPrinter || p.isDefault
      }))
    } catch (error) {
      console.error('[Printer Service] macOS detection failed:', error)
      return []
    }
  }

  private async detectLinuxPrinters(): Promise<SystemPrinter[]> {
    try {
      // Use lpstat for CUPS printers
      const { stdout } = await execAsync('lpstat -p -d 2>/dev/null || echo ""', { encoding: 'utf8' })

      const printers: SystemPrinter[] = []
      let defaultPrinter = ''

      const lines = stdout.split('\n')
      for (const line of lines) {
        const printerMatch = line.match(/^printer\s+(\S+)\s+/)
        if (printerMatch) {
          printers.push({
            name: printerMatch[1],
            displayName: printerMatch[1].replace(/_/g, ' '),
            isDefault: false,
            status: line.includes('idle') ? 0 : 1
          })
        }

        const defaultMatch = line.match(/system default destination:\s*(\S+)/)
        if (defaultMatch) {
          defaultPrinter = defaultMatch[1]
        }
      }

      return printers.map(p => ({
        ...p,
        isDefault: p.name === defaultPrinter
      }))
    } catch (error) {
      console.error('[Printer Service] Linux detection failed:', error)
      return []
    }
  }

  private enrichPrinterInfo(systemPrinter: SystemPrinter): DetectedPrinter {
    const name = systemPrinter.name.toLowerCase()
    const displayName = (systemPrinter.displayName || '').toLowerCase()
    const desc = (systemPrinter.description || '').toLowerCase()
    const portName = systemPrinter.options?.portName || ''
    const isNetworkOption = systemPrinter.options?.isNetwork === 'true'

    // Detect printer type based on name/description
    let printerType: PrinterInfo['printerType'] = 'standard'
    let paperWidthMm: number | undefined
    let supportsEscpos = false

    // Thermal receipt printers (80mm)
    // Expanded detection for thermal printers - includes many brands and models
    const isThermalPrinter =
      // Generic thermal indicators
      name.includes('thermal') ||
      name.includes('receipt') ||
      name.includes('ticket') ||
      name.includes('termica') ||
      name.includes('pos') ||
      name.includes('80mm') ||
      name.includes('58mm') ||
      // Epson thermal series
      name.includes('tm-t') || // Epson TM-T series (TM-T20, TM-T88, etc.)
      name.includes('tm-m') || // Epson TM-M series
      name.includes('tm-u') || // Epson TM-U series
      name.includes('tm-p') || // Epson TM-P series (portable)
      name.includes('tm-l') || // Epson TM-L series (label/receipt)
      name.includes('tm-h') || // Epson TM-H series
      name.includes('tmt20') ||
      name.includes('tmt88') ||
      name.includes('tm20') ||
      name.includes('tm88') ||
      // Star Micronics
      name.includes('tsp') || // Star TSP series (TSP100, TSP650, TSP700, TSP800)
      name.includes('sp700') ||
      name.includes('star') ||
      name.includes('mcp') || // Star mC-Print series
      // Bixolon
      name.includes('bixolon') ||
      name.includes('srp-') || // Bixolon SRP series
      // Citizen
      name.includes('citizen') ||
      name.includes('ct-s') || // Citizen CT-S series
      // Samsung/Bixolon
      name.includes('samsung') ||
      // Generic/Chinese brands
      name.includes('rongta') ||
      name.includes('xprinter') ||
      name.includes('munbyn') ||
      name.includes('hoin') ||
      name.includes('zjiang') ||
      name.includes('goojprt') ||
      name.includes('netum') ||
      name.includes('issyzonepos') ||
      name.includes('terow') ||
      name.includes('gainscha') ||
      name.includes('ocpp') || // Generic OCPP thermal
      name.includes('prp-') || // PRP series
      name.includes('rp-') || // RP series thermal
      // USB thermal printers often appear as these
      name.includes('usb printing') ||
      name.includes('pos-') ||
      name.includes('pos58') ||
      name.includes('pos80') ||
      // Check description/display name too
      desc.includes('thermal') ||
      desc.includes('receipt') ||
      desc.includes('pos printer') ||
      desc.includes('ticket') ||
      displayName.includes('thermal') ||
      displayName.includes('tm-t') ||
      displayName.includes('tm-m') ||
      displayName.includes('tsp') ||
      displayName.includes('rongta') ||
      displayName.includes('xprinter') ||
      displayName.includes('bixolon') ||
      displayName.includes('star') ||
      displayName.includes('citizen') ||
      displayName.includes('80mm') ||
      displayName.includes('pos')

    // Exclude regular inkjet/laser printers that might match other patterns
    const isRegularPrinter =
      name.includes('et-') || // Epson EcoTank (inkjet)
      name.includes('wf-') || // Epson WorkForce (inkjet)
      name.includes('xp-') || // Epson Expression (inkjet)
      name.includes('l3') || // Epson L-series (inkjet)
      name.includes('laserjet') ||
      name.includes('inkjet') ||
      name.includes('officejet') ||
      name.includes('deskjet') ||
      name.includes('pixma') || // Canon
      name.includes('mfc-') // Brother MFC

    if (isThermalPrinter && !isRegularPrinter) {
      printerType = 'thermal_80mm'
      paperWidthMm = 80
      supportsEscpos = true
    }

    // Label printers
    if (
      name.includes('label') ||
      name.includes('zebra') ||
      name.includes('dymo') ||
      name.includes('brother ql') ||
      name.includes('zd') || // Zebra ZD series
      name.includes('etiqueta') ||
      name.includes('barcode') || // 4BARCODE and similar
      name.includes('4barcode') ||
      name.includes('tsc') || // TSC label printers
      name.includes('godex') || // Godex label printers
      name.includes('honeywell') || // Honeywell/Datamax
      name.includes('sato') || // SATO label printers
      name.includes('citizen cl') || // Citizen CL series
      name.includes('postek') || // Postek label printers
      displayName.includes('label') ||
      displayName.includes('zebra') ||
      displayName.includes('barcode')
    ) {
      if (name.includes('4x6') || name.includes('shipping') || name.includes('envio')) {
        printerType = 'label_4x6'
        paperWidthMm = 100 // ~4 inches
      } else {
        printerType = 'label_barcode'
        paperWidthMm = 51 // 2 inches (standard price label)
      }
    }

    // Detect connection type
    let connectionType: PrinterInfo['connectionType'] = 'usb'

    // Check various indicators for network printers
    if (
      isNetworkOption ||
      portName.includes('ipp://') ||
      portName.includes('ipps://') ||
      portName.includes('socket://') ||
      portName.includes('http://') ||
      portName.includes('IP') ||
      name.includes('network') ||
      name.includes('red') ||
      systemPrinter.options?.networkAddress
    ) {
      connectionType = 'network'
    } else if (name.includes('bluetooth') || name.includes('bt')) {
      connectionType = 'bluetooth'
    }

    // Extract network address if applicable
    let networkAddress: string | undefined = systemPrinter.options?.networkAddress

    if (!networkAddress && connectionType === 'network') {
      // Try to extract from port name
      const ipMatch = portName.match(/\/\/([^\/\:]+)/)
      if (ipMatch) {
        networkAddress = ipMatch[1]
      } else {
        // Try simple IP pattern
        const simpleIpMatch = portName.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/)
        if (simpleIpMatch) {
          networkAddress = simpleIpMatch[1]
        }
      }
    }

    // Determine if printer is online based on status
    // Status 0 = idle (online), Status 1 = other status (may still be online)
    // If no status info, assume online if printer was detected
    const isOnline = systemPrinter.status === 0 || systemPrinter.status === undefined

    // Detect if this is a Zebra printer (uses ZPL language)
    const isZebra = name.includes('zebra') ||
                    name.includes('zpl') ||
                    name.includes('ztc') ||
                    name.includes('zd') || // Zebra ZD series
                    displayName.includes('zebra') ||
                    desc.includes('zebra') ||
                    desc.includes('zpl')

    if (isZebra) {
      console.log(`[Printer Service] Detected Zebra printer: ${systemPrinter.name}`)
    }

    return {
      systemName: systemPrinter.name,
      printerName: systemPrinter.displayName || systemPrinter.name,
      printerId: systemPrinter.name,
      driverName: systemPrinter.description,
      printerType,
      connectionType,
      networkAddress,
      supportsEscpos,
      supportsRaw: true, // Most modern printers support raw
      paperWidthMm,
      isDefault: systemPrinter.isDefault,
      isOnline,
      isZebra
    }
  }

  getPrinters(): DetectedPrinter[] {
    return this.printers
  }

  getPrinterByName(name: string): DetectedPrinter | undefined {
    return this.printers.find(
      p => p.printerName === name || p.systemName === name
    )
  }

  getDefaultPrinter(): DetectedPrinter | undefined {
    return this.printers.find(p => p.isDefault)
  }

  getThermalPrinters(): DetectedPrinter[] {
    return this.printers.filter(p => p.printerType === 'thermal_80mm')
  }

  getLabelPrinters(): DetectedPrinter[] {
    return this.printers.filter(
      p => p.printerType === 'label_4x6' || p.printerType === 'label_barcode'
    )
  }

  getStandardPrinters(): DetectedPrinter[] {
    // Return non-thermal, non-label printers (like EPSON inkjet/laser)
    return this.printers.filter(
      p => p.printerType === 'standard' && !p.isZebra
    )
  }

  getZebraPrinters(): DetectedPrinter[] {
    return this.printers.filter(p => p.isZebra)
  }

  isZebraPrinter(printerName: string): boolean {
    const printer = this.getPrinterByName(printerName)
    return printer?.isZebra ?? false
  }

  async checkPrinterOnline(printerName: string): Promise<boolean> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(
          `powershell -Command "(Get-Printer -Name '${printerName}').PrinterStatus"`,
          { encoding: 'utf8' }
        )
        // Status 0 = Normal, 3 = Idle
        const status = parseInt(stdout.trim())
        return status === 0 || status === 3
      } else {
        // Try lpstat first
        try {
          const { stdout } = await execAsync(
            `lpstat -p "${printerName}" 2>/dev/null`,
            { encoding: 'utf8' }
          )
          if (stdout.includes('idle') || stdout.includes('enabled') || stdout.includes('is ready')) {
            return true
          }
        } catch {
          // lpstat might fail, try alternative
        }

        // Try system_profiler as backup
        try {
          const { stdout } = await execAsync(
            `system_profiler SPPrintersDataType -json 2>/dev/null`,
            { encoding: 'utf8' }
          )
          const data = JSON.parse(stdout)
          const printers = data.SPPrintersDataType || []
          for (const printer of printers) {
            const name = printer._name?.replace(/\s+/g, '_')
            if (name === printerName || printer._name === printerName) {
              // Check status - idle, ready, printing are all "online"
              const status = (printer.status || '').toLowerCase()
              return status === 'idle' || status === 'ready' || status === 'printing' || !status
            }
          }
        } catch {
          // system_profiler failed
        }

        // If we have the printer in our list, assume it's online
        const printer = this.printers.find(p => p.systemName === printerName || p.printerName === printerName)
        if (printer) {
          return true // Assume online if detected
        }

        return false
      }
    } catch {
      return false
    }
  }

  /**
   * Print a test page to verify the printer is working
   */
  async printTestPage(printerName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const printer = this.getPrinterByName(printerName)
      if (!printer) {
        return { success: false, error: 'Impresora no encontrada' }
      }

      console.log(`[Printer Service] Printing test page to: ${printerName}`)
      console.log(`[Printer Service]   - Is Zebra: ${printer.isZebra}`)
      console.log(`[Printer Service]   - RAW Queue: ${printer.rawQueueName || 'none'}`)

      const fs = await import('fs').then(m => m.promises)
      const timestamp = Date.now()

      if (process.platform === 'win32') {
        // Windows: Create temp file and print using PowerShell
        const os = await import('os')
        const path = await import('path')
        const testContent = `
=====================================
   PRUEBA DE IMPRESION
   LogiRapid Print Service v1.16.0
=====================================

Fecha: ${new Date().toLocaleString('es-ES')}
Impresora: ${printer.printerName}
Tipo: ${printer.printerType}
Conexion: ${printer.connectionType}

Esta es una pagina de prueba.
Si puede ver este texto, la
impresora esta funcionando
correctamente.

=====================================
`
        const tempFile = path.join(os.tmpdir(), `logirapid_test_${timestamp}.txt`)
        await fs.writeFile(tempFile, testContent)

        // Use PowerShell Out-Printer to send to specific printer
        const escapedPrinterName = printerName.replace(/'/g, "''")
        const escapedFilePath = tempFile.replace(/'/g, "''")

        console.log(`[Printer Service] Windows: Printing test to "${printerName}"`)

        try {
          await execAsync(
            `powershell -Command "Get-Content '${escapedFilePath}' | Out-Printer -Name '${escapedPrinterName}'"`,
            { encoding: 'utf8', timeout: 30000 }
          )
        } catch (printError: any) {
          // Fallback: try using notepad /pt (print to)
          console.log(`[Printer Service] Out-Printer failed, trying notepad fallback:`, printError.message)
          await execAsync(
            `notepad /pt "${tempFile}" "${printerName}"`,
            { encoding: 'utf8', timeout: 30000 }
          )
        }

        // Clean up temp file after a delay
        setTimeout(async () => {
          try {
            await fs.unlink(tempFile)
          } catch {
            // Ignore cleanup errors
          }
        }, 10000)
      } else if (printer.isZebra) {
        // Zebra printers: Send ZPL test label
        const date = new Date().toLocaleString('es-ES')
        const zplContent = `^XA
^PW400
^LL200
^FO20,20^A0N,30,30^FDPRUEBA IMPRESION^FS
^FO20,60^A0N,22,22^FDLogiRapid v1.14.0^FS
^FO20,95^A0N,18,18^FD${date}^FS
^FO20,130^A0N,18,18^FD${printer.printerName}^FS
^FO20,160^BY2^BCN,40,Y,N,N^FD123456789^FS
^XZ`

        const tempFile = `/tmp/logirapid_test_zpl_${timestamp}.txt`
        await fs.writeFile(tempFile, zplContent)

        if (process.platform === 'darwin') {
          // macOS: Use Python script with libusb for direct USB communication
          // This bypasses CUPS driver filters completely
          const scriptPath = require('path').join(__dirname, '../../scripts/zebra_print.py')

          console.log(`[Printer Service] Using Python USB direct for Zebra test page`)
          console.log(`[Printer Service] Script: ${scriptPath}`)

          try {
            const { stdout, stderr } = await execAsync(
              `python3 '${scriptPath}' '${tempFile}'`,
              { encoding: 'utf8' }
            )
            console.log(`[Printer Service] Python USB output:`, stdout || stderr)

            if (stderr && stderr.includes('ERROR')) {
              throw new Error(stderr)
            }
          } catch (pythonError) {
            console.log(`[Printer Service] Python USB failed, trying CUPS backend...`)
            // Fallback to CUPS backend
            const deviceUri = await this.getZebraDeviceUri()
            if (deviceUri) {
              const { stdout, stderr } = await execAsync(
                `cat '${tempFile}' | /usr/libexec/cups/backend/usb 1 user "Test Page" 1 ''`,
                {
                  encoding: 'utf8',
                  env: { ...process.env, DEVICE_URI: deviceUri }
                }
              )
              console.log(`[Printer Service] CUPS backend output:`, stdout || stderr)
            }
          }
        } else {
          // Linux: Use lp with raw option
          const queueName = printer.rawQueueName || printer.systemName
          const escapedQueue = queueName.replace(/'/g, "'\\''")

          console.log(`[Printer Service] Sending ZPL to queue: ${queueName}`)
          const { stdout, stderr } = await execAsync(`lp -d '${escapedQueue}' -o raw '${tempFile}'`, { encoding: 'utf8' })
          console.log(`[Printer Service] ZPL sent:`, stdout || stderr)
        }

        // Clean up temp file after a delay
        setTimeout(async () => {
          try {
            await fs.unlink(tempFile)
          } catch {
            // Ignore cleanup errors
          }
        }, 5000)
      } else {
        // Standard printers: Send text test page
        const testContent = `
=====================================
   PRUEBA DE IMPRESION
   LogiRapid Print Service v1.14.0
=====================================

Fecha: ${new Date().toLocaleString('es-ES')}
Impresora: ${printer.printerName}
Tipo: ${printer.printerType}
Conexion: ${printer.connectionType}
${printer.networkAddress ? `IP: ${printer.networkAddress}` : ''}

Esta es una pagina de prueba.
Si puede ver este texto, la
impresora esta funcionando
correctamente.

=====================================
`
        const tempFile = `/tmp/logirapid_test_print_${timestamp}.txt`
        await fs.writeFile(tempFile, testContent)

        // Print using lp command
        const systemName = printer.systemName.replace(/'/g, "'\\''")
        await execAsync(`lp -d '${systemName}' '${tempFile}'`, { encoding: 'utf8' })

        // Clean up temp file after a delay
        setTimeout(async () => {
          try {
            await fs.unlink(tempFile)
          } catch {
            // Ignore cleanup errors
          }
        }, 5000)
      }

      console.log(`[Printer Service] Test page sent successfully to: ${printerName}`)
      return { success: true }
    } catch (error) {
      console.error(`[Printer Service] Test print failed:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al imprimir'
      }
    }
  }

  async getAllPrinterStatuses(): Promise<{ printerId: number; isOnline: boolean }[]> {
    const statuses: { printerId: number; isOnline: boolean }[] = []

    for (const printer of this.printers) {
      const isOnline = await this.checkPrinterOnline(printer.systemName)
      // Note: We'd need to map to server printer IDs
      // For now, we'll handle this in the job processor
      statuses.push({
        printerId: 0, // Will be set when we have server mapping
        isOnline
      })
    }

    return statuses
  }

  getLastRefresh(): Date | null {
    return this.lastRefresh
  }

  /**
   * Get the USB device URI for Zebra printers on macOS
   */
  async getZebraDeviceUri(): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`lpstat -v | grep -i zebra`, { encoding: 'utf8' })
      const lines = stdout.split('\n')

      for (const line of lines) {
        // Parse: "dispositivo para PrinterName: usb://..."
        const match = line.match(/:\s*(usb:\/\/[^\s]+)/)
        if (match) {
          return match[1]
        }
      }

      return null
    } catch {
      return null
    }
  }
}

export const printerService = new PrinterService()
export type { DetectedPrinter }
