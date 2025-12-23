# LogiRapid Print Service

Servicio de impresión silenciosa para LogiRapid. Permite imprimir documentos automáticamente desde el sistema sin intervención del usuario.

## Características

- Impresión silenciosa de recibos POS (ESC/POS para impresoras térmicas 80mm)
- Impresión de etiquetas de envío (4x6 pulgadas)
- Impresión de etiquetas de productos con códigos de barras
- Detección automática de impresoras locales
- Soporte multiplataforma (Windows, macOS, Linux)
- Reconexión automática y reintentos
- System tray para funcionamiento en segundo plano

## Instalación

### Requisitos previos

- Node.js 18 o superior
- npm o yarn

### Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

### Compilar para producción

```bash
# Compilar la aplicación
npm run build

# Crear instaladores
npm run package        # Plataforma actual
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux
npm run package:all    # Todas las plataformas
```

Los instaladores se generan en la carpeta `release/`.

## Configuración

1. En LogiRapid, ve a **Administración > Servicios de Impresión**
2. Crea un nuevo servicio de impresión
3. Copia las credenciales (API Key y API Secret)
4. En la app, ingresa:
   - URL del servidor (ej: `https://app.logirapid.com`)
   - ID del servicio
   - API Key
   - API Secret

## Tipos de documentos soportados

| Tipo | Formato | Impresora recomendada |
|------|---------|----------------------|
| `pos_receipt` | ESC/POS | Térmica 80mm (Epson TM-T88, Star TSP) |
| `shipping_label` | PDF 4x6 | Etiquetas (Zebra ZD, DYMO 4XL) |
| `product_label` | PDF | Etiquetas pequeñas (Brother QL, DYMO) |
| `invoice` | PDF | Impresora estándar |

## Flujo de trabajo

1. La app se registra con el servidor al iniciar
2. Detecta impresoras locales y las reporta
3. Polling cada 5 segundos para trabajos pendientes
4. Al recibir un trabajo:
   - Genera el documento (ESC/POS o PDF)
   - Imprime en la impresora correspondiente
   - Reporta estado (completado o fallido)
5. Heartbeat cada 30 segundos para mantener conexión

## Estructura del proyecto

```
logirapid-print-service/
├── src/
│   ├── main/           # Proceso principal Electron
│   │   ├── index.ts    # Entry point
│   │   └── preload.ts  # Preload script
│   │
│   ├── renderer/       # UI React
│   │   ├── pages/
│   │   │   ├── Setup.tsx      # Configuración inicial
│   │   │   └── Dashboard.tsx  # Panel principal
│   │   └── App.tsx
│   │
│   ├── services/       # Lógica de negocio
│   │   ├── api-client.ts      # Cliente API LogiRapid
│   │   ├── printer-service.ts # Detección de impresoras
│   │   └── job-processor.ts   # Procesador de trabajos
│   │
│   ├── documents/      # Generadores de documentos
│   │   ├── pos-receipt.ts     # Recibos ESC/POS
│   │   ├── shipping-label.ts  # Etiquetas PDF
│   │   └── product-label.ts   # Etiquetas productos
│   │
│   └── store/          # Almacenamiento local
│       └── credentials.ts     # Credenciales encriptadas
│
└── resources/          # Recursos (iconos)
```

## API Endpoints utilizados

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/print/services/{id}/register` | POST | Registro inicial |
| `/api/print/services/{id}/heartbeat` | POST | Heartbeat periódico |
| `/api/print/jobs/pending` | GET | Obtener trabajos pendientes |
| `/api/print/jobs/{id}/status` | POST | Actualizar estado de trabajo |
| `/api/webhooks/print` | POST | Enviar eventos webhook |

## Seguridad

- Las credenciales se almacenan encriptadas usando `electron safeStorage`
- Comunicación HTTPS con el servidor
- Firma HMAC para webhooks

## Solución de problemas

### La impresora no se detecta

- Verifica que la impresora esté encendida y conectada
- En Windows, verifica que tenga un driver instalado
- En macOS/Linux, verifica que esté en CUPS (`lpstat -p`)

### Error de conexión

- Verifica la URL del servidor
- Verifica que el servicio esté activo en LogiRapid
- Verifica las credenciales

### Impresión no funciona

- Verifica que la impresora esté en línea
- Para ESC/POS, verifica que sea una impresora térmica compatible
- Revisa los logs en la consola de desarrollo
