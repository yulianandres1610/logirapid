# Marketing API - Documentación para OpenClaw

## Base URL
```
https://mercado.servisumic.com/api/mkt/ext
```

## Autenticación

Todas las peticiones requieren header `x-agent-token`:
```
x-agent-token: mkt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

El token se genera al crear el agente en: **Dashboard → Marketing → Agentes → Crear Agente**

Cada agente tiene su propio token. El sistema identifica automáticamente qué agente hace cada request.

---

## 1. POST /heartbeat — Estado en tiempo real

El agente reporta qué está haciendo. Llamar cada 30-60 segundos.

```json
{
  "status": "scraping",
  "action": "Buscando precios de Cerveza Corona en Grupo Ferreteros Habana",
  "target": "facebook.com/groups/ferreteros-habana",
  "progress": 45,
  "itemsProcessed": 23,
  "itemsFound": 8,
  "metadata": { "currentPage": 3, "totalPages": 7 }
}
```

**Status válidos:** `working`, `idle`, `scraping`, `analyzing`, `publishing`, `selling`, `auditing`, `error`

**Response:** `{ "success": true }`

---

## 2. POST /events — Log de eventos

Traza granular de cada acción. Batch o individual.

**Batch:**
```json
{
  "events": [
    {
      "type": "scrape_start",
      "status": "working",
      "action": "Iniciando scraping en ISASUR Market",
      "target": "isasur.com",
      "metadata": {}
    },
    {
      "type": "product_found",
      "status": "working",
      "action": "Encontrado: Cerveza Corona 355ml a $2.50",
      "target": "isasur.com",
      "metadata": { "price": 2.50, "currency": "USD" }
    },
    {
      "type": "error",
      "status": "error",
      "action": "Timeout al cargar página 5",
      "target": "isasur.com"
    }
  ]
}
```

**Individual:**
```json
{
  "type": "sale_completed",
  "status": "idle",
  "action": "Venta cerrada: $45.00 - 3 productos",
  "target": "whatsapp",
  "metadata": { "customerName": "Juan", "total": 45.00 }
}
```

**Tipos:** `scrape_start`, `scrape_end`, `product_found`, `product_matched`, `price_compared`, `suggestion_created`, `sale_started`, `sale_completed`, `campaign_published`, `audit_check`, `error`, `warning`, `info`

**Response:** `{ "success": true, "data": { "inserted": 3 } }`

---

## 3. POST /price-findings — Hallazgos de precios

Enviar precios encontrados en la competencia. El sistema auto-matchea con nuestro inventario.

```json
{
  "findings": [
    {
      "searchTerm": "Cerveza Corona 355ml",
      "foundName": "Corona Extra 355ml",
      "foundPrice": 2.50,
      "currency": "USD",
      "sourcePlatform": "facebook",
      "sourceName": "Grupo Ferreteros Habana",
      "sourceUrl": "https://facebook.com/groups/...",
      "matchConfidence": 0.92,
      "matchType": "similar"
    },
    {
      "searchTerm": "Arroz Guyanes 2Kg",
      "foundName": "Arroz Guyanes 2Kg",
      "foundPrice": 2.30,
      "currency": "USD",
      "sourcePlatform": "whatsapp",
      "sourceName": "Grupo Ventas Centro Habana",
      "matchConfidence": 0.99,
      "matchType": "exact",
      "productId": 42
    }
  ]
}
```

**matchType:** `exact` (barcode/SKU idéntico), `similar` (nombre parcial, confianza >= 0.8), `uncertain` (requiere validación)

**Auto-matching:** Si no envías `productId`, el sistema busca por nombre/SKU/barcode en el inventario.

**Response:**
```json
{
  "success": true,
  "data": {
    "inserted": 2,
    "matched": 1,
    "total": 2
  }
}
```

---

## 4. POST /suggest-campaign — Sugerir campaña

El estratega sugiere una campaña completa con scripts y tareas.

```json
{
  "name": "Semana de la Cerveza - Abril 2026",
  "description": "Promoción de cervezas importadas para competir con precios del mercado",
  "type": "promotion",
  "targetProducts": [
    { "productId": 42, "productName": "Corona Extra 355ml", "currentPrice": 3.00, "suggestedPrice": 2.50 }
  ],
  "targetChannels": ["facebook", "instagram", "whatsapp"],
  "discountType": "percentage",
  "discountValue": 15,
  "startDate": "2026-04-20T00:00:00Z",
  "endDate": "2026-04-27T00:00:00Z",
  "scripts": {
    "elevator": "Esta semana en Servisumic las cervezas importadas tienen 15% de descuento...",
    "social": {
      "facebook": "🍺 ¡SEMANA DE LA CERVEZA! 🍺\n\n15% de DESCUENTO en cervezas importadas...",
      "instagram": "🍺 SEMANA DE LA CERVEZA 🍺\n\n15% OFF...\n\n#Servisumic #Cerveza",
      "whatsapp": "¡Hola! 👋 Esta semana cervezas importadas con 15% de descuento..."
    },
    "video": {
      "hook": "¿Te gusta la cerveza fría? 🍺",
      "problem": "Encontrar cervezas importadas a buen precio no es fácil.",
      "solution": "En Servisumic tenemos Corona, Heineken y más con 15% de descuento.",
      "proof": "Más de 200 productos importados siempre en stock.",
      "offer": "Corona 355ml a solo $2.50 esta semana.",
      "cta": "Visítanos o escríbenos al +5352584700",
      "duration": "30-45 segundos"
    },
    "objections": [
      { "objection": "Está muy caro", "response": "Justamente esta semana tenemos 15% de descuento, es el mejor precio." },
      { "objection": "No tienen mi marca", "response": "Tenemos Corona, Heineken, Presidente y más. ¿Cuál buscas?" }
    ],
    "keyMessages": ["15% descuento en cervezas", "Stock garantizado", "Válido hasta 27 abril"],
    "hashtags": ["#Servisumic", "#Cerveza", "#Descuento", "#Cuba"],
    "targetAudience": "Adultos 21-55, La Habana, amantes de cerveza importada"
  },
  "tasks": [
    { "title": "Grabar video promocional", "description": "Ver script en tab Scripts", "type": "upload" },
    { "title": "Diseñar imagen Facebook 940x788", "type": "upload" },
    { "title": "Diseñar imagen Instagram 1080x1350", "type": "upload" },
    { "title": "Preparar stories", "type": "upload" },
    { "title": "Aprobar textos finales", "type": "approval" },
    { "title": "Subir material al sistema", "type": "upload" },
    { "title": "Publicar en canales", "type": "publish" }
  ],
  "schedule": {
    "facebook": "2026-04-20 10:00",
    "instagram": "2026-04-20 12:00",
    "whatsapp": "2026-04-20 09:00"
  }
}
```

**Tipos de campaña:** `promotion`, `price_match`, `seasonal`, `launch`, `clearance`, `bundle`

**Response:**
```json
{
  "success": true,
  "data": { "campaignId": 5, "tasksCreated": 7 }
}
```

> La campaña se crea con status `pending_approval`. El admin la revisa y aprueba desde el dashboard.

---

## 5. POST /report-sale — Reportar venta

El agente vendedor reporta una venta cerrada.

```json
{
  "customerPhone": "+5355551234",
  "customerName": "Juan Pérez",
  "channel": "whatsapp",
  "totalAmount": 45.00,
  "currency": "USD",
  "items": [
    { "productId": 42, "name": "Corona Extra 355ml", "quantity": 12, "price": 2.50 },
    { "productId": 55, "name": "Heineken 330ml", "quantity": 6, "price": 2.80 }
  ],
  "campaignId": 5,
  "orderNumber": "WA-2026-0042"
}
```

**Response:**
```json
{
  "success": true,
  "data": { "saleId": 12, "agentId": "seller-whatsapp-001" }
}
```

---

## 6. POST /publish-result — Resultado de publicación

El publicador reporta resultado de una publicación.

```json
{
  "campaignId": 5,
  "channel": "facebook",
  "platform": "facebook",
  "status": "published",
  "url": "https://facebook.com/servisumic/posts/123456",
  "notes": "Publicado con éxito, 45 likes en primera hora",
  "metadata": { "likes": 45, "shares": 12 }
}
```

**Status:** `published`, `failed`, `scheduled`

---

## 7. GET /products — Catálogo de productos

Obtener productos para matching de precios.

```
GET /api/mkt/ext/products?search=cerveza&category=Bebidas&limit=100
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "name": "Corona Extra 355ml",
      "sku": "BEB-COR-355",
      "barcode": "7501064199035",
      "category": "Bebidas",
      "sellingPrice": 3.00,
      "costPrice": 2.10,
      "currency": "USD",
      "unit": "unidad",
      "stockOnHand": 240
    }
  ],
  "total": 15
}
```

---

## 8. GET /campaigns/active — Campañas activas

Para vendedores y publicadores: obtener campañas aprobadas con scripts.

```
GET /api/mkt/ext/campaigns/active
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 5,
      "name": "Semana de la Cerveza",
      "type": "promotion",
      "status": "approved",
      "targetChannels": ["facebook", "instagram", "whatsapp"],
      "scripts": { "elevator": "...", "social": {...}, "video": {...} },
      "tasks": [...],
      "schedule": { "facebook": "2026-04-20 10:00" },
      "startDate": "2026-04-20",
      "endDate": "2026-04-27"
    }
  ]
}
```

---

## 9. GET /channels — Canales asignados

Obtener grupos/redes asignados al agente.

```
GET /api/mkt/ext/channels?purpose=research
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "platform": "whatsapp",
      "name": "Grupo Ferreteros Habana",
      "identifier": "https://chat.whatsapp.com/abc123",
      "purpose": "research",
      "memberCount": 150,
      "status": "active"
    }
  ]
}
```

---

## Tipos de Agentes

| Tipo | ID | Qué hace |
|------|----|----------|
| Investigador | `investigator` | Busca precios en redes, grupos, web |
| Estratega | `strategist` | Analiza datos, sugiere campañas, crea scripts |
| Vendedor | `seller` | Vende por WhatsApp, Telegram, Messenger |
| Publicador | `publisher` | Publica contenido aprobado en redes |
| Auditor | `auditor` | Monitorea agentes, verifica calidad |
| Personalizado | `custom` | Tareas específicas definidas por admin |

---

## Flujo Completo

```
0. SETUP
   └─ Admin crea agentes en Dashboard → Marketing → Agentes
   └─ Admin registra canales (grupos WhatsApp, FB, Telegram)
   └─ Cada agente recibe su token mkt_xxxx...
   └─ OpenClaw configura cada agente con su token

1. INVESTIGACIÓN (Agente investigator)
   ├─ GET /ext/channels → Obtener grupos asignados
   ├─ POST /ext/heartbeat → "Scraping precios en Grupo Ferreteros"
   ├─ GET /ext/products → Catálogo para matching
   ├─ (investiga en grupos, web, redes...)
   ├─ POST /ext/price-findings → Enviar hallazgos (batch)
   ├─ POST /ext/events → Log granular de cada hallazgo
   └─ Dashboard muestra hallazgos en tiempo real

2. ESTRATEGIA (Agente strategist)
   ├─ POST /ext/heartbeat → "Analizando datos de precios"
   ├─ (analiza hallazgos, detecta oportunidades)
   ├─ POST /ext/suggest-campaign → Sugerir campaña con scripts + tareas
   └─ Campaña queda en "pending_approval"

3. APROBACIÓN (Admin en Dashboard)
   ├─ Dashboard → Campañas → Ver campaña sugerida
   ├─ Revisar: Scripts, Precios, Productos target
   ├─ Click "Aprobar" → status = "approved"
   └─ Se activan las tareas para el equipo

4. PREPARACIÓN (Equipo humano)
   ├─ Ver tareas en tab "Tareas" de la campaña
   ├─ Grabar video (usando script del tab Scripts)
   ├─ Diseñar imágenes (FB 940x788, IG 1080x1350)
   ├─ Subir material en tab "Material"
   ├─ Marcar tareas completadas
   └─ Admin verifica → cambia status a "publishing"

5. PUBLICACIÓN (Agente publisher)
   ├─ GET /ext/campaigns/active → Obtener campañas para publicar
   ├─ POST /ext/heartbeat → "Publicando en Facebook"
   ├─ (publica según schedule de la campaña)
   ├─ POST /ext/publish-result → Reportar resultado
   └─ Campaña pasa a "completed" cuando todo se publicó

6. VENTAS (Agente seller)
   ├─ GET /ext/campaigns/active → Scripts y precios activos
   ├─ POST /ext/heartbeat → "Atendiendo cliente WhatsApp"
   ├─ (usa scripts para vender, maneja objeciones)
   ├─ POST /ext/report-sale → Reportar venta cerrada
   └─ Dashboard → Ventas muestra ranking

7. AUDITORÍA (Agente auditor)
   ├─ POST /ext/heartbeat → "Verificando agentes"
   ├─ POST /ext/events → Reportar anomalías
   └─ Dashboard → Actividad muestra todo en tiempo real
```

---

## Dashboard (para el equipo humano)

| Página | URL | Función |
|--------|-----|---------|
| Dashboard | `/market/marketing` | KPIs, posición precios, top agente |
| Agentes | `/market/marketing/agents` | Crear/gestionar agentes con tokens |
| En Vivo | `/market/marketing/activity` | Actividad en tiempo real (8s refresh) |
| Precios | `/market/marketing/prices` | Hallazgos de precios, comparativa |
| Campañas | `/market/marketing/campaigns` | Lista + aprobar/rechazar |
| Campaña | `/market/marketing/campaigns/[id]` | 5 tabs: Resumen, Scripts, Tareas, Material, Publicación |
| Canales | `/market/marketing/channels` | Gestión grupos/redes |
| Ventas | `/market/marketing/sales` | Ranking agentes vendedores |

---

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| 401 | Token inválido o agente desactivado |
| 400 | Campos requeridos faltantes |
| 404 | Recurso no encontrado |
| 500 | Error interno |

## Frecuencia Recomendada

- **Heartbeat**: cada 30-60 segundos mientras trabaja
- **Events**: al iniciar/terminar cada tarea importante
- **Price findings**: batch de hasta 500 items por request
- **Productos**: cache local, refrescar cada 5-10 minutos

## Retención de Datos

- Eventos de actividad: 7 días (auto-cleanup)
- Hallazgos de precios: permanente
- Campañas: permanente
- Ventas: permanente
