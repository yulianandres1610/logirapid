export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  companyId?: string
  branchId?: string
  avatar?: string
  createdAt: Date
  updatedAt: Date
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'  // Administrador de empresa (puede hacer todo)
  | 'MANAGER'  // Manager de empresa (puede crear usuarios y recargar wallet, pero no empresas ni transferencias)
  | 'USER'  // Usuario de empresa (solo puede vender servicios, debita del wallet)
  | 'COMPANY_ADMIN'
  | 'AGENCY'
  | 'BROKER'
  | 'DRIVER'
  | 'CUSTOMER'

export interface Company {
  id: string
  name: string
  taxId: string
  phone: string
  email: string
  logo?: string
  colors: {
    primary?: string
    secondary?: string
  }
  walletId: string
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  createdAt: Date
  updatedAt: Date
}

export interface Branch {
  id: string
  companyId: string
  name: string
  address: string
  phone: string
  email?: string
  managerId: string
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: Date
  updatedAt: Date
}

export interface Wallet {
  id: string
  accountNumber: string
  balance: number
  currency: string
  companyId: string
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN'
  createdAt: Date
  updatedAt: Date
}

export interface Transaction {
  id: string
  walletId: string
  type: 'CREDIT' | 'DEBIT' | 'TRANSFER_OUT' | 'TRANSFER_IN'
  amount: number
  description: string
  reference?: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface Service {
  id: string
  name: string
  type: ServiceType
  commissionRate: number
  status: 'ACTIVE' | 'INACTIVE'
  companyId?: string
  createdAt: Date
  updatedAt: Date
}

export type ServiceType =
  | 'REMITTANCE'
  | 'RECHARGE'
  | 'CAR_RENTAL'
  | 'TICKET'
  | 'MARKETPLACE'

export interface Order {
  id: string
  serviceId: string
  customerId: string
  agencyId: string
  amount: number
  commission: number
  total: number
  status: OrderStatus
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'

// Auth related types
export interface LoginCredentials {
  email: string
  password: string
  remember?: boolean
}

export interface RegisterData {
  name: string
  email: string
  password: string
  confirmPassword: string
  role?: UserRole
  companyId?: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isTransitioning: boolean
  error: string | null
}

// Dashboard related types
export interface DashboardStats {
  totalCompanies: number
  totalUsers: number
  monthlyTransactions: number
  totalRevenue: number
  activeServices: number
  growthRate: number
}

export interface ChartData {
  name: string
  value: number
  date?: string
  trend?: 'up' | 'down' | 'stable'
}

// Form related types
export interface FormErrors {
  [key: string]: string[] | string | undefined
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Pagination related types
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}