/**
 * Lista completa de provincias y municipios de Cuba
 * Para validación de direcciones en el agente de WhatsApp
 */

// Las 16 provincias de Cuba (incluyendo el Municipio Especial Isla de la Juventud)
export const CUBA_PROVINCES = [
  'Pinar del Río',
  'Artemisa',
  'La Habana',
  'Mayabeque',
  'Matanzas',
  'Cienfuegos',
  'Villa Clara',
  'Sancti Spíritus',
  'Ciego de Ávila',
  'Camagüey',
  'Las Tunas',
  'Holguín',
  'Granma',
  'Santiago de Cuba',
  'Guantánamo',
  'Isla de la Juventud'
]

// Municipios por provincia
export const CUBA_MUNICIPALITIES: Record<string, string[]> = {
  'Pinar del Río': [
    'Consolación del Sur',
    'Guane',
    'La Palma',
    'Los Palacios',
    'Mantua',
    'Minas de Matahambre',
    'Pinar del Río',
    'San Juan y Martínez',
    'San Luis',
    'Sandino',
    'Viñales'
  ],
  'Artemisa': [
    'Alquízar',
    'Artemisa',
    'Bahía Honda',
    'Bauta',
    'Caimito',
    'Candelaria',
    'Guanajay',
    'Güira de Melena',
    'Mariel',
    'San Antonio de los Baños',
    'San Cristóbal'
  ],
  'La Habana': [
    'Arroyo Naranjo',
    'Boyeros',
    'Centro Habana',
    'Cerro',
    'Cotorro',
    'Diez de Octubre',
    'Guanabacoa',
    'Habana del Este',
    'Habana Vieja',
    'La Lisa',
    'Marianao',
    'Playa',
    'Plaza de la Revolución',
    'Regla',
    'San Miguel del Padrón'
  ],
  'Mayabeque': [
    'Batabanó',
    'Bejucal',
    'Güines',
    'Jaruco',
    'Madruga',
    'Melena del Sur',
    'Nueva Paz',
    'Quivicán',
    'San José de las Lajas',
    'San Nicolás de Bari',
    'Santa Cruz del Norte'
  ],
  'Matanzas': [
    'Calimete',
    'Cárdenas',
    'Ciénaga de Zapata',
    'Colón',
    'Jagüey Grande',
    'Jovellanos',
    'Limonar',
    'Los Arabos',
    'Martí',
    'Matanzas',
    'Pedro Betancourt',
    'Perico',
    'Unión de Reyes'
  ],
  'Cienfuegos': [
    'Abreus',
    'Aguada de Pasajeros',
    'Cienfuegos',
    'Cruces',
    'Cumanayagua',
    'Lajas',
    'Palmira',
    'Rodas'
  ],
  'Villa Clara': [
    'Caibarién',
    'Camajuaní',
    'Cifuentes',
    'Corralillo',
    'Encrucijada',
    'Manicaragua',
    'Placetas',
    'Quemado de Güines',
    'Ranchuelo',
    'Remedios',
    'Sagua la Grande',
    'Santa Clara',
    'Santo Domingo'
  ],
  'Sancti Spíritus': [
    'Cabaiguán',
    'Fomento',
    'Jatibonico',
    'La Sierpe',
    'Sancti Spíritus',
    'Taguasco',
    'Trinidad',
    'Yaguajay'
  ],
  'Ciego de Ávila': [
    'Baraguá',
    'Bolivia',
    'Chambas',
    'Ciego de Ávila',
    'Ciro Redondo',
    'Florencia',
    'Majagua',
    'Morón',
    'Primero de Enero',
    'Venezuela'
  ],
  'Camagüey': [
    'Camagüey',
    'Carlos Manuel de Céspedes',
    'Esmeralda',
    'Florida',
    'Guáimaro',
    'Jimaguayú',
    'Minas',
    'Najasa',
    'Nuevitas',
    'Santa Cruz del Sur',
    'Sibanicú',
    'Sierra de Cubitas',
    'Vertientes'
  ],
  'Las Tunas': [
    'Amancio',
    'Colombia',
    'Jesús Menéndez',
    'Jobabo',
    'Las Tunas',
    'Majibacoa',
    'Manatí',
    'Puerto Padre'
  ],
  'Holguín': [
    'Antilla',
    'Báguanos',
    'Banes',
    'Cacocum',
    'Calixto García',
    'Cueto',
    'Frank País',
    'Gibara',
    'Holguín',
    'Mayarí',
    'Moa',
    'Rafael Freyre',
    'Sagua de Tánamo',
    'Urbano Noris'
  ],
  'Granma': [
    'Bartolomé Masó',
    'Bayamo',
    'Buey Arriba',
    'Campechuela',
    'Cauto Cristo',
    'Guisa',
    'Jiguaní',
    'Manzanillo',
    'Media Luna',
    'Niquero',
    'Pilón',
    'Río Cauto',
    'Yara'
  ],
  'Santiago de Cuba': [
    'Contramaestre',
    'Guamá',
    'Mella',
    'Palma Soriano',
    'San Luis',
    'Santiago de Cuba',
    'Segundo Frente',
    'Songo-La Maya',
    'Tercer Frente'
  ],
  'Guantánamo': [
    'Baracoa',
    'Caimanera',
    'El Salvador',
    'Guantánamo',
    'Imías',
    'Maisí',
    'Manuel Tames',
    'Niceto Pérez',
    'San Antonio del Sur',
    'Yateras'
  ],
  'Isla de la Juventud': [
    'Isla de la Juventud'
  ]
}

// Aliases comunes para provincias (errores de escritura frecuentes)
const PROVINCE_ALIASES: Record<string, string> = {
  'habana': 'La Habana',
  'la habana': 'La Habana',
  'havana': 'La Habana',
  'ciudad habana': 'La Habana',
  'ciudad de la habana': 'La Habana',
  'pinar del rio': 'Pinar del Río',
  'pinar': 'Pinar del Río',
  'sancti spiritus': 'Sancti Spíritus',
  'sancti': 'Sancti Spíritus',
  'ciego de avila': 'Ciego de Ávila',
  'ciego': 'Ciego de Ávila',
  'camaguey': 'Camagüey',
  'holguin': 'Holguín',
  'guantanamo': 'Guantánamo',
  'isla de la juventud': 'Isla de la Juventud',
  'isla': 'Isla de la Juventud',
  'juventud': 'Isla de la Juventud',
  'santiago': 'Santiago de Cuba',
  'stgo': 'Santiago de Cuba',
  'stgo de cuba': 'Santiago de Cuba',
  'las tunas': 'Las Tunas',
  'tunas': 'Las Tunas',
  'villa clara': 'Villa Clara',
  'santa clara': 'Villa Clara'
}

// Aliases comunes para municipios
const MUNICIPALITY_ALIASES: Record<string, { province: string; municipality: string }> = {
  'vedado': { province: 'La Habana', municipality: 'Plaza de la Revolución' },
  'miramar': { province: 'La Habana', municipality: 'Playa' },
  'habana vieja': { province: 'La Habana', municipality: 'Habana Vieja' },
  'centro habana': { province: 'La Habana', municipality: 'Centro Habana' },
  '10 de octubre': { province: 'La Habana', municipality: 'Diez de Octubre' },
  'diez de octubre': { province: 'La Habana', municipality: 'Diez de Octubre' },
  'santiago': { province: 'Santiago de Cuba', municipality: 'Santiago de Cuba' },
  'bayamo': { province: 'Granma', municipality: 'Bayamo' },
  'santa clara': { province: 'Villa Clara', municipality: 'Santa Clara' },
  'holguin': { province: 'Holguín', municipality: 'Holguín' },
  'camaguey': { province: 'Camagüey', municipality: 'Camagüey' },
  'guantanamo': { province: 'Guantánamo', municipality: 'Guantánamo' },
  'matanzas': { province: 'Matanzas', municipality: 'Matanzas' },
  'cienfuegos': { province: 'Cienfuegos', municipality: 'Cienfuegos' },
  'trinidad': { province: 'Sancti Spíritus', municipality: 'Trinidad' },
  'varadero': { province: 'Matanzas', municipality: 'Cárdenas' },
  'cardenas': { province: 'Matanzas', municipality: 'Cárdenas' }
}

/**
 * Normaliza texto removiendo acentos y convirtiendo a minúsculas
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Calcula la distancia de Levenshtein entre dos strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Valida y normaliza una provincia de Cuba
 * @returns El nombre oficial de la provincia o null si no se encuentra
 */
export function validateProvince(province: string): string | null {
  if (!province) return null

  const normalized = normalizeText(province)

  // Primero buscar en aliases
  if (PROVINCE_ALIASES[normalized]) {
    return PROVINCE_ALIASES[normalized]
  }

  // Buscar coincidencia exacta (normalizada)
  for (const p of CUBA_PROVINCES) {
    if (normalizeText(p) === normalized) {
      return p
    }
  }

  // Buscar si contiene el nombre
  for (const p of CUBA_PROVINCES) {
    if (normalized.includes(normalizeText(p)) || normalizeText(p).includes(normalized)) {
      return p
    }
  }

  return null
}

/**
 * Valida y normaliza un municipio de Cuba para una provincia específica
 * @returns El nombre oficial del municipio o null si no se encuentra
 */
export function validateMunicipality(province: string, municipality: string): string | null {
  if (!province || !municipality) return null

  const validatedProvince = validateProvince(province)
  if (!validatedProvince) return null

  const municipalities = CUBA_MUNICIPALITIES[validatedProvince]
  if (!municipalities) return null

  const normalizedMuni = normalizeText(municipality)

  // Primero buscar en aliases de municipios
  if (MUNICIPALITY_ALIASES[normalizedMuni]) {
    const alias = MUNICIPALITY_ALIASES[normalizedMuni]
    if (alias.province === validatedProvince) {
      return alias.municipality
    }
  }

  // Buscar coincidencia exacta (normalizada)
  for (const m of municipalities) {
    if (normalizeText(m) === normalizedMuni) {
      return m
    }
  }

  // Buscar si contiene el nombre
  for (const m of municipalities) {
    if (normalizedMuni.includes(normalizeText(m)) || normalizeText(m).includes(normalizedMuni)) {
      return m
    }
  }

  return null
}

/**
 * Encuentra la coincidencia más cercana en una lista de opciones
 * Usa distancia de Levenshtein para sugerir correcciones
 */
export function findClosestMatch(input: string, options: string[]): string | null {
  if (!input || options.length === 0) return null

  const normalizedInput = normalizeText(input)
  let bestMatch: string | null = null
  let bestDistance = Infinity

  for (const option of options) {
    const normalizedOption = normalizeText(option)
    const distance = levenshteinDistance(normalizedInput, normalizedOption)

    // Solo sugerir si la distancia es razonable (menos del 40% de la longitud)
    const threshold = Math.max(3, Math.floor(normalizedOption.length * 0.4))

    if (distance < bestDistance && distance <= threshold) {
      bestDistance = distance
      bestMatch = option
    }
  }

  return bestMatch
}

/**
 * Busca un municipio en cualquier provincia
 * Útil cuando el usuario solo menciona el municipio sin provincia
 */
export function findMunicipalityAnyProvince(municipality: string): { province: string; municipality: string } | null {
  if (!municipality) return null

  const normalizedMuni = normalizeText(municipality)

  // Primero buscar en aliases
  if (MUNICIPALITY_ALIASES[normalizedMuni]) {
    return MUNICIPALITY_ALIASES[normalizedMuni]
  }

  // Buscar en todas las provincias
  for (const [province, municipalities] of Object.entries(CUBA_MUNICIPALITIES)) {
    for (const m of municipalities) {
      if (normalizeText(m) === normalizedMuni) {
        return { province, municipality: m }
      }
    }
  }

  // Búsqueda parcial
  for (const [province, municipalities] of Object.entries(CUBA_MUNICIPALITIES)) {
    for (const m of municipalities) {
      if (normalizedMuni.includes(normalizeText(m)) || normalizeText(m).includes(normalizedMuni)) {
        return { province, municipality: m }
      }
    }
  }

  return null
}

/**
 * Obtiene todos los municipios de una provincia
 */
export function getMunicipalities(province: string): string[] {
  const validatedProvince = validateProvince(province)
  if (!validatedProvince) return []

  return CUBA_MUNICIPALITIES[validatedProvince] || []
}

/**
 * Valida una dirección completa de Cuba (provincia + municipio)
 * Devuelve los datos validados o sugerencias de corrección
 */
export function validateCubaAddress(province: string, municipality: string): {
  valid: boolean
  province: string | null
  municipality: string | null
  error?: string
  provinceSuggestion?: string
  municipalitySuggestion?: string
} {
  // Validar provincia
  const validatedProvince = validateProvince(province)

  if (!validatedProvince) {
    const suggestion = findClosestMatch(province, CUBA_PROVINCES)
    return {
      valid: false,
      province: null,
      municipality: null,
      error: suggestion
        ? `No reconozco "${province}". Quisiste decir "${suggestion}"?`
        : `No reconozco la provincia "${province}". Las provincias de Cuba son: La Habana, Matanzas, Santiago de Cuba, etc.`,
      provinceSuggestion: suggestion || undefined
    }
  }

  // Validar municipio
  const validatedMunicipality = validateMunicipality(validatedProvince, municipality)

  if (!validatedMunicipality) {
    const municipalities = CUBA_MUNICIPALITIES[validatedProvince]
    const suggestion = findClosestMatch(municipality, municipalities)

    return {
      valid: false,
      province: validatedProvince,
      municipality: null,
      error: suggestion
        ? `No encontre "${municipality}" en ${validatedProvince}. Quisiste decir "${suggestion}"?`
        : `No reconozco ese municipio en ${validatedProvince}. Algunos municipios son: ${municipalities.slice(0, 3).join(', ')}...`,
      municipalitySuggestion: suggestion || undefined
    }
  }

  return {
    valid: true,
    province: validatedProvince,
    municipality: validatedMunicipality
  }
}
