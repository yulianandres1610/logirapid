// Utilidades para respuestas estandarizadas del API

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
  timestamp: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface ErrorDetail {
  field: string
  message: string
  code?: string
}

export class ResponseHelper {
  static success<T>(
    data: T,
    message?: string,
    pagination?: ApiResponse<T>['pagination']
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      pagination
    }
  }

  static error(
    error: string,
    details?: ErrorDetail[],
    code?: string
  ): Omit<ApiResponse, 'success' | 'timestamp'> {
    return {
      success: false,
      error,
      ...(details && { details }),
      ...(code && { code }),
      timestamp: new Date().toISOString()
    } as any
  }

  static created<T>(
    data: T,
    message: string = 'Recurso creado exitosamente'
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    }
  }

  static updated<T>(
    data: T,
    message: string = 'Recurso actualizado exitosamente'
  ): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString()
    }
  }

  static deleted(
    message: string = 'Recurso eliminado exitosamente'
  ): Omit<ApiResponse, 'success' | 'timestamp' | 'data'> {
    return {
      success: true,
      message,
      timestamp: new Date().toISOString()
    } as any
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message?: string
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  }
}

// Validaciones comunes
export class ValidationHelper {
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  static validatePercentage(value: number): { isValid: boolean; error?: string } {
    if (typeof value !== 'number' || isNaN(value)) {
      return { isValid: false, error: 'El valor debe ser un número' }
    }

    if (value < -50) {
      return { isValid: false, error: 'El porcentaje no puede ser menor a -50%' }
    }

    if (value > 100) {
      return { isValid: false, error: 'El porcentaje no puede ser mayor a 100%' }
    }

    return { isValid: true }
  }

  static validateCurrency(currency: string): boolean {
    const validCurrencies = ['USD', 'EUR', 'MLC', 'GBP', 'CAD', 'MXN', 'BRL', 'ZELLE', 'CLA']
    return validCurrencies.includes(currency.toUpperCase())
  }

  static validateRequired(obj: any, fields: string[]): { isValid: boolean; errors: ErrorDetail[] } {
    const errors: ErrorDetail[] = []

    fields.forEach(field => {
      if (!obj[field] || (typeof obj[field] === 'string' && obj[field].trim() === '')) {
        errors.push({
          field,
          message: `El campo ${field} es requerido`,
          code: 'REQUIRED_FIELD'
        })
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}

// Formateadores
export class FormatHelper {
  static formatCurrency(amount: number, currency: string = 'CUP'): string {
    return new Intl.NumberFormat('es-CU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount)
  }

  static formatDate(date: string | Date, locale: string = 'es-CU'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj)
  }

  static formatPercentage(value: number): string {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(2)}%`
  }
}