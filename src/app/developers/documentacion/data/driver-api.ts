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
        description: 'Filtrar: completed (solo completadas), all (todas). Por defecto excluye completadas.',
        default: '-'
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
        "id": 21,
        "routeCode": "RUT-2025-0021",
        "status": "en_curso",
        "distance": "22.7 mi",
        "duration": "43 min",
        "stops": 15,
        "completedStops": 8,
        "progress": 53
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
        code: `const response = await fetch('/api/driver-app/routes', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();

if (data.success) {
  data.data.routes.forEach(route => {
    console.log(\`Ruta: \${route.routeCode}\`);
    console.log(\`Distancia: \${route.distance}\`);
    console.log(\`Paradas: \${route.completedStops}/\${route.stops}\`);
    console.log(\`Progreso: \${route.progress}%\`);
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
        code: `// Modelo simplificado - todos los campos son strings o números
data class RouteCard(
    val id: Int,
    val routeCode: String,
    val status: String,
    val distance: String,      // "22.7 mi"
    val duration: String,      // "43 min"
    val stops: Int,
    val completedStops: Int,
    val progress: Int          // 0-100
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
        code: `// Modelo simplificado - todos los campos son strings o números
struct RouteCard: Codable {
    let id: Int
    let routeCode: String
    let status: String
    let distance: String      // "22.7 mi"
    let duration: String      // "43 min"
    let stops: Int
    let completedStops: Int
    let progress: Int         // 0-100
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
    description: 'Obtiene el detalle completo de una ruta para la app móvil. Respuesta simplificada sin objetos anidados. Incluye datos de ruta, almacén, paradas y órdenes con coordenadas para el mapa.',
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
    "id": 21,
    "routeCode": "RUT-2025-0021",
    "status": "en_curso",
    "date": "2025-12-02",
    "distance": "22.7 mi",
    "duration": "43 min",
    "stops": 15,
    "completedStops": 8,
    "progress": 53,
    "warehouseName": "Almacén Miami",
    "warehouseAddress": "123 Warehouse St, Miami, FL 33101",
    "warehouseLatitude": 25.7617,
    "warehouseLongitude": -80.1918,
    "stopsList": [
      {
        "stopNumber": 1,
        "status": "completed",
        "address": "456 Main St, Apt 2B, Miami, FL 33102",
        "latitude": 25.7705,
        "longitude": -80.1936,
        "orders": [
          {
            "id": 1001,
            "orderNumber": "PICKUP-2024-001",
            "status": "delivered",
            "customerName": "María García",
            "address": "456 Main St, Apt 2B, Miami, FL 33102"
          }
        ]
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
        code: `curl -X GET 'https://logirapid.com/api/driver-app/routes/RUT-2025-0021' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/routes/RUT-2025-0021', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();

if (data.success) {
  const route = data.data;

  console.log(\`Ruta: \${route.routeCode}\`);
  console.log(\`Distancia: \${route.distance}\`);
  console.log(\`Paradas: \${route.completedStops}/\${route.stops}\`);
  console.log(\`Progreso: \${route.progress}%\`);
  console.log(\`Almacén: \${route.warehouseName}\`);
  console.log(\`Dirección almacén: \${route.warehouseAddress}\`);

  route.stopsList.forEach(stop => {
    console.log(\`Parada \${stop.stopNumber}: \${stop.address}\`);
    console.log(\`  Coordenadas: \${stop.latitude}, \${stop.longitude}\`);
    stop.orders.forEach(order => {
      console.log(\`  - \${order.customerName}: \${order.address}\`);
    });
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

// Modelo simplificado - todos los campos planos
class RouteDetail {
  final int id;
  final String routeCode;
  final String status;
  final String date;
  final String distance;           // "22.7 mi"
  final String duration;           // "43 min"
  final int stops;
  final int completedStops;
  final int progress;
  final String? warehouseName;     // Campo plano
  final String? warehouseAddress;  // Campo plano
  final double? warehouseLatitude; // Campo plano
  final double? warehouseLongitude;// Campo plano
  final List<Stop> stopsList;

  // Para el mapa: obtener todas las coordenadas
  List<LatLng> get allCoordinates {
    final coords = <LatLng>[];
    if (warehouseLatitude != null && warehouseLongitude != null) {
      coords.add(LatLng(warehouseLatitude!, warehouseLongitude!));
    }
    for (final stop in stopsList) {
      coords.add(LatLng(stop.latitude, stop.longitude));
    }
    return coords;
  }
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `// Modelo simplificado - todos los campos planos
data class RouteDetail(
    val id: Int,
    val routeCode: String,
    val status: String,
    val date: String,
    val distance: String,          // "22.7 mi"
    val duration: String,          // "43 min"
    val stops: Int,
    val completedStops: Int,
    val progress: Int,             // 0-100
    val warehouseName: String?,    // Campo plano
    val warehouseAddress: String?, // Campo plano
    val warehouseLatitude: Double?,// Campo plano
    val warehouseLongitude: Double?,// Campo plano
    val stopsList: List<Stop>
)

data class Stop(
    val stopNumber: Int,
    val status: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val orders: List<Order>
)

data class Order(
    val id: Int,
    val orderNumber: String,
    val status: String,
    val customerName: String,
    val address: String
)

interface DriverApi {
    @GET("api/driver-app/routes/{code}")
    suspend fun getRouteDetail(
        @Header("Cookie") authToken: String,
        @Path("code") routeCode: String
    ): Response<RouteDetailResponse>
}

// Uso para mostrar en mapa
val detail = driverApi.getRouteDetail("auth-token=\$token", "RUT-2025-0021")
val markers = detail.data.stopsList.map { stop ->
    MarkerOptions()
        .position(LatLng(stop.latitude, stop.longitude))
        .title("Parada \${stop.stopNumber}")
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `// Modelo simplificado - campos planos
struct RouteDetail: Codable {
    let id: Int
    let routeCode: String
    let status: String
    let date: String
    let distance: String      // "22.7 mi"
    let duration: String      // "43 min"
    let stops: Int
    let completedStops: Int
    let progress: Int         // 0-100
    let warehouse: Warehouse?
    let stopsList: [Stop]
}

struct Warehouse: Codable {
    let name: String
    let address: String
    let latitude: Double
    let longitude: Double
}

struct Stop: Codable {
    let stopNumber: Int
    let status: String
    let address: String
    let latitude: Double
    let longitude: Double
    let orders: [Order]
}

struct Order: Codable {
    let id: Int
    let orderNumber: String
    let status: String
    let customerName: String
    let address: String
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
    detail.stopsList.map { stop in
        let annotation = MKPointAnnotation()
        annotation.coordinate = CLLocationCoordinate2D(
            latitude: stop.latitude,
            longitude: stop.longitude
        )
        annotation.title = "Parada \\(stop.stopNumber)"
        annotation.subtitle = stop.address
        return annotation
    }
}`
      }
    ]
  },
  {
    id: 'driver-route-stops',
    method: 'GET',
    path: '/api/driver-app/routes/{code}/stops',
    title: 'Lista de Paradas con Ordenes Detalladas',
    description: 'Obtiene la lista completa de paradas ordenadas con toda la información detallada de cada orden. Si la ruta está en estado pendiente o asignada, automáticamente la cambia a "en_curso" e inicia la ruta. Diseñado para la vista de lista de paradas en la app móvil.',
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
        description: 'Lista de paradas obtenida exitosamente',
        body: `{
  "success": true,
  "data": {
    "routeId": 21,
    "routeCode": "RUT-2025-0021",
    "routeStatus": "en_curso",
    "statusChanged": true,
    "date": "2025-12-02",
    "distance": "22.7 mi",
    "duration": "43 min",
    "driverName": "Juan Pérez",
    "vehiclePlate": "ABC-123",
    "totalStops": 15,
    "completedStops": 8,
    "totalOrders": 20,
    "completedOrders": 12,
    "progress": 60,
    "stops": [
      {
        "stopNumber": 1,
        "status": "completed",
        "address": "456 Main St, Apt 2B, Miami, FL 33102",
        "latitude": 25.7705,
        "longitude": -80.1936,
        "ordersCount": 2,
        "completedOrders": 2,
        "totalBoxes": 5,
        "totalAmount": 125.50,
        "orders": [
          {
            "id": 1001,
            "orderNumber": "PICKUP-2024-001",
            "status": "delivered",
            "orderType": "pickup",
            "scheduledDate": "2025-12-02",
            "timeSlot": "morning",
            "timeSlotFormatted": "8:00 AM - 12:00 PM",
            "customerName": "María García",
            "customerFirstName": "María",
            "customerLastName": "García",
            "customerPhone": "+1 305 555 1234",
            "customerEmail": "maria@email.com",
            "address": "456 Main St, Apt 2B, Miami, FL 33102",
            "street": "456 Main St",
            "apartment": "Apt 2B",
            "city": "Miami",
            "state": "FL",
            "zipcode": "33102",
            "country": "US",
            "latitude": 25.7705,
            "longitude": -80.1936,
            "customerNotes": "Llamar antes de llegar",
            "internalNotes": "Cliente frecuente",
            "boxCount": 3,
            "boxes": [
              {"id": "BOX-001", "size": "M", "weight": 5.5},
              {"id": "BOX-002", "size": "L", "weight": 8.2}
            ],
            "boxesDelivered": 3,
            "boxesReturned": 0,
            "pendingReturn": false,
            "returnStatus": null,
            "proofStatus": "completed",
            "deliveredAt": "2025-12-02T10:30:00Z",
            "subtotal": 50.00,
            "tax": 3.50,
            "total": 53.50,
            "paymentMethod": "card",
            "services": [
              {"name": "Envío estándar", "price": 25.00, "quantity": 1}
            ],
            "createdAt": "2025-12-01T14:30:00Z"
          }
        ]
      },
      {
        "stopNumber": 2,
        "status": "pending",
        "address": "789 Oak Ave, Miami, FL 33103",
        "latitude": 25.7812,
        "longitude": -80.2001,
        "ordersCount": 1,
        "completedOrders": 0,
        "totalBoxes": 2,
        "totalAmount": 72.00,
        "orders": [
          {
            "id": 1002,
            "orderNumber": "PICKUP-2024-002",
            "status": "in_transit",
            "orderType": "pickup",
            "scheduledDate": "2025-12-02",
            "timeSlot": "afternoon",
            "timeSlotFormatted": "12:00 PM - 5:00 PM",
            "customerName": "Carlos Rodríguez",
            "customerFirstName": "Carlos",
            "customerLastName": "Rodríguez",
            "customerPhone": "+1 305 555 5678",
            "customerEmail": "carlos@email.com",
            "address": "789 Oak Ave, Miami, FL 33103",
            "street": "789 Oak Ave",
            "apartment": "",
            "city": "Miami",
            "state": "FL",
            "zipcode": "33103",
            "country": "US",
            "latitude": 25.7812,
            "longitude": -80.2001,
            "customerNotes": "",
            "internalNotes": "",
            "boxCount": 2,
            "boxes": null,
            "boxesDelivered": 0,
            "boxesReturned": 0,
            "pendingReturn": false,
            "returnStatus": null,
            "proofStatus": null,
            "deliveredAt": null,
            "subtotal": 65.00,
            "tax": 7.00,
            "total": 72.00,
            "paymentMethod": "cash",
            "services": null,
            "createdAt": "2025-12-01T15:00:00Z"
          }
        ]
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
        code: `curl -X GET 'https://logirapid.com/api/driver-app/routes/RUT-2025-0021/stops' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/routes/RUT-2025-0021/stops', {
  method: 'GET',
  credentials: 'include'
});

const data = await response.json();

if (data.success) {
  const { routeCode, routeStatus, statusChanged, stops } = data.data;

  if (statusChanged) {
    console.log('Ruta iniciada automáticamente');
  }

  console.log(\`Ruta: \${routeCode} - Estado: \${routeStatus}\`);
  console.log(\`Progreso: \${data.data.progress}%\`);

  stops.forEach(stop => {
    console.log(\`\\nParada \${stop.stopNumber}: \${stop.address}\`);
    console.log(\`  Estado: \${stop.status}\`);
    console.log(\`  Órdenes: \${stop.completedOrders}/\${stop.ordersCount}\`);
    console.log(\`  Cajas: \${stop.totalBoxes}\`);
    console.log(\`  Total: $\${stop.totalAmount}\`);

    stop.orders.forEach(order => {
      console.log(\`    - \${order.orderNumber}: \${order.customerName}\`);
      console.log(\`      Tel: \${order.customerPhone}\`);
      console.log(\`      Horario: \${order.timeSlotFormatted}\`);
      console.log(\`      Notas: \${order.customerNotes || 'Sin notas'}\`);
    });
  });
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<RouteStopsResponse> getRouteStops(String routeCode) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/driver-app/routes/\$routeCode/stops'),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);
  if (data['success']) {
    return RouteStopsResponse.fromJson(data['data']);
  }
  throw Exception(data['error']);
}

// Modelo para la respuesta de paradas
class RouteStopsResponse {
  final int routeId;
  final String routeCode;
  final String routeStatus;
  final bool statusChanged;
  final String date;
  final String distance;
  final String duration;
  final String driverName;
  final String vehiclePlate;
  final int totalStops;
  final int completedStops;
  final int totalOrders;
  final int completedOrders;
  final int progress;
  final List<StopDetail> stops;
}

// Modelo para cada parada
class StopDetail {
  final int stopNumber;
  final String status;
  final String address;
  final double latitude;
  final double longitude;
  final int ordersCount;
  final int completedOrders;
  final int totalBoxes;
  final double totalAmount;
  final List<OrderDetail> orders;
}

// Modelo completo de orden
class OrderDetail {
  final int id;
  final String orderNumber;
  final String status;
  final String orderType;
  final String scheduledDate;
  final String timeSlot;
  final String timeSlotFormatted;
  final String customerName;
  final String customerFirstName;
  final String customerLastName;
  final String customerPhone;
  final String customerEmail;
  final String address;
  final String street;
  final String apartment;
  final String city;
  final String state;
  final String zipcode;
  final String country;
  final double latitude;
  final double longitude;
  final String customerNotes;
  final String internalNotes;
  final int boxCount;
  final List<dynamic>? boxes;
  final int boxesDelivered;
  final int boxesReturned;
  final bool pendingReturn;
  final String? returnStatus;
  final String? proofStatus;
  final String? deliveredAt;
  final double subtotal;
  final double tax;
  final double total;
  final String paymentMethod;
  final List<dynamic>? services;
  final String createdAt;
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `// Modelo completo para respuesta de paradas
data class RouteStopsResponse(
    val routeId: Int,
    val routeCode: String,
    val routeStatus: String,
    val statusChanged: Boolean,
    val date: String,
    val distance: String,
    val duration: String,
    val driverName: String,
    val vehiclePlate: String,
    val totalStops: Int,
    val completedStops: Int,
    val totalOrders: Int,
    val completedOrders: Int,
    val progress: Int,
    val stops: List<StopDetail>
)

data class StopDetail(
    val stopNumber: Int,
    val status: String,
    val address: String,
    val latitude: Double,
    val longitude: Double,
    val ordersCount: Int,
    val completedOrders: Int,
    val totalBoxes: Int,
    val totalAmount: Double,
    val orders: List<OrderDetail>
)

data class OrderDetail(
    val id: Int,
    val orderNumber: String,
    val status: String,
    val orderType: String,
    val scheduledDate: String,
    val timeSlot: String,
    val timeSlotFormatted: String,
    val customerName: String,
    val customerFirstName: String,
    val customerLastName: String,
    val customerPhone: String,
    val customerEmail: String,
    val address: String,
    val street: String,
    val apartment: String,
    val city: String,
    val state: String,
    val zipcode: String,
    val country: String,
    val latitude: Double,
    val longitude: Double,
    val customerNotes: String,
    val internalNotes: String,
    val boxCount: Int,
    val boxes: List<Any>?,
    val boxesDelivered: Int,
    val boxesReturned: Int,
    val pendingReturn: Boolean,
    val returnStatus: String?,
    val proofStatus: String?,
    val deliveredAt: String?,
    val subtotal: Double,
    val tax: Double,
    val total: Double,
    val paymentMethod: String,
    val services: List<Any>?,
    val createdAt: String
)

interface DriverApi {
    @GET("api/driver-app/routes/{code}/stops")
    suspend fun getRouteStops(
        @Header("Cookie") authToken: String,
        @Path("code") routeCode: String
    ): Response<ApiResponse<RouteStopsResponse>>
}

// Uso en ViewModel
fun loadRouteStops(routeCode: String) {
    viewModelScope.launch {
        val response = driverApi.getRouteStops("auth-token=\$token", routeCode)
        if (response.isSuccessful && response.body()?.success == true) {
            val data = response.body()!!.data

            if (data.statusChanged) {
                showMessage("Ruta iniciada")
            }

            _stops.value = data.stops
            _progress.value = data.progress
        }
    }
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `// Modelo completo para paradas
struct RouteStopsResponse: Codable {
    let routeId: Int
    let routeCode: String
    let routeStatus: String
    let statusChanged: Bool
    let date: String
    let distance: String
    let duration: String
    let driverName: String
    let vehiclePlate: String
    let totalStops: Int
    let completedStops: Int
    let totalOrders: Int
    let completedOrders: Int
    let progress: Int
    let stops: [StopDetail]
}

struct StopDetail: Codable {
    let stopNumber: Int
    let status: String
    let address: String
    let latitude: Double
    let longitude: Double
    let ordersCount: Int
    let completedOrders: Int
    let totalBoxes: Int
    let totalAmount: Double
    let orders: [OrderDetail]
}

struct OrderDetail: Codable {
    let id: Int
    let orderNumber: String
    let status: String
    let orderType: String
    let scheduledDate: String
    let timeSlot: String
    let timeSlotFormatted: String
    let customerName: String
    let customerFirstName: String
    let customerLastName: String
    let customerPhone: String
    let customerEmail: String
    let address: String
    let street: String
    let apartment: String
    let city: String
    let state: String
    let zipcode: String
    let country: String
    let latitude: Double
    let longitude: Double
    let customerNotes: String
    let internalNotes: String
    let boxCount: Int
    let boxes: [Any]?
    let boxesDelivered: Int
    let boxesReturned: Int
    let pendingReturn: Bool
    let returnStatus: String?
    let proofStatus: String?
    let deliveredAt: String?
    let subtotal: Double
    let tax: Double
    let total: Double
    let paymentMethod: String
    let services: [Any]?
    let createdAt: String
}

func getRouteStops(routeCode: String) async throws -> RouteStopsResponse {
    var request = URLRequest(url: URL(string: "https://logirapid.com/api/driver-app/routes/\\(routeCode)/stops")!)
    request.setValue("auth-token=\\(token)", forHTTPHeaderField: "Cookie")

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(ApiResponse<RouteStopsResponse>.self, from: data)

    guard let stopsData = response.data else {
        throw APIError.invalidResponse
    }

    if stopsData.statusChanged {
        print("Ruta iniciada automáticamente")
    }

    return stopsData
}

// Uso en SwiftUI
struct StopsListView: View {
    @State private var stopsData: RouteStopsResponse?

    var body: some View {
        List(stopsData?.stops ?? [], id: \\.stopNumber) { stop in
            VStack(alignment: .leading) {
                Text("Parada \\(stop.stopNumber)")
                    .font(.headline)
                Text(stop.address)
                    .font(.subheadline)

                ForEach(stop.orders, id: \\.id) { order in
                    OrderRow(order: order)
                }
            }
        }
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
