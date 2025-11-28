import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Tipos para el sistema de servicios
 */
interface Submodule {
  id: string
  name: string
  description: string
  icon: string
  route: string
}

interface ServiceWithSubmodules {
  id: string
  name: string
  description: string
  icon: string
  hasSubmodules: true
  submodules: Record<string, Submodule>
}

interface ServiceWithoutSubmodules {
  id: string
  name: string
  description: string
  icon: string
  hasSubmodules: false
}

type ServiceDefinition = ServiceWithSubmodules | ServiceWithoutSubmodules

/**
 * Definición de servicios disponibles con sus submódulos
 * Formato jerárquico: 'servicio:submodulo'
 */
const SERVICES_DEFINITION: Record<string, ServiceDefinition> = {
  wallet: {
    id: 'wallet',
    name: 'Wallet',
    description: 'Gestión de billeteras digitales',
    icon: 'Wallet',
    hasSubmodules: false
  },
  recharge: {
    id: 'recharge',
    name: 'Recarga',
    description: 'Recargas móviles y servicios',
    icon: 'Smartphone',
    hasSubmodules: false
  },
  remittance: {
    id: 'remittance',
    name: 'Remesa',
    description: 'Envío de remesas internacionales',
    icon: 'Send',
    hasSubmodules: false
  },
  paqueteria: {
    id: 'paqueteria',
    name: 'Paquetería',
    description: 'Servicio de envío y entrega de paquetes',
    icon: 'Package',
    hasSubmodules: true,
    submodules: {
      'pickup-orders': {
        id: 'paqueteria:pickup-orders',
        name: 'Órdenes de Recogida',
        description: 'Gestión de órdenes a domicilio',
        icon: 'Truck',
        route: '/pickup-orders'
      },
      'office-orders': {
        id: 'paqueteria:office-orders',
        name: 'Órdenes de Oficina',
        description: 'Gestión de órdenes en oficina',
        icon: 'Store',
        route: '/office-orders'
      },
      'warehouses': {
        id: 'paqueteria:warehouses',
        name: 'Almacenes',
        description: 'Gestión de almacenes y depósitos',
        icon: 'Warehouse',
        route: '/warehouses'
      },
      'drivers': {
        id: 'paqueteria:drivers',
        name: 'Drivers',
        description: 'Gestión de conductores',
        icon: 'User',
        route: '/drivers'
      },
      'vehicles': {
        id: 'paqueteria:vehicles',
        name: 'Vehículos',
        description: 'Gestión de flota vehicular',
        icon: 'Car',
        route: '/vehicles'
      },
      'routes': {
        id: 'paqueteria:routes',
        name: 'Rutas',
        description: 'Planificación y optimización de rutas',
        icon: 'Route',
        route: '/routes'
      },
      'package-route': {
        id: 'paqueteria:package-route',
        name: 'Empaque',
        description: 'Gestión de empaques y cajas',
        icon: 'Box',
        route: '/package-route'
      }
    }
  },
  tracker: {
    id: 'tracker',
    name: 'Rastreador',
    description: 'Seguimiento de envíos',
    icon: 'MapPin',
    hasSubmodules: false
  },
  exchange: {
    id: 'exchange',
    name: 'Tasa de Cambio',
    description: 'Gestión de tasas de cambio',
    icon: 'BarChart3',
    hasSubmodules: false
  },
  marketplace: {
    id: 'marketplace',
    name: 'Mercado',
    description: 'Plataforma de compra y venta',
    icon: 'ShoppingCart',
    hasSubmodules: false
  }
}

/**
 * GET /api/companies/[id]/services
 * Obtiene los servicios habilitados de una empresa con información estructurada
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     companyId: number,
 *     companyName: string,
 *     enabledServices: string[],  // Array original de IDs
 *     services: [                 // Array estructurado con detalles
 *       {
 *         id: 'wallet',
 *         name: 'Wallet',
 *         enabled: true,
 *         hasSubmodules: false
 *       },
 *       {
 *         id: 'paqueteria',
 *         name: 'Paquetería',
 *         enabled: true,
 *         hasSubmodules: true,
 *         submodules: [
 *           { id: 'paqueteria:routes', name: 'Rutas', enabled: true },
 *           { id: 'paqueteria:drivers', name: 'Drivers', enabled: false }
 *         ]
 *       }
 *     ]
 *   }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const companyId = parseInt(id)

    if (isNaN(companyId)) {
      return NextResponse.json(
        { success: false, error: 'ID de empresa inválido' },
        { status: 400 }
      )
    }

    // Obtener servicios habilitados de la empresa
    const query = `
      SELECT
        id,
        legalname as "legalName",
        enabledservices as "enabledServices"
      FROM companies
      WHERE id = $1
    `

    const result = await db.query(query, [companyId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empresa no encontrada' },
        { status: 404 }
      )
    }

    const company = result.rows[0]
    const enabledServices: string[] = company.enabledServices || []

    // Construir respuesta estructurada
    const services = Object.entries(SERVICES_DEFINITION).map(([key, service]) => {
      // Verificar si el servicio está habilitado
      // Para servicios con submódulos, verificar si tiene algún submódulo habilitado
      let isEnabled = false

      if (service.hasSubmodules && service.submodules) {
        // Para paquetería, verificar submódulos
        const submoduleIds = Object.values(service.submodules).map(s => s.id)
        isEnabled = enabledServices.some(s => submoduleIds.includes(s))
      } else {
        // Para servicios simples
        isEnabled = enabledServices.includes(service.id)
      }

      const serviceResponse: any = {
        id: service.id,
        name: service.name,
        description: service.description,
        icon: service.icon,
        enabled: isEnabled,
        hasSubmodules: service.hasSubmodules
      }

      // Agregar submódulos si existen
      if (service.hasSubmodules && service.submodules) {
        serviceResponse.submodules = Object.entries(service.submodules).map(([subKey, submodule]) => ({
          id: submodule.id,
          key: subKey,
          name: submodule.name,
          description: submodule.description,
          icon: submodule.icon,
          route: submodule.route,
          enabled: enabledServices.includes(submodule.id)
        }))

        // Contar submódulos habilitados
        serviceResponse.enabledSubmodulesCount = serviceResponse.submodules.filter(
          (s: any) => s.enabled
        ).length
        serviceResponse.totalSubmodulesCount = serviceResponse.submodules.length
      }

      return serviceResponse
    })

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.id,
        companyName: company.legalName,
        enabledServices,
        services,
        // Helper para la app: lista plana de servicios/submódulos habilitados
        enabledList: enabledServices,
        // Helper: verificar rápidamente si tiene paquetería
        hasPaqueteria: enabledServices.some(s => s.startsWith('paqueteria:'))
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/services:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
