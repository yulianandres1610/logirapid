// Tracker API Documentation Data
import { Endpoint, Parameter, CodeExample, ResponseExample } from './auth-api'

export const trackerEndpoints: Endpoint[] = [
  {
    id: 'tracker-search',
    method: 'GET',
    path: '/api/tracker',
    title: 'Buscar Ordenes y Empaques',
    description: 'Endpoint unificado para buscar ordenes de paqueteria y empaques. Soporta busqueda por numero de orden, telefono, codigo de empaque o nombre de cliente. El tipo de busqueda se auto-detecta basado en el formato del termino.',
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
        name: 'q',
        type: 'string',
        required: true,
        description: 'Termino de busqueda. Puede ser numero de orden (ORD, PKG, RET, DEL, OFF, PICKUP), codigo de empaque (EMP-, BOX-), telefono o nombre de cliente.'
      },
      {
        name: 'type',
        type: 'string',
        required: false,
        description: 'Tipo de busqueda. Valores: auto (default), order, phone, empaque, customer. Si es "auto", el sistema detecta automaticamente el tipo basado en el formato del termino.',
        default: 'auto'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Resultado de busqueda exitoso',
        body: `{
  "success": true,
  "data": {
    "order": {
      "id": 123,
      "orderNumber": "PICKUP00042",
      "orderType": "recogida",
      "status": "pending",
      "customerName": "Juan Perez",
      "firstName": "Juan",
      "lastName": "Perez",
      "phone": "+1 305 555 1234",
      "email": "juan@email.com",
      "street": "123 Main Street",
      "apartment": "Apt 4B",
      "city": "Miami",
      "state": "FL",
      "zipcode": "33101",
      "country": "USA",
      "services": [
        {"type": "pickup", "name": "Recogida Estandar", "price": 15.00, "quantity": 1}
      ],
      "subtotal": 15.00,
      "taxAmount": 1.05,
      "totalAmount": 16.05,
      "boxCount": 2,
      "scheduledDate": "2024-03-25",
      "timeSlot": "9:00 AM - 12:00 PM",
      "warehouseName": "Almacen Principal",
      "latitude": 25.7617,
      "longitude": -80.1918,
      "notes": "Tocar timbre 2 veces",
      "createdAt": "2024-03-20T10:30:00Z",
      "updatedAt": "2024-03-20T10:30:00Z",
      "createdBy": "admin@empresa.com",
      "companyId": 5,
      "companyName": "Mi Empresa Logistica"
    },
    "customer": {
      "id": 456,
      "firstName": "Juan",
      "lastName": "Perez",
      "phone": "+1 305 555 1234",
      "email": "juan@email.com"
    },
    "empaques": [
      {
        "id": 789,
        "codigo": "EMP-2024-00123",
        "tipo": "caja",
        "boxType": "15x15x15",
        "estado": "asignado",
        "deliveredAt": null,
        "returnedAt": null,
        "warehouseName": "Almacen Principal",
        "driverName": "Carlos Rodriguez",
        "recipientName": null
      }
    ],
    "timeline": [
      {
        "action": "Orden Creada",
        "date": "2024-03-20T10:30:00Z",
        "user": "Maria Admin",
        "notes": "Tipo: Recogida",
        "location": null
      }
    ]
  },
  "searchType": "order"
}`
      },
      {
        status: 200,
        description: 'Sin resultados',
        body: `{
  "success": true,
  "data": null,
  "message": "No se encontraron resultados para la busqueda"
}`
      },
      {
        status: 400,
        description: 'Termino de busqueda requerido',
        body: `{
  "success": false,
  "error": "Se requiere un termino de busqueda"
}`
      },
      {
        status: 500,
        description: 'Error del servidor',
        body: `{
  "success": false,
  "error": "Error al buscar. Intente de nuevo."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Busqueda por numero de orden
curl -X GET "https://logirapid.com/api/tracker?q=PICKUP00042" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Busqueda por telefono
curl -X GET "https://logirapid.com/api/tracker?q=3055551234" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Busqueda por empaque
curl -X GET "https://logirapid.com/api/tracker?q=EMP-2024-00123" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Busqueda por nombre de cliente
curl -X GET "https://logirapid.com/api/tracker?q=Juan%20Perez" \\
  -H "Authorization: Bearer YOUR_TOKEN"

# Busqueda con tipo especifico
curl -X GET "https://logirapid.com/api/tracker?q=Juan&type=customer" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Funcion de busqueda en el tracker
async function searchTracker(query, type = 'auto') {
  const params = new URLSearchParams({ q: query });
  if (type !== 'auto') {
    params.append('type', type);
  }

  const response = await fetch(\`/api/tracker?\${params}\`, {
    method: 'GET',
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });

  const data = await response.json();

  if (data.success && data.data) {
    console.log('Orden encontrada:', data.data.order);
    console.log('Empaques:', data.data.empaques);
    console.log('Historial:', data.data.timeline);
    console.log('Tipo de busqueda:', data.searchType);
  } else {
    console.log('Sin resultados');
  }

  return data;
}

// Ejemplos de uso
await searchTracker('PICKUP00042');           // Por orden
await searchTracker('305-555-1234', 'phone'); // Por telefono
await searchTracker('EMP-2024-00123');        // Por empaque
await searchTracker('Juan Perez');            // Por cliente`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `import Foundation

struct TrackerResponse: Codable {
    let success: Bool
    let data: TrackerData?
    let searchType: String?
    let message: String?
}

struct TrackerData: Codable {
    let order: Order?
    let customer: Customer?
    let empaques: [Empaque]
    let timeline: [TimelineEvent]
}

class TrackerService {
    private let baseURL = "https://logirapid.com/api"
    private let token: String

    init(token: String) {
        self.token = token
    }

    func search(query: String, type: String = "auto") async throws -> TrackerResponse {
        var components = URLComponents(string: "\\(baseURL)/tracker")!
        components.queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "type", value: type)
        ]

        var request = URLRequest(url: components.url!)
        request.httpMethod = "GET"
        request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(TrackerResponse.self, from: data)
    }
}

// Uso
let tracker = TrackerService(token: authToken)
let result = try await tracker.search(query: "PICKUP00042")`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query

data class TrackerResponse(
    val success: Boolean,
    val data: TrackerData?,
    val searchType: String?,
    val message: String?
)

data class TrackerData(
    val order: Order?,
    val customer: Customer?,
    val empaques: List<Empaque>,
    val timeline: List<TimelineEvent>
)

interface TrackerApi {
    @GET("api/tracker")
    suspend fun search(
        @Header("Authorization") token: String,
        @Query("q") query: String,
        @Query("type") type: String = "auto"
    ): TrackerResponse
}

// Uso
class TrackerRepository(private val api: TrackerApi) {
    suspend fun searchOrder(query: String): TrackerResponse {
        return api.search(
            token = "Bearer \$authToken",
            query = query
        )
    }

    suspend fun searchByPhone(phone: String): TrackerResponse {
        return api.search(
            token = "Bearer \$authToken",
            query = phone,
            type = "phone"
        )
    }
}

// En el ViewModel
viewModelScope.launch {
    val result = trackerRepository.searchOrder("PICKUP00042")
    if (result.success && result.data != null) {
        _orderState.value = result.data.order
        _empaquesState.value = result.data.empaques
    }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `import 'package:http/http.dart' as http;
import 'dart:convert';

class TrackerService {
  final String baseUrl = 'https://logirapid.com/api';
  final String token;

  TrackerService({required this.token});

  Future<Map<String, dynamic>> search({
    required String query,
    String type = 'auto',
  }) async {
    final uri = Uri.parse('\$baseUrl/tracker').replace(
      queryParameters: {
        'q': query,
        'type': type,
      },
    );

    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer \$token',
      },
    );

    return jsonDecode(response.body);
  }

  // Busqueda por orden
  Future<Map<String, dynamic>> searchByOrder(String orderNumber) {
    return search(query: orderNumber, type: 'order');
  }

  // Busqueda por telefono
  Future<Map<String, dynamic>> searchByPhone(String phone) {
    return search(query: phone, type: 'phone');
  }

  // Busqueda por empaque
  Future<Map<String, dynamic>> searchByEmpaque(String codigo) {
    return search(query: codigo, type: 'empaque');
  }

  // Busqueda por cliente
  Future<Map<String, dynamic>> searchByCustomer(String name) {
    return search(query: name, type: 'customer');
  }
}

// Uso en un Widget
class TrackerScreen extends StatefulWidget {
  @override
  _TrackerScreenState createState() => _TrackerScreenState();
}

class _TrackerScreenState extends State<TrackerScreen> {
  final tracker = TrackerService(token: authToken);
  Map<String, dynamic>? result;

  Future<void> handleSearch(String query) async {
    final response = await tracker.search(query: query);

    if (response['success'] && response['data'] != null) {
      setState(() {
        result = response['data'];
      });
    }
  }
}`
      }
    ]
  }
]

// Auto-detection patterns documentation
export const searchTypePatterns = [
  {
    type: 'order',
    patterns: ['ORD', 'PKG', 'RET', 'DEL', 'OFF', 'PICKUP'],
    description: 'Numeros de orden que comienzan con estos prefijos',
    example: 'PICKUP00042, ORD123, PKG456'
  },
  {
    type: 'empaque',
    patterns: ['EMP-', 'BOX-'],
    description: 'Codigos de empaque con estos prefijos',
    example: 'EMP-2024-00123, BOX-001'
  },
  {
    type: 'phone',
    patterns: ['Numeros de 7+ digitos'],
    description: 'Numeros telefonicos con o sin formato',
    example: '3055551234, +1 305 555 1234'
  },
  {
    type: 'customer',
    patterns: ['Cualquier texto'],
    description: 'Busqueda por nombre si no coincide con otros patrones',
    example: 'Juan Perez, Maria'
  }
]
