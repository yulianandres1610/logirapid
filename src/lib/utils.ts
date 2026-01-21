import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

/**
 * Parse a date string safely, avoiding timezone issues with DATE type from PostgreSQL.
 * When date is in format "YYYY-MM-DD", JavaScript's Date() interprets it as UTC midnight,
 * which can cause the date to shift by one day in local timezones.
 * This function handles that by parsing the date components directly.
 */
export function parseDateSafe(date: Date | string | null | undefined): Date | null {
  if (!date) return null

  if (date instanceof Date) return date

  // If it's a date-only string (YYYY-MM-DD), parse it as local time to avoid timezone shift
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number)
    return new Date(year, month - 1, day) // month is 0-indexed
  }

  // For datetime strings or other formats, use standard parsing
  return new Date(date)
}

export function formatDate(date: Date | string | null | undefined): string {
  const d = parseDateSafe(date)
  if (!d || isNaN(d.getTime())) return ''

  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

export function formatDateShort(date: Date | string | null | undefined): string {
  const d = parseDateSafe(date)
  if (!d || isNaN(d.getTime())) return ''

  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return ''

  // For datetime, use standard parsing since it includes time info
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''

  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePassword(password: string): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una mayúscula')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una minúscula')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}