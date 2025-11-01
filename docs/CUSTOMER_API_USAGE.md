# Uso del API Global de Clientes

Este documento explica cómo utilizar el endpoint global de clientes `/api/customers` desde cualquier vista del sistema.

## 📍 Endpoint Principal
```
GET /api/customers
```

## 🚀 Ejemplos de Uso

### 1. Buscar cliente por teléfono
```javascript
// Para usar en cualquier componente de React
const searchCustomerByPhone = async (phone) => {
  try {
    const response = await fetch(`/api/customers?phone=${encodeURIComponent(phone)}`)
    const data = await response.json()

    if (data.success && data.data.length > 0) {
      return data.data[0] // Retorna el cliente encontrado
    }
    return null
  } catch (error) {
    console.error('Error searching customer:', error)
    return null
  }
}

// Ejemplo de uso:
const customer = await searchCustomerByPhone('+5351234567')
if (customer) {
  console.log('Cliente encontrado:', customer.firstName, customer.lastName)
}
```

### 2. Buscar clientes por nombre o texto
```javascript
const searchCustomers = async (query) => {
  try {
    const response = await fetch(`/api/customers?search=${encodeURIComponent(query)}`)
    const data = await response.json()

    return data.success ? data.data : []
  } catch (error) {
    console.error('Error searching customers:', error)
    return []
  }
}

// Ejemplo:
const customers = await searchCustomers('Juan')
console.log('Clientes encontrados:', customers)
```

### 3. Obtener cliente por ID
```javascript
const getCustomerById = async (id) => {
  try {
    const response = await fetch(`/api/customers?id=${id}`)
    const data = await response.json()

    if (data.success && data.data.length > 0) {
      return data.data[0]
    }
    return null
  } catch (error) {
    console.error('Error getting customer:', error)
    return null
  }
}
```

### 4. Obtener todas las opciones para selects
```javascript
const getCustomerOptions = async () => {
  try {
    const response = await fetch('/api/customers?options=true')
    const data = await response.json()

    return data.success ? data.data : []
  } catch (error) {
    console.error('Error getting customer options:', error)
    return []
  }
}

// Para usar en un select:
const customerOptions = await getCustomerOptions()
// Formato: [{id: 1, firstName: "Juan", lastName: "Perez", phone: "+5351234567"}, ...]
```

### 5. Obtener estadísticas de clientes
```javascript
const getCustomerStats = async () => {
  try {
    const response = await fetch('/api/customers?stats=true')
    const data = await response.json()

    return data.success ? data.data : { total: 0, thisMonth: 0 }
  } catch (error) {
    console.error('Error getting stats:', error)
    return { total: 0, thisMonth: 0 }
  }
}

// Ejemplo:
const stats = await getCustomerStats()
console.log(`Total clientes: ${stats.total}, Este mes: ${stats.thisMonth}`)
```

### 6. Verificar si un teléfono es único
```javascript
const checkPhoneUniqueness = async (phone, excludeId = null) => {
  try {
    let url = `/api/customers?checkUnique=${encodeURIComponent(phone)}`
    if (excludeId) {
      url += `&excludeId=${excludeId}`
    }

    const response = await fetch(url)
    const data = await response.json()

    return data.success ? data.data.isUnique : false
  } catch (error) {
    console.error('Error checking phone uniqueness:', error)
    return false
  }
}

// Para validación en formularios:
const isUnique = await checkPhoneUniqueness('+5351234567', customerId)
if (!isUnique) {
  setError('Este teléfono ya está registrado')
}
```

## 🎯 Casos de Uso Recomendados

### En formulario de remesas:
```javascript
// Al ingresar teléfono del remitente
const handlePhoneChange = async (phone) => {
  const customer = await searchCustomerByPhone(phone)
  if (customer) {
    // Auto-completar datos del cliente
    setFormData({
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      address: customer.address,
      city: customer.city
    })
  }
}
```

### En vista de estadísticas:
```javascript
// Mostrar estadísticas en dashboard
const CustomerStats = () => {
  const [stats, setStats] = useState({ total: 0, thisMonth: 0 })

  useEffect(() => {
    const loadStats = async () => {
      const customerStats = await getCustomerStats()
      setStats(customerStats)
    }
    loadStats()
  }, [])

  return (
    <div>
      <h3>Total Clientes: {stats.total}</h3>
      <h4>Nuevos este mes: {stats.thisMonth}</h4>
    </div>
  )
}
```

### En select de clientes:
```javascript
// Componente para seleccionar cliente
const CustomerSelect = ({ value, onChange, onCustomerSelect }) => {
  const [customers, setCustomers] = useState([])

  useEffect(() => {
    const loadCustomers = async () => {
      const options = await getCustomerOptions()
      setCustomers(options)
    }
    loadCustomers()
  }, [])

  return (
    <select
      value={value}
      onChange={(e) => {
        const customerId = parseInt(e.target.value)
        onChange(customerId)

        // Obtener datos completos del cliente seleccionado
        const selectedCustomer = customers.find(c => c.id === customerId)
        if (selectedCustomer && onCustomerSelect) {
          onCustomerSelect(selectedCustomer)
        }
      }}
    >
      <option value="">Seleccionar cliente...</option>
      {customers.map(customer => (
        <option key={customer.id} value={customer.id}>
          {customer.firstName} {customer.lastName} - {customer.phone}
        </option>
      ))}
    </select>
  )
}
```

## 📝 Notas Importantes

1. **Codificación URL**: Siempre usa `encodeURIComponent()` para teléfonos y textos con caracteres especiales.
2. **Manejo de Errores**: Todas las funciones incluyen manejo básico de errores.
3. **Formato de Respuesta**: Siempre verificar `data.success` antes de usar `data.data`.
4. **Performance**: Las funciones globales incluyen cache interno y manejo eficiente de queries.
5. **Seguridad**: El endpoint incluye validación básica y no expone información sensible.

## 🔄 Integración con Sistema Existente

Este endpoint complementa el CRM específico en `/api/crm/customers` pero está diseñado para uso global en todo el sistema.

- **CRM**: `/api/crm/customers` - Para gestión completa del call center
- **Global**: `/api/customers` - Para consultas rápidas desde cualquier vista