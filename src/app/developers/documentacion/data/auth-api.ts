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
    id: 'orders',
    label: 'API de Ordenes',
    badge: 'coming_soon' as const,
    children: []
  },
  {
    id: 'tracking',
    label: 'API de Tracking',
    badge: 'coming_soon' as const,
    children: []
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
