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

## 8. Registrar Agentes de IA

Registra o actualiza agentes de cualquier tipo: ventas, investigación de mercado, diseño de campañas.

```
POST /api/marketing-intel/external/agents
Content-Type: application/json
```

**Body:**
```json
{
  "agents": [
    {
      "agentId": "sales-whatsapp-001",
      "name": "María Ventas",
      "channel": "whatsapp",
      "role": "sales",
      "capabilities": ["sell", "customer_support", "order_creation"],
      "description": "Agente de ventas WhatsApp especializado en ferretería",
      "model": "gpt-4"
    },
    {
      "agentId": "research-prices-001",
      "name": "Investigador de Precios",
      "channel": "research",
      "role": "research",
      "capabilities": ["price_research", "competitor_analysis", "market_trends"],
      "description": "Investiga precios de competencia en tiempo real"
    },
    {
      "agentId": "campaign-designer-001",
      "name": "Diseñador de Campañas",
      "channel": "campaign",
      "role": "campaign",
      "capabilities": ["campaign_design", "script_writing", "social_media", "video_scripts", "branding"],
      "description": "Diseña campañas completas con scripts de venta para video, redes sociales y WhatsApp"
    },
    {
      "agentId": "analyst-001",
      "name": "Analista Comercial",
      "channel": "research",
      "role": "analyst",
      "capabilities": ["market_analysis", "pricing_strategy", "pricelist_design", "trend_detection"],
      "description": "Analiza tendencias del mercado y sugiere estrategias de precios"
    }
  ]
}
```

**Roles disponibles:**

| Rol | Descripción | Capabilities típicas |
|-----|-------------|---------------------|
| `sales` | Agente de venta directa (WhatsApp, web) | `sell`, `customer_support`, `order_creation`, `upsell` |
| `research` | Investigación de precios y competencia | `price_research`, `competitor_analysis`, `market_trends`, `web_scraping` |
| `campaign` | Diseño de campañas y contenido | `campaign_design`, `script_writing`, `social_media`, `video_scripts`, `branding` |
| `analyst` | Análisis de datos y estrategia | `market_analysis`, `pricing_strategy`, `pricelist_design`, `trend_detection` |

**Response:**
```json
{
  "success": true,
  "data": { "created": 3, "updated": 1, "total": 4 },
  "message": "3 agentes creados, 1 actualizados"
}
```

---

### Listar Agentes Registrados

```
GET /api/marketing-intel/external/agents
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "agentId": "sales-whatsapp-001",
      "name": "María Ventas",
      "channel": "whatsapp",
      "status": "active",
      "totalSales": 1250.00,
      "totalOrders": 45,
      "avgOrderValue": 27.78,
      "metadata": {
        "role": "sales",
        "capabilities": ["sell", "customer_support"],
        "model": "gpt-4"
      },
      "createdAt": "2026-04-10T10:00:00Z",
      "updatedAt": "2026-04-10T15:30:00Z"
    }
  ]
}
```

---

## 9. Reportar Actividad en Tiempo Real

Permite que los agentes reporten qué están haciendo en cada momento. El dashboard muestra esta información en vivo (auto-refresh cada 10 segundos).

```
POST /api/marketing-intel/external/activity
Content-Type: application/json
```

**Body:**
```json
{
  "agentId": "research-prices-001",
  "status": "working",
  "action": "Investigando precios de pintura en Ferretería El Rápido",
  "details": "Comparando 15 productos de la categoría Pinturas y Recubrimientos",
  "progress": 45
}
```

**Campos:**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `agentId` | string | Sí | ID del agente que reporta |
| `status` | string | No | `working`, `idle`, `error`, `offline` (default: `working`) |
| `action` | string | Sí | Descripción de lo que está haciendo el agente |
| `details` | string | No | Contexto adicional |
| `progress` | number | No | Porcentaje de progreso 0-100 |
| `metadata` | object | No | Datos adicionales libres |

**Response:**
```json
{
  "success": true
}
```

**Ejemplos de uso por tipo de agente:**

```json
// Research Agent investigando
{
  "agentId": "research-prices-001",
  "status": "working",
  "action": "Escaneando precios en marketplace Revolico",
  "details": "Categoría: Alimentos - 23 de 50 productos procesados",
  "progress": 46
}

// Research Agent comparando
{
  "agentId": "research-prices-001",
  "status": "working",
  "action": "Comparando precios de Arroz Guyanes 2Kg con 5 competidores",
  "details": "Nuestro precio: $2.50 | Competencia: $2.10 - $2.80",
  "progress": 80
}

// Sales Agent atendiendo cliente
{
  "agentId": "sales-whatsapp-001",
  "status": "working",
  "action": "Atendiendo cliente via WhatsApp",
  "details": "Cliente pregunta por precios de pinturas",
  "progress": 0
}

// Sales Agent cerrando venta
{
  "agentId": "sales-whatsapp-001",
  "status": "working",
  "action": "Cerrando venta - 3 productos, $15.50 USD",
  "details": "Cliente: Juan Pérez | Arroz x3 + Frijol x5"
}

// Campaign Agent diseñando
{
  "agentId": "campaign-designer-001",
  "status": "working",
  "action": "Diseñando campaña Semana de la Ferretería",
  "details": "Escribiendo script de video - sección: hook",
  "progress": 30
}

// Analyst completó análisis
{
  "agentId": "analyst-001",
  "status": "idle",
  "action": "Análisis de precios completado",
  "details": "3 sugerencias de precio enviadas al dashboard"
}

// Agent se desconecta
{
  "agentId": "research-prices-001",
  "status": "offline",
  "action": "Desconectado - tarea completada"
}
```

**Frecuencia recomendada de heartbeat:**
- Cada 30-60 segundos mientras trabaja
- Al iniciar y terminar cada tarea
- Al cambiar de status

---

## 9b. Traza de Trabajo (Agent Events)

Log granular de cada acción del agente. Permite ver en el dashboard exactamente qué sitio está scrapeando, qué producto comparó, qué match encontró, qué error tuvo.

```
POST /api/marketing-intel/external/agent-events
Content-Type: application/json
```

**Body (batch):**
```json
{
  "events": [
    {
      "agentId": "research-prices-001",
      "type": "scrape_start",
      "level": "info",
      "text": "Iniciando scraping de precios en ISASUR Market",
      "target": "isasur.com",
      "url": "https://isasur.com/alimentos"
    },
    {
      "agentId": "research-prices-001",
      "type": "product_found",
      "level": "info",
      "text": "Encontrado: Arroz Guyanes 2Kg a $2.30",
      "target": "isasur.com",
      "productName": "Arroz Guyanes 2Kg"
    },
    {
      "agentId": "research-prices-001",
      "type": "product_matched",
      "level": "success",
      "text": "Match: Arroz Guyanes 2Kg → Nuestro ID #42 (diff: -$0.20)",
      "productId": 42,
      "productName": "Arroz Guyanes 2Kg"
    },
    {
      "agentId": "research-prices-001",
      "type": "error",
      "level": "error",
      "text": "Timeout al scrappear página 3 de ISASUR",
      "target": "isasur.com",
      "url": "https://isasur.com/alimentos?page=3"
    }
  ]
}
```

**Body (evento individual):**
```json
{
  "agentId": "sales-whatsapp-001",
  "type": "sale_completed",
  "level": "success",
  "text": "Venta cerrada: $15.50 USD - 3 productos",
  "metadata": { "customerName": "Juan Pérez", "orderTotal": 15.50 }
}
```

**Tipos de evento:**

| type | Uso |
|------|-----|
| `scrape_start` | Inicio de scraping en un sitio |
| `scrape_end` | Fin de scraping |
| `product_found` | Producto encontrado en competidor |
| `product_matched` | Producto matcheado con nuestro catálogo |
| `price_compared` | Comparación de precio realizada |
| `suggestion_created` | Sugerencia generada |
| `sale_started` | Inicio de conversación de venta |
| `sale_completed` | Venta cerrada |
| `campaign_created` | Campaña diseñada |
| `batch_start` | Inicio de batch de procesamiento |
| `batch_end` | Fin de batch |
| `error` | Error genérico |
| `warning` | Advertencia |
| `info` | Información general |

**Niveles:** `info`, `warning`, `error`, `success`

**Dashboard:** `https://mercado.servisumic.com/dashboard/market/marketing-intel/activity`
- Se actualiza cada 8 segundos
- Centro de control con tarjetas por agente (gradient por rol)
- Barra de progreso, items procesados/matched/errores
- Feed lateral de eventos con dots de color por nivel
- Un agente se considera "online" si tuvo heartbeat en los últimos 5 minutos
- Retención de eventos: 7 días automático

---

## 10. Resumen de Endpoints

| # | Método | Endpoint | Descripción |
|---|--------|----------|-------------|
| 1 | GET | `/external/products` | Catálogo de productos |
| 2 | GET | `/external/current-prices` | Precios actuales por ID/SKU |
| 3 | POST | `/external/competitors` | Registrar competidores |
| 4 | POST | `/external/competitor-prices` | Enviar precios de competencia (batch) |
| 5 | POST | `/external/agent-sales` | Reportar venta de agente IA |
| 6 | POST | `/external/suggestions` | Enviar sugerencias de IA |
| 7 | POST | `/external/campaigns` | Crear campaña con scripts de venta |
| 8 | GET | `/external/agents` | Listar agentes registrados |
| 9 | POST | `/external/agents` | Registrar/actualizar agentes |
| 10 | POST | `/external/agent-heartbeat` | **Estado en tiempo real (UPSERT)** |
| 11 | POST | `/external/agent-events` | **Traza de trabajo granular (batch)** |

---

## Flujo Recomendado para OpenClaw

```
0. SETUP INICIAL (una sola vez)
   ├─ POST /external/agents → Registrar todos los agentes (sales, research, campaign, analyst)
   └─ Cada agente recibe su agentId único para tracking

1. INVESTIGACIÓN (Research Agent: research-prices-001)
   ├─ POST /external/activity → "Iniciando investigación de precios"
   ├─ GET /external/products → Obtener catálogo completo Servisumic
   ├─ POST /external/activity → "Escaneando precios en competidor X" (progress: 20)
   ├─ Investigar precios de competidores (web scraping, marketplaces, etc.)
   ├─ POST /external/competitors → Registrar competidores encontrados
   ├─ POST /external/competitor-prices → Enviar batch de precios (auto-matchea + auto-sugiere)
   └─ POST /external/suggestions → Sugerir ajustes de precio basados en datos

2. ANÁLISIS (Analyst Agent: analyst-001)
   ├─ Analizar datos de precios acumulados
   ├─ Detectar tendencias y oportunidades
   ├─ POST /external/suggestions → Sugerir listas de precios mayoristas por volumen
   └─ POST /external/suggestions → Sugerir bundles y estrategias de pricing

3. CAMPAÑAS (Campaign Agent: campaign-designer-001)
   ├─ Diseñar campaña con productos target basada en datos del mercado
   ├─ Escribir scripts de venta completos:
   │   ├─ Elevator pitch (30 segundos)
   │   ├─ Posts Facebook / Instagram / WhatsApp
   │   ├─ Script de video (hook → problema → solución → prueba → oferta → CTA)
   │   ├─ Manejo de objeciones
   │   ├─ Key messages y hashtags
   │   └─ Target audience
   ├─ POST /external/campaigns → Crear campaña completa con scripts
   └─ El admin aprueba y activa desde el dashboard

4. VENTAS (Sales Agent: sales-whatsapp-001)
   ├─ Atender clientes via WhatsApp usando scripts de campaña activa
   ├─ Manejar objeciones con respuestas pre-diseñadas
   ├─ Cerrar venta
   ├─ POST /external/agent-sales → Reportar venta atribuida al agente
   └─ El ranking se actualiza automáticamente en el dashboard

5. MONITOREO CONTINUO (todos los agentes)
   ├─ Research: Monitorear precios de competencia periódicamente
   ├─ Analyst: Revisar métricas de campañas activas
   ├─ Campaign: Ajustar scripts según resultados
   └─ Sales: Reportar feedback de clientes
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
