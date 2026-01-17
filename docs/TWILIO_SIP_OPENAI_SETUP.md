# Configuracion de Twilio SIP + OpenAI Realtime

Esta guia explica como configurar la integracion SIP entre Twilio y OpenAI Realtime para llamadas telefonicas con IA conversacional de baja latencia (~200ms).

## Arquitectura

```
Usuario llama → Twilio Phone → SIP Trunk → OpenAI Realtime API
                                                   ↓
                                            Webhook a tu servidor
                                                   ↓
                                            Acepta y configura sesion
                                                   ↓
                                            OpenAI maneja la conversacion
```

## Requisitos Previos

1. **Cuenta de Twilio** con un numero de telefono con capacidad de voz
2. **Cuenta de OpenAI** con acceso a Realtime API
3. **Dominio publico** para el webhook (ej: agencias.logirapid.com)

## Paso 1: Configurar Webhook en OpenAI

1. Ve a https://platform.openai.com/settings
2. Navega a **Project > Webhooks**
3. Crea un nuevo webhook:
   - **Event type**: `realtime.call.incoming`
   - **URL**: `https://agencias.logirapid.com/api/openai/sip-webhook`
4. Copia el **Webhook Secret** (empieza con `whsec_`)
5. Navega a **Project > General** y copia el **Project ID** (empieza con `proj_`)

## Paso 2: Configurar Variables de Entorno

Agrega a tu `.env.local`:

```bash
OPENAI_WEBHOOK_SECRET="whsec_tu_webhook_secret_aqui"
OPENAI_PROJECT_ID="proj_tu_project_id_aqui"
```

## Paso 3: Crear SIP Trunk en Twilio

1. Ve a **Twilio Console > Elastic SIP Trunking**
2. Click en **Create new SIP Trunk**
3. Nombra el trunk: `OpenAI-Realtime`

### Configurar Origination URI

1. En el trunk, ve a la pestana **Origination**
2. Click en **Add Origination URI**
3. Configura:
   - **URI**: `sip:proj_TU_PROJECT_ID@sip.api.openai.com;transport=tls`
   - Reemplaza `proj_TU_PROJECT_ID` con tu Project ID de OpenAI
4. Click **Add**

### Conectar Numero de Telefono

1. Ve a la pestana **Numbers** del trunk
2. Click **Add a Number**
3. Selecciona tu numero de telefono de Twilio
4. Guarda los cambios

## Paso 4: Verificar Configuracion

### Test del Webhook

```bash
curl -X GET https://agencias.logirapid.com/api/openai/sip-webhook
```

Respuesta esperada:
```json
{
  "success": true,
  "message": "OpenAI SIP Webhook is active"
}
```

### Test de Llamada

1. Llama al numero de Twilio configurado
2. Deberias escuchar a Sofia (la asistente de voz)
3. La llamada se registrara en la tabla `voice_calls`

## Troubleshooting

### Error: "Invalid signature"

- Verifica que `OPENAI_WEBHOOK_SECRET` este correctamente configurado
- Asegurate de que el webhook en OpenAI apunte a la URL correcta

### Error: "Failed to accept call"

- Verifica que `OPENAI_API_KEY` tenga permisos para Realtime API
- Revisa los logs en Vercel para mas detalles

### La llamada no conecta

1. Verifica que el SIP Trunk este activo en Twilio
2. Confirma que el Project ID en la URI de Origination sea correcto
3. Revisa que el numero de telefono este asociado al trunk

### Latencia alta

La integracion SIP directa tiene latencia de ~200ms. Si experimentas latencia mayor:
- Verifica la conexion de red
- Revisa los logs de OpenAI para errores

## Funcionalidades del Agente

El agente de voz Sofia puede:

1. **Crear ordenes de envio** - Recopila datos de remitente y destinatario
2. **Consultar estado de ordenes** - Por numero de orden
3. **Buscar clientes existentes** - Por numero de telefono
4. **Proporcionar informacion** - Tarifas, tiempos de entrega, etc.

## Limitaciones Actuales

### Tools (Funciones)

Para que las herramientas (tools) funcionen completamente, se requiere mantener una conexion WebSocket durante la llamada. Esto no es posible en Vercel serverless.

**Opciones:**
1. Desplegar servidor dedicado (Railway, Render, EC2)
2. Aceptar que las tools no se ejecutaran (el agente conversara pero no creara ordenes)

### Transcripciones

Las transcripciones se guardan en la tabla `voice_calls.transcript` cuando la llamada termina.

## Base de Datos

La tabla `voice_calls` almacena:

| Campo | Descripcion |
|-------|-------------|
| callsid | ID unico de la llamada |
| fromnumber | Numero del cliente |
| tonumber | Numero llamado |
| companyid | ID de la empresa |
| customerid | ID del cliente (si existe) |
| status | Estado de la llamada |
| transcript | Transcripcion completa |
| metadata | Datos adicionales (JSON) |

## Referencias

- [OpenAI Realtime SIP Guide](https://platform.openai.com/docs/guides/realtime-sip)
- [Twilio Elastic SIP Trunking](https://www.twilio.com/docs/sip-trunking)
- [OpenAI + Twilio Integration](https://www.twilio.com/en-us/blog/developers/tutorials/product/openai-realtime-api-elastic-sip-trunking)
