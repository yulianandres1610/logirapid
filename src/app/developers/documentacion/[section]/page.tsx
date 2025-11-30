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
  'driver-dashboard',
  'driver-receive-box',
  'driver-receive-package',
  'driver-packages',
  'driver-empty-boxes',
  'driver-empaques-disponibles',
  'driver-empaques-servicio',
  'driver-empaques-list-disponibles',
  'driver-empaques-list-bultos',
  'driver-empaques-validate',
  'driver-routes',
  'driver-routes-assign',
  'driver-route-stops',
  'driver-route-start',
  'driver-route-complete',
  'driver-stop-info',
  'driver-stop-update',
  'driver-stop-fail',
  'driver-stop-navigate',
  'driver-location-update',
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
    'driver-dashboard': 'GET /dashboard - Dashboard del Driver',
    'driver-receive-box': 'POST /receive-box - Recibir Caja',
    'driver-receive-package': 'POST /receive-package - Recibir Paquete',
    'driver-packages': 'GET /packages - Listar Paquetes',
    'driver-empty-boxes': 'GET /empty-boxes - Cajas Vacias',
    'driver-empaques-disponibles': 'GET /empaques/disponibles - Empaques Disponibles',
    'driver-empaques-servicio': 'POST /empaques/servicio - Servicio de Empaques',
    'driver-empaques-list-disponibles': 'GET /empaques/list-disponibles - Lista Empaques',
    'driver-empaques-list-bultos': 'GET /empaques/list-bultos - Lista Bultos',
    'driver-empaques-validate': 'POST /empaques/validate - Validar Empaques',
    'driver-routes': 'GET /routes - Rutas del Driver',
    'driver-routes-assign': 'POST /routes/assign - Asignar Ruta',
    'driver-route-stops': 'GET /routes/{id}/stops - Paradas de Ruta',
    'driver-route-start': 'POST /routes/{code}/start - Iniciar Ruta',
    'driver-route-complete': 'POST /routes/{code}/complete - Completar Ruta',
    'driver-stop-info': 'GET /stops/{routeId}/{stopNumber} - Info de Parada',
    'driver-stop-update': 'POST /stops/{routeId}/{stopNumber} - Actualizar Parada',
    'driver-stop-fail': 'POST /stops/.../fail - Marcar Parada Fallida',
    'driver-stop-navigate': 'GET /stops/.../navigate - Navegar a Parada',
    'driver-location-update': 'POST /location - Actualizar Ubicacion',
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
