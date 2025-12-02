import { redirect } from 'next/navigation'

// List of all valid section IDs
const validSections = [
  'overview',
  'base-url',
  'authentication',
  'auth-login',
  'auth-logout',
  'auth-me',
  'get-company-services',
  'tracker-search',
  'generate-order-number',
  'create-package-order',
  'list-package-orders',
  'get-order-detail',
  'update-order',
  'cancel-order',
  'reprogram-order',
  // Driver - Rutas
  'driver-routes',
  'driver-route-detail',
  // Driver - Empaques
  'driver-empaques-validate',
  'driver-empaques-disponibles',
  'driver-empaques-list-disponibles',
  'driver-empaques-list-bultos',
  'driver-empaques-servicio',
  // Referencias
  'empaque-states',
  'order-types',
  'order-statuses',
  'webhooks',
  'errors',
]

interface PageProps {
  params: Promise<{ section: string }>
}

export default async function DocumentationSectionPage({ params }: PageProps) {
  const { section } = await params

  // Validate the section exists
  if (!validSections.includes(section)) {
    redirect('/developers/documentacion')
  }

  // Redirect to main documentation page with the section
  // The main page will handle scrolling to the correct section
  redirect(`/developers/documentacion?section=${section}`)
}

// Generate static params for all valid sections
export function generateStaticParams() {
  return validSections.map((section) => ({
    section,
  }))
}

// Metadata for each section page (helps with SEO and AI reading)
export async function generateMetadata({ params }: PageProps) {
  const { section } = await params

  const sectionTitles: Record<string, string> = {
    'overview': 'Descripcion General - API Reference',
    'base-url': 'URL Base - API Reference',
    'authentication': 'Autenticacion - API Reference',
    'auth-login': 'POST /auth/login - Iniciar Sesion',
    'auth-logout': 'POST /auth/logout - Cerrar Sesion',
    'auth-me': 'GET /auth/me - Obtener Usuario Actual',
    'get-company-services': 'GET /companies/{id} - Servicios Habilitados',
    'tracker-search': 'GET /tracker - Buscar Paquetes',
    'generate-order-number': 'POST /generate-number - Generar Numero de Orden',
    'create-package-order': 'POST /package-orders - Crear Orden',
    'list-package-orders': 'GET /package-orders - Listar Ordenes',
    'get-order-detail': 'GET /pickup-orders/{id} - Detalle de Orden',
    'update-order': 'PATCH /pickup-orders/{id} - Actualizar Orden',
    'cancel-order': 'POST /cancel - Cancelar Orden',
    'reprogram-order': 'POST /reprogram - Reprogramar Orden',
    // Driver - Rutas
    'driver-routes': 'GET /routes - Listar Rutas del Driver',
    'driver-route-detail': 'GET /routes/{code} - Detalle de Ruta',
    // Driver - Empaques
    'driver-empaques-validate': 'POST /empaques/validate - Validar Empaques',
    'driver-empaques-disponibles': 'GET /empaques/disponibles - Resumen Empaques',
    'driver-empaques-list-disponibles': 'GET /empaques/list-disponibles - Listar Empaques Disponibles',
    'driver-empaques-list-bultos': 'GET /empaques/list-bultos - Listar Bultos en Reparto',
    'driver-empaques-servicio': 'GET /empaques/servicio - Empaques por Servicio',
    // Referencias
    'empaque-states': 'Estados de Empaques',
    'order-types': 'Tipos de Orden',
    'order-statuses': 'Estados de Orden',
    'webhooks': 'Webhooks (Proximamente)',
    'errors': 'Codigos de Error',
  }

  return {
    title: sectionTitles[section] || 'API Documentation - LogiRapid',
    description: `Documentacion de la API de LogiRapid - ${sectionTitles[section] || section}`,
  }
}
