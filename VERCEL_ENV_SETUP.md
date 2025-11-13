# 🚀 Guía de Configuración de Variables de Entorno en Vercel

Este documento te guía paso a paso para configurar todas las variables de entorno necesarias en Vercel usando el archivo `.env.vercel`.

## 📋 Archivo de Variables

El archivo `.env.vercel` contiene todas las variables preconfiguradas para tu proyecto LogiRapid.

**Total: 14 variables de entorno**

## 🔧 Método 1: Importación Automática (Recomendado)

### Paso 1: Acceder a Configuración de Variables

1. Ve a tu proyecto en Vercel:
   ```
   https://vercel.com/yulianandres1610s-projects/logirapid
   ```

2. Click en **"Settings"** (⚙️) en el menú superior

3. En el menú lateral izquierdo, click en **"Environment Variables"**

### Paso 2: Importar Variables

1. Click en el botón **"Add New"** y luego selecciona **"Import from .env"**

2. Abre el archivo `.env.vercel` en tu editor de texto

3. **Copia TODO el contenido** del archivo (Ctrl+A, Ctrl+C o Cmd+A, Cmd+C)

4. **Pega el contenido** en el campo de texto que aparece en Vercel

5. **Selecciona los entornos** donde aplicarán las variables:
   - ☑️ **Production** (Obligatorio)
   - ☑️ **Preview** (Recomendado)
   - ☑️ **Development** (Opcional)

6. Click en **"Add"** o **"Import"**

### Paso 3: Verificar Importación

1. Después de importar, deberías ver las 14 variables listadas

2. Verifica que cada variable tenga el ícono ✓ en los entornos seleccionados

3. Las variables importadas:
   - ✅ NEXT_PUBLIC_AUTO_DEV_API_KEY
   - ✅ NEXTAUTH_URL
   - ✅ NEXTAUTH_SECRET
   - ✅ NEXT_PUBLIC_MAPBOX_TOKEN
   - ✅ NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
   - ✅ DATABASE_URL
   - ✅ DB_HOST
   - ✅ DB_PORT
   - ✅ DB_NAME
   - ✅ DB_USER
   - ✅ DB_PASSWORD
   - ✅ DB_SSL
   - ✅ NEXT_PUBLIC_SUPABASE_URL
   - ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY

## 🔧 Método 2: Configuración Manual (Alternativo)

Si prefieres agregar las variables una por una:

### Auto.dev API

```
NEXT_PUBLIC_AUTO_DEV_API_KEY
sk_ad_ckD9N3l_EXhHCJSqHgCXOqLr
```

### NextAuth

```
NEXTAUTH_URL
https://logirapid-yulianandres1610s-projects.vercel.app

NEXTAUTH_SECRET
wQp8K9xR7vN5mH3jL2aT6fY1cE4gB8dS9uI0pO7kM6nZ5hG3wJ2qR1xC4vB7nA5t
```

### Mapbox

```
NEXT_PUBLIC_MAPBOX_TOKEN
pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q

NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q
```

### PostgreSQL (Supabase)

```
DATABASE_URL
postgresql://postgres.mmmcqpptupterlpthlhc:Power.27801610@aws-1-us-east-2.pooler.supabase.com:5432/postgres

DB_HOST
aws-1-us-east-2.pooler.supabase.com

DB_PORT
5432

DB_NAME
postgres

DB_USER
postgres.mmmcqpptupterlpthlhc

DB_PASSWORD
Power.27801610

DB_SSL
true
```

### Supabase Client

```
NEXT_PUBLIC_SUPABASE_URL
https://mmmcqpptupterlpthlhc.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tbWNxcHB0dXB0ZXJscHRobGhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNTg4NDQsImV4cCI6MjA3NjYzNDg0NH0.bLo8IYPUrhxwEp0bBl3f3NGuEt_GuiaEFFfL7_D8GwQ
```

## 🔄 Paso 4: Redesplegar la Aplicación

Después de configurar las variables de entorno, debes redesplegar:

### Opción A: Redeploy desde Dashboard

1. Ve a **"Deployments"** en el menú superior
2. Click en el deployment más reciente
3. Click en los tres puntos **"..."** → **"Redeploy"**
4. Confirma el redeploy

### Opción B: Push a GitHub

Las nuevas variables se aplicarán automáticamente en el próximo deployment cuando hagas push a `main`.

## ✅ Verificación Post-Deployment

Una vez desplegado, verifica que todo funcione:

1. **Accede a tu aplicación**:
   - Production: https://logirapid-yulianandres1610s-projects.vercel.app
   - O tu dominio personalizado

2. **Verifica funcionalidades**:
   - ✅ Login funciona (NextAuth)
   - ✅ Mapas se cargan (Mapbox)
   - ✅ Base de datos conectada (PostgreSQL/Supabase)
   - ✅ Registro de vehículos (Auto.dev API)

## 🔒 Seguridad

**IMPORTANTE: Información Sensible**

- ⚠️ El archivo `.env.vercel` contiene información sensible
- ⚠️ **NO** lo compartas públicamente
- ⚠️ **NO** lo subas a repositorios públicos de GitHub
- ✅ Está incluido en `.gitignore` para tu seguridad

## 📝 Notas Adicionales

### Actualizar NEXTAUTH_URL

Si usas un dominio personalizado, actualiza:

```
NEXTAUTH_URL=https://tu-dominio-personalizado.com
```

### Regenerar NEXTAUTH_SECRET

Para generar un nuevo secret seguro:

```bash
openssl rand -base64 32
```

Luego reemplaza el valor de `NEXTAUTH_SECRET` en Vercel.

## 🆘 Troubleshooting

### Error: Variables no definidas

1. Verifica que todas las 14 variables estén configuradas
2. Asegúrate de seleccionar el entorno correcto (Production/Preview)
3. Redeploy la aplicación después de agregar variables

### Error: Database connection failed

1. Verifica que `DATABASE_URL` esté correcta
2. Comprueba que Supabase permite conexiones desde Vercel
3. Verifica que `DB_SSL=true` esté configurado

### Error: Mapbox no carga

1. Verifica que ambos tokens de Mapbox estén configurados
2. Comprueba que los tokens tengan el prefijo `pk.`
3. Asegúrate de que las variables sean `NEXT_PUBLIC_*`

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en Vercel Dashboard → Deployments → [Tu deployment] → Function Logs
2. Verifica que todas las variables estén en el entorno correcto
3. Consulta la documentación de Vercel: https://vercel.com/docs/concepts/projects/environment-variables

---

**✨ Una vez configurado todo, tu aplicación LogiRapid estará lista para producción!**
