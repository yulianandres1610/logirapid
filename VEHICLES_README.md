# Sistema de Gestión de Vehículos

## 🚗 Características

- **Registro por VIN**: Decodificación automática de información del vehículo usando el número VIN
- **Fotos automáticas**: Obtención de fotos del vehículo desde Auto.dev API
- **Gestión de capacidad**: Configuración de capacidad de carga en peso y volumen
- **Vista moderna**: Interfaz intuitiva con estadísticas en tiempo real
- **Asignación de rutas**: Sistema para asignar vehículos a rutas específicas

## 🛠️ Configuración

### 1. Configurar API Key de Auto.dev

1. Obtén una API key en [Auto.dev](https://auto.dev/)
2. Crea el archivo `.env.local` en la raíz del proyecto
3. Agrega tu API key:

```env
NEXT_PUBLIC_AUTO_DEV_API_KEY=tu_api_key_aqui
```

### 2. Estructura de Componentes

```
src/
├── types/
│   └── vehicle.ts              # Tipos e interfaces para vehículos
├── services/
│   └── vehicleService.ts       # Servicio de API y gestión de datos
├── components/
│   ├── forms/
│   │   └── VehicleRegistrationForm.tsx  # Formulario de registro
│   └── dashboard/
│       ├── VehicleCard.tsx     # Tarjeta individual de vehículo
│       └── VehicleList.tsx     # Lista completa con filtros
└── app/dashboard/manager/
    └── vehicles/
        └── page.tsx            # Página principal de gestión
```

## 📋 Uso del Sistema

### Registro de Nuevo Vehículo

1. Navega a `/dashboard/manager/vehicles`
2. Haz clic en "Nuevo Vehículo"
3. Ingresa el número VIN (17 caracteres)
4. El sistema automáticamente:
   - Decodifica marca, modelo, año
   - Obtiene fotos del vehículo
   - Sugiere capacidades de carga
5. Configura las capacidades de carga deseadas
6. Guarda el vehículo

### Gestión de Vehículos

- **Ver lista**: Todos los vehículos con sus capacidades
- **Filtrar**: Por estado, disponibilidad, marca
- **Buscar**: Por marca, modelo, VIN o año
- **Acciones rápidas**: Asignar ruta, editar, cambiar estado

### Campos de Capacidad

- **Peso**: En libras (lbs) y kilogramos (kg)
- **Volumen**: En pies cúbicos (ft³) y metros cúbicos (m³)
- **Conversión automática** entre unidades

## 🔧 API Endpoints

### Auto.dev Integration

- **VIN Decode**: `GET https://api.auto.dev/v2/vin/{vin}`
- **Vehicle Photos**: `GET https://api.auto.dev/v2/photos/{vin}`

### Datos Decodificados

```typescript
interface VinDecodeResponse {
  vin: string;
  make: string;
  model: string;
  model_year: number;
  body_type: string;
  color: string;
  photo_urls?: string[];
  // ... más campos
}
```

## 🎨 Diseño y UX

- **Tema oscuro/claro**: Adaptativo al tema del sistema
- **Animaciones**: Transiciones suaves con Framer Motion
- **Responsive**: Funciona en móviles y escritorio
- **Estadísticas**: Vista rápida de disponibilidad y estados

## 📊 Estadísticas Integradas

- Total de vehículos
- Vehículos disponibles
- Vehículos activos
- Vehículos en tránsito

## 🔄 Flujo de Trabajo

1. **Registro**: Escanear/ingresar VIN → Decodificar → Configurar capacidad
2. **Gestión**: Monitorear estado → Asignar rutas → Actualizar información
3. **Optimización**: Basado en capacidad y disponibilidad

## 🚀 Próximos Pasos

- [ ] Integración con sistema de rutas
- [ ] Historial de mantenimiento
- [ ] Reportes de utilización
- [ ] Notificaciones automáticas
- [ ] Integración GPS

## 🛡️ Validaciones

- **VIN**: 17 caracteres, formato válido
- **Capacidad**: Límites mínimos y máximos
- **Conversión**: Automática entre unidades métricas e imperiales

## 📱 Accesibilidad

- Navegación por teclado
- Lectores de pantalla
- Contraste adecuado
- Etiquetas descriptivas

---

**Nota**: Para uso en producción, asegúrate de configurar las API keys en las variables de entorno del servidor.