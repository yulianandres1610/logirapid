// Driver API Documentation Data
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

// Driver API endpoints documentation
export const driverEndpoints: Endpoint[] = [
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
  },
  // ==================== RUTAS DEL USUARIO ====================
  {
    id: 'driver-routes',
    method: 'GET',
    path: '/api/driver-app/routes',
    title: 'Rutas Asignadas al Usuario',
    description: 'Obtiene todas las rutas asignadas al usuario logueado. Cualquier rol puede ver sus propias rutas. ADMIN/SUPER_ADMIN/MANAGER pueden ver rutas de otros usuarios pasando el userId.',
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
        name: 'userId',
        type: 'number',
        required: false,
        description: 'ID del usuario (opcional). Si no se especifica, usa el usuario del token. Solo ADMIN/SUPER_ADMIN/MANAGER pueden ver rutas de otros usuarios.'
      },
      {
        name: 'status',
        type: 'string',
        required: false,
        description: 'Filtrar por estado: active, completed, all (default: active)'
      },
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
        description: 'Resultados por página (default: 20)',
        default: '20'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de rutas con información completa',
        body: `{
  "success": true,
  "data": {
    "routes": [
      {
        "id": 21,
        "routeCode": "RUT-2025-0021",
        "routeNumber": "RUT-2025-0021",
        "qrCode": null,
        "status": "asignada",
        "totalStops": 1,
        "completedStops": 0,
        "pendingStops": 1,
        "failedStops": 0,
        "distance": {
          "value": 22.66,
          "unit": "miles",
          "formatted": "22.66 mi"
        },
        "estimatedDuration": {
          "minutes": 43,
          "formatted": "43 min"
        },
        "actualDuration": null,
        "origin": {
          "name": "HolaPacks 9550",
          "address": "9550 Northwest 79th Avenue",
          "city": "Hialeah Gardens",
          "state": "FL",
          "fullAddress": "9550 Northwest 79th Avenue, Hialeah Gardens, FL",
          "coordinates": {
            "latitude": 25.861064,
            "longitude": -80.325922
          }
        },
        "destination": {
          "address": "3231 Southwest 95th Court, Miami, FL 33165, us",
          "coordinates": {
            "latitude": 25.739415,
            "longitude": -80.34985
          },
          "orderNumbers": ["PICKUP00003"]
        },
        "vehiclePlate": "HONDA987654321XYZ",
        "vehicleId": "v_1764186168951_1k6np0d7y",
        "totalPackages": 1,
        "deliveredPackages": 0,
        "scheduledDate": "2025-11-30T05:00:00.000Z",
        "startTime": "2025-11-30T18:00:00.000Z",
        "endTime": null,
        "createdAt": "2025-12-01T01:33:56.100Z",
        "stops": [
          {
            "stopNumber": 1,
            "sequence": 1,
            "status": "pending",
            "address": "3231 Southwest 95th Court, Miami, FL 33165, us",
            "coordinates": {
              "latitude": 25.739415,
              "longitude": -80.34985
            },
            "type": "recogida",
            "timeSlot": "8:00 AM - 12:00 PM",
            "totalOrders": 1,
            "completedOrders": 0,
            "pendingOrders": 1,
            "failedOrders": 0,
            "orderNumbers": ["PICKUP00003"],
            "orders": [
              {
                "id": 95,
                "orderNumber": "PICKUP00003",
                "status": "en_ruta",
                "orderType": "recogida",
                "customer": {
                  "id": 21,
                  "name": "Dulce Maria Fernandez",
                  "firstName": "Dulce Maria",
                  "lastName": "Fernandez",
                  "phone": "7867245377",
                  "email": null
                },
                "address": {
                  "full": "3231 Southwest 95th Court, Miami, FL 33165, us",
                  "street": "3231 Southwest 95th Court",
                  "apartment": null,
                  "city": "Miami",
                  "state": "FL",
                  "zipCode": "33165",
                  "country": "us",
                  "coordinates": {
                    "latitude": 25.739415,
                    "longitude": -80.34985
                  }
                },
                "receiver": {
                  "name": "Marta Castaneda Reyes",
                  "phone": "54934188",
                  "address": "Calle 10 Nro 15 A Entre Calle A y B..."
                },
                "delivery": {
                  "scheduledDate": "2025-11-29T05:00:00.000Z",
                  "timeSlot": "8:00 AM - 12:00 PM",
                  "notes": "Orden de recogida creada desde wizard",
                  "customerNotes": null
                },
                "packages": {
                  "boxCount": 0,
                  "boxes": [],
                  "boxesDelivered": 0,
                  "boxesReturned": 0,
                  "pendingReturn": false,
                  "returnStatus": "none"
                },
                "services": ["Entrega de Cajas 15x15x15"],
                "proofStatus": "none",
                "deliveredAt": null
              }
            ]
          }
        ]
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Rutas activas del usuario logueado
curl -X GET 'https://logirapid.com/api/driver-app/routes' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Todas las rutas
curl -X GET 'https://logirapid.com/api/driver-app/routes?status=all' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Rutas de un usuario específico (requiere rol ADMIN/MANAGER)
curl -X GET 'https://logirapid.com/api/driver-app/routes?userId=42' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Obtener rutas del usuario logueado
async function getUserRoutes(status = 'active', userId = null) {
  let url = \`/api/driver-app/routes?status=\${status}\`;
  if (userId) {
    url += \`&userId=\${userId}\`;
  }

  const response = await fetch(url, {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    data.data.routes.forEach(route => {
      console.log(\`Ruta: \${route.routeNumber}\`);
      console.log(\`Paradas: \${route.completedStops}/\${route.totalStops}\`);
      console.log(\`Estado: \${route.status}\`);
    });
    return data.data.routes;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<List<Route>> getUserRoutes({
  String status = 'active',
  int? userId,
}) async {
  final token = await secureStorage.read(key: 'auth-token');

  String url = 'https://logirapid.com/api/driver-app/routes?status=\$status';
  if (userId != null) {
    url += '&userId=\$userId';
  }

  final response = await http.get(
    Uri.parse(url),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return (data['data']['routes'] as List)
        .map((r) => Route.fromJson(r))
        .toList();
  }

  throw Exception(data['error']);
}`
      }
    ]
  },
  {
    id: 'driver-routes-assign',
    method: 'POST',
    path: '/api/driver-app/routes/assign',
    title: 'Asignar Ruta a Usuario',
    description: 'Asigna una ruta a un usuario mediante código QR. Cualquier usuario puede asignarse a sí mismo. ADMIN/SUPER_ADMIN/MANAGER pueden asignar rutas a otros usuarios pasando el userId.',
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
        name: 'routeCode',
        type: 'string',
        required: true,
        description: 'Código QR de la ruta (formato: RT-XXXXXXXX) o número de ruta'
      },
      {
        name: 'userId',
        type: 'number',
        required: false,
        description: 'ID del usuario a asignar (opcional). Si no se especifica, asigna al usuario del token. Solo ADMIN/SUPER_ADMIN/MANAGER pueden asignar a otros usuarios.'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Ruta asignada exitosamente',
        body: `{
  "success": true,
  "message": "Ruta asignada exitosamente",
  "data": {
    "route": {
      "id": 123,
      "routeNumber": "R-2024-001",
      "qrCode": "RT-ABCD1234EFGH5678",
      "status": "active",
      "totalStops": 12,
      "distance": 45.5,
      "duration": 120,
      "scheduledDate": "2024-01-15",
      "vehiclePlate": "ABC-123",
      "assignedUserName": "Juan Pérez",
      "assignedUserId": 42
    }
  }
}`
      },
      {
        status: 400,
        description: 'Ruta ya asignada a otro usuario',
        body: `{
  "success": false,
  "error": "Esta ruta ya está asignada a otro usuario: María García"
}`
      },
      {
        status: 403,
        description: 'Sin permisos para asignar a otros',
        body: `{
  "success": false,
  "error": "No tienes permisos para asignar rutas a otros usuarios"
}`
      },
      {
        status: 404,
        description: 'Ruta no encontrada',
        body: `{
  "success": false,
  "error": "Ruta no encontrada con el código proporcionado"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Auto-asignarse una ruta
curl -X POST 'https://logirapid.com/api/driver-app/routes/assign' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "routeCode": "RT-ABCD1234EFGH5678"
  }'

# Asignar ruta a otro usuario (requiere rol ADMIN/MANAGER)
curl -X POST 'https://logirapid.com/api/driver-app/routes/assign' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "routeCode": "RT-ABCD1234EFGH5678",
    "userId": 42
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Asignar ruta a un usuario
async function assignRoute(routeCode, userId = null) {
  const body = { routeCode };
  if (userId) {
    body.userId = userId;
  }

  const response = await fetch('/api/driver-app/routes/assign', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.success) {
    console.log('Ruta asignada:', data.data.route.routeNumber);
    console.log('Asignada a:', data.data.route.assignedUserName);
    return data.data.route;
  }

  throw new Error(data.error);
}

// Uso con scanner QR (auto-asignación)
async function onQRScanned(qrCode) {
  try {
    const route = await assignRoute(qrCode);
    showSuccessMessage(\`Ruta \${route.routeNumber} asignada\`);
    navigateToRouteDetails(route.id);
  } catch (error) {
    showErrorMessage(error.message);
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Route> assignRoute(String routeCode, {int? userId}) async {
  final token = await secureStorage.read(key: 'auth-token');

  final body = {'routeCode': routeCode};
  if (userId != null) {
    body['userId'] = userId.toString();
  }

  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/routes/assign'),
    headers: {
      'Cookie': 'auth-token=\$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode(body),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return Route.fromJson(data['data']['route']);
  }

  throw Exception(data['error']);
}

// Widget de scanner QR (auto-asignación)
class RouteScannerWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return QRView(
      onQRViewCreated: (controller) {
        controller.scannedDataStream.listen((scanData) async {
          try {
            final route = await assignRoute(scanData.code!);
            Navigator.push(context,
              MaterialPageRoute(builder: (_) => RouteDetailScreen(route: route)));
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
      }
    ]
  },
  {
    id: 'driver-route-stops',
    method: 'GET',
    path: '/api/driver-app/routes/[code]/stops',
    title: 'Paradas de una Ruta',
    description: 'Obtiene las paradas de una ruta usando el código QR o número de ruta. Incluye órdenes, empaques y comprobantes de entrega.',
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
        description: 'Lista de paradas',
        body: `{
  "success": true,
  "data": {
    "routeId": 123,
    "routeNumber": "R-2024-001",
    "qrCode": "RT-ABCD1234EFGH5678",
    "status": "active",
    "driverName": "Juan Pérez",
    "vehiclePlate": "ABC-123",
    "distance": 45.5,
    "duration": 120,
    "scheduledDate": "2024-01-15",
    "stops": [
      {
        "stopNumber": 1,
        "address": "123 Main St, Miami, FL 33101",
        "city": "Miami",
        "state": "FL",
        "zipcode": "33101",
        "coordinates": [-80.1234, 25.7890],
        "status": "pending",
        "proofComplete": false,
        "orders": [
          {
            "id": 456,
            "orderNumber": "ORD-2024-001",
            "senderName": "Juan Pérez",
            "senderPhone": "+1234567890",
            "senderAddress": "123 Main St",
            "services": [
              {
                "name": "Envío Express",
                "empaques": [
                  {"id": 1, "codigo": "PKG-001", "tipo": "BULTO", "estado": "en_reparto"}
                ]
              }
            ],
            "status": "pending",
            "hasProof": false,
            "proof": null
          }
        ]
      }
    ],
    "stopsSummary": {
      "total": 12,
      "completed": 5,
      "pending": 6,
      "failed": 1
    }
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Por código QR
curl -X GET 'https://logirapid.com/api/driver-app/routes/RT-ABCD1234EFGH5678/stops' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Por número de ruta
curl -X GET 'https://logirapid.com/api/driver-app/routes/R-2024-001/stops' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function getRouteStops(routeCode) {
  const response = await fetch(\`/api/driver-app/routes/\${routeCode}/stops\`, {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    const { stops, stopsSummary } = data.data;

    console.log(\`Total paradas: \${stopsSummary.total}\`);
    console.log(\`Completadas: \${stopsSummary.completed}\`);
    console.log(\`Pendientes: \${stopsSummary.pending}\`);

    stops.forEach(stop => {
      console.log(\`Parada \${stop.stopNumber}: \${stop.address}\`);
      console.log(\`  Estado: \${stop.status}\`);
      console.log(\`  Órdenes: \${stop.orders.length}\`);
    });

    return data.data;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<RouteStops> getRouteStops(String routeCode) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/driver-app/routes/\$routeCode/stops'),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return RouteStops.fromJson(data['data']);
  }

  throw Exception(data['error']);
}

// Widget de lista de paradas
class StopsListView extends StatelessWidget {
  final String routeCode;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: getRouteStops(routeCode),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return CircularProgressIndicator();

        final routeData = snapshot.data!;

        return ListView.builder(
          itemCount: routeData.stops.length,
          itemBuilder: (context, index) {
            final stop = routeData.stops[index];
            return ListTile(
              leading: CircleAvatar(
                backgroundColor: stop.status == 'delivered'
                    ? Colors.green
                    : (stop.status == 'failed' ? Colors.red : Colors.orange),
                child: Text('\${stop.stopNumber}'),
              ),
              title: Text(stop.address),
              subtitle: Text('\${stop.orders.length} órdenes'),
              trailing: Icon(
                stop.proofComplete ? Icons.check_circle : Icons.pending,
                color: stop.proofComplete ? Colors.green : Colors.grey,
              ),
              onTap: () => navigateToStopDetail(stop),
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
    id: 'driver-stop-info',
    method: 'GET',
    path: '/api/driver-app/stops/[routeId]/[stopNumber]',
    title: 'Información de Parada',
    description: 'Obtiene información completa de una parada específica, incluyendo órdenes, empaques, firma y fotos.',
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
        description: 'Información de la parada',
        body: `{
  "success": true,
  "data": {
    "routeId": 123,
    "routeNumber": "R-2024-001",
    "stopNumber": 1,
    "address": "123 Main St, Miami, FL",
    "city": "Miami",
    "state": "FL",
    "zipcode": "33101",
    "coordinates": [-80.1234, 25.7890],
    "status": "pending",
    "proofComplete": false,
    "orders": [
      {
        "id": 456,
        "orderNumber": "ORD-2024-001",
        "senderName": "Juan Pérez",
        "senderPhone": "+1234567890",
        "services": [
          {
            "name": "Envío Express",
            "empaques": [
              {"id": 1, "codigo": "PKG-001", "tipo": "BULTO", "estado": "en_reparto"}
            ]
          }
        ],
        "status": "pending",
        "hasProof": false,
        "proof": null
      }
    ]
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/stops/123/1' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function getStopInfo(routeId, stopNumber) {
  const response = await fetch(\`/api/driver-app/stops/\${routeId}/\${stopNumber}\`, {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    const stop = data.data;
    console.log(\`Parada \${stop.stopNumber}: \${stop.address}\`);
    console.log(\`Estado: \${stop.status}\`);

    stop.orders.forEach(order => {
      console.log(\`  Orden: \${order.orderNumber}\`);
      console.log(\`  Cliente: \${order.senderName}\`);
      console.log(\`  Tiene comprobante: \${order.hasProof}\`);
    });

    return stop;
  }

  throw new Error(data.error);
}`
      }
    ]
  },
  {
    id: 'driver-stop-update',
    method: 'PUT',
    path: '/api/driver-app/stops/[routeId]/[stopNumber]',
    title: 'Actualizar/Cerrar Parada',
    description: 'Actualiza información de entrega de una parada (firma, fotos, coordenadas) y opcionalmente marca como entregada.',
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
        name: 'orderId',
        type: 'number',
        required: true,
        description: 'ID de la orden a actualizar'
      },
      {
        name: 'signatureData',
        type: 'string',
        required: false,
        description: 'Firma en formato base64 (data:image/png;base64,...)'
      },
      {
        name: 'signatureStoragePath',
        type: 'string',
        required: false,
        description: 'Path de almacenamiento de la firma (si se subió por separado)'
      },
      {
        name: 'signerName',
        type: 'string',
        required: false,
        description: 'Nombre de quien firma'
      },
      {
        name: 'signerRelation',
        type: 'string',
        required: false,
        description: 'Relación con el destinatario (ej: Destinatario, Familiar, Portero)'
      },
      {
        name: 'photos',
        type: 'array',
        required: false,
        description: 'Array de URLs de fotos del comprobante'
      },
      {
        name: 'latitude',
        type: 'number',
        required: false,
        description: 'Latitud donde se cierra la parada'
      },
      {
        name: 'longitude',
        type: 'number',
        required: false,
        description: 'Longitud donde se cierra la parada'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Notas adicionales de la entrega'
      },
      {
        name: 'markAsDelivered',
        type: 'boolean',
        required: false,
        description: 'Si es true, marca la orden como entregada. Requiere firma Y foto.'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Parada actualizada',
        body: `{
  "success": true,
  "message": "Parada cerrada y orden marcada como entregada",
  "data": {
    "proofId": 789,
    "orderId": 456,
    "orderNumber": "ORD-2024-001",
    "status": "delivered",
    "hasSignature": true,
    "hasPhotos": true,
    "coordinates": {
      "latitude": 25.7890,
      "longitude": -80.1234
    }
  }
}`
      },
      {
        status: 400,
        description: 'Faltan datos requeridos',
        body: `{
  "success": false,
  "error": "Se requiere firma y al menos una foto para marcar como entregado"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X PUT 'https://logirapid.com/api/driver-app/stops/123/1' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "orderId": 456,
    "signatureData": "data:image/png;base64,iVBORw0KGgo...",
    "signerName": "María García",
    "signerRelation": "Destinatario",
    "photos": ["https://storage.com/photo1.jpg"],
    "latitude": 25.7890,
    "longitude": -80.1234,
    "notes": "Entregado en portería",
    "markAsDelivered": true
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function closeStop(routeId, stopNumber, deliveryData) {
  const {
    orderId,
    signatureData,
    signerName,
    signerRelation,
    photos,
    latitude,
    longitude,
    notes,
    markAsDelivered
  } = deliveryData;

  const response = await fetch(\`/api/driver-app/stops/\${routeId}/\${stopNumber}\`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      signatureData,
      signerName,
      signerRelation,
      photos,
      latitude,
      longitude,
      notes,
      markAsDelivered
    })
  });

  const data = await response.json();

  if (data.success) {
    console.log('Parada actualizada:', data.message);
    console.log('Estado de orden:', data.data.status);
    return data.data;
  }

  throw new Error(data.error);
}

// Ejemplo de uso completo
async function deliverOrder(routeId, stopNumber, order) {
  // Capturar firma
  const signatureData = await captureSignature();

  // Tomar foto
  const photos = await takePhotos();

  // Obtener ubicación
  const { latitude, longitude } = await getCurrentLocation();

  try {
    const result = await closeStop(routeId, stopNumber, {
      orderId: order.id,
      signatureData,
      signerName: 'María García',
      signerRelation: 'Destinatario',
      photos,
      latitude,
      longitude,
      notes: 'Entregado sin problemas',
      markAsDelivered: true
    });

    showSuccessMessage('Orden entregada exitosamente');
    refreshStopsList();
  } catch (error) {
    showErrorMessage(error.message);
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> closeStop({
  required int routeId,
  required int stopNumber,
  required int orderId,
  String? signatureData,
  String? signerName,
  String? signerRelation,
  List<String>? photos,
  double? latitude,
  double? longitude,
  String? notes,
  bool markAsDelivered = false,
}) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.put(
    Uri.parse('https://logirapid.com/api/driver-app/stops/\$routeId/\$stopNumber'),
    headers: {
      'Cookie': 'auth-token=\$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'orderId': orderId,
      if (signatureData != null) 'signatureData': signatureData,
      if (signerName != null) 'signerName': signerName,
      if (signerRelation != null) 'signerRelation': signerRelation,
      if (photos != null) 'photos': photos,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (notes != null) 'notes': notes,
      'markAsDelivered': markAsDelivered,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return data['data'];
  }

  throw Exception(data['error']);
}

// Widget de formulario de entrega
class DeliveryFormWidget extends StatefulWidget {
  final int routeId;
  final int stopNumber;
  final Order order;

  @override
  _DeliveryFormWidgetState createState() => _DeliveryFormWidgetState();
}

class _DeliveryFormWidgetState extends State<DeliveryFormWidget> {
  final _signerNameController = TextEditingController();
  final _notesController = TextEditingController();
  String? _signatureData;
  List<String> _photos = [];
  String _signerRelation = 'Destinatario';

  Future<void> _submitDelivery() async {
    // Obtener ubicación actual
    final position = await Geolocator.getCurrentPosition();

    try {
      await closeStop(
        routeId: widget.routeId,
        stopNumber: widget.stopNumber,
        orderId: widget.order.id,
        signatureData: _signatureData,
        signerName: _signerNameController.text,
        signerRelation: _signerRelation,
        photos: _photos,
        latitude: position.latitude,
        longitude: position.longitude,
        notes: _notesController.text,
        markAsDelivered: true,
      );

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Entrega registrada exitosamente')),
      );
      Navigator.pop(context, true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: \$e'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Captura de firma
        SignatureCanvas(onSaved: (data) => _signatureData = data),

        // Nombre del firmante
        TextField(
          controller: _signerNameController,
          decoration: InputDecoration(labelText: 'Nombre de quien recibe'),
        ),

        // Relación
        DropdownButton<String>(
          value: _signerRelation,
          items: ['Destinatario', 'Familiar', 'Portero', 'Otro']
              .map((r) => DropdownMenuItem(value: r, child: Text(r)))
              .toList(),
          onChanged: (v) => setState(() => _signerRelation = v!),
        ),

        // Fotos
        PhotoCaptureWidget(onPhotos: (photos) => _photos = photos),

        // Notas
        TextField(
          controller: _notesController,
          decoration: InputDecoration(labelText: 'Notas'),
          maxLines: 3,
        ),

        // Botón de entrega
        ElevatedButton(
          onPressed: _submitDelivery,
          child: Text('Confirmar Entrega'),
        ),
      ],
    );
  }
}`
      }
    ]
  },
  // ==================== EMPAQUES PARA VALIDACIÓN ====================
  {
    id: 'driver-empaques-disponibles',
    method: 'GET',
    path: '/api/driver-app/empaques/disponibles',
    title: 'Empaques Disponibles',
    description: 'Obtiene todos los empaques en estado "disponible" para validar códigos al escanear. Útil para cargar la lista de códigos válidos y validar en tiempo real.',
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
        name: 'search',
        type: 'string',
        required: false,
        description: 'Buscar por código de empaque'
      },
      {
        name: 'tipo',
        type: 'string',
        required: false,
        description: 'Filtrar por tipo: CAJA, BULTO, etc.'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de empaques disponibles',
        body: `{
  "success": true,
  "data": {
    "empaques": [
      {
        "id": 1,
        "codigo": "BOX-001-2024",
        "tipo": "CAJA",
        "estado": "disponible",
        "packageSizeId": 2,
        "packageSizeName": "Mediano",
        "dimensions": "30x25x20",
        "maxWeightLb": 25,
        "warehouseId": 1,
        "warehouseName": "Almacén Principal",
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "codigosDisponibles": ["BOX-001-2024", "BOX-002-2024", "BOX-003-2024"],
    "totalDisponibles": 150,
    "resumenPorTipo": {
      "CAJA": 100,
      "BULTO": 50
    }
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Todos los empaques disponibles
curl -X GET 'https://logirapid.com/api/driver-app/empaques/disponibles' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Solo cajas
curl -X GET 'https://logirapid.com/api/driver-app/empaques/disponibles?tipo=CAJA' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Cargar lista de códigos disponibles para validación
async function loadAvailableCodes() {
  const response = await fetch('/api/driver-app/empaques/disponibles', {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    // Crear Set para validación O(1)
    const validCodes = new Set(data.data.codigosDisponibles);

    console.log('Total disponibles:', data.data.totalDisponibles);
    console.log('Resumen:', data.data.resumenPorTipo);

    return {
      codes: validCodes,
      empaques: data.data.empaques
    };
  }

  throw new Error(data.error);
}

// Validar código escaneado
function validateScannedCode(scannedCode, validCodes) {
  return validCodes.has(scannedCode.toUpperCase());
}

// Ejemplo de uso con scanner
let validCodes;

async function initScanner() {
  const { codes } = await loadAvailableCodes();
  validCodes = codes;
}

function onQRScanned(code) {
  if (validateScannedCode(code, validCodes)) {
    showSuccess('Código válido: ' + code);
    // Proceder con la operación
  } else {
    showError('Código no válido o no disponible');
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `class EmpaqueValidationService {
  Set<String> _validCodes = {};
  List<Map<String, dynamic>> _empaques = [];

  Future<void> loadAvailableCodes() async {
    final token = await secureStorage.read(key: 'auth-token');

    final response = await http.get(
      Uri.parse('https://logirapid.com/api/driver-app/empaques/disponibles'),
      headers: {'Cookie': 'auth-token=\$token'},
    );

    final data = jsonDecode(response.body);

    if (data['success']) {
      _validCodes = Set<String>.from(
        (data['data']['codigosDisponibles'] as List)
            .map((c) => c.toString().toUpperCase())
      );
      _empaques = List<Map<String, dynamic>>.from(data['data']['empaques']);
    }
  }

  bool isValidCode(String code) {
    return _validCodes.contains(code.toUpperCase());
  }

  Map<String, dynamic>? getEmpaqueInfo(String code) {
    return _empaques.firstWhere(
      (e) => e['codigo'].toString().toUpperCase() == code.toUpperCase(),
      orElse: () => {},
    );
  }
}

// Uso en widget de scanner
class ScannerScreen extends StatefulWidget {
  @override
  _ScannerScreenState createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final _validationService = EmpaqueValidationService();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadCodes();
  }

  Future<void> _loadCodes() async {
    await _validationService.loadAvailableCodes();
    setState(() => _isLoading = false);
  }

  void _onCodeScanned(String code) {
    if (_validationService.isValidCode(code)) {
      final info = _validationService.getEmpaqueInfo(code);
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: Text('Código Válido'),
          content: Text('Tipo: \${info?['tipo']}\\nTamaño: \${info?['packageSizeName']}'),
          actions: [
            TextButton(
              onPressed: () => processCode(code),
              child: Text('Continuar'),
            ),
          ],
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Código no válido'), backgroundColor: Colors.red),
      );
    }
  }
}`
      }
    ]
  },
  {
    id: 'driver-empaques-servicio',
    method: 'GET',
    path: '/api/driver-app/empaques/servicio/[orderNumber]/[serviceName]',
    title: 'Empaques por Servicio',
    description: 'Obtiene todos los empaques (bultos) asociados a un servicio específico de una orden. Permite validar que se escaneen todos los bultos correctos para un envío.',
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
        description: 'Lista de empaques del servicio',
        body: `{
  "success": true,
  "data": {
    "orden": {
      "orderNumber": "ORD-2024-001",
      "customerName": "Juan Pérez",
      "status": "pending"
    },
    "servicio": {
      "name": "Envío Express",
      "type": "shipping",
      "quantity": 3,
      "weight": 15.5,
      "price": 45.00
    },
    "empaques": [
      {
        "id": 1,
        "codigo": "PKG-001-2024",
        "tipo": "BULTO",
        "estado": "en_reparto",
        "boxNumber": 1,
        "totalBoxes": 3,
        "recipientName": "María García",
        "recipientCity": "Miami",
        "recipientState": "FL",
        "weightLb": 5.5,
        "weightKg": 2.5,
        "packageSizeName": "Grande",
        "dimensions": "40x30x30",
        "driverId": 123,
        "driverName": "Juan Driver"
      }
    ],
    "codigosEsperados": ["PKG-001-2024", "PKG-002-2024", "PKG-003-2024"],
    "validacion": {
      "totalBultos": 3,
      "bultosEnReparto": 2,
      "bultosEntregados": 0,
      "bultosPendientes": 1,
      "todosAsignados": false,
      "todosEntregados": false
    }
  }
}`
      },
      {
        status: 404,
        description: 'Orden o servicio no encontrado',
        body: `{
  "success": false,
  "error": "Servicio 'Envío Express' no encontrado en la orden"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/empaques/servicio/ORD-2024-001/Envío%20Express' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Obtener bultos de un servicio para validación
async function getServicePackages(orderNumber, serviceName) {
  const response = await fetch(
    \`/api/driver-app/empaques/servicio/\${encodeURIComponent(orderNumber)}/\${encodeURIComponent(serviceName)}\`,
    { credentials: 'include' }
  );

  const data = await response.json();

  if (data.success) {
    return data.data;
  }

  throw new Error(data.error);
}

// Validar bultos escaneados contra esperados
class BultoValidator {
  constructor(serviceData) {
    this.expectedCodes = new Set(serviceData.codigosEsperados.map(c => c.toUpperCase()));
    this.scannedCodes = new Set();
    this.empaques = serviceData.empaques;
    this.validation = serviceData.validacion;
  }

  scanCode(code) {
    const upperCode = code.toUpperCase();

    if (!this.expectedCodes.has(upperCode)) {
      return { valid: false, error: 'Código no pertenece a este servicio' };
    }

    if (this.scannedCodes.has(upperCode)) {
      return { valid: false, error: 'Este código ya fue escaneado' };
    }

    this.scannedCodes.add(upperCode);

    const empaque = this.empaques.find(e => e.codigo.toUpperCase() === upperCode);

    return {
      valid: true,
      empaque,
      progress: {
        scanned: this.scannedCodes.size,
        total: this.expectedCodes.size,
        complete: this.scannedCodes.size === this.expectedCodes.size
      }
    };
  }

  getMissingCodes() {
    return [...this.expectedCodes].filter(c => !this.scannedCodes.has(c));
  }
}

// Ejemplo de uso
async function startServiceValidation(orderNumber, serviceName) {
  const serviceData = await getServicePackages(orderNumber, serviceName);
  const validator = new BultoValidator(serviceData);

  console.log('Bultos esperados:', serviceData.codigosEsperados);
  console.log('Total a escanear:', serviceData.validacion.totalBultos);

  return validator;
}

// Al escanear
function onScan(code, validator) {
  const result = validator.scanCode(code);

  if (result.valid) {
    console.log('Bulto válido:', result.empaque.codigo);
    console.log('Progreso:', result.progress.scanned + '/' + result.progress.total);

    if (result.progress.complete) {
      console.log('¡Todos los bultos escaneados!');
      // Proceder con la operación
    }
  } else {
    console.error('Error:', result.error);
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `class ServicePackageValidator {
  final String orderNumber;
  final String serviceName;

  Set<String> _expectedCodes = {};
  Set<String> _scannedCodes = {};
  List<Map<String, dynamic>> _empaques = [];
  Map<String, dynamic>? _serviceInfo;

  ServicePackageValidator(this.orderNumber, this.serviceName);

  Future<void> loadServicePackages() async {
    final token = await secureStorage.read(key: 'auth-token');

    final uri = Uri.parse(
      'https://logirapid.com/api/driver-app/empaques/servicio/'
      '\${Uri.encodeComponent(orderNumber)}/\${Uri.encodeComponent(serviceName)}'
    );

    final response = await http.get(
      uri,
      headers: {'Cookie': 'auth-token=\$token'},
    );

    final data = jsonDecode(response.body);

    if (data['success']) {
      _expectedCodes = Set<String>.from(
        (data['data']['codigosEsperados'] as List)
            .map((c) => c.toString().toUpperCase())
      );
      _empaques = List<Map<String, dynamic>>.from(data['data']['empaques']);
      _serviceInfo = data['data']['servicio'];
    } else {
      throw Exception(data['error']);
    }
  }

  ValidationResult scanCode(String code) {
    final upperCode = code.toUpperCase();

    if (!_expectedCodes.contains(upperCode)) {
      return ValidationResult(
        valid: false,
        error: 'Código no pertenece a este servicio',
      );
    }

    if (_scannedCodes.contains(upperCode)) {
      return ValidationResult(
        valid: false,
        error: 'Este código ya fue escaneado',
      );
    }

    _scannedCodes.add(upperCode);

    final empaque = _empaques.firstWhere(
      (e) => e['codigo'].toString().toUpperCase() == upperCode,
      orElse: () => {},
    );

    return ValidationResult(
      valid: true,
      empaque: empaque,
      scanned: _scannedCodes.length,
      total: _expectedCodes.length,
      isComplete: _scannedCodes.length == _expectedCodes.length,
    );
  }

  List<String> getMissingCodes() {
    return _expectedCodes.where((c) => !_scannedCodes.contains(c)).toList();
  }

  int get totalExpected => _expectedCodes.length;
  int get totalScanned => _scannedCodes.length;
  bool get isComplete => _scannedCodes.length == _expectedCodes.length;
}

class ValidationResult {
  final bool valid;
  final String? error;
  final Map<String, dynamic>? empaque;
  final int scanned;
  final int total;
  final bool isComplete;

  ValidationResult({
    required this.valid,
    this.error,
    this.empaque,
    this.scanned = 0,
    this.total = 0,
    this.isComplete = false,
  });
}

// Widget de validación de bultos
class BultoValidationScreen extends StatefulWidget {
  final String orderNumber;
  final String serviceName;

  @override
  _BultoValidationScreenState createState() => _BultoValidationScreenState();
}

class _BultoValidationScreenState extends State<BultoValidationScreen> {
  late ServicePackageValidator _validator;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _initValidator();
  }

  Future<void> _initValidator() async {
    _validator = ServicePackageValidator(widget.orderNumber, widget.serviceName);
    await _validator.loadServicePackages();
    setState(() => _isLoading = false);
  }

  void _onCodeScanned(String code) {
    final result = _validator.scanCode(code);

    setState(() {});

    if (result.valid) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Bulto \${result.scanned}/\${result.total} escaneado'),
          backgroundColor: Colors.green,
        ),
      );

      if (result.isComplete) {
        _showCompletionDialog();
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.error!),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('¡Validación Completa!'),
        content: Text('Todos los bultos han sido escaneados correctamente.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('Continuar'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return Center(child: CircularProgressIndicator());

    return Column(
      children: [
        // Progreso
        LinearProgressIndicator(
          value: _validator.totalScanned / _validator.totalExpected,
        ),
        Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'Progreso: \${_validator.totalScanned}/\${_validator.totalExpected}',
            style: Theme.of(context).textTheme.headline6,
          ),
        ),

        // Códigos faltantes
        if (_validator.getMissingCodes().isNotEmpty)
          Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Códigos pendientes:'),
                ..._validator.getMissingCodes().map((c) => Text('• \$c')),
              ],
            ),
          ),

        // Scanner
        Expanded(
          child: QRView(
            onQRViewCreated: (controller) {
              controller.scannedDataStream.listen((scanData) {
                _onCodeScanned(scanData.code!);
              });
            },
          ),
        ),
      ],
    );
  }
}`
      }
    ]
  },
  // ==================== RUTAS - INICIAR Y COMPLETAR ====================
  {
    id: 'driver-route-start',
    method: 'POST',
    path: '/api/driver-app/routes/[code]/start',
    title: 'Iniciar Ruta',
    description: 'Inicia una ruta asignada al driver. Cambia el estado de la ruta a "en_curso", actualiza las paradas y marca las órdenes como "en_reparto". Devuelve información completa de todas las paradas con órdenes, servicios y empaques. El code puede ser el QR, número de ruta o ID.',
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
        description: 'Ruta iniciada exitosamente con paradas detalladas',
        body: `{
  "success": true,
  "message": "Ruta R-2024-001 iniciada exitosamente",
  "data": {
    "id": 123,
    "routeNumber": "R-2024-001",
    "status": "en_curso",
    "previousStatus": "asignada",
    "startTime": "2024-01-15T10:30:00Z",
    "driverId": 5,
    "driverName": "Juan Pérez",
    "vehicleId": 10,
    "vehiclePlate": "ABC-123",
    "totalDistance": 25.5,
    "totalDuration": 90,
    "scheduledDate": "2024-01-15",
    "stops": [
      {
        "stopNumber": 1,
        "address": "123 Main St, Miami, FL 33186",
        "city": "Miami",
        "state": "FL",
        "zipcode": "33186",
        "coordinates": [-80.1234, 25.7890],
        "status": "en_curso",
        "orders": [
          {
            "id": 45,
            "orderNumber": "PICKUP-2024-001",
            "senderName": "María García",
            "senderPhone": "+1-305-555-0100",
            "senderAddress": "123 Main St",
            "senderCity": "Miami",
            "senderState": "FL",
            "senderZipcode": "33186",
            "services": [
              {
                "type": "envio",
                "name": "Caja Mediana",
                "price": 35.00,
                "quantity": 2,
                "empaques": [
                  {
                    "id": 101,
                    "codigo": "PKG-001",
                    "tipo": "caja",
                    "estado": "recogida",
                    "weightLb": 5.5,
                    "weightKg": 2.5,
                    "boxNumber": 1,
                    "totalBoxes": 2
                  },
                  {
                    "id": 102,
                    "codigo": "PKG-002",
                    "tipo": "caja",
                    "estado": "recogida",
                    "weightLb": 3.2,
                    "weightKg": 1.45,
                    "boxNumber": 2,
                    "totalBoxes": 2
                  }
                ]
              }
            ],
            "status": "en_reparto",
            "totalAmount": 70.00
          }
        ]
      },
      {
        "stopNumber": 2,
        "address": "456 Oak Ave, Miami, FL 33155",
        "city": "Miami",
        "state": "FL",
        "zipcode": "33155",
        "coordinates": [-80.2567, 25.7234],
        "status": "en_curso",
        "orders": []
      }
    ],
    "stopsSummary": {
      "total": 5,
      "pending": 0,
      "enCurso": 5,
      "completed": 0,
      "failed": 0
    }
  }
}`
      },
      {
        status: 400,
        description: 'Estado inválido para iniciar',
        body: `{
  "success": false,
  "error": "La ruta debe estar en estado \\"asignada\\" para iniciarla. Estado actual: \\"completada\\"",
  "currentStatus": "completada"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST 'https://logirapid.com/api/driver-app/routes/RT-ABCD1234EFGH5678/start' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function startRoute(routeCode) {
  const response = await fetch(\`/api/driver-app/routes/\${routeCode}/start\`, {
    method: 'POST',
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    console.log('Ruta iniciada:', data.data.routeNumber);
    console.log('Total paradas:', data.data.stops.length);

    // Procesar las paradas con sus órdenes y empaques
    data.data.stops.forEach(stop => {
      console.log(\`Parada \${stop.stopNumber}: \${stop.address}\`);
      stop.orders.forEach(order => {
        console.log(\`  - Orden \${order.orderNumber}: \${order.senderName}\`);
        order.services.forEach(service => {
          console.log(\`    Servicio: \${service.name} x\${service.quantity}\`);
          console.log(\`    Empaques: \${service.empaques.length}\`);
        });
      });
    });

    return data.data;
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<RouteData> startRoute(String routeCode) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/routes/\$routeCode/start'),
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    final routeData = data['data'];

    // Procesar paradas con órdenes y empaques
    final stops = routeData['stops'] as List;
    for (var stop in stops) {
      final orders = stop['orders'] as List;
      for (var order in orders) {
        final services = order['services'] as List;
        for (var service in services) {
          final empaques = service['empaques'] as List;
          // Cada empaque tiene: codigo, tipo, estado, weightLb, weightKg, boxNumber, totalBoxes
          print('Empaques: \${empaques.length}');
        }
      }
    }

    // Navegar a la primera parada
    if (stops.isNotEmpty) {
      openNavigation(stops[0]['coordinates']);
    }

    return RouteData.fromJson(routeData);
  }

  throw Exception(data['error']);
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `suspend fun startRoute(routeCode: String): RouteData {
    val token = secureStorage.getString("auth-token", "")

    val response = httpClient.post("https://logirapid.com/api/driver-app/routes/\$routeCode/start") {
        header("Cookie", "auth-token=\$token")
    }

    val data = response.body<JsonObject>()

    if (data["success"].jsonPrimitive.boolean) {
        val routeData = data["data"].jsonObject

        // Procesar paradas
        val stops = routeData["stops"].jsonArray
        stops.forEach { stopJson ->
            val stop = stopJson.jsonObject
            val orders = stop["orders"].jsonArray

            orders.forEach { orderJson ->
                val order = orderJson.jsonObject
                val services = order["services"].jsonArray

                services.forEach { serviceJson ->
                    val service = serviceJson.jsonObject
                    val empaques = service["empaques"].jsonArray
                    // Cada empaque: codigo, tipo, estado, weightLb, boxNumber, totalBoxes
                    Log.d("Route", "Empaques: \${empaques.size}")
                }
            }
        }

        return RouteData.fromJson(routeData)
    }

    throw Exception(data["error"].jsonPrimitive.content)
}`
      }
    ]
  },
  {
    id: 'driver-route-complete',
    method: 'POST',
    path: '/api/driver-app/routes/[code]/complete',
    title: 'Completar Ruta',
    description: 'Finaliza una ruta en curso. Calcula estadísticas de entregas exitosas/fallidas. Si hay paradas pendientes, requiere forceComplete=true.',
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
        name: 'forceComplete',
        type: 'boolean',
        required: false,
        description: 'Forzar cierre aunque haya paradas pendientes (las marca como fallidas)'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Notas de cierre de ruta'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Ruta completada exitosamente',
        body: `{
  "success": true,
  "message": "Ruta R-2024-001 completada exitosamente",
  "data": {
    "id": 123,
    "routeNumber": "R-2024-001",
    "status": "completada",
    "startTime": "2024-01-15T08:00:00Z",
    "endTime": "2024-01-15T14:30:00Z",
    "durationMinutes": 390,
    "summary": {
      "totalStops": 12,
      "deliveredStops": 10,
      "failedStops": 2,
      "deliveredOrders": 13,
      "failedOrders": 2
    }
  }
}`
      },
      {
        status: 400,
        description: 'Hay paradas pendientes',
        body: `{
  "success": false,
  "error": "Hay 3 paradas pendientes. Use forceComplete=true para completar de todas formas.",
  "pendingStops": 3,
  "completedStops": 9,
  "totalStops": 12
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Completar ruta normal
curl -X POST 'https://logirapid.com/api/driver-app/routes/R-2024-001/complete' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{}'

# Forzar cierre con paradas pendientes
curl -X POST 'https://logirapid.com/api/driver-app/routes/R-2024-001/complete' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{"forceComplete": true, "notes": "Fin de jornada"}'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function completeRoute(routeCode, options = {}) {
  const response = await fetch(\`/api/driver-app/routes/\${routeCode}/complete\`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });

  const data = await response.json();

  if (data.success) {
    console.log('Ruta completada!');
    console.log('Duración:', data.data.durationMinutes, 'minutos');
    console.log('Entregas:', data.data.summary.deliveredOrders);
    console.log('Fallidas:', data.data.summary.failedOrders);
    return data.data;
  }

  // Si hay paradas pendientes, mostrar confirmación
  if (data.pendingStops) {
    const confirm = window.confirm(
      \`Hay \${data.pendingStops} paradas sin completar. ¿Desea cerrar de todas formas?\`
    );
    if (confirm) {
      return completeRoute(routeCode, { forceComplete: true });
    }
  }

  throw new Error(data.error);
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<RouteSummary> completeRoute(String routeCode, {bool force = false, String? notes}) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/routes/\$routeCode/complete'),
    headers: {
      'Cookie': 'auth-token=\$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      if (force) 'forceComplete': true,
      if (notes != null) 'notes': notes,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    return RouteSummary.fromJson(data['data']);
  }

  // Mostrar diálogo si hay paradas pendientes
  if (data['pendingStops'] != null && !force) {
    final confirmed = await showConfirmDialog(
      'Paradas Pendientes',
      'Hay \${data['pendingStops']} paradas sin completar. ¿Cerrar ruta de todas formas?',
    );
    if (confirmed) {
      return completeRoute(routeCode, force: true);
    }
  }

  throw Exception(data['error']);
}`
      }
    ]
  },
  // ==================== PARADAS - FALLA Y NAVEGACIÓN ====================
  {
    id: 'driver-stop-fail',
    method: 'POST',
    path: '/api/driver-app/stops/[routeId]/[stopNumber]/fail',
    title: 'Marcar Parada como Fallida',
    description: 'Marca una parada como fallida con razón. Las órdenes de la parada se marcan como "reprogrammed" para intentar de nuevo. Registra foto opcional y coordenadas.',
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
        name: 'reasonCode',
        type: 'string',
        required: true,
        description: 'Código de razón: no_responde, direccion_incorrecta, cliente_rechazo, acceso_denegado, zona_peligrosa, horario_no_disponible, paquete_danado, otro'
      },
      {
        name: 'reason',
        type: 'string',
        required: false,
        description: 'Descripción personalizada de la razón (requerido si reasonCode es "otro")'
      },
      {
        name: 'photo',
        type: 'string',
        required: false,
        description: 'URL de foto como evidencia'
      },
      {
        name: 'latitude',
        type: 'number',
        required: false,
        description: 'Latitud donde se reporta la falla'
      },
      {
        name: 'longitude',
        type: 'number',
        required: false,
        description: 'Longitud donde se reporta la falla'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Notas adicionales'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Parada marcada como fallida',
        body: `{
  "success": true,
  "message": "Parada marcada como fallida",
  "data": {
    "routeId": 123,
    "routeNumber": "R-2024-001",
    "stopNumber": 5,
    "status": "failed",
    "reason": "Nadie responde / No está",
    "reasonCode": "no_responde",
    "affectedOrders": 2,
    "failedAt": "2024-01-15T11:30:00Z",
    "failedBy": "Juan Pérez"
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST 'https://logirapid.com/api/driver-app/stops/123/5/fail' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "reasonCode": "no_responde",
    "latitude": 25.7890,
    "longitude": -80.1234,
    "notes": "Toqué varias veces, nadie abrió"
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function markStopAsFailed(routeId, stopNumber, failData) {
  const response = await fetch(\`/api/driver-app/stops/\${routeId}/\${stopNumber}/fail\`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(failData)
  });

  const data = await response.json();

  if (data.success) {
    console.log('Parada marcada como fallida');
    console.log('Razón:', data.data.reason);
    console.log('Órdenes afectadas:', data.data.affectedOrders);
    return data.data;
  }

  throw new Error(data.error);
}

// Obtener razones disponibles
async function getFailReasons() {
  const response = await fetch('/api/driver-app/stops/123/1/fail', {
    credentials: 'include'
  });
  const data = await response.json();
  return data.data.reasons;
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `// Razones de falla disponibles
enum FailReasonCode {
  noResponde,
  direccionIncorrecta,
  clienteRechazo,
  accesoDenegado,
  zonaPeligrosa,
  horarioNoDisponible,
  paqueteDanado,
  otro,
}

Future<void> markStopAsFailed({
  required int routeId,
  required int stopNumber,
  required FailReasonCode reasonCode,
  String? reason,
  String? photo,
  double? latitude,
  double? longitude,
  String? notes,
}) async {
  final token = await secureStorage.read(key: 'auth-token');

  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/stops/\$routeId/\$stopNumber/fail'),
    headers: {
      'Cookie': 'auth-token=\$token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'reasonCode': reasonCode.toString().split('.').last.replaceAllMapped(
        RegExp(r'[A-Z]'), (m) => '_\${m.group(0)!.toLowerCase()}'
      ),
      if (reason != null) 'reason': reason,
      if (photo != null) 'photo': photo,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (notes != null) 'notes': notes,
    }),
  );

  final data = jsonDecode(response.body);
  if (!data['success']) {
    throw Exception(data['error']);
  }
}

// Widget de selección de razón de falla
class FailReasonSelector extends StatelessWidget {
  final Function(FailReasonCode) onSelect;

  @override
  Widget build(BuildContext context) {
    final reasons = [
      {'code': FailReasonCode.noResponde, 'label': 'Nadie responde / No está'},
      {'code': FailReasonCode.direccionIncorrecta, 'label': 'Dirección incorrecta'},
      {'code': FailReasonCode.clienteRechazo, 'label': 'Cliente rechazó'},
      {'code': FailReasonCode.accesoDenegado, 'label': 'Acceso denegado'},
      {'code': FailReasonCode.zonaPeligrosa, 'label': 'Zona peligrosa'},
      {'code': FailReasonCode.horarioNoDisponible, 'label': 'Fuera de horario'},
      {'code': FailReasonCode.paqueteDanado, 'label': 'Paquete dañado'},
      {'code': FailReasonCode.otro, 'label': 'Otra razón'},
    ];

    return ListView.builder(
      itemCount: reasons.length,
      itemBuilder: (context, index) => ListTile(
        leading: Icon(Icons.warning_amber, color: Colors.orange),
        title: Text(reasons[index]['label'] as String),
        onTap: () => onSelect(reasons[index]['code'] as FailReasonCode),
      ),
    );
  }
}`
      }
    ]
  },
  {
    id: 'driver-stop-navigate',
    method: 'GET',
    path: '/api/driver-app/stops/[routeId]/[stopNumber]/navigate',
    title: 'Obtener Info de Navegación',
    description: 'Obtiene información de navegación para una parada, incluyendo coordenadas y links para abrir en Google Maps, Apple Maps y Waze.',
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
        name: 'lat',
        type: 'number',
        required: false,
        description: 'Latitud actual del driver (para calcular distancia)'
      },
      {
        name: 'lng',
        type: 'number',
        required: false,
        description: 'Longitud actual del driver'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Info de navegación',
        body: `{
  "success": true,
  "data": {
    "routeId": 123,
    "routeNumber": "R-2024-001",
    "stopNumber": 5,
    "address": "123 Main St, Miami, FL 33101",
    "coordinates": {
      "latitude": 25.7890,
      "longitude": -80.1234
    },
    "navigation": {
      "googleMaps": "https://www.google.com/maps/dir/?api=1&destination=25.7890,-80.1234&travelmode=driving",
      "appleMaps": "maps://maps.apple.com/?daddr=25.7890,-80.1234&dirflg=d",
      "waze": "https://www.waze.com/ul?ll=25.7890,-80.1234&navigate=yes",
      "geo": "geo:25.7890,-80.1234?q=25.7890,-80.1234(123%20Main%20St)"
    },
    "distance": {
      "km": 3.5,
      "text": "3.5 km"
    }
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Sin posición actual
curl -X GET 'https://logirapid.com/api/driver-app/stops/123/5/navigate' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Con posición actual para calcular distancia
curl -X GET 'https://logirapid.com/api/driver-app/stops/123/5/navigate?lat=25.78&lng=-80.13' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `async function getNavigationInfo(routeId, stopNumber, currentPosition) {
  let url = \`/api/driver-app/stops/\${routeId}/\${stopNumber}/navigate\`;

  if (currentPosition) {
    url += \`?lat=\${currentPosition.lat}&lng=\${currentPosition.lng}\`;
  }

  const response = await fetch(url, {
    credentials: 'include'
  });

  const data = await response.json();

  if (data.success) {
    return data.data;
  }

  throw new Error(data.error);
}

// Abrir en la app de mapas preferida
function openNavigation(navData, preferredApp = 'googleMaps') {
  const url = navData.navigation[preferredApp];
  window.open(url, '_blank');
}

// Ejemplo de uso
async function navigateToStop(routeId, stopNumber) {
  const position = await getCurrentPosition();
  const navData = await getNavigationInfo(routeId, stopNumber, position);

  console.log('Distancia:', navData.distance?.text || 'Desconocida');
  console.log('Dirección:', navData.address);

  // Abrir Google Maps
  openNavigation(navData, 'googleMaps');
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<NavigationData> getNavigationInfo(int routeId, int stopNumber) async {
  final token = await secureStorage.read(key: 'auth-token');

  // Obtener posición actual
  final position = await Geolocator.getCurrentPosition();

  final uri = Uri.parse(
    'https://logirapid.com/api/driver-app/stops/\$routeId/\$stopNumber/navigate'
  ).replace(queryParameters: {
    'lat': position.latitude.toString(),
    'lng': position.longitude.toString(),
  });

  final response = await http.get(
    uri,
    headers: {'Cookie': 'auth-token=\$token'},
  );

  final data = jsonDecode(response.body);
  if (data['success']) {
    return NavigationData.fromJson(data['data']);
  }
  throw Exception(data['error']);
}

// Abrir en app de mapas
Future<void> openMapApp(NavigationData navData, String app) async {
  final urls = navData.navigation;
  String? url;

  switch (app) {
    case 'google':
      url = urls['googleMaps'];
      break;
    case 'apple':
      url = urls['appleMaps'];
      break;
    case 'waze':
      url = urls['waze'];
      break;
  }

  if (url != null && await canLaunchUrl(Uri.parse(url))) {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }
}

// Widget de navegación
class NavigateToStopButton extends StatelessWidget {
  final int routeId;
  final int stopNumber;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      icon: Icon(Icons.navigation),
      label: Text('Navegar'),
      onPressed: () async {
        final navData = await getNavigationInfo(routeId, stopNumber);

        // Mostrar opciones de navegación
        showModalBottomSheet(
          context: context,
          builder: (_) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (navData.distance != null)
                Padding(
                  padding: EdgeInsets.all(16),
                  child: Text('Distancia: \${navData.distance!.text}'),
                ),
              ListTile(
                leading: Icon(Icons.map, color: Colors.red),
                title: Text('Google Maps'),
                onTap: () => openMapApp(navData, 'google'),
              ),
              ListTile(
                leading: Icon(Icons.map, color: Colors.blue),
                title: Text('Apple Maps'),
                onTap: () => openMapApp(navData, 'apple'),
              ),
              ListTile(
                leading: Icon(Icons.map, color: Colors.lightBlue),
                title: Text('Waze'),
                onTap: () => openMapApp(navData, 'waze'),
              ),
            ],
          ),
        );
      },
    );
  }
}`
      }
    ]
  },
  // ==================== UBICACIÓN DEL DRIVER ====================
  {
    id: 'driver-location-update',
    method: 'POST',
    path: '/api/driver-app/location',
    title: 'Actualizar Ubicación',
    description: 'Actualiza la ubicación actual del driver. Usar para tracking en tiempo real durante rutas activas. Enviar periódicamente (cada 10-30 segundos).',
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
        name: 'latitude',
        type: 'number',
        required: true,
        description: 'Latitud actual (-90 a 90)'
      },
      {
        name: 'longitude',
        type: 'number',
        required: true,
        description: 'Longitud actual (-180 a 180)'
      },
      {
        name: 'accuracy',
        type: 'number',
        required: false,
        description: 'Precisión en metros'
      },
      {
        name: 'speed',
        type: 'number',
        required: false,
        description: 'Velocidad en m/s'
      },
      {
        name: 'heading',
        type: 'number',
        required: false,
        description: 'Dirección en grados (0-360)'
      },
      {
        name: 'routeId',
        type: 'number',
        required: false,
        description: 'ID de la ruta activa (para tracking de ruta)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Ubicación actualizada',
        body: `{
  "success": true,
  "message": "Ubicación actualizada",
  "data": {
    "latitude": 25.7890,
    "longitude": -80.1234,
    "timestamp": "2024-01-15T11:30:00Z"
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST 'https://logirapid.com/api/driver-app/location' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "latitude": 25.7890,
    "longitude": -80.1234,
    "accuracy": 10,
    "speed": 15.5,
    "heading": 90,
    "routeId": 123
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Servicio de tracking de ubicación
class LocationTracker {
  constructor(routeId) {
    this.routeId = routeId;
    this.watchId = null;
    this.intervalId = null;
    this.lastPosition = null;
  }

  start() {
    // Monitorear cambios de ubicación
    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.lastPosition = position;
      },
      (error) => console.error('Error GPS:', error),
      { enableHighAccuracy: true }
    );

    // Enviar ubicación cada 15 segundos
    this.intervalId = setInterval(() => {
      this.sendLocation();
    }, 15000);

    // Enviar ubicación inicial
    this.sendLocation();
  }

  stop() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async sendLocation() {
    if (!this.lastPosition) return;

    const { coords } = this.lastPosition;

    try {
      await fetch('/api/driver-app/location', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          speed: coords.speed,
          heading: coords.heading,
          routeId: this.routeId
        })
      });
    } catch (error) {
      console.error('Error enviando ubicación:', error);
    }
  }
}

// Uso
const tracker = new LocationTracker(123);
tracker.start();

// Al terminar la ruta
tracker.stop();`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `class LocationTrackingService {
  Timer? _timer;
  StreamSubscription<Position>? _positionStream;
  Position? _lastPosition;
  final int? routeId;

  LocationTrackingService({this.routeId});

  Future<void> startTracking() async {
    // Configurar stream de ubicación
    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10, // metros
    );

    _positionStream = Geolocator.getPositionStream(locationSettings: settings)
        .listen((position) {
      _lastPosition = position;
    });

    // Enviar ubicación cada 15 segundos
    _timer = Timer.periodic(Duration(seconds: 15), (_) {
      _sendLocation();
    });

    // Enviar ubicación inicial
    _sendLocation();
  }

  void stopTracking() {
    _timer?.cancel();
    _positionStream?.cancel();
  }

  Future<void> _sendLocation() async {
    if (_lastPosition == null) return;

    final token = await secureStorage.read(key: 'auth-token');

    try {
      await http.post(
        Uri.parse('https://logirapid.com/api/driver-app/location'),
        headers: {
          'Cookie': 'auth-token=\$token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'latitude': _lastPosition!.latitude,
          'longitude': _lastPosition!.longitude,
          'accuracy': _lastPosition!.accuracy,
          'speed': _lastPosition!.speed,
          'heading': _lastPosition!.heading,
          if (routeId != null) 'routeId': routeId,
        }),
      );
    } catch (e) {
      print('Error enviando ubicación: \$e');
    }
  }
}

// Provider para uso en la app
class LocationProvider extends ChangeNotifier {
  LocationTrackingService? _service;

  void startTracking(int routeId) {
    _service = LocationTrackingService(routeId: routeId);
    _service!.startTracking();
  }

  void stopTracking() {
    _service?.stopTracking();
    _service = null;
  }

  @override
  void dispose() {
    stopTracking();
    super.dispose();
  }
}`
      }
    ]
  },
  // ===========================================
  // VALIDACIÓN DE EMPAQUES
  // ===========================================
  {
    id: 'driver-empaques-list-disponibles',
    method: 'GET',
    path: '/api/driver-app/empaques/list-disponibles',
    title: 'Listar Empaques Disponibles (Cajas Vacías)',
    description: 'Precargar todos los empaques en estado "disponible" (cajas vacías) de la empresa para validación local instantánea al escanear. Ideal para precargar al iniciar la pantalla de escaneo.',
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
        name: 'warehouseId',
        type: 'number',
        required: false,
        description: 'Filtrar por almacén específico'
      },
      {
        name: 'tipo',
        type: 'string',
        required: false,
        description: 'Filtrar por tipo de empaque (CAJA, BULTO, etc.)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de empaques disponibles obtenida exitosamente',
        body: `{
  "success": true,
  "data": {
    "empaques": [
      {
        "id": 123,
        "codigo": "EMP-001-2024",
        "tipo": "CAJA",
        "estado": "disponible",
        "packageSizeId": 2,
        "packageSizeName": "Mediana",
        "warehouseId": 1,
        "warehouseName": "Almacén Miami"
      }
    ],
    "codigos": ["EMP-001-2024", "EMP-002-2024"],
    "total": 150,
    "companyId": 1
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{"success": false, "error": "No autenticado"}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET 'https://logirapid.com/api/driver-app/empaques/list-disponibles' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Precargar empaques disponibles para validación local
const response = await fetch('/api/driver-app/empaques/list-disponibles', {
  method: 'GET',
  credentials: 'include'
});
const data = await response.json();
if (data.success) {
  const empaquesMap = new Map(data.data.empaques.map(e => [e.codigo, e]));
  const codigosDisponibles = new Set(data.data.codigos);
  // Validación instantánea O(1)
  function validateScan(scannedCode) {
    if (codigosDisponibles.has(scannedCode)) {
      return { valid: true, empaque: empaquesMap.get(scannedCode) };
    }
    return { valid: false, error: 'NOT_FOUND' };
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `class EmpaqueValidationService {
  Map<String, dynamic> _empaquesMap = {};
  Set<String> _codigosDisponibles = {};

  Future<void> preloadEmpaques() async {
    final token = await secureStorage.read(key: 'auth-token');
    final response = await http.get(
      Uri.parse('https://logirapid.com/api/driver-app/empaques/list-disponibles'),
      headers: {'Cookie': 'auth-token=\$token'},
    );
    final data = jsonDecode(response.body);
    if (data['success']) {
      for (var emp in data['data']['empaques']) {
        _empaquesMap[emp['codigo']] = emp;
      }
      _codigosDisponibles = Set.from(data['data']['codigos']);
    }
  }

  ValidationResult validateScan(String code) {
    if (_codigosDisponibles.contains(code)) {
      return ValidationResult(valid: true, empaque: _empaquesMap[code]);
    }
    return ValidationResult(valid: false, error: 'NOT_FOUND');
  }
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `class EmpaqueValidationRepository @Inject constructor(
    private val api: DriverApi
) {
    private var empaquesMap: Map<String, Empaque> = emptyMap()
    private var codigosDisponibles: Set<String> = emptySet()

    suspend fun preloadEmpaques() {
        val response = api.getEmpaquesDisponibles()
        if (response.success) {
            empaquesMap = response.data.empaques.associateBy { it.codigo }
            codigosDisponibles = response.data.codigos.toSet()
        }
    }

    fun validateScan(code: String): ValidationResult {
        return if (code in codigosDisponibles) {
            ValidationResult.Valid(empaquesMap[code]!!)
        } else {
            ValidationResult.Invalid("NOT_FOUND")
        }
    }
}`
      }
    ]
  },
  {
    id: 'driver-empaques-list-bultos',
    method: 'GET',
    path: '/api/driver-app/empaques/list-bultos',
    title: 'Listar Bultos (Empaques con Orden)',
    description: 'Precargar todos los bultos (empaques con orden asignada) de la empresa para validación local. Usado para recepción/envío de bultos en almacén o driver.',
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
        name: 'warehouseId',
        type: 'number',
        required: false,
        description: 'Filtrar por almacén específico'
      },
      {
        name: 'estado',
        type: 'string',
        required: false,
        description: 'Filtrar por estado (en_almacen, en_transito, etc.)'
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
        "id": 456,
        "codigo": "EMP-100-2024",
        "estado": "en_almacen",
        "warehouseId": 1,
        "warehouseName": "Almacén Miami",
        "ordenId": 789,
        "orderNumber": "ORD-2024-001",
        "recipientName": "María García",
        "recipientCity": "La Habana",
        "weightLb": 15.5,
        "boxNumber": 1,
        "totalBoxes": 2
      }
    ],
    "codigos": ["EMP-100-2024", "EMP-101-2024"],
    "total": 75,
    "companyId": 1
  }
}`
      },
      {
        status: 401,
        description: 'No autenticado',
        body: `{"success": false, "error": "No autenticado"}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Obtener todos los bultos
curl -X GET 'https://logirapid.com/api/driver-app/empaques/list-bultos' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'

# Filtrar por almacén
curl -X GET 'https://logirapid.com/api/driver-app/empaques/list-bultos?warehouseId=1' \\
  -H 'Cookie: auth-token=YOUR_TOKEN'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Precargar bultos para validación local
const response = await fetch('/api/driver-app/empaques/list-bultos', {
  method: 'GET', credentials: 'include'
});
const data = await response.json();
if (data.success) {
  const bultosMap = new Map(data.data.bultos.map(b => [b.codigo, b]));

  function validateBulto(code, operacion, warehouseId) {
    const bulto = bultosMap.get(code);
    if (!bulto) return { valid: false, error: 'NOT_FOUND' };

    if (operacion === 'recepcion') {
      if (bulto.estado === 'disponible' || bulto.estado === 'entregado')
        return { valid: false, error: 'INVALID_STATE' };
      if (bulto.warehouseId === warehouseId && bulto.estado === 'en_almacen')
        return { valid: false, status: 'already-here' };
    }
    if (operacion === 'envio') {
      if (bulto.warehouseId !== warehouseId)
        return { valid: false, error: 'WRONG_WAREHOUSE' };
      if (bulto.estado !== 'en_almacen')
        return { valid: false, error: 'INVALID_STATE' };
    }
    return { valid: true, bulto };
  }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `class BultoValidationService {
  Map<String, Bulto> _bultosMap = {};

  Future<void> preloadBultos({int? warehouseId}) async {
    final token = await secureStorage.read(key: 'auth-token');
    var url = 'https://logirapid.com/api/driver-app/empaques/list-bultos';
    if (warehouseId != null) url += '?warehouseId=\$warehouseId';

    final response = await http.get(Uri.parse(url), headers: {'Cookie': 'auth-token=\$token'});
    final data = jsonDecode(response.body);
    if (data['success']) {
      for (var b in data['data']['bultos']) {
        _bultosMap[b['codigo']] = Bulto.fromJson(b);
      }
    }
  }

  ValidationResult validateBulto(String code, String operacion, int warehouseId) {
    final bulto = _bultosMap[code];
    if (bulto == null) return ValidationResult(valid: false, errorCode: 'NOT_FOUND');

    if (operacion == 'recepcion') {
      if (bulto.estado == 'disponible' || bulto.estado == 'entregado')
        return ValidationResult(valid: false, errorCode: 'INVALID_STATE');
      if (bulto.warehouseId == warehouseId && bulto.estado == 'en_almacen')
        return ValidationResult(valid: false, status: 'already-here');
    }
    if (operacion == 'envio') {
      if (bulto.warehouseId != warehouseId)
        return ValidationResult(valid: false, errorCode: 'WRONG_WAREHOUSE');
    }
    return ValidationResult(valid: true, bulto: bulto);
  }
}`
      }
    ]
  },
  {
    id: 'driver-empaques-validate',
    method: 'POST',
    path: '/api/driver-app/empaques/validate',
    title: 'Validar Código Individual',
    description: 'Validar un código de empaque individual en tiempo real. Usar como fallback cuando el código no está en la lista precargada. Verifica propiedad de empresa y estado según la operación.',
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
      { name: 'codigo', type: 'string', required: true, description: 'Código del empaque a validar' },
      { name: 'tipo', type: 'string', required: true, description: 'Tipo de validación: "empaque" o "bulto"' },
      { name: 'operacion', type: 'string', required: false, description: 'Solo para bultos: "recepcion" o "envio"' },
      { name: 'warehouseId', type: 'number', required: false, description: 'ID del almacén actual' }
    ],
    responses: [
      {
        status: 200,
        description: 'Código válido',
        body: `{"success": true, "data": {"valid": true, "status": "valid", "empaque": {...}}}`
      },
      {
        status: 200,
        description: 'Código no encontrado',
        body: `{"success": true, "data": {"valid": false, "status": "invalid", "errorCode": "NOT_FOUND", "message": "El código no existe"}}`
      },
      {
        status: 200,
        description: 'Código de otra empresa',
        body: `{"success": true, "data": {"valid": false, "status": "invalid", "errorCode": "WRONG_COMPANY", "message": "Este código no pertenece a tu empresa"}}`
      },
      {
        status: 200,
        description: 'Bulto ya está en este almacén',
        body: `{"success": true, "data": {"valid": false, "status": "already-here", "errorCode": "ALREADY_HERE", "message": "El bulto ya se encuentra en este almacén"}}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `# Validar caja vacía
curl -X POST 'https://logirapid.com/api/driver-app/empaques/validate' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{"codigo": "EMP-001-2024", "tipo": "empaque"}'

# Validar bulto para recepción
curl -X POST 'https://logirapid.com/api/driver-app/empaques/validate' \\
  -H 'Cookie: auth-token=YOUR_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{"codigo": "EMP-100-2024", "tipo": "bulto", "operacion": "recepcion", "warehouseId": 1}'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Validar código individual (fallback)
async function validateCode(codigo, tipo, operacion, warehouseId) {
  const response = await fetch('/api/driver-app/empaques/validate', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ codigo, tipo, operacion, warehouseId })
  });
  const data = await response.json();
  if (data.success) {
    const result = data.data;
    if (result.valid) return { success: true, empaque: result.empaque };
    // Errores: NOT_FOUND, WRONG_COMPANY, ALREADY_HERE, INVALID_STATE, WRONG_WAREHOUSE
    return { success: false, error: result.errorCode, message: result.message };
  }
  return { success: false, error: 'API_ERROR' };
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<ValidationResult> validateCode({
  required String codigo,
  required String tipo,
  String? operacion,
  int? warehouseId,
}) async {
  final token = await secureStorage.read(key: 'auth-token');
  final response = await http.post(
    Uri.parse('https://logirapid.com/api/driver-app/empaques/validate'),
    headers: {'Cookie': 'auth-token=\$token', 'Content-Type': 'application/json'},
    body: jsonEncode({
      'codigo': codigo, 'tipo': tipo,
      if (operacion != null) 'operacion': operacion,
      if (warehouseId != null) 'warehouseId': warehouseId,
    }),
  );
  final data = jsonDecode(response.body);
  if (data['success']) return ValidationResult.fromJson(data['data']);
  throw Exception(data['error']);
}`
      }
    ]
  }
]
