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
      // Use lpstat to get printer list
      const { stdout } = await execAsync('lpstat -p -d', { encoding: 'utf8' })

      const printers: SystemPrinter[] = []
      let defaultPrinter = ''

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

      // Mark default printer
      return printers.map(p => ({
        ...p,
        isDefault: p.name === defaultPrinter
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
    const desc = (systemPrinter.description || '').toLowerCase()

    // Detect printer type based on name/description
    let printerType: PrinterInfo['printerType'] = 'standard'
    let paperWidthMm: number | undefined
    let supportsEscpos = false

    // Thermal receipt printers (80mm)
    if (
      name.includes('thermal') ||
      name.includes('tm-t') || // Epson TM-T series
      name.includes('tsp') || // Star TSP series
      name.includes('pos') ||
      name.includes('receipt') ||
      desc.includes('thermal') ||
      desc.includes('pos')
    ) {
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
      name.includes('zd') // Zebra ZD series
    ) {
      if (name.includes('4x6') || name.includes('shipping')) {
        printerType = 'label_4x6'
        paperWidthMm = 100 // ~4 inches
      } else {
        printerType = 'label_barcode'
        paperWidthMm = 50
      }
    }

    // Detect connection type
    let connectionType: PrinterInfo['connectionType'] = 'usb'
    const portName = systemPrinter.options?.portName || ''

    if (portName.includes('IP') || portName.includes(':') || name.includes('network')) {
      connectionType = 'network'
    } else if (name.includes('bluetooth') || name.includes('bt')) {
      connectionType = 'bluetooth'
    }

    // Extract network address if applicable
    let networkAddress: string | undefined
    const ipMatch = portName.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?)/)
    if (ipMatch) {
      networkAddress = ipMatch[1]
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
        const { stdout } = await execAsync(
          `lpstat -p "${printerName}" 2>/dev/null`,
          { encoding: 'utf8' }
        )
        return stdout.includes('idle') || stdout.includes('enabled')
      }
    } catch {
      return false
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
