// Driver App API Documentation Data
import { Endpoint, Parameter, CodeExample, ResponseExample } from './auth-api'

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

// Driver App endpoints documentation
export const driverAppEndpoints: Endpoint[] = [
  {
    id: 'driver-dashboard',
    method: 'GET',
    path: '/api/driver-app/dashboard',
    title: 'Dashboard del Driver',
    description: 'Obtiene el dashboard del driver con estadísticas, inventario actual y ruta activa. Requiere autenticación con rol DRIVER.',
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
        description: 'Dashboard obtenido exitosamente',
        body: `{
  "success": true,
  "data": {
    "driver": {
      "id": 123,
      "firstName": "Juan",
      "lastName": "Pérez",
      "email": "driver@example.com",
      "phone": "+1234567890",
      "companyId": 1,
      "companyName": "LogiRapid Express"
    },
    "inventory": {
      "cajasVacias": 15,
      "cajasVaciasCapacity": 50,
      "bultos": 8,
      "bultosCapacity": 100
    },
    "rutaActiva": {
      "id": 456,
      "routeNumber": "R-2024-001",
      "status": "active",
      "totalStops": 12,
      "completedStops": 5,
      "distance": 45.5,
      "duration": 120,
      "scheduledDate": "2024-01-15"
    },
    "estadisticas": {
      "entregasHoy": 5,
      "entregasSemana": 25,
      "pendientes": 7
    }
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{
  "success": false,
  "error": "No autenticado"
}`
      },
      {
        status: 403,
        description: 'Acceso denegado (no es driver)',
        body: `{
  "success": false,
  "error": "Acceso denegado. Solo drivers pueden acceder."
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/dashboard' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/driver-app/dashboard', {
  method: 'GET',
  credentials: 'include' // Incluir cookies
});

const data = await response.json();

if (data.success) {
  console.log('Driver:', data.data.driver.firstName);
  console.log('Cajas vacías:', data.data.inventory.cajasVacias);
  console.log('Bultos:', data.data.inventory.bultos);

  if (data.data.rutaActiva) {
    console.log('Ruta activa:', data.data.rutaActiva.routeNumber);
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<DriverDashboard> getDashboard() async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/driver-app/dashboard'),
    headers: {
      'Cookie': 'auth-token=\$token',
    },
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return DriverDashboard.fromJson(data['data']);
  }

  throw Exception(data['error']);
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class DriverDashboard(
    val driver: DriverInfo,
    val inventory: Inventory,
    val rutaActiva: ActiveRoute?,
    val estadisticas: Stats
)

interface DriverApi {
    @GET("api/driver-app/dashboard")
    suspend fun getDashboard(
        @Header("Cookie") authToken: String
    ): Response<DashboardResponse>
}

// Uso
val response = driverApi.getDashboard("auth-token=\$token")
if (response.isSuccessful) {
    val dashboard = response.body()?.data
    println("Cajas vacías: \${dashboard?.inventory?.cajasVacias}")
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct DashboardResponse: Codable {
    let success: Bool
    let data: DriverDashboard?
}

struct DriverDashboard: Codable {
    let driver: DriverInfo
    let inventory: Inventory
    let rutaActiva: ActiveRoute?
    let estadisticas: Stats
}

func getDashboard() async throws -> DriverDashboard {
    var request = URLRequest(url: URL(string: "https://logirapid.com/api/driver-app/dashboard")!)
    request.setValue("auth-token=\\(token)", forHTTPHeaderField: "Cookie")

    let (data, _) = try await URLSession.shared.data(for: request)
    let response = try JSONDecoder().decode(DashboardResponse.self, from: data)

    guard let dashboard = response.data else {
        throw APIError.invalidResponse
    }

    return dashboard
}`
      }
    ]
  },
  {
    id: 'driver-receive-box',
    method: 'POST',
    path: '/api/driver-app/receive-box',
    title: 'Recibir Caja Vacía',
    description: 'Asigna una caja vacía al driver. Valida que el empaque exista, esté disponible y que el driver tenga capacidad. Registra la acción en trazabilidad.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      },
      {
        name: 'Content-Type',
        type: 'string',
        required: true,
        description: 'application/json'
      }
    ],
    requestBody: [
      {
        name: 'codigo',
        type: 'string',
        required: true,
        description: 'Código único del empaque a recibir'
      },
      {
        name: 'warehouseId',
        type: 'number',
        required: false,
        description: 'ID del almacén donde se recibe (opcional)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Caja recibida exitosamente',
        body: `{
  "success": true,
  "message": "Caja recibida exitosamente",
  "data": {
    "empaque": {
      "id": 1,
      "codigo": "BOX-001-2024",
      "tipo": "CAJA",
      "estado": "en_reparto",
      "packageSizeName": "Mediano"
    },
    "inventarioActualizado": {
      "cajasVacias": 16,
      "bultos": 8
    }
  }
}`
      },
      {
        status: 400,
        description: 'Validación fallida',
        body: `{
  "success": false,
  "error": "El empaque no está disponible. Estado actual: asignado"
}`
      },
      {
        status: 404,
        description: 'Empaque no encontrado',
        body: `{
  "success": false,
  "error": "Empaque no encontrado"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST 'https://logirapid.com/api/driver-app/receive-box' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "codigo": "BOX-001-2024",
    "warehouseId": 1
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function receiveBox(codigo, warehouseId) {
  const response = await fetch('/api/driver-app/receive-box', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ codigo, warehouseId })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Caja recibida:', data.data.empaque.codigo);
    console.log('Nuevo inventario:', data.data.inventarioActualizado);
    return data.data;
  }

  throw new Error(data.error);
}

// Uso con scanner QR
async function onQRScanned(qrCode) {
  try {
    const result = await receiveBox(qrCode, currentWarehouseId);
    showSuccessMessage(\`Caja \${result.empaque.codigo} recibida\`);
  } catch (error) {
    showErrorMessage(error.message);
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> receiveBox(String codigo, {int? warehouseId}) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/receive-box'),
    headers: {
      'Cookie': 'auth-token=\$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'codigo': codigo,
      if (warehouseId != null) 'warehouseId': warehouseId,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    // Actualizar estado local
    _updateLocalInventory(data['data']['inventarioActualizado']);
    return data['data'];
  }

  throw Exception(data['error']);
}

// Widget de scanner
class QRScannerWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return QRView(
      onQRViewCreated: (controller) {
        controller.scannedDataStream.listen((scanData) async {
          try {
            final result = await receiveBox(scanData.code!);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Caja recibida: \${result['empaque']['codigo']}')),
            );
          } catch (e) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Error: \$e'), backgroundColor: Colors.red),
            );
          }
        });
      },
    );
  }
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class ReceiveBoxRequest(
    val codigo: String,
    val warehouseId: Int? = null
)

data class ReceiveBoxResponse(
    val success: Boolean,
    val message: String?,
    val data: ReceiveBoxData?,
    val error: String?
)

interface DriverApi {
    @POST("api/driver-app/receive-box")
    suspend fun receiveBox(
        @Header("Cookie") authToken: String,
        @Body request: ReceiveBoxRequest
    ): Response<ReceiveBoxResponse>
}

// Uso
suspend fun onQRScanned(codigo: String) {
    try {
        val response = driverApi.receiveBox(
            authToken = "auth-token=\$token",
            request = ReceiveBoxRequest(codigo = codigo)
        )

        if (response.isSuccessful && response.body()?.success == true) {
            val empaque = response.body()?.data?.empaque
            showSuccess("Caja recibida: \${empaque?.codigo}")
        } else {
            showError(response.body()?.error ?: "Error desconocido")
        }
    } catch (e: Exception) {
        showError("Error de conexión: \${e.message}")
    }
}`
      }
    ]
  },
  {
    id: 'driver-receive-package',
    method: 'POST',
    path: '/api/driver-app/receive-package',
    title: 'Recibir Bulto (Paquete con Contenido)',
    description: 'Asigna un bulto (empaque con orden) al driver para reparto. Valida que el empaque tenga orden asignada y esté en estado válido para reparto.',
    headers: [
      {
        name: 'Cookie',
        type: 'string',
        required: true,
        description: 'Token de autenticación: auth-token=<token>'
      },
      {
        name: 'Content-Type',
        type: 'string',
        required: true,
        description: 'application/json'
      }
    ],
    requestBody: [
      {
        name: 'codigo',
        type: 'string',
        required: true,
        description: 'Código único del empaque a recibir'
      },
      {
        name: 'warehouseId',
        type: 'number',
        required: false,
        description: 'ID del almacén donde se recibe (opcional)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Bulto recibido exitosamente',
        body: `{
  "success": true,
  "message": "Bulto recibido exitosamente",
  "data": {
    "empaque": {
      "id": 2,
      "codigo": "PKG-001-2024",
      "tipo": "BULTO",
      "estado": "en_reparto",
      "orderNumber": "ORD-2024-123",
      "serviceName": "Envío Express",
      "recipientName": "María García",
      "recipientCity": "Miami",
      "recipientState": "FL",
      "weightLb": 5.5,
      "weightKg": 2.5,
      "boxNumber": 1,
      "totalBoxes": 2,
      "packageSizeName": "Grande"
    },
    "inventarioActualizado": {
      "cajasVacias": 16,
      "bultos": 9
    }
  }
}`
      },
      {
        status: 400,
        description: 'Empaque sin orden (usar receive-box)',
        body: `{
  "success": false,
  "error": "Este empaque no tiene orden asignada. Use 'Recibir Caja Vacía' en su lugar."
}`
      },
      {
        status: 400,
        description: 'Estado inválido para reparto',
        body: `{
  "success": false,
  "error": "El bulto no está listo para reparto. Estado actual: disponible"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST 'https://logirapid.com/api/driver-app/receive-package' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "codigo": "PKG-001-2024",
    "warehouseId": 1
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function receivePackage(codigo, warehouseId) {
  const response = await fetch('/api/driver-app/receive-package', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ codigo, warehouseId })
  });

  const data = await response.json();

  if (data.success) {
    const { empaque } = data.data;
    console.log('Bulto recibido:', empaque.codigo);
    console.log('Orden:', empaque.orderNumber);
    console.log('Destinatario:', empaque.recipientName);
    console.log('Ciudad:', empaque.recipientCity);
    return data.data;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> receivePackage(String codigo, {int? warehouseId}) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/receive-package'),
    headers: {
      'Cookie': 'auth-token=\$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'codigo': codigo,
      if (warehouseId != null) 'warehouseId': warehouseId,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    final empaque = data['data']['empaque'];

    // Mostrar información del destinatario
    showDeliveryInfo(
      recipientName: empaque['recipientName'],
      city: empaque['recipientCity'],
      orderNumber: empaque['orderNumber'],
    );

    return data['data'];
  }

  throw Exception(data['error']);
}`
      }
    ]
  },
  {
    id: 'driver-packages',
    method: 'GET',
    path: '/api/driver-app/packages',
    title: 'Lista de Bultos Asignados',
    description: 'Obtiene los bultos (paquetes con contenido) asignados al driver. Soporta paginación, filtro por estado y búsqueda.',
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
        name: 'page',
        type: 'number',
        required: false,
        description: 'Página actual (default: 1)',
        default: '1'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Resultados por página (default: 50)',
        default: '50'
      },
      {
        name: 'status',
        type: 'string',
        required: false,
        description: 'Filtrar por estado: en_reparto, entregado, all'
      },
      {
        name: 'search',
        type: 'string',
        required: false,
        description: 'Búsqueda por código, orden o destinatario'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de bultos',
        body: `{
  "success": true,
  "data": {
    "bultos": [
      {
        "id": 2,
        "codigo": "PKG-001-2024",
        "tipo": "BULTO",
        "estado": "en_reparto",
        "packageSizeName": "Grande",
        "orderNumber": "ORD-2024-123",
        "serviceName": "Envío Express",
        "recipientName": "María García",
        "recipientCity": "Miami",
        "recipientState": "FL",
        "weightLb": 5.5,
        "boxNumber": 1,
        "totalBoxes": 2,
        "assignedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "agrupados": [
      {
        "orderNumber": "ORD-2024-123",
        "recipientName": "María García",
        "recipientCity": "Miami",
        "totalBoxes": 2,
        "bultos": [...]
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 8,
    "totalPages": 1
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Todos los bultos activos
curl -X GET 'https://logirapid.com/api/driver-app/packages' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Solo en reparto
curl -X GET 'https://logirapid.com/api/driver-app/packages?status=en_reparto' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Buscar por destinatario
curl -X GET 'https://logirapid.com/api/driver-app/packages?search=García' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function getPackages(options = {}) {
  const { page = 1, limit = 50, status, search } = options;

  const params = new URLSearchParams({ page, limit });
  if (status) params.append('status', status);
  if (search) params.append('search', search);

  const response = await fetch(\`/api/driver-app/packages?\${params}\`, {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    // Mostrar agrupados por orden
    data.data.agrupados.forEach(group => {
      console.log(\`Orden: \${group.orderNumber}\`);
      console.log(\`Destinatario: \${group.recipientName}\`);
      console.log(\`Bultos: \${group.bultos.length}/\${group.totalBoxes}\`);
    });

    return data.data;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<PackagesResponse> getPackages({
  int page = 1,
  int limit = 50,
  String? status,
  String? search,
}) async {
  final token = await secureStorage.read(key: 'auth-token');

  final queryParams = {
    'page': page.toString(),
    'limit': limit.toString(),
    if (status != null) 'status': status,
    if (search != null) 'search': search,
  };

  final uri = Uri.parse('https://logirapid.com/api/driver-app/packages')
      .replace(queryParameters: queryParams);

  final response = await http.get(
    uri,
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);
  return PackagesResponse.fromJson(data);
}

// Widget de lista de bultos
class PackagesListView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: getPackages(status: 'en_reparto'),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return CircularProgressIndicator();

        final agrupados = snapshot.data!.data.agrupados;

        return ListView.builder(
          itemCount: agrupados.length,
          itemBuilder: (context, index) {
            final group = agrupados[index];
            return ExpansionTile(
              title: Text(group.recipientName),
              subtitle: Text('Orden: \${group.orderNumber}'),
              trailing: Text('\${group.bultos.length}/\${group.totalBoxes}'),
              children: group.bultos.map((bulto) =>
                ListTile(
                  leading: Icon(Icons.inventory_2),
                  title: Text(bulto.codigo),
                  subtitle: Text('\${bulto.weightLb} lb'),
                )
              ).toList(),
            );
          },
        );
      },
    );
  }
}`
      }
    ]
  },
  {
    id: 'driver-empty-boxes',
    method: 'GET',
    path: '/api/driver-app/empty-boxes',
    title: 'Lista de Cajas Vacías',
    description: 'Obtiene las cajas vacías asignadas al driver. Incluye resumen por tamaño.',
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
        name: 'page',
        type: 'number',
        required: false,
        description: 'Página actual (default: 1)',
        default: '1'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Resultados por página (default: 50)',
        default: '50'
      },
      {
        name: 'tamano',
        type: 'number',
        required: false,
        description: 'Filtrar por ID de tamaño de empaque'
      },
      {
        name: 'search',
        type: 'string',
        required: false,
        description: 'Búsqueda por código'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de cajas vacías',
        body: `{
  "success": true,
  "data": {
    "cajasVacias": [
      {
        "id": 1,
        "codigo": "BOX-001-2024",
        "tipo": "CAJA",
        "estado": "en_reparto",
        "packageSizeId": 2,
        "packageSizeName": "Mediano",
        "dimensions": "30x25x20",
        "maxWeightLb": 25,
        "warehouseName": "Almacén Principal",
        "assignedAt": "2024-01-15T09:00:00Z"
      }
    ],
    "resumenPorTamano": [
      { "sizeId": 1, "sizeName": "Pequeño", "dimensions": "20x15x10", "count": 5 },
      { "sizeId": 2, "sizeName": "Mediano", "dimensions": "30x25x20", "count": 8 },
      { "sizeId": 3, "sizeName": "Grande", "dimensions": "40x30x30", "count": 2 }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "totalPages": 1
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/empty-boxes' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function getEmptyBoxes(options = {}) {
  const { page = 1, limit = 50, tamano, search } = options;

  const params = new URLSearchParams({ page, limit });
  if (tamano) params.append('tamano', tamano);
  if (search) params.append('search', search);

  const response = await fetch(\`/api/driver-app/empty-boxes?\${params}\`, {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    // Mostrar resumen por tamaño
    console.log('Resumen de cajas:');
    data.data.resumenPorTamano.forEach(size => {
      console.log(\`  \${size.sizeName}: \${size.count} cajas\`);
    });

    return data.data;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `// Widget de resumen de cajas vacías
class EmptyBoxesSummary extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: getEmptyBoxes(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return CircularProgressIndicator();

        final resumen = snapshot.data!.data.resumenPorTamano;

        return Column(
          children: [
            Text('Cajas Vacías', style: Theme.of(context).textTheme.headline6),
            SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: resumen.map((size) => Column(
                children: [
                  Text(size.count.toString(),
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  Text(size.sizeName),
                  Text(size.dimensions, style: TextStyle(color: Colors.grey)),
                ],
              )).toList(),
            ),
          ],
        );
      },
    );
  }
}`
      }
    ]
  }
]
