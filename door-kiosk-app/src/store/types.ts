export type KioskStep =
  | 'login'
  | 'kiosk_select'
  | 'loading'
  | 'guard_pin'
  | 'idle'
  | 'today_log'
  | 'processing'
  | 'purpose_select'
  | 'entry_success'
  | 'exit_pending'
  | 'exit_success'
  | 'error'
  | 'settings'
  | 'inside_list'
  | 'print_label'

export interface KioskInfo {
  id: number
  name: string
  location: string | null
  deviceId: string
  companyId?: number
  companyName?: string
  companyLogo?: string | null
}

export interface GuardInfo {
  id: number
  name: string
  code: string
  role?: string
}

export interface AvailableKiosk {
  id: number
  name: string
  location: string | null
  deviceId: string
}

export interface VisitorInfo {
  id: number
  fullName: string
  idType: string | null
  idNumber: string
  dateOfBirth: string | null
  address: string | null
  totalVisits: number
  isCurrentlyInside: boolean
  activeLogId: number | null
}

export interface PendingSale {
  type: 'pos_receipt' | 'wholesale_invoice'
  id: number
  documentNumber: string
  customerName: string
  total: number
  currency: string
  items: any
  createdAt: string
  alreadyValidated: boolean
}

export interface ScannedInvoice {
  documentNumber: string
  validated: boolean
  reason?: string
}

export interface KioskStats {
  visitorsInside: number
  totalVisitorsToday: number
}

export interface ScannedProduct {
  id: number
  name: string
  sku: string
  barcode: string
  imageUrl: string | null
  sellingPrice: number
  currency: string
  unitOfMeasure: string | null
  categoryName: string | null
}

export interface PrintJobResult {
  jobId: number
  jobNumber: string
  status: string
  printServiceId: number | null
}
