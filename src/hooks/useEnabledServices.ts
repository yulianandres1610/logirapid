import { useCompany } from '@/contexts/company-context'

/**
 * Mapeo de rutas a IDs de submódulos
 * Formato: 'paqueteria:submodule-id'
 */
const SUBMODULE_MAP: Record<string, string> = {
  'pickup-orders': 'paqueteria:pickup-orders',
  'office-orders': 'paqueteria:office-orders',
  'warehouses': 'paqueteria:warehouses',
  'drivers': 'paqueteria:drivers',
  'vehicles': 'paqueteria:vehicles',
  'routes': 'paqueteria:routes',
  'package-route': 'paqueteria:package-route',
}

/**
 * Hook para verificar servicios habilitados de la empresa
 * - SUPER_ADMIN: Siempre retorna true (acceso completo)
 * - ADMIN/MANAGER/USER: Verifica enabledServices de la empresa
 *
 * Soporta submódulos con formato 'servicio:submodulo' (ej: 'paqueteria:routes')
 */
export function useEnabledServices() {
  const { companyInfo, isLoading } = useCompany()

  const { userRole, enabledServices = [] } = companyInfo

  /**
   * Verifica si un servicio específico está habilitado
   * Soporta formato jerárquico: 'paqueteria:routes'
   * @param serviceId - ID del servicio (ej: 'paqueteria', 'paqueteria:routes')
   * @returns true si el servicio está habilitado o si es SUPER_ADMIN
   */
  const hasService = (serviceId: string): boolean => {
    // SUPER_ADMIN siempre tiene acceso a todo
    if (userRole === 'SUPER_ADMIN') return true

    // Verificar coincidencia exacta
    if (enabledServices.includes(serviceId)) return true

    // Si es un servicio padre (ej: 'paqueteria'), verificar si tiene algún submódulo
    if (!serviceId.includes(':')) {
      const hasAnySubmodule = enabledServices.some((s: string) => s.startsWith(`${serviceId}:`))
      if (hasAnySubmodule) return true
    }

    return false
  }

  /**
   * Verifica si un submódulo específico está habilitado
   * @param submoduleKey - Key del submódulo según ruta (ej: 'pickup-orders', 'routes')
   * @returns true si el submódulo está habilitado o si es SUPER_ADMIN
   */
  const hasSubmodule = (submoduleKey: string): boolean => {
    // SUPER_ADMIN siempre tiene acceso a todo
    if (userRole === 'SUPER_ADMIN') return true

    // Obtener el ID del submódulo
    const submoduleId = SUBMODULE_MAP[submoduleKey]
    if (!submoduleId) return false

    return enabledServices.includes(submoduleId)
  }

  /**
   * Obtiene los submódulos habilitados para un servicio padre
   * @param parentServiceId - ID del servicio padre (ej: 'paqueteria')
   * @returns Array de IDs de submódulos habilitados
   */
  const getEnabledSubmodules = (parentServiceId: string): string[] => {
    // SUPER_ADMIN tiene todos los submódulos
    if (userRole === 'SUPER_ADMIN') {
      return Object.values(SUBMODULE_MAP).filter(id => id.startsWith(`${parentServiceId}:`))
    }

    return enabledServices.filter((s: string) => s.startsWith(`${parentServiceId}:`))
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
    return serviceIds.some(id => hasService(id))
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
    return serviceIds.every(id => hasService(id))
  }

  return {
    enabledServices,
    hasService,
    hasSubmodule,
    getEnabledSubmodules,
    hasAnyService,
    hasAllServices,
    isSuperAdmin: userRole === 'SUPER_ADMIN',
    isLoading
  }
}
