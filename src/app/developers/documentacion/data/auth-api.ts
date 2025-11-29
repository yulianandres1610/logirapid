// Auth API Documentation Data

export interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  default?: string
}

export interface CodeExample {
  language: string
  label: string
  code: string
}

export interface ResponseExample {
  status: number
  description: string
  body: string
}

export interface Endpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  title: string
  description: string
  headers?: Parameter[]
  parameters?: Parameter[]
  queryParams?: Parameter[]
  pathParams?: Parameter[]
  requestBody?: Parameter[]
  responses: ResponseExample[]
  examples: CodeExample[]
}

// Navigation structure
export const navigationItems = [
  {
    id: 'introduction',
    label: 'Introduccion',
    children: [
      { id: 'overview', label: 'Descripcion General' },
      { id: 'base-url', label: 'URL Base' },
      { id: 'authentication', label: 'Autenticacion' },
    ]
  },
  {
    id: 'auth',
    label: 'API de Autenticacion',
    badge: 'available' as const,
    children: [
      { id: 'auth-login', label: 'POST /auth/login' },
      { id: 'auth-logout', label: 'POST /auth/logout' },
      { id: 'auth-me', label: 'GET /auth/me' },
    ]
  },
  {
    id: 'services',
    label: 'Servicios Habilitados',
    badge: 'available' as const,
    children: [
      { id: 'get-company-services', label: 'GET /companies/{id}' },
    ]
  },
  {
    id: 'tracker',
    label: 'API de Rastreador',
    badge: 'available' as const,
    children: [
      { id: 'tracker-search', label: 'GET /tracker' },
    ]
  },
  {
    id: 'paqueteria',
    label: 'API de Paqueteria',
    badge: 'available' as const,
    children: [
      { id: 'generate-order-number', label: 'POST /generate-number' },
      { id: 'create-package-order', label: 'POST /package-orders' },
      { id: 'list-package-orders', label: 'GET /package-orders' },
      { id: 'get-order-detail', label: 'GET /pickup-orders/{id}' },
      { id: 'update-order', label: 'PATCH /pickup-orders/{id}' },
      { id: 'cancel-order', label: 'POST /cancel' },
      { id: 'reprogram-order', label: 'POST /reprogram' },
    ]
  },
  {
    id: 'driver-app',
    label: 'API Driver App',
    badge: 'available' as const,
    children: [
      { id: 'driver-dashboard', label: 'GET /dashboard' },
      { id: 'driver-receive-box', label: 'POST /receive-box' },
      { id: 'driver-receive-package', label: 'POST /receive-package' },
      { id: 'driver-packages', label: 'GET /packages' },
      { id: 'driver-empty-boxes', label: 'GET /empty-boxes' },
    ]
  },
  {
    id: 'webhooks',
    label: 'Webhooks',
    badge: 'coming_soon' as const,
    children: []
  },
  {
    id: 'errors',
    label: 'Codigos de Error',
  },
]

// Base URL configuration
export const baseUrls = {
  production: 'https://logirapid.com/api',
  sandbox: 'https://sandbox.logirapid.com/api'
}

// Auth endpoints documentation
export const authEndpoints: Endpoint[] = [
  {
    id: 'auth-login',
    method: 'POST',
    path: '/api/auth/login',
    title: 'Iniciar Sesion',
    description: 'Autentica un usuario con email y contrasena. Devuelve un token JWT que debe usarse en las solicitudes posteriores. El token tiene una validez de 7 dias.',
    requestBody: [
      {
        name: 'email',
        type: 'string',
        required: true,
        description: 'Email del usuario registrado en la plataforma'
      },
      {
        name: 'password',
        type: 'string',
        required: true,
        description: 'Contrasena del usuario'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Autenticacion exitosa',
        body: `{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 42,
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "ADMIN",
    "companyId": 3,
    "companyName": "Mi Empresa"
  }
}`
      },
      {
        status: 400,
        description: 'Campos requeridos faltantes',
        body: `{
  "success": false,
  "error": "Email y password son requeridos"
}`
      },
      {
        status: 401,
        description: 'Credenciales incorrectas',
        body: `{
  "success": false,
  "error": "Credenciales incorrectas"
}`
      },
      {
        status: 403,
        description: 'Usuario inactivo',
        body: `{
  "success": false,
  "error": "Usuario inactivo"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST https://logirapid.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'your_password'
  })
});

const data = await response.json();

if (data.success) {
  // Guardar token para futuras solicitudes
  localStorage.setItem('token', data.token);
  console.log('Usuario:', data.user);
}`
      },
      {
        language: 'python',
        label: 'Python',
        code: `import requests

response = requests.post(
    'https://logirapid.com/api/auth/login',
    json={
        'email': 'user@example.com',
        'password': 'your_password'
    }
)

data = response.json()

if data['success']:
    token = data['token']
    user = data['user']
    print(f"Autenticado como: {user['name']}")`
      },
      {
        language: 'php',
        label: 'PHP',
        code: `<?php
$client = new GuzzleHttp\\Client();

$response = $client->post('https://logirapid.com/api/auth/login', [
    'json' => [
        'email' => 'user@example.com',
        'password' => 'your_password'
    ]
]);

$data = json_decode($response->getBody(), true);

if ($data['success']) {
    $token = $data['token'];
    $user = $data['user'];
    echo "Autenticado como: " . $user['name'];
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `import Foundation

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let success: Bool
    let token: String?
    let user: User?
}

let url = URL(string: "https://logirapid.com/api/auth/login")!
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")

let body = LoginRequest(email: "user@example.com", password: "your_password")
request.httpBody = try? JSONEncoder().encode(body)

URLSession.shared.dataTask(with: request) { data, response, error in
    guard let data = data else { return }
    let loginResponse = try? JSONDecoder().decode(LoginResponse.self, from: data)
    if loginResponse?.success == true {
        // Guardar token en Keychain
        print("Token: \\(loginResponse?.token ?? "")")
    }
}.resume()`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.POST

data class LoginRequest(
    val email: String,
    val password: String
)

data class LoginResponse(
    val success: Boolean,
    val token: String?,
    val user: User?
)

interface AuthApi {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse
}

// Uso
val response = authApi.login(
    LoginRequest(
        email = "user@example.com",
        password = "your_password"
    )
)

if (response.success) {
    // Guardar token en SharedPreferences o DataStore
    saveToken(response.token)
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('https://logirapid.com/api/auth/login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'email': email,
      'password': password,
    }),
  );

  final data = jsonDecode(response.body);

  if (data['success']) {
    // Guardar token usando flutter_secure_storage
    await secureStorage.write(key: 'token', value: data['token']);
  }

  return data;
}`
      }
    ]
  },
  {
    id: 'auth-logout',
    method: 'POST',
    path: '/api/auth/logout',
    title: 'Cerrar Sesion',
    description: 'Cierra la sesion del usuario actual eliminando las cookies de autenticacion. No requiere cuerpo en la solicitud.',
    responses: [
      {
        status: 200,
        description: 'Sesion cerrada exitosamente',
        body: `{
  "success": true
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST https://logirapid.com/api/auth/logout \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`
  }
});

if (response.ok) {
  // Limpiar token local
  localStorage.removeItem('token');
  // Redirigir al login
  window.location.href = '/login';
}`
      },
      {
        language: 'python',
        label: 'Python',
        code: `import requests

response = requests.post(
    'https://logirapid.com/api/auth/logout',
    headers={
        'Authorization': f'Bearer {token}'
    }
)

if response.json()['success']:
    print("Sesion cerrada")`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<void> logout() async {
  final token = await secureStorage.read(key: 'token');

  await http.post(
    Uri.parse('https://logirapid.com/api/auth/logout'),
    headers: {
      'Authorization': 'Bearer \$token',
    },
  );

  // Limpiar token local
  await secureStorage.delete(key: 'token');
}`
      }
    ]
  },
  {
    id: 'auth-me',
    method: 'GET',
    path: '/api/auth/me',
    title: 'Obtener Usuario Actual',
    description: 'Devuelve la informacion del usuario autenticado actual. Requiere un token JWT valido en el header Authorization.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Informacion del usuario',
        body: `{
  "success": true,
  "user": {
    "id": 42,
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "role": "ADMIN",
    "companyId": 3,
    "companyName": "Mi Empresa",
    "phone": "+1234567890",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "lastLogin": "2024-03-20T14:22:00Z"
  }
}`
      },
      {
        status: 401,
        description: 'Token no proporcionado o invalido',
        body: `{
  "success": false,
  "error": "No autorizado"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET https://logirapid.com/api/auth/me \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': \`Bearer \${token}\`
  }
});

const data = await response.json();

if (data.success) {
  console.log('Usuario actual:', data.user);
  console.log('Rol:', data.user.role);
}`
      },
      {
        language: 'python',
        label: 'Python',
        code: `import requests

response = requests.get(
    'https://logirapid.com/api/auth/me',
    headers={
        'Authorization': f'Bearer {token}'
    }
)

data = response.json()

if data['success']:
    user = data['user']
    print(f"Usuario: {user['firstName']} {user['lastName']}")
    print(f"Rol: {user['role']}")`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `let url = URL(string: "https://logirapid.com/api/auth/me")!
var request = URLRequest(url: url)
request.httpMethod = "GET"
request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")

URLSession.shared.dataTask(with: request) { data, response, error in
    guard let data = data else { return }
    let userResponse = try? JSONDecoder().decode(UserResponse.self, from: data)
    if let user = userResponse?.user {
        print("Usuario: \\(user.firstName) \\(user.lastName)")
    }
}.resume()`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `interface AuthApi {
    @GET("api/auth/me")
    suspend fun getCurrentUser(
        @Header("Authorization") token: String
    ): UserResponse
}

// Uso
val response = authApi.getCurrentUser("Bearer \$token")

if (response.success) {
    val user = response.user
    println("Usuario: \${user.firstName} \${user.lastName}")
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `Future<Map<String, dynamic>> getCurrentUser() async {
  final token = await secureStorage.read(key: 'token');

  final response = await http.get(
    Uri.parse('https://logirapid.com/api/auth/me'),
    headers: {
      'Authorization': 'Bearer \$token',
    },
  );

  return jsonDecode(response.body);
}`
      }
    ]
  }
]

// Error codes documentation
export const errorCodes = [
  { code: 400, name: 'Bad Request', description: 'La solicitud tiene parametros invalidos o faltantes' },
  { code: 401, name: 'Unauthorized', description: 'Token no proporcionado, invalido o expirado' },
  { code: 403, name: 'Forbidden', description: 'No tienes permisos para realizar esta accion' },
  { code: 404, name: 'Not Found', description: 'El recurso solicitado no existe' },
  { code: 409, name: 'Conflict', description: 'Conflicto con el estado actual del recurso' },
  { code: 422, name: 'Unprocessable Entity', description: 'Los datos enviados no son validos' },
  { code: 429, name: 'Too Many Requests', description: 'Has excedido el limite de solicitudes' },
  { code: 500, name: 'Internal Server Error', description: 'Error interno del servidor' },
]

// User roles
export const userRoles = [
  { role: 'SUPER_ADMIN', description: 'Acceso completo a todas las funciones y empresas de la plataforma' },
  { role: 'ADMIN', description: 'Administrador de empresa, puede gestionar usuarios y configuraciones' },
  { role: 'MANAGER', description: 'Puede crear usuarios, recargar wallets, sin transferencias' },
  { role: 'USER', description: 'Usuario estandar, puede vender servicios y debitar del wallet' },
  { role: 'DRIVER', description: 'Conductor, acceso a rutas asignadas y entregas' },
  { role: 'WAREHOUSE', description: 'Personal de almacen, gestion de inventario' },
]

// Services endpoint documentation
export const servicesEndpoints: Endpoint[] = [
  {
    id: 'get-company-services',
    method: 'GET',
    path: '/api/companies/{id}',
    title: 'Obtener Servicios Habilitados',
    description: 'Obtiene la informacion de la empresa incluyendo los servicios habilitados. Usar el companyId obtenido del login para determinar que opciones mostrar en el menu de la app.',
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
        description: 'ID de la empresa (companyId del usuario autenticado)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Informacion de la empresa con servicios',
        body: `{
  "success": true,
  "data": {
    "id": 5,
    "legalName": "Mi Empresa Logistica",
    "tradeName": "MiLogistica",
    "email": "info@milogistica.com",
    "phone": "+1 305 555 1000",
    "enabledServices": [
      "wallet",
      "paqueteria",
      "tracker",
      "recharge",
      "marketplace",
      "exchange"
    ],
    "logoUrl": "https://logirapid.com/uploads/companies/5/logo.png",
    "primaryColor": "#cc0a46",
    "secondaryColor": "#1a1a2e",
    "address": "100 Business Ave, Miami, FL 33101",
    "isActive": true,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}`
      },
      {
        status: 404,
        description: 'Empresa no encontrada',
        body: `{
  "success": false,
  "error": "Empresa no encontrada"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET "https://logirapid.com/api/companies/5" \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `// Despues del login, obtener servicios habilitados
async function getEnabledServices(companyId) {
  const response = await fetch(\`/api/companies/\${companyId}\`, {
    method: 'GET',
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });

  const data = await response.json();

  if (data.success) {
    const { enabledServices } = data.data;

    // Construir menu dinamico basado en servicios
    const menuItems = [];

    if (enabledServices.includes('wallet')) {
      menuItems.push({ id: 'wallet', label: 'Mi Billetera', icon: 'wallet' });
    }
    if (enabledServices.includes('paqueteria')) {
      menuItems.push({ id: 'paqueteria', label: 'Paqueteria', icon: 'package' });
    }
    if (enabledServices.includes('tracker')) {
      menuItems.push({ id: 'tracker', label: 'Rastreador', icon: 'search' });
    }
    if (enabledServices.includes('recharge')) {
      menuItems.push({ id: 'recharge', label: 'Recargas', icon: 'phone' });
    }
    if (enabledServices.includes('marketplace')) {
      menuItems.push({ id: 'marketplace', label: 'Marketplace', icon: 'store' });
    }
    if (enabledServices.includes('exchange')) {
      menuItems.push({ id: 'exchange', label: 'Cambio', icon: 'exchange' });
    }

    return menuItems;
  }

  throw new Error(data.error);
}

// Flujo completo de login
async function loginAndGetMenu(email, password) {
  // 1. Login
  const loginResponse = await login(email, password);
  const { token, user } = loginResponse;

  // 2. Obtener servicios de la empresa
  const menuItems = await getEnabledServices(user.companyId);

  return { user, menuItems };
}`
      },
      {
        language: 'swift',
        label: 'Swift',
        code: `struct CompanyResponse: Codable {
    let success: Bool
    let data: Company?
    let error: String?
}

struct Company: Codable {
    let id: Int
    let legalName: String
    let tradeName: String?
    let email: String?
    let phone: String?
    let enabledServices: [String]
    let logoUrl: String?
    let primaryColor: String?
    let secondaryColor: String?
    let isActive: Bool
}

enum ServiceType: String, CaseIterable {
    case wallet = "wallet"
    case paqueteria = "paqueteria"
    case tracker = "tracker"
    case recharge = "recharge"
    case marketplace = "marketplace"
    case exchange = "exchange"

    var title: String {
        switch self {
        case .wallet: return "Mi Billetera"
        case .paqueteria: return "Paqueteria"
        case .tracker: return "Rastreador"
        case .recharge: return "Recargas"
        case .marketplace: return "Marketplace"
        case .exchange: return "Cambio"
        }
    }

    var icon: String {
        switch self {
        case .wallet: return "wallet.pass"
        case .paqueteria: return "shippingbox"
        case .tracker: return "magnifyingglass"
        case .recharge: return "phone.fill"
        case .marketplace: return "storefront"
        case .exchange: return "arrow.left.arrow.right"
        }
    }
}

class CompanyService {
    func getEnabledServices(companyId: Int) async throws -> [ServiceType] {
        let url = URL(string: "https://logirapid.com/api/companies/\\(companyId)")!
        var request = URLRequest(url: url)
        request.setValue("Bearer \\(token)", forHTTPHeaderField: "Authorization")

        let (data, _) = try await URLSession.shared.data(for: request)
        let response = try JSONDecoder().decode(CompanyResponse.self, from: data)

        guard let company = response.data else {
            throw NSError(domain: "", code: -1)
        }

        return ServiceType.allCases.filter { service in
            company.enabledServices.contains(service.rawValue)
        }
    }
}`
      },
      {
        language: 'kotlin',
        label: 'Kotlin',
        code: `data class CompanyResponse(
    val success: Boolean,
    val data: Company?,
    val error: String?
)

data class Company(
    val id: Int,
    val legalName: String,
    val tradeName: String?,
    val email: String?,
    val phone: String?,
    val enabledServices: List<String>,
    val logoUrl: String?,
    val primaryColor: String?,
    val secondaryColor: String?,
    val isActive: Boolean
)

enum class ServiceType(val key: String, val title: String, val icon: Int) {
    WALLET("wallet", "Mi Billetera", R.drawable.ic_wallet),
    PAQUETERIA("paqueteria", "Paqueteria", R.drawable.ic_package),
    TRACKER("tracker", "Rastreador", R.drawable.ic_search),
    RECHARGE("recharge", "Recargas", R.drawable.ic_phone),
    MARKETPLACE("marketplace", "Marketplace", R.drawable.ic_store),
    EXCHANGE("exchange", "Cambio", R.drawable.ic_exchange)
}

interface CompanyApi {
    @GET("api/companies/{id}")
    suspend fun getCompany(
        @Header("Authorization") token: String,
        @Path("id") companyId: Int
    ): CompanyResponse
}

class CompanyRepository(private val api: CompanyApi) {
    suspend fun getEnabledServices(companyId: Int): List<ServiceType> {
        val response = api.getCompany("Bearer \$authToken", companyId)

        return response.data?.enabledServices?.mapNotNull { serviceName ->
            ServiceType.values().find { it.key == serviceName }
        } ?: emptyList()
    }
}

// En el ViewModel
class MainViewModel(private val repository: CompanyRepository) : ViewModel() {
    private val _menuItems = MutableStateFlow<List<ServiceType>>(emptyList())
    val menuItems: StateFlow<List<ServiceType>> = _menuItems

    fun loadMenu(companyId: Int) {
        viewModelScope.launch {
            _menuItems.value = repository.getEnabledServices(companyId)
        }
    }
}`
      },
      {
        language: 'dart',
        label: 'Flutter',
        code: `enum ServiceType {
  wallet('wallet', 'Mi Billetera', Icons.account_balance_wallet),
  paqueteria('paqueteria', 'Paqueteria', Icons.inventory_2),
  tracker('tracker', 'Rastreador', Icons.search),
  recharge('recharge', 'Recargas', Icons.phone_android),
  marketplace('marketplace', 'Marketplace', Icons.storefront),
  exchange('exchange', 'Cambio', Icons.currency_exchange);

  final String key;
  final String title;
  final IconData icon;

  const ServiceType(this.key, this.title, this.icon);
}

class CompanyService {
  final String token;

  CompanyService({required this.token});

  Future<List<ServiceType>> getEnabledServices(int companyId) async {
    final response = await http.get(
      Uri.parse('https://logirapid.com/api/companies/\$companyId'),
      headers: {'Authorization': 'Bearer \$token'},
    );

    final data = jsonDecode(response.body);

    if (data['success']) {
      final enabledServices = List<String>.from(data['data']['enabledServices']);

      return ServiceType.values.where((service) {
        return enabledServices.contains(service.key);
      }).toList();
    }

    throw Exception(data['error']);
  }
}

// Widget de menu dinamico
class DynamicMenu extends StatelessWidget {
  final List<ServiceType> services;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
      ),
      itemCount: services.length,
      itemBuilder: (context, index) {
        final service = services[index];
        return GestureDetector(
          onTap: () => navigateToService(context, service),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(service.icon, size: 32),
              SizedBox(height: 8),
              Text(service.title, textAlign: TextAlign.center),
            ],
          ),
        );
      },
    );
  }

  void navigateToService(BuildContext context, ServiceType service) {
    switch (service) {
      case ServiceType.tracker:
        Navigator.pushNamed(context, '/tracker');
        break;
      case ServiceType.paqueteria:
        Navigator.pushNamed(context, '/paqueteria');
        break;
      // ... otros casos
    }
  }
}

// Flujo completo de autenticacion
class AuthService {
  Future<Map<String, dynamic>> loginAndGetMenu(String email, String password) async {
    // 1. Login
    final loginData = await login(email, password);
    final token = loginData['token'];
    final user = loginData['user'];

    // 2. Obtener servicios
    final companyService = CompanyService(token: token);
    final services = await companyService.getEnabledServices(user['companyId']);

    return {
      'user': user,
      'token': token,
      'services': services,
    };
  }
}`
      }
    ]
  }
]

// Available services list
export const availableServices = [
  { key: 'wallet', name: 'Billetera', description: 'Gestion de saldo y transacciones' },
  { key: 'paqueteria', name: 'Paqueteria', description: 'Envio y recogida de paquetes' },
  { key: 'tracker', name: 'Rastreador', description: 'Rastreo de ordenes y empaques' },
  { key: 'recharge', name: 'Recargas', description: 'Recargas telefonicas' },
  { key: 'marketplace', name: 'Marketplace', description: 'Tienda de productos' },
  { key: 'exchange', name: 'Cambio', description: 'Cambio de divisas' },
]
