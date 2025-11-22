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

## Verificación

Después de configurar las variables:
1. Redeploy la aplicación en Vercel
2. Intenta hacer login en www.logirapid.com
3. Verifica que la sesión persista al navegar entre páginas
4. Verifica que la sesión funcione en logirapid.com (sin www)
