// Paqueteria API Documentation Data
import { Endpoint } from './auth-api'

export const paqueteriaEndpoints: Endpoint[] = [
  {
    id: 'generate-order-number',
    method: 'POST',
    path: '/api/package-orders/generate-number',
    title: 'Generar Numero de Orden',
    description: 'Genera un numero de orden unico basado en el tipo de orden. Los numeros se generan secuencialmente con prefijos especificos: PICKUP para recogidas, OFF para oficina, DEL para entregas.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    requestBody: [
      {
        name: 'orderType',
        type: 'string',
        required: true,
        description: 'Tipo de orden. Valores: recogida, oficina, entrega, entrega_empaques, retorno'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Numero generado exitosamente',
        body: `{
  "success": true,
  "orderNumber": "PICKUP00042"
}`
      },
      {
        status: 400,
        description: 'Tipo de orden invalido',
        body: `{
  "success": false,
  "error": "Tipo de orden invalido"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST https://logirapid.com/api/package-orders/generate-number \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orderType": "recogida"
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function generateOrderNumber(orderType) {
  const response = await fetch('/api/package-orders/generate-number', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ orderType })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Numero generado:', data.orderNumber);
    return data.orderNumber;
  }

  throw new Error(data.error);
}

// Ejemplos de uso
const pickupNumber = await generateOrderNumber('recogida');  // PICKUP00042
const officeNumber = await generateOrderNumber('oficina');   // OFF00015
const deliveryNumber = await generateOrderNumber('entrega'); // DEL00089`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct GenerateNumberRequest: Codable {
    let orderType: String
}

struct GenerateNumberResponse: Codable {
    let success: Bool
    let orderNumber: String?
    let error: String?
}

func generateOrderNumber(type: String) async throws -> String {
    let url = URL(string: "https://logirapid.com/api/package-orders/generate-number")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = GenerateNumberRequest(orderType: type)
    request.httpBody = try JSONEncoder().encode(body)

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(GenerateNumberResponse.self, from: data)

    guard response.success, let orderNumber = response.orderNumber else {
        throw NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: response.error ?? "Error"])
    }

    return orderNumber
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class GenerateNumberRequest(val orderType: String)

data class GenerateNumberResponse(
    val success: Boolean,
    val orderNumber: String?,
    val error: String?
)

interface PackageOrdersApi {
    @POST("api/package-orders/generate-number")
    suspend fun generateNumber(
        @Header("Authorization") token: String,
        @Body request: GenerateNumberRequest
    ): GenerateNumberResponse
}

// Uso
suspend fun generateOrderNumber(type: String): String {
    val response = api.generateNumber(
        token = "Bearer \$authToken",
        request = GenerateNumberRequest(orderType = type)
    )

    if (response.success) {
        return response.orderNumber ?: ""
    }
    throw Exception(response.error)
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<String> generateOrderNumber(String orderType) async {
  final response = await http.post(
    Uri.parse('https://logirapid.com/api/package-orders/generate-number'),
    headers: {
      'Authorization': 'Bearer \$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({'orderType': orderType}),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return data['orderNumber'];
  }

  throw Exception(data['error']);
}`
      }
    ]
  },
  {
    id: 'create-package-order',
    method: 'POST',
    path: '/api/package-orders',
    title: 'Crear Orden de Paqueteria',
    description: 'Crea una nueva orden de paqueteria (recogida, oficina, entrega). Incluye datos del cliente, direccion con geolocalizacion, servicios solicitados y fecha programada.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    requestBody: [
      {
        name: 'customerId',
        type: 'number',
        required: false,
        description: 'ID del cliente existente en el CRM'
      },
      {
        name: 'customerName',
        type: 'string',
        required: true,
        description: 'Nombre completo del cliente'
      },
      {
        name: 'phone',
        type: 'string',
        required: true,
        description: 'Telefono del cliente'
      },
      {
        name: 'email',
        type: 'string',
        required: false,
        description: 'Email del cliente'
      },
      {
        name: 'orderNumber',
        type: 'string',
        required: true,
        description: 'Numero de orden generado previamente con /generate-number'
      },
      {
        name: 'orderType',
        type: 'string',
        required: true,
        description: 'Tipo de orden: recogida, oficina, entrega, entrega_empaques, retorno'
      },
      {
        name: 'services',
        type: 'array',
        required: true,
        description: 'Array de servicios: [{type, name, price, quantity}]'
      },
      {
        name: 'scheduledDate',
        type: 'string',
        required: true,
        description: 'Fecha programada en formato YYYY-MM-DD'
      },
      {
        name: 'timeSlot',
        type: 'string',
        required: true,
        description: 'Franja horaria, ej: "9:00 AM - 12:00 PM"'
      },
      {
        name: 'street',
        type: 'string',
        required: true,
        description: 'Direccion de calle'
      },
      {
        name: 'apartment',
        type: 'string',
        required: false,
        description: 'Apartamento, unidad o suite'
      },
      {
        name: 'city',
        type: 'string',
        required: true,
        description: 'Ciudad'
      },
      {
        name: 'state',
        type: 'string',
        required: true,
        description: 'Estado o provincia'
      },
      {
        name: 'zipcode',
        type: 'string',
        required: true,
        description: 'Codigo postal'
      },
      {
        name: 'country',
        type: 'string',
        required: false,
        description: 'Pais (default: USA)',
        default: 'USA'
      },
      {
        name: 'latitude',
        type: 'number',
        required: true,
        description: 'Latitud de la ubicacion'
      },
      {
        name: 'longitude',
        type: 'number',
        required: true,
        description: 'Longitud de la ubicacion'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Notas internas de la orden'
      },
      {
        name: 'pickupInstructions',
        type: 'string',
        required: false,
        description: 'Instrucciones especiales para la recogida/entrega'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Orden creada exitosamente',
        body: `{
  "success": true,
  "data": {
    "id": 123,
    "orderNumber": "PICKUP00042",
    "status": "pending",
    "createdAt": "2024-03-20T10:30:00Z"
  },
  "message": "Orden de paqueteria creada exitosamente"
}`
      },
      {
        status: 400,
        description: 'Datos invalidos o faltantes',
        body: `{
  "success": false,
  "error": "Faltan campos requeridos: customerName, phone, scheduledDate"
}`
      },
      {
        status: 500,
        description: 'Error del servidor',
        body: `{
  "success": false,
  "error": "Error al crear la orden"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST https://logirapid.com/api/package-orders \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerId": 456,
    "customerName": "Juan Perez",
    "phone": "+1 305 555 1234",
    "email": "juan@email.com",
    "orderNumber": "PICKUP00042",
    "orderType": "recogida",
    "services": [
      {"type": "pickup", "name": "Recogida Estandar", "price": 15.00, "quantity": 1},
      {"type": "box", "name": "Caja 15x15x15", "price": 5.00, "quantity": 2}
    ],
    "scheduledDate": "2024-03-25",
    "timeSlot": "9:00 AM - 12:00 PM",
    "street": "123 Main Street",
    "apartment": "Apt 4B",
    "city": "Miami",
    "state": "FL",
    "zipcode": "33101",
    "country": "USA",
    "latitude": 25.7617,
    "longitude": -80.1918,
    "notes": "Cliente frecuente",
    "pickupInstructions": "Tocar timbre 2 veces"
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function createPackageOrder(orderData) {
  const response = await fetch('/api/package-orders', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(orderData)
  });

  const data = await response.json();

  if (data.success) {
    console.log('Orden creada:', data.data.orderNumber);
    return data.data;
  }

  throw new Error(data.error);
}

// Ejemplo de uso completo
async function programarRecogida() {
  // 1. Generar numero de orden
  const orderNumber = await generateOrderNumber('recogida');

  // 2. Crear la orden
  const order = await createPackageOrder({
    customerName: 'Juan Perez',
    phone: '+1 305 555 1234',
    email: 'juan@email.com',
    orderNumber: orderNumber,
    orderType: 'recogida',
    services: [
      { type: 'pickup', name: 'Recogida Estandar', price: 15.00, quantity: 1 },
      { type: 'box', name: 'Caja 15x15x15', price: 5.00, quantity: 2 }
    ],
    scheduledDate: '2024-03-25',
    timeSlot: '9:00 AM - 12:00 PM',
    street: '123 Main Street',
    apartment: 'Apt 4B',
    city: 'Miami',
    state: 'FL',
    zipcode: '33101',
    country: 'USA',
    latitude: 25.7617,
    longitude: -80.1918,
    notes: 'Cliente frecuente',
    pickupInstructions: 'Tocar timbre 2 veces'
  });

  return order;
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct CreateOrderRequest: Codable {
    let customerId: Int?
    let customerName: String
    let phone: String
    let email: String?
    let orderNumber: String
    let orderType: String
    let services: [Service]
    let scheduledDate: String
    let timeSlot: String
    let street: String
    let apartment: String?
    let city: String
    let state: String
    let zipcode: String
    let country: String
    let latitude: Double
    let longitude: Double
    let notes: String?
    let pickupInstructions: String?
}

struct Service: Codable {
    let type: String
    let name: String
    let price: Double
    let quantity: Int
}

func createPackageOrder(request: CreateOrderRequest) async throws -> OrderResponse {
    let url = URL(string: "https://logirapid.com/api/package-orders")!
    var urlRequest = URLRequest(url: url)
    urlRequest.httpMethod = "POST"
    urlRequest.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
    urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
    urlRequest.httpBody = try JSONEncoder().encode(request)

    let (data, _) = try await URLSession.shared.data(for: urlRequest)
    return try JSONDecoder().decode(OrderResponse.self, from: data)
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class CreateOrderRequest(
    val customerId: Int? = null,
    val customerName: String,
    val phone: String,
    val email: String? = null,
    val orderNumber: String,
    val orderType: String,
    val services: List<Service>,
    val scheduledDate: String,
    val timeSlot: String,
    val street: String,
    val apartment: String? = null,
    val city: String,
    val state: String,
    val zipcode: String,
    val country: String = "USA",
    val latitude: Double,
    val longitude: Double,
    val notes: String? = null,
    val pickupInstructions: String? = null
)

data class Service(
    val type: String,
    val name: String,
    val price: Double,
    val quantity: Int
)

interface PackageOrdersApi {
    @POST("api/package-orders")
    suspend fun createOrder(
        @Header("Authorization") token: String,
        @Body request: CreateOrderRequest
    ): CreateOrderResponse
}

// Uso
suspend fun createPickupOrder(
    customerName: String,
    phone: String,
    address: Address,
    date: String,
    timeSlot: String
): CreateOrderResponse {
    val orderNumber = generateOrderNumber("recogida")

    return api.createOrder(
        token = "Bearer \$authToken",
        request = CreateOrderRequest(
            customerName = customerName,
            phone = phone,
            orderNumber = orderNumber,
            orderType = "recogida",
            services = listOf(
                Service("pickup", "Recogida Estandar", 15.0, 1)
            ),
            scheduledDate = date,
            timeSlot = timeSlot,
            street = address.street,
            city = address.city,
            state = address.state,
            zipcode = address.zipcode,
            country = "USA",
            latitude = address.latitude,
            longitude = address.longitude
        )
    )
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `class PackageOrderService {
  final String baseUrl = 'https://logirapid.com/api';
  final String token;

  PackageOrderService({required this.token});

  Future<Map<String, dynamic>> createOrder({
    int? customerId,
    required String customerName,
    required String phone,
    String? email,
    required String orderNumber,
    required String orderType,
    required List<Map<String, dynamic>> services,
    required String scheduledDate,
    required String timeSlot,
    required String street,
    String? apartment,
    required String city,
    required String state,
    required String zipcode,
    String country = 'USA',
    required double latitude,
    required double longitude,
    String? notes,
    String? pickupInstructions,
  }) async {
    final response = await http.post(
      Uri.parse('\$baseUrl/package-orders'),
      headers: {
        'Authorization': 'Bearer \$token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({
        if (customerId != null) 'customerId': customerId,
        'customerName': customerName,
        'phone': phone,
        if (email != null) 'email': email,
        'orderNumber': orderNumber,
        'orderType': orderType,
        'services': services,
        'scheduledDate': scheduledDate,
        'timeSlot': timeSlot,
        'street': street,
        if (apartment != null) 'apartment': apartment,
        'city': city,
        'state': state,
        'zipcode': zipcode,
        'country': country,
        'latitude': latitude,
        'longitude': longitude,
        if (notes != null) 'notes': notes,
        if (pickupInstructions != null) 'pickupInstructions': pickupInstructions,
      }),
    );

    return jsonDecode(response.body);
  }

  // Metodo helper para crear recogida
  Future<Map<String, dynamic>> createPickupOrder({
    required String customerName,
    required String phone,
    required String address,
    required String city,
    required String state,
    required String zipcode,
    required double lat,
    required double lng,
    required String date,
    required String timeSlot,
  }) async {
    // Generar numero
    final numberResponse = await http.post(
      Uri.parse('\$baseUrl/package-orders/generate-number'),
      headers: {
        'Authorization': 'Bearer \$token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'orderType': 'recogida'}),
    );
    final orderNumber = jsonDecode(numberResponse.body)['orderNumber'];

    // Crear orden
    return createOrder(
      customerName: customerName,
      phone: phone,
      orderNumber: orderNumber,
      orderType: 'recogida',
      services: [
        {'type': 'pickup', 'name': 'Recogida Estandar', 'price': 15.0, 'quantity': 1}
      ],
      scheduledDate: date,
      timeSlot: timeSlot,
      street: address,
      city: city,
      state: state,
      zipcode: zipcode,
      latitude: lat,
      longitude: lng,
    );
  }
}`
      }
    ]
  },
  {
    id: 'list-package-orders',
    method: 'GET',
    path: '/api/package-orders',
    title: 'Listar Ordenes de Paqueteria',
    description: 'Obtiene una lista paginada de ordenes de paqueteria con filtros opcionales por estado, tipo, cliente, almacen y busqueda de texto.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    parameters: [
      {
        name: 'page',
        type: 'number',
        required: false,
        description: 'Numero de pagina',
        default: '1'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Cantidad de resultados por pagina',
        default: '25'
      },
      {
        name: 'search',
        type: 'string',
        required: false,
        description: 'Busqueda en numero de orden, nombre de cliente, direccion o telefono'
      },
      {
        name: 'status',
        type: 'string',
        required: false,
        description: 'Filtrar por estado: pending, reprogrammed, in_transit, in_route, picked_up, delivered, completed, cancelled'
      },
      {
        name: 'orderType',
        type: 'string',
        required: false,
        description: 'Filtrar por tipo: recogida, oficina, entrega, entrega_empaques, retorno'
      },
      {
        name: 'customerId',
        type: 'number',
        required: false,
        description: 'Filtrar por ID de cliente'
      },
      {
        name: 'warehouseId',
        type: 'number',
        required: false,
        description: 'Filtrar por ID de almacen'
      },
      {
        name: 'scheduledDate',
        type: 'string',
        required: false,
        description: 'Filtrar por fecha programada (YYYY-MM-DD)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de ordenes',
        body: `{
  "success": true,
  "data": [
    {
      "id": 123,
      "orderNumber": "PICKUP00042",
      "orderType": "recogida",
      "status": "pending",
      "customerName": "Juan Perez",
      "phone": "+1 305 555 1234",
      "street": "123 Main Street",
      "city": "Miami",
      "state": "FL",
      "zipcode": "33101",
      "totalAmount": 25.00,
      "scheduledDate": "2024-03-25",
      "timeSlot": "9:00 AM - 12:00 PM",
      "createdAt": "2024-03-20T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 150,
    "totalPages": 6,
    "hasNext": true,
    "hasPrev": false
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Listar todas las ordenes
curl -X GET "https://logirapid.com/api/package-orders" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Con paginacion
curl -X GET "https://logirapid.com/api/package-orders?page=2&limit=10" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Filtrar por estado
curl -X GET "https://logirapid.com/api/package-orders?status=pending" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Filtrar por tipo y busqueda
curl -X GET "https://logirapid.com/api/package-orders?orderType=recogida&search=Juan" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function listPackageOrders(filters = {}) {
  const params = new URLSearchParams();

  // Agregar filtros
  if (filters.page) params.append('page', filters.page);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.search) params.append('search', filters.search);
  if (filters.status) params.append('status', filters.status);
  if (filters.orderType) params.append('orderType', filters.orderType);
  if (filters.customerId) params.append('customerId', filters.customerId);

  const response = await fetch(\`/api/package-orders?\${params}\`, {
    method: 'GET',
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });

  const data = await response.json();

  if (data.success) {
    console.log('Total ordenes:', data.pagination.total);
    console.log('Paginas:', data.pagination.totalPages);
    return data;
  }

  throw new Error(data.error);
}

// Ejemplos de uso
const pendingOrders = await listPackageOrders({ status: 'pending' });
const pickupOrders = await listPackageOrders({ orderType: 'recogida', page: 1, limit: 10 });
const searchResults = await listPackageOrders({ search: 'Juan Perez' });`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct OrdersListResponse: Codable {
    let success: Bool
    let data: [Order]
    let pagination: Pagination
}

struct Pagination: Codable {
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int
    let hasNext: Bool
    let hasPrev: Bool
}

func listOrders(
    page: Int = 1,
    limit: Int = 25,
    status: String? = nil,
    orderType: String? = nil,
    search: String? = nil
) async throws -> OrdersListResponse {
    var components = URLComponents(string: "https://logirapid.com/api/package-orders")!
    var queryItems = [
        URLQueryItem(name: "page", value: String(page)),
        URLQueryItem(name: "limit", value: String(limit))
    ]

    if let status = status {
        queryItems.append(URLQueryItem(name: "status", value: status))
    }
    if let orderType = orderType {
        queryItems.append(URLQueryItem(name: "orderType", value: orderType))
    }
    if let search = search {
        queryItems.append(URLQueryItem(name: "search", value: search))
    }

    components.queryItems = queryItems

    var request = URLRequest(url: components.url!)
    request.httpMethod = "GET"
    request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")

    let (data, _) = try await URLSession.shared.data(for: request)
    return try JSONDecoder().decode(OrdersListResponse.self, from: data)
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class OrdersListResponse(
    val success: Boolean,
    val data: List<Order>,
    val pagination: Pagination
)

data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int,
    val hasNext: Boolean,
    val hasPrev: Boolean
)

interface PackageOrdersApi {
    @GET("api/package-orders")
    suspend fun listOrders(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 25,
        @Query("status") status: String? = null,
        @Query("orderType") orderType: String? = null,
        @Query("search") search: String? = null
    ): OrdersListResponse
}

// Uso con Flow para paginacion
class OrdersRepository(private val api: PackageOrdersApi) {
    fun getOrdersPaged(status: String? = null): Flow<PagingData<Order>> {
        return Pager(
            config = PagingConfig(pageSize = 25),
            pagingSourceFactory = { OrdersPagingSource(api, status) }
        ).flow
    }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> listOrders({
  int page = 1,
  int limit = 25,
  String? status,
  String? orderType,
  String? search,
  int? customerId,
}) async {
  final params = {
    'page': page.toString(),
    'limit': limit.toString(),
    if (status != null) 'status': status,
    if (orderType != null) 'orderType': orderType,
    if (search != null) 'search': search,
    if (customerId != null) 'customerId': customerId.toString(),
  };

  final uri = Uri.parse('https://logirapid.com/api/package-orders')
      .replace(queryParameters: params);

  final response = await http.get(
    uri,
    headers: {'Authorization': 'Bearer \$token'},
  );

  return jsonDecode(response.body);
}

// Widget con paginacion infinita
class OrdersListView extends StatefulWidget {
  @override
  _OrdersListViewState createState() => _OrdersListViewState();
}

class _OrdersListViewState extends State<OrdersListView> {
  List<dynamic> orders = [];
  int currentPage = 1;
  bool hasMore = true;
  bool isLoading = false;

  Future<void> loadMore() async {
    if (isLoading || !hasMore) return;

    setState(() => isLoading = true);

    final result = await listOrders(page: currentPage);

    setState(() {
      orders.addAll(result['data']);
      hasMore = result['pagination']['hasNext'];
      currentPage++;
      isLoading = false;
    });
  }
}`
      }
    ]
  },
  {
    id: 'get-order-detail',
    method: 'GET',
    path: '/api/pickup-orders/{id}',
    title: 'Obtener Detalle de Orden',
    description: 'Obtiene el detalle completo de una orden incluyendo informacion de zona, ruta asignada, empaques asociados y resumen.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    parameters: [
      {
        name: 'id',
        type: 'number',
        required: true,
        description: 'ID de la orden'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Detalle de la orden',
        body: `{
  "success": true,
  "data": {
    "order": {
      "id": 123,
      "orderNumber": "PICKUP00042",
      "orderType": "recogida",
      "status": "in_route",
      "customerName": "Juan Perez",
      "phone": "+1 305 555 1234",
      "street": "123 Main Street",
      "apartment": "Apt 4B",
      "city": "Miami",
      "state": "FL",
      "zipcode": "33101",
      "services": [
        {"type": "pickup", "name": "Recogida Estandar", "price": 15.00, "quantity": 1}
      ],
      "totalAmount": 25.00,
      "scheduledDate": "2024-03-25",
      "timeSlot": "9:00 AM - 12:00 PM",
      "latitude": 25.7617,
      "longitude": -80.1918,
      "notes": "Cliente frecuente",
      "pickupInstructions": "Tocar timbre 2 veces",
      "createdAt": "2024-03-20T10:30:00Z"
    },
    "zone": {
      "id": 5,
      "name": "Zona Miami Downtown",
      "timeSlot": "9:00 AM - 12:00 PM"
    },
    "route": {
      "id": 78,
      "routeNumber": "RUT-2024-0315",
      "driverName": "Carlos Rodriguez",
      "status": "active"
    },
    "empaques": [
      {
        "id": 789,
        "codigo": "EMP-2024-00123",
        "estado": "asignado",
        "boxType": "15x15x15",
        "weightLb": 5.5
      }
    ],
    "summary": {
      "totalEmpaques": 2,
      "totalWeightLb": 11.0,
      "hasRoute": true
    }
  }
}`
      },
      {
        status: 404,
        description: 'Orden no encontrada',
        body: `{
  "success": false,
  "error": "Orden no encontrada"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET "https://logirapid.com/api/pickup-orders/123" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function getOrderDetail(orderId) {
  const response = await fetch(\`/api/pickup-orders/\${orderId}\`, {
    method: 'GET',
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });

  const data = await response.json();

  if (data.success) {
    const { order, zone, route, empaques, summary } = data.data;

    console.log('Orden:', order.orderNumber);
    console.log('Estado:', order.status);
    console.log('Zona:', zone?.name || 'Sin asignar');
    console.log('Ruta:', route?.routeNumber || 'Sin ruta');
    console.log('Empaques:', summary.totalEmpaques);

    return data.data;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct OrderDetailResponse: Codable {
    let success: Bool
    let data: OrderDetailData?
    let error: String?
}

struct OrderDetailData: Codable {
    let order: Order
    let zone: Zone?
    let route: Route?
    let empaques: [Empaque]
    let summary: OrderSummary
}

func getOrderDetail(id: Int) async throws -> OrderDetailData {
    let url = URL(string: "https://logirapid.com/api/pickup-orders/\\(id)")!
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(OrderDetailResponse.self, from: data)

    guard response.success, let detail = response.data else {
        throw NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: response.error ?? "Error"])
    }

    return detail
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class OrderDetailResponse(
    val success: Boolean,
    val data: OrderDetailData?,
    val error: String?
)

data class OrderDetailData(
    val order: Order,
    val zone: Zone?,
    val route: Route?,
    val empaques: List<Empaque>,
    val summary: OrderSummary
)

interface PackageOrdersApi {
    @GET("api/pickup-orders/{id}")
    suspend fun getOrderDetail(
        @Header("Authorization") token: String,
        @Path("id") orderId: Int
    ): OrderDetailResponse
}

// Uso
val detail = api.getOrderDetail("Bearer \$authToken", orderId = 123)
if (detail.success && detail.data != null) {
    val order = detail.data.order
    val hasRoute = detail.data.summary.hasRoute
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> getOrderDetail(int orderId) async {
  final response = await http.get(
    Uri.parse('https://logirapid.com/api/pickup-orders/\$orderId'),
    headers: {'Authorization': 'Bearer \$token'},
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return data['data'];
  }

  throw Exception(data['error']);
}

// Widget de detalle
class OrderDetailScreen extends StatelessWidget {
  final int orderId;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: getOrderDetail(orderId),
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          final data = snapshot.data!;
          final order = data['order'];
          final route = data['route'];
          final summary = data['summary'];

          return Column(
            children: [
              Text('Orden: \${order['orderNumber']}'),
              Text('Estado: \${order['status']}'),
              if (route != null) Text('Ruta: \${route['routeNumber']}'),
              Text('Empaques: \${summary['totalEmpaques']}'),
            ],
          );
        }
        return CircularProgressIndicator();
      },
    );
  }
}`
      }
    ]
  },
  {
    id: 'update-order',
    method: 'PATCH',
    path: '/api/pickup-orders/{id}',
    title: 'Actualizar Orden',
    description: 'Actualiza una orden de paqueteria. Solo se pueden actualizar ordenes en estado "pending". Una vez que la orden esta en ruta o entregada, no puede ser modificada.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    parameters: [
      {
        name: 'id',
        type: 'number',
        required: true,
        description: 'ID de la orden'
      }
    ],
    requestBody: [
      {
        name: 'customerName',
        type: 'string',
        required: false,
        description: 'Nombre del cliente'
      },
      {
        name: 'customerAddress',
        type: 'string',
        required: false,
        description: 'Direccion completa'
      },
      {
        name: 'customerPhone',
        type: 'string',
        required: false,
        description: 'Telefono del cliente'
      },
      {
        name: 'scheduledDate',
        type: 'string',
        required: false,
        description: 'Nueva fecha programada (YYYY-MM-DD)'
      },
      {
        name: 'timeSlot',
        type: 'string',
        required: false,
        description: 'Nueva franja horaria'
      },
      {
        name: 'services',
        type: 'array',
        required: false,
        description: 'Servicios actualizados'
      },
      {
        name: 'pickupInstructions',
        type: 'string',
        required: false,
        description: 'Instrucciones de recogida/entrega'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Notas de la orden'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Orden actualizada',
        body: `{
  "success": true,
  "message": "Orden actualizada exitosamente"
}`
      },
      {
        status: 400,
        description: 'No se puede actualizar',
        body: `{
  "success": false,
  "error": "Solo se pueden editar ordenes en estado pending"
}`
      },
      {
        status: 404,
        description: 'Orden no encontrada',
        body: `{
  "success": false,
  "error": "Orden no encontrada"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X PATCH "https://logirapid.com/api/pickup-orders/123" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "customerPhone": "+1 305 555 9999",
    "scheduledDate": "2024-03-26",
    "timeSlot": "2:00 PM - 5:00 PM",
    "pickupInstructions": "Llamar antes de llegar"
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function updateOrder(orderId, updates) {
  const response = await fetch(\`/api/pickup-orders/\${orderId}\`, {
    method: 'PATCH',
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  const data = await response.json();

  if (data.success) {
    console.log('Orden actualizada');
    return true;
  }

  throw new Error(data.error);
}

// Ejemplo de uso
await updateOrder(123, {
  customerPhone: '+1 305 555 9999',
  scheduledDate: '2024-03-26',
  timeSlot: '2:00 PM - 5:00 PM',
  pickupInstructions: 'Llamar antes de llegar'
});`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct UpdateOrderRequest: Codable {
    var customerName: String?
    var customerPhone: String?
    var scheduledDate: String?
    var timeSlot: String?
    var pickupInstructions: String?
    var notes: String?
}

func updateOrder(id: Int, updates: UpdateOrderRequest) async throws -> Bool {
    let url = URL(string: "https://logirapid.com/api/pickup-orders/\\(id)")!
    var request = URLRequest(url: url)
    request.httpMethod = "PATCH"
    request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(updates)

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(SimpleResponse.self, from: data)

    return response.success
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class UpdateOrderRequest(
    val customerName: String? = null,
    val customerPhone: String? = null,
    val scheduledDate: String? = null,
    val timeSlot: String? = null,
    val pickupInstructions: String? = null,
    val notes: String? = null
)

interface PackageOrdersApi {
    @PATCH("api/pickup-orders/{id}")
    suspend fun updateOrder(
        @Header("Authorization") token: String,
        @Path("id") orderId: Int,
        @Body request: UpdateOrderRequest
    ): SimpleResponse
}

// Uso
val result = api.updateOrder(
    token = "Bearer \$authToken",
    orderId = 123,
    request = UpdateOrderRequest(
        scheduledDate = "2024-03-26",
        timeSlot = "2:00 PM - 5:00 PM"
    )
)`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<bool> updateOrder(int orderId, Map<String, dynamic> updates) async {
  final response = await http.patch(
    Uri.parse('https://logirapid.com/api/pickup-orders/\$orderId'),
    headers: {
      'Authorization': 'Bearer \$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode(updates),
  );

  final data = jsonDecode(response.body);
  return data['success'] == true;
}

// Uso
await updateOrder(123, {
  'scheduledDate': '2024-03-26',
  'timeSlot': '2:00 PM - 5:00 PM',
  'pickupInstructions': 'Llamar antes de llegar',
});`
      }
    ]
  },
  {
    id: 'cancel-order',
    method: 'POST',
    path: '/api/package-orders/{id}/cancel',
    title: 'Cancelar Orden',
    description: 'Cancela una orden de paqueteria. Si la orden esta asignada a una ruta, se remueve automaticamente y se recalculan las paradas restantes.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    parameters: [
      {
        name: 'id',
        type: 'number',
        required: true,
        description: 'ID de la orden a cancelar'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Orden cancelada',
        body: `{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "orderId": 123,
    "wasInRoute": true,
    "remainingStops": 5
  }
}`
      },
      {
        status: 400,
        description: 'No se puede cancelar',
        body: `{
  "success": false,
  "error": "No se puede cancelar una orden ya entregada"
}`
      },
      {
        status: 404,
        description: 'Orden no encontrada',
        body: `{
  "success": false,
  "error": "Order not found"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST "https://logirapid.com/api/package-orders/123/cancel" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function cancelOrder(orderId) {
  const response = await fetch(\`/api/package-orders/\${orderId}/cancel\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });

  const data = await response.json();

  if (data.success) {
    console.log('Orden cancelada');
    if (data.data.wasInRoute) {
      console.log('La orden fue removida de la ruta');
      console.log('Paradas restantes:', data.data.remainingStops);
    }
    return data.data;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct CancelResponse: Codable {
    let success: Bool
    let message: String?
    let data: CancelData?
    let error: String?
}

struct CancelData: Codable {
    let orderId: Int
    let wasInRoute: Bool
    let remainingStops: Int
}

func cancelOrder(id: Int) async throws -> CancelData {
    let url = URL(string: "https://logirapid.com/api/package-orders/\\(id)/cancel")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(CancelResponse.self, from: data)

    guard response.success, let cancelData = response.data else {
        throw NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: response.error ?? "Error"])
    }

    return cancelData
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class CancelResponse(
    val success: Boolean,
    val message: String?,
    val data: CancelData?,
    val error: String?
)

data class CancelData(
    val orderId: Int,
    val wasInRoute: Boolean,
    val remainingStops: Int
)

interface PackageOrdersApi {
    @POST("api/package-orders/{id}/cancel")
    suspend fun cancelOrder(
        @Header("Authorization") token: String,
        @Path("id") orderId: Int
    ): CancelResponse
}

// Uso con confirmacion
fun cancelOrderWithConfirmation(orderId: Int) {
    showDialog("Cancelar orden?") { confirmed ->
        if (confirmed) {
            viewModelScope.launch {
                val result = api.cancelOrder("Bearer \$authToken", orderId)
                if (result.success) {
                    showSnackbar("Orden cancelada")
                    refreshOrders()
                }
            }
        }
    }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> cancelOrder(int orderId) async {
  final response = await http.post(
    Uri.parse('https://logirapid.com/api/package-orders/\$orderId/cancel'),
    headers: {'Authorization': 'Bearer \$token'},
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return data['data'];
  }

  throw Exception(data['error']);
}

// Widget con dialogo de confirmacion
void showCancelDialog(BuildContext context, int orderId) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: Text('Cancelar orden'),
      content: Text('Esta seguro que desea cancelar esta orden?'),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('No'),
        ),
        TextButton(
          onPressed: () async {
            Navigator.pop(context);
            try {
              await cancelOrder(orderId);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Orden cancelada')),
              );
            } catch (e) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Error: \$e')),
              );
            }
          },
          child: Text('Si, cancelar'),
        ),
      ],
    ),
  );
}`
      }
    ]
  },
  {
    id: 'reprogram-order',
    method: 'POST',
    path: '/api/package-orders/{id}/reprogram',
    title: 'Reprogramar Orden',
    description: 'Reprograma una orden para una nueva fecha y/o franja horaria. La orden cambia a estado "reprogrammed" y queda disponible para ser asignada a una nueva ruta.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    parameters: [
      {
        name: 'id',
        type: 'number',
        required: true,
        description: 'ID de la orden a reprogramar'
      }
    ],
    requestBody: [
      {
        name: 'newScheduledDate',
        type: 'string',
        required: true,
        description: 'Nueva fecha en formato YYYY-MM-DD'
      },
      {
        name: 'newTimeSlot',
        type: 'string',
        required: true,
        description: 'Nueva franja horaria'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Orden reprogramada',
        body: `{
  "success": true,
  "message": "Order reprogrammed successfully",
  "data": {
    "orderId": 123,
    "newScheduledDate": "2024-03-28",
    "newTimeSlot": "9:00 AM - 12:00 PM"
  }
}`
      },
      {
        status: 400,
        description: 'Datos invalidos',
        body: `{
  "success": false,
  "error": "newScheduledDate y newTimeSlot son requeridos"
}`
      },
      {
        status: 404,
        description: 'Orden no encontrada',
        body: `{
  "success": false,
  "error": "Order not found"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST "https://logirapid.com/api/package-orders/123/reprogram" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "newScheduledDate": "2024-03-28",
    "newTimeSlot": "9:00 AM - 12:00 PM"
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function reprogramOrder(orderId, newDate, newTimeSlot) {
  const response = await fetch(\`/api/package-orders/\${orderId}/reprogram\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      newScheduledDate: newDate,
      newTimeSlot: newTimeSlot
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Orden reprogramada para:', data.data.newScheduledDate);
    return data.data;
  }

  throw new Error(data.error);
}

// Ejemplo de uso
await reprogramOrder(123, '2024-03-28', '9:00 AM - 12:00 PM');`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct ReprogramRequest: Codable {
    let newScheduledDate: String
    let newTimeSlot: String
}

struct ReprogramResponse: Codable {
    let success: Bool
    let message: String?
    let data: ReprogramData?
    let error: String?
}

struct ReprogramData: Codable {
    let orderId: Int
    let newScheduledDate: String
    let newTimeSlot: String
}

func reprogramOrder(id: Int, newDate: String, newTimeSlot: String) async throws -> ReprogramData {
    let url = URL(string: "https://logirapid.com/api/package-orders/\\(id)/reprogram")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body = ReprogramRequest(newScheduledDate: newDate, newTimeSlot: newTimeSlot)
    request.httpBody = try JSONEncoder().encode(body)

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(ReprogramResponse.self, from: data)

    guard response.success, let reprogramData = response.data else {
        throw NSError(domain: "", code: -1, userInfo: [NSLocalizedDescriptionKey: response.error ?? "Error"])
    }

    return reprogramData
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class ReprogramRequest(
    val newScheduledDate: String,
    val newTimeSlot: String
)

data class ReprogramResponse(
    val success: Boolean,
    val message: String?,
    val data: ReprogramData?,
    val error: String?
)

data class ReprogramData(
    val orderId: Int,
    val newScheduledDate: String,
    val newTimeSlot: String
)

interface PackageOrdersApi {
    @POST("api/package-orders/{id}/reprogram")
    suspend fun reprogramOrder(
        @Header("Authorization") token: String,
        @Path("id") orderId: Int,
        @Body request: ReprogramRequest
    ): ReprogramResponse
}

// Uso con selector de fecha
fun showReprogramDialog(orderId: Int) {
    DatePickerDialog(context).apply {
        setOnDateSetListener { _, year, month, day ->
            val newDate = "\$year-\${month + 1}-\$day"
            showTimeSlotPicker { timeSlot ->
                viewModelScope.launch {
                    val result = api.reprogramOrder(
                        token = "Bearer \$authToken",
                        orderId = orderId,
                        request = ReprogramRequest(newDate, timeSlot)
                    )
                    if (result.success) {
                        showSnackbar("Orden reprogramada")
                    }
                }
            }
        }
    }.show()
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> reprogramOrder(
  int orderId,
  String newDate,
  String newTimeSlot,
) async {
  final response = await http.post(
    Uri.parse('https://logirapid.com/api/package-orders/\$orderId/reprogram'),
    headers: {
      'Authorization': 'Bearer \$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'newScheduledDate': newDate,
      'newTimeSlot': newTimeSlot,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return data['data'];
  }

  throw Exception(data['error']);
}

// Widget con selectores de fecha y hora
class ReprogramDialog extends StatefulWidget {
  final int orderId;

  @override
  _ReprogramDialogState createState() => _ReprogramDialogState();
}

class _ReprogramDialogState extends State<ReprogramDialog> {
  DateTime? selectedDate;
  String? selectedTimeSlot;

  final timeSlots = [
    '9:00 AM - 12:00 PM',
    '12:00 PM - 3:00 PM',
    '3:00 PM - 6:00 PM',
  ];

  Future<void> submit() async {
    if (selectedDate == null || selectedTimeSlot == null) return;

    final dateStr = DateFormat('yyyy-MM-dd').format(selectedDate!);

    try {
      await reprogramOrder(widget.orderId, dateStr, selectedTimeSlot!);
      Navigator.pop(context, true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: \$e')),
      );
    }
  }
}`
      }
    ]
  }
]

// Order types documentation
export const orderTypes = [
  { type: 'recogida', prefix: 'PICKUP', description: 'Recogida a domicilio del cliente' },
  { type: 'oficina', prefix: 'OFF', description: 'Recepcion en oficina/almacen' },
  { type: 'entrega', prefix: 'DEL', description: 'Entrega de paquetes al cliente' },
  { type: 'entrega_empaques', prefix: 'DEL', description: 'Entrega de empaques vacios' },
  { type: 'retorno', prefix: 'RET', description: 'Retorno de empaques al almacen' }
]

// Order statuses
export const orderStatuses = [
  { status: 'pending', label: 'Pendiente', description: 'Orden creada, esperando asignacion' },
  { status: 'reprogrammed', label: 'Reprogramado', description: 'Orden reprogramada para nueva fecha' },
  { status: 'in_route', label: 'En Ruta', description: 'Asignada a una ruta activa' },
  { status: 'in_transit', label: 'En Transito', description: 'En camino al destino' },
  { status: 'picked_up', label: 'Recogido', description: 'Paquetes recogidos del cliente' },
  { status: 'delivered', label: 'Entregado', description: 'Paquetes entregados al destino' },
  { status: 'completed', label: 'Completado', description: 'Orden finalizada completamente' },
  { status: 'cancelled', label: 'Cancelado', description: 'Orden cancelada' }
]
