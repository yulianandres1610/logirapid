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
  Sparkles
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import UnsplashAPI from '@/lib/unsplash'

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
    { id: 'santa-fe', name: 'Santa Fe' },
  ]}
]

const MOCK_MARKETS = [
  // La Habana - Vedado (5 mercados)
  {
    id: 'market-1',
    name: 'Supermercado Habana',
    address: 'Calle 23 #12, Vedado, La Habana',
    province: 'la-habana',
    municipality: 'vedado',
    coordinates: { lat: 23.1359, lng: -82.3619 },
    rating: 4.5,
    deliveryTime: '30-45 min',
    deliveryCost: 2.50,
    image: '/images/market1.jpg',
    categories: ['Supermercado', 'Comestibles', 'Alimentos', 'Bebidas', 'Lácteos', 'Carnicería'],
    schedule: 'Lun-Dom: 8:00 AM - 10:00 PM',
    phone: '+53 7-832-1234',
    description: 'Supermercado completo con productos nacionales e importados'
  },
  {
    id: 'market-2',
    name: 'Tienda 23 y 12',
    address: 'Calle 23 #12, Vedado, La Habana',
    province: 'la-habana',
    municipality: 'vedado',
    coordinates: { lat: 23.1359, lng: -82.3619 },
    rating: 4.2,
    deliveryTime: '25-40 min',
    deliveryCost: 2.00,
    image: '/images/market2.jpg',
    categories: ['Tienda', 'Comestibles', 'Productos básicos', 'Importados', 'Snacks'],
    schedule: 'Lun-Sáb: 7:00 AM - 9:00 PM',
    phone: '+53 7-833-5678',
    description: 'Tienda de barrio con productos básicos y algunos artículos de importación'
  },
  {
    id: 'market-3',
    name: 'Panadería El Buen Gusto',
    address: 'Calle Linea #18, Vedado, La Habana',
    province: 'la-habana',
    municipality: 'vedado',
    coordinates: { lat: 23.1345, lng: -82.3630 },
    rating: 4.8,
    deliveryTime: '20-35 min',
    deliveryCost: 1.50,
    image: '/images/market3.jpg',
    categories: ['Panadería', 'Pastelería', 'Pan fresco', 'Postres', 'Café', 'Repostería'],
    schedule: 'Lun-Dom: 6:00 AM - 8:00 PM',
    phone: '+53 7-834-9012',
    description: 'Panadería artesanal con pan fresco y pasteles caseros'
  },
  {
    id: 'market-6',
    name: 'Carnicería El Matadero',
    address: 'Calle G #25, Vedado, La Habana',
    province: 'la-habana',
    municipality: 'vedado',
    coordinates: { lat: 23.1365, lng: -82.3625 },
    rating: 4.4,
    deliveryTime: '25-35 min',
    deliveryCost: 2.00,
    image: '/images/market6.jpg',
    categories: ['Carnicería', 'Alimentos', 'Carnes frescas', 'Embutidos', 'Aves', 'Cerdo'],
    schedule: 'Lun-Sáb: 7:00 AM - 7:00 PM',
    phone: '+53 7-837-2345',
    description: 'Carnes frescas de primera calidad'
  },
  {
    id: 'market-7',
    name: 'Pescadería El Mar',
    address: 'Calle L #15, Vedado, La Habana',
    province: 'la-habana',
    municipality: 'vedado',
    coordinates: { lat: 23.1372, lng: -82.3635 },
    rating: 4.6,
    deliveryTime: '30-40 min',
    deliveryCost: 2.50,
    image: '/images/market7.jpg',
    categories: ['Pescadería', 'Mariscos', 'Pescado fresco', 'Langostas', 'Camarones', 'Pulpo'],
    schedule: 'Lun-Sáb: 8:00 AM - 6:00 PM',
    phone: '+53 7-838-4567',
    description: 'Pescado fresco y mariscos del día'
  },

  // La Habana - Playa (4 mercados)
  {
    id: 'market-4',
    name: 'Mini Market Playa',
    address: 'Avenida 1ra #60, Playa, La Habana',
    province: 'la-habana',
    municipality: 'playa',
    coordinates: { lat: 23.1295, lng: -82.3789 },
    rating: 4.0,
    deliveryTime: '35-50 min',
    deliveryCost: 3.00,
    image: '/images/market4.jpg',
    categories: ['Mini Market', 'Conveniencia', '24 horas', 'Productos básicos', 'Snacks', 'Bebidas'],
    schedule: 'Lun-Dom: 8:00 AM - 11:00 PM',
    phone: '+53 7-835-3456',
    description: 'Mini market con amplio surtido y atención 24 horas'
  },
  {
    id: 'market-8',
    name: 'Supermercado 5ta y 42',
    address: '5ta Avenida #42, Playa, La Habana',
    province: 'la-habana',
    municipality: 'playa',
    coordinates: { lat: 23.1288, lng: -82.3795 },
    rating: 4.3,
    deliveryTime: '30-45 min',
    deliveryCost: 2.80,
    image: '/images/market8.jpg',
    categories: ['Supermercado', 'Comestibles'],
    schedule: 'Lun-Dom: 9:00 AM - 9:00 PM',
    phone: '+53 7-839-7890',
    description: 'Supermercado moderno con gran variedad de productos'
  },
  {
    id: 'market-9',
    name: 'Dulcería La Casa del Chocolate',
    address: 'Calle 3ra #28, Playa, La Habana',
    province: 'la-habana',
    municipality: 'playa',
    coordinates: { lat: 23.1302, lng: -82.3778 },
    rating: 4.7,
    deliveryTime: '25-35 min',
    deliveryCost: 2.00,
    image: '/images/market9.jpg',
    categories: ['Dulcería', 'Confitería', 'Chocolates', 'Dulces cubanos', 'Repostería fina', 'Importados'],
    schedule: 'Lun-Sáb: 10:00 AM - 8:00 PM',
    phone: '+53 7-840-1234',
    description: 'Artículos de repostería fina y chocolates importados'
  },
  {
    id: 'market-10',
    name: 'Boutique del Vino',
    address: 'Avenida 1ra #15, Playa, La Habana',
    province: 'la-habana',
    municipality: 'playa',
    coordinates: { lat: 23.1292, lng: -82.3785 },
    rating: 4.8,
    deliveryTime: '40-55 min',
    deliveryCost: 3.50,
    image: '/images/market10.jpg',
    categories: ['Bebidas', 'Licores', 'Vinos importados', 'Ron cubano', 'Champagne', 'Cocteles'],
    schedule: 'Lun-Sáb: 11:00 AM - 9:00 PM',
    phone: '+53 7-841-5678',
    description: 'Selección exclusiva de vinos y licores importados'
  },

  // La Habana - Centro Habana (3 mercados)
  {
    id: 'market-5',
    name: 'Frutas Tropicales',
    address: 'Calle 25 #10, Centro Habana, La Habana',
    province: 'la-habana',
    municipality: 'centro-habana',
    coordinates: { lat: 23.1402, lng: -82.3543 },
    rating: 4.6,
    deliveryTime: '30-45 min',
    deliveryCost: 2.50,
    image: '/images/market5.jpg',
    categories: ['Frutas', 'Verduras', 'Productos frescos', 'Orgánicos', 'Agricultura local'],
    schedule: 'Lun-Sáb: 7:00 AM - 6:00 PM',
    phone: '+53 7-836-7890',
    description: 'Frutas y verduras frescas de origen local'
  },
  {
    id: 'market-11',
    name: 'Market La Habana Vieja',
    address: 'Calle Brasil #45, Centro Habana, La Habana',
    province: 'la-habana',
    municipality: 'centro-habana',
    coordinates: { lat: 23.1395, lng: -82.3550 },
    rating: 4.2,
    deliveryTime: '35-50 min',
    deliveryCost: 2.80,
    image: '/images/market11.jpg',
    categories: ['Supermercado', 'Artesanías', 'Productos cubanos'],
    schedule: 'Lun-Dom: 8:00 AM - 10:00 PM',
    phone: '+53 7-842-9012',
    description: 'Mercado con artesanías y productos cubanos'
  },
  {
    id: 'market-12',
    name: 'Farmacia El Faro',
    address: 'Calle Neptuno #123, Centro Habana, La Habana',
    province: 'la-habana',
    municipality: 'centro-habana',
    coordinates: { lat: 23.1410, lng: -82.3538 },
    rating: 4.1,
    deliveryTime: '20-30 min',
    deliveryCost: 2.00,
    image: '/images/market12.jpg',
    categories: ['Farmacia', 'Salud'],
    schedule: 'Lun-Sáb: 8:00 AM - 8:00 PM',
    phone: '+53 7-843-3456',
    description: 'Productos farmacéuticos y artículos de higiene personal'
  },
  {
    id: 'market-27',
    name: 'Servisumic',
    address: 'Calle Galiano #45, Centro Habana, La Habana',
    province: 'la-habana',
    municipality: 'centro-habana',
    coordinates: { lat: 23.1405, lng: -82.3548 },
    rating: 4.3,
    deliveryTime: '25-40 min',
    deliveryCost: 2.50,
    image: '/images/market27.jpg',
    categories: ['Ferretería', 'Herramientas', 'Electricidad', 'Fontanería', 'Construcción'],
    schedule: 'Lun-Sáb: 9:00 AM - 7:00 PM',
    phone: '+53 7-862-1111',
    description: 'Ferretería completa con herramientas y materiales para construcción y reparación'
  },

  // La Habana - El Cerro (2 mercados)
  {
    id: 'market-13',
    name: 'Supermercado El Cerro',
    address: 'Avenida del Puerto #89, El Cerro, La Habana',
    province: 'la-habana',
    municipality: 'el-cerro',
    coordinates: { lat: 23.1250, lng: -82.3850 },
    rating: 3.9,
    deliveryTime: '35-50 min',
    deliveryCost: 2.50,
    image: '/images/market13.jpg',
    categories: ['Supermercado', 'Barrio'],
    schedule: 'Lun-Dom: 7:00 AM - 9:00 PM',
    phone: '+53 7-844-5678',
    description: 'Supermercado de barrio con productos básicos y de primera necesidad'
  },
  {
    id: 'market-14',
    name: 'Pollería El Pollo Dorado',
    address: 'Calle Diez de Octubre #156, El Cerro, La Habana',
    province: 'la-habana',
    municipality: 'el-cerro',
    coordinates: { lat: 23.1242, lng: -82.3842 },
    rating: 4.3,
    deliveryTime: '25-40 min',
    deliveryCost: 2.00,
    image: '/images/market14.jpg',
    categories: ['Pollería', 'Comida Rápida'],
    schedule: 'Lun-Sáb: 10:00 AM - 10:00 PM',
    phone: '+53 7-845-7890',
    description: 'Pollo frito y comidas rápidas a domicilio'
  },
  {
    id: 'market-28',
    name: 'Titos Market',
    address: 'Avenida Carlos III #234, El Cerro, La Habana',
    province: 'la-habana',
    municipality: 'el-cerro',
    coordinates: { lat: 23.1235, lng: -82.3855 },
    rating: 4.0,
    deliveryTime: '30-45 min',
    deliveryCost: 2.80,
    image: '/images/market28.jpg',
    categories: ['Tienda', 'Abarrotes', 'Productos básicos', 'Bebidas', 'Snacks', 'Artículos de limpieza'],
    schedule: 'Lun-Dom: 7:00 AM - 10:00 PM',
    phone: '+53 7-846-2222',
    description: 'Tienda de barrio con productos básicos, alimentos y artículos de limpieza'
  },

  // La Habana - Cojímar (2 mercados)
  {
    id: 'market-15',
    name: 'Marisquería Cojímar',
    address: 'Malecón de Cojímar #234, Cojímar, La Habana',
    province: 'la-habana',
    municipality: 'cojimar',
    coordinates: { lat: 23.1650, lng: -82.3200 },
    rating: 4.5,
    deliveryTime: '40-55 min',
    deliveryCost: 3.00,
    image: '/images/market15.jpg',
    categories: ['Marisquería', 'Restaurant'],
    schedule: 'Lun-Dom: 11:00 AM - 10:00 PM',
    phone: '+53 7-846-9012',
    description: 'Mariscos frescos y especialidades de pescado'
  },
  {
    id: 'market-16',
    name: 'Tienda Barrio Cojímar',
    address: 'Calle 5ta #67, Cojímar, La Habana',
    province: 'la-habana',
    municipality: 'cojimar',
    coordinates: { lat: 23.1642, lng: -82.3192 },
    rating: 3.8,
    deliveryTime: '30-45 min',
    deliveryCost: 2.50,
    image: '/images/market16.jpg',
    categories: ['Tienda', 'Conveniencia'],
    schedule: 'Lun-Dom: 7:00 AM - 10:00 PM',
    phone: '+53 7-847-3456',
    description: 'Tienda de conveniencia con productos básicos'
  },

  // Matanzas - Matanzas (3 mercados)
  {
    id: 'market-17',
    name: 'Supermercado San Miguel',
    address: 'Calle San Miguel #45, Matanzas',
    province: 'matanzas',
    municipality: 'matanzas',
    coordinates: { lat: 23.0411, lng: -81.5775 },
    rating: 4.2,
    deliveryTime: '35-50 min',
    deliveryCost: 2.80,
    image: '/images/market17.jpg',
    categories: ['Supermercado', 'Principal'],
    schedule: 'Lun-Dom: 8:00 AM - 9:00 PM',
    phone: '+53 45-241-1234',
    description: 'Principal supermercado de la ciudad'
  },
  {
    id: 'market-18',
    name: 'Mercado Municipal',
    address: 'Parque Libertad #12, Matanzas',
    province: 'matanzas',
    municipality: 'matanzas',
    coordinates: { lat: 23.0420, lng: -81.5765 },
    rating: 4.0,
    deliveryTime: '30-45 min',
    deliveryCost: 2.50,
    image: '/images/market18.jpg',
    categories: ['Mercado', 'Agricultura'],
    schedule: 'Lun-Sáb: 6:00 AM - 6:00 PM',
    phone: '+53 45-242-5678',
    description: 'Productos frescos del campo'
  },
  {
    id: 'market-19',
    name: 'Boutique Matanzas',
    address: 'Calle 31 #89, Matanzas',
    province: 'matanzas',
    municipality: 'matanzas',
    coordinates: { lat: 23.0402, lng: -81.5785 },
    rating: 4.4,
    deliveryTime: '40-55 min',
    deliveryCost: 3.00,
    image: '/images/market19.jpg',
    categories: ['Ropa', 'Accesorios'],
    schedule: 'Lun-Sáb: 10:00 AM - 7:00 PM',
    phone: '+53 45-243-7890',
    description: 'Ropa y accesorios de moda'
  },

  // Matanzas - Varadero (4 mercados)
  {
    id: 'market-20',
    name: 'Supermercado Varadero Beach',
    address: 'Avenida 1ra #45, Varadero',
    province: 'matanzas',
    municipality: 'varadero',
    coordinates: { lat: 23.1520, lng: -81.2475 },
    rating: 4.3,
    deliveryTime: '25-40 min',
    deliveryCost: 3.50,
    image: '/images/market20.jpg',
    categories: ['Supermercado', 'Zona hotelera'],
    schedule: 'Lun-Dom: 8:00 AM - 10:00 PM',
    phone: '+53 45-244-9012',
    description: 'Supermercado de la zona hotelera'
  },
  {
    id: 'market-21',
    name: 'Souvenir Shop Cuba',
    address: 'Calle 62 #34, Varadero',
    province: 'matanzas',
    municipality: 'varadero',
    coordinates: { lat: 23.1512, lng: -81.2468 },
    rating: 4.1,
    deliveryTime: '30-45 min',
    deliveryCost: 3.00,
    image: '/images/market21.jpg',
    categories: ['Souvenirs', 'Artesanías', 'Regalos'],
    schedule: 'Lun-Dom: 9:00 AM - 9:00 PM',
    phone: '+53 45-245-3456',
    description: 'Recuerdos y artesanías cubanas'
  },
  {
    id: 'market-22',
    name: 'Duty Free Shop',
    address: 'Avenida Kawama #12, Varadero',
    province: 'matanzas',
    municipality: 'varadero',
    coordinates: { lat: 23.1528, lng: -81.2482 },
    rating: 4.5,
    deliveryTime: '35-50 min',
    deliveryCost: 4.00,
    image: '/images/market22.jpg',
    categories: ['Duty Free', 'Lujo'],
    schedule: 'Lun-Dom: 10:00 AM - 8:00 PM',
    phone: '+53 45-246-5678',
    description: 'Tienda libre de impuestos'
  },
  {
    id: 'market-23',
    name: 'Varadero Market',
    address: 'Calle 28 #67, Varadero',
    province: 'matanzas',
    municipality: 'varadero',
    coordinates: { lat: 23.1505, lng: -81.2455 },
    rating: 3.9,
    deliveryTime: '20-35 min',
    deliveryCost: 2.50,
    image: '/images/market23.jpg',
    categories: ['Mercado', 'Comestibles'],
    schedule: 'Lun-Sáb: 7:00 AM - 7:00 PM',
    phone: '+53 45-247-7890',
    description: 'Mercado local con productos frescos'
  },

  // Villa Clara - Santa Clara (3 mercados)
  {
    id: 'market-24',
    name: 'Supermercado Santa Clara',
    address: 'Calle Martí #123, Santa Clara',
    province: 'villa-clara',
    municipality: 'santa-clara',
    coordinates: { lat: 22.4082, lng: -79.9647 },
    rating: 4.1,
    deliveryTime: '30-45 min',
    deliveryCost: 2.50,
    image: '/images/market24.jpg',
    categories: ['Supermercado', 'Principal'],
    schedule: 'Lun-Dom: 8:00 AM - 9:00 PM',
    phone: '+53 42-201-1234',
    description: 'Principal supermercado de la ciudad universitaria'
  },
  {
    id: 'market-25',
    name: 'Mercado del Che',
    address: 'Parque Vidal #45, Santa Clara',
    province: 'villa-clara',
    municipality: 'santa-clara',
    coordinates: { lat: 22.4090, lng: -79.9655 },
    rating: 4.3,
    deliveryTime: '25-40 min',
    deliveryCost: 2.00,
    image: '/images/market25.jpg',
    categories: ['Mercado', 'Cultural'],
    schedule: 'Lun-Sáb: 7:00 AM - 6:00 PM',
    phone: '+53 42-202-5678',
    description: 'Mercado tradicional en el centro histórico'
  },
  {
    id: 'market-26',
    name: 'Tienda UCLV',
    address: 'Campus UCLV #67, Santa Clara',
    province: 'villa-clara',
    municipality: 'santa-clara',
    coordinates: { lat: 22.4072, lng: -79.9638 },
    rating: 3.8,
    deliveryTime: '20-30 min',
    deliveryCost: 1.50,
    image: '/images/market26.jpg',
    categories: ['Tienda', 'Universitaria'],
    schedule: 'Lun-Sáb: 8:00 AM - 8:00 PM',
    phone: '+53 42-203-7890',
    description: 'Tienda universitaria con artículos escolares'
  }
]

const MOCK_PRODUCTS = {
  'market-1': [
    { id: 'prod-1', name: 'Arroz Blanco', price: 2.50, unit: 'kg', category: 'Granos', image: 'https://images.unsplash.com/photo-1586201375885-4e4c0bf8a9a2?w=400&h=300&fit=crop', description: 'Arroz blanco de alta calidad', stock: 100, rating: 4.5, soldUnits: 250 },
    { id: 'prod-2', name: 'Pollo Fresco', price: 5.00, unit: 'kg', category: 'Carnes', image: 'https://images.unsplash.com/photo-1587593821474-5e0b91e07236?w=400&h=300&fit=crop', description: 'Pollo fresco de granja', stock: 50, rating: 4.7, soldUnits: 180 },
    { id: 'prod-3', name: 'Leche Entera', price: 1.20, unit: 'L', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=400&h=300&fit=crop', description: 'Leche entera pasteurizada', stock: 75, rating: 4.3, soldUnits: 320 },
    { id: 'prod-4', name: 'Pan Integral', price: 0.80, unit: 'unidad', category: 'Panadería', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop', description: 'Pan integral recién horneado', stock: 30, rating: 4.6, soldUnits: 150 },
    { id: 'prod-5', name: 'Huevos', price: 0.20, unit: 'unidad', category: 'Huevos', image: 'https://images.unsplash.com/photo-1518569656558-1f25e69493b7?w=400&h=300&fit=crop', description: 'Huevos frescos de gallina', stock: 120, rating: 4.8, soldUnits: 450 },
    { id: 'prod-6', name: 'Aceite Vegetal', price: 3.50, unit: 'L', category: 'Aceites', image: 'https://images.unsplash.com/photo-1474980641067-f108aae23a78?w=400&h=300&fit=crop', description: 'Aceite vegetal refinado', stock: 40, rating: 4.2, soldUnits: 95 },
    { id: 'prod-7', name: 'Azúcar Blanca', price: 1.80, unit: 'kg', category: 'Azúcares', image: 'https://images.unsplash.com/photo-1584975064263-67e26e6f3687?w=400&h=300&fit=crop', description: 'Azúcar blanca refinada', stock: 80, rating: 4.4, soldUnits: 200 },
    { id: 'prod-8', name: 'Café Molido', price: 8.00, unit: 'kg', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop', description: 'Café molido tostado', stock: 25, rating: 4.9, soldUnits: 120 },
    { id: 'prod-9', name: 'Tomates', price: 1.50, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop', description: 'Tomates frescos y maduros', stock: 60, rating: 4.1, soldUnits: 180 },
    { id: 'prod-10', name: 'Cebollas', price: 1.20, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1569920469951-2b22a10e0d3c?w=400&h=300&fit=crop', description: 'Cebollas blancas', stock: 70, rating: 4.0, soldUnits: 160 },
    { id: 'prod-11', name: 'Papas', price: 2.00, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=300&fit=crop', description: 'Papas frescas', stock: 90, rating: 4.3, soldUnits: 220 },
    { id: 'prod-12', name: 'Zanahorias', price: 1.80, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=400&h=300&fit=crop', description: 'Zanahorias frescas y crujientes', stock: 55, rating: 4.4, soldUnits: 140 },
    { id: 'prod-13', name: 'Manzanas', price: 3.00, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400&h=300&fit=crop', description: 'Manzanas rojas y verdes', stock: 45, rating: 4.6, soldUnits: 190 },
    { id: 'prod-14', name: 'Naranjas', price: 2.50, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=400&h=300&fit=crop', description: 'Naranjas jugosas', stock: 65, rating: 4.5, soldUnits: 210 },
    { id: 'prod-15', name: 'Yogurt Natural', price: 1.50, unit: 'unidad', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop', description: 'Yogurt natural sin azúcar', stock: 35, rating: 4.3, soldUnits: 125 },
    { id: 'prod-16', name: 'Queso Fresco', price: 6.00, unit: 'kg', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1483695028939-b9c5dea506d1?w=400&h=300&fit=crop', description: 'Queso fresco cremoso', stock: 20, rating: 4.7, soldUnits: 85 },
    { id: 'prod-17', name: 'Jamón Cocido', price: 12.00, unit: 'kg', category: 'Embutidos', image: 'https://images.unsplash.com/photo-1528733050080-3de6906784b5?w=400&h=300&fit=crop', description: 'Jamón cocido de alta calidad', stock: 15, rating: 4.8, soldUnits: 95 },
    { id: 'prod-18', name: 'Salchichas', price: 8.00, unit: 'kg', category: 'Embutidos', image: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683b1?w=400&h=300&fit=crop', description: 'Salchichas de cerdo', stock: 30, rating: 4.2, soldUnits: 110 },
    { id: 'prod-19', name: 'Atún en Lata', price: 2.50, unit: 'lata', category: 'Conservas', image: 'https://images.unsplash.com/photo-1586201375885-4e4c0bf8a9a2?w=400&h=300&fit=crop', description: 'Atún en aceite vegetal', stock: 100, rating: 4.4, soldUnits: 180 },
    { id: 'prod-20', name: 'Salsa de Tomate', price: 1.80, unit: 'bote', category: 'Salsas', image: 'https://images.unsplash.com/photo-1526318896980-cf78c0882476?w=400&h=300&fit=crop', description: 'Salsa de tomate natural', stock: 50, rating: 4.1, soldUnits: 135 }
  ],
  'market-2': [
    { id: 'prod-21', name: 'Refresco Cola', price: 1.00, unit: 'botella', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1596112770777-9600bc7a7b97?w=400&h=300&fit=crop', description: 'Refresco de cola', stock: 80, rating: 4.3, soldUnits: 320 },
    { id: 'prod-22', name: 'Agua Mineral', price: 0.50, unit: 'botella', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1527960670769-f60e49c6b564?w=400&h=300&fit=crop', description: 'Agua mineral natural', stock: 120, rating: 4.6, soldUnits: 450 },
    { id: 'prod-23', name: 'Galletas Saladas', price: 1.20, unit: 'paquete', category: 'Snacks', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop', description: 'Galletas saladas crujientes', stock: 60, rating: 4.1, soldUnits: 180 },
    { id: 'prod-24', name: 'Chocolate', price: 2.00, unit: 'tableta', category: 'Dulces', image: 'https://images.unsplash.com/photo-1547036967-23911e578a25?w=400&h=300&fit=crop', description: 'Chocolate con leche', stock: 40, rating: 4.7, soldUnits: 150 },
    { id: 'prod-25', name: 'Cereales', price: 3.50, unit: 'caja', category: 'Desayuno', image: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400&h=300&fit=crop', description: 'Cereales de maíz', stock: 30, rating: 4.2, soldUnits: 95 },
    { id: 'prod-26', name: 'Mermelada', price: 2.50, unit: 'bote', category: 'Mermeladas', image: 'https://images.unsplash.com/photo-1606933952035-28e60b8c622b?w=400&h=300&fit=crop', description: 'Mermelada de fresas', stock: 25, rating: 4.4, soldUnits: 85 },
    { id: 'prod-27', name: 'Mantequilla', price: 3.00, unit: 'unidad', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1586201375885-4e4c0bf8a9a2?w=400&h=300&fit=crop', description: 'Mantequilla sin sal', stock: 20, rating: 4.5, soldUnits: 110 },
    { id: 'prod-28', name: 'Mayonesa', price: 2.00, unit: 'bote', category: 'Salsas', image: 'https://images.unsplash.com/photo-1526318896980-cf78c0882476?w=400&h=300&fit=crop', description: 'Mayonesa tradicional', stock: 35, rating: 4.0, soldUnits: 125 },
    { id: 'prod-29', name: 'Mostaza', price: 1.50, unit: 'bote', category: 'Salsas', image: 'https://images.unsplash.com/photo-1562924357228-91a4daadcfea?w=400&h=300&fit=crop', description: 'Mostaza de Dijon', stock: 30, rating: 4.1, soldUnits: 90 },
    { id: 'prod-30', name: 'Vinagre', price: 1.00, unit: 'botella', category: 'Condimentos', image: 'https://images.unsplash.com/photo-1586201375885-4e4c0bf8a9a2?w=400&h=300&fit=crop', description: 'Vinagre de vino', stock: 50, rating: 4.2, soldUnits: 140 }
  ],
  'market-3': [
    { id: 'prod-31', name: 'Pan Francés', price: 0.50, unit: 'unidad', category: 'Panadería', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop', description: 'Pan francés crujiente', stock: 100, rating: 4.6, soldUnits: 280 },
    { id: 'prod-32', name: 'Croissant', price: 1.00, unit: 'unidad', category: 'Panadería', image: 'https://images.unsplash.com/photo-1551024601-b578fddc846c?w=400&h=300&fit=crop', description: 'Croissant de mantequilla', stock: 50, rating: 4.8, soldUnits: 180 },
    { id: 'prod-33', name: 'Pastel de Chocolate', price: 4.00, unit: 'porción', category: 'Pastelería', image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop', description: 'Pastel de chocolate cremoso', stock: 20, rating: 4.9, soldUnits: 95 },
    { id: 'prod-34', name: 'Tarta de Queso', price: 3.50, unit: 'porción', category: 'Pastelería', image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop', description: 'Tarta de queso cremosa', stock: 25, rating: 4.7, soldUnits: 120 },
    { id: 'prod-35', name: 'Donas', price: 1.50, unit: 'unidad', category: 'Pastelería', image: 'https://images.unsplash.com/photo-1551024601-b578fddc846c?w=400&h=300&fit=crop', description: 'Donas glaseadas', stock: 40, rating: 4.4, soldUnits: 150 },
    { id: 'prod-36', name: 'Empanadas', price: 2.00, unit: 'unidad', category: 'Salados', image: 'https://images.unsplash.com/photo-1526966276174-f4a6a8e2e622?w=400&h=300&fit=crop', description: 'Empanadas de carne', stock: 30, rating: 4.5, soldUnits: 110 },
    { id: 'prod-37', name: 'Sandwich Cubano', price: 5.00, unit: 'unidad', category: 'Sandwiches', image: 'https://images.unsplash.com/photo-1528733050080-3de6906784b5?w=400&h=300&fit=crop', description: 'Clásico sandwich cubano', stock: 25, rating: 4.8, soldUnits: 85 },
    { id: 'prod-38', name: 'Café Expreso', price: 1.00, unit: 'taza', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop', description: 'Café expreso cubano', stock: 200, rating: 4.9, soldUnits: 450 },
    { id: 'prod-39', name: 'Jugo Natural', price: 2.00, unit: 'vaso', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1613478329512-c98c6b7adf1a?w=400&h=300&fit=crop', description: 'Jugo de frutas natural', stock: 60, rating: 4.6, soldUnits: 180 },
    { id: 'prod-40', name: 'Ensalada de Frutas', price: 3.00, unit: 'porción', category: 'Postres', image: 'https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?w=400&h=300&fit=crop', description: 'Ensalada de frutas frescas', stock: 20, rating: 4.7, soldUnits: 90 }
  ],
  'market-4': [
    { id: 'prod-41', name: 'Pilas AA', price: 1.00, unit: 'paquete', category: 'Baterías', image: 'https://images.unsplash.com/photo-1609071020552-3a1b8e5c8e01?w=400&h=300&fit=crop', description: 'Pilas AA de alta duración', stock: 100, rating: 4.2, soldUnits: 180 },
    { id: 'prod-42', name: 'Jabón de Manos', price: 1.50, unit: 'unidad', category: 'Aseo', image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400&h=300&fit=crop', description: 'Jabón de manos líquido', stock: 50, rating: 4.3, soldUnits: 120 },
    { id: 'prod-43', name: 'Papel Higiénico', price: 2.00, unit: 'paquete', category: 'Aseo', image: 'https://images.unsplash.com/photo-1586477539036-b8b4346ac259?w=400&h=300&fit=crop', description: 'Papel higiénico suave', stock: 80, rating: 4.1, soldUnits: 200 },
    { id: 'prod-44', name: 'Detergente', price: 5.00, unit: 'bote', category: 'Limpieza', image: 'https://images.unsplash.com/photo-1585233418579-c6fba64d3762?w=400&h=300&fit=crop', description: 'Detergente líquido', stock: 30, rating: 4.4, soldUnits: 85 },
    { id: 'prod-45', name: 'Limpavidrios', price: 3.00, unit: 'botella', category: 'Limpieza', image: 'https://images.unsplash.com/photo-1586477539036-b8b4346ac259?w=400&h=300&fit=crop', description: 'Limpiavidrios efectivo', stock: 40, rating: 4.2, soldUnits: 95 },
    { id: 'prod-46', name: 'Bolsas de Basura', price: 2.50, unit: 'rollo', category: 'Aseo', image: 'https://images.unsplash.com/photo-1578632298002-4ab9230d9d5e?w=400&h=300&fit=crop', description: 'Bolsas de basura resistentes', stock: 60, rating: 4.0, soldUnits: 150 },
    { id: 'prod-47', name: 'Encendedor', price: 0.50, unit: 'unidad', category: 'Accesorios', image: 'https://images.unsplash.com/photo-1609071020552-3a1b8e5c8e01?w=400&h=300&fit=crop', description: 'Encendedor recargable', stock: 100, rating: 3.9, soldUnits: 220 },
    { id: 'prod-48', name: 'Cepillo de Dientes', price: 2.00, unit: 'unidad', category: 'Higiene', image: 'https://images.unsplash.com/photo-1607746886475-3a8aa6b8c1e4?w=400&h=300&fit=crop', description: 'Cepillo de dientes suave', stock: 80, rating: 4.3, soldUnits: 160 },
    { id: 'prod-49', name: 'Pasta Dental', price: 3.00, unit: 'tubo', category: 'Higiene', image: 'https://images.unsplash.com/photo-1607746886475-3a8aa6b8c1e4?w=400&h=300&fit=crop', description: 'Pasta dental mentolada', stock: 50, rating: 4.4, soldUnits: 130 },
    { id: 'prod-50', name: 'Desodorante', price: 4.00, unit: 'unidad', category: 'Higiene', image: 'https://images.unsplash.com/photo-1570638429770-8c004b8c6a1a?w=400&h=300&fit=crop', description: 'Desodorante en spray', stock: 40, rating: 4.1, soldUnits: 110 }
  ],
  'market-5': [
    { id: 'prod-51', name: 'Mangos', price: 2.50, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1553279761-1c850d4175a9?w=400&h=300&fit=crop', description: 'Mangos maduros y jugosos', stock: 60, rating: 4.6, soldUnits: 180 },
    { id: 'prod-52', name: 'Plátanos', price: 1.50, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1546496408-8a6c5b6c9a8f?w=400&h=300&fit=crop', description: 'Plátanos maduros', stock: 80, rating: 4.4, soldUnits: 250 },
    { id: 'prod-53', name: 'Piñas', price: 3.00, unit: 'unidad', category: 'Frutas', image: 'https://images.unsplash.com/photo-1550258987-190a2d41a7ba?w=400&h=300&fit=crop', description: 'Piñas frescas y dulces', stock: 30, rating: 4.7, soldUnits: 90 },
    { id: 'prod-54', name: 'Papayas', price: 2.00, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1603050949138-6e1c5f5d2b8b?w=400&h=300&fit=crop', description: 'Papayas maduras', stock: 40, rating: 4.5, soldUnits: 120 },
    { id: 'prod-55', name: 'Guayabas', price: 1.80, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1585060494927-091bf254f4b2?w=400&h=300&fit=crop', description: 'Guayabas frescas', stock: 50, rating: 4.3, soldUnits: 140 },
    { id: 'prod-56', name: 'Lechuga', price: 1.20, unit: 'unidad', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1525373698958-5281487b9153?w=400&h=300&fit=crop', description: 'Lechuga fresca y crujiente', stock: 30, rating: 4.2, soldUnits: 95 },
    { id: 'prod-57', name: 'Pimientos', price: 2.00, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1587454075732-d3074f2a0d1e?w=400&h=300&fit=crop', description: 'Pimientos verdes y rojos', stock: 40, rating: 4.4, soldUnits: 160 },
    { id: 'prod-58', name: 'Pepinos', price: 1.50, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1581373449156-b4982b2e1c8f?w=400&h=300&fit=crop', description: 'Pepinos frescos', stock: 50, rating: 4.1, soldUnits: 130 },
    { id: 'prod-59', name: 'Berenjenas', price: 2.50, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1590598963695-1d7b2e7c1d8b5?w=400&h=300&fit=crop', description: 'Berenjenas frescas', stock: 25, rating: 4.3, soldUnits: 85 },
    { id: 'prod-60', name: 'Calabazas', price: 1.80, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1610832958506-aa5630c2c305?w=400&h=300&fit=crop', description: 'Calabazas frescas', stock: 35, rating: 4.2, soldUnits: 110 }
  ],

  // Mercados con productos especializados
  'market-6': [
    { id: 'prod-61', name: 'Res de Ternera', price: 18.00, unit: 'kg', category: 'Carnes', image: 'https://images.unsplash.com/photo-1529696366277-f1f6cf9683b1?w=400&h=300&fit=crop', description: 'Res de ternera premium', stock: 25, rating: 4.8, soldUnits: 65 },
    { id: 'prod-62', name: 'Lomo de Cerdo', price: 12.00, unit: 'kg', category: 'Carnes', image: 'https://images.unsplash.com/photo-1604504386827-9218679a1dab2?w=400&h=300&fit=crop', description: 'Lomo de cerdo de alta calidad', stock: 30, rating: 4.6, soldUnits: 85 },
    { id: 'prod-73', name: 'Chuletas de Res', price: 15.00, unit: 'kg', category: 'Carnes', image: 'https://images.unsplash.com/photo-1596794736174-9b428a8b5b5?w=400&h=300&fit=crop', description: 'Chuletas de res jugosa', stock: 40, rating: 4.7, soldUnits: 110 },
    { id: 'prod-74', name: 'Embutidos Caseros', price: 25.00, unit: 'kg', category: 'Embutidos', image: 'https://images.unsplash.com/photo-1444723231855-6f210d6a6d9e?w=400&h=300&fit=crop', description: 'Embutidos caseros artesanales', stock: 20, rating: 4.9, soldUnits: 95 },
    { id: 'prod-75', name: 'Jamón Serrano', price: 35.00, unit: 'kg', category: 'Embutidos', image: 'https://images.unsplash.com/photo-1528733050080-3de6906784b5?w=400&h=300&fit=crop', description: 'Jamón serrano curado', stock: 15, rating: 4.8, soldUnits: 60 }
  ],

  'market-7': [
    { id: 'prod-76', name: 'Pescado Fresco', price: 12.00, unit: 'kg', category: 'Pescado', image: 'https://images.unsplash.com/photo-15197052274986-8754b4b85c5c?w=400&h=300&fit=crop', description: 'Pescado fresco del día', stock: 40, rating: 4.7, soldUnits: 120 },
    { id: 'prod-77', name: 'Langostas', price: 45.00, unit: 'kg', category: 'Mariscos', image: 'https://images.unsplash.com/photo-15197052274986-8754b4b85c5c?w=400&h=300&fit=crop', description: 'Langostas frescas', stock: 20, rating: 4.9, soldUnits: 45 },
    { id: 'prod-78', name: 'Camarones', price: 28.00, unit: 'kg', category: 'Mariscos', image: 'https://images.unsplash.com/photo-1587465908282-6328c5f3451d?w=400&h=300&fit=crop', description: 'Camarones gigantes', stock: 35, rating: 4.6, soldUnits: 90 },
    { id: 'prod-79', name: 'Pulpo', price: 22.00, unit: 'kg', category: 'Mariscos', image: 'https://images.unsplash.com/photo-1571096860925-b8756c5f6a1f?w=400&h=300&fit=crop', description: 'Pulpo fresco', stock: 15, rating: 4.5, soldUnits: 40 }
  ],

  'market-8': [
    { id: 'prod-80', name: 'Yogurt Griego', price: 2.50, unit: 'unidad', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&h=300&fit=crop', description: 'Yogurt griego natural', stock: 45, rating: 4.4, soldUnits: 130 },
    { id: 'prod-81', name: 'Queso Parmesano', price: 25.00, unit: 'kg', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1483695028939-b9c5dea506d1?w=400&h=300&fit=crop', description: 'Queso parmesano italiano', stock: 10, rating: 4.9, soldUnits: 35 },
    { id: 'prod-82', name: 'Aceite de Oliva', price: 8.00, unit: 'L', category: 'Aceites', image: 'https://images.unsplash.com/photo-1474981254655-4e0b8e2e2e6f?w=400&h=300&fit=crop', description: 'Aceite de oliva extra virgen', stock: 25, rating: 4.7, soldUnits: 70 }
  ],

  'market-9': [
    { id: 'prod-83', name: 'Chocolates Suizos', price: 8.00, unit: 'tableta', category: 'Chocolates', image: 'https://images.unsplash.com/photo-1547036967-23911e578a25?w=400&h=300&fit=crop', description: 'Chocolates suizos importados', stock: 30, rating: 4.8, soldUnits: 85 },
    {id: 'prod-84', name: 'Trufas', price: 25.00, unit: 'caja', category: 'Postres', image: 'https://images.unsplash.com/photo-1571062633671-8e8c24726378?w=400&h=300&fit=crop', description: 'Trufas negras premium', stock: 8, rating: 4.9, soldUnits: 25 },
    { id: 'prod-85', name: 'Bombones', price: 12.00, unit: 'caja', category: 'Dulces', image: 'https://images.unsplash.com/photo-1547036967-23911e578a25?w=400&h=300&fit=crop', description: 'Bombones assorted', stock: 20, rating: 4.5, soldUnits: 45 }
  ],

  'market-10': [
    { id: 'prod-86', name: 'Vino Tinto', price: 15.00, unit: 'botella', category: 'Vinos', image: 'https://images.unsplash.com/photo-1566431044055-4de4a4e1dbb1?w=400&h=300&fit=crop', description: 'Vino tinto chileno', stock: 50, rating: 4.6, soldUnits: 120 },
    { id: 'prod-87', name: 'Champagne', price: 45.00, unit: 'botella', category: 'Vinos', image: 'https://images.unsplash.com/photo-153692495267-f0c9f733d9d2?w=400&h=300&fit=crop', description: 'Champagne francés', stock: 15, rating: 4.9, soldUnits: 40 },
    { id: 'prod-88', name: 'Ron Cubano', price: 35.00, unit: 'botella', category: 'Licores', image: 'https://images.unsplash.com/photo-1544145747-2b40b6f0e6e2?w=400&h=300&fit=crop', description: 'Ron cubano añejo', stock: 40, rating: 4.8, soldUnits: 110 }
  ],

  'market-11': [
    { id: 'prod-89', name: 'Café Cubano', price: 6.00, unit: 'kg', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop', description: 'Café cubano tostado', stock: 35, rating: 4.7, soldUnits: 95 },
    { id: 'prod-90', name: 'Tabacos Cubanos', price: 8.00, unit: 'paquete', category: 'Tabaco', image: 'https://images.unsplash.com/photo-15232954987-1d8f5782b3f3?w=400&h=300&fit=crop', description: 'Puros cubanos de calidad', stock: 50, rating: 4.5, soldUnits: 150 },
    { id: 'prod-91', name: 'Artesanías', price: 15.00, unit: 'pieza', category: 'Artesanías', image: 'https://images.unsplash.com/photo-15869502848252-7b983e2af619?w=400&h=300&fit=crop', description: 'Artesanías locales', stock: 25, rating: 4.6, soldUnits: 70 }
  ],

  'market-12': [
    { id: 'prod-92', name: 'Aspirina', price: 2.50, unit: 'caja', category: 'Medicamentos', image: 'https://images.unsplash.com/photo-1574159023283-1d0b6283b715?w=400&h=300&fit=crop', description: 'Aspirina 100mg', stock: 100, rating: 4.2, soldUnits: 250 },
    { id: 'prod-93', name: 'Vitamina C', price: 3.50, unit: 'frasco', category: 'Suplementos', image: 'https://images.unsplash.com/photo-1571019288782-2e9a609b6c4?w=400&h=300&fit=crop', description: 'Vitamina C con bioflavonoides', stock: 60, rating: 4.4, soldUnits: 140 },
    { id: 'prod-94', name: 'Protector Solar', price: 12.00, unit: 'tubo', category: 'Protección', image: 'https://images.unsplash.com/photo-1556229357-3a1b8e2e2f6?w=400&h=300&fit=crop', description: 'Protector solar FPS 50+', stock: 40, rating: 4.1, soldUnits: 80 }
  ],

  'market-13': [
    { id: 'prod-95', name: 'Arroz Blanco', price: 2.20, unit: 'kg', category: 'Granos', image: 'https://images.unsplash.com/photo-1586201375885-4e4c0bf8a9a2?w=400&h=300&fit=crop', description: 'Arroz blanco de calidad', stock: 120, rating: 4.0, soldUnits: 300 },
    { id: 'prod-96', name: 'Frijoles Negros', price: 1.80, unit: 'kg', category: 'Legumbres', image: 'https://images.unsplash.com/photo-1506252865395-425714641578?w=400&h=300&fit=crop', description: 'Frijoles negros cubanos', stock: 90, rating: 4.1, soldUnits: 220 },
    { id: 'prod-97', name: 'Atún en Lata', price: 2.00, unit: 'lata', category: 'Conservas', image: 'https://images.unsplash.com/photo-1586201375885-4e4c0bf8a9a2?w=400&h=300&fit=crop', description: 'Atún en aceite', stock: 150, rating: 4.3, soldUnits: 350 }
  ],

  'market-14': [
    { id: 'prod-98', name: 'Pollo Frito', price: 4.50, unit: 'porción', category: 'Comida Rápida', image: 'https://images.unsplash.com/photo-1562924800-113a6e0e9e7a0?w=400&h=300&fit=crop', description: 'Pollo frito crujiente', stock: 80, rating: 4.4, soldUnits: 200 },
    { id: 'prod-99', name: 'Papas Fritas', price: 3.00, unit: 'porción', category: 'Comida Rápida', image: 'https://images.unsplash.com/photo-1518707223778-6407556b7152?w=400&h=300&fit=crop', description: 'Papas fritas con salsa', stock: 100, rating: 4.2, soldUnits: 180 },
    { id: 'prod-100', name: 'Ensalada Mixta', price: 5.00, unit: 'unidad', category: 'Comida Rápida', image: 'https://images.unsplash.com/photo-1512629969777-5e6ac4f3451a?w=400&h=300&fit=crop', description: 'Ensalada fresca mixta', stock: 60, rating: 4.5, soldUnits: 120 }
  ],

  'market-15': [
    { id: 'prod-101', name: 'Paella Marinera', price: 12.00, unit: 'porción', category: 'Restaurant', image: 'https://images.unsplash.com/photo-1556769755-0a7438c8e6db?w=400&h=300&fit=capor', description: 'Paella marinera tradicional', stock: 20, rating: 4.8, soldUnits: 50 },
    { id: 'prod-102', name: 'Ceviche', price: 8.00, unit: 'plato', category: 'Mariscos', image: 'https://images.unsplash.com/photo-15197052274986-8754b4b85c5c?w=400&h=300&fit=crop', description: 'Ceviche fresco', stock: 30, rating: 4.7, soldUnits: 70 },
    { id: 'prod-103', name: 'Pescado a la Plancha', price: 15.00, unit: 'porción', category: 'Restaurant', image: 'https://images.unsplash.com/photo-15197052274986-8754b4b85c5c?w=400&h=300&fit=crop', description: 'Pescado a la plancha', stock: 25, rating: 4.6, soldUnits: 60 }
  ],

  'market-16': [
    { id: 'prod-104', name: 'Bebé', price: 1.20, unit: 'lata', category: 'Comestibles', image: 'https://images.unsplash.com/photo-1505210456-5768-bf8536e0f4a?w=400&h=300&fit=crop', description: 'Leche en polvo', stock: 80, rating: 4.3, soldUnits: 180 },
    { id: 'prod-105', name: 'Galletas', price: 1.00, unit: 'paquete', category: 'Snacks', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop', description: 'Galletas variadas', stock: 60, rating: 4.1, soldUnits: 140 },
    { id: 'prod-106', name: 'Pan', price: 0.60, unit: 'unidad', category: 'Panadería', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop', description: 'Pan fresco', stock: 40, rating: 4.2, soldUnits: 120 }
  ],

  'market-17': [
    { id: 'prod-107', name: 'Queso Campesino', price: 7.00, unit: 'kg', category: 'Lácteos', image: 'https://images.unsplash.com/photo-1483695028939-b9c5dea506d1?w=400&h=300&fit=crop', description: 'Queso artesanal', stock: 35, rating: 4.5, soldUnits: 85 },
    { id: 'prod-108', name: 'Jugos Naturales', price: 3.00, unit: 'litro', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1613478329512-c98c6b7adf1a?w=400&h=300&fit=crop', description: 'Jugo de naranja fresco', stock: 45, rating: 4.6, soldUnits: 135 },
    { id: 'prod-109', name: 'Ensaladas', price: 4.00, unit: 'unidad', category: 'Comida Saludable', image: 'https://images.unsplash.com/photo-1512629129777-5e6ac4f3451a?w=400&h=300&fit=crop', description: 'Ensaladas variadas', stock: 35, rating: 4.4, soldUnits: 100 }
  ],

  'market-18': [
    { id: 'prod-110', name: 'Tomates Orgánicos', price: 2.80, unit: 'kg', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400&h=300&fit=crop', description: 'Tomates orgánicos', stock: 70, rating: 4.5, soldUnits: 160 },
    { id: 'prod-111', name: 'Lechuga Orgánica', price: 1.80, unit: 'unidad', category: 'Vegetales', image: 'https://images.unsplash.com/photo-1525373698958-5281487b9153?w=400&h=300&fit=crop', description: 'Lechuga orgánica', stock: 50, rating: 4.6, soldUnits: 120 },
    { id: 'prod-112', name: 'Frutas Locales', price: 3.50, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop', description: 'Frutas locales', stock: 40, rating: 4.7, soldUnits: 110 }
  ],

  'market-19': [
    { id: 'prod-113', name: 'Camisa', price: 25.00, unit: 'unidad', category: 'Ropa', image: 'https://images.unsplash.com/photo-15217375137890-ba9e2f3d8a0?w=400&h=300&fit=crop', description: 'Camisa de algodón', stock: 30, rating: 4.2, soldUnits: 45 },
    {id: 'prod-114', name: 'Jeans', price: 35.00, unit: 'par', category: 'Ropa', image: 'https://images.unsplash.com/photo-1541099648205-6b8214f6c635?w=400&h=300&fit=crop', description: 'Jeans denim', stock: 25, rating: 4.4, soldUnits: 40 },
    { id: 'prod-115', name: 'Bolso', price: 45.00, unit: 'unidad', category: 'Accesorios', image: 'https://images.unsplash.com/photo-1558678090880-fb4d791dab7?w=400&h=300&fit=crop', description: 'Bolso de cuero', stock: 15, rating: 4.6, soldUnits: 25 }
  ],

  'market-20': [
    { id: 'prod-116', name: 'Vinos Importados', price: 20.00, unit: 'botella', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1566431044055-4de4a4e1dbb1?w=400&h=300&fit=crop', description: 'Vinos importados', stock: 40, rating: 4.5, soldUnits: 80 },
    { id: 'prod-117', name: 'Snacks Premium', price: 8.00, unit: 'paquete', category: 'Snacks', image: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400&h=300&fit=crop', description: 'Snacks gourmet', stock: 60, rating: 4.3, soldUnits: 140 },
    { id: 'prod-118', name: 'Bebidas Energéticas', price: 3.00, unit: 'lata', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1596112770777-9600bc7a7b97?w=400&h=300&fit=crop', description: 'Bebidas energéticas', stock: 80, rating: 4.1, soldUnits: 200 }
  ],

  'market-21': [
    { id: 'prod-119', name: 'Souvenirs', price: 12.00, unit: 'pieza', category: 'Souvenirs', image: 'https://images.unsplash.com/photo-1547036967-23911e578a25?w=400&h=300&fit=crop', description: 'Souvenirs cubanos', stock: 50, rating: 4.3, soldUnits: 100 },
    { id: 'prod-120', name: 'Artesanías', price: 18.00, unit: 'pieza', category: 'Artesanías', image: 'https://images.unsplash.com/photo-1586950284825-2e9a609b6c4?w=400&h=300&fit=crop', description: 'Artesanías locales', stock: 30, rating: 4.6, soldUnits: 75 }
  ],

  'market-22': [
    { id: 'prod-121', name: 'Perfume Importado', price: 50.00, unit: 'botella', category: 'Lujo', image: 'https://images.unsplash.com/photo-1549556558-8749b08762d2?w=400&h=300&fit=crop', description: 'Perfume importado', stock: 20, rating: 4.8, soldUnits: 35 },
    { id: 'prod-122', name: 'Joyería', price: 75.00, unit: 'pieza', category: 'Lujo', image: 'https://images.unsplash.com/photo-1511384629268-8791744b824ab?w=400&h=300&fit=crop', description: 'Joyería fina', stock: 15, rating: 4.9, soldUnits: 25 }
  ],

  'market-23': [
    { id: 'prod-123', name: 'Comestibles', price: 4.50, unit: 'kg', category: 'Comestibles', image: 'https://images.unsplash.com/photo-1523176934942-7279b6e1a2a8?w=400&h=300&fit=crop', description: 'Comestibles variados', stock: 80, rating: 4.1, soldUnits: 180 },
    { id: 'prod-124', name: 'Frutas Tropicales', price: 3.50, unit: 'kg', category: 'Frutas', image: 'https://images.unsplash.com/photo-1544178194772-cd828df8f2f0a?w=400&h=300&fit=crop', description: 'Frutas tropicales', stock: 60, rating: 4.5, soldUnits: 150 }
  ],

  'market-24': [
    { id: 'prod-125', name: 'Tecnología', price: 15.00, unit: 'unidad', category: 'Electrónica', image: 'https://images.unsplash.com/photo-1566431044055-4de4a4e1dbb1?w=400&h=300&fit=crop', description: 'Dispositivos electrónicos', stock: 25, rating: 4.4, soldUnits: 65 },
    { id: 'prod-126', name: 'Libros', price: 12.00, unit: 'unidad', category: 'Libros', image: 'https://images.unsplash.com/photo-1507003216691-54d8e4b6b6d8?w=400&h=300&fit=crop', description: 'Libros varios', stock: 40, rating: 4.3, soldUnits: 95 }
  ],

  'market-25': [
    { id: 'prod-127', name: 'Café Especial', price: 4.00, unit: 'taza', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop', description: 'Café especial', stock: 80, rating: 4.7, soldUnits: 200 },
    { id: 'prod-128', name: 'Artesanías Locales', price: 15.00, unit: 'pieza', category: 'Artesanías', image: 'https://images.unsplash.com/photo-1586950284825-2e9a609b6c4?w=400&h=300&fit=crop', description: 'Artesanías locales', stock: 35, rating: 4.6, soldUnits: 85 }
  ],

  'market-26': [
    { id: 'prod-129', name: 'Artículos Escolares', price: 8.00, unit: 'unidad', category: 'Escolar', image: 'https://images.unsplash.com/photo-1507003216691-54d8e4b6b6d8?w=400&h=300&fit=crop', description: 'Artículos escolares', stock: 60, rating: 4.2, soldUnits: 120 },
    { id: 'prod-130', name: 'Libros Texto', price: 10.00, unit: 'unidad', category: 'Libros', image: 'https://images.unsplash.com/photo-1507003216691-54d8e4b6b6d8?w=400&h=300&fit=crop', description: 'Libros de texto', stock: 80, rating: 4.3, soldUnits: 150 }
  ],

  'market-27': [
    { id: 'prod-131', name: 'Juego de Destornilladores', price: 25.00, unit: 'set', category: 'Herramientas', image: 'https://images.unsplash.com/photo-1566491044055-4de4a4e1dbb1?w=400&h=300&fit=crop', description: 'Set completo de destornilladores', stock: 30, rating: 4.5, soldUnits: 65 },
    { id: 'prod-132', name: 'Taladro Eléctrico', price: 35.00, unit: 'unidad', category: 'Herramientas', image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop', description: 'Taladro eléctrico con accesorios', stock: 15, rating: 4.6, soldUnits: 25 },
    { id: 'prod-133', name: 'Caja de Herramientas', price: 45.00, unit: 'unidad', category: 'Herramientas', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop', description: 'Caja de herramientas plástica', stock: 20, rating: 4.2, soldUnits: 40 }
  ],

  'market-28': [
    { id: 'prod-134', name: 'Arroz', price: 2.00, unit: 'kg', category: 'Abarrotes', image: 'https://images.unsplash.com/photo-1586201375885-4e4c0bf8a9a2?w=400&h=300&fit=crop', description: 'Arroz blanco', stock: 150, rating: 4.0, soldUnits: 400 },
    { id: 'prod-135', name: 'Abarrotes', price: 1.80, unit: 'kg', category: 'Abarrotes', image: 'https://images.unsplash.com/photo-1596112770777-9600bc7a7b97?w=400&h=300&fit=crop', description: 'Abarrotes básicos', stock: 200, rating: 4.2, soldUnits: 350 },
    { id: 'prod-136', name: 'Bebidas', price: 2.50, unit: 'unidad', category: 'Bebidas', image: 'https://images.unsplash.com/photo-1527960670769-f60e49c6b564?w=400&h=300&fit=crop', description: 'Bebidas varias', stock: 120, rating: 4.1, soldUnits: 280 },
    { id: 'prod-137', name: 'Snacks', price: 3.00, unit: 'paquete', category: 'Snacks', image: 'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=400&h=300&fit=crop', description: 'Snacks variados', stock: 80, rating: 4.3, soldUnits: 160 },
    { id: 'prod-138', name: 'Limpieza', price: 5.00, unit: 'unidad', category: 'Aseo', image: 'https://images.unsplash.com/photo-1585233418579-c6fba64d3762?w=400&h=300&fit=crop', description: 'Productos de limpieza', stock: 40, rating: 4.1, soldUnits: 110 }
  ]
}

interface Product {
  id: string
  name: string
  price: number
  unit: string
  category: string
  image: string
  description: string
  stock: number
  rating: number
  soldUnits: number
  imageNeedsUpdate?: boolean // Para controlar si la imagen necesita ser actualizada por Unsplash
}

interface Market {
  id: string
  name: string
  address: string
  province: string
  municipality: string
  coordinates: { lat: number; lng: number }
  rating: number
  deliveryTime: string
  deliveryCost: number
  image: string
  categories: string[]
  schedule: string
  phone: string
  description: string
}

interface CartItem extends Product {
  quantity: number
  marketId: string
  marketName: string
  marketAddress: string
}

interface CustomerInfo {
  name: string
  phone: string
  address: string
  email: string
  notes: string
}

interface RecargaOrder {
  id: string
  date: string
  customerName: string
  customerPhone: string
  amount: number
  carrier: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  notes?: string
}

interface RemesaOrder {
  id: string
  date: string
  senderName: string
  senderPhone: string
  recipientName: string
  recipientPhone: string
  amount: number
  currency: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
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

type Step = 'location' | 'markets' | 'shopping' | 'checkout' | 'success'

// Mock data para órdenes
const MOCK_ORDERS: Order[] = []

const MOCK_RECARGA_ORDERS: RecargaOrder[] = []

const MOCK_REMESA_ORDERS: RemesaOrder[] = []

export default function MarketplacePage() {
  const { theme } = useTheme()

  // Estado principal
  const [currentStep, setCurrentStep] = useState<Step>('location')
  const [selectedProvince, setSelectedProvince] = useState<string>('')
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('')
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [showCart, setShowCart] = useState(false)
  const [cartAnimation, setCartAnimation] = useState<string | null>(null)
  const [notification, setNotification] = useState<{show: boolean, message: string}>({show: false, message: ''})
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS)
  const [recargaOrders, setRecargaOrders] = useState<RecargaOrder[]>(MOCK_RECARGA_ORDERS)
  const [remesaOrders, setRemesaOrders] = useState<RemesaOrder[]>(MOCK_REMESA_ORDERS)
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [showUnifiedOrders, setShowUnifiedOrders] = useState(false)
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    address: '',
    email: '',
    notes: ''
  })
  const [searchMarket, setSearchMarket] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedCategory, setSelectedCategory] = useState<string>('todos')
  const [searchProduct, setSearchProduct] = useState('')

  // Estado para mercados dinámicos
  const [markets, setMarkets] = useState(MOCK_MARKETS)
  const [loadingMarkets, setLoadingMarkets] = useState(false)

  // Estado para imágenes de Unsplash
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set())
  const [productsWithDynamicImages, setProductsWithDynamicImages] = useState<Map<string, string>>(new Map())
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  // Cargar mercados desde la API
  useEffect(() => {
    if (selectedProvince && selectedMunicipality) {
      loadMarkets()
    }
  }, [selectedProvince, selectedMunicipality])

  // Cargar imágenes de productos cuando se selecciona un mercado
  useEffect(() => {
    if (selectedMarket) {
      // Limpiar caché anterior cuando se selecciona un nuevo mercado
      setProductsWithDynamicImages(new Map())
      setLoadingImages(new Set())
      setInitialLoadComplete(false)

      const products = MOCK_PRODUCTS[selectedMarket.id as keyof typeof MOCK_PRODUCTS] || []

      // Forzar carga inmediata de imágenes
      loadMarketProductImages(products).then(() => {
        setInitialLoadComplete(true)
      })

      // También cargar imágenes individuales para asegurar que se carguen todas
      products.forEach((product, index) => {
        setTimeout(() => {
          loadProductImage(product).then(() => {
            // Marcar como completado cuando todas las imágenes se hayan cargado
            if (index === products.length - 1) {
              setTimeout(() => setInitialLoadComplete(true), 1000)
            }
          })
        }, index * 200) // Escalonar cargas para no sobrecargar la API
      })
    }
  }, [selectedMarket])

  const loadMarkets = async () => {
    setLoadingMarkets(true)
    try {
      const response = await fetch(`/api/admin/marketplaces?province=${selectedProvince}&municipality=${selectedMunicipality}&type=marketplace`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data.length > 0) {
          setMarkets(data.data)
        } else {
          // Si no hay mercados dinámicos, usar los datos mock
          setMarkets(MOCK_MARKETS.filter(market =>
            market.province === selectedProvince && market.municipality === selectedMunicipality
          ))
        }
      } else {
        // Si hay error, usar los datos mock
        setMarkets(MOCK_MARKETS.filter(market =>
          market.province === selectedProvince && market.municipality === selectedMunicipality
        ))
      }
    } catch (error) {
      console.error('Error loading markets:', error)
      // Si hay error, usar los datos mock
      setMarkets(MOCK_MARKETS.filter(market =>
        market.province === selectedProvince && market.municipality === selectedMunicipality
      ))
    } finally {
      setLoadingMarkets(false)
    }
  }

  // Funciones para manejar imágenes de Unsplash
  const loadProductImage = async (product: Product): Promise<string> => {
    // Si ya tenemos una imagen dinámica para este producto, retornarla
    if (productsWithDynamicImages.has(product.id)) {
      return productsWithDynamicImages.get(product.id)!
    }

    // Si ya estamos cargando esta imagen, esperar y retornar la actual
    if (loadingImages.has(product.id)) {
      return product.image
    }

    // Marcar como cargando
    setLoadingImages(prev => new Set(prev).add(product.id))

    try {
      const imageUrl = await UnsplashAPI.searchProductImage(
        product.name,
        product.description,
        product.category
      )

      // Guardar la imagen dinámica
      setProductsWithDynamicImages(prev => new Map(prev).set(product.id, imageUrl))

      return imageUrl
    } catch (error) {
      console.error(`Error loading image for product ${product.name}:`, error)
      return product.image
    } finally {
      // Dejar de marcar como cargando
      setLoadingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(product.id)
        return newSet
      })
    }
  }

  const loadMarketProductImages = async (products: Product[]) => {
    // Cargar imágenes para los productos que no tienen imagen dinámica
    const productsToLoad = products.filter(p => !productsWithDynamicImages.has(p.id) && !loadingImages.has(p.id))

    if (productsToLoad.length === 0) return

    // Cargar en lotes para no sobrecargar la API
    const batchSize = 3
    for (let i = 0; i < productsToLoad.length; i += batchSize) {
      const batch = productsToLoad.slice(i, i + batchSize)

      await Promise.all(
        batch.map(product => loadProductImage(product))
      )

      // Pequeña pausa entre lotes
      if (i + batchSize < productsToLoad.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  // Obtener imagen actual de un producto (dinámica o placeholder)
  const getProductImage = (product: Product): string => {
    const dynamicImage = productsWithDynamicImages.get(product.id)

    // Si tenemos imagen dinámica, usarla
    if (dynamicImage) {
      return dynamicImage
    }

    // Si la carga inicial no está completa y no hay imagen dinámica, usar placeholder
    if (!initialLoadComplete) {
      return `https://picsum.photos/seed/${product.name.replace(/\s+/g, '-')}-loading/400/300.jpg`
    }

    // Si ya se completó la carga pero no hay imagen dinámica, usar fallback específico
    return `https://picsum.photos/seed/${product.name.replace(/\s+/g, '-')}-fallback/400/300.jpg`
  }

  // Filtrado de mercados
  const getFilteredMarkets = () => {
    if (!selectedProvince || !selectedMunicipality) return []

    return markets.filter(market => {
      const matchesLocation = market.province === selectedProvince &&
                              market.municipality === selectedMunicipality
      const matchesSearch = market.name.toLowerCase().includes(searchMarket.toLowerCase()) ||
                           market.description.toLowerCase().includes(searchMarket.toLowerCase())
      return matchesLocation && matchesSearch
    })
  }

  // Obtener productos del mercado seleccionado
  const getMarketProducts = () => {
    if (!selectedMarket) return []

    const products = MOCK_PRODUCTS[selectedMarket.id as keyof typeof MOCK_PRODUCTS] || []

    return products.filter(product => {
      const matchesCategory = selectedCategory === 'todos' || product.category === selectedCategory
      const matchesSearch = product.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
                           product.description.toLowerCase().includes(searchProduct.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }

  // Calcular total del carrito
  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0)
  }

  // Agregar al carrito
  const addToCart = (product: Product) => {
    // Activar animación del botón
    setCartAnimation(product.id)

    // Activar animación de carrito flotante
    const cartIcon = document.querySelector('.cart-icon-main')
    if (cartIcon) {
      cartIcon.classList.add('animate-bounce')
      setTimeout(() => cartIcon.classList.remove('animate-bounce'), 1000)
    }

    // Mostrar notificación
    setNotification({ show: true, message: `${product.name} agregado al carrito` })
    setTimeout(() => setNotification({ show: false, message: '' }), 2000)

    setTimeout(() => setCartAnimation(null), 600)

    const existingItem = cart.find(item => item.id === product.id)

    if (existingItem) {
      setCart(cart.map(item =>
        item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, {
        ...product,
        quantity: 1,
        marketId: selectedMarket!.id,
        marketName: selectedMarket!.name,
        marketAddress: selectedMarket!.address
      }])
    }
  }

  // Actualizar cantidad
  const updateQuantity = (id: string, quantity: number) => {
    if (quantity === 0) {
      setCart(cart.filter(item => item.id !== id))
    } else {
      setCart(cart.map(item =>
        item.id === id ? { ...item, quantity } : item
      ))
    }
  }

  // Vaciar carrito
  const clearCart = () => {
    setCart([])
  }

  // Imprimir ticket
  const printTicket = async () => {
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
      marketName: selectedMarket!.name,
      marketAddress: selectedMarket!.address,
      items: cart.map(item => ({
        productName: item.name,
        quantity: item.quantity,
        price: item.price,
        unit: item.unit
      })),
      total: getTotalAmount(),
      status: 'pending',
      deliveryTime: selectedMarket!.deliveryTime,
      notes: customerInfo.notes
    }

    setOrders([newOrder, ...orders])

    // Guardar orden en la base de datos
    try {
      const orderResponse = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'marketplace',
          customerName: customerInfo.name,
          customerPhone: customerInfo.phone,
          customerAddress: customerInfo.address,
          amount: getTotalAmount(),
          details: {
            marketName: selectedMarket!.name,
            marketAddress: selectedMarket!.address,
            items: cart.map(item => ({
              productName: item.name,
              quantity: item.quantity,
              price: item.price
            }))
          },
          notes: customerInfo.notes,
          agencyId: 'agency-1' // En producción vendría del usuario autenticado
        })
      })

      if (orderResponse.ok) {
        const data = await orderResponse.json()
        console.log('Orden guardada en BD:', data)
      } else {
        console.error('Error guardando orden:', await orderResponse.text())
      }
    } catch (error) {
      console.error('Error guardando orden:', error)
    }

    const printContent = `
      <div style="font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
          <h2 style="margin: 0; font-size: 18px; font-weight: bold;">CUBARAPID</h2>
          <p style="margin: 5px 0; font-size: 10px;">Servicio de Entrega a Domicilio</p>
        </div>

        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Orden:</strong> #${orderId}</p>
          <p style="margin: 5px 0;"><strong>Fecha:</strong> ${currentDate}</p>
          <p style="margin: 5px 0;"><strong>Cliente:</strong> ${customerInfo.name}</p>
          <p style="margin: 5px 0;"><strong>Teléfono:</strong> ${customerInfo.phone}</p>
          <p style="margin: 5px 0;"><strong>Dirección:</strong> ${customerInfo.address}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <h3 style="margin: 5px 0; border-bottom: 1px solid #000; padding-bottom: 5px;">Mercado</h3>
          <p style="margin: 5px 0;"><strong>${selectedMarket!.name}</strong></p>
          <p style="margin: 5px 0; font-size: 10px;">${selectedMarket!.address}</p>
        </div>

        <div style="margin-bottom: 15px;">
          <h3 style="margin: 5px 0; border-bottom: 1px solid #000; padding-bottom: 5px;">Productos</h3>
          ${cart.map(item => `
            <div style="margin: 5px 0;">
              <span>${item.quantity} ${item.unit} - ${item.name}</span>
              <span style="float: right;">$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>

        <div style="margin-bottom: 15px;">
          <div style="border-top: 1px solid #000; padding-top: 5px;">
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
              <strong>Subtotal:</strong>
              <span>$${getTotalAmount().toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 5px 0;">
              <strong>Envío:</strong>
              <span>$${selectedMarket!.deliveryCost.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px;">
              <strong>Total:</strong>
              <span>$${(getTotalAmount() + selectedMarket!.deliveryCost).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div style="text-align: center; border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px;">
          <p style="margin: 5px 0; font-size: 10px;"><strong>Tiempo de entrega:</strong> ${selectedMarket!.deliveryTime}</p>
          <p style="margin: 5px 0; font-size: 10px;"><strong>Teléfono contacto:</strong> ${selectedMarket!.phone}</p>
          <p style="margin: 10px 0; font-size: 9px; color: #666;">¡Gracias por su compra!</p>
        </div>

        ${customerInfo.notes ? `
          <div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-left: 3px solid #000;">
            <h4 style="margin: 0 0 5px 0; font-size: 11px;">Notas:</h4>
            <p style="margin: 0; font-size: 10px;">${customerInfo.notes}</p>
          </div>
        ` : ''}
      </div>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket de Compra - CUBARAPID</title>
            <style>
              body { margin: 0; padding: 20px; font-family: monospace; }
              @media print { body { margin: 0; } }
            </style>
          </head>
          <body>${printContent}</body>
        </html>
      `)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()
    }
  }

  // Renderizado de steps
  const renderLocationStep = () => {
    const selectedProvinceData = CUBA_PROVINCES.find(p => p.id === selectedProvince)

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl p-8",
          theme === 'dark' ? "bg-gray-800" : "bg-white shadow-lg"
        )}
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
              theme === 'dark' ? "bg-exa-secondary/20" : "bg-exa-primary/10"
            )}
          >
            <MapPin className={cn(
              "w-10 h-10",
              theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
            )} />
          </motion.div>
          <h2 className={cn(
            "text-3xl font-bold mb-4",
            theme === 'dark' ? "text-white" : "text-gray-900"
          )}>
            ¿Dónde quieres recibir tu pedido?
          </h2>
          <p className={cn(
            "text-lg",
            theme === 'dark' ? "text-gray-300" : "text-gray-600"
          )}>
            Selecciona tu provincia y municipio para mostrarte los mercados disponibles
          </p>
        </div>

        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <label className={cn(
              "block text-sm font-medium mb-3",
              theme === 'dark' ? "text-gray-200" : "text-gray-700"
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
                "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white focus:border-exa-secondary"
                  : "bg-gray-50 border-gray-200 text-gray-900 focus:border-exa-primary"
              )}
            >
              <option value="">Selecciona una provincia</option>
              {CUBA_PROVINCES.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProvince && selectedProvinceData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <label className={cn(
                "block text-sm font-medium mb-3",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Municipio
              </label>
              <select
                value={selectedMunicipality}
                onChange={(e) => setSelectedMunicipality(e.target.value)}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 focus:border-exa-primary"
                )}
              >
                <option value="">Selecciona un municipio</option>
                {selectedProvinceData.municipalities.map((municipality) => (
                  <option key={municipality.id} value={municipality.id}>
                    {municipality.name}
                  </option>
                ))}
              </select>
            </motion.div>
          )}

          {selectedProvince && selectedMunicipality && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <Button
                onClick={() => setCurrentStep('markets')}
                className="px-8 py-4 text-lg font-medium"
              >
                Ver Mercados Disponibles
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          )}
        </div>
      </motion.div>
    )
  }

  const renderMarketsStep = () => {
    const filteredMarkets = getFilteredMarkets()

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl p-8",
          theme === 'dark' ? "bg-gray-800" : "bg-white shadow-lg"
        )}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className={cn(
              "text-3xl font-bold mb-2",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Mercados Disponibles
            </h2>
            <p className={cn(
              "text-lg",
              theme === 'dark' ? "text-gray-300" : "text-gray-600"
            )}>
              {selectedProvince && selectedMunicipality &&
                `${CUBA_PROVINCES.find(p => p.id === selectedProvince)?.name} - ${CUBA_PROVINCES.find(p => p.id === selectedProvince)?.municipalities.find(m => m.id === selectedMunicipality)?.name}`
              }
            </p>
          </div>

          <div className="flex gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar mercados..."
                value={searchMarket}
                onChange={(e) => setSearchMarket(e.target.value)}
                className={cn(
                  "pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-200 w-64",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
              />
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentStep('location')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Cambiar Ubicación
            </Button>
          </div>
        </div>

        {filteredMarkets.length === 0 ? (
          <div className="text-center py-16">
            <Store className={cn(
              "w-20 h-20 mx-auto mb-6",
              theme === 'dark' ? "text-gray-600" : "text-gray-300"
            )} />
            <h3 className={cn(
              "text-xl font-semibold mb-3",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              No se encontraron mercados
            </h3>
            <p className={cn(
              "text-lg",
              theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              Intenta cambiando tu ubicación o ajustando la búsqueda
            </p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredMarkets.map((market, index) => (
              <motion.div
                key={market.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "border-2 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-xl",
                  theme === 'dark'
                    ? "border-gray-700 bg-gray-700/50 hover:border-exa-secondary"
                    : "border-gray-200 bg-white hover:border-exa-primary hover:shadow-lg"
                )}
                onClick={() => {
                  setSelectedMarket(market)
                  setCurrentStep('shopping')
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className={cn(
                      "text-xl font-bold mb-2",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {market.name}
                    </h3>
                    <p className={cn(
                      "text-sm mb-2",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      {market.address}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      "text-xs font-medium",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      ESPECIALIZACIÓN:
                    </span>
                    <div className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      theme === 'dark' ? "bg-exa-secondary/20 text-exa-secondary border border-exa-secondary/30" : "bg-exa-primary/10 text-exa-primary border border-exa-primary/30"
                    )}>
                      {market.categories[0]}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {market.categories.slice(1).map((category, index) => (
                      <span
                        key={index}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className={cn(
                      "text-sm font-medium",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      {market.rating}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-600"
                    )}>
                      {market.deliveryTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-green-500" />
                    <span className={cn(
                      "text-sm",
                      theme === 'dark' ? "text-gray-300" : "text-gray-600"
                    )}>
                      {market.phone}
                    </span>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className={cn(
                    "text-sm mb-3",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    {market.description}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className={cn(
                      "text-sm font-medium",
                      theme === 'dark' ? "text-gray-300" : "text-gray-600"
                    )}>
                      Envío: ${market.deliveryCost.toFixed(2)}
                    </span>
                    <ChevronRight className={cn(
                      "w-5 h-5",
                      theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                    )} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    )
  }

  const renderShoppingStep = () => {
    const products = getMarketProducts()
    const categories = ['todos', ...Array.from(new Set(products.map(p => p.category)))]

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className={cn(
          "rounded-2xl p-6",
          theme === 'dark' ? "bg-gray-800" : "bg-white shadow-lg"
        )}>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className={cn(
                "text-3xl font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {selectedMarket?.name}
              </h2>
              <p className={cn(
                "text-lg",
                theme === 'dark' ? "text-gray-300" : "text-gray-600"
              )}>
                {selectedMarket?.address}
              </p>
            </div>

            <div className="flex gap-4 items-center">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('markets')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Cambiar Mercado
              </Button>

              <Button
                onClick={() => setShowCart(!showCart)}
                className="flex items-center gap-2 relative"
              >
                <ShoppingCart className="w-5 h-5 cart-icon-main" />
                Carrito
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center">
                    {cart.reduce((total, item) => total + item.quantity, 0)}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all duration-200",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={cn(
                "px-4 py-3 rounded-xl border-2 transition-all duration-200 font-medium",
                theme === 'dark'
                  ? "bg-gray-700 border-gray-600 text-white focus:border-exa-secondary"
                  : "bg-gray-50 border-gray-200 text-gray-900 focus:border-exa-primary"
              )}
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'todos' ? 'Todas las categorías' : category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product, index) => {
            const cartItem = cart.find(item => item.id === product.id)
            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "border-2 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105",
                  theme === 'dark'
                    ? "border-gray-700 bg-gray-800 hover:border-exa-secondary"
                    : "border-gray-200 bg-white hover:border-exa-primary hover:shadow-lg"
                )}
              >
                {/* Product Image */}
                <div className="relative h-48 overflow-hidden bg-gray-100">
                  {loadingImages.has(product.id) && (
                    <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center z-10">
                      <div className="text-gray-500 text-sm">Cargando imagen...</div>
                    </div>
                  )}
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className={`w-full h-full object-cover transition-transform duration-300 hover:scale-110 ${
                      loadingImages.has(product.id) ? 'opacity-50' : 'opacity-100'
                    }`}
                    onError={(e) => {
                      e.currentTarget.src = `https://picsum.photos/seed/${product.name}/400/300.jpg`
                    }}
                  />
                  {product.stock < 10 && product.stock > 0 && (
                    <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      ¡Solo {product.stock} disponibles!
                    </div>
                  )}
                  {product.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold text-lg">Agotado</span>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <h3 className={cn(
                    "text-lg font-bold mb-2 line-clamp-1",
                    theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {product.name}
                  </h3>
                  <p className={cn(
                    "text-sm mb-3 line-clamp-2 h-10",
                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                  )}>
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className={cn(
                        "text-xl font-bold",
                        theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                      )}>
                        ${product.price.toFixed(2)}
                      </span>
                      <span className={cn(
                        "text-sm ml-1",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        / {product.unit}
                      </span>
                    </div>
                    <div className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-600"
                    )}>
                      {product.category}
                    </div>
                  </div>

                  {/* Rating y Stock */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span className={cn(
                        "text-sm font-medium",
                        theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {product.rating}
                      </span>
                      <span className={cn(
                        "text-xs text-gray-500",
                        theme === 'dark' ? "text-gray-400" : "text-gray-500"
                      )}>
                        ({product.soldUnits} vendidos)
                      </span>
                    </div>
                    <div className={cn(
                      "text-xs px-2 py-1 rounded",
                      product.stock > 10
                        ? theme === 'dark' ? "bg-green-500/20 text-green-400" : "bg-green-100 text-green-700"
                        : theme === 'dark' ? "bg-yellow-500/20 text-yellow-400" : "bg-yellow-100 text-yellow-700"
                    )}>
                      {product.stock} disponibles
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {cartItem ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className={cn(
                          "font-medium text-center flex-1",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          {cartItem.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                          className="w-8 h-8 p-0"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        onClick={() => addToCart(product)}
                        className={cn(
                          "flex-1 relative overflow-hidden transition-all duration-300",
                          cartAnimation === product.id && "animate-pulse bg-green-500 hover:bg-green-600"
                        )}
                        disabled={product.stock === 0}
                      >
                        {product.stock === 0 ? 'Agotado' : (
                          <span className="flex items-center justify-center gap-2">
                            {cartAnimation === product.id ? (
                              <motion.span
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                className="flex items-center justify-center gap-2 text-white font-semibold"
                              >
                                <Check className="w-5 h-5" />
                                <span>¡Agregado!</span>
                              </motion.span>
                            ) : (
                              <>
                                <ShoppingCart className="w-4 h-4" />
                                <span>Agregar</span>
                              </>
                            )}
                          </span>
                        )}
                      </Button>
                    )}
                  </div>

                  {product.stock < 10 && product.stock > 0 && (
                    <p className={cn(
                      "text-xs mt-2",
                      theme === 'dark' ? "text-yellow-400" : "text-yellow-600"
                    )}>
                      ¡Solo {product.stock} disponibles!
                    </p>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Cart Sidebar */}
        <AnimatePresence>
          {showCart && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex justify-end"
              onClick={() => setShowCart(false)}
            >
              <motion.div
                initial={{ x: 400 }}
                animate={{ x: 0 }}
                exit={{ x: 400 }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "w-full max-w-md h-full overflow-y-auto",
                  theme === 'dark' ? "bg-gray-900" : "bg-white"
                )}
              >
                <div className="p-6 border-b">
                  <div className="flex justify-between items-center">
                    <h3 className={cn(
                      "text-xl font-bold",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Tu Carrito
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCart(false)}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                <div className="p-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingCart className={cn(
                        "w-16 h-16 mx-auto mb-4",
                        theme === 'dark' ? "text-gray-600" : "text-gray-300"
                      )} />
                      <p className={cn(
                        "text-lg",
                        theme === 'dark' ? "text-gray-400" : "text-gray-600"
                      )}>
                        Tu carrito está vacío
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 mb-6">
                        {cart.map((item) => (
                          <div key={item.id} className={cn(
                            "border rounded-xl p-4",
                            theme === 'dark' ? "border-gray-700" : "border-gray-200"
                          )}>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  {item.name}
                                </h4>
                                <p className={cn(
                                  "text-sm",
                                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                )}>
                                  ${item.price.toFixed(2)} / {item.unit}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateQuantity(item.id, 0)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 p-0"
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <span className={cn(
                                "font-medium text-center flex-1",
                                theme === 'dark' ? "text-white" : "text-gray-900"
                              )}>
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 p-0"
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>

                            <div className="mt-3 text-right">
                              <span className={cn(
                                "font-medium",
                                theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
                              )}>
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="border-t pt-4 space-y-3">
                        <div className="flex justify-between">
                          <span className={theme === 'dark' ? "text-gray-300" : "text-gray-600"}>
                            Subtotal
                          </span>
                          <span className={theme === 'dark' ? "text-white" : "text-gray-900"}>
                            ${getTotalAmount().toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className={theme === 'dark' ? "text-gray-300" : "text-gray-600"}>
                            Envío
                          </span>
                          <span className={theme === 'dark' ? "text-white" : "text-gray-900"}>
                            ${selectedMarket?.deliveryCost.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-lg font-bold">
                          <span className={theme === 'dark' ? "text-white" : "text-gray-900"}>
                            Total
                          </span>
                          <span className={theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"}>
                            ${(getTotalAmount() + (selectedMarket?.deliveryCost || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <Button
                        onClick={() => {
                          setShowCart(false)
                          setCurrentStep('checkout')
                        }}
                        className="w-full mt-6"
                        size="lg"
                      >
                        Proceder al Pago
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  const renderCheckoutStep = () => {
    const subtotal = getTotalAmount()
    const delivery = selectedMarket?.deliveryCost || 0
    const total = subtotal + delivery

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl p-8",
          theme === 'dark' ? "bg-gray-800" : "bg-white shadow-lg"
        )}
      >
        <h2 className={cn(
          "text-3xl font-bold mb-8 text-center",
          theme === 'dark' ? "text-white" : "text-gray-900"
        )}>
          Finalizar Pedido
        </h2>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Customer Information */}
          <div className="space-y-6">
            <h3 className={cn(
              "text-xl font-semibold mb-4",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Información de Entrega
            </h3>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Nombre completo
              </label>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="Tu nombre completo"
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Teléfono
              </label>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="+53 5XXXXXX"
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Dirección de entrega
              </label>
              <textarea
                value={customerInfo.address}
                onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
                rows={3}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="Calle #, entre calles, municipio, provincia"
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Correo electrónico (opcional)
              </label>
              <input
                type="email"
                value={customerInfo.email}
                onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="correo@ejemplo.com"
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === 'dark' ? "text-gray-200" : "text-gray-700"
              )}>
                Notas adicionales (opcional)
              </label>
              <textarea
                value={customerInfo.notes}
                onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                rows={3}
                className={cn(
                  "w-full px-4 py-3 rounded-xl border-2 transition-all duration-200",
                  theme === 'dark'
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-exa-secondary"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-exa-primary"
                )}
                placeholder="Instrucciones especiales para la entrega..."
              />
            </div>
          </div>

          {/* Order Summary */}
          <div className="space-y-6">
            <h3 className={cn(
              "text-xl font-semibold mb-4",
              theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              Resumen del Pedido
            </h3>

            <div className={cn(
              "rounded-xl p-6 space-y-4",
              theme === 'dark' ? "bg-gray-700" : "bg-gray-50"
            )}>
              <div>
                <h4 className={cn(
                  "font-medium mb-3",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  {selectedMarket?.name}
                </h4>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  {selectedMarket?.address}
                </p>
              </div>

              <div className="border-t pt-4">
                <h4 className={cn(
                  "font-medium mb-3",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Productos ({cart.reduce((total, item) => total + item.quantity, 0)} unidades)
                </h4>
                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className={theme === 'dark' ? "text-gray-300" : "text-gray-700"}>
                        {item.quantity} {item.unit} - {item.name}
                      </span>
                      <span className={theme === 'dark' ? "text-white" : "text-gray-900"}>
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? "text-gray-300" : "text-gray-700"}>
                    Subtotal
                  </span>
                  <span className={theme === 'dark' ? "text-white" : "text-gray-900"}>
                    ${subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={theme === 'dark' ? "text-gray-300" : "text-gray-700"}>
                    Envío
                  </span>
                  <span className={theme === 'dark' ? "text-white" : "text-gray-900"}>
                    ${delivery.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span className={theme === 'dark' ? "text-white" : "text-gray-900"}>
                    Total
                  </span>
                  <span className={theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"}>
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('shopping')}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <Button
                onClick={() => setCurrentStep('success')}
                className="flex-1"
                disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address}
              >
                Confirmar Pedido
                <Check className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  const renderSuccessStep = () => {
    const orderId = `MRK-${Date.now().toString().slice(-6)}`

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl p-8 text-center",
          theme === 'dark' ? "bg-gray-800" : "bg-white shadow-lg"
        )}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8",
            theme === 'dark' ? "bg-green-500/20" : "bg-green-50"
          )}
        >
          <Check className="w-12 h-12 text-green-500" />
        </motion.div>

        <h2 className={cn(
          "text-4xl font-bold mb-4",
          theme === 'dark' ? "text-white" : "text-gray-900"
        )}>
          ¡Pedido Confirmado!
        </h2>

        <p className={cn(
          "text-xl mb-8",
          theme === 'dark' ? "text-gray-300" : "text-gray-600"
        )}>
          Tu pedido ha sido recibido y será procesado próximamente
        </p>

        <div className={cn(
          "rounded-2xl p-6 mb-8 text-left max-w-2xl mx-auto",
          theme === 'dark' ? "bg-gray-700" : "bg-gray-50"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className={cn(
                "font-semibold mb-3",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Detalles del Pedido
              </h3>
              <div className="space-y-2">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <strong>Orden:</strong> #{orderId}
                </p>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <strong>Cliente:</strong> {customerInfo.name}
                </p>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <strong>Teléfono:</strong> {customerInfo.phone}
                </p>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <strong>Dirección:</strong> {customerInfo.address}
                </p>
              </div>
            </div>

            <div>
              <h3 className={cn(
                "font-semibold mb-3",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Información de Entrega
              </h3>
              <div className="space-y-2">
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <strong>Mercado:</strong> {selectedMarket?.name}
                </p>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <strong>Tiempo estimado:</strong> {selectedMarket?.deliveryTime}
                </p>
                <p className={cn(
                  "text-sm",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  <strong>Teléfono contacto:</strong> {selectedMarket?.phone}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center">
              <span className={cn(
                "font-semibold text-lg",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Total Pagado:
              </span>
              <span className={cn(
                "font-bold text-xl",
                theme === 'dark' ? "text-exa-secondary" : "text-exa-primary"
              )}>
                ${(getTotalAmount() + (selectedMarket?.deliveryCost || 0)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Información de Notificaciones de Entrega */}
        <div className={cn(
          "rounded-2xl border p-6 text-left max-w-2xl mx-auto mb-8",
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
                      Pedido Confirmado
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Notificación cuando el pedido esté siendo preparado
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
                      Pedido Listo
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Mensaje cuando el pedido esté listo para enviar
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
                    theme === 'dark' ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                  )}>
                    4
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium text-sm mb-1",
                      theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>
                      Pedido Entregado
                    </p>
                    <p className={cn(
                      "text-xs",
                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                    )}>
                      Confirmación final de la entrega realizada
                    </p>
                  </div>
                </div>
              </div>
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
          </AnimatePresence>
        </div>

        {/* Floating Notification */}
        <AnimatePresence>
          {notification.show && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.8 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                mass: 0.8
              }}
              className="fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl shadow-2xl border border-white/20 backdrop-blur-sm"
            >
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
                className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
              >
                <Check className="w-5 h-5" />
              </motion.div>
              <div className="flex flex-col">
                <span className="font-bold text-white">¡Agregado al carrito!</span>
                <span className="text-sm text-white/80">{notification.message}</span>
              </div>
              <motion.div
                className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.2, 1] }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                <Sparkles className="w-3 h-3 text-gray-800" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  )
}