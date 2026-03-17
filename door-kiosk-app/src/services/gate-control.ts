export interface GateController {
  openGate(): Promise<void>
  closeGate(): Promise<void>
  getStatus(): Promise<'open' | 'closed' | 'unknown'>
}

/** No-op implementation — future: BLE or WiFi relay */
class NoOpGateController implements GateController {
  async openGate(): Promise<void> {
    console.log('[GateControl] openGate() — stub')
  }

  async closeGate(): Promise<void> {
    console.log('[GateControl] closeGate() — stub')
  }

  async getStatus(): Promise<'open' | 'closed' | 'unknown'> {
    return 'unknown'
  }
}

export const gateController: GateController = new NoOpGateController()
