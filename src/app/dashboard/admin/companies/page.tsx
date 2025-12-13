'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Trash2,
  CreditCard,
  Users,
  TrendingUp,
  Settings,
  FileText,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  DollarSign,
  Globe,
  Phone,
  MapPin,
  Mail,
  Calendar,
  Activity,
  Zap,
  Shield,
  Star,
  Loader2,
  Palette,
  CheckCircle,
  XCircle,
  Package,
  Archive,
  Truck,
  Tag,
  Save
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { WalletCard } from '@/components/wallet-card'
import { Button } from '@/components/ui/button'
import LogoUpload from '@/components/ui/LogoUpload'
import MapboxAddressAutofill from '@/components/ui/MapboxAddressAutofill'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import LoadingBox from '@/components/ui/LoadingBox'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

// Placeholder while data loads
const LOADING_COMPANIES:any[] = []
const MOCK_COMPANIES_BACKUP = [
  {
    id: 1,
    legalName: 'CubaExpress S.A.',
    phone: '+53 7 832 4567',
    address: 'Calle 23 #456, Vedado',
    city: 'La Habana',
    country: 'Cuba',
    walletNumber: '2026152345678901',
    currency: 'USD',
    isMultiCurrency: true,
    secondaryCurrencies: ['CUP', 'EUR'],
    hasLimits: true,
    dailyLimit: '5000',
    monthlyLimit: '50000',
    companyType: 'agency',
    enabledServices: ['wallet', 'recharge', 'tracker'],
    status: 'active',
    createdAt: '2024-01-15',
    einNumber: 'CU-12345678',
    walletBalance: 15420.50,
    transactionsCount: 342,
    usersCount: 28
  },
  {
    id: 2,
    legalName: 'CaribbeanMarket Ltd.',
    phone: '+1 809 555 0123',
    address: 'Avenida Churchill #123',
    city: 'Santo Domingo',
    country: 'República Dominicana',
    walletNumber: '2026987654321098',
    currency: 'USD',
    isMultiCurrency: false,
    secondaryCurrencies: [],
    hasLimits: false,
    dailyLimit: '0',
    monthlyLimit: '0',
    companyType: 'market',
    enabledServices: ['wallet', 'marketplace'],
    status: 'active',
    createdAt: '2024-02-20',
    einNumber: 'RD-87654321',
    walletBalance: 8930.75,
    transactionsCount: 156,
    usersCount: 45
  },
  {
    id: 3,
    legalName: 'GlobalRemit Corp.',
    phone: '+1 305 888 9999',
    address: 'Brickell Ave #789',
    city: 'Miami',
    country: 'Estados Unidos',
    walletNumber: '2026456789012345',
    currency: 'USD',
    isMultiCurrency: true,
    secondaryCurrencies: ['CAD', 'EUR'],
    hasLimits: true,
    dailyLimit: '10000',
    monthlyLimit: '100000',
    companyType: 'broker',
    enabledServices: ['wallet', 'recharge', 'tracker', 'marketplace'],
    status: 'active',
    createdAt: '2024-03-10',
    einNumber: 'US-987654321',
    walletBalance: 45680.25,
    transactionsCount: 892,
    usersCount: 67
  }
]

// Company creation form components (keeping the existing logic)
const STEPS = [
  { id: 1, title: 'Información Básica', icon: Building2 },
  { id: 2, title: 'Wallet', icon: CreditCard },
  { id: 3, title: 'Servicios', icon: Settings },
  { id: 4, title: 'Fee de Plataforma', icon: DollarSign },
  { id: 5, title: 'Branding', icon: Palette },
  { id: 6, title: 'Documentos', icon: FileText },
  { id: 7, title: 'Revisión', icon: Check }
]

// Pasos simplificados para Brokers
const BROKER_STEPS = [
  { id: 1, title: 'Información del Broker', icon: Building2 },
  { id: 2, title: 'Wallet', icon: CreditCard },
  { id: 3, title: 'Documentos', icon: FileText },
  { id: 4, title: 'Revisión', icon: Check }
]

const SERVICES = [
  { id: 'wallet', name: 'Wallet', description: 'Gestión de billeteras digitales' },
  { id: 'recharge', name: 'Recarga', description: 'Recargas móviles y servicios' },
  { id: 'remittance', name: 'Remesa', description: 'Envío de remesas internacionales' },
  {
    id: 'paqueteria',
    name: 'Paquetería',
    description: 'Servicio de envío y entrega de paquetes',
    hasSubmodules: true,
    submodules: [
      { id: 'paqueteria:pickup-orders', name: 'Órdenes de Recogida', description: 'Gestión de órdenes a domicilio' },
      { id: 'paqueteria:office-orders', name: 'Órdenes de Oficina', description: 'Gestión de órdenes en oficina' },
      { id: 'paqueteria:warehouses', name: 'Almacenes', description: 'Gestión de almacenes y depósitos' },
      { id: 'paqueteria:drivers', name: 'Drivers', description: 'Gestión de conductores' },
      { id: 'paqueteria:vehicles', name: 'Vehículos', description: 'Gestión de flota vehicular' },
      { id: 'paqueteria:routes', name: 'Rutas', description: 'Planificación y optimización de rutas' },
      { id: 'paqueteria:package-route', name: 'Empaque', description: 'Gestión de empaques y cajas' },
    ]
  },
  { id: 'tracker', name: 'Rastreador', description: 'Seguimiento de envíos' },
  { id: 'exchange', name: 'Tasa de Cambio', description: 'Gestión de tasas de cambio' },
  { id: 'marketplace', name: 'Mercado', description: 'Plataforma de compra y venta' },
]

const COMPANY_TYPES = [
  { id: 'agency', name: 'Agencia', description: 'Agencia de envíos y remesas' },
  { id: 'market', name: 'Mercado', description: 'Tienda o comercio electrónico' },
  { id: 'broker', name: 'Broker', description: 'Intermediario financiero' },
  { id: 'all', name: 'Todos', description: 'Todos los servicios disponibles' },
]

// Provincias y Municipios para Brokers (con coordenadas de municipios)
const BROKER_PROVINCES = [
  { id: 'pinar-del-rio', name: 'Pinar del Río', coords: [-83.6978, 22.4175], municipalities: [
    { id: 'pinar-del-rio', name: 'Pinar del Río', coords: [-83.6978, 22.4175] },
    { id: 'consolacion-del-sur', name: 'Consolación del Sur', coords: [-83.5178, 22.5056] },
    { id: 'sandino', name: 'Sandino', coords: [-84.0217, 22.0794] },
    { id: 'san-juan-y-martinez', name: 'San Juan y Martínez', coords: [-83.8353, 22.2667] },
    { id: 'guane', name: 'Guane', coords: [-84.0833, 22.2000] },
    { id: 'los-palacios', name: 'Los Palacios', coords: [-83.2500, 22.5833] },
    { id: 'vinales', name: 'Viñales', coords: [-83.7139, 22.6169] },
    { id: 'la-palma', name: 'La Palma', coords: [-83.5553, 22.7569] },
    { id: 'minas-de-matahambre', name: 'Minas de Matahambre', coords: [-83.9500, 22.5833] },
    { id: 'san-luis', name: 'San Luis', coords: [-83.7667, 22.2833] },
    { id: 'mantua', name: 'Mantua', coords: [-84.2833, 22.2833] },
  ]},
  { id: 'artemisa', name: 'Artemisa', coords: [-82.7617, 22.8136], municipalities: [
    { id: 'artemisa', name: 'Artemisa', coords: [-82.7617, 22.8136] },
    { id: 'bahia-honda', name: 'Bahía Honda', coords: [-83.1639, 22.9033] },
    { id: 'candelaria', name: 'Candelaria', coords: [-82.9583, 22.7500] },
    { id: 'guanajay', name: 'Guanajay', coords: [-82.6875, 22.9292] },
    { id: 'mariel', name: 'Mariel', coords: [-82.7528, 22.9944] },
    { id: 'san-antonio-de-los-banos', name: 'San Antonio de los Baños', coords: [-82.4992, 22.8911] },
    { id: 'san-cristobal', name: 'San Cristóbal', coords: [-83.0500, 22.7167] },
    { id: 'bauta', name: 'Bauta', coords: [-82.5489, 22.9883] },
    { id: 'caimito', name: 'Caimito', coords: [-82.5917, 22.9583] },
    { id: 'guira-de-melena', name: 'Güira de Melena', coords: [-82.5083, 22.8000] },
    { id: 'alquizar', name: 'Alquízar', coords: [-82.5833, 22.8000] },
  ]},
  { id: 'la-habana', name: 'La Habana', coords: [-82.3666, 23.1136], municipalities: [
    { id: 'playa', name: 'Playa', coords: [-82.4208, 23.1147] },
    { id: 'plaza-de-la-revolucion', name: 'Plaza de la Revolución', coords: [-82.3917, 23.1200] },
    { id: 'centro-habana', name: 'Centro Habana', coords: [-82.3667, 23.1367] },
    { id: 'habana-vieja', name: 'La Habana Vieja', coords: [-82.3500, 23.1350] },
    { id: 'regla', name: 'Regla', coords: [-82.3333, 23.1250] },
    { id: 'habana-del-este', name: 'Habana del Este', coords: [-82.2833, 23.1583] },
    { id: 'guanabacoa', name: 'Guanabacoa', coords: [-82.3000, 23.1167] },
    { id: 'san-miguel-del-padron', name: 'San Miguel del Padrón', coords: [-82.3333, 23.0833] },
    { id: 'diez-de-octubre', name: 'Diez de Octubre', coords: [-82.3667, 23.0917] },
    { id: 'cerro', name: 'Cerro', coords: [-82.3833, 23.1000] },
    { id: 'marianao', name: 'Marianao', coords: [-82.4333, 23.0833] },
    { id: 'la-lisa', name: 'La Lisa', coords: [-82.4667, 23.0333] },
    { id: 'boyeros', name: 'Boyeros', coords: [-82.4000, 22.9833] },
    { id: 'arroyo-naranjo', name: 'Arroyo Naranjo', coords: [-82.3500, 23.0333] },
    { id: 'cotorro', name: 'Cotorro', coords: [-82.2667, 23.0333] },
  ]},
  { id: 'mayabeque', name: 'Mayabeque', coords: [-81.9300, 22.9200], municipalities: [
    { id: 'bejucal', name: 'Bejucal', coords: [-82.3833, 22.9333] },
    { id: 'san-jose-de-las-lajas', name: 'San José de las Lajas', coords: [-82.1500, 22.9667] },
    { id: 'jaruco', name: 'Jaruco', coords: [-82.0167, 23.0500] },
    { id: 'santa-cruz-del-norte', name: 'Santa Cruz del Norte', coords: [-81.9167, 23.1500] },
    { id: 'madruga', name: 'Madruga', coords: [-81.8500, 22.9167] },
    { id: 'nueva-paz', name: 'Nueva Paz', coords: [-81.7500, 22.7667] },
    { id: 'san-nicolas-de-bari', name: 'San Nicolás de Bari', coords: [-81.9000, 22.7833] },
    { id: 'guines', name: 'Güines', coords: [-82.0333, 22.8333] },
    { id: 'melena-del-sur', name: 'Melena del Sur', coords: [-82.1500, 22.7833] },
    { id: 'batabano', name: 'Batabanó', coords: [-82.2833, 22.7167] },
    { id: 'quivican', name: 'Quivicán', coords: [-82.3500, 22.8167] },
  ]},
  { id: 'matanzas', name: 'Matanzas', coords: [-81.5775, 22.4117], municipalities: [
    { id: 'matanzas', name: 'Matanzas', coords: [-81.5775, 22.4117] },
    { id: 'cardenas', name: 'Cárdenas', coords: [-81.2000, 23.0333] },
    { id: 'varadero', name: 'Varadero', coords: [-81.2500, 23.1500] },
    { id: 'colon', name: 'Colón', coords: [-80.9000, 22.7167] },
    { id: 'jovellanos', name: 'Jovellanos', coords: [-81.1833, 22.8000] },
    { id: 'pedro-betancourt', name: 'Pedro Betancourt', coords: [-81.2833, 22.7000] },
    { id: 'limonar', name: 'Limonar', coords: [-81.4167, 22.9500] },
    { id: 'union-de-reyes', name: 'Unión de Reyes', coords: [-81.5333, 22.7833] },
    { id: 'los-arabos', name: 'Los Arabos', coords: [-80.7167, 22.7333] },
    { id: 'perico', name: 'Perico', coords: [-81.0167, 22.7667] },
    { id: 'marti', name: 'Martí', coords: [-80.9333, 22.9500] },
    { id: 'jaguey-grande', name: 'Jagüey Grande', coords: [-81.1333, 22.5333] },
    { id: 'cienaga-de-zapata', name: 'Ciénaga de Zapata', coords: [-81.0667, 22.3667] },
  ]},
  { id: 'cienfuegos', name: 'Cienfuegos', coords: [-80.4536, 22.1456], municipalities: [
    { id: 'cienfuegos', name: 'Cienfuegos', coords: [-80.4536, 22.1456] },
    { id: 'palmira', name: 'Palmira', coords: [-80.3833, 22.2333] },
    { id: 'rodas', name: 'Rodas', coords: [-80.5500, 22.3333] },
    { id: 'lajas', name: 'Lajas', coords: [-80.2833, 22.4167] },
    { id: 'cruces', name: 'Cruces', coords: [-80.2667, 22.3500] },
    { id: 'cumanayagua', name: 'Cumanayagua', coords: [-80.2000, 22.1500] },
    { id: 'aguada-de-pasajeros', name: 'Aguada de Pasajeros', coords: [-80.8500, 22.3833] },
    { id: 'abreus', name: 'Abreus', coords: [-80.5667, 22.2833] },
  ]},
  { id: 'villa-clara', name: 'Villa Clara', coords: [-79.9658, 22.4058], municipalities: [
    { id: 'santa-clara', name: 'Santa Clara', coords: [-79.9658, 22.4058] },
    { id: 'remedios', name: 'Remedios', coords: [-79.5458, 22.4917] },
    { id: 'caibarien', name: 'Caibarién', coords: [-79.4667, 22.5167] },
    { id: 'camajuani', name: 'Camajuaní', coords: [-79.7333, 22.4667] },
    { id: 'placetas', name: 'Placetas', coords: [-79.6500, 22.3167] },
    { id: 'sancti-spiritus', name: 'Sancti Spíritus', coords: [-79.4428, 21.9303] },
    { id: 'sagua-la-grande', name: 'Sagua la Grande', coords: [-80.0833, 22.8000] },
    { id: 'cifuentes', name: 'Cifuentes', coords: [-80.0500, 22.6167] },
    { id: 'santo-domingo', name: 'Santo Domingo', coords: [-80.2333, 22.5833] },
    { id: 'ranchuelo', name: 'Ranchuelo', coords: [-80.1500, 22.3833] },
    { id: 'manicaragua', name: 'Manicaragua', coords: [-79.9667, 22.1500] },
    { id: 'encrucijada', name: 'Encrucijada', coords: [-79.8667, 22.6167] },
    { id: 'quemado-de-guines', name: 'Quemado de Güines', coords: [-80.2500, 22.8000] },
  ]},
  { id: 'sancti-spiritus', name: 'Sancti Spíritus', coords: [-79.4428, 21.9303], municipalities: [
    { id: 'sancti-spiritus', name: 'Sancti Spíritus', coords: [-79.4428, 21.9303] },
    { id: 'trinidad', name: 'Trinidad', coords: [-79.9844, 21.8022] },
    { id: 'fomento', name: 'Fomento', coords: [-79.7167, 22.1000] },
    { id: 'cabaiguan', name: 'Cabaiguán', coords: [-79.5000, 22.0833] },
    { id: 'jatibonico', name: 'Jatibonico', coords: [-79.1667, 21.9500] },
    { id: 'taguasco', name: 'Taguasco', coords: [-79.2667, 22.0333] },
    { id: 'yaguajay', name: 'Yaguajay', coords: [-79.2333, 22.3333] },
    { id: 'la-sierpe', name: 'La Sierpe', coords: [-79.2500, 21.7500] },
  ]},
  { id: 'ciego-de-avila', name: 'Ciego de Ávila', coords: [-78.7619, 21.8403], municipalities: [
    { id: 'ciego-de-avila', name: 'Ciego de Ávila', coords: [-78.7619, 21.8403] },
    { id: 'moron', name: 'Morón', coords: [-78.6275, 22.1078] },
    { id: 'chambas', name: 'Chambas', coords: [-78.9167, 22.2000] },
    { id: 'ciro-redondo', name: 'Ciro Redondo', coords: [-78.7000, 22.0167] },
    { id: 'majagua', name: 'Majagua', coords: [-78.9833, 21.9167] },
    { id: 'florencia', name: 'Florencia', coords: [-78.9667, 22.1500] },
    { id: 'venezuela', name: 'Venezuela', coords: [-78.7833, 21.7500] },
    { id: 'baragua', name: 'Baraguá', coords: [-78.6333, 21.6833] },
    { id: 'primero-de-enero', name: 'Primero de Enero', coords: [-78.4333, 21.9500] },
    { id: 'bolivia', name: 'Bolivia', coords: [-78.4500, 21.8500] },
  ]},
  { id: 'camaguey', name: 'Camagüey', coords: [-77.9169, 21.3808], municipalities: [
    { id: 'camaguey', name: 'Camagüey', coords: [-77.9169, 21.3808] },
    { id: 'florida', name: 'Florida', coords: [-78.2167, 21.5333] },
    { id: 'vertientes', name: 'Vertientes', coords: [-78.1500, 21.2500] },
    { id: 'guaimaro', name: 'Guáimaro', coords: [-77.3500, 21.4667] },
    { id: 'sibanicu', name: 'Sibanicú', coords: [-77.5333, 21.2333] },
    { id: 'nuevitas', name: 'Nuevitas', coords: [-77.2642, 21.5456] },
    { id: 'esmeralda', name: 'Esmeralda', coords: [-78.1167, 21.8500] },
    { id: 'minas', name: 'Minas', coords: [-77.6167, 21.5000] },
    { id: 'jimaguayu', name: 'Jimaguayú', coords: [-77.8333, 21.2500] },
    { id: 'santa-cruz-del-sur', name: 'Santa Cruz del Sur', coords: [-77.9833, 20.7167] },
    { id: 'najasa', name: 'Najasa', coords: [-77.7500, 21.0833] },
    { id: 'sierra-de-cubitas', name: 'Sierra de Cubitas', coords: [-77.7833, 21.6333] },
    { id: 'cespedes', name: 'Céspedes', coords: [-78.0167, 21.1500] },
  ]},
  { id: 'las-tunas', name: 'Las Tunas', coords: [-76.9514, 20.9597], municipalities: [
    { id: 'las-tunas', name: 'Las Tunas', coords: [-76.9514, 20.9597] },
    { id: 'puerto-padre', name: 'Puerto Padre', coords: [-76.6036, 21.1958] },
    { id: 'jesus-menendez', name: 'Jesús Menéndez', coords: [-76.4833, 21.1667] },
    { id: 'manati', name: 'Manatí', coords: [-76.9333, 21.3167] },
    { id: 'majibacoa', name: 'Majibacoa', coords: [-76.7500, 20.9167] },
    { id: 'jobabo', name: 'Jobabo', coords: [-77.2833, 20.9167] },
    { id: 'colombia', name: 'Colombia', coords: [-77.4167, 20.9833] },
    { id: 'amancio', name: 'Amancio', coords: [-77.5833, 20.8167] },
  ]},
  { id: 'holguin', name: 'Holguín', coords: [-76.2633, 20.7869], municipalities: [
    { id: 'holguin', name: 'Holguín', coords: [-76.2633, 20.7869] },
    { id: 'gibara', name: 'Gibara', coords: [-76.1333, 21.1167] },
    { id: 'banes', name: 'Banes', coords: [-75.7167, 20.9667] },
    { id: 'moa', name: 'Moa', coords: [-74.9333, 20.6500] },
    { id: 'mayari', name: 'Mayarí', coords: [-75.6833, 20.6500] },
    { id: 'sagua-de-tanamo', name: 'Sagua de Tánamo', coords: [-75.2500, 20.5833] },
    { id: 'antilla', name: 'Antilla', coords: [-75.7500, 20.8333] },
    { id: 'baguano', name: 'Báguano', coords: [-76.0167, 20.7667] },
    { id: 'calixto-garcia', name: 'Calixto García', coords: [-76.5833, 20.8667] },
    { id: 'cacocum', name: 'Cacocum', coords: [-76.3333, 20.7333] },
    { id: 'cueto', name: 'Cueto', coords: [-75.9333, 20.6500] },
    { id: 'frank-pais', name: 'Frank País', coords: [-75.5833, 20.5167] },
    { id: 'rafael-freyre', name: 'Rafael Freyre', coords: [-75.9833, 21.0167] },
    { id: 'urbano-noris', name: 'Urbano Noris', coords: [-76.0500, 20.6167] },
  ]},
  { id: 'granma', name: 'Granma', coords: [-76.6431, 20.3847], municipalities: [
    { id: 'bayamo', name: 'Bayamo', coords: [-76.6431, 20.3847] },
    { id: 'manzanillo', name: 'Manzanillo', coords: [-77.1167, 20.3500] },
    { id: 'jiguani', name: 'Jiguaní', coords: [-76.4167, 20.3667] },
    { id: 'rio-cauto', name: 'Río Cauto', coords: [-76.9167, 20.5500] },
    { id: 'yara', name: 'Yara', coords: [-76.9500, 20.2833] },
    { id: 'campechuela', name: 'Campechuela', coords: [-77.2833, 20.2333] },
    { id: 'media-luna', name: 'Media Luna', coords: [-77.4333, 20.1500] },
    { id: 'niquero', name: 'Niquero', coords: [-77.5833, 20.0500] },
    { id: 'pilon', name: 'Pilón', coords: [-77.3167, 19.9000] },
    { id: 'bartolome-maso', name: 'Bartolomé Masó', coords: [-76.9500, 20.1667] },
    { id: 'buey-arriba', name: 'Buey Arriba', coords: [-76.7500, 20.1833] },
    { id: 'guisa', name: 'Guisa', coords: [-76.5333, 20.2500] },
    { id: 'cauto-cristo', name: 'Cauto Cristo', coords: [-76.4333, 20.5500] },
  ]},
  { id: 'santiago-de-cuba', name: 'Santiago de Cuba', coords: [-75.8219, 20.0247], municipalities: [
    { id: 'santiago-de-cuba', name: 'Santiago de Cuba', coords: [-75.8219, 20.0247] },
    { id: 'palma-soriano', name: 'Palma Soriano', coords: [-75.9833, 20.2167] },
    { id: 'contramaestre', name: 'Contramaestre', coords: [-76.2500, 20.3000] },
    { id: 'san-luis', name: 'San Luis', coords: [-75.8500, 20.1833] },
    { id: 'segundo-frente', name: 'Segundo Frente', coords: [-75.5167, 20.3333] },
    { id: 'songo-la-maya', name: 'Songo-La Maya', coords: [-75.6667, 20.1833] },
    { id: 'tercer-frente', name: 'Tercer Frente', coords: [-76.3333, 20.1833] },
    { id: 'guama', name: 'Guamá', coords: [-76.5833, 19.9667] },
    { id: 'mella', name: 'Mella', coords: [-76.3000, 20.3667] },
  ]},
  { id: 'guantanamo', name: 'Guantánamo', coords: [-75.2092, 20.1447], municipalities: [
    { id: 'guantanamo', name: 'Guantánamo', coords: [-75.2092, 20.1447] },
    { id: 'baracoa', name: 'Baracoa', coords: [-74.4964, 20.3467] },
    { id: 'el-salvador', name: 'El Salvador', coords: [-75.2333, 20.3167] },
    { id: 'san-antonio-del-sur', name: 'San Antonio del Sur', coords: [-74.8167, 20.0500] },
    { id: 'imias', name: 'Imías', coords: [-74.6333, 20.0833] },
    { id: 'maisi', name: 'Maisí', coords: [-74.1500, 20.2500] },
    { id: 'yateras', name: 'Yateras', coords: [-75.0333, 20.2833] },
    { id: 'caimanera', name: 'Caimanera', coords: [-75.1500, 19.9667] },
    { id: 'manuel-tames', name: 'Manuel Tames', coords: [-75.1333, 20.3000] },
    { id: 'niceto-perez', name: 'Niceto Pérez', coords: [-75.0833, 20.1000] },
  ]},
  { id: 'isla-de-la-juventud', name: 'Isla de la Juventud', coords: [-82.8500, 21.7000], municipalities: [
    { id: 'nueva-gerona', name: 'Nueva Gerona', coords: [-82.8000, 21.8833] },
  ]},
]

// Componente del Mapa para seleccionar ubicación del Broker
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface BrokerMapPickerProps {
  theme: string
  province: string
  municipality: string
  latitude: number | null
  longitude: number | null
  onLocationChange: (lat: number, lng: number) => void
}

function BrokerMapPicker({ theme, province, municipality, latitude, longitude, onLocationChange }: BrokerMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)
  const markerInstanceRef = useRef<mapboxgl.Marker | null>(null)
  const isInitializedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Obtener coordenadas del municipio (prioridad) o provincia
  const provinceData = BROKER_PROVINCES.find(p => p.id === province)
  const municipalityData = provinceData?.municipalities.find(m => m.id === municipality)

  // Usar coordenadas del municipio si están disponibles, sino de la provincia
  const getTargetCoords = useCallback((): [number, number] => {
    if (municipalityData?.coords) {
      return municipalityData.coords as [number, number]
    }
    if (provinceData?.coords) {
      return provinceData.coords as [number, number]
    }
    return [-82.3666, 23.1136] // Centro de Cuba por defecto
  }, [municipalityData, provinceData])

  // Inicializar mapa solo una vez
  useEffect(() => {
    if (isInitializedRef.current || !mapContainerRef.current) return
    isInitializedRef.current = true

    const initMap = async () => {
      try {
        mapboxgl.accessToken = MAPBOX_TOKEN

        const initialCenter = getTargetCoords()

        const map = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: 'mapbox://styles/mapbox/streets-v12', // Siempre estilo claro
          center: initialCenter,
          zoom: 12
        })

        mapInstanceRef.current = map

        map.on('load', () => {
          setStatus('ready')
          map.addControl(new mapboxgl.NavigationControl(), 'top-right')

          // Agregar marcador inicial si hay coordenadas
          if (latitude && longitude) {
            addMarker(map, longitude, latitude)
          }
        })

        map.on('click', (e) => {
          addMarker(map, e.lngLat.lng, e.lngLat.lat)
          onLocationChange(e.lngLat.lat, e.lngLat.lng)
        })

      } catch (err) {
        console.error('Map init error:', err)
        setStatus('error')
      }
    }

    const addMarker = (map: mapboxgl.Map, lng: number, lat: number) => {
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setLngLat([lng, lat])
      } else {
        const marker = new mapboxgl.Marker({ color: '#CC0A46', draggable: true })
          .setLngLat([lng, lat])
          .addTo(map)

        marker.on('dragend', () => {
          const pos = marker.getLngLat()
          onLocationChange(pos.lat, pos.lng)
        })

        markerInstanceRef.current = marker
      }
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markerInstanceRef.current = null
        isInitializedRef.current = false
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Actualizar centro cuando cambia el municipio o provincia
  useEffect(() => {
    if (mapInstanceRef.current && status === 'ready') {
      const targetCoords = getTargetCoords()
      mapInstanceRef.current.flyTo({
        center: targetCoords,
        zoom: 13, // Zoom más cercano para municipio
        duration: 1000
      })
    }
  }, [municipality, province, status, getTargetCoords])

  return (
    <div className="relative">
      <div
        ref={mapContainerRef}
        className="w-full h-[300px] rounded-xl overflow-hidden border"
        style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Cargando mapa...</span>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-xl">
          <div className="flex items-center gap-2 text-red-500">
            <XCircle className="w-5 h-5" />
            <span>Error al cargar el mapa</span>
          </div>
        </div>
      )}
      {status === 'ready' && (
        <div className={cn(
          "absolute bottom-2 left-2 px-3 py-1 rounded-lg text-xs",
          theme === 'dark' ? "bg-gray-800/80 text-gray-300" : "bg-white/80 text-gray-600"
        )}>
          Haz clic en el mapa para colocar el pin
        </div>
      )}
    </div>
  )
}

const WALLET_CURRENCIES = [
  { code: 'USD', name: 'Dólar Americano', symbol: '$', flag: '🇺🇸' },
  { code: 'CUP', name: 'Peso Cubano', symbol: '$', flag: '🇨🇺' },
  { code: 'MNX', name: 'Peso Mexicano', symbol: 'M$', flag: '🇲🇽' },
  { code: 'CAD', name: 'Dólar Canadiense', symbol: 'C$', flag: '🇨🇦' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' }
]

const getPrimaryCurrencyForCountry = (country: string) => {
  switch (country.toLowerCase()) {
    case 'cuba':
      return 'CUP'
    case 'méjico':
    case 'mexico':
      return 'MNX'
    case 'canadá':
    case 'canada':
      return 'CAD'
    case 'españa':
      return 'EUR'
    default:
      return 'USD'
  }
}

export default function CompaniesPage() {
  const { theme } = useTheme()
  const { showNotification } = useNotifications()

  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [companyDrivers, setCompanyDrivers] = useState<any[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    type: 'danger' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'warning'
  })

  // Create company form state
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({
    legalName: '',
    phone: '',
    customerServicePhone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    zipCode: '',
    walletNumber: '',
    currency: '',
    isMultiCurrency: false,
    secondaryCurrencies: [],
    hasLimits: false,
    dailyLimit: '',
    monthlyLimit: '',
    rechargeLimits: { daily: '', monthly: '' },
    transferLimits: { daily: '', monthly: '' },
    enabledServices: [],
    companyType: '',
    serviceFees: {},
    prices: { wallet: 0, recharge: 0, tracker: 0, marketplace: 0, paqueteria: 0 },
    einNumber: '',
    documents: [],
    logoUrl: '',
    labelLogoUrl: '',
    subdomain: '',
    primaryColor: '#CC0A46',
    secondaryColor: '#0A46CC',
    latitude: null,
    longitude: null,
    // Campos específicos para Brokers
    broker_province: '',
    broker_municipality: '',
    broker_address: '',
    broker_delivery_start: '08:00',
    broker_delivery_end: '18:00',
    broker_contact_phone: '',
    // Cuentas bancarias del broker
    broker_bank_accounts: [] as Array<{
      id: string
      bankName: string
      accountNumber: string
      currency: string
    }>,
  })

  // Load companies from API on mount
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/companies?includeBranches=true')
        const data = await response.json()

        if (data.success) {
          setCompanies(data.data)
        }
      } catch (error) {
        console.error('Error loading companies:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCompanies()
  }, [])

  // Fetch drivers when a company is selected
  useEffect(() => {
    const fetchCompanyDrivers = async () => {
      if (!selectedCompany?.id) {
        setCompanyDrivers([])
        return
      }

      try {
        setLoadingDrivers(true)
        const response = await fetch(`/api/drivers?companyId=${selectedCompany.id}&limit=100`)
        const data = await response.json()

        if (data.success) {
          setCompanyDrivers(data.data || [])
        }
      } catch (error) {
        console.error('Error loading company drivers:', error)
        setCompanyDrivers([])
      } finally {
        setLoadingDrivers(false)
      }
    }

    fetchCompanyDrivers()
  }, [selectedCompany?.id])

  const generateWalletNumber = () => {
    const timestamp = Date.now().toString().slice(-14)
    const walletNumber = `2026${timestamp}`
    setFormData((prev: any) => ({ ...prev, walletNumber }))
  }

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         company.country.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || company.companyType === selectedFilter
    return matchesSearch && matchesFilter
  })

  const resetForm = () => {
    setFormData({
      legalName: '',
      phone: '',
      customerServicePhone: '',
      email: '',
      website: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      walletNumber: '',
      currency: '',
      isMultiCurrency: false,
      secondaryCurrencies: [],
      hasLimits: false,
      dailyLimit: '',
      monthlyLimit: '',
      rechargeLimits: { daily: '', monthly: '' },
      transferLimits: { daily: '', monthly: '' },
      enabledServices: [],
      companyType: '',
      serviceFees: {},
      prices: { wallet: 0, recharge: 0, tracker: 0, marketplace: 0, paqueteria: 0 },
      einNumber: '',
      documents: [],
      logoUrl: '',
      labelLogoUrl: '',
      subdomain: '',
      primaryColor: '#CC0A46',
      secondaryColor: '#0A46CC',
      latitude: null,
      longitude: null,
      // Campos específicos para Brokers
      broker_province: '',
      broker_municipality: '',
      broker_address: '',
      broker_delivery_start: '08:00',
      broker_delivery_end: '18:00',
      broker_contact_phone: '',
      broker_bank_accounts: [],
    })
    setCurrentStep(1)
  }

  const handleCreateCompany = async () => {
    try {
      setLoading(true)

      // Create company via API
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || 'Error al crear empresa')
        return
      }

      const companyId = data.data.id

      // Upload documents if any
      if (formData.documents && formData.documents.length > 0) {
        try {
          const documentsFormData = new FormData()

          // Add company ID
          documentsFormData.append('companyId', companyId.toString())

          // Add all documents
          formData.documents.forEach((doc: File) => {
            documentsFormData.append('documents', doc)
          })

          const docsResponse = await fetch('/api/upload/documents', {
            method: 'POST',
            body: documentsFormData
          })

          const docsData = await docsResponse.json()

          if (!docsData.success) {
            console.error('Error uploading documents:', docsData.error)
            showNotification('warning', 'Advertencia', 'Empresa creada pero hubo un error al subir los documentos. Puedes subirlos más tarde.')
          }
        } catch (error) {
          console.error('Error uploading documents:', error)
          showNotification('warning', 'Advertencia', 'Empresa creada pero hubo un error al subir los documentos. Puedes subirlos más tarde.')
        }
      }

      // If it's a market type company, also create in marketplaces API
      if (formData.companyType === 'market') {
        try {
          await fetch('/api/admin/marketplaces', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.legalName,
              address: formData.address,
              province: formData.city.toLowerCase().includes('la habana') ? 'la-habana' : 'matanzas',
              municipality: 'vedado',
              phone: formData.phone,
              description: `Empresa tipo mercado: ${formData.legalName}`,
              categories: ['Mercado'],
              schedule: 'Lun-Dom: 8:00 AM - 8:00 PM',
              deliveryTime: '30-45 min',
              deliveryCost: 2.50
            })
          })
        } catch (error) {
          console.error('Error creating marketplace:', error)
        }
      }

      // Save product prices if any were configured
      if (formData.productPrices && formData.productPrices.length > 0) {
        const pricesToSave = formData.productPrices.filter((p: any) =>
          p.precioSucursales !== undefined || p.precioClientes !== undefined
        )

        if (pricesToSave.length > 0) {
          try {
            const pricingResponse = await fetch(`/api/companies/${companyId}/products/pricing`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                products: pricesToSave,
                notes: 'Configurado al crear empresa'
              })
            })

            const pricingData = await pricingResponse.json()

            if (!pricingData.success) {
              console.warn('Error saving product prices:', pricingData.error)
              // Don't fail the whole operation, just warn
            }
          } catch (error) {
            console.error('Error saving product prices:', error)
          }
        }
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      setShowCreateForm(false)
      resetForm()
      showNotification('success', '¡Éxito!', 'Empresa creada exitosamente')

    } catch (error) {
      console.error('Error creating company:', error)
      showNotification('error', 'Error', 'Error al crear empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  // Función para guardar progreso en cualquier momento
  const handleSaveProgress = async () => {
    // Validar que al menos tenga nombre legal
    if (!formData.legalName || formData.legalName.trim() === '') {
      showNotification('warning', 'Atención', 'Debes ingresar al menos el nombre legal de la empresa')
      return
    }

    try {
      setLoading(true)

      // Generar número de wallet si no existe
      if (!formData.walletNumber) {
        const timestamp = Date.now().toString().slice(-14)
        formData.walletNumber = `2026${timestamp}`
      }

      // Si está en modo edición, actualizar; sino, crear
      if (formData.editMode && formData.id) {
        const response = await fetch(`/api/companies/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            status: formData.status || 'draft' // Guardar como borrador
          })
        })

        const data = await response.json()

        if (!data.success) {
          showNotification('error', 'Error', data.error || 'Error al guardar')
          return
        }

        showNotification('success', '¡Guardado!', 'Cambios guardados correctamente')
      } else {
        // Crear nueva empresa como borrador
        const response = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            status: 'draft' // Guardar como borrador
          })
        })

        const data = await response.json()

        if (!data.success) {
          showNotification('error', 'Error', data.error || 'Error al guardar')
          return
        }

        // Actualizar formData con el ID de la empresa creada para poder seguir editando
        setFormData((prev: any) => ({
          ...prev,
          id: data.data.id,
          editMode: true
        }))

        showNotification('success', '¡Guardado!', 'Empresa guardada como borrador. Puedes continuar editando.')
      }

      // Recargar lista de empresas
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()
      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

    } catch (error) {
      console.error('Error saving progress:', error)
      showNotification('error', 'Error', 'Error al guardar. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  // Función para formatear moneda de forma segura
  const formatCurrency = (value: number | string | undefined | null): string => {
    if (value === null || value === undefined || value === '') return '$0.00'

    const numValue = typeof value === 'string' ? parseFloat(value) : value

    if (isNaN(numValue)) return '$0.00'

    return `$${numValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`
  }

  // Función para cambiar el estado de la empresa (activar/desactivar)
  const handleToggleStatus = async (companyId: number, companyName: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const action = newStatus === 'inactive' ? 'desactivar' : 'activar'

    setConfirmDialog({
      isOpen: true,
      title: `${action === 'desactivar' ? 'Desactivar' : 'Activar'} Empresa`,
      message: `¿Estás seguro de ${action} la empresa "${companyName}"?`,
      type: newStatus === 'inactive' ? 'warning' : 'info',
      onConfirm: async () => {
        await executeToggleStatus(companyId, companyName, newStatus, action)
      }
    })
  }

  const executeToggleStatus = async (companyId: number, companyName: string, newStatus: string, action: string) => {

    try {
      setLoading(true)

      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await response.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || `Error al ${action} empresa`)
        return
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      showNotification('success', '¡Éxito!', `Empresa ${action === 'desactivar' ? 'desactivada' : 'activada'} exitosamente`)

    } catch (error) {
      console.error(`Error ${action} company:`, error)
      showNotification('error', 'Error', `Error al ${action} empresa. Por favor intenta de nuevo`)
    } finally {
      setLoading(false)
    }
  }

  // Función para eliminar permanentemente la empresa (solo si está inactiva)
  const handleDeleteCompany = async (companyId: number, companyName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '⚠️ Eliminar Empresa',
      message: `¿Estás seguro de eliminar PERMANENTEMENTE la empresa "${companyName}"?\n\nEsta acción NO se puede deshacer y eliminará todos los datos relacionados.`,
      type: 'danger',
      onConfirm: async () => {
        await executeDeleteCompany(companyId, companyName)
      }
    })
  }

  const executeDeleteCompany = async (companyId: number, companyName: string) => {

    try {
      setLoading(true)

      const response = await fetch(`/api/companies/${companyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      // Try to parse JSON response, but handle empty responses
      let data: any = {}
      try {
        const text = await response.text()
        if (text) {
          data = JSON.parse(text)
        }
      } catch (e) {
        console.log('No JSON response from DELETE')
      }

      if (!response.ok || !data.success) {
        showNotification('error', 'Error', data.error || 'Error al eliminar empresa')
        return
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      showNotification('success', '¡Éxito!', data.message || 'Empresa eliminada exitosamente')

    } catch (error) {
      console.error('Error deleting company:', error)
      showNotification('error', 'Error', 'Error al eliminar empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  const handleEditCompany = async (companyId: number) => {
    try {
      setLoading(true)

      // Obtener datos de la empresa y precios de productos en paralelo
      const [companyResponse, pricingResponse] = await Promise.all([
        fetch(`/api/companies/${companyId}`),
        fetch(`/api/companies/${companyId}/products/pricing`)
      ])

      const data = await companyResponse.json()
      const pricingData = await pricingResponse.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || 'Error al cargar empresa')
        return
      }

      const company = data.data

      // Cargar precios de productos si existen
      let productPrices: any[] = []
      if (pricingData.success && pricingData.data?.products) {
        productPrices = pricingData.data.products.map((p: any) => ({
          productId: p.productId,
          code: p.code,
          name: p.name,
          miCosto: p.miCosto,
          precioSucursales: p.precioSucursales,
          precioClientes: p.precioClientes,
          hasPricing: p.hasPricing
        }))
      }

      // Parsear horarios de entrega si existen (formato "08:00 - 18:00")
      let brokerDeliveryStart = '08:00'
      let brokerDeliveryEnd = '18:00'
      if (company.broker_delivery_hours) {
        const parts = company.broker_delivery_hours.split(' - ')
        if (parts.length === 2) {
          brokerDeliveryStart = parts[0].trim()
          brokerDeliveryEnd = parts[1].trim()
        }
      }

      // Cargar datos en el formulario
      setFormData({
        legalName: company.legalName || '',
        phone: company.phone || '',
        customerServicePhone: company.customerServicePhone || '',
        email: company.email || '',
        website: company.website || '',
        address: company.address || '',
        city: company.city || '',
        state: company.state || '',
        country: company.country || '',
        zipCode: company.zipCode || '',
        walletNumber: company.walletNumber || '',
        currency: company.currency || 'USD',
        isMultiCurrency: company.isMultiCurrency || false,
        secondaryCurrencies: company.secondaryCurrencies || [],
        hasLimits: company.hasLimits || false,
        dailyLimit: company.dailyLimit || '',
        monthlyLimit: company.monthlyLimit || '',
        rechargeLimits: { daily: '', monthly: '' },
        transferLimits: { daily: '', monthly: '' },
        enabledServices: Array.isArray(company.enabledServices) ? company.enabledServices : [],
        companyType: company.companyType || '',
        serviceFees: company.serviceFees || {},
        servicePrices: company.servicePrices || {},
        prices: {},
        einNumber: company.einNumber || '',
        documents: [],
        logoUrl: company.logoUrl || '',
        labelLogoUrl: company.labelLogoUrl || '',
        subdomain: company.subdomain || '',
        primaryColor: company.primaryColor || '#CC0A46',
        secondaryColor: company.secondaryColor || '#0A46CC',
        isProvider: company.isProvider || false,
        providerType: company.providerType || null,
        providerCategories: Array.isArray(company.providerCategories) ? company.providerCategories : [],
        providerServices: Array.isArray(company.providerServices) ? company.providerServices : [],
        productPrices: productPrices,
        // Campos de broker
        latitude: company.latitude || null,
        longitude: company.longitude || null,
        broker_province: company.broker_province || '',
        broker_municipality: company.broker_municipality || '',
        broker_address: company.broker_address || '',
        broker_delivery_start: brokerDeliveryStart,
        broker_delivery_end: brokerDeliveryEnd,
        broker_contact_phone: company.broker_contact_phone || '',
        broker_bank_accounts: Array.isArray(company.broker_bank_accounts) ? company.broker_bank_accounts : [],
        editMode: true,
        editId: companyId
      })

      // Abrir el formulario
      setShowCreateForm(true)
      setCurrentStep(1)

    } catch (error) {
      console.error('Error loading company:', error)
      showNotification('error', 'Error', 'Error al cargar empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCompany = async () => {
    try {
      setLoading(true)

      // Combinar horarios de entrega para brokers
      const dataToSend = {
        ...formData,
        broker_delivery_hours: formData.broker_delivery_start && formData.broker_delivery_end
          ? `${formData.broker_delivery_start} - ${formData.broker_delivery_end}`
          : null
      }

      const response = await fetch(`/api/companies/${formData.editId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend)
      })

      const data = await response.json()

      if (!data.success) {
        showNotification('error', 'Error', data.error || 'Error al actualizar empresa')
        return
      }

      // Save product prices if any were modified
      if (formData.productPrices && formData.productPrices.length > 0) {
        const pricesToSave = formData.productPrices.filter((p: any) =>
          p.precioSucursales !== undefined || p.precioClientes !== undefined
        )

        if (pricesToSave.length > 0) {
          const pricingResponse = await fetch(`/api/companies/${formData.editId}/products/pricing`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              products: pricesToSave,
              notes: 'Actualizado desde formulario de empresa'
            })
          })

          const pricingData = await pricingResponse.json()

          if (!pricingData.success) {
            console.warn('Error saving product prices:', pricingData.error)
            // Don't fail the whole operation, just warn
          }
        }
      }

      // Reload companies from API
      const companiesResponse = await fetch('/api/companies?includeBranches=true')
      const companiesData = await companiesResponse.json()

      if (companiesData.success) {
        setCompanies(companiesData.data)
      }

      setShowCreateForm(false)
      resetForm()
      showNotification('success', '¡Éxito!', 'Empresa actualizada exitosamente')

    } catch (error) {
      console.error('Error updating company:', error)
      showNotification('error', 'Error', 'Error al actualizar empresa. Por favor intenta de nuevo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      {showCreateForm ? (
        // Company Creation Form View
        <div className="max-w-6xl mx-auto p-6">
          {/* Form Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className={cn(
                  "text-3xl font-bold mb-2",
                  theme === 'dark' ? "text-white" : "text-black"
                )}>
                  {formData.editMode ? 'Editar Empresa' : 'Crear Nueva Empresa'}
                </h1>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {formData.editMode
                    ? 'Actualiza la información de la empresa'
                    : 'Completa el formulario para registrar una nueva empresa en el sistema'
                  }
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  resetForm()
                }}
                className={cn(
                  theme === 'dark' ? "border-gray-700 text-gray-300 hover:bg-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            </div>

            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {(formData.companyType === 'broker' ? BROKER_STEPS : STEPS).map((step, index) => {
                  const activeSteps = formData.companyType === 'broker' ? BROKER_STEPS : STEPS
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex items-center">
                        <motion.div
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                            currentStep === step.id
                              ? theme === 'dark' ? "bg-blue-600 text-white" : "bg-exa-primary text-white"
                              : currentStep > step.id
                                ? theme === 'dark' ? "bg-green-500 text-white" : "bg-green-500 text-white"
                                : theme === 'dark' ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-500"
                          )}
                          whileHover={{ scale: 1.1 }}
                        >
                          {currentStep > step.id ? (
                            <Check className="w-5 h-5" />
                          ) : (
                            <step.icon className="w-5 h-5" />
                          )}
                        </motion.div>
                        <div className="ml-3 hidden sm:block">
                          <p className={cn(
                            "text-xs font-medium",
                            currentStep === step.id
                              ? theme === 'dark' ? "text-white" : "text-black"
                              : theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>
                            {step.title}
                          </p>
                        </div>
                      </div>
                      {index < activeSteps.length - 1 && (
                        <div className={cn(
                          "flex-1 h-1 mx-4",
                          currentStep > step.id
                            ? theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                            : theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                        )} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    {formData.companyType === 'broker' ? 'Información del Broker' : 'Información Básica de la Empresa'}
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        {formData.companyType === 'broker' ? 'Nombre del Broker *' : 'Nombre Legal *'}
                      </label>
                      <input
                        type="text"
                        value={formData.legalName}
                        onChange={(e) => setFormData({...formData, legalName: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder={formData.companyType === 'broker' ? "Ej: Juan Pérez García" : "Ej: CubaExpress S.A."}
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        {formData.companyType === 'broker' ? 'Teléfono del Broker *' : 'Teléfono *'}
                      </label>
                      <input
                        type="tel"
                        value={formData.companyType === 'broker' ? formData.broker_contact_phone : formData.phone}
                        onChange={(e) => setFormData({
                          ...formData,
                          ...(formData.companyType === 'broker'
                            ? { broker_contact_phone: e.target.value, phone: e.target.value }
                            : { phone: e.target.value })
                        })}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder={formData.companyType === 'broker' ? "+53 52 123 4567" : "+53 7 832 4567"}
                      />
                    </div>

                    {/* Teléfono de Soporte - Solo para NO brokers */}
                    {formData.companyType !== 'broker' && (
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Teléfono de Soporte
                        </label>
                        <input
                          type="tel"
                          value={formData.customerServicePhone}
                          onChange={(e) => setFormData({...formData, customerServicePhone: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                            theme === 'dark'
                              ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                          )}
                          placeholder="+53 7 800 0000"
                        />
                        <p className={cn(
                          "mt-1 text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Número de contacto para soporte al cliente (opcional)
                        </p>
                      </div>
                    )}

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Email {formData.companyType !== 'broker' ? '*' : ''}
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder="contacto@empresa.com"
                      />
                    </div>

                    {/* Website - Solo para NO brokers */}
                    {formData.companyType !== 'broker' && (
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Website
                        </label>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => setFormData({...formData, website: e.target.value})}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                            theme === 'dark'
                              ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                              : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                          )}
                          placeholder="https://empresa.com"
                        />
                        <p className={cn(
                          "mt-1 text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          Se mostrará en las etiquetas y comunicación al cliente.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        {formData.companyType === 'broker' ? 'Carnet de Identidad *' : 'EIN / Número de Identificación *'}
                      </label>
                      <input
                        type="text"
                        value={formData.einNumber}
                        onChange={(e) => setFormData({...formData, einNumber: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                        placeholder={formData.companyType === 'broker' ? "85010112345" : "CU-12345678"}
                      />
                    </div>

                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-2",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Tipo de Empresa *
                      </label>
                      <select
                        value={formData.companyType}
                        onChange={(e) => setFormData({...formData, companyType: e.target.value})}
                        className={cn(
                          "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                          theme === 'dark'
                            ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                            : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                        )}
                      >
                        <option value="">Seleccionar tipo</option>
                        {COMPANY_TYPES.map(type => (
                          <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Dirección - Condicional según tipo de empresa */}
                    {formData.companyType === 'broker' ? (
                      /* Dirección para Brokers - Campos manuales */
                      <>
                        <div className="md:col-span-2">
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Dirección del Broker *
                          </label>
                          <input
                            type="text"
                            value={formData.broker_address}
                            onChange={(e) => setFormData({...formData, broker_address: e.target.value})}
                            className={cn(
                              "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                              theme === 'dark'
                                ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                            )}
                            placeholder="Ej: Calle 23 #456 entre L y M, Vedado"
                          />
                        </div>

                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Provincia *
                          </label>
                          <select
                            value={formData.broker_province}
                            onChange={(e) => {
                              const province = BROKER_PROVINCES.find(p => p.id === e.target.value)
                              setFormData({
                                ...formData,
                                broker_province: e.target.value,
                                broker_municipality: '',
                                // Centrar mapa en la provincia seleccionada
                                latitude: province?.coords[1] || null,
                                longitude: province?.coords[0] || null
                              })
                            }}
                            className={cn(
                              "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                              theme === 'dark'
                                ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                            )}
                          >
                            <option value="">Seleccionar provincia</option>
                            {BROKER_PROVINCES.map(province => (
                              <option key={province.id} value={province.id}>{province.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Municipio *
                          </label>
                          <select
                            value={formData.broker_municipality}
                            onChange={(e) => {
                              const province = BROKER_PROVINCES.find(p => p.id === formData.broker_province)
                              const municipality = province?.municipalities.find(m => m.id === e.target.value)
                              setFormData({
                                ...formData,
                                broker_municipality: e.target.value,
                                // Actualizar coordenadas con las del municipio
                                latitude: municipality?.coords?.[1] || formData.latitude,
                                longitude: municipality?.coords?.[0] || formData.longitude
                              })
                            }}
                            disabled={!formData.broker_province}
                            className={cn(
                              "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                              theme === 'dark'
                                ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20 disabled:opacity-50"
                                : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20 disabled:opacity-50"
                            )}
                          >
                            <option value="">Seleccionar municipio</option>
                            {formData.broker_province &&
                              BROKER_PROVINCES.find(p => p.id === formData.broker_province)?.municipalities.map(muni => (
                                <option key={muni.id} value={muni.id}>{muni.name}</option>
                              ))
                            }
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Horario de Entrega
                          </label>
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className={cn(
                                "block text-xs mb-1",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Desde
                              </label>
                              <input
                                type="time"
                                value={formData.broker_delivery_start}
                                onChange={(e) => setFormData({...formData, broker_delivery_start: e.target.value})}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                              />
                            </div>
                            <span className={cn(
                              "text-lg font-medium mt-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-500"
                            )}>
                              -
                            </span>
                            <div className="flex-1">
                              <label className={cn(
                                "block text-xs mb-1",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Hasta
                              </label>
                              <input
                                type="time"
                                value={formData.broker_delivery_end}
                                onChange={(e) => setFormData({...formData, broker_delivery_end: e.target.value})}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Teléfono de Contacto Broker
                          </label>
                          <input
                            type="tel"
                            value={formData.broker_contact_phone}
                            onChange={(e) => setFormData({...formData, broker_contact_phone: e.target.value})}
                            className={cn(
                              "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                              theme === 'dark'
                                ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                            )}
                            placeholder="+53 5 XXX XXXX"
                          />
                        </div>

                        {/* Mapa para seleccionar ubicación con pin */}
                        {formData.broker_province && formData.broker_municipality && (
                          <div className="md:col-span-2">
                            <label className={cn(
                              "block text-sm font-medium mb-2",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Ubicación en el Mapa - Haz clic para colocar el pin
                            </label>
                            <BrokerMapPicker
                              theme={theme}
                              province={formData.broker_province}
                              municipality={formData.broker_municipality}
                              latitude={formData.latitude}
                              longitude={formData.longitude}
                              onLocationChange={(lat: number, lng: number) => {
                                setFormData({
                                  ...formData,
                                  latitude: lat,
                                  longitude: lng
                                })
                              }}
                            />
                            {formData.latitude && formData.longitude && (
                              <p className={cn(
                                "mt-2 text-xs",
                                theme === 'dark' ? "text-green-400" : "text-green-600"
                              )}>
                                Coordenadas: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      /* Dirección con Mapbox Autofill para otros tipos */
                      <div className="md:col-span-2">
                        <MapboxAddressAutofill
                          value={{
                            street: formData.address || '',
                            apartment: '',
                            city: formData.city || '',
                            state: formData.state || '',
                            zipCode: formData.zipCode || '',
                            country: formData.country || ''
                          }}
                          onChange={(addressData) => {
                            setFormData({
                              ...formData,
                              address: addressData.street,
                              city: addressData.city,
                              state: addressData.state,
                              zipCode: addressData.zipCode,
                              country: addressData.country
                            })
                          }}
                          onCoordinatesChange={(coordinates) => {
                            if (coordinates) {
                              setFormData({
                                ...formData,
                                latitude: coordinates.latitude,
                                longitude: coordinates.longitude
                              })
                            }
                          }}
                          required={true}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Wallet Configuration */}
              {currentStep === 2 && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Configuración de Wallet
                  </h2>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Wallet Card Preview */}
                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Vista Previa de Wallet
                      </h3>
                      <WalletCard
                        walletNumber={formData.walletNumber || '2026123456789012'}
                        companyName={formData.legalName || 'Nombre de Empresa'}
                        primaryCurrency={formData.currency || 'USD'}
                        secondaryCurrencies={formData.secondaryCurrencies}
                        balance={0}
                        showBalance={true}
                        setShowBalance={() => {}}
                        isMultiCurrency={formData.isMultiCurrency}
                        hasLimits={formData.hasLimits}
                        dailyLimit={formData.dailyLimit || '0'}
                        monthlyLimit={formData.monthlyLimit || '0'}
                      />
                    </div>

                    {/* Wallet Configuration */}
                    <div className="space-y-6">
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Moneda Principal
                        </label>
                        <div className={cn(
                          "p-4 rounded-xl border",
                          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                        )}>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-12 h-12 rounded-lg flex items-center justify-center",
                              theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                            )}>
                              <DollarSign className={cn(
                                "w-6 h-6",
                                theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                              )} />
                            </div>
                            <div>
                              <p className={cn(
                                "font-bold text-lg",
                                theme === 'dark' ? "text-white" : "text-black"
                              )}>
                                {formData.currency || 'USD'}
                              </p>
                              <p className={cn(
                                "text-sm",
                                theme === 'dark' ? "text-gray-400" : "text-gray-600"
                              )}>
                                Basada en el país: {formData.country || 'No seleccionado'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Multi-moneda
                          </label>
                          <button
                            onClick={() => setFormData({...formData, isMultiCurrency: !formData.isMultiCurrency})}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                              formData.isMultiCurrency ? (theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary") : "bg-gray-300"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              formData.isMultiCurrency ? "translate-x-6" : "translate-x-1"
                            )} />
                          </button>
                        </div>

                        {formData.isMultiCurrency && (
                          <div className="space-y-3">
                            <p className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Monedas Secundarias
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {WALLET_CURRENCIES.filter(curr => curr.code !== formData.currency).map(currency => (
                                <button
                                  key={currency.code}
                                  onClick={() => {
                                    const newCurrencies = formData.secondaryCurrencies.includes(currency.code)
                                      ? formData.secondaryCurrencies.filter((c: string) => c !== currency.code)
                                      : [...formData.secondaryCurrencies, currency.code]
                                    setFormData({...formData, secondaryCurrencies: newCurrencies})
                                  }}
                                  className={cn(
                                    "p-3 rounded-xl border transition-all duration-300",
                                    formData.secondaryCurrencies.includes(currency.code)
                                      ? theme === 'dark' ? "border-exa-secondary bg-exa-secondary/20" : "border-exa-primary bg-exa-primary/10"
                                      : theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{currency.flag}</span>
                                    <div className="text-left">
                                      <p className={cn(
                                        "font-medium text-sm",
                                        theme === 'dark' ? "text-white" : "text-black"
                                      )}>
                                        {currency.code}
                                      </p>
                                      <p className={cn(
                                        "text-xs",
                                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                      )}>
                                        {currency.name}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className={cn(
                            "text-sm font-medium",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Configurar Límites
                          </label>
                          <button
                            onClick={() => setFormData({...formData, hasLimits: !formData.hasLimits})}
                            className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                              formData.hasLimits ? (theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary") : "bg-gray-300"
                            )}
                          >
                            <span className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              formData.hasLimits ? "translate-x-6" : "translate-x-1"
                            )} />
                          </button>
                        </div>

                        {formData.hasLimits && (
                          <div className="space-y-4">
                            <div>
                              <label className={cn(
                                "block text-sm font-medium mb-2",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Límite Diario
                              </label>
                              <input
                                type="text"
                                value={formData.dailyLimit}
                                onChange={(e) => setFormData({...formData, dailyLimit: e.target.value})}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="1000"
                              />
                            </div>
                            <div>
                              <label className={cn(
                                "block text-sm font-medium mb-2",
                                theme === 'dark' ? "text-gray-300" : "text-gray-700"
                              )}>
                                Límite Mensual
                              </label>
                              <input
                                type="text"
                                value={formData.monthlyLimit}
                                onChange={(e) => setFormData({...formData, monthlyLimit: e.target.value})}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="10000"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Cuentas Bancarias - Solo para Brokers */}
                  {formData.companyType === 'broker' && (
                    <div className="mt-8">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className={cn(
                            "text-lg font-semibold",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            Cuentas Bancarias del Broker
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            Registra las cuentas bancarias para recibir pagos
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            const newAccount = {
                              id: Date.now().toString(),
                              bankName: '',
                              accountNumber: '',
                              currency: 'USD'
                            }
                            setFormData({
                              ...formData,
                              broker_bank_accounts: [...(formData.broker_bank_accounts || []), newAccount]
                            })
                          }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-300",
                            theme === 'dark'
                              ? "bg-exa-secondary text-white hover:bg-exa-secondary/80"
                              : "bg-exa-primary text-white hover:bg-exa-primary/80"
                          )}
                        >
                          <Plus className="w-4 h-4" />
                          Agregar Cuenta
                        </button>
                      </div>

                      {(!formData.broker_bank_accounts || formData.broker_bank_accounts.length === 0) ? (
                        <div className={cn(
                          "text-center py-8 rounded-xl border-2 border-dashed",
                          theme === 'dark' ? "border-gray-700" : "border-gray-300"
                        )}>
                          <CreditCard className={cn(
                            "w-12 h-12 mx-auto mb-3",
                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                          )} />
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            No hay cuentas bancarias registradas
                          </p>
                          <p className={cn(
                            "text-xs mt-1",
                            theme === 'dark' ? "text-gray-500" : "text-gray-500"
                          )}>
                            Haz clic en "Agregar Cuenta" para registrar una cuenta bancaria
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {formData.broker_bank_accounts.map((account: { id: string; bankName: string; accountNumber: string; currency: string }, index: number) => (
                            <div
                              key={account.id}
                              className={cn(
                                "p-4 rounded-xl border",
                                theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                              )}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    theme === 'dark' ? "bg-blue-500/20" : "bg-blue-100"
                                  )}>
                                    <CreditCard className={cn(
                                      "w-4 h-4",
                                      theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                    )} />
                                  </div>
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? "text-white" : "text-gray-900"
                                  )}>
                                    Cuenta #{index + 1}
                                  </span>
                                </div>
                                <button
                                  onClick={() => {
                                    const updatedAccounts = formData.broker_bank_accounts.filter(
                                      (acc: { id: string }) => acc.id !== account.id
                                    )
                                    setFormData({
                                      ...formData,
                                      broker_bank_accounts: updatedAccounts
                                    })
                                  }}
                                  className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    theme === 'dark'
                                      ? "text-red-400 hover:bg-red-500/20"
                                      : "text-red-500 hover:bg-red-50"
                                  )}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Nombre del Banco */}
                                <div>
                                  <label className={cn(
                                    "block text-sm font-medium mb-2",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    Nombre del Banco
                                  </label>
                                  <input
                                    type="text"
                                    value={account.bankName}
                                    onChange={(e) => {
                                      const updatedAccounts = formData.broker_bank_accounts.map(
                                        (acc: { id: string; bankName: string; accountNumber: string; currency: string }) =>
                                          acc.id === account.id ? { ...acc, bankName: e.target.value } : acc
                                      )
                                      setFormData({
                                        ...formData,
                                        broker_bank_accounts: updatedAccounts
                                      })
                                    }}
                                    className={cn(
                                      "w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                      theme === 'dark'
                                        ? "bg-gray-700/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                        : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                    )}
                                    placeholder="Ej: Banco de Cuba"
                                  />
                                </div>

                                {/* Número de Cuenta */}
                                <div>
                                  <label className={cn(
                                    "block text-sm font-medium mb-2",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    Número de Cuenta/Tarjeta
                                  </label>
                                  <input
                                    type="text"
                                    value={account.accountNumber}
                                    onChange={(e) => {
                                      const updatedAccounts = formData.broker_bank_accounts.map(
                                        (acc: { id: string; bankName: string; accountNumber: string; currency: string }) =>
                                          acc.id === account.id ? { ...acc, accountNumber: e.target.value } : acc
                                      )
                                      setFormData({
                                        ...formData,
                                        broker_bank_accounts: updatedAccounts
                                      })
                                    }}
                                    className={cn(
                                      "w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                      theme === 'dark'
                                        ? "bg-gray-700/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                        : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                    )}
                                    placeholder="Ej: 9204 **** **** 1234"
                                  />
                                </div>

                                {/* Moneda */}
                                <div>
                                  <label className={cn(
                                    "block text-sm font-medium mb-2",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    Moneda
                                  </label>
                                  <select
                                    value={account.currency}
                                    onChange={(e) => {
                                      const updatedAccounts = formData.broker_bank_accounts.map(
                                        (acc: { id: string; bankName: string; accountNumber: string; currency: string }) =>
                                          acc.id === account.id ? { ...acc, currency: e.target.value } : acc
                                      )
                                      setFormData({
                                        ...formData,
                                        broker_bank_accounts: updatedAccounts
                                      })
                                    }}
                                    className={cn(
                                      "w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                      theme === 'dark'
                                        ? "bg-gray-700/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                        : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                    )}
                                  >
                                    <option value="USD">USD - Dólar Estadounidense</option>
                                    <option value="CUP">CUP - Peso Cubano</option>
                                    <option value="MLC">MLC - Moneda Libremente Convertible</option>
                                    <option value="EUR">EUR - Euro</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Services - Solo para NO brokers */}
              {currentStep === 3 && formData.companyType !== 'broker' && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-2",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Servicios Activados
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SERVICES.map(service => {
                      const isServiceEnabled = formData.enabledServices.some((s: string) =>
                        s === service.id || s.startsWith(`${service.id}:`)
                      )
                      const hasSubmodules = (service as any).hasSubmodules
                      const submodules = (service as any).submodules || []

                      // Contar submódulos seleccionados
                      const selectedSubmodules = hasSubmodules
                        ? formData.enabledServices.filter((s: string) => s.startsWith(`${service.id}:`))
                        : []

                      return (
                        <div key={service.id} className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (hasSubmodules) {
                                // Para servicios con submódulos, seleccionar/deseleccionar todos
                                const allSubmoduleIds = submodules.map((sub: any) => sub.id)
                                const hasAnySubmodule = formData.enabledServices.some((s: string) =>
                                  allSubmoduleIds.includes(s)
                                )

                                if (hasAnySubmodule) {
                                  // Deseleccionar todos los submódulos
                                  const newServices = formData.enabledServices.filter((s: string) =>
                                    !s.startsWith(`${service.id}:`)
                                  )
                                  setFormData({...formData, enabledServices: newServices})
                                } else {
                                  // Seleccionar todos los submódulos
                                  const newServices = [
                                    ...formData.enabledServices.filter((s: string) => !s.startsWith(`${service.id}:`)),
                                    ...allSubmoduleIds
                                  ]
                                  setFormData({...formData, enabledServices: newServices})
                                }
                              } else {
                                // Para servicios sin submódulos, toggle normal
                                const newServices = formData.enabledServices.includes(service.id)
                                  ? formData.enabledServices.filter((s: string) => s !== service.id)
                                  : [...formData.enabledServices, service.id]
                                setFormData({...formData, enabledServices: newServices})
                              }
                            }}
                            className={cn(
                              "w-full p-6 rounded-xl border transition-all duration-300 text-left",
                              isServiceEnabled
                                ? theme === 'dark' ? "border-exa-secondary bg-exa-secondary/20" : "border-exa-primary bg-exa-primary/20"
                                : theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"
                            )}
                          >
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center",
                                isServiceEnabled
                                  ? theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary"
                                  : theme === 'dark' ? "bg-gray-700" : "bg-gray-200"
                              )}>
                                <Settings className={cn(
                                  "w-6 h-6",
                                  isServiceEnabled ? "text-white" : theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )} />
                              </div>
                              <div className="flex-1">
                                <h3 className={cn(
                                  "font-bold text-lg mb-1",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {service.name}
                                  {hasSubmodules && selectedSubmodules.length > 0 && (
                                    <span className={cn(
                                      "ml-2 text-sm font-normal",
                                      theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                    )}>
                                      ({selectedSubmodules.length}/{submodules.length} módulos)
                                    </span>
                                  )}
                                </h3>
                                <p className={cn(
                                  "text-sm",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {service.description}
                                </p>
                              </div>
                              {isServiceEnabled && (
                                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme === 'dark' ? "bg-exa-secondary" : "bg-exa-primary")}>
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          </button>

                          {/* Submódulos de paquetería */}
                          {hasSubmodules && isServiceEnabled && (
                            <div className={cn(
                              "ml-4 p-4 rounded-lg border space-y-2",
                              theme === 'dark' ? "bg-gray-800/30 border-gray-700" : "bg-gray-50 border-gray-200"
                            )}>
                              <p className={cn(
                                "text-xs font-medium mb-3",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Selecciona los módulos específicos:
                              </p>
                              <div className="grid grid-cols-1 gap-2">
                                {submodules.map((submodule: any) => {
                                  const isSubmoduleEnabled = formData.enabledServices.includes(submodule.id)
                                  return (
                                    <button
                                      key={submodule.id}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const newServices = isSubmoduleEnabled
                                          ? formData.enabledServices.filter((s: string) => s !== submodule.id)
                                          : [...formData.enabledServices, submodule.id]
                                        setFormData({...formData, enabledServices: newServices})
                                      }}
                                      className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                        isSubmoduleEnabled
                                          ? theme === 'dark'
                                            ? "border-exa-secondary/50 bg-exa-secondary/10"
                                            : "border-exa-primary/50 bg-exa-primary/10"
                                          : theme === 'dark'
                                            ? "border-gray-600 bg-gray-700/30 hover:bg-gray-700/50"
                                            : "border-gray-300 bg-white hover:bg-gray-100"
                                      )}
                                    >
                                      <div className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                        isSubmoduleEnabled
                                          ? theme === 'dark'
                                            ? "bg-exa-secondary border-exa-secondary"
                                            : "bg-exa-primary border-exa-primary"
                                          : theme === 'dark'
                                            ? "border-gray-500"
                                            : "border-gray-400"
                                      )}>
                                        {isSubmoduleEnabled && <Check className="w-3 h-3 text-white" />}
                                      </div>
                                      <div className="flex-1 text-left">
                                        <span className={cn(
                                          "text-sm font-medium",
                                          theme === 'dark' ? "text-white" : "text-gray-900"
                                        )}>
                                          {submodule.name}
                                        </span>
                                        <p className={cn(
                                          "text-xs",
                                          theme === 'dark' ? "text-gray-500" : "text-gray-500"
                                        )}>
                                          {submodule.description}
                                        </p>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Platform Fees - Solo para NO brokers */}
              {currentStep === 4 && formData.companyType !== 'broker' && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Fee de Plataforma
                  </h2>
                  <p className={cn(
                    "text-sm mb-6",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Configura las comisiones que se cobrarán por cada transacción de servicio
                  </p>

                  <div className="space-y-6">
                    {formData.enabledServices.map((serviceId: string) => {
                      const service = SERVICES.find(s => s.id === serviceId)
                      if (!service) return null

                      // Inicializar fee si no existe
                      if (!formData.serviceFees[serviceId]) {
                        formData.serviceFees[serviceId] = {
                          type: 'none',
                          percentage: 0,
                          fixed: 0
                        }
                      }

                      const fee = formData.serviceFees[serviceId]
                      const exampleAmount = 100 // Monto de ejemplo para el preview

                      // Calcular fee total para preview
                      const calculateFee = () => {
                        let total = 0
                        if (fee.type === 'percentage' || fee.type === 'both') {
                          total += (exampleAmount * (fee.percentage || 0)) / 100
                        }
                        if (fee.type === 'fixed' || fee.type === 'both') {
                          total += fee.fixed || 0
                        }
                        return total.toFixed(2)
                      }

                      return (
                        <div
                          key={serviceId}
                          className={cn(
                            "p-6 rounded-xl border",
                            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                          )}
                        >
                          {/* Service Header */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                              )}>
                                <Settings className={cn(
                                  "w-5 h-5",
                                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                )} />
                              </div>
                              <div>
                                <h3 className={cn(
                                  "font-semibold",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {service.name}
                                </h3>
                                <p className={cn(
                                  "text-xs",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  {service.description}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Fee Type Selector */}
                          <div className="mb-4">
                            <label className={cn(
                              "block text-sm font-medium mb-3",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Tipo de Fee
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                              {[
                                { value: 'none', label: 'Sin Fee', icon: 'X' },
                                { value: 'percentage', label: 'Porcentaje (%)', icon: '%' },
                                { value: 'fixed', label: 'Monto Fijo ($)', icon: '$' },
                                { value: 'both', label: 'Ambos', icon: '$%' },
                              ].map((option) => (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => {
                                    setFormData({
                                      ...formData,
                                      serviceFees: {
                                        ...formData.serviceFees,
                                        [serviceId]: { ...fee, type: option.value }
                                      }
                                    })
                                  }}
                                  className={cn(
                                    "px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-300",
                                    fee.type === option.value
                                      ? theme === 'dark'
                                        ? "border-exa-secondary bg-exa-secondary/20 text-exa-secondary"
                                        : "border-exa-primary bg-exa-primary/20 text-exa-primary"
                                      : theme === 'dark'
                                        ? "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600"
                                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                                  )}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Fee Inputs */}
                          {fee.type !== 'none' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              {/* Percentage Input */}
                              {(fee.type === 'percentage' || fee.type === 'both') && (
                                <div>
                                  <label className={cn(
                                    "block text-sm font-medium mb-2",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    Porcentaje (%)
                                  </label>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={fee.percentage || 0}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          serviceFees: {
                                            ...formData.serviceFees,
                                            [serviceId]: {
                                              ...fee,
                                              percentage: parseFloat(e.target.value) || 0
                                            }
                                          }
                                        })
                                      }}
                                      className={cn(
                                        "w-full px-4 py-3 pr-10 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                        theme === 'dark'
                                          ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                          : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                      )}
                                      placeholder="2.5"
                                    />
                                    <span className={cn(
                                      "absolute right-4 top-1/2 transform -translate-y-1/2 text-sm font-medium",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                    )}>
                                      %
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Fixed Amount Input */}
                              {(fee.type === 'fixed' || fee.type === 'both') && (
                                <div>
                                  <label className={cn(
                                    "block text-sm font-medium mb-2",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    Monto Fijo ($)
                                  </label>
                                  <div className="relative">
                                    <DollarSign className={cn(
                                      "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                    )} />
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={fee.fixed || 0}
                                      onChange={(e) => {
                                        setFormData({
                                          ...formData,
                                          serviceFees: {
                                            ...formData.serviceFees,
                                            [serviceId]: {
                                              ...fee,
                                              fixed: parseFloat(e.target.value) || 0
                                            }
                                          }
                                        })
                                      }}
                                      className={cn(
                                        "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                                        theme === 'dark'
                                          ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                          : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                      )}
                                      placeholder="1.50"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Fee Preview */}
                          {fee.type !== 'none' && (
                            <div className={cn(
                              "p-4 rounded-lg border",
                              theme === 'dark' ? "bg-gray-900/50 border-gray-600" : "bg-blue-50 border-blue-200"
                            )}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className={cn(
                                    "text-xs font-medium mb-1",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    Ejemplo: Transacción de ${exampleAmount.toFixed(2)}
                                  </p>
                                  <p className={cn(
                                    "text-sm",
                                    theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                  )}>
                                    {fee.type === 'percentage' && `${fee.percentage}% = $${calculateFee()}`}
                                    {fee.type === 'fixed' && `Fijo = $${calculateFee()}`}
                                    {fee.type === 'both' && `${fee.percentage}% + $${fee.fixed} = $${calculateFee()}`}
                                  </p>
                                </div>
                                <div className={cn(
                                  "px-4 py-2 rounded-lg",
                                  theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                                )}>
                                  <p className={cn(
                                    "text-xs font-medium",
                                    theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                  )}>
                                    Fee Total
                                  </p>
                                  <p className={cn(
                                    "text-lg font-bold",
                                    theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                  )}>
                                    ${calculateFee()}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {formData.enabledServices.length === 0 && (
                      <div className="text-center py-12">
                        <Settings className={cn(
                          "w-16 h-16 mx-auto mb-4",
                          theme === 'dark' ? "text-gray-600" : "text-gray-400"
                        )} />
                        <p className={cn(
                          "text-sm",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          No hay servicios activados. Vuelve al paso anterior para seleccionar servicios.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Branding - Solo para NO brokers */}
              {currentStep === 5 && formData.companyType !== 'broker' && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Branding de la Empresa
                  </h2>
                  <p className={cn(
                    "text-sm mb-6",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Configure la identidad visual de la empresa para personalizar su dashboard
                  </p>

                  <div className="space-y-8">
                    {/* Logo Upload */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Logo de la Empresa (Color)
                      </label>
                      <LogoUpload
                        value={formData.logoUrl}
                        onChange={(url) => setFormData({...formData, logoUrl: url})}
                        label="Logo de la empresa"
                      />
                      <p className={cn(
                        "mt-2 text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Logo a color para la aplicación y sitio web. Formatos: PNG, JPG, SVG, WEBP (máx. 5MB)
                      </p>
                    </div>

                    {/* Label Logo Upload */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Logo de Etiqueta (Blanco y Negro)
                      </label>
                      <LogoUpload
                        value={formData.labelLogoUrl}
                        onChange={(url) => setFormData({...formData, labelLogoUrl: url})}
                        uploadEndpoint="/api/upload/label-logo"
                        label="Logo de etiqueta"
                      />
                      <p className={cn(
                        "mt-2 text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Logo en blanco y negro para etiquetas de envío e impresión. Formatos: PNG, JPG, SVG, WEBP (máx. 5MB)
                      </p>
                    </div>

                    {/* Color Pickers */}
                    <div>
                      <h3 className={cn(
                        "text-sm font-medium mb-4",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Colores de Marca
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Primary Color */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-3",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Color Primario
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="color"
                              value={formData.primaryColor}
                              onChange={(e) => setFormData({...formData, primaryColor: e.target.value})}
                              className="w-16 h-16 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                            />
                            <div className="flex-1">
                              <input
                                type="text"
                                value={formData.primaryColor}
                                onChange={(e) => {
                                  const hex = e.target.value
                                  if (/^#[0-9A-F]{6}$/i.test(hex) || hex === '') {
                                    setFormData({...formData, primaryColor: hex})
                                  }
                                }}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300 font-mono",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="#CC0A46"
                              />
                              <p className={cn(
                                "mt-1 text-xs",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Usado en botones principales y acentos
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Secondary Color */}
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-3",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Color Secundario
                          </label>
                          <div className="flex items-center gap-4">
                            <input
                              type="color"
                              value={formData.secondaryColor}
                              onChange={(e) => setFormData({...formData, secondaryColor: e.target.value})}
                              className="w-16 h-16 rounded-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600"
                            />
                            <div className="flex-1">
                              <input
                                type="text"
                                value={formData.secondaryColor}
                                onChange={(e) => {
                                  const hex = e.target.value
                                  if (/^#[0-9A-F]{6}$/i.test(hex) || hex === '') {
                                    setFormData({...formData, secondaryColor: hex})
                                  }
                                }}
                                className={cn(
                                  "w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300 font-mono",
                                  theme === 'dark'
                                    ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                    : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                                )}
                                placeholder="#0A46CC"
                              />
                              <p className={cn(
                                "mt-1 text-xs",
                                theme === 'dark' ? "text-gray-400" : "text-gray-500"
                              )}>
                                Usado en elementos secundarios y highlights
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Preview */}
                    <div className={cn(
                      "p-6 rounded-xl border",
                      theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                    )}>
                      <h3 className={cn(
                        "text-sm font-medium mb-4",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Vista Previa de Colores
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        {/* Primary Preview */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            style={{ backgroundColor: formData.primaryColor }}
                            className="w-full px-4 py-3 rounded-lg text-white font-medium transition-transform hover:scale-105"
                          >
                            Botón Primario
                          </button>
                          <div
                            style={{ backgroundColor: formData.primaryColor + '20', borderColor: formData.primaryColor }}
                            className="p-3 rounded-lg border-2 text-center"
                          >
                            <span style={{ color: formData.primaryColor }} className="text-sm font-medium">
                              Badge Primario
                            </span>
                          </div>
                        </div>

                        {/* Secondary Preview */}
                        <div className="space-y-2">
                          <button
                            type="button"
                            style={{ backgroundColor: formData.secondaryColor }}
                            className="w-full px-4 py-3 rounded-lg text-white font-medium transition-transform hover:scale-105"
                          >
                            Botón Secundario
                          </button>
                          <div
                            style={{ backgroundColor: formData.secondaryColor + '20', borderColor: formData.secondaryColor }}
                            className="p-3 rounded-lg border-2 text-center"
                          >
                            <span style={{ color: formData.secondaryColor }} className="text-sm font-medium">
                              Badge Secundario
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Subdomain Configuration */}
                    <div>
                      <h3 className={cn(
                        "text-sm font-medium mb-4",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Subdominio Personalizado
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            Subdominio
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={formData.subdomain}
                              onChange={(e) => {
                                // Solo permitir alfanuméricos y guiones, convertir a minúsculas
                                const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                                setFormData({...formData, subdomain: value})
                              }}
                              className={cn(
                                "flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300 font-mono",
                                theme === 'dark'
                                  ? "bg-gray-800/50 border-gray-700 text-white focus:border-blue-500 focus:ring-blue-500/20"
                                  : "bg-white border-gray-300 text-black focus:border-blue-500 focus:ring-blue-500/20"
                              )}
                              placeholder="mi-empresa"
                            />
                            <span className={cn(
                              "text-sm font-medium whitespace-nowrap",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              .logirapid.com
                            </span>
                          </div>
                          <p className={cn(
                            "mt-2 text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>
                            Solo letras minúsculas, números y guiones. Ejemplo: acme-logistics
                          </p>
                        </div>

                        {/* Subdomain Preview */}
                        {formData.subdomain && (
                          <div className={cn(
                            "p-4 rounded-lg border",
                            theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                          )}>
                            <div className="flex items-center gap-3">
                              <Globe className={cn(
                                "w-5 h-5",
                                theme === 'dark' ? "text-blue-400" : "text-blue-500"
                              )} />
                              <div className="flex-1">
                                <p className={cn(
                                  "text-xs font-medium mb-1",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  URL de Dashboard Personalizado
                                </p>
                                <p className={cn(
                                  "text-sm font-mono font-medium",
                                  theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                )}>
                                  https://{formData.subdomain}.logirapid.com
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info Box */}
                    <div className={cn(
                      "p-4 rounded-lg border-l-4",
                      theme === 'dark'
                        ? "bg-blue-900/20 border-blue-500"
                        : "bg-blue-50 border-blue-500"
                    )}>
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1">
                          <p className={cn(
                            "text-sm font-medium mb-1",
                            theme === 'dark' ? "text-blue-300" : "text-blue-900"
                          )}>
                            Personalización Completa
                          </p>
                          <p className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-blue-200/70" : "text-blue-800/70"
                          )}>
                            El logo, colores y subdominio se aplicarán automáticamente cuando los usuarios de esta empresa inicien sesión, creando una experiencia completamente personalizada con su marca.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 6/3: Documents (Paso 6 para otros, Paso 3 para brokers) */}
              {((currentStep === 6 && formData.companyType !== 'broker') || (currentStep === 3 && formData.companyType === 'broker')) && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Documentos de la Empresa
                  </h2>
                  <p className={cn(
                    "text-sm mb-6",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    Sube documentos legales y oficiales de la empresa. Estos archivos se almacenarán de forma segura y privada.
                  </p>

                  <div className="space-y-6">
                    {/* Document Upload Area */}
                    <div>
                      <label className={cn(
                        "block text-sm font-medium mb-3",
                        theme === 'dark' ? "text-gray-300" : "text-gray-700"
                      )}>
                        Subir Documentos
                      </label>

                      <div className={cn(
                        "border-2 border-dashed rounded-lg p-8 transition-colors text-center",
                        theme === 'dark'
                          ? "border-gray-600 hover:border-gray-500"
                          : "border-gray-300 hover:border-gray-400"
                      )}>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            if (e.target.files) {
                              const newFiles = Array.from(e.target.files)
                              setFormData({
                                ...formData,
                                documents: [...(formData.documents || []), ...newFiles]
                              })
                            }
                          }}
                          className="hidden"
                          id="document-upload"
                        />

                        <div className="flex flex-col items-center">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            <label
                              htmlFor="document-upload"
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline cursor-pointer"
                            >
                              Haz clic para subir
                            </label>
                            {' '}o arrastra los documentos aquí
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            PDF, DOC, DOCX, JPG, PNG (máx. 5GB por archivo)
                          </p>
                        </div>
                      </div>

                      <p className={cn(
                        "mt-2 text-xs",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        Documentos sugeridos: EIN, Licencia de negocio, Certificado de incorporación, Contratos, etc.
                      </p>
                    </div>

                    {/* Uploaded Documents List */}
                    {formData.documents && formData.documents.length > 0 && (
                      <div>
                        <h3 className={cn(
                          "text-sm font-medium mb-3",
                          theme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>
                          Documentos Seleccionados ({formData.documents.length})
                        </h3>
                        <div className="space-y-2">
                          {formData.documents.map((doc: File, index: number) => (
                            <div
                              key={index}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border",
                                theme === 'dark'
                                  ? "bg-gray-800/50 border-gray-700"
                                  : "bg-gray-50 border-gray-200"
                              )}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={cn(
                                  "w-10 h-10 rounded-lg flex items-center justify-center",
                                  theme === 'dark' ? "bg-blue-900/20" : "bg-blue-100"
                                )}>
                                  <FileText className="w-5 h-5 text-blue-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={cn(
                                    "text-sm font-medium truncate",
                                    theme === 'dark' ? "text-white" : "text-black"
                                  )}>
                                    {doc.name}
                                  </p>
                                  <p className={cn(
                                    "text-xs",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                  )}>
                                    {(doc.size / 1024 / 1024).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const newDocs = formData.documents.filter((_: any, i: number) => i !== index)
                                  setFormData({...formData, documents: newDocs})
                                }}
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Info Boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Security Info */}
                      <div className={cn(
                        "p-4 rounded-lg border-l-4",
                        theme === 'dark'
                          ? "bg-green-900/20 border-green-500"
                          : "bg-green-50 border-green-500"
                      )}>
                        <div className="flex items-start gap-3">
                          <Shield className="w-5 h-5 text-green-500 mt-0.5" />
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm font-medium mb-1",
                              theme === 'dark' ? "text-green-300" : "text-green-900"
                            )}>
                              Almacenamiento Seguro
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-green-200/70" : "text-green-800/70"
                            )}>
                              Los documentos se guardan en un bucket privado con acceso restringido. Solo usuarios autorizados pueden ver estos archivos.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Optional Info */}
                      <div className={cn(
                        "p-4 rounded-lg border-l-4",
                        theme === 'dark'
                          ? "bg-blue-900/20 border-blue-500"
                          : "bg-blue-50 border-blue-500"
                      )}>
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1">
                            <p className={cn(
                              "text-sm font-medium mb-1",
                              theme === 'dark' ? "text-blue-300" : "text-blue-900"
                            )}>
                              Opcional
                            </p>
                            <p className={cn(
                              "text-xs",
                              theme === 'dark' ? "text-blue-200/70" : "text-blue-800/70"
                            )}>
                              Puedes omitir este paso y agregar documentos más tarde desde la configuración de la empresa.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 7/4: Review (Paso 7 para otros, Paso 4 para brokers) */}
              {((currentStep === 7 && formData.companyType !== 'broker') || (currentStep === 4 && formData.companyType === 'broker')) && (
                <div className={cn(
                  "backdrop-blur-sm border rounded-2xl p-8",
                  theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
                )}>
                  <h2 className={cn(
                    "text-xl font-bold mb-6",
                    theme === 'dark' ? "text-white" : "text-black"
                  )}>
                    Revisión Final
                  </h2>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información de la Empresa
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Nombre Legal:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.legalName || 'No especificado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Teléfono:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.phone || 'No especificado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Dirección:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.address || 'No especificado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Tipo de Empresa:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {COMPANY_TYPES.find(t => t.id === formData.companyType)?.name || 'No especificado'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Configuración de Wallet
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Número de Wallet:
                            </span>
                            <span className={cn(
                              "text-sm font-medium font-mono",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.walletNumber || 'No generado'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Moneda Principal:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.currency || 'USD'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Multi-moneda:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.isMultiCurrency ? 'Sí' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              Límites Configurados:
                            </span>
                            <span className={cn(
                              "text-sm font-medium",
                              theme === 'dark' ? "text-white" : "text-black"
                            )}>
                              {formData.hasLimits ? 'Sí' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Servicios Activados
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {formData.enabledServices.map((serviceId: string) => {
                          const service = SERVICES.find(s => s.id === serviceId)
                          return service ? (
                            <span
                              key={serviceId}
                              className={cn(
                                "px-3 py-1 rounded-full text-sm",
                                theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary" : "bg-exa-primary/10 text-exa-primary"
                              )}
                            >
                              {service.name}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <motion.button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={currentStep === 1}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                currentStep === 1
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : theme === 'dark'
                    ? "bg-gray-700 text-white hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </motion.button>

            {/* Botón Guardar Progreso */}
            <motion.button
              onClick={handleSaveProgress}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading || !formData.legalName}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
                theme === 'dark'
                  ? "bg-amber-600 text-white hover:bg-amber-500"
                  : "bg-amber-500 text-white hover:bg-amber-600"
              )}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Guardar
            </motion.button>

            {currentStep === (formData.companyType === 'broker' ? BROKER_STEPS.length : STEPS.length) ? (
              <motion.button
                onClick={formData.editMode ? handleUpdateCompany : handleCreateCompany}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? "bg-green-500 text-white hover:bg-green-600"
                    : "bg-green-500 text-white hover:bg-green-600"
                )}
              >
                <Check className="w-4 h-4" />
                {formData.editMode ? 'Actualizar Empresa' : 'Crear Empresa'}
              </motion.button>
            ) : (
              <motion.button
                onClick={() => {
                  const maxSteps = formData.companyType === 'broker' ? BROKER_STEPS.length : STEPS.length
                  if (currentStep === 1 && !formData.walletNumber) {
                    generateWalletNumber()
                    if (formData.country && !formData.currency) {
                      const defaultCurrency = getPrimaryCurrencyForCountry(formData.country)
                      setFormData((prev: any) => ({
                        ...prev,
                        currency: defaultCurrency,
                        dailyLimit: '1000',
                        monthlyLimit: '10000'
                      }))
                    }
                  }
                  setCurrentStep(Math.min(maxSteps, currentStep + 1))
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                  theme === 'dark'
                    ? "bg-exa-secondary text-white hover:bg-exa-primary"
                    : "bg-exa-primary text-white hover:bg-exa-secondary"
                )}
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      ) : (
        // Companies List View
        <div className="p-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-5">
            {/* Total Empresas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-blue-900/30 border border-blue-800/50'
                        : 'bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200'
                    )}>
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total Empresas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{companies.length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Registradas</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Activas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-amber-900/30 border border-amber-800/50'
                        : 'bg-gradient-to-br from-amber-50 to-orange-100 border border-amber-200'
                    )}>
                      <Activity className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Activas</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{companies.filter((c: any) => c.status === 'active').length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>En operación</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Total Usuarios */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-emerald-900/30 border border-emerald-800/50'
                        : 'bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200'
                    )}>
                      <Users className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Total Usuarios</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>{companies.reduce((sum, c) => sum + c.usersCount, 0)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Totales</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Balance Total */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className={cn(
                'relative overflow-hidden',
                theme === 'dark'
                  ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700'
                  : 'bg-gradient-to-br from-slate-50 to-white border-slate-200',
                'rounded-2xl border shadow-xl'
              )}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-600"></div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-3 rounded-xl shadow-sm',
                      theme === 'dark'
                        ? 'bg-violet-900/30 border border-violet-800/50'
                        : 'bg-gradient-to-br from-violet-50 to-purple-100 border border-violet-200'
                    )}>
                      <TrendingUp className="w-6 h-6 text-violet-600" />
                    </div>
                    <div>
                      <p className={cn(
                        'text-sm font-medium',
                        theme === 'dark' ? 'text-gray-400' : 'text-black'
                      )}>Balance Total</p>
                      <p className={cn(
                        'text-3xl font-bold mt-1',
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      )}>${companies.reduce((sum, c) => sum + (parseFloat(c.walletBalance) || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse"></div>
                    <span className={cn(
                      'text-xs font-medium',
                      theme === 'dark' ? 'text-gray-500' : 'text-black'
                    )}>Acumulado</span>
                  </div>
                </div>
              </div>
            </motion.div>
            </div>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "backdrop-blur-sm border rounded-2xl p-6 mb-6",
              theme === 'dark' ? "bg-white/5 border-white/10" : "bg-white/90 border-gray-200"
            )}
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className={cn(
                  "absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <input
                  type="text"
                  placeholder="Buscar empresas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all duration-300",
                    theme === 'dark'
                      ? "bg-gray-800/50 border-gray-700 text-white focus:border-exa-secondary focus:ring-exa-secondary/20"
                      : "bg-white border-gray-300 text-black focus:border-exa-primary focus:ring-exa-primary/20"
                  )}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFilter('all')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'all'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Todas
                </button>
                <button
                  onClick={() => setSelectedFilter('agency')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'agency'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Agencias
                </button>
                <button
                  onClick={() => setSelectedFilter('market')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'market'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary hover:bg-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Mercados
                </button>
                <button
                  onClick={() => setSelectedFilter('broker')}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all duration-300 border",
                    selectedFilter === 'broker'
                      ? theme === 'dark'
                        ? "bg-exa-secondary text-white border-exa-secondary hover:bg-exa-secondary/90"
                        : "bg-exa-primary text-white border-exa-primary/90"
                      : theme === 'dark'
                        ? "bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white"
                        : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-exa-primary hover:text-white"
                  )}
                >
                  Brokers
                </button>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="w-4 h-4" />
                  Crear Empresa
                </button>
              </div>
            </div>
          </motion.div>

          {/* Companies Cards */}
          {loading && companies.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <LoadingBox text="Cargando empresas..." size="md" />
            </div>
          ) : filteredCompanies.length === 0 ? (
            <div className={cn(
              'rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center',
              theme === 'dark' ? 'bg-gray-800' : 'bg-white'
            )}>
              <Building2 className="w-12 h-12 mx-auto text-gray-400" />
              <p className="mt-2 text-black dark:text-gray-400">
                {searchTerm ? 'No se encontraron empresas con los filtros aplicados' : 'No hay empresas registradas'}
              </p>
            </div>
          ) : (
            <div className="max-w-[1400px] mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredCompanies.map((company, index) => {
                  const isBranch = company.isBranch || false
                  const badgeLabel = isBranch ? 'Sucursal' : 'Matriz'
                  const branchCount = companies.filter((c: any) => c.parentCompanyId === company.id).length
                  const borderColor = isBranch ? 'border-l-red-500' : 'border-l-blue-500'
                  const badgeBorderColor = isBranch ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-blue-500 text-blue-600 dark:text-blue-400'

                  return (
                    <motion.div
                      key={company.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 border-l-4 overflow-hidden',
                        borderColor
                      )}
                    >
                      {/* Header */}
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Building2 className={cn(
                            "w-5 h-5 flex-shrink-0",
                            isBranch ? "text-red-500" : "text-blue-500"
                          )} />
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                            {company.legalName}
                          </h3>
                        </div>
                        <span className={cn(
                          "inline-block px-2 py-0.5 rounded text-xs font-medium border",
                          badgeBorderColor
                        )}>
                          {badgeLabel}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3">
                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 text-xs">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">
                            {company.city || 'N/A'}, {company.state || ''} {company.country || ''}
                          </span>
                        </div>

                        {/* Provider Indicator */}
                        {company.isProvider && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                              <Package className="w-3 h-3" />
                              Proveedor
                            </span>
                            {company.providerCategories && company.providerCategories.length > 0 && (
                              company.providerCategories.map((cat: string) => (
                                <span
                                  key={cat}
                                  className={cn(
                                    "inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    cat === 'paqueteria' && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
                                    cat === 'remesa' && "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
                                    cat === 'recarga' && "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
                                    cat === 'mercado' && "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                                  )}
                                >
                                  {cat === 'paqueteria' ? 'Paqueteria' :
                                   cat === 'remesa' ? 'Remesa' :
                                   cat === 'recarga' ? 'Recarga' :
                                   cat === 'mercado' ? 'Mercado' : cat}
                                </span>
                              ))
                            )}
                          </div>
                        )}

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-2">
                          {/* Balance */}
                          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Balance</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              ${(company.walletBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* Usuarios */}
                          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2">
                            <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Usuarios</div>
                            <div className="text-sm font-bold text-gray-900 dark:text-white">
                              {company.usersCount || 0}
                            </div>
                          </div>

                          {/* Sucursales - Only show for parent companies */}
                          {!isBranch && (
                            <div className="bg-gray-50 dark:bg-gray-900/30 rounded-lg p-2 col-span-2">
                              <div className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Sucursales</div>
                              <div className="text-sm font-bold text-gray-900 dark:text-white">
                                {branchCount}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer - Status Badge and Actions */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
                        {/* Status Badge */}
                        <span className={cn(
                          "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                          company.status === 'active'
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800"
                            : "bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                        )}>
                          {company.status === 'active' ? "Activo" : "Inactivo"}
                        </span>

                        {/* Action Buttons */}
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setSelectedCompany(company)}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleEditCompany(company.id)}
                            disabled={loading}
                            className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                            title="Editar"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(company.id, company.legalName, company.status)}
                            disabled={loading}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors disabled:opacity-50",
                              company.status === 'active'
                                ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                : "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            )}
                            title={company.status === 'active' ? 'Desactivar' : 'Activar'}
                          >
                            {company.status === 'active' ? (
                              <XCircle className="w-3.5 h-3.5" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {company.status !== 'active' && (
                            <button
                              onClick={() => handleDeleteCompany(company.id, company.legalName)}
                              disabled={loading}
                              className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Company Detail Modal */}
          <AnimatePresence>
            {selectedCompany && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                onClick={() => setSelectedCompany(null)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6",
                    theme === 'dark' ? "bg-gray-900" : "bg-white"
                  )}
                >
                  {/* Detail Modal Content */}
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-16 h-16 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                        )}>
                          <Building2 className={cn(
                            "w-8 h-8",
                            theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                          )} />
                        </div>
                        <div>
                          <h2 className={cn(
                            "text-2xl font-bold",
                            theme === 'dark' ? "text-white" : "text-black"
                          )}>
                            {selectedCompany.legalName}
                          </h2>
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-2 h-2 rounded-full",
                              selectedCompany.status === 'active' ? "bg-green-500" : "bg-red-500"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )}>
                              {selectedCompany.status === 'active' ? 'Activa' : 'Inactiva'}
                            </span>
                            <span className={cn(
                              "text-sm px-2 py-1 rounded-lg",
                              theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                            )}>
                              {COMPANY_TYPES.find(t => t.id === selectedCompany.companyType)?.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedCompany(null)}
                        className={cn(
                          "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        )}
                      >
                        <X className={cn(
                          "w-5 h-5",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )} />
                      </button>
                    </div>

                    {/* Wallet Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Wallet de la Empresa
                        </h3>
                        <WalletCard
                          walletNumber={selectedCompany.walletNumber}
                          companyName={selectedCompany.legalName}
                          primaryCurrency={selectedCompany.currency}
                          secondaryCurrencies={selectedCompany.secondaryCurrencies}
                          balance={selectedCompany.walletBalance}
                          showBalance={true}
                          setShowBalance={() => {}}
                          isMultiCurrency={selectedCompany.isMultiCurrency}
                          hasLimits={selectedCompany.hasLimits}
                          dailyLimit={selectedCompany.dailyLimit}
                          monthlyLimit={selectedCompany.monthlyLimit}
                        />
                      </div>

                      <div className="space-y-4">
                        <h3 className={cn(
                          "text-lg font-semibold mb-4",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Información de Contacto
                        </h3>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Phone className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {selectedCompany.phone}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <MapPin className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              {selectedCompany.address}, {selectedCompany.city}, {selectedCompany.country}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Mail className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              contact@{selectedCompany.legalName.toLowerCase().replace(/\s+/g, '')}.com
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <Calendar className={cn(
                              "w-5 h-5",
                              theme === 'dark' ? "text-gray-400" : "text-gray-600"
                            )} />
                            <span className={cn(
                              "text-sm",
                              theme === 'dark' ? "text-gray-300" : "text-gray-700"
                            )}>
                              Creada el {selectedCompany.createdAt}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <DollarSign className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-green-400" : "text-green-600"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          ${selectedCompany.walletBalance.toLocaleString()}
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Balance Actual
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <Activity className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          {selectedCompany.transactionsCount}
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Transacciones
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <Users className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-purple-400" : "text-purple-600"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          {selectedCompany.usersCount}
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Usuarios
                        </p>
                      </div>

                      <div className={cn(
                        "p-4 rounded-xl text-center",
                        theme === 'dark' ? "bg-gray-800" : "bg-gray-100"
                      )}>
                        <Star className={cn(
                          "w-6 h-6 mx-auto mb-2",
                          theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
                        )} />
                        <p className={cn(
                          "text-xl font-bold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          4.8
                        </p>
                        <p className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>
                          Rating
                        </p>
                      </div>
                    </div>

                    {/* Services */}
                    <div>
                      <h3 className={cn(
                        "text-lg font-semibold mb-4",
                        theme === 'dark' ? "text-white" : "text-black"
                      )}>
                        Servicios Activados
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedCompany.enabledServices.map((serviceId: string) => {
                          const service = SERVICES.find(s => s.id === serviceId)
                          return service ? (
                            <div
                              key={serviceId}
                              className={cn(
                                "px-4 py-2 rounded-xl border flex items-center gap-2",
                                theme === 'dark' ? "border-gray-700" : "border-gray-200"
                              )}
                            >
                              <div className={cn(
                                "w-6 h-6 rounded-lg flex items-center justify-center",
                                theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/20"
                              )}>
                                <Settings className={cn(
                                  "w-3 h-3",
                                  theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                                )} />
                              </div>
                              <div>
                                <p className={cn(
                                  "font-medium text-sm",
                                  theme === 'dark' ? "text-white" : "text-black"
                                )}>
                                  {service.name}
                                </p>
                                <p className={cn(
                                  "text-xs",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  {service.description}
                                </p>
                              </div>
                            </div>
                          ) : null
                        })}
                      </div>
                    </div>

                    {/* Drivers Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className={cn(
                          "text-lg font-semibold",
                          theme === 'dark' ? "text-white" : "text-black"
                        )}>
                          Drivers de la Empresa
                        </h3>
                        <span className={cn(
                          "text-sm px-3 py-1 rounded-full",
                          theme === 'dark' ? "bg-blue-900/30 text-blue-400" : "bg-blue-100 text-blue-700"
                        )}>
                          {companyDrivers.length} drivers
                        </span>
                      </div>

                      {loadingDrivers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                          <span className={cn(
                            "ml-2 text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            Cargando drivers...
                          </span>
                        </div>
                      ) : companyDrivers.length === 0 ? (
                        <div className={cn(
                          "text-center py-8 rounded-xl border",
                          theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                        )}>
                          <Truck className={cn(
                            "w-10 h-10 mx-auto mb-2",
                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                          )} />
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? "text-gray-400" : "text-gray-600"
                          )}>
                            No hay drivers registrados para esta empresa
                          </p>
                        </div>
                      ) : (
                        <div className={cn(
                          "rounded-xl border overflow-hidden",
                          theme === 'dark' ? "border-gray-700" : "border-gray-200"
                        )}>
                          <table className="w-full">
                            <thead className={cn(
                              "border-b",
                              theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                            )}>
                              <tr>
                                <th className={cn(
                                  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Driver
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Contacto
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Estado
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Cajas Vacías
                                </th>
                                <th className={cn(
                                  "px-4 py-3 text-center text-xs font-medium uppercase tracking-wider",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                )}>
                                  Bultos
                                </th>
                              </tr>
                            </thead>
                            <tbody className={cn(
                              "divide-y",
                              theme === 'dark' ? "divide-gray-700" : "divide-gray-200"
                            )}>
                              {companyDrivers.map((driver) => (
                                <tr
                                  key={driver.id}
                                  className={cn(
                                    "transition-colors",
                                    theme === 'dark' ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                                  )}
                                >
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center",
                                        theme === 'dark' ? "bg-gray-700" : "bg-gray-100"
                                      )}>
                                        <Users className="w-4 h-4 text-gray-500" />
                                      </div>
                                      <div>
                                        <div className={cn(
                                          "text-sm font-medium",
                                          theme === 'dark' ? "text-white" : "text-black"
                                        )}>
                                          {driver.firstName} {driver.lastName}
                                        </div>
                                        <div className={cn(
                                          "text-xs",
                                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                        )}>
                                          ID: {driver.id}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className={cn(
                                      "text-sm",
                                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                                    )}>
                                      {driver.email}
                                    </div>
                                    {driver.phone && (
                                      <div className={cn(
                                        "text-xs",
                                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                                      )}>
                                        {driver.phone}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={cn(
                                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                      driver.isActive
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                                    )}>
                                      {driver.isActive ? (
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                      ) : (
                                        <XCircle className="w-3 h-3 mr-1" />
                                      )}
                                      {driver.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-center text-xs">
                                        <span className={cn(
                                          "font-medium",
                                          theme === 'dark' ? "text-white" : "text-black"
                                        )}>
                                          {driver.cajas_vacias_count || 0}
                                        </span>
                                      </div>
                                      <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-1.5">
                                        <div
                                          className="h-1.5 rounded-full bg-purple-500 transition-all duration-300"
                                          style={{
                                            width: `${(driver.cajas_vacias_capacity || 50) > 0 ? ((driver.cajas_vacias_count || 0) / (driver.cajas_vacias_capacity || 50) * 100) : 0}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-center text-xs">
                                        <span className={cn(
                                          "font-medium",
                                          theme === 'dark' ? "text-white" : "text-black"
                                        )}>
                                          {driver.bultos_count || 0}
                                        </span>
                                      </div>
                                      <div className="w-full bg-amber-100 dark:bg-amber-900/30 rounded-full h-1.5">
                                        <div
                                          className="h-1.5 rounded-full bg-amber-500 transition-all duration-300"
                                          style={{
                                            width: `${(driver.bultos_capacity || 100) > 0 ? ((driver.bultos_count || 0) / (driver.bultos_capacity || 100) * 100) : 0}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirm Dialog */}
          <ConfirmDialog
            isOpen={confirmDialog.isOpen}
            onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            onConfirm={confirmDialog.onConfirm}
            title={confirmDialog.title}
            message={confirmDialog.message}
            type={confirmDialog.type}
            theme={theme}
            confirmText="Confirmar"
            cancelText="Cancelar"
          />
        </div>
      )}
    </DashboardLayout>
  )
}
