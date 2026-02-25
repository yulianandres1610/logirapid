# Plan: Integrar Mailcow con LogiRapid - Correo corporativo automático + Cliente de email

## Contexto

El sistema LogiRapid (Next.js 15) gestiona empleados. Se necesita:
1. Al crear un empleado, generar automáticamente un correo `nombre.apellido@servisumic.com` en mailcow
2. Misma contraseña para login en LogiRapid y correo corporativo
3. Cliente de email completo dentro de LogiRapid (bandeja entrada, enviar, leer)
4. Nuevo submenu bajo "Conversaciones" en el sidebar: "Chat" + "Correo"

## Arquitectura

```
LogiRapid (Next.js)                         Mailcow (VPS 74.208.221.56)
┌──────────────────┐                    ┌──────────────────┐
│ Crear Empleado    │──API REST────────>│ Crear Mailbox     │
│                   │  X-API-Key        │ nombre.apellido@  │
├──────────────────┤                    ├──────────────────┤
│ Leer bandeja      │──IMAP:993────────>│ Dovecot (IMAP)    │
│ (inbox, sent...)  │  SSL              │                    │
├──────────────────┤                    ├──────────────────┤
│ Enviar email      │──SMTP:587────────>│ Postfix + DKIM    │
│                   │  STARTTLS         │                    │
└──────────────────┘                    └──────────────────┘
```

---

## PARTE 1: Creación automática de mailbox

### Paso 1: Instalar dependencias
```bash
npm install nodemailer imapflow
npm install -D @types/nodemailer
```
- `nodemailer`: envío SMTP
- `imapflow`: lectura IMAP (bandeja entrada, carpetas)

### Paso 2: Variables de entorno (`.env.local`)
```
MAILCOW_API_URL=https://mail.servisumic.com
MAILCOW_API_KEY=mailcow-api-temp-key
MAILCOW_DOMAIN=servisumic.com
SMTP_HOST=mail.servisumic.com
SMTP_PORT=587
IMAP_HOST=mail.servisumic.com
IMAP_PORT=993
MAIL_ENCRYPTION_KEY=(clave AES 32 chars para encriptar mail_password)
```

### Paso 3: Crear `src/lib/mailcow.ts`
Cliente API de mailcow:
- `createMailbox(localPart, fullName, password, quota=5000)` → `POST /api/v1/add/mailbox`
- `deleteMailbox(email)` → `POST /api/v1/delete/mailbox`
- `updateMailboxPassword(email, newPassword)` → `POST /api/v1/edit/mailbox`
- `generateCorporateEmail(firstName, lastName)` → `nombre.apellido@servisumic.com`
  - Normaliza: minúsculas, sin acentos (á→a, ñ→n), sin espacios
  - Si duplicado: consulta `GET /api/v1/get/mailbox/{email}`, agrega sufijo numérico

### Paso 4: Crear `src/lib/email.ts`
Servicios de email:
- `createSmtpTransport(user, password)` → nodemailer con mail.servisumic.com:587
- `sendEmail({ from, fromPassword, to, subject, html })` → envío SMTP
- `encryptPassword(plain)` / `decryptPassword(encrypted)` → AES-256 para `mail_password`

### Paso 5: Agregar columna `mail_password` a tabla `users`
```sql
ALTER TABLE users ADD COLUMN mail_password TEXT;
```
Almacena contraseña encriptada con AES (no bcrypt) — necesaria para auth SMTP/IMAP.

### Paso 6: Modificar API creación de empleados
**Archivo**: `src/app/api/market/accounting/employees/route.ts`

En el POST handler, el flujo cambia a:
1. Recibe: `firstName` (req), `lastName` (req), `password` (req), `personalEmail` (opt), rol, salario, etc.
2. Genera email: `nombre.apellido@servisumic.com` (vía `generateCorporateEmail`)
3. Llama `createMailbox()` en mailcow con la misma contraseña → si falla, retorna error
4. Inserta en `users` con email corporativo, password hasheado (bcrypt), mail_password encriptado (AES)
5. Continúa flujo normal (employee, terminals, etc.)
6. Retorna al frontend el email corporativo creado

### Paso 7: Modificar formulario de creación de empleados
**Archivo**: `src/app/dashboard/market/accounting/employees/create/page.tsx`

Step 1 cambia a:
- **Nombre** (requerido)
- **Apellido** (requerido)
- **Contraseña** (requerido — misma para login y correo)
- **Email personal** (opcional)
- **Teléfono** (opcional)
- **Preview en tiempo real**: `"Correo corporativo: juan.perez@servisumic.com"`
- Se elimina campo `email` (se genera automáticamente)

### Paso 8: Sincronizar cambio de contraseña
En cualquier endpoint que cambie contraseña de usuario:
1. Actualizar bcrypt en `users.password`
2. Actualizar AES en `users.mail_password`
3. Llamar `updateMailboxPassword()` en mailcow

---

## PARTE 2: Cliente de email en LogiRapid

### Paso 9: Crear API IMAP para leer emails
**Archivo nuevo**: `src/app/api/market/correo/route.ts`

```
GET /api/market/correo?folder=INBOX&page=1&limit=20
```
- Autentica usuario vía JWT cookie
- Obtiene email + mail_password desencriptado del usuario
- Conecta a IMAP (mail.servisumic.com:993) con `imapflow`
- Lista mensajes de la carpeta solicitada (INBOX, Sent, Drafts, Trash)
- Retorna: `{ messages: [{ id, from, to, subject, date, read, hasAttachments }], total }`

### Paso 10: API para leer un email individual
**Archivo nuevo**: `src/app/api/market/correo/[id]/route.ts`

```
GET /api/market/correo/[id]?folder=INBOX
```
- Conecta IMAP, obtiene mensaje completo por UID
- Parsea body (HTML/text), adjuntos, headers
- Marca como leído (flag \Seen)
- Retorna: `{ from, to, cc, subject, date, body, attachments }`

### Paso 11: API para enviar email
**Archivo nuevo**: `src/app/api/market/correo/send/route.ts`

```
POST /api/market/correo/send
Body: { to, cc?, subject, body, isHtml? }
```
- Autentica usuario, obtiene credenciales
- Envía vía SMTP con nodemailer (autenticado como el empleado)
- Guarda copia en carpeta "Sent" vía IMAP APPEND

### Paso 12: API para acciones sobre emails
**Archivo nuevo**: `src/app/api/market/correo/actions/route.ts`

```
POST /api/market/correo/actions
Body: { action: "delete"|"markRead"|"markUnread"|"move", messageIds: [], folder?, targetFolder? }
```

### Paso 13: Modificar sidebar — agregar submenu
**Archivo**: `src/components/layout/sidebar.tsx` (línea 611)

Cambiar:
```typescript
{ icon: MessageCircle, label: "Conversaciones", href: "/dashboard/market/chat" },
```
Por:
```typescript
{
  icon: MessageCircle,
  label: "Conversaciones",
  href: "/dashboard/market/chat",
  hasSubmenu: true,
  submenuItems: [
    { icon: MessageCircle, label: "Chat", href: "/dashboard/market/chat" },
    { icon: Mail, label: "Correo", href: "/dashboard/market/correo" },
  ]
},
```

### Paso 14: Crear página de correo
**Archivo nuevo**: `src/app/dashboard/market/correo/page.tsx`

Layout de dos paneles (mismo patrón que el chat):

**Panel izquierdo** (`w-72`):
- Botón "Redactar" (abre modal de composición)
- Carpetas: Bandeja de entrada, Enviados, Borradores, Papelera
- Contador de no leídos por carpeta
- Estilo visual consistente con PresenceList del chat

**Panel derecho**:
- **Vista lista** (cuando no hay email seleccionado): Lista de emails con from, subject, date, preview, badge no leído
- **Vista lectura** (al seleccionar un email): Header (from, to, subject, date) + body HTML/text + botones (Responder, Reenviar, Eliminar)

### Paso 15: Componente de composición de email
**Archivo nuevo**: `src/components/correo/ComposeEmail.tsx`

Modal con:
- Para (input email, múltiples destinatarios)
- CC (opcional, colapsable)
- Asunto
- Cuerpo (textarea)
- Botón Enviar
- Llama a `POST /api/market/correo/send`

### Paso 16: Componentes auxiliares
- `src/components/correo/EmailList.tsx` — lista de emails con paginación
- `src/components/correo/EmailView.tsx` — visor de email individual
- `src/components/correo/FolderList.tsx` — navegación de carpetas

---

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/lib/mailcow.ts` | **Crear** — Cliente API mailcow |
| `src/lib/email.ts` | **Crear** — SMTP transport + AES encrypt |
| `src/app/api/market/accounting/employees/route.ts` | **Modificar** — Crear mailbox al crear empleado |
| `src/app/dashboard/market/accounting/employees/create/page.tsx` | **Modificar** — Nuevo Step 1 con preview email |
| `src/components/layout/sidebar.tsx` | **Modificar** — Submenu Conversaciones |
| `src/app/dashboard/market/correo/page.tsx` | **Crear** — Página principal correo |
| `src/app/api/market/correo/route.ts` | **Crear** — Listar emails (IMAP) |
| `src/app/api/market/correo/[id]/route.ts` | **Crear** — Leer email (IMAP) |
| `src/app/api/market/correo/send/route.ts` | **Crear** — Enviar email (SMTP) |
| `src/app/api/market/correo/actions/route.ts` | **Crear** — Acciones (delete, mark read) |
| `src/components/correo/ComposeEmail.tsx` | **Crear** — Modal composición |
| `src/components/correo/EmailList.tsx` | **Crear** — Lista de emails |
| `src/components/correo/EmailView.tsx` | **Crear** — Visor de email |
| `src/components/correo/FolderList.tsx` | **Crear** — Carpetas |
| `.env.local` | **Modificar** — Variables mailcow/SMTP/IMAP |

## Verificación

1. Crear empleado "Juan Perez" con contraseña "Test1234!" → verifica `juan.perez@servisumic.com` existe en mailcow
2. Login en LogiRapid con `juan.perez@servisumic.com` + `Test1234!`
3. Login en webmail (SOGo) con mismas credenciales
4. En sidebar: Conversaciones → Chat y Correo visibles
5. Entrar a Correo → ver bandeja de entrada vacía
6. Redactar y enviar email a `pacotilleroscun@gmail.com` → debe llegar con DKIM válido
7. Recibir respuesta → aparece en bandeja de entrada
8. Crear segundo "Juan Perez" → genera `juan.perez2@servisumic.com`
