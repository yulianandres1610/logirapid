import { CONFIG } from '../config'
import type { KioskInfo, GuardInfo, VisitorInfo, PendingSale, KioskStats, AvailableKiosk, ScannedProduct, PrintJobResult } from '../store/types'

const baseUrl = CONFIG.BASE_URL

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const json = await res.json()
  if (!json.success) {
    throw new Error(json.error || 'Error desconocido')
  }
  return json.data
}

export interface AuthGuardResponse {
  guard: GuardInfo
  kiosk?: AvailableKiosk
  kiosks?: AvailableKiosk[]
  redirectTo: string | null
}

export async function authGuard(pin: string): Promise<AuthGuardResponse> {
  return request('/api/market/door-security/auth-guard', {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
}

export async function fetchKioskInfo(kioskId: string): Promise<KioskInfo> {
  return request(`/api/market/door-security/kiosks/${kioskId}/public`)
}

export async function verifyGuard(kioskId: string, pin: string): Promise<{ guard: GuardInfo; kiosk?: any }> {
  return request(`/api/market/door-security/kiosks/${kioskId}/verify-guard`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
}

export async function findOrCreateVisitor(params: {
  kioskId: number
  guardId: number
  fullName: string
  idType: string
  idNumber: string
  dateOfBirth: string | null
}): Promise<VisitorInfo> {
  const data = await request<any>('/api/market/door-security/visitors', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return data.visitor || data
}

export async function fetchPendingSales(logId: number, kioskId: string, guardId: number): Promise<{
  pendingSales: PendingSale[]
  entryTime: string | null
}> {
  const data = await request<any>(
    `/api/market/door-security/logs/${logId}/pending-sales?kioskId=${kioskId}&guardId=${guardId}`
  )
  const ps = data.pendingSales || {}
  const allSales: PendingSale[] = [
    ...(ps.posReceipts || []),
    ...(ps.wholesaleInvoices || []),
  ]
  return {
    pendingSales: allSales,
    entryTime: data.entryTime || null,
  }
}

export async function registerLog(params: {
  kioskId: number
  guardId: number
  visitorId: number
  action: 'entry' | 'exit'
  visitPurpose?: string
  visitNotes?: string
  logId?: number
}): Promise<any> {
  return request('/api/market/door-security/logs', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function scanDocument(params: {
  scannedCode: string
  visitorLogId: number
  kioskId: number
  guardId: number
}): Promise<any> {
  return request('/api/market/door-security/scan-document', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function validateDocument(params: {
  visitorLogId: number
  documentType: string
  documentId: number
  documentNumber: string
  totalAmount?: number
  currency?: string
  kioskId: number
  guardId: number
}): Promise<any> {
  return request('/api/market/door-security/validate-document', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export interface VisitorLogEntry {
  id: number
  visitorName: string
  idNumber: string
  action: string
  entryTime: string
  exitTime: string | null
  visitPurpose: string | null
  status: string
}

export async function fetchTodayLogs(kioskId: string, guardId: number): Promise<VisitorLogEntry[]> {
  const today = new Date().toISOString().split('T')[0]
  const data = await request<any>(
    `/api/market/door-security/logs?kioskId=${kioskId}&guardId=${guardId}&date=${today}&limit=50`
  )
  const logs = data.logs || data || []
  return Array.isArray(logs) ? logs : []
}

export async function fetchKioskStats(kioskId: string, guardId: number): Promise<KioskStats> {
  const data = await request<any>(`/api/market/door-security/kiosk-stats?kioskId=${kioskId}&guardId=${guardId}`)
  return {
    visitorsInside: data.visitorsInside ?? 0,
    totalVisitorsToday: data.totalVisitorsToday ?? 0,
  }
}

export async function scanProduct(params: {
  barcode: string
  kioskId: number
  guardId: number
}): Promise<{ found: boolean; product?: ScannedProduct }> {
  return request('/api/market/door-security/scan-product', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function searchProducts(params: {
  query: string
  kioskId: number
  guardId: number
}): Promise<{ products: ScannedProduct[] }> {
  return request(
    `/api/market/door-security/search-products?query=${encodeURIComponent(params.query)}&kioskId=${params.kioskId}&guardId=${params.guardId}`
  )
}

export async function printProductLabel(params: {
  kioskId: number
  guardId: number
  items: { name: string; barcode: string; sku?: string; price?: number; currency?: string }[]
  copies: number
}): Promise<PrintJobResult> {
  return request('/api/market/door-security/print-label', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}
