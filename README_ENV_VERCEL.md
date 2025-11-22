# Variables de Entorno para Vercel

Para que la autenticación JWT funcione correctamente en producción, debes configurar las siguientes variables de entorno en Vercel:

## Variables Requeridas para JWT Authentication

### JWT_SECRET
- **Valor sugerido:** Generar un nuevo secreto con `openssl rand -base64 32`
- **Ejemplo:** `kg/cuEijkhCR2gqC3G8yldvFmvtyQu7TkoRr8JXgIDs=`
- **Descripción:** Clave secreta para firmar y verificar tokens JWT
- **IMPORTANTE:** Debe ser diferente del valor local en producción

### COOKIE_DOMAIN
- **Valor para producción:** `.logirapid.com`
- **Descripción:** Dominio para compartir cookies entre subdominios (www.logirapid.com y logirapid.com)
- **Nota:** El punto inicial (`.`) es importante para compartir entre subdominios

### NEXTAUTH_URL
- **Valor para producción:** `https://www.logirapid.com`
- **Descripción:** URL principal de la aplicación en producción

## Cómo Configurar en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Navega a Settings → Environment Variables
3. Agrega cada variable con su valor correspondiente
4. Asegúrate de seleccionar el ambiente correcto (Production, Preview, Development)

## Comandos para Generar JWT_SECRET

```bash
# Generar un secreto seguro de 32 bytes
openssl rand -base64 32
```

## Valores Exactos para Configurar en Vercel

Copia y pega estos valores exactamente en Vercel:

```
JWT_SECRET=kg/cuEijkhCR2gqC3G8yldvFmvtyQu7TkoRr8JXgIDs=
COOKIE_DOMAIN=.logirapid.com
NEXTAUTH_URL=https://www.logirapid.com
CRON_SECRET=fLLoSIC+6kgVa9AX1FkbBxkvYJ8QXZCxUxQJiY9gupM=
```

### CRON_SECRET
- **Valor para producción:** `fLLoSIC+6kgVa9AX1FkbBxkvYJ8QXZCxUxQJiY9gupM=`
- **Descripción:** Secret para autenticar el cron job de actualización de tasas de cambio
- **Nota:** El cron se ejecuta cada 6 minutos para guardar variaciones de ElToque

## Verificación

Después de configurar las variables:
1. Redeploy la aplicación en Vercel (o espera el auto-deploy)
2. Abre la consola del navegador (F12) en www.logirapid.com
3. Intenta hacer login
4. Verifica los logs en consola:
   - `[LOGIN] Cookie configuration` - Debe mostrar domain: .logirapid.com
   - `[AUTH] Cookie check attempt` - Debe mostrar "Found" en algún intento
   - `[MIDDLEWARE] JWT token validated successfully` - Debe aparecer al acceder al dashboard
5. Si hay errores, busca logs con `[MIDDLEWARE] Invalid JWT token` para diagnosticar

## Troubleshooting

### Si sigue redirigiendo al login:

1. **Verifica en Vercel Logs:**
   - Ve a Vercel Dashboard → Functions → Runtime Logs
   - Busca `[MIDDLEWARE]` para ver si el token se está validando

2. **Verifica las cookies en el navegador:**
   - F12 → Application → Cookies → https://www.logirapid.com
   - Debe existir `auth-token` con domain `.logirapid.com`

3. **Revisa el JWT_SECRET:**
   - Asegúrate de que esté configurado en Vercel
   - Debe ser EXACTAMENTE el mismo valor en las 3 variables de entorno (Production, Preview, Development)

4. **Limpia cookies y caché:**
   - A veces cookies viejas causan conflictos
   - Limpia todas las cookies de logirapid.com e intenta de nuevo
