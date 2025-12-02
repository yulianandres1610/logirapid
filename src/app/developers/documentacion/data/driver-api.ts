// Driver API Documentation Data
import { Endpoint } from './auth-api'

// Estados de empaques
export const empaqueStates = [
  { estado: 'disponible', descripcion: 'Empaque disponible en inventario (caja vacía)' },
  { estado: 'asignado', descripcion: 'Asignado a orden pero no recogido' },
  { estado: 'recogida', descripcion: 'Recogido/creado en almacén origen' },
  { estado: 'en_almacen', descripcion: 'Recibido y procesado en almacén' },
  { estado: 'en_transito', descripcion: 'En tránsito a otro almacén' },
  { estado: 'recibido_destino', descripcion: 'Recibido en almacén destino' },
  { estado: 'en_reparto', descripcion: 'Asignado a driver para entrega' },
  { estado: 'entregado', descripcion: 'Entregado al destinatario final' },
]

// Driver API endpoints documentation
export const driverEndpoints: Endpoint[] = [
  // ==========================================
  // RUTAS
  // ==========================================
  {
    id: 'driver-routes',
    method: 'GET',
    path: '/api/driver-app/routes',
    title: 'Listar Rutas del Driver',
    description: 'Obtiene la lista de rutas asignadas al driver autenticado. Devuelve información resumida para mostrar en cards de la app móvil.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      }
    ],
    queryParams: [
      {
        name: 'status',
        type: 'string',
        required: false,
        description: 'Filtrar por estado: pending, active, completed, all',
        default: 'all'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Cantidad de rutas por página',
        default: '20'
      },
      {
        name: 'page',
        type: 'number',
        required: false,
        description: 'Número de página',
        default: '1'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de rutas obtenida exitosamente',
        body: `{
  "success": true,
  "data": {
    "routes": [
      {
        "id": 123,
        "routeCode": "ROUTE-2024-001",
        "status": "active",
        "distance": {
          "value": 45.5,
          "unit": "mi",
          "formatted": "45.5 mi"
        },
        "duration": {
          "value": "2h 30min",
          "formatted": "2h 30min"
        },
        "date": "2024-12-02",
        "progress": {
          "total": 15,
          "completed": 8,
          "percentage": 53
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasMore": true
    }
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/routes?status=active&limit=10' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/routes?status=active', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();

if (data.success) {
  data.data.routes.forEach(route => {
    console.log(\`Ruta: \${route.routeCode}\`);
    console.log(\`Progreso: \${route.progress.percentage}%\`);
  });
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<List<Route>> getRoutes({String? status}) async {
  final token = await secureStorage.read(key: 'auth-token');
  final uri = Uri.parse('https://logirapid.com/api/driver-app/routes')
    .replace(queryParameters: {
      if (status != null) 'status': status,
    });

  final response = await http.get(uri, headers: {
    'Cookie': 'auth-token=\$token',
  });

  final data = jsonDecode(response.body);
  if (data['success']) {
    return (data['data']['routes'] as List)
      .map((r) => Route.fromJson(r))
      .toList();
  }
  throw Exception(data['error']);
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class RouteCard(
    val id: Int,
    val routeCode: String,
    val status: String,
    val distance: Distance,
    val duration: Duration,
    val date: String,
    val progress: Progress
)

interface DriverApi {
    @GET("api/driver-app/routes")
    suspend fun getRoutes(
        @Header("Cookie") authToken: String,
        @Query("status") status: String? = null,
        @Query("limit") limit: Int = 20,
        @Query("page") page: Int = 1
    ): Response<RoutesResponse>
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct RouteCard: Codable {
    let id: Int
    let routeCode: String
    let status: String
    let distance: Distance
    let duration: Duration
    let date: String
    let progress: Progress
}

func getRoutes(status: String? = nil) async throws -> [RouteCard] {
    var components = URLComponents(string: "https://logirapid.com/api/driver-app/routes")!
    if let status = status {
        components.queryItems = [URLQueryItem(name: "status", value: status)]
    }

    var request = URLRequest(url: components.url!)
    request.setValue("auth-token=\\(token)", forHTTPHeaderField: "Cookie")

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(RoutesResponse.self, from: data)

    return response.data.routes
}`
      }
    ]
  },
  {
    id: 'driver-route-detail',
    method: 'GET',
    path: '/api/driver-app/routes/{code}',
    title: 'Detalle de Ruta',
    description: 'Obtiene el detalle completo de una ruta para la app móvil. Incluye información de la ruta, vehículo, almacén origen, lista de paradas con coordenadas para el mapa, y órdenes agrupadas por parada.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      }
    ],
    pathParams: [
      {
        name: 'code',
        type: 'string',
        required: true,
        description: 'Código único de la ruta (routenumber)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Detalle de ruta obtenido exitosamente',
        body: `{
  "success": true,
  "data": {
    "route": {
      "id": 123,
      "routeCode": "ROUTE-2024-001",
      "status": "active",
      "date": "2024-12-02",
      "distance": {
        "value": 45.5,
        "unit": "mi",
        "formatted": "45.5 mi"
      },
      "duration": {
        "value": "2h 30min",
        "formatted": "2h 30min"
      },
      "vehicle": {
        "id": 5,
        "plate": "ABC-123",
        "type": null
      },
      "driver": {
        "id": 10,
        "name": "Juan Pérez"
      },
      "warehouse": {
        "id": 1,
        "name": "Almacén Principal",
        "address": "123 Warehouse St, Miami, FL 33101",
        "coordinates": {
          "latitude": 25.7617,
          "longitude": -80.1918
        }
      },
      "summary": {
        "totalStops": 15,
        "completedStops": 8,
        "pendingStops": 6,
        "failedStops": 1,
        "totalOrders": 22,
        "completedOrders": 12,
        "percentage": 53
      }
    },
    "stops": [
      {
        "stopNumber": 1,
        "status": "completed",
        "address": {
          "full": "456 Main St, Apt 2B, Miami, FL 33102",
          "street": "456 Main St",
          "apartment": "Apt 2B",
          "city": "Miami",
          "state": "FL",
          "zipcode": "33102",
          "country": "US"
        },
        "zone": "Miami / 33102",
        "coordinates": {
          "latitude": 25.7705,
          "longitude": -80.1936
        },
        "orders": [
          {
            "id": 1001,
            "orderNumber": "PICKUP-2024-001",
            "status": "delivered",
            "customerName": "María García",
            "customerPhone": "+1234567890",
            "services": [
              { "name": "Envío Express", "quantity": 2 }
            ],
            "timeSlot": "morning",
            "hasProof": true
          }
        ],
        "totalOrders": 2,
        "completedOrders": 2
      }
    ]
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}`
      },
      {
        status: 404,
        description: 'Ruta no encontrada',
        body: `{
  "success": false,
  "error": "Ruta no encontrada"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/routes/ROUTE-2024-001' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/routes/ROUTE-2024-001', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();

if (data.success) {
  const { route, stops } = data.data;

  console.log(\`Ruta: \${route.routeCode}\`);
  console.log(\`Almacén: \${route.warehouse.name}\`);
  console.log(\`Paradas: \${route.summary.totalStops}\`);

  stops.forEach(stop => {
    console.log(\`Parada \${stop.stopNumber}: \${stop.address.full}\`);
    console.log(\`  Órdenes: \${stop.orders.length}\`);
    console.log(\`  Coordenadas: \${stop.coordinates.latitude}, \${stop.coordinates.longitude}\`);
  });
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<RouteDetail> getRouteDetail(String routeCode) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/driver-app/routes/\$routeCode'),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);
  if (data['success']) {
    return RouteDetail.fromJson(data['data']);
  }
  throw Exception(data['error']);
}

// Modelo
class RouteDetail {
  final RouteInfo route;
  final List<Stop> stops;

  // Para el mapa: obtener todas las coordenadas
  List<LatLng> get allCoordinates {
    final coords = <LatLng>[];
    if (route.warehouse != null) {
      coords.add(LatLng(
        route.warehouse!.coordinates.latitude,
        route.warehouse!.coordinates.longitude
      ));
    }
    for (final stop in stops) {
      coords.add(LatLng(
        stop.coordinates.latitude,
        stop.coordinates.longitude
      ));
    }
    return coords;
  }
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class RouteDetail(
    val route: RouteInfo,
    val stops: List<Stop>
)

data class Stop(
    val stopNumber: Int,
    val status: String,
    val address: Address,
    val zone: String,
    val coordinates: Coordinates,
    val orders: List<Order>,
    val totalOrders: Int,
    val completedOrders: Int
)

interface DriverApi {
    @GET("api/driver-app/routes/{code}")
    suspend fun getRouteDetail(
        @Header("Cookie") authToken: String,
        @Path("code") routeCode: String
    ): Response<RouteDetailResponse>
}

// Uso para mostrar en mapa
val detail = driverApi.getRouteDetail("auth-token=\$token", "ROUTE-2024-001")
val markers = detail.data.stops.map { stop ->
    MarkerOptions()
        .position(LatLng(stop.coordinates.latitude, stop.coordinates.longitude))
        .title("Parada \${stop.stopNumber}")
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct RouteDetail: Codable {
    let route: RouteInfo
    let stops: [Stop]
}

struct Stop: Codable {
    let stopNumber: Int
    let status: String
    let address: Address
    let zone: String
    let coordinates: Coordinates
    let orders: [Order]
    let totalOrders: Int
    let completedOrders: Int
}

func getRouteDetail(routeCode: String) async throws -> RouteDetail {
    var request = URLRequest(url: URL(string: "https://logirapid.com/api/driver-app/routes/\\(routeCode)")!)
    request.setValue("auth-token=\\(token)", forHTTPHeaderField: "Cookie")

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(RouteDetailResponse.self, from: data)

    guard let detail = response.data else {
        throw APIError.invalidResponse
    }
    return detail
}

// Para MapKit
func createAnnotations(from detail: RouteDetail) -> [MKPointAnnotation] {
    detail.stops.map { stop in
        let annotation = MKPointAnnotation()
        annotation.coordinate = CLLocationCoordinate2D(
            latitude: stop.coordinates.latitude,
            longitude: stop.coordinates.longitude
        )
        annotation.title = "Parada \\(stop.stopNumber)"
        annotation.subtitle = stop.address.full
        return annotation
    }
}`
      }
    ]
  },

  // ==========================================
  // EMPAQUES
  // ==========================================
  {
    id: 'driver-empaques-validate',
    method: 'POST',
    path: '/api/driver-app/empaques/validate',
    title: 'Validar Empaques de Orden',
    description: 'Valida que todos los empaques de una orden estén listos para entrega. Verifica que existan los empaques, tengan el estado correcto, y estén asignados a la orden indicada.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      }
    ],
    requestBody: [
      {
        name: 'orderNumber',
        type: 'string',
        required: true,
        description: 'Número de la orden a validar'
      },
      {
        name: 'empaqueIds',
        type: 'string[]',
        required: true,
        description: 'Array de IDs de empaques a validar'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Validación exitosa - todos los empaques están listos',
        body: `{
  "success": true,
  "data": {
    "orderNumber": "PICKUP-2024-001",
    "validatedCount": 3,
    "empaques": [
      {
        "id": "EMP-001",
        "estado": "en_reparto",
        "valid": true
      },
      {
        "id": "EMP-002",
        "estado": "en_reparto",
        "valid": true
      }
    ],
    "allValid": true
  }
}`
      },
      {
        status: 400,
        description: 'Validación fallida - algunos empaques no son válidos',
        body: `{
  "success": false,
  "error": "Algunos empaques no son válidos para entrega",
  "data": {
    "invalidEmpaques": [
      {
        "id": "EMP-003",
        "estado": "en_almacen",
        "reason": "Estado incorrecto. Esperado: en_reparto"
      }
    ]
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST 'https://logirapid.com/api/driver-app/empaques/validate' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "orderNumber": "PICKUP-2024-001",
    "empaqueIds": ["EMP-001", "EMP-002", "EMP-003"]
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/empaques/validate', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderNumber: 'PICKUP-2024-001',
    empaqueIds: ['EMP-001', 'EMP-002']
  })
});

const data = await response.json();

if (data.success && data.data.allValid) {
  console.log('Todos los empaques válidos, proceder con entrega');
} else {
  console.error('Empaques inválidos:', data.data?.invalidEmpaques);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<ValidationResult> validateEmpaques(
  String orderNumber,
  List<String> empaqueIds
) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/empaques/validate'),
    headers: {
      'Cookie': 'auth-token=\$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'orderNumber': orderNumber,
      'empaqueIds': empaqueIds,
    }),
  );

  return ValidationResult.fromJson(jsonDecode(response.body));
}`
      }
    ]
  },
  {
    id: 'driver-empaques-disponibles',
    method: 'GET',
    path: '/api/driver-app/empaques/disponibles',
    title: 'Empaques Disponibles (Resumen)',
    description: 'Obtiene un resumen de los empaques disponibles por estado. Útil para mostrar contadores en el dashboard del driver.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Resumen obtenido exitosamente',
        body: `{
  "success": true,
  "data": {
    "disponibles": 15,
    "asignados": 8,
    "enReparto": 12,
    "total": 35
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/empaques/disponibles' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/empaques/disponibles', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();
if (data.success) {
  console.log('Cajas disponibles:', data.data.disponibles);
  console.log('En reparto:', data.data.enReparto);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<EmpaquesSummary> getEmpaquesSummary() async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/driver-app/empaques/disponibles'),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);
  if (data['success']) {
    return EmpaquesSummary.fromJson(data['data']);
  }
  throw Exception(data['error']);
}`
      }
    ]
  },
  {
    id: 'driver-empaques-list-disponibles',
    method: 'GET',
    path: '/api/driver-app/empaques/list-disponibles',
    title: 'Listar Empaques Disponibles',
    description: 'Obtiene la lista detallada de empaques disponibles (cajas vacías) que el driver puede asignar a nuevas órdenes.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      }
    ],
    queryParams: [
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Cantidad por página',
        default: '50'
      },
      {
        name: 'page',
        type: 'number',
        required: false,
        description: 'Número de página',
        default: '1'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista obtenida exitosamente',
        body: `{
  "success": true,
  "data": {
    "empaques": [
      {
        "id": "EMP-001",
        "codigo": "BOX-2024-001",
        "tipo": "caja_mediana",
        "estado": "disponible",
        "ubicacion": "Almacén Miami",
        "fechaCreacion": "2024-12-01T10:00:00Z"
      },
      {
        "id": "EMP-002",
        "codigo": "BOX-2024-002",
        "tipo": "caja_grande",
        "estado": "disponible",
        "ubicacion": "Almacén Miami",
        "fechaCreacion": "2024-12-01T10:05:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 15,
      "totalPages": 1
    }
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/empaques/list-disponibles?limit=20' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/empaques/list-disponibles', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();
if (data.success) {
  data.data.empaques.forEach(emp => {
    console.log(\`\${emp.codigo} - \${emp.tipo} - \${emp.estado}\`);
  });
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<List<Empaque>> getEmpaquesDisponibles() async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/driver-app/empaques/list-disponibles'),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);
  if (data['success']) {
    return (data['data']['empaques'] as List)
      .map((e) => Empaque.fromJson(e))
      .toList();
  }
  throw Exception(data['error']);
}`
      }
    ]
  },
  {
    id: 'driver-empaques-list-bultos',
    method: 'GET',
    path: '/api/driver-app/empaques/list-bultos',
    title: 'Listar Bultos en Reparto',
    description: 'Obtiene la lista de bultos (empaques con contenido) que el driver tiene asignados para reparto.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      }
    ],
    queryParams: [
      {
        name: 'routeCode',
        type: 'string',
        required: false,
        description: 'Filtrar por código de ruta específica'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Cantidad por página',
        default: '50'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de bultos obtenida exitosamente',
        body: `{
  "success": true,
  "data": {
    "bultos": [
      {
        "id": "EMP-100",
        "codigo": "BULTO-2024-100",
        "orderNumber": "PICKUP-2024-001",
        "estado": "en_reparto",
        "destinatario": "María García",
        "direccion": "456 Main St, Miami, FL",
        "servicios": [
          { "name": "Envío Express", "quantity": 2 }
        ]
      }
    ],
    "total": 12
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/empaques/list-bultos?routeCode=ROUTE-2024-001' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/empaques/list-bultos', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();
if (data.success) {
  console.log('Total bultos:', data.data.total);
  data.data.bultos.forEach(bulto => {
    console.log(\`\${bulto.codigo} → \${bulto.destinatario}\`);
  });
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<List<Bulto>> getBultosEnReparto({String? routeCode}) async {
  final token = await secureStorage.read(key: 'auth-token');
  final uri = Uri.parse('https://logirapid.com/api/driver-app/empaques/list-bultos')
    .replace(queryParameters: {
      if (routeCode != null) 'routeCode': routeCode,
    });

  final response = await http.get(uri, headers: {
    'Cookie': 'auth-token=\$token',
  });

  final data = jsonDecode(response.body);
  if (data['success']) {
    return (data['data']['bultos'] as List)
      .map((b) => Bulto.fromJson(b))
      .toList();
  }
  throw Exception(data['error']);
}`
      }
    ]
  },
  {
    id: 'driver-empaques-servicio',
    method: 'GET',
    path: '/api/driver-app/empaques/servicio/{orderNumber}/{serviceName}',
    title: 'Empaques por Servicio de Orden',
    description: 'Obtiene los empaques asociados a un servicio específico de una orden. Útil para validar entregas parciales por servicio.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      }
    ],
    pathParams: [
      {
        name: 'orderNumber',
        type: 'string',
        required: true,
        description: 'Número de la orden'
      },
      {
        name: 'serviceName',
        type: 'string',
        required: true,
        description: 'Nombre del servicio (URL encoded)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Empaques del servicio obtenidos exitosamente',
        body: `{
  "success": true,
  "data": {
    "orderNumber": "PICKUP-2024-001",
    "serviceName": "Envío Express",
    "empaques": [
      {
        "id": "EMP-001",
        "codigo": "BULTO-2024-001",
        "estado": "en_reparto",
        "peso": 2.5,
        "dimensiones": "30x20x15 cm"
      },
      {
        "id": "EMP-002",
        "codigo": "BULTO-2024-002",
        "estado": "en_reparto",
        "peso": 1.8,
        "dimensiones": "25x15x10 cm"
      }
    ],
    "totalEmpaques": 2,
    "cantidadEsperada": 2,
    "completo": true
  }
}`
      },
      {
        status: 404,
        description: 'Orden o servicio no encontrado',
        body: `{
  "success": false,
  "error": "Servicio no encontrado en la orden"
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autorizado. Se requiere autenticación."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/empaques/servicio/PICKUP-2024-001/Env%C3%ADo%20Express' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const orderNumber = 'PICKUP-2024-001';
const serviceName = encodeURIComponent('Envío Express');

const response = await fetch(
  \`/api/driver-app/empaques/servicio/\${orderNumber}/\${serviceName}\`,
  {
    method: 'GET',
    credentials: 'include'
  }
);

const data = await response.json();
if (data.success) {
  console.log(\`Servicio: \${data.data.serviceName}\`);
  console.log(\`Empaques: \${data.data.totalEmpaques}/\${data.data.cantidadEsperada}\`);
  console.log(\`Completo: \${data.data.completo}\`);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<ServiceEmpaques> getEmpaquesByService(
  String orderNumber,
  String serviceName
) async {
  final token = await secureStorage.read(key: 'auth-token');
  final encodedService = Uri.encodeComponent(serviceName);

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/driver-app/empaques/servicio/\$orderNumber/\$encodedService'),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);
  if (data['success']) {
    return ServiceEmpaques.fromJson(data['data']);
  }
  throw Exception(data['error']);
}

// Verificar si el servicio tiene todos los empaques
final serviceEmpaques = await getEmpaquesByService('PICKUP-2024-001', 'Envío Express');
if (serviceEmpaques.completo) {
  // Proceder con entrega del servicio
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class ServiceEmpaques(
    val orderNumber: String,
    val serviceName: String,
    val empaques: List<Empaque>,
    val totalEmpaques: Int,
    val cantidadEsperada: Int,
    val completo: Boolean
)

interface DriverApi {
    @GET("api/driver-app/empaques/servicio/{orderNumber}/{serviceName}")
    suspend fun getEmpaquesByService(
        @Header("Cookie") authToken: String,
        @Path("orderNumber") orderNumber: String,
        @Path("serviceName") serviceName: String
    ): Response<ServiceEmpaquesResponse>
}

// Uso
val response = driverApi.getEmpaquesByService(
    "auth-token=\$token",
    "PICKUP-2024-001",
    URLEncoder.encode("Envío Express", "UTF-8")
)`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct ServiceEmpaques: Codable {
    let orderNumber: String
    let serviceName: String
    let empaques: [Empaque]
    let totalEmpaques: Int
    let cantidadEsperada: Int
    let completo: Bool
}

func getEmpaquesByService(orderNumber: String, serviceName: String) async throws -> ServiceEmpaques {
    let encodedService = serviceName.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? serviceName
    let url = URL(string: "https://logirapid.com/api/driver-app/empaques/servicio/\\(orderNumber)/\\(encodedService)")!

    var request = URLRequest(url: url)
    request.setValue("auth-token=\\(token)", forHTTPHeaderField: "Cookie")

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(ServiceEmpaquesResponse.self, from: data)

    guard let serviceEmpaques = response.data else {
        throw APIError.invalidResponse
    }
    return serviceEmpaques
}`
      }
    ]
  }
]
