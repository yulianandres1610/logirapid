// Routes and Delivery Proofs API Documentation
import { Endpoint } from './auth-api'

export const routesEndpoints: Endpoint[] = [
  // ============================================
  // RUTAS
  // ============================================
  {
    id: 'get-routes',
    method: 'GET',
    path: '/api/routes',
    title: 'Listar Rutas',
    description: 'Obtiene la lista de rutas filtradas por empresa, conductor, estado y fecha. Ideal para que los conductores vean sus rutas asignadas.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      },
      {
        name: 'x-company-id',
        type: 'string',
        required: false,
        description: 'ID de la empresa (opcional para super admins)'
      }
    ],
    queryParams: [
      {
        name: 'status',
        type: 'string',
        required: false,
        description: 'Filtrar por estado: planning, active, completed, cancelled'
      },
      {
        name: 'driverId',
        type: 'string',
        required: false,
        description: 'Filtrar por ID del conductor'
      },
      {
        name: 'date',
        type: 'string',
        required: false,
        description: 'Filtrar por fecha (formato: YYYY-MM-DD)'
      },
      {
        name: 'page',
        type: 'number',
        required: false,
        description: 'Numero de pagina (default: 1)'
      },
      {
        name: 'limit',
        type: 'number',
        required: false,
        description: 'Resultados por pagina (default: 20)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Lista de rutas obtenida exitosamente',
        body: `{
  "success": true,
  "data": [
    {
      "id": 1,
      "routeNumber": "RT-001",
      "status": "active",
      "driverName": "Juan Perez",
      "vehiclePlate": "ABC-123",
      "totalPackages": 15,
      "deliveredPackages": 5,
      "distance": 45.2,
      "estimatedDuration": "2h 30min",
      "date": "2024-11-28",
      "createdAt": "2024-11-28T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET "https://logirapid.com/api/routes?status=active&driverId=5" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "x-company-id: 1"`
      },
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const response = await fetch('/api/routes?status=active&driverId=5', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'x-company-id': '1'
  }
});
const data = await response.json();`
      }
    ]
  },
  {
    id: 'get-route-detail',
    method: 'GET',
    path: '/api/routes/{id}',
    title: 'Detalle de Ruta',
    description: 'Obtiene los detalles completos de una ruta especifica, incluyendo waypoints y datos de optimizacion.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    pathParams: [
      {
        name: 'id',
        type: 'number',
        required: true,
        description: 'ID de la ruta'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Detalles de la ruta',
        body: `{
  "success": true,
  "data": {
    "id": 1,
    "routeNumber": "RT-001",
    "status": "active",
    "driverName": "Juan Perez",
    "driverId": 5,
    "vehiclePlate": "ABC-123",
    "vehicleId": 3,
    "totalPackages": 15,
    "deliveredPackages": 5,
    "distance": 45.2,
    "estimatedDuration": "2h 30min",
    "waypoints": [
      {
        "id": 1,
        "address": "123 Main St",
        "latitude": 25.7617,
        "longitude": -80.1918,
        "customerName": "Maria Garcia",
        "status": "pending"
      }
    ],
    "optimizedRoute": { ... },
    "date": "2024-11-28"
  }
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
        code: `curl -X GET https://logirapid.com/api/routes/1 \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      }
    ]
  },
  {
    id: 'get-route-stops',
    method: 'GET',
    path: '/api/routes/{id}/stops',
    title: 'Paradas de Ruta con Ordenes',
    description: 'Obtiene todas las paradas de una ruta con sus ordenes asociadas y estado de comprobantes de entrega. Este endpoint es ideal para la vista de conductor en la app movil.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    pathParams: [
      {
        name: 'id',
        type: 'number',
        required: true,
        description: 'ID de la ruta'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Paradas con ordenes y comprobantes',
        body: `{
  "success": true,
  "data": {
    "routeId": 1,
    "routeNumber": "RT-001",
    "status": "active",
    "driverName": "Juan Perez",
    "driverId": 5,
    "vehiclePlate": "ABC-123",
    "totalDistance": 45.2,
    "totalDuration": "2h 30min",
    "stops": [
      {
        "stopNumber": 1,
        "address": "123 Main St, Miami",
        "city": "Miami",
        "state": "FL",
        "coordinates": [-80.1918, 25.7617],
        "status": "pending",
        "proofComplete": false,
        "orders": [
          {
            "id": 42,
            "orderNumber": "PICKUP00042",
            "customerName": "Cliente ABC",
            "recipientName": "Maria Garcia",
            "recipientPhone": "+1234567890",
            "services": [
              { "type": "envio_paquete", "name": "Envio Paquete", "quantity": 1 }
            ],
            "status": "pending",
            "deliveryType": "standard",
            "proofStatus": "none",
            "hasProof": false,
            "proof": null
          }
        ]
      },
      {
        "stopNumber": 2,
        "address": "456 Ocean Dr, Miami Beach",
        "city": "Miami Beach",
        "state": "FL",
        "coordinates": [-80.1300, 25.7906],
        "status": "delivered",
        "proofComplete": true,
        "orders": [
          {
            "id": 43,
            "orderNumber": "PICKUP00043",
            "recipientName": "Jose Rodriguez",
            "status": "delivered",
            "proofStatus": "completed",
            "hasProof": true,
            "proof": {
              "id": 1,
              "hasSignature": true,
              "signerName": "Jose Rodriguez",
              "signerRelation": "recipient",
              "photosCount": 2,
              "createdAt": "2024-11-28T14:30:00Z"
            }
          }
        ]
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
        code: `curl -X GET https://logirapid.com/api/routes/1/stops \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      },
      {
        language: 'javascript',
        label: 'JavaScript (React Native)',
        code: `const getRouteStops = async (routeId) => {
  const response = await fetch(\`/api/routes/\${routeId}/stops\`, {
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });
  const data = await response.json();
  return data.data.stops;
};`
      }
    ]
  },

  // ============================================
  // COMPROBANTES DE ENTREGA
  // ============================================
  {
    id: 'create-delivery-proof',
    method: 'POST',
    path: '/api/delivery-proofs',
    title: 'Crear Comprobante de Entrega',
    description: 'Crea o actualiza un comprobante de entrega con firma electronica y fotos. IMPORTANTE: Para marcar como entregado (markAsDelivered=true), se requiere OBLIGATORIAMENTE firma Y al menos 1 foto.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
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
        description: 'ID de la orden'
      },
      {
        name: 'signatureData',
        type: 'string',
        required: true,
        description: 'Firma electronica en formato Base64 PNG (data:image/png;base64,...). OBLIGATORIO para marcar como entregado.'
      },
      {
        name: 'signerName',
        type: 'string',
        required: false,
        description: 'Nombre de la persona que firma'
      },
      {
        name: 'signerRelation',
        type: 'string',
        required: false,
        description: 'Relacion con el destinatario: recipient, family, neighbor, guard, other'
      },
      {
        name: 'photos',
        type: 'array',
        required: true,
        description: 'Array de objetos con storagePath y uploadedAt. OBLIGATORIO al menos 1 foto para marcar como entregado.'
      },
      {
        name: 'latitude',
        type: 'number',
        required: false,
        description: 'Latitud GPS del momento de la entrega'
      },
      {
        name: 'longitude',
        type: 'number',
        required: false,
        description: 'Longitud GPS del momento de la entrega'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Notas adicionales sobre la entrega'
      },
      {
        name: 'markAsDelivered',
        type: 'boolean',
        required: false,
        description: 'Si es true, marca la orden como entregada. Requiere firma Y foto obligatorias.'
      }
    ],
    responses: [
      {
        status: 201,
        description: 'Comprobante creado exitosamente',
        body: `{
  "success": true,
  "data": {
    "id": 1,
    "orderId": 42,
    "orderNumber": "PICKUP00042",
    "proofStatus": "completed",
    "hasSignature": true,
    "hasPhotos": true,
    "photosCount": 2,
    "markedAsDelivered": true
  }
}`
      },
      {
        status: 400,
        description: 'Validacion fallida - falta firma o fotos',
        body: `{
  "success": false,
  "error": "La firma electronica es obligatoria para marcar como entregado"
}`
      }
    ],
    examples: [
      {
        language: 'javascript',
        label: 'JavaScript (React Native)',
        code: `// Paso 1: Subir fotos primero
const uploadPhotos = async (orderId, companyId, photos) => {
  const formData = new FormData();
  formData.append('orderId', orderId);
  formData.append('companyId', companyId);
  photos.forEach(photo => {
    formData.append('photos', photo);
  });

  const response = await fetch('/api/upload/delivery-photos', {
    method: 'POST',
    headers: { 'Authorization': \`Bearer \${token}\` },
    body: formData
  });
  return response.json();
};

// Paso 2: Crear comprobante con firma y fotos
const createProof = async (orderId, signatureBase64, photos) => {
  const response = await fetch('/api/delivery-proofs', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      orderId,
      signatureData: signatureBase64,
      signerName: 'Maria Garcia',
      signerRelation: 'recipient',
      photos: photos.map(p => ({
        storagePath: p.storagePath,
        uploadedAt: p.uploadedAt
      })),
      latitude: 25.7617,
      longitude: -80.1918,
      notes: 'Entregado sin problemas',
      markAsDelivered: true
    })
  });
  return response.json();
};`
      },
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST https://logirapid.com/api/delivery-proofs \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "orderId": 42,
    "signatureData": "data:image/png;base64,iVBORw0KGgo...",
    "signerName": "Maria Garcia",
    "signerRelation": "recipient",
    "photos": [
      {"storagePath": "company-1/delivery-proofs/order-42/photo1.jpg", "uploadedAt": "2024-11-28T14:30:00Z"}
    ],
    "latitude": 25.7617,
    "longitude": -80.1918,
    "markAsDelivered": true
  }'`
      }
    ]
  },
  {
    id: 'get-delivery-proof',
    method: 'GET',
    path: '/api/delivery-proofs/{orderId}',
    title: 'Obtener Comprobante de Entrega',
    description: 'Obtiene el comprobante de entrega de una orden especifica con todos sus detalles, firma y fotos.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    pathParams: [
      {
        name: 'orderId',
        type: 'number',
        required: true,
        description: 'ID de la orden'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Comprobante encontrado',
        body: `{
  "success": true,
  "data": {
    "id": 1,
    "orderId": 42,
    "orderNumber": "PICKUP00042",
    "orderStatus": "delivered",
    "recipient": {
      "name": "Maria Garcia",
      "phone": "+1234567890",
      "address": "123 Main St",
      "city": "Miami",
      "state": "FL"
    },
    "signature": {
      "hasSignature": true,
      "data": "data:image/png;base64,iVBORw0KGgo...",
      "signerName": "Maria Garcia",
      "signerRelation": "recipient"
    },
    "photos": [
      {
        "storagePath": "company-1/delivery-proofs/order-42/photo1.jpg",
        "uploadedAt": "2024-11-28T14:30:00Z"
      }
    ],
    "location": {
      "latitude": 25.7617,
      "longitude": -80.1918
    },
    "notes": "Entregado sin problemas",
    "metadata": {
      "createdAt": "2024-11-28T14:30:00Z",
      "createdByName": "Juan Conductor"
    }
  }
}`
      },
      {
        status: 200,
        description: 'Orden sin comprobante',
        body: `{
  "success": true,
  "data": null,
  "message": "La orden no tiene comprobante de entrega"
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X GET https://logirapid.com/api/delivery-proofs/42 \\
  -H "Authorization: Bearer YOUR_TOKEN"`
      }
    ]
  },
  {
    id: 'update-delivery-proof',
    method: 'PATCH',
    path: '/api/delivery-proofs/{orderId}',
    title: 'Actualizar Comprobante de Entrega',
    description: 'Actualiza un comprobante de entrega existente. Permite agregar mas fotos o actualizar la firma.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      },
      {
        name: 'Content-Type',
        type: 'string',
        required: true,
        description: 'application/json'
      }
    ],
    pathParams: [
      {
        name: 'orderId',
        type: 'number',
        required: true,
        description: 'ID de la orden'
      }
    ],
    requestBody: [
      {
        name: 'signatureData',
        type: 'string',
        required: false,
        description: 'Nueva firma en Base64 PNG'
      },
      {
        name: 'photos',
        type: 'array',
        required: false,
        description: 'Nuevas fotos (reemplaza las existentes)'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Notas actualizadas'
      },
      {
        name: 'markAsDelivered',
        type: 'boolean',
        required: false,
        description: 'Marcar como entregado si cumple requisitos'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Comprobante actualizado',
        body: `{
  "success": true,
  "data": {
    "id": 1,
    "orderId": 42,
    "proofStatus": "completed",
    "hasSignature": true,
    "hasPhotos": true,
    "photosCount": 3,
    "markedAsDelivered": true,
    "updatedAt": "2024-11-28T15:00:00Z"
  }
}`
      }
    ],
    examples: [
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X PATCH https://logirapid.com/api/delivery-proofs/42 \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "notes": "Actualizado: cliente muy satisfecho",
    "markAsDelivered": true
  }'`
      }
    ]
  },

  // ============================================
  // UPLOAD DE FOTOS
  // ============================================
  {
    id: 'upload-delivery-photos',
    method: 'POST',
    path: '/api/upload/delivery-photos',
    title: 'Subir Fotos de Entrega',
    description: 'Sube fotos de comprobante de entrega al almacenamiento privado. Las fotos se asocian automaticamente a la orden. Maximo 5 fotos por orden, 10MB por foto.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      },
      {
        name: 'Content-Type',
        type: 'string',
        required: true,
        description: 'multipart/form-data'
      }
    ],
    requestBody: [
      {
        name: 'orderId',
        type: 'string',
        required: true,
        description: 'ID de la orden'
      },
      {
        name: 'companyId',
        type: 'string',
        required: true,
        description: 'ID de la empresa'
      },
      {
        name: 'photos',
        type: 'File[]',
        required: true,
        description: 'Archivos de imagen (JPG, PNG, WebP). Maximo 5 fotos, 10MB cada una.'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Fotos subidas exitosamente',
        body: `{
  "success": true,
  "photos": [
    {
      "originalName": "IMG_001.jpg",
      "storagePath": "company-1/delivery-proofs/order-42/photo-1234567890-0-abc123.jpg",
      "size": 1234567,
      "type": "image/jpeg",
      "uploadedAt": "2024-11-28T14:30:00Z"
    }
  ],
  "uploadedCount": 1,
  "totalCount": 1,
  "orderId": 42,
  "orderNumber": "PICKUP00042",
  "message": "Todas las fotos subidas exitosamente",
  "info": "Las fotos son privadas. Usa /api/documents/[companyId]/[filename] para obtener URLs temporales."
}`
      },
      {
        status: 400,
        description: 'Error en validacion',
        body: `{
  "success": false,
  "error": "Maximo 5 fotos permitidas por orden"
}`
      }
    ],
    examples: [
      {
        language: 'javascript',
        label: 'JavaScript (React Native)',
        code: `import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const takeAndUploadPhoto = async (orderId, companyId) => {
  // Tomar foto con la camara
  const result = await launchCamera({
    mediaType: 'photo',
    quality: 0.8,
    maxWidth: 1920,
    maxHeight: 1080
  });

  if (result.didCancel || !result.assets?.[0]) return;

  const photo = result.assets[0];
  const formData = new FormData();
  formData.append('orderId', orderId);
  formData.append('companyId', companyId);
  formData.append('photos', {
    uri: photo.uri,
    type: photo.type,
    name: photo.fileName || 'photo.jpg'
  });

  const response = await fetch('/api/upload/delivery-photos', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${token}\`
    },
    body: formData
  });

  return response.json();
};`
      },
      {
        language: 'curl',
        label: 'cURL',
        code: `curl -X POST https://logirapid.com/api/upload/delivery-photos \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -F "orderId=42" \\
  -F "companyId=1" \\
  -F "photos=@/path/to/photo1.jpg" \\
  -F "photos=@/path/to/photo2.jpg"`
      }
    ]
  },

  // ============================================
  // OBTENER DOCUMENTOS PRIVADOS
  // ============================================
  {
    id: 'get-private-document',
    method: 'GET',
    path: '/api/documents/{companyId}/{filename}',
    title: 'Obtener URL Firmada de Documento',
    description: 'Genera una URL firmada temporal (1 hora) para acceder a un documento privado como fotos de entrega o firmas almacenadas.',
    headers: [
      {
        name: 'Authorization',
        type: 'string',
        required: true,
        description: 'Token JWT en formato: Bearer {token}'
      }
    ],
    pathParams: [
      {
        name: 'companyId',
        type: 'string',
        required: true,
        description: 'ID de la empresa'
      },
      {
        name: 'filename',
        type: 'string',
        required: true,
        description: 'Ruta del archivo en storage (ej: delivery-proofs/order-42/photo.jpg)'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'URL firmada generada',
        body: `{
  "success": true,
  "signedUrl": "https://supabase.storage/company-private-documents/...",
  "expiresIn": 3600
}`
      },
      {
        status: 404,
        description: 'Documento no encontrado',
        body: `{
  "success": false,
  "error": "Documento no encontrado"
}`
      }
    ],
    examples: [
      {
        language: 'javascript',
        label: 'JavaScript',
        code: `const getPhotoUrl = async (companyId, storagePath) => {
  // Extraer filename del storagePath (sin el prefijo company-X/)
  const filename = storagePath.replace(\`company-\${companyId}/\`, '');

  const response = await fetch(\`/api/documents/\${companyId}/\${filename}\`, {
    headers: { 'Authorization': \`Bearer \${token}\` }
  });
  const data = await response.json();
  return data.signedUrl;
};`
      }
    ]
  }
]

// Exportar grupos de endpoints
export const routesApiGroups = [
  {
    title: 'Rutas',
    description: 'Endpoints para gestion de rutas de entrega',
    endpoints: routesEndpoints.filter(e => e.path.includes('/routes') && !e.path.includes('stops'))
  },
  {
    title: 'Paradas de Ruta',
    description: 'Endpoint para obtener paradas con ordenes',
    endpoints: routesEndpoints.filter(e => e.path.includes('/stops'))
  },
  {
    title: 'Comprobantes de Entrega',
    description: 'Endpoints para crear y gestionar comprobantes de entrega (firma + fotos)',
    endpoints: routesEndpoints.filter(e => e.path.includes('/delivery-proofs'))
  },
  {
    title: 'Upload de Fotos',
    description: 'Endpoint para subir fotos de comprobante de entrega',
    endpoints: routesEndpoints.filter(e => e.path.includes('/upload/delivery-photos'))
  },
  {
    title: 'Documentos Privados',
    description: 'Endpoint para obtener URLs firmadas de documentos privados',
    endpoints: routesEndpoints.filter(e => e.path.includes('/documents/'))
  }
]
