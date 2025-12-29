/**
 * Base de Conocimiento del Sistema LogiRapid
 * Este documento es usado por el AI Support Agent para responder preguntas
 */

export const SYSTEM_KNOWLEDGE = `
# LogiRapid - Sistema de Gestion Logistica

LogiRapid es una plataforma integral para la gestion de envios, paqueteria, inventario y marketplace B2B.

---

## TIPOS DE EMPRESAS Y ROLES

### 1. SUPERADMIN (Administrador de Plataforma)
Acceso completo al sistema. Gestiona todas las empresas y configuraciones globales.

**Modulos disponibles:**
- **Dashboard**: Vision general de toda la plataforma
- **Empresas**: Crear, editar, activar/desactivar empresas
- **Usuarios**: Gestionar todos los usuarios del sistema
- **Marketplace**: Aprobar/rechazar publicaciones de mercados
- **Configuracion**: Tasas de cambio, tarifas globales, ajustes del sistema
- **Reportes**: Estadisticas globales de la plataforma

### 2. AGENCIA (Empresa de Envios)
Empresas que gestionan envios de paquetes a Cuba.

**Modulos disponibles:**
- **Dashboard**: Resumen de ordenes, ingresos, estadisticas
- **Ordenes de Paquetes**: Crear y gestionar envios
- **Clientes**: Base de datos de remitentes y destinatarios
- **Rutas**: Configurar rutas de envio y tarifas
- **Wallet**: Balance de la empresa, recargas, movimientos
- **Inventario**: Productos disponibles para venta
- **Reportes**: Ventas, envios, comisiones

**Como crear una orden de paquete:**
1. Ir a "Ordenes de Paquetes" > "Nueva Orden"
2. Seleccionar o crear cliente remitente
3. Agregar destinatario en Cuba (nombre, direccion, telefono)
4. Agregar productos/paquetes con peso y dimensiones
5. Seleccionar ruta y servicio de envio
6. Revisar costos y confirmar orden
7. Procesar pago (efectivo, tarjeta, wallet)

### 3. MERCADO (Market/Tienda)
Empresas que venden productos y pueden publicar en marketplace.

**Modulos disponibles:**
- **Dashboard**: Resumen de ventas e inventario
- **Inventario**: Gestion completa de productos
  - Crear/editar productos
  - Categorias
  - Precios de costo y venta
  - Stock por almacen
- **Almacenes**: Gestionar multiples ubicaciones de stock
- **Compras**: Registrar compras a proveedores
- **Marketplace**: Publicar productos para venta B2B
- **Reportes**: Ventas, inventario, rentabilidad

**Como publicar en Marketplace:**
1. Ir a "Marketplace" > "Nueva Publicacion"
2. Seleccionar producto del inventario
3. Elegir almacen con stock disponible
4. Definir cantidad a publicar
5. Establecer precio de marketplace (ver alertas de precio)
6. Agregar titulo y descripcion personalizados (opcional)
7. Enviar a aprobacion

### 4. BROKER
Empresas intermediarias que gestionan multiples agencias.

**Modulos disponibles:**
- **Dashboard**: Vision de todas las agencias asociadas
- **Agencias**: Gestionar agencias bajo su control
- **Comisiones**: Configurar y revisar comisiones
- **Reportes**: Consolidados de todas las agencias

### 5. USUARIO/EMPLEADO
Usuarios con acceso limitado segun permisos asignados.

**Acceso basado en:**
- Rol asignado (admin, manager, user)
- Servicios habilitados para la empresa
- Permisos especificos del usuario

---

## FUNCIONALIDADES PRINCIPALES

### SISTEMA DE WALLET (Monedero)

**Tipos de wallet:**
- **Wallet de Empresa**: Balance principal para operaciones
- **Wallet Personal**: Balance individual del usuario

**Operaciones:**
- Recargar saldo (Stripe, Square, transferencia)
- Ver movimientos y transacciones
- Pagar ordenes con saldo
- Solicitar retiros (cashout)

**Para recargar:**
1. Click en el balance en el header
2. Seleccionar metodo de pago
3. Ingresar monto
4. Completar pago

### SISTEMA DE INVENTARIO (Mercados)

**Gestion de productos:**
- Crear productos con SKU, nombre, descripcion
- Asignar categoria
- Definir precio de costo y precio de venta
- Subir imagenes
- Generar con AI (titulo y descripcion automaticos)

**Gestion de stock:**
- Asignar stock por almacen
- Transferencias entre almacenes
- Alertas de stock bajo
- Historial de movimientos

**Almacenes:**
- Crear multiples almacenes
- Definir almacen central
- Geolocalizacion opcional
- Asignar responsable

### SISTEMA DE MARKETPLACE

**Para Mercados (vendedores):**
- Publicar productos con stock disponible
- Precio independiente del precio de venta
- Sistema de alertas de precio:
  - Alerta si precio < costo (perdida)
  - Alerta si precio = costo (sin margen)
  - Alerta si margen < 5%
  - Comparacion con competidores
- Ver estado de publicaciones (pendiente, aprobado, rechazado)

**Para Agencias (compradores):**
- Buscar productos por zona/provincia
- Ver precios de diferentes mercados
- Comparar ofertas

**Estados de publicacion:**
- Pendiente: Esperando aprobacion del superadmin
- Aprobado: Visible en marketplace
- Rechazado: Con motivo de rechazo
- Inactivo: Pausado por el mercado
- Agotado: Sin stock disponible

### ORDENES DE PAQUETES

**Estados de orden:**
- Borrador: En proceso de creacion
- Pendiente: Esperando pago
- Pagada: Pago recibido
- En Proceso: Preparando envio
- En Transito: En camino
- Entregada: Completada
- Cancelada: Anulada

**Informacion de orden:**
- Numero de orden unico
- Cliente remitente (USA)
- Destinatario (Cuba)
- Lista de productos/paquetes
- Peso total y dimensiones
- Costo de envio
- Metodo de pago
- Tracking

### RUTAS Y TARIFAS

**Configuracion de rutas:**
- Origen (estado/ciudad USA)
- Destino (provincia/municipio Cuba)
- Servicios disponibles (aereo, maritimo)
- Tiempos de entrega estimados
- Tarifas por peso/volumen

**Tipos de tarifas:**
- Por libra
- Por pie cubico
- Tarifa fija
- Combinadas

---

## NAVEGACION DEL SISTEMA

### Menu Lateral (Sidebar)
El menu lateral muestra opciones segun tu rol y servicios habilitados.

**Secciones comunes:**
- Dashboard (inicio)
- Modulos especificos del rol
- Documentacion
- Soporte Tecnico

**Colapsar menu:** Click en el icono de hamburguesa o flecha

### Header Superior
- **Buscador**: Busqueda rapida en el sistema
- **Balance Wallet**: Click para ver detalles y recargar
- **Tema**: Alternar modo claro/oscuro
- **Notificaciones**: Alertas y mensajes del sistema
- **Menu Usuario**: Perfil, configuracion, cerrar sesion

### Acciones Comunes

**Buscar:**
- Usa el buscador del header para busqueda global
- Cada tabla tiene su propio filtro de busqueda
- Filtros avanzados disponibles en la mayoria de vistas

**Crear nuevo:**
- Boton "Nuevo" o "+" generalmente arriba a la derecha
- Algunos usan modales, otros paginas completas

**Editar:**
- Click en el item o icono de lapiz
- Cambios se guardan con boton "Guardar"

**Eliminar:**
- Icono de papelera (generalmente requiere confirmacion)
- Algunos items se desactivan en lugar de eliminarse

---

## PROBLEMAS COMUNES Y SOLUCIONES

### "No tengo acceso a un modulo"
- Verifica que el servicio este habilitado para tu empresa
- Contacta al administrador para revisar permisos
- Algunos modulos requieren rol de admin

### "No puedo crear una orden"
- Verifica que tengas saldo suficiente en wallet
- Asegurate de completar todos los campos requeridos
- El destinatario debe tener direccion valida en Cuba

### "Mi publicacion fue rechazada"
- Revisa el motivo de rechazo en los detalles
- Ajusta el precio si esta fuera de rango
- Verifica que el producto cumpla las politicas

### "No veo mi balance actualizado"
- Actualiza la pagina (F5)
- Los pagos con tarjeta pueden demorar unos minutos
- Contacta soporte si persiste despues de 15 minutos

### "Error al subir imagen"
- Verifica que el archivo sea JPG, PNG o WebP
- Tamano maximo: 5MB
- Intenta comprimir la imagen si es muy grande

### "La pagina carga lento"
- Verifica tu conexion a internet
- Limpia cache del navegador
- Intenta en modo incognito

---

## ATAJOS Y TIPS

- **Ctrl + K** o **Cmd + K**: Abrir buscador rapido
- **Click en logo**: Volver al dashboard
- **Doble click en fila**: Abrir detalles en la mayoria de tablas
- Usa filtros para encontrar informacion mas rapido
- Guarda borradores antes de cerrar formularios largos
- Exporta reportes a Excel para analisis offline

---

## CONTACTO DE SOPORTE

Si no puedo resolver tu duda:
1. Describe el problema con detalle
2. Incluye capturas de pantalla si es posible
3. Indica en que pagina estas y que intentabas hacer
4. Se creara un ticket para el equipo de soporte
`

export default SYSTEM_KNOWLEDGE
