'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  ShoppingCart,
  Search,
  Package,
  Plus,
  Minus,
  X,
  ChevronRight,
  Store,
  Grid,
  List,
  User,
  Phone,
  Home as HomeIcon,
  CreditCard,
  ArrowLeft,
  Check,
  Star,
  Clock,
  Filter,
  Printer,
  Truck,
  ShoppingBag,
  FileText,
  Calendar,
  TrendingUp,
  Eye,
  Download
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'

// Datos de Cuba - Provincias y Municipios
const CUBA_PROVINCES = [
  { id: 'pinar-del-rio', name: 'Pinar del Río', municipalities: [
    { id: 'pinar-del-rio', name: 'Pinar del Río' },
    { id: 'consolacion-del-sur', name: 'Consolación del Sur' },
    { id: 'sandino', name: 'Sandino' },
  ]},
  { id: 'la-habana', name: 'La Habana', municipalities: [
    { id: 'la-habana', name: 'La Habana' },
    { id: 'playa', name: 'Playa' },
    { id: 'centro-habana', name: 'Centro Habana' },
    { id: 'vedado', name: 'Vedado' },
    { id: 'miramar', name: 'Miramar' },
    { id: 'cojimar', name: 'Cojímar' },
    { id: 'santiago-de-las-vegas', name: 'Santiago de las Vegas' },
    { id: 'el-cerro', name: 'El Cerro' },
  ]},
  { id: 'matanzas', name: 'Matanzas', municipalities: [
    { id: 'matanzas', name: 'Matanzas' },
    { id: 'varadero', name: 'Varadero' },
    { id: 'cardenas', name: 'Cárdenas' },
  ]},
  { id: 'cienfuegos', name: 'Cienfuegos', municipalities: [
    { id: 'cienfuegos', name: 'Cienfuegos' },
    { id: 'caibarien', name: 'Caibarién' },
  ]},
  { id: 'villa-clara', name: 'Villa Clara', municipalities: [
    { id: 'santa-clara', name: 'Santa Clara' },
    { id: 'remedios', name: 'Remedios' },
    { id: 'caibarien', name: 'Caibarién' },
  ]},
  { id: 'sancti-spiritus', name: 'Sancti Spíritus', municipalities: [
    { id: 'sancti-spiritus', name: 'Sancti Spíritus' },
    { id: 'trinidad', name: 'Trinidad' },
  ]},
  { id: 'camaguey', name: 'Camagüey', municipalities: [
    { id: 'camaguey', name: 'Camagüey' },
    { id: 'florida', name: 'Florida' },
  ]},
  { id: 'las-tunas', name: 'Las Tunas', municipalities: [
    { id: 'las-tunas', name: 'Las Tunas' },
    { id: 'puerto-padre', name: 'Puerto Padre' },
  ]},
  { id: 'holguin', name: 'Holguín', municipalities: [
    { id: 'holguin', name: 'Holguín' },
    { id: 'gibara', name: 'Gibara' },
    { id: 'banes', name: 'Banes' },
  ]},
  { id: 'granma', name: 'Granma', municipalities: [
    { id: 'bayamo', name: 'Bayamo' },
    { id: 'manzanillo', name: 'Manzanillo' },
  ]},
  { id: 'santiago-de-cuba', name: 'Santiago de Cuba', municipalities: [
    { id: 'santiago-de-cuba', name: 'Santiago de Cuba' },
    { id: 'palma-soriano', name: 'Palma Soriano' },
  ]},
  { id: 'guantanamo', name: 'Guantánamo', municipalities: [
    { id: 'guantanamo', name: 'Guantánamo' },
    { id: 'baracoa', name: 'Baracoa' },
  ]},
  { id: 'isla-de-la-juventud', name: 'Isla de la Juventud', municipalities: [
    { id: 'nueva-gerona', name: 'Nueva Gerona' },
  ]},
]

// Mock markets data
const MOCK_MARKETS = [
  {
    id: 'market-1',
    name: 'Mercado Popular La Habana',
    description: 'El mejor mercado del centro de La Habana',
    address: 'Calle 23 #456, Vedado, La Habana',
    province: 'la-habana',
    municipality: 'vedado',
    rating: 4.5,
    deliveryTime: '2-3 horas',
    image: '/images/market1.jpg',
    categories: ['Alimentos', 'Bebidas', 'Higiene', 'Limpieza'],
    products: [
      {
        id: 'p1',
        name: 'Arroz Blanco',
        category: 'Alimentos',
        price: 2.50,
        stock: 50,
        unit: 'kg',
        description: 'Arroz de alta calidad',
        image: '/images/arroz.jpg'
      },
      {
        id: 'p2',
        name: 'Pan Integral',
        category: 'Alimentos',
        price: 1.20,
        stock: 30,
        unit: 'unidad',
        description: 'Pan fresco integral',
        image: '/images/pan.jpg'
      },
      {
        id: 'p3',
        name: 'Leche Entera',
        category: 'Bebidas',
        price: 3.00,
        stock: 25,
        unit: 'litro',
        description: 'Leche fresca pasteurizada',
        image: '/images/leche.jpg'
      },
      {
        id: 'p4',
        name: 'Jabón Líquido',
        category: 'Higiene',
        price: 4.50,
        stock: 15,
        unit: 'botella',
        description: 'Jabón antibacterial',
        image: '/images/jabon.jpg'
      }
    ]
  },
  {
    id: 'market-2',
    name: 'Tienda Varadero Beach',
    description: 'Todo para tu día de playa',
    address: 'Avenida 1ra #123, Varadero, Matanzas',
    province: 'matanzas',
    municipality: 'varadero',
    rating: 4.8,
    deliveryTime: '3-4 horas',
    image: '/images/market2.jpg',
    categories: ['Alimentos', 'Bebidas', 'Playa', 'Snacks'],
    products: [
      {
        id: 'p5',
        name: 'Cerveza Cristal',
        category: 'Bebidas',
        price: 1.50,
        stock: 100,
        unit: 'lata',
        description: 'Cerveza nacional',
        image: '/images/cerveza.jpg'
      },
      {
        id: 'p6',
        name: 'Protector Solar',
        category: 'Playa',
        price: 8.00,
        stock: 20,
        unit: 'unidad',
        description: 'FPS 50+',
        image: '/images/protector.jpg'
      }
    ]
  },
  {
    id: 'market-3',
    name: 'Mercado Central Santiago',
    description: 'El corazón comercial de Santiago',
    address: 'Calle Heredia #789, Santiago de Cuba',
    province: 'santiago-de-cuba',
    municipality: 'santiago-de-cuba',
    rating: 4.2,
    deliveryTime: '2-4 horas',
    image: '/images/market3.jpg',
    categories: ['Alimentos', 'Frutas', 'Verduras'],
    products: [
      {
        id: 'p7',
        name: 'Mango Tommy',
        category: 'Frutas',
        price: 0.80,
        stock: 60,
        unit: 'unidad',
        description: 'Mango dulce y jugoso',
        image: '/images/mango.jpg'
      },
      {
        id: 'p8',
        name: 'Tomates Frescos',
        category: 'Verduras',
        price: 1.20,
        stock: 40,
        unit: 'kg',
        description: 'Tomates de huerta',
        image: '/images/tomates.jpg'
      }
    ]
  },
  {
    id: 'market-4',
    name: 'Mercado Municipal Florida',
    description: 'El mercado principal de Florida, Camagüey',
    address: 'Calle Martí #234, Florida, Camagüey',
    province: 'camaguey',
    municipality: 'florida',
    rating: 4.3,
    deliveryTime: '1-2 horas',
    image: '/images/market4.jpg',
    categories: ['Alimentos', 'Carnicería', 'Frutas', 'Verduras'],
    products: [
      {
        id: 'p9',
        name: 'Carne de Cerdo',
        category: 'Carnicería',
        price: 8.50,
        stock: 40,
        unit: 'libra',
        description: 'Carne fresca de cerdo',
        image: '/images/cerdo.jpg'
      },
      {
        id: 'p10',
        name: 'Papas Frescas',
        category: 'Verduras',
        price: 2.20,
        stock: 80,
        unit: 'kg',
        description: 'Papas de la región',
        image: '/images/papas.jpg'
      },
      {
        id: 'p11',
        name: 'Naranjas',
        category: 'Frutas',
        price: 1.80,
        stock: 120,
        unit: 'kg',
        description: 'Naranjas jugosas',
        image: '/images/naranjas.jpg'
      },
      {
        id: 'p12',
        name: 'Aceite Vegetal',
        category: 'Alimentos',
        price: 5.50,
        stock: 30,
        unit: 'litro',
        description: 'Aceite refinado',
        image: '/images/aceite.jpg'
      }
    ]
  },
  {
    id: 'market-5',
    name: 'Mini Mercado El Progreso',
    description: 'Variedad de productos a buen precio',
    address: 'Avenida Camilo Cienfuegos #567, Florida, Camagüey',
    province: 'camaguey',
    municipality: 'florida',
    rating: 4.0,
    deliveryTime: '2-3 horas',
    image: '/images/market5.jpg',
    categories: ['Abarrotes', 'Bebidas', 'Limpieza', 'Panadería'],
    products: [
      {
        id: 'p13',
        name: 'Pan de Manteca',
        category: 'Panadería',
        price: 0.80,
        stock: 60,
        unit: 'unidad',
        description: 'Pan recién horneado',
        image: '/images/panmanteca.jpg'
      },
      {
        id: 'p14',
        name: 'Refresco Cola',
        category: 'Bebidas',
        price: 1.20,
        stock: 150,
        unit: 'botella',
        description: 'Refresco 2L',
        image: '/images/refresco.jpg'
      },
      {
        id: 'p15',
        name: 'Detergente en Polvo',
        category: 'Limpieza',
        price: 6.00,
        stock: 25,
        unit: 'kg',
        description: 'Detergente para ropa',
        image: '/images/detergente.jpg'
      }
    ]
  },
  {
    id: 'market-6',
    name: 'Servisumic',
    description: 'Ferretería y mercado con todo para el hogar y la construcción',
    address: 'Calle San José #45, Centro Habana, La Habana',
    province: 'la-habana',
    municipality: 'centro-habana',
    rating: 4.4,
    deliveryTime: '1-2 horas',
    image: '/images/market6.jpg',
    categories: ['Ferretería', 'Construcción', 'Hogar', 'Electricidad', 'Fontanería'],
    products: [
      {
        id: 'p16',
        name: 'Taladro Eléctrico',
        category: 'Ferretería',
        price: 45.00,
        stock: 12,
        unit: 'unidad',
        description: 'Taladro de percusión 550W',
        image: '/images/taladro.jpg'
      },
      {
        id: 'p17',
        name: 'Juego de Destornilladores',
        category: 'Ferretería',
        price: 15.50,
        stock: 25,
        unit: 'juego',
        description: 'Set de 6 destornilladores',
        image: '/images/destornilladores.jpg'
      },
      {
        id: 'p18',
        name: 'Cinta Métrica',
        category: 'Construcción',
        price: 4.20,
        stock: 40,
        unit: 'unidad',
        description: 'Cinta métrica de 5 metros',
        image: '/images/cinta.jpg'
      },
      {
        id: 'p19',
        name: 'Llave Inglesa',
        category: 'Ferretería',
        price: 8.75,
        stock: 18,
        unit: 'unidad',
        description: 'Llave inglesa ajustable',
        image: '/images/llave.jpg'
      },
      {
        id: 'p20',
        name: 'Interruptor Simple',
        category: 'Electricidad',
        price: 2.30,
        stock: 50,
        unit: 'unidad',
        description: 'Interruptor de pared',
        image: '/images/interruptor.jpg'
      }
    ]
  },
  {
    id: 'market-7',
    name: 'Titos Market',
    description: 'El mercado más popular del Cerro con productos frescos y variados',
    address: 'Calle Calzada del Cerro #234, El Cerro, La Habana',
    province: 'la-habana',
    municipality: 'el-cerro',
    rating: 4.1,
    deliveryTime: '1-3 horas',
    image: '/images/market7.jpg',
    categories: ['Alimentos', 'Frutas', 'Verduras', 'Carnicería', 'Abarrotes'],
    products: [
      {
        id: 'p21',
        name: 'Pollo Fresco',
        category: 'Carnicería',
        price: 3.50,
        stock: 35,
        unit: 'libra',
        description: 'Pollo fresco de granja',
        image: '/images/pollo.jpg'
      },
      {
        id: 'p22',
        name: 'Tomates Orgánicos',
        category: 'Verduras',
        price: 2.80,
        stock: 28,
        unit: 'libra',
        description: 'Tomates cultivados orgánicamente',
        image: '/images/tomatesorganicos.jpg'
      },
      {
        id: 'p23',
        name: 'Leche Entera',
        category: 'Alimentos',
        price: 2.90,
        stock: 40,
        unit: 'litro',
        description: 'Leche entera pasteurizada',
        image: '/images/lecheentera.jpg'
      },
      {
        id: 'p24',
        name: 'Mamey',
        category: 'Frutas',
        price: 1.80,
        stock: 45,
        unit: 'unidad',
        description: 'Mamey maduro y dulce',
        image: '/images/mamey.jpg'
      },
      {
        id: 'p25',
        name: 'Café Molido',
        category: 'Alimentos',
        price: 6.50,
        stock: 22,
        unit: 'paquete',
        description: 'Café molido tostado',
        image: '/images/cafe.jpg'
      }
    ]
  },
  {
    id: 'market-8',
    name: 'Casa del Bazar',
    description: 'Bazar y artículos del hogar con todo para tu confort',
    address: 'Calle Galiano #567, Centro Habana, La Habana',
    province: 'la-habana',
    municipality: 'centro-habana',
    rating: 4.2,
    deliveryTime: '1-2 horas',
    image: '/images/market8.jpg',
    categories: ['Bazar', 'Hogar', 'Electrónica', 'Decoración', 'Cocina'],
    products: [
      {
        id: 'p26',
        name: 'Set de Ollas Antiadherentes',
        category: 'Cocina',
        price: 32.00,
        stock: 15,
        unit: 'juego',
        description: 'Set de 5 ollas antiadherentes',
        image: '/images/ollas.jpg'
      },
      {
        id: 'p27',
        name: 'Lámpara LED de Escritorio',
        category: 'Electrónica',
        price: 12.50,
        stock: 30,
        unit: 'unidad',
        description: 'Lámpara LED ajustable',
        image: '/images/lampara.jpg'
      },
      {
        id: 'p28',
        name: 'Esponjas Multiusos',
        category: 'Hogar',
        price: 3.80,
        stock: 60,
        unit: 'paquete',
        description: 'Pack de 6 esponjas multiusos',
        image: '/images/esponjas.jpg'
      },
      {
        id: 'p29',
        name: 'Cuadros Decorativos',
        category: 'Decoración',
        price: 18.00,
        stock: 12,
        unit: 'juego',
        description: 'Set de 3 cuadros decorativos',
        image: '/images/cuadros.jpg'
      },
      {
        id: 'p30',
        name: 'Cargador USB Multiple',
        category: 'Electrónica',
        price: 8.50,
        stock: 40,
        unit: 'unidad',
        description: 'Cargador con 4 puertos USB',
        image: '/images/cargador.jpg'
      }
    ]
  },
  {
    id: 'market-9',
    name: 'El Progreso del Cerro',
    description: 'Tienda de conveniencia con productos básicos y servicios',
    address: 'Calle San Francisco #123, El Cerro, La Habana',
    province: 'la-habana',
    municipality: 'el-cerro',
    rating: 3.9,
    deliveryTime: '2-3 horas',
    image: '/images/market9.jpg',
    categories: ['Alimentos', 'Bebidas', 'Limpieza', 'Higiene', 'Farmacia'],
    products: [
      {
        id: 'p31',
        name: 'Pan Integral',
        category: 'Alimentos',
        price: 1.10,
        stock: 50,
        unit: 'unidad',
        description: 'Pan integral recién horneado',
        image: '/images/panintegral.jpg'
      },
      {
        id: 'p32',
        name: 'Agua Mineral 1.5L',
        category: 'Bebidas',
        price: 0.80,
        stock: 80,
        unit: 'botella',
        description: 'Agua mineral purificada',
        image: '/images/agua.jpg'
      },
      {
        id: 'p33',
        name: 'Jabón de Tocador',
        category: 'Higiene',
        price: 2.20,
        stock: 35,
        unit: 'unidad',
        description: 'Jabón antibacterial',
        image: '/images/jabontocador.jpg'
      },
      {
        id: 'p34',
        name: 'Aspirina Tabletas',
        category: 'Farmacia',
        price: 1.50,
        stock: 25,
        unit: 'caja',
        description: 'Analgésico común',
        image: '/images/aspirina.jpg'
      },
      {
        id: 'p35',
        name: 'Papel Higiénico',
        category: 'Higiene',
        price: 3.60,
        stock: 20,
        unit: 'paquete',
        description: 'Papel higiénico 4 rollos',
        image: '/images/papel.jpg'
      }
    ]
  }
]

interface CartItem {
  product: any
  marketId: string
  marketName: string
  quantity: number
}

interface CustomerInfo {
  name: string
  phone: string
  address: string
  email?: string
  notes?: string
}

interface Order {
  id: string
  date: string
  customerName: string
  customerPhone: string
  customerAddress: string
  marketName: string
  marketAddress: string
  items: Array<{productName: string; quantity: number; price: number; unit: string}>
  total: number
  status: 'pending' | 'preparing' | 'delivering' | 'delivered' | 'cancelled'
  deliveryTime: string
  notes?: string
}

// Mock orders data
const MOCK_ORDERS: Order[] = [
  {
    id: 'MRK-001',
    date: '17/10/2024 09:30',
    customerName: 'María González López',
    customerPhone: '+53 5234-5678',
    customerAddress: 'Calle 23 #456, Vedado, La Habana',
    marketName: 'Mercado Popular La Habana',
    marketAddress: 'Calle 23 #456, Vedado, La Habana',
    items: [
      { productName: 'Arroz Blanco', quantity: 2, price: 2.50, unit: 'kg' },
      { productName: 'Pan Integral', quantity: 3, price: 1.20, unit: 'unidad' },
      { productName: 'Leche Entera', quantity: 1, price: 3.00, unit: 'litro' }
    ],
    total: 10.60,
    status: 'delivered',
    deliveryTime: '2-3 horas',
    notes: 'Entregar en la puerta del apartamento 3B'
  },
  {
    id: 'MRK-002',
    date: '17/10/2024 10:15',
    customerName: 'Carlos Miguel Rodríguez',
    customerPhone: '+53 5345-6789',
    customerAddress: 'Avenida 1ra #123, Varadero, Matanzas',
    marketName: 'Tienda Varadero Beach',
    marketAddress: 'Avenida 1ra #123, Varadero, Matanzas',
    items: [
      { productName: 'Cerveza Cristal', quantity: 6, price: 1.50, unit: 'lata' },
      { productName: 'Protector Solar', quantity: 1, price: 8.00, unit: 'unidad' }
    ],
    total: 17.00,
    status: 'delivering',
    deliveryTime: '3-4 horas'
  },
  {
    id: 'MRK-003',
    date: '17/10/2024 11:00',
    customerName: 'Ana Isabel Martínez',
    customerPhone: '+53 5456-7890',
    customerAddress: 'Calle Heredia #789, Santiago de Cuba',
    marketName: 'Mercado Central Santiago',
    marketAddress: 'Calle Heredia #789, Santiago de Cuba',
    items: [
      { productName: 'Mango Tommy', quantity: 5, price: 0.80, unit: 'unidad' },
      { productName: 'Tomates Frescos', quantity: 2, price: 1.20, unit: 'kg' }
    ],
    total: 6.40,
    status: 'preparing',
    deliveryTime: '2-4 horas',
    notes: 'Cliente prefiere tomates bien maduros'
  },
  {
    id: 'MRK-004',
    date: '17/10/2024 08:45',
    customerName: 'Luis Ernesto Hernández',
    customerPhone: '+53 5567-8901',
    customerAddress: 'Calle Martí #234, Florida, Camagüey',
    marketName: 'Mercado Municipal Florida',
    marketAddress: 'Calle Martí #234, Florida, Camagüey',
    items: [
      { productName: 'Carne de Cerdo', quantity: 3, price: 8.50, unit: 'libra' },
      { productName: 'Papas Frescas', quantity: 2, price: 2.20, unit: 'kg' },
      { productName: 'Naranjas', quantity: 1, price: 1.80, unit: 'kg' }
    ],
    total: 31.10,
    status: 'pending',
    deliveryTime: '1-2 horas'
  },
  {
    id: 'MRK-005',
    date: '16/10/2024 19:30',
    customerName: 'Diana Rosa Pérez',
    customerPhone: '+53 5678-9012',
    customerAddress: 'Calle San José #45, Centro Habana, La Habana',
    marketName: 'Servisumic',
    marketAddress: 'Calle San José #45, Centro Habana, La Habana',
    items: [
      { productName: 'Taladro Eléctrico', quantity: 1, price: 45.00, unit: 'unidad' },
      { productName: 'Juego de Destornilladores', quantity: 1, price: 15.50, unit: 'juego' },
      { productName: 'Cinta Métrica', quantity: 2, price: 4.20, unit: 'unidad' }
    ],
    total: 68.90,
    status: 'delivered',
    deliveryTime: '1-2 horas',
    notes: 'Entregar después de las 6 PM'
  }
]

type Step = 'location' | 'markets' | 'shopping' | 'checkout' | 'success' | 'orders'

export default function MarketplacePage() {
  const { theme } = useTheme()
  const [currentStep, setCurrentStep] = useState<Step>('location')
  const [selectedProvince, setSelectedProvince] = useState('')
  const [selectedMunicipality, setSelectedMunicipality] = useState('')
  const [availableMarkets, setAvailableMarkets] = useState(MOCK_MARKETS)
  const [selectedMarket, setSelectedMarket] = useState(MOCK_MARKETS[0])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todas')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    address: '',
    email: '',
    notes: ''
  })
  const [showCart, setShowCart] = useState(false)
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [showOrderForm, setShowOrderForm] = useState(false)

  // Manejar parámetros URL para navegación directa a órdenes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const tab = urlParams.get('tab')
      if (tab === 'orders') {
        setCurrentStep('orders')
      }
    }
  }, [])

  // Filtrar mercados por ubicación
  const filterMarketsByLocation = () => {
    console.log('Filtrando por:', { selectedProvince, selectedMunicipality })

    let filtered = MOCK_MARKETS.filter(market =>
      market.province === selectedProvince &&
      market.municipality === selectedMunicipality
    )

    console.log('Mercados con coincidencia exacta:', filtered.length)

    if (filtered.length === 0 && selectedProvince) {
      filtered = MOCK_MARKETS.filter(market =>
        market.province === selectedProvince
      )
      console.log('Mercados en misma provincia:', filtered.length)
    }

    if (filtered.length === 0) {
      console.log('No hay mercados disponibles para la ubicación seleccionada')
      setAvailableMarkets([])
    } else {
      console.log('Mostrando mercados disponibles:', filtered.length)
      setAvailableMarkets(filtered)
    }

    setCurrentStep('markets')
  }

  // Cambiar de mercado
  const changeMarket = (marketId: string) => {
    const market = availableMarkets.find(m => m.id === marketId)
    if (market) {
      setSelectedMarket(market)
      setCurrentStep('shopping')
    }
  }

  // Agregar al carrito
  const addToCart = (product: any) => {
    if (product.stock === 0) return

    const existingItem = cart.find(item =>
      item.product.id === product.id &&
      item.marketId === selectedMarket.id
    )

    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        setCart(cart.map(item =>
          item.product.id === product.id && item.marketId === selectedMarket.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
      }
    } else {
      setCart([...cart, {
        product,
        marketId: selectedMarket.id,
        marketName: selectedMarket.name,
        quantity: 1
      }])
    }
  }

  // Eliminar del carrito
  const removeFromCart = (productId: string, marketId: string) => {
    setCart(cart.filter(item =>
      !(item.product.id === productId && item.marketId === marketId)
    ))
  }

  // Actualizar cantidad
  const updateQuantity = (productId: string, marketId: string, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(productId, marketId)
    } else {
      setCart(cart.map(item =>
        item.product.id === productId && item.marketId === marketId
          ? { ...item, quantity: Math.min(quantity, item.product.stock) }
          : item
      ))
    }
  }

  // Calcular total
  const getTotalAmount = () => {
    return cart.reduce((total, item) =>
      total + (item.product.price * item.quantity), 0
    ).toFixed(2)
  }

  // Función para imprimir ticket
  const printTicket = () => {
    const orderId = `MRK-${Date.now().toString().slice(-6)}`
    const currentDate = new Date().toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    // Create new order and add to orders array
    const newOrder: Order = {
      id: orderId,
      date: currentDate,
      customerName: customerInfo.name,
      customerPhone: customerInfo.phone,
      customerAddress: customerInfo.address,
      marketName: selectedMarket.name,
      marketAddress: selectedMarket.address,
      items: cart.map(item => ({
        productName: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        unit: item.product.unit
      })),
      total: parseFloat(getTotalAmount()),
      status: 'pending',
      deliveryTime: selectedMarket.deliveryTime,
      notes: customerInfo.notes
    }

    setOrders([newOrder, ...orders])

    const ticketContent = `
      <html>
        <head>
          <title>Ticket de Venta - ${orderId}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 20px;
              background: white;
              width: 300px;
            }
            .header {
              text-align: center;
              border-bottom: 2px dashed #000;
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .info {
              font-size: 12px;
              margin-bottom: 3px;
            }
            .content {
              margin: 20px 0;
            }
            .section-title {
              font-weight: bold;
              border-bottom: 1px dashed #000;
              padding-bottom: 5px;
              margin-top: 15px;
              margin-bottom: 10px;
            }
            .item {
              margin: 8px 0;
              font-size: 12px;
            }
            .total {
              text-align: right;
              font-weight: bold;
              margin-top: 10px;
              border-top: 1px dashed #000;
              padding-top: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              border-top: 2px dashed #000;
              padding-top: 10px;
              font-size: 11px;
            }
            .delivery-info {
              background: #f0f0f0;
              padding: 10px;
              margin: 10px 0;
              border-radius: 5px;
              font-size: 11px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">CUBARAPID</div>
            <div class="info">Sistema de Mercado</div>
            <div class="info">Ticket de Venta</div>
          </div>

          <div class="content">
            <div class="section-title">Información del Pedido</div>
            <div class="item">Orden: <strong>${orderId}</strong></div>
            <div class="item">Fecha: ${currentDate}</div>
            <div class="item">Mercado: ${selectedMarket.name}</div>

            <div class="section-title">Datos del Cliente</div>
            <div class="item">Nombre: ${customerInfo.name}</div>
            <div class="item">Teléfono: ${customerInfo.phone}</div>
            <div class="item">Dirección: ${customerInfo.address}</div>
            ${customerInfo.email ? `<div class="item">Email: ${customerInfo.email}</div>` : ''}

            <div class="section-title">Detalle de Productos</div>
            ${cart.map(item => `
              <div class="item">
                ${item.product.name} x${item.quantity} ${item.product.unit}
                <div style="text-align: right; margin-top: 2px;">
                  $${(item.product.price * item.quantity).toFixed(2)}
                </div>
              </div>
            `).join('')}

            <div class="total">
              <div>Subtotal: $${getTotalAmount()}</div>
              <div style="margin-top: 5px; font-size: 16px;">
                <strong>TOTAL: $${getTotalAmount()}</strong>
              </div>
            </div>

            ${customerInfo.notes ? `
              <div class="delivery-info">
                <strong>Notas:</strong><br>
                ${customerInfo.notes}
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <div>¡Gracias por su compra!</div>
            <div>Tiempo de entrega estimado: ${selectedMarket.deliveryTime}</div>
            <div style="margin-top: 10px;">www.cubarapid.com</div>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (printWindow) {
      printWindow.document.write(ticketContent)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  // Filtrar productos
  const filteredProducts = selectedMarket.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Obtener categorías únicas
  const categories = ['Todas', ...new Set(selectedMarket.products.map(p => p.category))]

  // Renderizar pasos
  const renderLocationStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      <div className="text-center">
        <div className={cn(
          "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
          theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
        )}>
          <MapPin className={cn(
            "w-10 h-10",
            theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
          )} />
        </div>
        <h2 className={cn(
          "text-3xl font-bold mb-4",
          theme === 'dark' ? "text-white" : "text-gray-900"
        )}>
          ¿Dónde quieres recibir tu pedido?
        </h2>
        <p className={cn(
          "text-lg",
          theme === 'dark' ? "text-gray-400" : "text-gray-600"
        )}>
          Selecciona tu provincia y municipio para ver los mercados disponibles
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <label className={cn(
            "block text-sm font-medium mb-3",
            theme === 'dark' ? "text-gray-300" : "text-gray-700"
          )}>
            Provincia
          </label>
          <select
            value={selectedProvince}
            onChange={(e) => {
              setSelectedProvince(e.target.value)
              setSelectedMunicipality('')
            }}
            className={cn(
              "w-full px-4 py-3 rounded-xl border transition-all duration-300",
              theme === 'dark'
                ? "bg-white/5 border-white/10 text-white focus:border-exa-secondary"
                : "bg-gray-50 border-gray-200 text-gray-900 focus:border-exa-primary"
            )}
          >
            <option value="">Selecciona una provincia</option>
            {CUBA_PROVINCES.map(province => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </select>
        </div>

        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <label className={cn(
            "block text-sm font-medium mb-3",
            theme === 'dark' ? "text-gray-300" : "text-gray-700"
          )}>
            Municipio
          </label>
          <select
            value={selectedMunicipality}
            onChange={(e) => setSelectedMunicipality(e.target.value)}
            disabled={!selectedProvince}
            className={cn(
              "w-full px-4 py-3 rounded-xl border transition-all duration-300 disabled:opacity-50",
              theme === 'dark'
                ? "bg-white/5 border-white/10 text-white focus:border-exa-secondary"
                : "bg-gray-50 border-gray-200 text-gray-900 focus:border-exa-primary"
            )}
          >
            <option value="">Selecciona un municipio</option>
            {selectedProvince &&
              CUBA_PROVINCES.find(p => p.id === selectedProvince)?.municipalities.map(municipality => (
                <option key={municipality.id} value={municipality.id}>
                  {municipality.name}
                </option>
              ))
            }
          </select>
        </div>
      </div>

      {selectedProvince && selectedMunicipality && (
        <div className="text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={filterMarketsByLocation}
            className={cn(
              "px-8 py-4 rounded-xl font-medium transition-all duration-300",
              theme === 'dark'
                ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                : "bg-exa-primary hover:bg-exa-primary/90 text-white"
            )}
          >
            Buscar Mercados
          </motion.button>
        </div>
      )}
    </motion.div>
  )

  const renderMarketsStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn(
            "text-3xl font-bold mb-2",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            Mercados Disponibles
          </h2>
          <p className={cn(
            "text-lg",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            {availableMarkets.length} mercados en tu zona
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setCurrentStep('location')}
          className={cn(
            "px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2",
            theme === 'dark'
              ? "bg-white/10 text-white hover:bg-white/20"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          )}
        >
          <ArrowLeft className="w-4 h-4" />
          Cambiar Ubicación
        </motion.button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableMarkets.map((market, index) => (
          <motion.div
            key={market.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className={cn(
              "rounded-2xl border p-6 cursor-pointer transition-all duration-300 hover:shadow-xl",
              theme === 'dark'
                ? "bg-white/5 border-white/10 hover:border-exa-secondary/30"
                : "bg-white border-gray-200 hover:border-exa-primary/30"
            )}
            onClick={() => {
              setSelectedMarket(market)
              setCurrentStep('shopping')
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center",
                theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
              )}>
                <Store className={cn(
                  "w-8 h-8",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )} />
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                <span className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  {market.rating}
                </span>
              </div>
            </div>

            <h3 className={cn(
              "text-xl font-bold mb-2",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              {market.name}
            </h3>

            <p className={cn(
              "text-sm mb-4",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              {market.description}
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-exa-primary" />
                <span className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {market.address}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-exa-primary" />
                <span className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {market.deliveryTime}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {market.categories.slice(0, 3).map(category => (
                <span
                  key={category}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium",
                    theme === 'dark'
                      ? "bg-exa-primary/20 text-exa-primary"
                      : "bg-exa-primary/10 text-exa-primary"
                  )}
                >
                  {category}
                </span>
              ))}
              {market.categories.length > 3 && (
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium",
                  theme === 'dark'
                    ? "bg-white/10 text-gray-400"
                    : "bg-gray-100 text-gray-600"
                )}>
                  +{market.categories.length - 3}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )

  const renderShoppingStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      {/* Header con info del mercado */}
      <div className={cn(
        "rounded-2xl border p-6",
        theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-16 h-16 rounded-xl flex items-center justify-center",
              theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
            )}>
              <Store className={cn(
                "w-8 h-8",
                theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
              )} />
            </div>
            <div>
              <h2 className={cn(
                "text-2xl font-bold mb-1",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {selectedMarket.name}
              </h2>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                {selectedMarket.address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentStep('markets')}
              className={cn(
                "px-6 py-3 rounded-xl font-medium transition-all duration-300",
                theme === 'dark'
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Cambiar Mercado
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOrderForm(true)}
              className={cn(
                "px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2",
                theme === 'dark'
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
            >
              <ShoppingBag className="w-5 h-5" />
              Ordenar
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowCart(!showCart)}
              className={cn(
                "relative px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2",
                theme === 'dark'
                  ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                  : "bg-exa-primary hover:bg-exa-primary/90 text-white"
              )}
            >
              <ShoppingCart className="w-5 h-5" />
              Carrito
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
                  {cart.reduce((total, item) => total + item.quantity, 0)}
                </span>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Filtros y búsqueda */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "w-full pl-12 pr-4 py-3 rounded-xl border transition-all duration-300",
              theme === 'dark'
                ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
            )}
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={cn(
            "px-4 py-3 rounded-xl border transition-all duration-300",
            theme === 'dark'
              ? "bg-white/5 border-white/10 text-white focus:border-exa-secondary"
              : "bg-white border-gray-200 text-gray-900 focus:border-exa-primary"
          )}
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode('grid')}
            className={cn(
              "flex-1 py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2",
              viewMode === 'grid'
                ? theme === 'dark'
                  ? "bg-exa-secondary/20 text-exa-secondary border border-exa-secondary/30"
                  : "bg-exa-primary/20 text-exa-primary border border-exa-primary/30"
                : theme === 'dark'
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <Grid className="w-5 h-5" />
            Grid
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setViewMode('list')}
            className={cn(
              "flex-1 py-3 rounded-xl transition-all duration-300 flex items-center justify-center gap-2",
              viewMode === 'list'
                ? theme === 'dark'
                  ? "bg-exa-secondary/20 text-exa-secondary border border-exa-secondary/30"
                  : "bg-exa-primary/20 text-exa-primary border border-exa-primary/30"
                : theme === 'dark'
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <List className="w-5 h-5" />
            Lista
          </motion.button>
        </div>
      </div>

      {/* Productos */}
      <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-4'}>
        {filteredProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-xl",
              viewMode === 'list' ? 'flex' : '',
              theme === 'dark'
                ? "bg-white/5 border-white/10 hover:border-exa-secondary/30"
                : "bg-white border-gray-200 hover:border-exa-primary/30"
            )}
          >
            {/* Imagen del producto */}
            <div className={cn(
              viewMode === 'list' ? 'w-32 h-32' : 'h-48',
              "relative overflow-hidden"
            )}>
              <div className={cn(
                "absolute inset-0 flex items-center justify-center",
                theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
              )}>
                <Package className={cn(
                  "w-16 h-16",
                  theme === 'dark' ? "text-gray-600" : "text-gray-400"
                )} />
              </div>

              {product.stock === 0 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white font-bold">Agotado</span>
                </div>
              )}
            </div>

            {/* Info del producto */}
            <div className={cn(
              "p-4 flex-1",
              viewMode === 'list' ? 'flex items-center justify-between w-full' : ''
            )}>
              <div className={viewMode === 'list' ? 'flex-1' : ''}>
                <span className={cn(
                  "text-xs font-medium px-2 py-1 rounded-full inline-block mb-2",
                  theme === 'dark'
                    ? "bg-exa-primary/20 text-exa-primary"
                    : "bg-exa-primary/10 text-exa-primary"
                )}>
                  {product.category}
                </span>

                <h3 className={cn(
                  "font-bold mb-1",
                  viewMode === 'list' ? 'text-lg' : 'text-base',
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  {product.name}
                </h3>

                <p className={cn(
                  "text-sm mb-3",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {product.description}
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <div className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      ${product.price.toFixed(2)}
                    </div>
                    <div className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      por {product.unit}
                    </div>
                  </div>

                  <div className={cn(
                    "text-xs px-2 py-1 rounded-lg text-center",
                    product.stock > 10
                      ? theme === 'dark'
                        ? "bg-green-500/20 text-green-400"
                        : "bg-green-50 text-green-600"
                      : product.stock > 0
                        ? theme === 'dark'
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-yellow-50 text-yellow-600"
                        : theme === 'dark'
                          ? "bg-red-500/20 text-red-400"
                          : "bg-red-50 text-red-600"
                  )}>
                    {product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'}
                  </div>
                </div>
              </div>

              {/* Botón agregar */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => addToCart(product)}
                disabled={product.stock === 0}
                className={cn(
                  "px-6 py-3 rounded-xl font-medium transition-all duration-300 mt-4 w-full",
                  product.stock === 0
                    ? theme === 'dark'
                      ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : theme === 'dark'
                      ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                      : "bg-exa-primary hover:bg-exa-primary/90 text-white"
                )}
              >
                {product.stock > 0 ? 'Agregar al Carrito' : 'Agotado'}
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Carrito deslizante desde la derecha */}
      <AnimatePresence>
        {showCart && cart.length > 0 && (
          <>
            {/* Overlay de fondo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowCart(false)}
            />

            {/* Carrito lateral */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed right-0 top-0 h-full w-full max-w-md rounded-l-2xl shadow-2xl z-50 overflow-hidden",
                theme === 'dark' ? "bg-gray-900 border-l border-white/10" : "bg-white border-l border-gray-200"
              )}
            >
              {/* Header del carrito */}
              <div className={cn(
                "sticky top-0 p-6 border-b backdrop-blur-sm",
                theme === 'dark' ? "border-white/10 bg-gray-900/95" : "border-gray-200 bg-white/95"
              )}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={cn(
                      "text-xl font-bold mb-1",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Tu Carrito
                    </h3>
                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      {cart.reduce((total, item) => total + item.quantity, 0)} productos
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCart(false)}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                      theme === 'dark' ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>

              {/* Productos del carrito */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-4">
                  {cart.map((item) => (
                    <motion.div
                      key={`${item.product.id}-${item.marketId}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "rounded-xl p-4 border",
                        theme === 'dark' ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className={cn(
                            "font-medium mb-1",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {item.product.name}
                          </h4>
                          <p className={cn(
                            "text-xs mb-2",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            {item.marketName}
                          </p>
                          <div className={cn(
                            "text-xs px-2 py-1 rounded-lg inline-block",
                            item.product.stock > 10
                              ? theme === 'dark'
                                ? "bg-green-500/20 text-green-400"
                                : "bg-green-50 text-green-600"
                              : item.product.stock > 0
                                ? theme === 'dark'
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-yellow-50 text-yellow-600"
                                : theme === 'dark'
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-red-50 text-red-600"
                          )}>
                            {item.product.stock > 0
                              ? `${Math.min(item.product.stock, 10)}+ disponibles`
                              : 'Agotado'
                            }
                          </div>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeFromCart(item.product.id, item.marketId)}
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center ml-2",
                            theme === 'dark' ? "bg-red-500/20 text-red-400 hover:bg-red-500/30" : "bg-red-50 text-red-600 hover:bg-red-100"
                          )}
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateQuantity(item.product.id, item.marketId, item.quantity - 1)}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                              theme === 'dark' ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            )}
                          >
                            <Minus className="w-4 h-4" />
                          </motion.button>

                          <span className={cn(
                            "w-10 text-center font-semibold text-lg",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            {item.quantity}
                          </span>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => updateQuantity(item.product.id, item.marketId, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                              item.quantity >= item.product.stock
                                ? theme === 'dark'
                                  ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : theme === 'dark'
                                  ? "bg-white/10 text-white hover:bg-white/20"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            )}
                          >
                            <Plus className="w-4 h-4" />
                          </motion.button>
                        </div>

                        <div className="text-right">
                          <div className={cn(
                            "font-bold text-lg",
                            theme === 'dark' ? "text-white" : "text-gray-900"
                          )}>
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </div>
                          <div className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            ${item.product.price.toFixed(2)} c/u
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Footer del carrito */}
              <div className={cn(
                "sticky bottom-0 p-6 border-t backdrop-blur-sm",
                theme === 'dark' ? "border-white/10 bg-gray-900/95" : "border-gray-200 bg-white/95"
              )}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-lg font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Total:
                    </span>
                    <span className={cn(
                      "text-2xl font-bold",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      ${getTotalAmount()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowCart(false)
                      }}
                      className={cn(
                        "w-full py-3 rounded-xl font-medium transition-all duration-300",
                        theme === 'dark'
                          ? "bg-white/10 text-white hover:bg-white/20"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      )}
                    >
                      Seguir Comprando
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setShowCart(false)
                        setCurrentStep('checkout')
                      }}
                      className={cn(
                        "w-full py-4 rounded-xl font-medium transition-all duration-300",
                        theme === 'dark'
                          ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                          : "bg-exa-primary hover:bg-exa-primary/90 text-white"
                      )}
                    >
                      Proceder al Pago
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Full-screen Order Form Modal */}
      <AnimatePresence>
        {showOrderForm && (
          <>
            {/* Overlay de fondo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowOrderForm(false)}
            />

            {/* Formulario en pantalla completa */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed inset-4 md:inset-8 rounded-2xl shadow-2xl z-50 overflow-hidden",
                theme === 'dark' ? "bg-gray-900 border border-white/10" : "bg-white border border-gray-200"
              )}
            >
              {/* Header del formulario */}
              <div className={cn(
                "flex items-center justify-between p-6 border-b",
                theme === 'dark' ? "border-white/10 bg-gray-900/95" : "border-gray-200 bg-white/95"
              )}>
                <div>
                  <h2 className={cn(
                    "text-2xl font-bold",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    Formulario de Pedido Guiado
                  </h2>
                  <p className={cn(
                    "text-sm mt-1",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Complete todos los datos para procesar el pedido
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowOrderForm(false)}
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    theme === 'dark' ? "bg-white/10 text-white hover:bg-white/20" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Contenido del formulario - mismo que checkout pero en pantalla completa */}
              <div className="p-6 h-[calc(100%-80px)] overflow-y-auto">
                <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                  {/* Formulario de cliente */}
                  <div className={cn(
                    "rounded-2xl border p-6",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                  )}>
                    <h3 className={cn(
                      "text-xl font-bold mb-6",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Datos del Cliente
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Nombre Completo
                        </label>
                        <input
                          type="text"
                          value={customerInfo.name}
                          onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                            theme === 'dark'
                              ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                              : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                          )}
                          placeholder="Nombre del cliente"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                            theme === 'dark'
                              ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                              : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                          )}
                          placeholder="+53 XXXXXXXXX"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Dirección de Entrega
                        </label>
                        <textarea
                          value={customerInfo.address}
                          onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                          rows={3}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                            theme === 'dark'
                              ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                              : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                          )}
                          placeholder="Calle, número, municipio, provincia..."
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Email (Opcional)
                        </label>
                        <input
                          type="email"
                          value={customerInfo.email}
                          onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                            theme === 'dark'
                              ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                              : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                          )}
                          placeholder="email@ejemplo.com"
                        />
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Notas Adicionales
                        </label>
                        <textarea
                          value={customerInfo.notes}
                          onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                          rows={2}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                            theme === 'dark'
                              ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                              : "bg-white border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                          )}
                          placeholder="Instrucciones especiales de entrega..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Carrito actual */}
                  <div className={cn(
                    "rounded-2xl border p-6",
                    theme === 'dark' ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200"
                  )}>
                    <h3 className={cn(
                      "text-xl font-bold mb-6",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Resumen del Pedido
                    </h3>

                    {cart.length === 0 ? (
                      <div className="text-center py-8">
                        <ShoppingCart className={cn(
                          "w-16 h-16 mx-auto mb-4",
                          theme === 'dark' ? "text-gray-600" : "text-gray-400"
                        )} />
                        <p className={cn(
                          "text-lg",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          No hay productos en el carrito
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setShowOrderForm(false)
                            // Focus on adding products
                          }}
                          className={cn(
                            "mt-4 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                            theme === 'dark'
                              ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                              : "bg-exa-primary hover:bg-exa-primary/90 text-white"
                          )}
                        >
                          Agregar Productos
                        </motion.button>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-4 max-h-64 overflow-y-auto mb-6">
                          {cart.map((item) => (
                            <div key={`${item.product.id}-${item.marketId}`} className={cn(
                              "flex items-center justify-between py-3 border-b",
                              theme === 'dark' ? "border-white/10" : "border-gray-200"
                            )}>
                              <div className="flex-1">
                                <div className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  {item.product.name} x{item.quantity}
                                </div>
                                <div className={cn(
                                  "text-xs",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {item.marketName}
                                </div>
                              </div>
                              <div className={cn(
                                "font-medium",
                                theme === 'dark' ? "text-white" : "text-gray-900"
                              )}>
                                ${(item.product.price * item.quantity).toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className={cn(
                          "p-4 rounded-xl",
                          theme === 'dark' ? "bg-exa-secondary/10 border border-exa-secondary/30" : "bg-exa-primary/10 border border-exa-primary/30"
                        )}>
                          <div className="flex items-center justify-between mb-4">
                            <span className={cn(
                              "text-lg font-medium",
                              theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              Total del Pedido:
                            </span>
                            <span className={cn(
                              "text-2xl font-bold",
                              theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                            )}>
                              ${getTotalAmount()}
                            </span>
                          </div>

                          <div className="space-y-3">
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setShowOrderForm(false)}
                              className={cn(
                                "w-full py-3 rounded-xl font-medium transition-all duration-300",
                                theme === 'dark'
                                  ? "bg-white/10 text-white hover:bg-white/20"
                                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                              )}
                            >
                              Cerrar Formulario
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (customerInfo.name && customerInfo.phone && customerInfo.address && cart.length > 0) {
                                  setShowOrderForm(false)
                                  setCurrentStep('success')
                                }
                              }}
                              disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address || cart.length === 0}
                              className={cn(
                                "w-full py-4 rounded-xl font-medium transition-all duration-300",
                                theme === 'dark'
                                  ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                                  : "bg-exa-primary hover:bg-exa-primary/90 text-white",
                                (!customerInfo.name || !customerInfo.phone || !customerInfo.address || cart.length === 0) ? "opacity-50 cursor-not-allowed" : ""
                              )}
                            >
                              Confirmar Pedido
                            </motion.button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )

  const renderCheckoutStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center">
        <h2 className={cn(
          "text-3xl font-bold mb-2",
          theme === 'dark' ? "text-white" : "text-gray-900"
        )}>
          Información de Entrega
        </h2>
        <p className={cn(
          "text-lg",
          theme === 'dark' ? "text-gray-400" : "text-gray-600"
        )}>
          Complete los datos para procesar su pedido
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Formulario */}
        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <h3 className={cn(
            "text-xl font-bold mb-6",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            Datos del Destinatario
          </h3>

          <div className="space-y-4">
            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Nombre Completo
              </label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="Nombre del destinatario"
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Teléfono
              </label>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="+53 XXXXXXXXX"
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Dirección de Entrega
              </label>
              <textarea
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                rows={3}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="Calle, número, municipio, provincia..."
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Email (Opcional)
              </label>
              <input
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="email@ejemplo.com"
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                Notas Adicionales
              </label>
              <textarea
                value={customerInfo.notes}
                onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                rows={2}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border transition-all duration-300",
                  theme === 'dark'
                    ? "bg-white/5 border-white/10 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="Instrucciones especiales de entrega..."
              />
            </div>
          </div>
        </div>

        {/* Resumen del pedido */}
        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <h3 className={cn(
            "text-xl font-bold mb-6",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            Resumen del Pedido
          </h3>

          <div className="space-y-4 max-h-64 overflow-y-auto">
            {cart.map((item) => (
              <div key={`${item.product.id}-${item.marketId}`} className={cn(
                "flex items-center justify-between py-3 border-b",
                theme === 'dark' ? "border-white/10" : "border-gray-200"
              )}>
                <div className="flex-1">
                  <div className={cn(
                    "font-medium",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {item.product.name} x{item.quantity}
                  </div>
                  <div className={cn(
                    "text-xs",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    {item.marketName}
                  </div>
                </div>
                <div className={cn(
                  "font-medium",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  ${(item.product.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className={cn(
            "mt-6 pt-6 border-t",
            theme === 'dark' ? "border-white/10" : "border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <span className={cn(
                "text-lg font-medium",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Total del Pedido:
              </span>
              <span className={cn(
                "text-2xl font-bold",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                ${getTotalAmount()}
              </span>
            </div>

            <div className="space-y-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentStep('shopping')}
                className={cn(
                  "w-full py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "bg-white/10 text-white hover:bg-white/20"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Volver al Carrito
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentStep('success')}
                disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address}
                className={cn(
                  "w-full py-4 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                    : "bg-exa-primary hover:bg-exa-primary/90 text-white",
                  (!customerInfo.name || !customerInfo.phone || !customerInfo.address) ? "opacity-50 cursor-not-allowed" : ""
                )}
              >
                Confirmar Pedido
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )

  const renderSuccessStep = () => {
    const orderId = `MRK-${Date.now().toString().slice(-6)}`

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-8 max-w-4xl mx-auto"
      >
        <div className={cn(
          "w-24 h-24 rounded-full mx-auto flex items-center justify-center",
          theme === 'dark' ? "bg-green-500/20" : "bg-green-50"
        )}>
          <Check className={cn(
            "w-12 h-12",
            theme === 'dark' ? "text-green-400" : "text-green-600"
          )} />
        </div>

        <div>
          <h2 className={cn(
            "text-3xl font-bold mb-4",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            ¡Pedido Confirmado!
          </h2>
          <p className={cn(
            "text-lg mb-2",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            Tu pedido ha sido procesado exitosamente
          </p>
          <p className={cn(
            "text-lg font-bold",
            theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
          )}>
            Orden #{orderId}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Detalles de Entrega */}
          <div className={cn(
            "rounded-2xl border p-6 text-left",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
          )}>
            <h3 className={cn(
              "text-xl font-bold mb-4",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Detalles de Entrega
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )} />
                <span className={cn(
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  {customerInfo.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )} />
                <span className={cn(
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  {customerInfo.phone}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <HomeIcon className={cn(
                  "w-5 h-5",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )} />
                <span className={cn(
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  {customerInfo.address}
                </span>
              </div>
            </div>
          </div>

          {/* Resumen del Pedido */}
          <div className={cn(
            "rounded-2xl border p-6 text-left",
            theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
          )}>
            <h3 className={cn(
              "text-xl font-bold mb-4",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Resumen del Pedido
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {cart.map((item) => (
                <div key={`${item.product.id}-${item.marketId}`} className={cn(
                  "flex items-center justify-between text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <span>{item.product.name} x{item.quantity}</span>
                  <span className="font-medium">${(item.product.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className={cn(
              "mt-4 pt-4 border-t",
              theme === 'dark' ? "border-white/10" : "border-gray-200"
            )}>
              <div className="flex items-center justify-between">
                <span className={cn(
                  "font-bold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Total:
                </span>
                <span className={cn(
                  "font-bold text-lg",
                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                )}>
                  ${getTotalAmount()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Información de Notificaciones de Entrega */}
        <div className={cn(
          "rounded-2xl border p-6 text-left",
          theme === 'dark' ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-50 border-blue-200"
        )}>
          <div className="flex items-center gap-3 mb-4">
            <Truck className={cn(
              "w-6 h-6",
              theme === 'dark' ? "text-blue-400" : "text-blue-600"
            )} />
            <h3 className={cn(
              "text-xl font-bold",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Proceso de Entrega y Notificaciones
            </h3>
          </div>

          <div className="space-y-4">
            <p className={cn(
              "text-sm leading-relaxed",
              theme === 'dark' ? "text-gray-300" : "text-gray-700"
            )}>
              <strong>El destinatario recibirá notificaciones automáticas en cada etapa del proceso de entrega:</strong>
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5",
                    theme === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                  )}>
                    1
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium text-sm mb-1",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Confirmación del Pedido
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      SMS/WhatsApp confirmación del pedido recibido
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5",
                    theme === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                  )}>
                    2
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium text-sm mb-1",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      En Proceso de Preparación
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Notificación cuando el pedido esté siendo preparado
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5",
                    theme === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                  )}>
                    3
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium text-sm mb-1",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Repartidor en Camino
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Mensaje con nombre del repartidor y tiempo estimado
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5",
                    theme === 'dark' ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-600"
                  )}>
                    4
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium text-sm mb-1",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Entrega Completada
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Confirmación de entrega exitosa del pedido
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn(
              "mt-4 p-3 rounded-lg text-xs",
              theme === 'dark' ? "bg-white/5" : "bg-white/70"
            )}>
              <p className={cn(
                "font-medium mb-1",
                theme === 'dark' ? "text-blue-400" : "text-blue-700"
              )}>
                📱 Tiempo estimado de entrega: {selectedMarket.deliveryTime}
              </p>
              <p className={cn(
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                El destinatario podrá contactar directamente al repartidor si necesita alguna aclaración adicional.
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={printTicket}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2",
              theme === 'dark'
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            )}
          >
            <Printer className="w-5 h-5" />
            Imprimir Ticket
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setCart([])
              setCustomerInfo({ name: '', phone: '', address: '', email: '', notes: '' })
              setCurrentStep('location')
            }}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all duration-300",
              theme === 'dark'
                ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                : "bg-exa-primary hover:bg-exa-primary/90 text-white"
            )}
          >
            Nuevo Pedido
          </motion.button>
        </div>
      </motion.div>
    )
  }

  const renderOrdersStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={cn(
            "text-3xl font-bold mb-2",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            📋 Lista de Órdenes
          </h2>
          <p className={cn(
            "text-lg",
            theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            Historial completo de órdenes de la empresa
          </p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const ordersData = JSON.stringify(orders, null, 2)
              const blob = new Blob([ordersData], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `orders-${new Date().toISOString().split('T')[0]}.json`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              URL.revokeObjectURL(url)
            }}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2",
              theme === 'dark'
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-green-500 hover:bg-green-600 text-white"
            )}
          >
            <Download className="w-5 h-5" />
            Exportar Órdenes
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCurrentStep('location')}
            className={cn(
              "px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-2",
              theme === 'dark'
                ? "bg-white/10 text-white hover:bg-white/20"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al Mercado
          </motion.button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Total Órdenes
              </p>
              <p className={cn(
                "text-3xl font-bold mt-1",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {orders.length}
              </p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              theme === 'dark' ? "bg-blue-500/20" : "bg-blue-50"
            )}>
              <FileText className={cn(
                "w-6 h-6",
                theme === 'dark' ? "text-blue-400" : "text-blue-600"
              )} />
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Ingresos Totales
              </p>
              <p className={cn(
                "text-3xl font-bold mt-1",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                ${orders.reduce((sum, order) => sum + order.total, 0).toFixed(2)}
              </p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              theme === 'dark' ? "bg-green-500/20" : "bg-green-50"
            )}>
              <TrendingUp className={cn(
                "w-6 h-6",
                theme === 'dark' ? "text-green-400" : "text-green-600"
              )} />
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Pendientes
              </p>
              <p className={cn(
                "text-3xl font-bold mt-1",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {orders.filter(o => o.status === 'pending').length}
              </p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              theme === 'dark' ? "bg-yellow-500/20" : "bg-yellow-50"
            )}>
              <Clock className={cn(
                "w-6 h-6",
                theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
              )} />
            </div>
          </div>
        </div>

        <div className={cn(
          "rounded-2xl border p-6",
          theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between">
            <div>
              <p className={cn(
                "text-sm font-medium",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Completadas
              </p>
              <p className={cn(
                "text-3xl font-bold mt-1",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {orders.filter(o => o.status === 'delivered').length}
              </p>
            </div>
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              theme === 'dark' ? "bg-green-500/20" : "bg-green-50"
            )}>
              <Check className={cn(
                "w-6 h-6",
                theme === 'dark' ? "text-green-400" : "text-green-600"
              )} />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Órdenes */}
      <div className={cn(
        "rounded-2xl border overflow-hidden",
        theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-200"
      )}>
        <div className={cn(
          "p-6 border-b",
          theme === 'dark' ? "border-white/10" : "border-gray-200"
        )}>
          <h3 className={cn(
            "text-xl font-bold",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            Todas las Órdenes
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={cn(
              theme === 'dark' ? "bg-white/5" : "bg-gray-50"
            )}>
              <tr>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  Orden
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  Cliente
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  Mercado
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  Total
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  Estado
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  Fecha
                </th>
                <th className={cn(
                  "px-6 py-4 text-left text-xs font-medium uppercase tracking-wider",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className={cn(
              theme === 'dark' ? "divide-white/10" : "divide-gray-200"
            )}>
              {orders.map((order, index) => (
                <tr key={order.id} className={cn(
                  index % 2 === 0
                    ? theme === 'dark' ? "bg-white/5" : "bg-white"
                    : theme === 'dark' ? "bg-white/[0.02]" : "bg-gray-50/50"
                )}>
                  <td className={cn(
                    "px-6 py-4 whitespace-nowrap",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <div className="text-sm font-medium">{order.id}</div>
                    <div className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {order.deliveryTime}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {order.customerName}
                    </div>
                    <div className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {order.customerPhone}
                    </div>
                  </td>
                  <td className={cn(
                    "px-6 py-4 whitespace-nowrap text-sm",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {order.marketName}
                  </td>
                  <td className={cn(
                    "px-6 py-4 whitespace-nowrap text-sm font-medium",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    ${order.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full",
                      order.status === 'delivered'
                        ? theme === 'dark'
                          ? "bg-green-500/20 text-green-400"
                          : "bg-green-100 text-green-800"
                        : order.status === 'pending'
                          ? theme === 'dark'
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-yellow-100 text-yellow-800"
                          : order.status === 'preparing'
                            ? theme === 'dark'
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-blue-100 text-blue-800"
                            : order.status === 'delivering'
                              ? theme === 'dark'
                                ? "bg-purple-500/20 text-purple-400"
                                : "bg-purple-100 text-purple-800"
                              : theme === 'dark'
                                ? "bg-red-500/20 text-red-400"
                                : "bg-red-100 text-red-800"
                    )}>
                      {order.status === 'delivered' ? 'Entregado' :
                       order.status === 'pending' ? 'Pendiente' :
                       order.status === 'preparing' ? 'Preparando' :
                       order.status === 'delivering' ? 'En Reparto' : 'Cancelado'}
                    </span>
                  </td>
                  <td className={cn(
                    "px-6 py-4 whitespace-nowrap text-sm",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {order.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          // Show order details
                          console.log('Order details:', order)
                        }}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          theme === 'dark'
                            ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                            : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                        )}
                      >
                        <Eye className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && (
          <div className="text-center py-12">
            <FileText className={cn(
              "w-16 h-16 mx-auto mb-4",
              theme === 'dark' ? "text-gray-600" : "text-gray-400"
            )} />
            <p className={cn(
              "text-lg",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              No hay órdenes registradas
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setCurrentStep('location')}
              className={cn(
                "mt-4 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                theme === 'dark'
                  ? "bg-exa-secondary hover:bg-exa-secondary/90 text-white"
                  : "bg-exa-primary hover:bg-exa-primary/90 text-white"
              )}
            >
              Crear Primera Orden
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  )

  return (
    <ProtectedRoute requiredRole="SUPER_ADMIN">
      <DashboardLayout>
        <div className="max-w-7xl mx-auto p-6">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              {[
                { step: 'location', label: 'Ubicación' },
                { step: 'markets', label: 'Mercados' },
                { step: 'shopping', label: 'Compra' },
                { step: 'checkout', label: 'Pago' },
                { step: 'success', label: 'Confirmado' },
                { step: 'orders', label: 'Órdenes' }
              ].map((item, index) => (
                <div key={item.step} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                      currentStep === item.step || (currentStep === 'success' && item.step === 'success') || (currentStep === 'orders' && item.step === 'orders')
                        ? theme === 'dark'
                          ? "bg-exa-secondary text-white"
                          : "bg-exa-primary text-white"
                        : ['location', 'markets', 'shopping', 'checkout', 'success'].indexOf(currentStep) > ['location', 'markets', 'shopping', 'checkout', 'success', 'orders'].indexOf(item.step)
                          ? theme === 'dark'
                            ? "bg-white/10 text-white"
                            : "bg-gray-100 text-gray-700"
                          : theme === 'dark'
                            ? "bg-exa-secondary/20 text-exa-secondary"
                            : "bg-exa-primary/20 text-exa-primary"
                    )}>
                      {currentStep === item.step || (currentStep === 'success' && item.step === 'success') || (currentStep === 'orders' && item.step === 'orders') ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className={cn(
                      "ml-3 text-sm font-medium",
                      currentStep === item.step || (currentStep === 'success' && item.step === 'success') || (currentStep === 'orders' && item.step === 'orders')
                        ? theme === 'dark'
                          ? "text-exa-secondary"
                          : "text-exa-primary"
                        : theme === 'dark'
                          ? "text-gray-400"
                          : "text-gray-600"
                    )}>
                      {item.label}
                    </span>
                  </div>
                  {index < 5 && (
                    <div className={cn(
                      "flex-1 h-1 mx-4 transition-all duration-300",
                      ['location', 'markets', 'shopping', 'checkout', 'success'].indexOf(currentStep) > index
                        ? theme === 'dark'
                          ? "bg-exa-secondary"
                          : "bg-exa-primary"
                        : theme === 'dark'
                          ? "bg-white/10"
                          : "bg-gray-200"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {currentStep === 'location' && renderLocationStep()}
            {currentStep === 'markets' && renderMarketsStep()}
            {currentStep === 'shopping' && renderShoppingStep()}
            {currentStep === 'checkout' && renderCheckoutStep()}
            {currentStep === 'success' && renderSuccessStep()}
            {currentStep === 'orders' && renderOrdersStep()}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}