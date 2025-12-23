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

      this.printers = systemPrinters.map(p => this.enrichPrinterInfo(p))
      this.lastRefresh = new Date()

      console.log(`[Printer Service] Detected ${this.printers.length} printers`)
      return this.printers
    } catch (error) {
      console.error('[Printer Service] Detection failed:', error)
      return []
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
      const printers: SystemPrinter[] = []
      let defaultPrinter = ''

      // Method 1: Use lpstat for CUPS printers
      try {
        const { stdout } = await execAsync('lpstat -p -d 2>/dev/null', { encoding: 'utf8' })
        const lines = stdout.split('\n')

        for (const line of lines) {
          // Parse "printer PrinterName is idle." or similar
          const printerMatch = line.match(/^printer\s+(\S+)\s+/)
          if (printerMatch) {
            printers.push({
              name: printerMatch[1],
              displayName: printerMatch[1].replace(/_/g, ' '),
              isDefault: false,
              status: line.includes('idle') ? 0 : 1
            })
          }

          // Parse "system default destination: PrinterName"
          const defaultMatch = line.match(/system default destination:\s*(\S+)/)
          if (defaultMatch) {
            defaultPrinter = defaultMatch[1]
          }
        }
      } catch (e) {
        console.log('[Printer Service] lpstat failed, trying alternative methods')
      }

      // Method 2: Use system_profiler for more comprehensive printer list
      try {
        const { stdout } = await execAsync(
          'system_profiler SPPrintersDataType -json 2>/dev/null',
          { encoding: 'utf8' }
        )

        if (stdout.trim()) {
          const data = JSON.parse(stdout)
          const printerData = data.SPPrintersDataType || []

          for (const printer of printerData) {
            const name = printer._name || ''
            // Check if already added via lpstat
            if (!printers.find(p => p.name === name || p.displayName === name)) {
              const isNetwork = printer.uri?.startsWith('ipp://') ||
                               printer.uri?.startsWith('ipps://') ||
                               printer.uri?.startsWith('socket://') ||
                               printer.uri?.includes('network')

              printers.push({
                name: name.replace(/\s+/g, '_'),
                displayName: name,
                description: printer.ppd || printer._name,
                isDefault: printer.default === 'Yes',
                status: printer.status === 'idle' ? 0 : 1,
                options: {
                  driverName: printer.ppd || '',
                  portName: printer.uri || '',
                  isNetwork: isNetwork ? 'true' : 'false'
                }
              })

              if (printer.default === 'Yes') {
                defaultPrinter = name.replace(/\s+/g, '_')
              }
            }
          }
        }
      } catch (e) {
        console.log('[Printer Service] system_profiler failed:', e)
      }

      // Method 3: Use lpinfo to discover network printers (if available)
      try {
        const { stdout } = await execAsync('lpinfo -v 2>/dev/null | grep -E "(socket|ipp|ipps)" | head -20', { encoding: 'utf8' })
        const lines = stdout.split('\n').filter(l => l.trim())

        for (const line of lines) {
          // Parse "network ipp://192.168.1.100/ipp/print"
          const match = line.match(/^(network|direct)\s+(\S+)/)
          if (match) {
            const uri = match[2]
            // Extract IP or hostname
            const hostMatch = uri.match(/:\/\/([^\/]+)/)
            if (hostMatch) {
              const host = hostMatch[1].split(':')[0]
              const printerName = `Network_${host.replace(/\./g, '_')}`

              // Check if not already added
              if (!printers.find(p => p.name.includes(host.replace(/\./g, '_')))) {
                printers.push({
                  name: printerName,
                  displayName: `Impresora de Red (${host})`,
                  description: uri,
                  isDefault: false,
                  status: 0,
                  options: {
                    portName: uri,
                    isNetwork: 'true',
                    networkAddress: host
                  }
                })
              }
            }
          }
        }
      } catch (e) {
        // lpinfo might not be available or have permissions
        console.log('[Printer Service] lpinfo not available for network discovery')
      }

      console.log(`[Printer Service] macOS: Found ${printers.length} printers`)

      // Mark default printer
      return printers.map(p => ({
        ...p,
        isDefault: p.name === defaultPrinter || p.displayName === defaultPrinter
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
    // Be specific about thermal printers - not all Epson printers are thermal!
    const isThermalPrinter =
      name.includes('thermal') ||
      name.includes('tm-t') || // Epson TM-T series (thermal)
      name.includes('tm-m') || // Epson TM-M series (thermal)
      name.includes('tm-u') || // Epson TM-U series (thermal)
      name.includes('tm-p') || // Epson TM-P series (portable thermal)
      name.includes('tsp') || // Star TSP series
      name.includes('sp700') || // Star SP700
      name.includes('receipt') ||
      name.includes('ticket') ||
      name.includes('termica') ||
      desc.includes('thermal') ||
      desc.includes('receipt') ||
      displayName.includes('thermal') ||
      displayName.includes('tm-t') ||
      displayName.includes('tm-m') ||
      displayName.includes('tsp')

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
      displayName.includes('label') ||
      displayName.includes('zebra')
    ) {
      if (name.includes('4x6') || name.includes('shipping') || name.includes('envio')) {
        printerType = 'label_4x6'
        paperWidthMm = 100 // ~4 inches
      } else {
        printerType = 'label_barcode'
        paperWidthMm = 50
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
      isDefault: systemPrinter.isDefault
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

      if (process.platform === 'win32') {
        // Windows: Use PowerShell to print a test page
        await execAsync(
          `powershell -Command "Start-Process -FilePath 'notepad' -ArgumentList '/p' -Wait"`,
          { encoding: 'utf8' }
        )
      } else {
        // macOS/Linux: Create a simple test file and print it
        const testContent = `
=====================================
   PRUEBA DE IMPRESION
   LogiRapid Print Service v1.6.0
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
        // Write to temp file
        const fs = await import('fs').then(m => m.promises)
        const tempFile = `/tmp/logirapid_test_print_${Date.now()}.txt`
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
}

export const printerService = new PrinterService()
export type { DetectedPrinter }
