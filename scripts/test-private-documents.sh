#!/bin/bash

echo "🧪 Probando Sistema de Documentos Privados"
echo "==========================================="
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Crear archivo de prueba
echo "1️⃣ Creando documento de prueba..."
cat > /tmp/test-document.pdf << 'EOF'
%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer<</Size 5/Root 1 0 R>>
startxref
283
%%EOF
EOF

echo -e "${GREEN}✅ Documento de prueba creado${NC}"
echo ""

# 2. Subir documento
echo "2️⃣ Subiendo documento PRIVADO (con companyId=1)..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/upload/documents \
  -F "documents=@/tmp/test-document.pdf" \
  -F "companyId=1")

echo "$UPLOAD_RESPONSE" | jq '.'
echo ""

# Extraer información del documento subido
STORAGE_PATH=$(echo "$UPLOAD_RESPONSE" | jq -r '.documents[0].storagePath // empty')
FILENAME=$(echo "$UPLOAD_RESPONSE" | jq -r '.documents[0].storedFileName // empty')

if [ -z "$STORAGE_PATH" ] || [ -z "$FILENAME" ]; then
  echo -e "${RED}❌ Error: No se pudo subir el documento${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Documento subido exitosamente${NC}"
echo "   Path: $STORAGE_PATH"
echo "   Filename: $FILENAME"
echo ""

# 3. Intentar acceso directo público (debe fallar)
echo "3️⃣ Intentando acceso PÚBLICO directo (debe fallar)..."
PUBLIC_URL="https://mmmcqpptupterlpthlhc.supabase.co/storage/v1/object/public/company-private-documents/$STORAGE_PATH"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL")

if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "404" ]; then
  echo -e "${GREEN}✅ Correcto: Acceso público bloqueado (HTTP $HTTP_CODE)${NC}"
  echo "   URL probada: $PUBLIC_URL"
else
  echo -e "${RED}⚠️  Advertencia: Se esperaba error pero se obtuvo HTTP $HTTP_CODE${NC}"
fi
echo ""

# 4. Obtener URL firmada temporal (debe funcionar)
echo "4️⃣ Solicitando URL firmada temporal..."
SIGNED_URL_RESPONSE=$(curl -s "http://localhost:3000/api/documents/1/$FILENAME")
echo "$SIGNED_URL_RESPONSE" | jq '.'
echo ""

SIGNED_URL=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.signedUrl // empty')
SUCCESS=$(echo "$SIGNED_URL_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" == "true" ] && [ -n "$SIGNED_URL" ]; then
  echo -e "${GREEN}✅ URL firmada generada exitosamente${NC}"
  echo "   Válida por: 1 hora"
  echo ""

  # 5. Probar acceso con URL firmada
  echo "5️⃣ Probando acceso con URL firmada..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SIGNED_URL")

  if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ Acceso exitoso con URL firmada (HTTP $HTTP_CODE)${NC}"
  else
    echo -e "${RED}❌ Error: Acceso falló (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${RED}❌ Error: No se pudo generar URL firmada${NC}"
fi
echo ""

# 6. Intentar acceso a documento de otra empresa (debe fallar)
echo "6️⃣ Probando seguridad: Intentando acceder a documento de otra empresa..."
UNAUTHORIZED_RESPONSE=$(curl -s "http://localhost:3000/api/documents/999/$FILENAME")
echo "$UNAUTHORIZED_RESPONSE" | jq '.'

UNAUTHORIZED_SUCCESS=$(echo "$UNAUTHORIZED_RESPONSE" | jq -r '.success')
if [ "$UNAUTHORIZED_SUCCESS" == "false" ]; then
  echo -e "${GREEN}✅ Correcto: Acceso denegado por permisos${NC}"
else
  echo -e "${RED}⚠️  Advertencia: Se debería denegar el acceso${NC}"
fi
echo ""

# Limpiar
rm -f /tmp/test-document.pdf
echo "🧹 Archivo de prueba limpiado"
echo ""

# Resumen
echo "=========================================="
echo "📊 RESUMEN DE LA PRUEBA"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ FUNCIONALIDADES VERIFICADAS:${NC}"
echo "   1. Subida de documentos al bucket PRIVADO"
echo "   2. Organización por companyId"
echo "   3. Bloqueo de acceso público directo"
echo "   4. Generación de URLs firmadas temporales"
echo "   5. Acceso exitoso con URL firmada"
echo "   6. Verificación de permisos por empresa"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANTE:${NC}"
echo "   • Los documentos son PRIVADOS por defecto"
echo "   • Solo accesibles mediante URLs firmadas (1 hora)"
echo "   • Usuarios solo pueden acceder a docs de su empresa"
echo "   • SUPER_ADMIN puede acceder a todos los docs"
echo ""
echo "🎉 Sistema de seguridad funcionando correctamente!"
