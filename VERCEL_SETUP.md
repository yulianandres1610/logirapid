# Configuración de Variables de Entorno en Vercel

Este documento explica cómo configurar las variables de entorno necesarias para LogiRapid en Vercel.

## Variables Obligatorias

### 1. Mapbox API Token (CRÍTICO para rutas)

```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q
```

**Importante**: Esta variable es NECESARIA para que funcione la generación de rutas con Mapbox. Sin ella, verás errores como:
- "SyntaxError: Unexpected token 'T', "The deploy"... is not valid JSON"
- "Mapbox token inválido o no configurado"

### 2. Database Configuration (Supabase)

```
DATABASE_URL=postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres
```

Variables individuales:
```
DB_HOST=aws-1-us-east-2.pooler.supabase.com
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres.mmmcqpptupterlpthlhc
DB_PASSWORD=Power.27801610
DB_SSL=true
```

### 3. NextAuth Configuration

```
NEXTAUTH_URL=https://tu-proyecto.vercel.app
NEXTAUTH_SECRET=tu_secret_generado_aqui
```

Para generar NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

## Cómo Configurar en Vercel

### Opción 1: Desde el Dashboard de Vercel

1. Ve a tu proyecto en Vercel
2. Click en "Settings" → "Environment Variables"
3. Agrega cada variable una por una:
   - Name: `NEXT_PUBLIC_MAPBOX_TOKEN`
   - Value: `pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q`
   - Environment: Production, Preview, Development (selecciona todos)
4. Repite para todas las variables

### Opción 2: Desde el CLI de Vercel

```bash
# Instalar Vercel CLI si no lo tienes
npm i -g vercel

# Login
vercel login

# Agregar variables (desde el directorio del proyecto)
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN production
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_URL production
vercel env add NEXTAUTH_SECRET production
```

### Opción 3: Desde archivo .env (Desarrollo Local)

1. Copia `.env.example` a `.env.local`:
```bash
cp .env.example .env.local
```

2. Edita `.env.local` con tus valores reales
3. Las variables en `.env.local` NO se suben a Vercel automáticamente
4. Debes configurarlas manualmente en Vercel

## Verificar Configuración

Después de configurar las variables:

1. Ve a "Deployments" en Vercel
2. Click en "Redeploy" → "Redeploy with existing Build Cache"
3. Verifica los logs del deployment:
   - Busca `🔑 Using Mapbox token: pk.eyJ1IjoieXVsaWFu...`
   - Si ves este log, el token está configurado correctamente

## Errores Comunes

### Error: "Unexpected token 'T', "The deploy"... is not valid JSON"

**Causa**: `NEXT_PUBLIC_MAPBOX_TOKEN` no está configurado en Vercel

**Solución**:
1. Agrega la variable en Settings → Environment Variables
2. Asegúrate de seleccionar "Production" environment
3. Redeploy el proyecto

### Error: "Mapbox token inválido o no configurado"

**Causa**: El token está configurado pero es inválido o ha expirado

**Solución**:
1. Genera un nuevo token en https://account.mapbox.com/access-tokens/
2. Actualiza `NEXT_PUBLIC_MAPBOX_TOKEN` en Vercel
3. Redeploy

### Error: "Database connection failed"

**Causa**: Variables de base de datos incorrectas o BD inaccesible

**Solución**:
1. Verifica que `DATABASE_URL` está correctamente formateado
2. Asegúrate de que la IP de Vercel está permitida en Supabase
3. Verifica las credenciales en Supabase Dashboard

## Lista de Verificación Final

Antes de hacer deploy a producción, asegúrate de:

- [ ] `NEXT_PUBLIC_MAPBOX_TOKEN` configurado en Production
- [ ] `DATABASE_URL` configurado con credenciales correctas
- [ ] `NEXTAUTH_URL` apunta a tu dominio de producción
- [ ] `NEXTAUTH_SECRET` generado con openssl
- [ ] Todas las variables marcadas para "Production" environment
- [ ] Deploy realizado después de configurar las variables
- [ ] Logs del deployment no muestran errores de Mapbox
- [ ] Funcionalidad de rutas probada en producción

## Variables Opcionales

```bash
# Auto.dev API (para decodificar VIN de vehículos)
NEXT_PUBLIC_AUTO_DEV_API_KEY=tu_api_key

# Supabase Client (si usas autenticación de Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

## Soporte

Si tienes problemas:
1. Revisa los logs de deployment en Vercel
2. Busca mensajes que empiecen con `❌` o `⚠️`
3. Verifica que las variables estén en el environment correcto (Production/Preview)
4. Intenta un "Redeploy" después de cambiar variables
