import { useCompany } from '@/contexts/company-context'

/**
 * Hook para verificar servicios habilitados de la empresa
 * - SUPER_ADMIN: Siempre retorna true (acceso completo)
 * - ADMIN/MANAGER/USER: Verifica enabledServices de la empresa
 */
export function useEnabledServices() {
  const { companyInfo, isLoading } = useCompany()

  const { userRole, enabledServices = [] } = companyInfo

  /**
   * Verifica si un servicio específico está habilitado
   * @param serviceId - ID del servicio (ej: 'paqueteria', 'exchange')
   * @returns true si el servicio está habilitado o si es SUPER_ADMIN
   */
  const hasService = (serviceId: string): boolean => {
    // SUPER_ADMIN siempre tiene acceso a todo
    if (userRole === 'SUPER_ADMIN') return true

    // Usuarios de empresa verifican enabledServices
    return enabledServices.includes(serviceId)
  }

  /**
   * Verifica si tiene al menos uno de los servicios especificados
   * @param serviceIds - Array de IDs de servicios
   * @returns true si tiene al menos uno o si es SUPER_ADMIN
   */
  const hasAnyService = (serviceIds: string[]): boolean => {
    // SUPER_ADMIN siempre tiene acceso a todo
    if (userRole === 'SUPER_ADMIN') return true

    // Usuarios de empresa verifican si tienen al menos uno
    return serviceIds.some(id => enabledServices.includes(id))
  }

  /**
   * Verifica si tiene todos los servicios especificados
   * @param serviceIds - Array de IDs de servicios
   * @returns true si tiene todos o si es SUPER_ADMIN
   */
  const hasAllServices = (serviceIds: string[]): boolean => {
    // SUPER_ADMIN siempre tiene acceso a todo
    if (userRole === 'SUPER_ADMIN') return true

    // Usuarios de empresa verifican si tienen todos
    return serviceIds.every(id => enabledServices.includes(id))
  }

  return {
    enabledServices,
    hasService,
    hasAnyService,
    hasAllServices,
    isSuperAdmin: userRole === 'SUPER_ADMIN',
    isLoading
  }
}
