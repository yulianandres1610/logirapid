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
  Filter
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

type Step = 'location' | 'markets' | 'shopping' | 'checkout' | 'success'

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

  // Filtrar mercados por ubicación
  const filterMarketsByLocation = () => {
    let filtered = MOCK_MARKETS.filter(market =>
      market.province === selectedProvince &&
      market.municipality === selectedMunicipality
    )

    // Si no hay mercados exactos, buscar por provincia
    if (filtered.length === 0) {
      filtered = MOCK_MARKETS.filter(market =>
        market.province === selectedProvince
      )
    }

    // Si todavía no hay, mostrar todos
    if (filtered.length === 0) {
      filtered = MOCK_MARKETS
    }

    setAvailableMarkets(filtered)
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

  const renderSuccessStep = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-8 max-w-2xl mx-auto"
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
          Orden #MRK-{Date.now().toString().slice(-6)}
        </p>
      </div>

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

      <div className="space-y-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setCart([])
            setCustomerInfo({ name: '', phone: '', address: '', email: '', notes: '' })
            setCurrentStep('location')
          }}
          className={cn(
            "px-8 py-4 rounded-xl font-medium transition-all duration-300",
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

  return (
    <ProtectedRoute requiredRole="ADMIN">
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
                { step: 'success', label: 'Confirmado' }
              ].map((item, index) => (
                <div key={item.step} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300",
                      currentStep === item.step || (currentStep === 'success' && item.step === 'success')
                        ? theme === 'dark'
                          ? "bg-exa-secondary text-white"
                          : "bg-exa-primary text-white"
                        : ['location', 'markets', 'shopping', 'checkout'].indexOf(currentStep) > ['location', 'markets', 'shopping', 'checkout', 'success'].indexOf(item.step)
                          ? theme === 'dark'
                            ? "bg-white/10 text-white"
                            : "bg-gray-100 text-gray-700"
                          : theme === 'dark'
                            ? "bg-exa-secondary/20 text-exa-secondary"
                            : "bg-exa-primary/20 text-exa-primary"
                    )}>
                      {currentStep === item.step || (currentStep === 'success' && item.step === 'success') ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span className={cn(
                      "ml-3 text-sm font-medium",
                      currentStep === item.step || (currentStep === 'success' && item.step === 'success')
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
                  {index < 4 && (
                    <div className={cn(
                      "flex-1 h-1 mx-4 transition-all duration-300",
                      ['location', 'markets', 'shopping', 'checkout'].indexOf(currentStep) > index
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
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}