# Guía de Deployment en Vercel

Este documento describe los pasos para desplegar LogiRapid/CubaRapid en Vercel.

## Requisitos Previos

- Cuenta en [Vercel](https://vercel.com)
- Cuenta en [Supabase](https://supabase.com) (para PostgreSQL)
- Token de Mapbox
- API Key de Auto.dev

## Instalaciones Realizadas

✅ Vercel CLI instalado globalmente
✅ `@vercel/speed-insights` - Monitoreo de rendimiento
✅ `@vercel/analytics` - Analytics de la aplicación
✅ Integración en `src/app/layout.tsx`

## Variables de Entorno Requeridas

Debes configurar las siguientes variables de entorno en tu proyecto de Vercel:

### 1. Auto.dev API
```
NEXT_PUBLIC_AUTO_DEV_API_KEY=tu_api_key_de_auto_dev
```

### 2. NextAuth
```
NEXTAUTH_URL=https://tu-dominio.vercel.app
NEXTAUTH_SECRET=genera_un_secret_seguro_aqui
```

Para generar un NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 3. Mapbox
```
NEXT_PUBLIC_MAPBOX_TOKEN=tu_token_de_mapbox
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=tu_token_de_mapbox
```

### 4. PostgreSQL (Supabase)
```
DATABASE_URL=postgresql://user:password@host:5432/database
DB_HOST=tu_host_de_supabase
DB_PORT=5432
DB_NAME=postgres
DB_USER=tu_usuario_de_supabase
DB_PASSWORD=tu_password_de_supabase
DB_SSL=true
```

### 5. Supabase Client
```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
```

## Métodos de Deployment

### Método 1: Deployment desde GitHub (Recomendado)

1. Asegúrate de que tu código esté en GitHub
2. Ve a [vercel.com](https://vercel.com) e inicia sesión
3. Haz clic en "Add New Project"
4. Importa tu repositorio de GitHub
5. Vercel detectará automáticamente que es un proyecto Next.js
6. Configura las variables de entorno en la sección "Environment Variables"
7. Haz clic en "Deploy"

### Método 2: Deployment desde CLI

1. Inicia sesión en Vercel:
```bash
vercel login
```

2. Desde la raíz del proyecto, ejecuta:
```bash
vercel
```

3. Sigue las instrucciones en pantalla:
   - Link to existing project? → No
   - What's your project's name? → cubarapid
   - In which directory is your code located? → ./
   - Want to override the settings? → No

4. Para producción:
```bash
vercel --prod
```

### Método 3: Deployment automático con Git

Una vez configurado el proyecto en Vercel:

- **Push a `main`** → Deployment automático a producción
- **Push a otras ramas** → Preview deployments automáticos

## Configuración Post-Deployment

### 1. Dominio Personalizado (Opcional)
1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Domains
3. Agrega tu dominio personalizado
4. Configura los DNS según las instrucciones de Vercel

### 2. Verificar Variables de Entorno
1. Ve a Settings → Environment Variables
2. Verifica que todas las variables estén configuradas
3. Asegúrate de configurarlas para Production, Preview y Development según necesites

### 3. Verificar el Build
1. Ve a Deployments
2. Verifica que el build se completó exitosamente
3. Revisa los logs si hay errores

## Monitoreo y Analytics

El proyecto incluye:

- **Speed Insights**: Monitorea Core Web Vitals y rendimiento
- **Analytics**: Tracking de páginas vistas y eventos

Accede a estas métricas desde el Dashboard de Vercel:
- Analytics → Overview
- Speed Insights → Web Vitals

## Troubleshooting

### Error: Build Failed
- Verifica que todas las dependencias estén en `package.json`
- Revisa los logs de build en Vercel Dashboard
- Asegúrate de que `npm run build` funcione localmente

### Error: Database Connection
- Verifica que `DATABASE_URL` esté correctamente configurada
- Asegura que Supabase permita conexiones desde Vercel
- Revisa la configuración de SSL (`DB_SSL=true`)

### Error: Environment Variables
- Asegúrate de que todas las variables NEXT_PUBLIC_ estén configuradas
- Redeploy después de agregar nuevas variables
- Verifica que las variables estén en el scope correcto (Production/Preview/Development)

## Comandos Útiles

```bash
# Ver logs de deployment
vercel logs

# Listar proyectos
vercel ls

# Obtener información del proyecto
vercel inspect

# Rollback a deployment anterior
vercel rollback

# Ver variables de entorno
vercel env ls
```

## Archivos de Configuración

- `vercel.json` - Configuración principal de Vercel
- `.env.example` - Template de variables de entorno
- `.env.local` - Variables locales (NO subir a Git)

## Notas Importantes

⚠️ **NUNCA subas el archivo `.env.local` a Git** - Contiene información sensible

⚠️ **Actualiza NEXTAUTH_URL** - Debe apuntar a tu dominio de producción

⚠️ **Verifica la base de datos** - Asegúrate de que Supabase esté en modo production

✅ **Speed Insights y Analytics** - Ya están integrados y funcionarán automáticamente en production

## Recursos

- [Documentación de Vercel](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Supabase con Vercel](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
- [Mapbox en Vercel](https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react/)

## Soporte

Si tienes problemas con el deployment:
1. Revisa los logs en Vercel Dashboard
2. Consulta la documentación oficial de Vercel
3. Verifica que todas las variables de entorno estén configuradas correctamente
