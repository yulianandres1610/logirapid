import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import { apaCargoClient, ApaCargoCubaMunicipality, ApaCargoCubaState } from '@/lib/apacargo-client'

interface JWTPayload {
  userId: number
  email: string
  role: string
  companyId: number
}

// Cache en memoria para municipios y provincias de Cuba
let municipalitiesCache: {
  data: ApaCargoCubaMunicipality[]
  timestamp: number
} | null = null

let statesCache: {
  data: ApaCargoCubaState[]
  timestamp: number
} | null = null

const CACHE_TTL = 60 * 60 * 1000 // 1 hora

/**
 * GET /api/apacargo/municipalities
 * Obtiene los municipios de Cuba desde ApaCargo
 *
 * Query params:
 * - stateId: Filtrar por provincia (opcional)
 * - includeStates: Incluir lista de provincias en la respuesta (opcional)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const cookieStore = await cookies()
    const authToken = cookieStore.get('auth-token')?.value

    if (!authToken) {
      return NextResponse.json({
        success: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    let payload: JWTPayload
    try {
      const secret = process.env.JWT_SECRET || 'fallback-secret-change-in-production'
      payload = jwt.verify(authToken, secret) as JWTPayload
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 })
    }

    // Verificar que ApaCargo esté configurado
    if (!apaCargoClient.isConfigured()) {
      // Retornar datos estáticos si no está configurado
      return NextResponse.json({
        success: true,
        data: {
          municipalities: getCubanMunicipalitiesFallback(),
          states: getCubanStatesFallback(),
          source: 'fallback'
        }
      })
    }

    const { searchParams } = new URL(request.url)
    const stateId = searchParams.get('stateId')
    const includeStates = searchParams.get('includeStates') === 'true'

    // Obtener municipios (desde cache o API)
    let municipalities: ApaCargoCubaMunicipality[]

    if (municipalitiesCache && Date.now() - municipalitiesCache.timestamp < CACHE_TTL) {
      municipalities = municipalitiesCache.data
    } else {
      try {
        municipalities = await apaCargoClient.getMunicipalities()
        municipalitiesCache = {
          data: municipalities,
          timestamp: Date.now()
        }
      } catch (error) {
        console.error('[ApaCargo Municipalities] Error fetching:', error)
        // Usar fallback si falla la API
        municipalities = getCubanMunicipalitiesFallback()
      }
    }

    // Filtrar por provincia si se especifica
    if (stateId) {
      const stateIdNum = parseInt(stateId)
      municipalities = municipalities.filter(m => m.stateId === stateIdNum)
    }

    // Obtener provincias si se solicitan
    let states: ApaCargoCubaState[] = []
    if (includeStates) {
      if (statesCache && Date.now() - statesCache.timestamp < CACHE_TTL) {
        states = statesCache.data
      } else {
        try {
          states = await apaCargoClient.getCubaStates()
          statesCache = {
            data: states,
            timestamp: Date.now()
          }
        } catch (error) {
          console.error('[ApaCargo States] Error fetching:', error)
          states = getCubanStatesFallback()
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        municipalities,
        states: includeStates ? states : undefined,
        total: municipalities.length,
        source: 'apacargo'
      }
    })

  } catch (error: unknown) {
    const err = error as Error
    console.error('[ApaCargo Municipalities] Error:', err)
    return NextResponse.json({
      success: false,
      error: err.message
    }, { status: 500 })
  }
}

/**
 * Datos de fallback para municipios de Cuba
 * Se usan cuando ApaCargo no está disponible
 */
function getCubanMunicipalitiesFallback(): ApaCargoCubaMunicipality[] {
  return [
    // La Habana (stateId: 1)
    { id: 1, name: 'Playa', stateId: 1, stateName: 'La Habana' },
    { id: 2, name: 'Plaza de la Revolución', stateId: 1, stateName: 'La Habana' },
    { id: 3, name: 'Centro Habana', stateId: 1, stateName: 'La Habana' },
    { id: 4, name: 'La Habana Vieja', stateId: 1, stateName: 'La Habana' },
    { id: 5, name: 'Regla', stateId: 1, stateName: 'La Habana' },
    { id: 6, name: 'La Habana del Este', stateId: 1, stateName: 'La Habana' },
    { id: 7, name: 'Guanabacoa', stateId: 1, stateName: 'La Habana' },
    { id: 8, name: 'San Miguel del Padrón', stateId: 1, stateName: 'La Habana' },
    { id: 9, name: 'Diez de Octubre', stateId: 1, stateName: 'La Habana' },
    { id: 10, name: 'Cerro', stateId: 1, stateName: 'La Habana' },
    { id: 11, name: 'Marianao', stateId: 1, stateName: 'La Habana' },
    { id: 12, name: 'La Lisa', stateId: 1, stateName: 'La Habana' },
    { id: 13, name: 'Boyeros', stateId: 1, stateName: 'La Habana' },
    { id: 14, name: 'Arroyo Naranjo', stateId: 1, stateName: 'La Habana' },
    { id: 15, name: 'Cotorro', stateId: 1, stateName: 'La Habana' },

    // Pinar del Río (stateId: 2)
    { id: 20, name: 'Pinar del Río', stateId: 2, stateName: 'Pinar del Río' },
    { id: 21, name: 'Sandino', stateId: 2, stateName: 'Pinar del Río' },
    { id: 22, name: 'Mantua', stateId: 2, stateName: 'Pinar del Río' },
    { id: 23, name: 'Minas de Matahambre', stateId: 2, stateName: 'Pinar del Río' },
    { id: 24, name: 'Viñales', stateId: 2, stateName: 'Pinar del Río' },
    { id: 25, name: 'La Palma', stateId: 2, stateName: 'Pinar del Río' },
    { id: 26, name: 'Los Palacios', stateId: 2, stateName: 'Pinar del Río' },
    { id: 27, name: 'Consolación del Sur', stateId: 2, stateName: 'Pinar del Río' },
    { id: 28, name: 'San Juan y Martínez', stateId: 2, stateName: 'Pinar del Río' },
    { id: 29, name: 'San Luis', stateId: 2, stateName: 'Pinar del Río' },
    { id: 30, name: 'Guane', stateId: 2, stateName: 'Pinar del Río' },

    // Artemisa (stateId: 3)
    { id: 35, name: 'Artemisa', stateId: 3, stateName: 'Artemisa' },
    { id: 36, name: 'Bahía Honda', stateId: 3, stateName: 'Artemisa' },
    { id: 37, name: 'Mariel', stateId: 3, stateName: 'Artemisa' },
    { id: 38, name: 'Guanajay', stateId: 3, stateName: 'Artemisa' },
    { id: 39, name: 'Caimito', stateId: 3, stateName: 'Artemisa' },
    { id: 40, name: 'Bauta', stateId: 3, stateName: 'Artemisa' },
    { id: 41, name: 'San Antonio de los Baños', stateId: 3, stateName: 'Artemisa' },
    { id: 42, name: 'Güira de Melena', stateId: 3, stateName: 'Artemisa' },
    { id: 43, name: 'Alquízar', stateId: 3, stateName: 'Artemisa' },
    { id: 44, name: 'Candelaria', stateId: 3, stateName: 'Artemisa' },
    { id: 45, name: 'San Cristóbal', stateId: 3, stateName: 'Artemisa' },

    // Mayabeque (stateId: 4)
    { id: 50, name: 'San José de las Lajas', stateId: 4, stateName: 'Mayabeque' },
    { id: 51, name: 'Bejucal', stateId: 4, stateName: 'Mayabeque' },
    { id: 52, name: 'Quivicán', stateId: 4, stateName: 'Mayabeque' },
    { id: 53, name: 'Melena del Sur', stateId: 4, stateName: 'Mayabeque' },
    { id: 54, name: 'Batabanó', stateId: 4, stateName: 'Mayabeque' },
    { id: 55, name: 'San Nicolás', stateId: 4, stateName: 'Mayabeque' },
    { id: 56, name: 'Madruga', stateId: 4, stateName: 'Mayabeque' },
    { id: 57, name: 'Nueva Paz', stateId: 4, stateName: 'Mayabeque' },
    { id: 58, name: 'Santa Cruz del Norte', stateId: 4, stateName: 'Mayabeque' },
    { id: 59, name: 'Jaruco', stateId: 4, stateName: 'Mayabeque' },
    { id: 60, name: 'Güines', stateId: 4, stateName: 'Mayabeque' },

    // Matanzas (stateId: 5)
    { id: 65, name: 'Matanzas', stateId: 5, stateName: 'Matanzas' },
    { id: 66, name: 'Cárdenas', stateId: 5, stateName: 'Matanzas' },
    { id: 67, name: 'Varadero', stateId: 5, stateName: 'Matanzas' },
    { id: 68, name: 'Martí', stateId: 5, stateName: 'Matanzas' },
    { id: 69, name: 'Colón', stateId: 5, stateName: 'Matanzas' },
    { id: 70, name: 'Perico', stateId: 5, stateName: 'Matanzas' },
    { id: 71, name: 'Jovellanos', stateId: 5, stateName: 'Matanzas' },
    { id: 72, name: 'Pedro Betancourt', stateId: 5, stateName: 'Matanzas' },
    { id: 73, name: 'Limonar', stateId: 5, stateName: 'Matanzas' },
    { id: 74, name: 'Unión de Reyes', stateId: 5, stateName: 'Matanzas' },
    { id: 75, name: 'Ciénaga de Zapata', stateId: 5, stateName: 'Matanzas' },
    { id: 76, name: 'Jagüey Grande', stateId: 5, stateName: 'Matanzas' },
    { id: 77, name: 'Calimete', stateId: 5, stateName: 'Matanzas' },
    { id: 78, name: 'Los Arabos', stateId: 5, stateName: 'Matanzas' },

    // Villa Clara (stateId: 6)
    { id: 85, name: 'Santa Clara', stateId: 6, stateName: 'Villa Clara' },
    { id: 86, name: 'Caibarién', stateId: 6, stateName: 'Villa Clara' },
    { id: 87, name: 'Camajuaní', stateId: 6, stateName: 'Villa Clara' },
    { id: 88, name: 'Remedios', stateId: 6, stateName: 'Villa Clara' },
    { id: 89, name: 'Placetas', stateId: 6, stateName: 'Villa Clara' },
    { id: 90, name: 'Manicaragua', stateId: 6, stateName: 'Villa Clara' },
    { id: 91, name: 'Ranchuelo', stateId: 6, stateName: 'Villa Clara' },
    { id: 92, name: 'Cifuentes', stateId: 6, stateName: 'Villa Clara' },
    { id: 93, name: 'Santo Domingo', stateId: 6, stateName: 'Villa Clara' },
    { id: 94, name: 'Encrucijada', stateId: 6, stateName: 'Villa Clara' },
    { id: 95, name: 'Quemado de Güines', stateId: 6, stateName: 'Villa Clara' },
    { id: 96, name: 'Sagua la Grande', stateId: 6, stateName: 'Villa Clara' },
    { id: 97, name: 'Corralillo', stateId: 6, stateName: 'Villa Clara' },

    // Cienfuegos (stateId: 7)
    { id: 100, name: 'Cienfuegos', stateId: 7, stateName: 'Cienfuegos' },
    { id: 101, name: 'Palmira', stateId: 7, stateName: 'Cienfuegos' },
    { id: 102, name: 'Cruces', stateId: 7, stateName: 'Cienfuegos' },
    { id: 103, name: 'Cumanayagua', stateId: 7, stateName: 'Cienfuegos' },
    { id: 104, name: 'Rodas', stateId: 7, stateName: 'Cienfuegos' },
    { id: 105, name: 'Lajas', stateId: 7, stateName: 'Cienfuegos' },
    { id: 106, name: 'Abreus', stateId: 7, stateName: 'Cienfuegos' },
    { id: 107, name: 'Aguada de Pasajeros', stateId: 7, stateName: 'Cienfuegos' },

    // Sancti Spíritus (stateId: 8)
    { id: 110, name: 'Sancti Spíritus', stateId: 8, stateName: 'Sancti Spíritus' },
    { id: 111, name: 'Trinidad', stateId: 8, stateName: 'Sancti Spíritus' },
    { id: 112, name: 'Fomento', stateId: 8, stateName: 'Sancti Spíritus' },
    { id: 113, name: 'Cabaiguán', stateId: 8, stateName: 'Sancti Spíritus' },
    { id: 114, name: 'Taguasco', stateId: 8, stateName: 'Sancti Spíritus' },
    { id: 115, name: 'Jatibonico', stateId: 8, stateName: 'Sancti Spíritus' },
    { id: 116, name: 'Yaguajay', stateId: 8, stateName: 'Sancti Spíritus' },
    { id: 117, name: 'La Sierpe', stateId: 8, stateName: 'Sancti Spíritus' },

    // Ciego de Ávila (stateId: 9)
    { id: 120, name: 'Ciego de Ávila', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 121, name: 'Morón', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 122, name: 'Chambas', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 123, name: 'Ciro Redondo', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 124, name: 'Majagua', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 125, name: 'Florencia', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 126, name: 'Venezuela', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 127, name: 'Baraguá', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 128, name: 'Primero de Enero', stateId: 9, stateName: 'Ciego de Ávila' },
    { id: 129, name: 'Bolivia', stateId: 9, stateName: 'Ciego de Ávila' },

    // Camagüey (stateId: 10)
    { id: 135, name: 'Camagüey', stateId: 10, stateName: 'Camagüey' },
    { id: 136, name: 'Florida', stateId: 10, stateName: 'Camagüey' },
    { id: 137, name: 'Esmeralda', stateId: 10, stateName: 'Camagüey' },
    { id: 138, name: 'Sierra de Cubitas', stateId: 10, stateName: 'Camagüey' },
    { id: 139, name: 'Minas', stateId: 10, stateName: 'Camagüey' },
    { id: 140, name: 'Nuevitas', stateId: 10, stateName: 'Camagüey' },
    { id: 141, name: 'Guáimaro', stateId: 10, stateName: 'Camagüey' },
    { id: 142, name: 'Sibanicú', stateId: 10, stateName: 'Camagüey' },
    { id: 143, name: 'Céspedes', stateId: 10, stateName: 'Camagüey' },
    { id: 144, name: 'Najasa', stateId: 10, stateName: 'Camagüey' },
    { id: 145, name: 'Vertientes', stateId: 10, stateName: 'Camagüey' },
    { id: 146, name: 'Jimaguayú', stateId: 10, stateName: 'Camagüey' },
    { id: 147, name: 'Santa Cruz del Sur', stateId: 10, stateName: 'Camagüey' },

    // Las Tunas (stateId: 11)
    { id: 150, name: 'Las Tunas', stateId: 11, stateName: 'Las Tunas' },
    { id: 151, name: 'Puerto Padre', stateId: 11, stateName: 'Las Tunas' },
    { id: 152, name: 'Jesús Menéndez', stateId: 11, stateName: 'Las Tunas' },
    { id: 153, name: 'Majibacoa', stateId: 11, stateName: 'Las Tunas' },
    { id: 154, name: 'Jobabo', stateId: 11, stateName: 'Las Tunas' },
    { id: 155, name: 'Colombia', stateId: 11, stateName: 'Las Tunas' },
    { id: 156, name: 'Amancio', stateId: 11, stateName: 'Las Tunas' },
    { id: 157, name: 'Manatí', stateId: 11, stateName: 'Las Tunas' },

    // Holguín (stateId: 12)
    { id: 160, name: 'Holguín', stateId: 12, stateName: 'Holguín' },
    { id: 161, name: 'Gibara', stateId: 12, stateName: 'Holguín' },
    { id: 162, name: 'Rafael Freyre', stateId: 12, stateName: 'Holguín' },
    { id: 163, name: 'Banes', stateId: 12, stateName: 'Holguín' },
    { id: 164, name: 'Antilla', stateId: 12, stateName: 'Holguín' },
    { id: 165, name: 'Báguanos', stateId: 12, stateName: 'Holguín' },
    { id: 166, name: 'Calixto García', stateId: 12, stateName: 'Holguín' },
    { id: 167, name: 'Cacocum', stateId: 12, stateName: 'Holguín' },
    { id: 168, name: 'Urbano Noris', stateId: 12, stateName: 'Holguín' },
    { id: 169, name: 'Cueto', stateId: 12, stateName: 'Holguín' },
    { id: 170, name: 'Mayarí', stateId: 12, stateName: 'Holguín' },
    { id: 171, name: 'Frank País', stateId: 12, stateName: 'Holguín' },
    { id: 172, name: 'Sagua de Tánamo', stateId: 12, stateName: 'Holguín' },
    { id: 173, name: 'Moa', stateId: 12, stateName: 'Holguín' },

    // Granma (stateId: 13)
    { id: 180, name: 'Bayamo', stateId: 13, stateName: 'Granma' },
    { id: 181, name: 'Manzanillo', stateId: 13, stateName: 'Granma' },
    { id: 182, name: 'Campechuela', stateId: 13, stateName: 'Granma' },
    { id: 183, name: 'Media Luna', stateId: 13, stateName: 'Granma' },
    { id: 184, name: 'Niquero', stateId: 13, stateName: 'Granma' },
    { id: 185, name: 'Pilón', stateId: 13, stateName: 'Granma' },
    { id: 186, name: 'Bartolomé Masó', stateId: 13, stateName: 'Granma' },
    { id: 187, name: 'Yara', stateId: 13, stateName: 'Granma' },
    { id: 188, name: 'Buey Arriba', stateId: 13, stateName: 'Granma' },
    { id: 189, name: 'Guisa', stateId: 13, stateName: 'Granma' },
    { id: 190, name: 'Jiguaní', stateId: 13, stateName: 'Granma' },
    { id: 191, name: 'Río Cauto', stateId: 13, stateName: 'Granma' },
    { id: 192, name: 'Cauto Cristo', stateId: 13, stateName: 'Granma' },

    // Santiago de Cuba (stateId: 14)
    { id: 200, name: 'Santiago de Cuba', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 201, name: 'Contramaestre', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 202, name: 'Mella', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 203, name: 'San Luis', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 204, name: 'Segundo Frente', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 205, name: 'Songo-La Maya', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 206, name: 'Palma Soriano', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 207, name: 'Tercer Frente', stateId: 14, stateName: 'Santiago de Cuba' },
    { id: 208, name: 'Guamá', stateId: 14, stateName: 'Santiago de Cuba' },

    // Guantánamo (stateId: 15)
    { id: 215, name: 'Guantánamo', stateId: 15, stateName: 'Guantánamo' },
    { id: 216, name: 'Baracoa', stateId: 15, stateName: 'Guantánamo' },
    { id: 217, name: 'Maisí', stateId: 15, stateName: 'Guantánamo' },
    { id: 218, name: 'Imías', stateId: 15, stateName: 'Guantánamo' },
    { id: 219, name: 'San Antonio del Sur', stateId: 15, stateName: 'Guantánamo' },
    { id: 220, name: 'Manuel Tames', stateId: 15, stateName: 'Guantánamo' },
    { id: 221, name: 'Yateras', stateId: 15, stateName: 'Guantánamo' },
    { id: 222, name: 'El Salvador', stateId: 15, stateName: 'Guantánamo' },
    { id: 223, name: 'Caimanera', stateId: 15, stateName: 'Guantánamo' },
    { id: 224, name: 'Niceto Pérez', stateId: 15, stateName: 'Guantánamo' },

    // Isla de la Juventud (stateId: 16)
    { id: 230, name: 'Isla de la Juventud', stateId: 16, stateName: 'Isla de la Juventud' },
  ]
}

/**
 * Datos de fallback para provincias de Cuba
 */
function getCubanStatesFallback(): ApaCargoCubaState[] {
  return [
    { id: 1, name: 'La Habana' },
    { id: 2, name: 'Pinar del Río' },
    { id: 3, name: 'Artemisa' },
    { id: 4, name: 'Mayabeque' },
    { id: 5, name: 'Matanzas' },
    { id: 6, name: 'Villa Clara' },
    { id: 7, name: 'Cienfuegos' },
    { id: 8, name: 'Sancti Spíritus' },
    { id: 9, name: 'Ciego de Ávila' },
    { id: 10, name: 'Camagüey' },
    { id: 11, name: 'Las Tunas' },
    { id: 12, name: 'Holguín' },
    { id: 13, name: 'Granma' },
    { id: 14, name: 'Santiago de Cuba' },
    { id: 15, name: 'Guantánamo' },
    { id: 16, name: 'Isla de la Juventud' },
  ]
}
