#!/bin/bash
set -euo pipefail

# ============================================================================
# Deploy APK — Build, upload to S3, and register release
#
# Usage:
#   ./scripts/deploy-apk.sh <app> <version> "<changelog>" [--mandatory]
#
# Examples:
#   ./scripts/deploy-apk.sh warehouse 1.2.0 "Corregido bug de escaneo"
#   ./scripts/deploy-apk.sh door-kiosk 2.1.0 "Nueva pantalla" --mandatory
#
# Environment:
#   AUTH_TOKEN   — JWT or base64 auth token (or stored in .deploy-token)
#   API_BASE_URL — Backend URL (default: https://fabrica.servisumic.com)
#
# Requires: aws CLI configured for Supabase S3
# ============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
APP_NAME="${1:-}"
VERSION="${2:-}"
CHANGELOG="${3:-}"
MANDATORY=false

if [[ "${4:-}" == "--mandatory" ]] || [[ "${3:-}" == "--mandatory" ]]; then
  MANDATORY=true
  if [[ "${3:-}" == "--mandatory" ]]; then
    CHANGELOG=""
  fi
fi

if [[ -z "$APP_NAME" ]] || [[ -z "$VERSION" ]]; then
  echo -e "${RED}Error: Argumentos insuficientes${NC}"
  echo ""
  echo "Uso: ./scripts/deploy-apk.sh <app> <version> \"<changelog>\" [--mandatory]"
  echo ""
  echo "Apps disponibles: warehouse, door-kiosk"
  echo ""
  echo "Ejemplos:"
  echo "  ./scripts/deploy-apk.sh warehouse 1.2.0 \"Corregido bug de escaneo\""
  echo "  ./scripts/deploy-apk.sh door-kiosk 2.1.0 \"Fix crítico\" --mandatory"
  exit 1
fi

# Map app name to directory and package
case "$APP_NAME" in
  warehouse)
    APP_DIR="warehouse-app"
    APP_ID="warehouse"
    ;;
  door-kiosk)
    APP_DIR="door-kiosk-app"
    APP_ID="door-kiosk"
    ;;
  *)
    echo -e "${RED}Error: App desconocida '$APP_NAME'. Use: warehouse, door-kiosk${NC}"
    exit 1
    ;;
esac

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
APP_PATH="$PROJECT_ROOT/$APP_DIR"
GRADLE_FILE="$APP_PATH/android/app/build.gradle"

if [[ ! -f "$GRADLE_FILE" ]]; then
  echo -e "${RED}Error: No se encontró $GRADLE_FILE${NC}"
  exit 1
fi

# Calculate versionCode from semver (major*10000 + minor*100 + patch)
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
MAJOR=${MAJOR:-0}
MINOR=${MINOR:-0}
PATCH=${PATCH:-0}
VERSION_CODE=$((MAJOR * 10000 + MINOR * 100 + PATCH))

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  Deploy APK — $APP_NAME v$VERSION (code: $VERSION_CODE)${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo ""

# Get auth token
API_BASE_URL="${API_BASE_URL:-https://fabrica.servisumic.com}"

if [[ -z "${AUTH_TOKEN:-}" ]]; then
  TOKEN_FILE="$PROJECT_ROOT/.deploy-token"
  if [[ -f "$TOKEN_FILE" ]]; then
    AUTH_TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')
  else
    echo -e "${RED}Error: AUTH_TOKEN no definido y .deploy-token no existe${NC}"
    echo "Defina AUTH_TOKEN como variable de entorno o cree .deploy-token en la raíz del proyecto"
    exit 1
  fi
fi

# ---- Step 1: Update build.gradle ----
echo -e "${YELLOW}[1/5] Actualizando versionCode y versionName en build.gradle...${NC}"

sed -i.bak "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE_FILE"
sed -i.bak "s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$GRADLE_FILE"
rm -f "${GRADLE_FILE}.bak"

echo "  versionCode = $VERSION_CODE"
echo "  versionName = \"$VERSION\""

# Also update CURRENT_VERSION_CODE in app-updater.ts if it exists
UPDATER_FILE="$APP_PATH/src/services/app-updater.ts"
if [[ -f "$UPDATER_FILE" ]]; then
  sed -i.bak "s/CURRENT_VERSION_CODE = [0-9]*/CURRENT_VERSION_CODE = $VERSION_CODE/" "$UPDATER_FILE"
  sed -i.bak "s/CURRENT_VERSION = '[^']*'/CURRENT_VERSION = '$VERSION'/" "$UPDATER_FILE"
  rm -f "${UPDATER_FILE}.bak"
  echo "  Actualizado app-updater.ts"
fi

# ---- Step 2: Build APK ----
echo ""
echo -e "${YELLOW}[2/5] Compilando APK release...${NC}"

cd "$APP_PATH/android"
./gradlew assembleRelease --quiet

APK_PATH="$APP_PATH/android/app/build/outputs/apk/release/app-release.apk"

if [[ ! -f "$APK_PATH" ]]; then
  echo -e "${RED}Error: APK no generado en $APK_PATH${NC}"
  exit 1
fi

APK_SIZE=$(stat -f%z "$APK_PATH" 2>/dev/null || stat -c%s "$APK_PATH" 2>/dev/null)
APK_SIZE_MB=$(echo "scale=1; $APK_SIZE / 1048576" | bc)

echo -e "  ${GREEN}✓ APK generado: ${APK_SIZE_MB}MB${NC}"

# ---- Step 3: Upload to S3 ----
echo ""
echo -e "${YELLOW}[3/5] Subiendo APK a S3 (bucket: app-releases)...${NC}"

S3_KEY="${APP_ID}/${VERSION}/${APP_ID}-${VERSION}.apk"

# Use Supabase S3 endpoint
SUPABASE_S3_ENDPOINT="${SUPABASE_S3_ENDPOINT:-${NEXT_PUBLIC_SUPABASE_URL:-}/storage/v1/s3}"
SUPABASE_S3_ACCESS_KEY="${SUPABASE_S3_ACCESS_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"
SUPABASE_S3_SECRET_KEY="${SUPABASE_S3_SECRET_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"

if command -v aws &> /dev/null; then
  aws s3 cp "$APK_PATH" "s3://app-releases/$S3_KEY" \
    --endpoint-url "$SUPABASE_S3_ENDPOINT" \
    --content-type "application/vnd.android.package-archive" \
    2>/dev/null
  echo -e "  ${GREEN}✓ Subido a s3://app-releases/$S3_KEY${NC}"
else
  # Fallback: upload via curl to Supabase Storage REST API
  SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
  SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"

  if [[ -z "$SUPABASE_URL" ]] || [[ -z "$SUPABASE_KEY" ]]; then
    echo -e "${RED}Error: aws CLI no disponible y variables de Supabase no configuradas${NC}"
    exit 1
  fi

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/vnd.android.package-archive" \
    --data-binary "@$APK_PATH" \
    "$SUPABASE_URL/storage/v1/object/app-releases/$S3_KEY")

  if [[ "$HTTP_CODE" != "200" ]] && [[ "$HTTP_CODE" != "201" ]]; then
    # Try upsert
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -X PUT \
      -H "Authorization: Bearer $SUPABASE_KEY" \
      -H "Content-Type: application/vnd.android.package-archive" \
      --data-binary "@$APK_PATH" \
      "$SUPABASE_URL/storage/v1/object/app-releases/$S3_KEY")
  fi

  if [[ "$HTTP_CODE" != "200" ]] && [[ "$HTTP_CODE" != "201" ]]; then
    echo -e "${RED}Error: Upload falló con HTTP $HTTP_CODE${NC}"
    exit 1
  fi

  echo -e "  ${GREEN}✓ Subido via Supabase REST API${NC}"
fi

# ---- Step 4: Register release via API ----
echo ""
echo -e "${YELLOW}[4/5] Registrando release en la base de datos...${NC}"

RESPONSE=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: auth-token=$AUTH_TOKEN" \
  -d "{
    \"appId\": \"$APP_ID\",
    \"version\": \"$VERSION\",
    \"versionCode\": $VERSION_CODE,
    \"mandatory\": $MANDATORY,
    \"changelog\": \"$CHANGELOG\",
    \"apkPath\": \"$S3_KEY\",
    \"apkSize\": $APK_SIZE
  }" \
  "$API_BASE_URL/api/apps/releases")

SUCCESS=$(echo "$RESPONSE" | grep -o '"success":true' || true)

if [[ -z "$SUCCESS" ]]; then
  ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | sed 's/"error":"//;s/"//')
  echo -e "${RED}Error al registrar: ${ERROR:-respuesta desconocida}${NC}"
  echo "Response: $RESPONSE"
  exit 1
fi

echo -e "  ${GREEN}✓ Release registrado exitosamente${NC}"

# ---- Step 5: Summary ----
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Deploy completado exitosamente            ${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  App:         $APP_NAME${NC}"
echo -e "${GREEN}║  Versión:     $VERSION (code: $VERSION_CODE)${NC}"
echo -e "${GREEN}║  Tamaño:      ${APK_SIZE_MB}MB${NC}"
echo -e "${GREEN}║  Mandatory:   $MANDATORY${NC}"
echo -e "${GREEN}║  S3 Path:     $S3_KEY${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"

if [[ "$MANDATORY" == "true" ]]; then
  echo ""
  echo -e "${YELLOW}⚠ Esta es una actualización OBLIGATORIA — los dispositivos no podrán omitirla${NC}"
fi

echo ""
echo "Los dispositivos recibirán la actualización al abrir la app."
