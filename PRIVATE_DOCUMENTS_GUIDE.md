# 🔐 Guía de Documentos Privados - Sistema de Seguridad

## 📋 Resumen

Hemos implementado un sistema completo de almacenamiento PRIVADO para documentos confidenciales de empresas, usando Supabase Storage con URLs firmadas temporales.

## 🏗️ Arquitectura

### Dos Buckets Separados

#### 1. `company-documents` (PÚBLICO)
- **Uso:** Logos de empresas
- **Acceso:** URLs públicas directas
- **Seguridad:** Los logos son públicos por naturaleza
- **Ejemplo URL:**
  ```
  https://[proyecto].supabase.co/storage/v1/object/public/company-documents/logos/logo-123.png
  ```

#### 2. `company-private-documents` (PRIVADO) 🔒
- **Uso:** Documentos confidenciales (EIN, licencias, contratos, etc.)
- **Acceso:** Solo mediante URLs firmadas temporales (1 hora)
- **Seguridad:**
  - URLs públicas NO funcionan (devuelven 400/404)
  - Solo usuarios autorizados pueden generar URLs firmadas
  - Verificación de permisos por empresa
- **Organización:** `company-{id}/documents/`

## 🔄 Flujo de Uso

### 1. Subir Documento (Upload)

**Endpoint:** `POST /api/upload/documents`

**Request:**
```javascript
const formData = new FormData()
formData.append('documents', file1)
formData.append('documents', file2) // Hasta 5 archivos
formData.append('companyId', '1')   // ⚠️ REQUERIDO

const response = await fetch('/api/upload/documents', {
  method: 'POST',
  body: formData
})
```

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "originalName": "ein-certificate.pdf",
      "storedFileName": "document-1763565259543-0-abc123.pdf",
      "storagePath": "company-1/documents/document-1763565259543-0-abc123.pdf",
      "size": 54321,
      "type": "application/pdf",
      "companyId": "1",
      "uploadedAt": "2025-11-19T15:14:20.037Z"
    }
  ],
  "uploadedCount": 1,
  "totalCount": 1,
  "message": "Todos los documentos subidos exitosamente",
  "info": "⚠️ Los documentos son privados. Usa /api/documents/[companyId]/[filename] para obtener URLs temporales."
}
```

**Importante:**
- NO devuelve URLs públicas
- Devuelve metadatos para usar después
- El `companyId` es obligatorio

### 2. Obtener URL Firmada Temporal (View Document)

**Endpoint:** `GET /api/documents/[companyId]/[filename]`

**Request:**
```javascript
// Ejemplo: Ver documento de la empresa 1
const response = await fetch('/api/documents/1/document-1763565259543-0-abc123.pdf')
const data = await response.json()

if (data.success) {
  // Usar la URL firmada para mostrar o descargar
  window.open(data.signedUrl, '_blank')
}
```

**Response:**
```json
{
  "success": true,
  "signedUrl": "https://[proyecto].supabase.co/storage/v1/object/sign/company-private-documents/company-1/documents/document-...?token=...",
  "expiresIn": 3600,
  "expiresAt": "2025-11-19T16:14:20.037Z",
  "filename": "document-1763565259543-0-abc123.pdf",
  "companyId": "1",
  "message": "URL temporal generada. Válida por 1 hora."
}
```

**La URL firmada:**
- ✅ Es válida por **1 hora** (3600 segundos)
- ✅ Incluye un token de autorización de Supabase
- ✅ Permite descarga/visualización del archivo
- ⏱️ Expira automáticamente después de 1 hora

## 🛡️ Sistema de Seguridad

### Verificación de Permisos

El endpoint `/api/documents/[companyId]/[filename]` verifica:

1. **Usuario autenticado:** Debe tener cookies de sesión válidas
2. **Permisos por rol:**
   - **SUPER_ADMIN:** Puede acceder a documentos de TODAS las empresas
   - **ADMIN/MANAGER/USER:** Solo pueden acceder a documentos de SU empresa
3. **Existencia del archivo:** Verifica que el archivo exista en el bucket

### Casos de Denegación

```json
// Usuario sin empresa asignada
{
  "success": false,
  "error": "No tienes asignada ninguna empresa"
}

// Usuario intentando acceder a docs de otra empresa
{
  "success": false,
  "error": "No tienes permisos para acceder a este documento"
}

// Archivo no existe
{
  "success": false,
  "error": "Documento no encontrado"
}
```

## 📝 Ejemplo de Implementación en el Frontend

### Componente de Carga de Documentos

```typescript
// components/DocumentsUpload.tsx
import { useState } from 'react'

interface DocumentsUploadProps {
  companyId: string
  onUploadSuccess: (documents: any[]) => void
}

export function DocumentsUpload({ companyId, onUploadSuccess }: DocumentsUploadProps) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (files: FileList) => {
    setUploading(true)

    const formData = new FormData()
    Array.from(files).forEach(file => {
      formData.append('documents', file)
    })
    formData.append('companyId', companyId)

    try {
      const response = await fetch('/api/upload/documents', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        onUploadSuccess(data.documents)
        alert(data.message)
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      alert('Error al subir documentos')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
        disabled={uploading}
      />
      {uploading && <p>Subiendo documentos privados...</p>}
    </div>
  )
}
```

### Componente de Vista de Documentos

```typescript
// components/DocumentViewer.tsx
import { useState } from 'react'

interface DocumentViewerProps {
  companyId: string
  filename: string
  originalName: string
}

export function DocumentViewer({ companyId, filename, originalName }: DocumentViewerProps) {
  const [loading, setLoading] = useState(false)

  const handleView = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/documents/${companyId}/${filename}`)
      const data = await response.json()

      if (data.success) {
        // Abrir en nueva pestaña o descargar
        window.open(data.signedUrl, '_blank')
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      alert('Error al obtener documento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={handleView} disabled={loading}>
      {loading ? 'Generando acceso...' : `Ver ${originalName}`}
    </button>
  )
}
```

## 🧪 Pruebas Realizadas

✅ **Subida de documentos**
- Archivos se suben al bucket privado correctamente
- Organización por `company-{id}/documents/`
- Respuesta incluye metadatos, NO URLs públicas

✅ **Seguridad de acceso público**
- URLs públicas directas devuelven **HTTP 400** (bloqueadas)
- Confirma que los documentos son realmente privados

✅ **Generación de URLs firmadas**
- Requiere autenticación de usuario
- Verifica permisos antes de generar URL
- URLs temporales válidas por 1 hora

✅ **Verificación de permisos**
- SUPER_ADMIN puede acceder a todos los documentos
- Usuarios normales solo a documentos de su empresa
- Denegación correcta para empresas no autorizadas

## 📊 Tipos de Archivo Permitidos

```typescript
const ALLOWED_TYPES = [
  'application/pdf',          // PDFs
  'image/png',                // Imágenes PNG
  'image/jpeg',               // Imágenes JPEG
  'image/jpg',                // Imágenes JPG
  'image/webp',               // Imágenes WebP
  // Puedes agregar más:
  'application/msword',       // Word (.doc)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // Word (.docx)
  'application/vnd.ms-excel', // Excel (.xls)
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // Excel (.xlsx)
]
```

## ⚙️ Configuración

### Variables de Entorno Requeridas

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[tu-proyecto].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# (Opcional) Configuración de expiración
URL_EXPIRATION_SECONDS=3600  # 1 hora por defecto
```

### Límites

- **Tamaño máximo por archivo:** 5MB
- **Archivos por subida:** Máximo 5
- **Duración de URL firmada:** 1 hora (configurable)

## 🔒 Mejores Prácticas

1. **Siempre usar el bucket privado para:**
   - Documentos fiscales (EIN, Tax ID)
   - Licencias y permisos
   - Contratos y acuerdos
   - Información financiera
   - Datos personales sensibles

2. **Usar el bucket público solo para:**
   - Logos de empresas
   - Imágenes de productos (si son públicos)
   - Assets estáticos públicos

3. **En el frontend:**
   - NO guardar las URLs firmadas - regenerarlas cuando sea necesario
   - Mostrar mensajes cuando la URL ha expirado
   - Verificar errores de permisos y mostrar mensajes apropiados

4. **Logging y auditoría:**
   - Todos los accesos quedan registrados en los logs del servidor
   - Incluye información de quién accedió y cuándo

## 🚀 Próximos Pasos (Opcional)

- [ ] Agregar tabla en BD para rastrear documentos subidos
- [ ] Implementar eliminación de documentos
- [ ] Agregar previsualizador de PDFs integrado
- [ ] Sistema de notificaciones cuando se suben documentos
- [ ] Dashboard de auditoría de acceso a documentos
- [ ] Múltiples buckets por tipo de documento
- [ ] Compresión automática de archivos grandes

## 📚 Referencias

- [Supabase Storage Documentation](https://supabase.com/docs/guides/storage)
- [Supabase Signed URLs](https://supabase.com/docs/guides/storage/serving/downloads#authenticated-downloads)
- [Storage Policies](https://supabase.com/docs/guides/storage/security/access-control)

---

**Implementado:** 2025-11-19
**Versión:** 1.0
**Estado:** ✅ Producción
