# Marketing Intelligence API - Documentación de Integración OpenClaw

## Base URL
```
https://mercado.servisumic.com/api/marketing-intel/external
```

## Autenticación

Todas las peticiones requieren header `x-api-key`:

```
x-api-key: ocl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

La API key se genera desde: **Dashboard → Marketing → Configuración → Generar API Key**

---

## 1. Obtener Catálogo de Productos

Retorna nuestros productos para que los agentes puedan hacer matching con los de la competencia.

```
GET /api/marketing-intel/external/products
```

**Query params:**
| Param | Tipo | Descripción |
|-------|------|-------------|
| search | string | Buscar por nombre, SKU o barcode |
| category | string | Filtrar por categoría |
| limit | number | Máximo 500 (default 200) |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "name": "Arroz Guyanes 2Kg",
      "sku": "MKX3Q0XV",
      "barcode": "2005127899962",
      "category": "Alimentos",
      "sellingPrice": 2.50,
      "costPrice": 1.80,
      "currency": "USD",
      "unit": "unidad",
      "stockOnHand": 150
    }
  ],
  "total": 156
}
```

---

## 2. Obtener Precios Actuales

Consultar precios de productos específicos.

```
GET /api/marketing-intel/external/current-prices?productIds=42,43,44
GET /api/marketing-intel/external/current-prices?skus=MKX3Q0XV,MKX3Q0XW
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "name": "Arroz Guyanes 2Kg",
      "sku": "MKX3Q0XV",
      "sellingPrice": 2.50,
      "costPrice": 1.80,
      "currency": "USD"
    }
  ]
}
```

---

## 3. Registrar Competidores

Registra o actualiza un competidor. Si ya existe uno con el mismo nombre, lo actualiza.

```
POST /api/marketing-intel/external/competitors
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Tienda El Rápido",
  "location": "Calle 10, La Habana",
  "websiteUrl": "https://elrapido.com",
  "metadata": {
    "type": "ferreteria",
    "size": "medium",
    "notes": "Competidor directo en zona oeste"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": { "id": 5, "name": "Tienda El Rápido" }
}
```

---

## 4. Enviar Precios de la Competencia

Envía un batch de precios encontrados en competidores. El sistema automáticamente:
- Matchea productos por nombre/SKU (fuzzy)
- Calcula diferencia de precios
- Genera sugerencias si somos >20% más caros

```
POST /api/marketing-intel/external/competitor-prices
Content-Type: application/json
```

**Body:**
```json
{
  "prices": [
    {
      "competitorId": 5,
      "productName": "Arroz Guyanes 2Kg",
      "productSku": "2005127899962",
      "competitorPrice": 2.30,
      "currency": "USD",
      "sourceUrl": "https://elrapido.com/arroz-guyanes",
      "confidenceScore": 0.95
    },
    {
      "competitorId": 5,
      "productName": "Frijol Negro 500g",
      "competitorPrice": 0.95,
      "currency": "USD",
      "confidenceScore": 0.85
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inserted": 2,
    "matched": 2,
    "total": 2,
    "autoSuggestions": 1
  }
}
```

> `matched`: cuántos productos se asociaron con nuestro catálogo
> `autoSuggestions`: cuántas sugerencias de reducción de precio se crearon automáticamente

---

## 5. Reportar Venta de Agente IA

Registra una venta realizada por un agente de venta IA (WhatsApp, web, etc.). Si el agente no existe, se crea automáticamente.

```
POST /api/marketing-intel/external/agent-sales
Content-Type: application/json
```

**Body:**
```json
{
  "agentId": "agent-whatsapp-001",
  "agentName": "María IA",
  "channel": "whatsapp",
  "customerPhone": "+5355551234",
  "customerName": "Juan Pérez",
  "totalAmount": 15.50,
  "currency": "USD",
  "orderNumber": "ORD-2026-0045",
  "items": [
    {
      "productId": 42,
      "name": "Arroz Guyanes 2Kg",
      "quantity": 3,
      "price": 2.50
    },
    {
      "productId": 55,
      "name": "Frijol Negro 500g",
      "quantity": 5,
      "price": 1.12
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "saleId": 12,
    "agentId": "agent-whatsapp-001",
    "amount": 15.50
  }
}
```

---

## 6. Enviar Sugerencias de IA

Envía sugerencias de promociones, cambios de precio, bundles o listas de precios mayoristas.

```
POST /api/marketing-intel/external/suggestions
Content-Type: application/json
```

**Body:**
```json
{
  "suggestions": [
    {
      "type": "price_reduction",
      "title": "Reducir precio de Arroz Guyanes",
      "description": "El competidor 'El Rápido' vende a $2.30. Recomendamos igualar para mantener competitividad.",
      "products": [
        {
          "productId": 42,
          "productName": "Arroz Guyanes 2Kg",
          "currentPrice": 2.50,
          "suggestedPrice": 2.30,
          "reason": "Price match con competencia directa"
        }
      ],
      "marketData": {
        "competitorAvgPrice": 2.25,
        "competitorMinPrice": 2.10,
        "competitorMaxPrice": 2.45,
        "sampleSize": 5
      },
      "estimatedImpact": {
        "revenueChange": -8,
        "volumeChange": 15,
        "marginChange": -3.2
      }
    },
    {
      "type": "volume_discount",
      "title": "Lista mayorista para Pinturas",
      "description": "Crear escalones de descuento por volumen para la categoría Pinturas",
      "products": [
        {
          "productId": 100,
          "productName": "Pintura Blanca 1GL",
          "currentPrice": 8.50,
          "suggestedPrice": 7.20,
          "reason": "10+ unidades: 15% descuento"
        }
      ],
      "estimatedImpact": {
        "revenueChange": 12,
        "volumeChange": 30
      }
    }
  ]
}
```

**Tipos válidos:** `price_reduction`, `bundle`, `volume_discount`, `pricelist`, `seasonal`, `clearance`

**Response:**
```json
{
  "success": true,
  "data": { "created": 2, "total": 2 }
}
```

> Las sugerencias quedan en estado `pending` hasta que un admin las apruebe o rechace desde el dashboard.
> Al aprobar con `applyToProducts: true`, los precios se actualizan automáticamente en el catálogo.

---

## 7. Crear Campaña con Scripts de Venta

Crea una campaña completa con toda la estructura de marketing: scripts para videos, redes sociales, objeciones, y materiales.

```
POST /api/marketing-intel/external/campaigns
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Semana de la Ferretería - Abril 2026",
  "description": "Campaña de descuentos en herramientas y pinturas para impulsar ventas de temporada",
  "type": "seasonal",
  "startDate": "2026-04-15T00:00:00Z",
  "endDate": "2026-04-22T00:00:00Z",
  "discountType": "percentage",
  "discountValue": 15,
  "budget": 500,
  "targetProducts": [
    {
      "productId": 100,
      "productName": "Pintura Blanca 1GL",
      "originalPrice": 8.50,
      "campaignPrice": 7.22
    },
    {
      "productId": 101,
      "productName": "Brocha 3 pulgadas",
      "originalPrice": 2.00,
      "campaignPrice": 1.70
    }
  ],
  "targetCategories": ["Pinturas y Recubrimientos", "Ferretería"],
  "suggestionReason": "Temporada de lluvias: incrementar ventas de pinturas impermeables",

  "salesScripts": {
    "elevator": "En Servisumic esta semana toda la línea de pinturas y herramientas tiene 15% de descuento. Es el mejor momento para ese proyecto de renovación que tienes pendiente. Pasa por nuestra tienda o consulta nuestro catálogo online.",

    "social": {
      "facebook": "🎨 ¡SEMANA DE LA FERRETERÍA! 🔨\n\n15% de DESCUENTO en toda la línea de pinturas y herramientas.\n\n✅ Pintura Blanca 1GL - Antes $8.50 → Ahora $7.22\n✅ Brochas desde $1.70\n✅ + de 50 productos en oferta\n\n📍 Carretera a Berroa Km 1.5\n📱 +5352584700\n🌐 catalogo.servisumic.com\n\n¡No te lo pierdas! Ofertas válidas hasta el 22 de abril.",

      "instagram": "🎨 SEMANA DE LA FERRETERÍA 🔨\n\n15% OFF en pinturas y herramientas\n\nTu proyecto de renovación te espera ✨\n\n📍 Servisumic - Carretera a Berroa\n📱 +5352584700\n\n#Servisumic #Ferretería #Pinturas #Descuento #Cuba #Ofertas #Renovación #Hogar",

      "whatsapp": "¡Hola! 👋\n\nEsta semana en Servisumic tenemos 15% de descuento en pinturas y herramientas.\n\nAlgunos precios:\n🎨 Pintura Blanca 1GL → $7.22 (antes $8.50)\n🖌️ Brochas desde $1.70\n\nVálido hasta el 22 de abril.\n\n¿Te interesa algún producto? Te envío el catálogo completo 📋\n\ncatalogo.servisumic.com"
    },

    "video": {
      "hook": "¿Sabes cuánto puedes ahorrarte esta semana en Servisumic? 👀",
      "problem": "Renovar tu casa puede ser caro, y encontrar buenos precios en pinturas y herramientas no es fácil.",
      "solution": "En Servisumic tenemos toda la línea de pinturas y herramientas con 15% de descuento. Más de 50 productos en oferta.",
      "proof": "Somos la ferretería con los mejores precios de la zona. Más de 200 productos en stock, siempre disponibles.",
      "offer": "Pintura Blanca 1 galón a solo $7.22 — antes $8.50. Brochas desde $1.70. Y mucho más.",
      "cta": "Visítanos en Carretera a Berroa Km 1.5 o consulta catalogo.servisumic.com. ¡Llámanos al +5352584700!",
      "duration": "30-45 segundos"
    },

    "objections": [
      {
        "objection": "Los precios están muy altos",
        "response": "Justamente esta semana tenemos 15% de descuento. Es el mejor precio que vas a encontrar en la zona."
      },
      {
        "objection": "No sé qué pintura necesito",
        "response": "Nuestro equipo te asesora. Dinos el espacio que quieres pintar y te recomendamos la cantidad exacta y el tipo de pintura."
      },
      {
        "objection": "Puedo encontrarlo más barato en otro lugar",
        "response": "Hacemos match de precios. Si encuentras un precio menor, lo igualamos. Además tenemos la garantía de calidad Servisumic."
      }
    ],

    "keyMessages": [
      "15% de descuento en pinturas y herramientas",
      "Más de 50 productos en oferta",
      "Válido hasta el 22 de abril",
      "Stock disponible garantizado",
      "Asesoría técnica incluida"
    ],

    "hashtags": [
      "#Servisumic", "#SemanaFerreteria", "#Pinturas", "#Descuento",
      "#Cuba", "#Ofertas", "#Ferretería", "#Renovación"
    ],

    "targetAudience": "Propietarios de viviendas en La Habana que necesitan materiales de construcción y pinturas para renovación. Edad 25-55, ambos géneros."
  }
}
```

**Tipos válidos de campaña:** `promotion`, `price_match`, `clearance`, `seasonal`, `launch`, `bundle`

**Response:**
```json
{
  "success": true,
  "data": { "id": 3, "name": "Semana de la Ferretería - Abril 2026", "type": "seasonal" },
  "message": "Campaña creada con scripts de venta"
}
```

---

## Estructura de `salesScripts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `elevator` | string | Pitch de 30 segundos para venta directa |
| `social.facebook` | string | Post completo para Facebook |
| `social.instagram` | string | Post para Instagram con hashtags |
| `social.whatsapp` | string | Mensaje de WhatsApp para envío masivo |
| `video.hook` | string | Primeros 3 segundos del video (gancho) |
| `video.problem` | string | Problema que resuelve el producto |
| `video.solution` | string | Nuestro producto como solución |
| `video.proof` | string | Prueba social, datos, testimonios |
| `video.offer` | string | La oferta específica con precios |
| `video.cta` | string | Llamada a la acción final |
| `video.duration` | string | Duración sugerida del video |
| `objections` | array | Objeciones comunes y respuestas |
| `keyMessages` | string[] | Mensajes clave de la campaña |
| `hashtags` | string[] | Hashtags para redes sociales |
| `targetAudience` | string | Descripción del público objetivo |

---

## Flujo Recomendado para OpenClaw

```
1. INVESTIGACIÓN (Research Agent)
   ├─ GET /external/products → Obtener catálogo Servisumic
   ├─ Investigar precios de competidores (web scraping, etc.)
   ├─ POST /external/competitors → Registrar competidores encontrados
   ├─ POST /external/competitor-prices → Enviar batch de precios
   └─ POST /external/suggestions → Sugerir ajustes de precio

2. CAMPAÑAS (Campaign Agent)
   ├─ Analizar datos de precios y tendencias
   ├─ Diseñar campaña con productos target
   ├─ Escribir scripts de venta (video, social, WhatsApp)
   ├─ POST /external/campaigns → Crear campaña completa
   └─ El admin aprueba desde el dashboard

3. VENTAS (Sales Agent - WhatsApp)
   ├─ Atender clientes via WhatsApp
   ├─ Usar scripts de campaña activa
   ├─ Cerrar venta
   └─ POST /external/agent-sales → Reportar venta atribuida al agente

4. MONITOREO (continuo)
   ├─ GET /external/current-prices → Verificar nuestros precios actuales
   ├─ Comparar con últimos datos de competencia
   └─ POST /external/suggestions → Nuevas sugerencias si hay cambios
```

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 401 | API key inválida, expirada o desactivada |
| 400 | Campos requeridos faltantes |
| 500 | Error interno del servidor |

---

## Rate Limits

No hay rate limits estrictos actualmente. Recomendamos:
- Máximo 100 requests/minuto
- Batch de precios: máximo 500 items por request
- Polling de productos: cada 5-10 minutos máximo

---

## Contacto

- Dashboard: `https://mercado.servisumic.com/dashboard/market/marketing-intel`
- Configuración API keys: `https://mercado.servisumic.com/dashboard/market/marketing-intel/settings`
