'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Warehouse,
  MapPin,
  User,
  Phone,
  Mail,
  ArrowLeft,
  ArrowRight,
  Check,
  X,
  Loader2,
  Star,
  Building,
  Store,
  Package,
  ChevronDown,
  Map as MapIcon,
  Navigation,
  Printer
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoieXVsaWFuYW5kcmVzMTYxMCIsImEiOiJjbWgycTlsZGsxM200YnNvbnN2d2wwcHJ5In0.wlU7-bazAs2eYjknx7H97Q'

interface PrintService {
  id: number
  name: string
  code: string
  status?: string
}

type Step = 'info' | 'location' | 'manager' | 'review'

interface WizardStep {
  id: Step
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const STEPS: WizardStep[] = [
  { id: 'info', title: 'Información', description: 'Datos básicos', icon: Building },
  { id: 'location', title: 'Ubicación', description: 'Dirección y mapa', icon: MapPin },
  { id: 'manager', title: 'Responsable', description: 'Contacto', icon: User },
  { id: 'review', title: 'Revisión', description: 'Confirmar datos', icon: Check }
]

const WAREHOUSE_TYPES = [
  { id: 'storage', label: 'Almacenaje', description: 'Almacenamiento de productos', icon: Warehouse, color: 'blue' },
  { id: 'distribution', label: 'Distribución', description: 'Centro de envíos', icon: Package, color: 'purple' },
  { id: 'retail', label: 'Punto de Venta', description: 'Venta directa al público', icon: Store, color: 'emerald' }
]

// Cuban provinces and municipalities with coordinates
const PROVINCES = [
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
    { id: 'san-luis-stgo', name: 'San Luis', coords: [-75.8500, 20.1833] },
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

// Componente del Mapa para seleccionar ubicación del Almacén
interface WarehouseMapPickerProps {
  theme: string
  provinceId: string
  municipalityId: string
  latitude: number | null
  longitude: number | null
  onLocationChange: (lat: number, lng: number) => void
}

function WarehouseMapPicker({ theme, provinceId, municipalityId, latitude, longitude, onLocationChange }: WarehouseMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)
  const markerInstanceRef = useRef<mapboxgl.Marker | null>(null)
  const isInitializedRef = useRef(false)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // Obtener coordenadas del municipio (prioridad) o provincia
  const provinceData = PROVINCES.find(p => p.id === provinceId)
  const municipalityData = provinceData?.municipalities.find(m => m.id === municipalityId)

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
          style: 'mapbox://styles/mapbox/streets-v12',
          center: initialCenter,
          zoom: 14
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
        const marker = new mapboxgl.Marker({ color: '#10B981', draggable: true })
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
        zoom: 14,
        duration: 1000
      })

      // Si no hay marcador, agregar uno en el centro del municipio
      if (!markerInstanceRef.current && mapInstanceRef.current) {
        const marker = new mapboxgl.Marker({ color: '#10B981', draggable: true })
          .setLngLat(targetCoords)
          .addTo(mapInstanceRef.current)

        marker.on('dragend', () => {
          const pos = marker.getLngLat()
          onLocationChange(pos.lat, pos.lng)
        })

        markerInstanceRef.current = marker
        onLocationChange(targetCoords[1], targetCoords[0])
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipalityId, provinceId, status])

  return (
    <div className="space-y-3">
      <div
        ref={mapContainerRef}
        className={cn(
          "w-full h-[300px] rounded-xl overflow-hidden border-2 transition-all",
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}
      />
      {status === 'loading' && (
        <div className={cn(
          "absolute inset-0 flex items-center justify-center rounded-xl",
          theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
        )}>
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      )}
      {status === 'error' && (
        <div className={cn(
          "p-4 rounded-xl text-center",
          theme === 'dark' ? 'bg-red-900/20 text-red-400' : 'bg-red-50 text-red-600'
        )}>
          Error al cargar el mapa
        </div>
      )}
      <p className={cn(
        "text-xs flex items-center gap-2",
        theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
      )}>
        <Navigation className="w-4 h-4" />
        Haz clic en el mapa o arrastra el pin para ajustar la ubicación exacta del almacén
      </p>
    </div>
  )
}

export default function CreateMarketWarehousePage() {
  const { theme } = useTheme()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCancelModal, setShowCancelModal] = useState(false)

  const [printServices, setPrintServices] = useState<PrintService[]>([])

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    warehouseType: 'storage',
    isCentral: false,
    allowNegativeStock: false,
    defaultPrintServiceId: null as number | null,
    // Address with province/municipality
    provinceId: '',
    municipalityId: '',
    street: '',
    latitude: null as number | null,
    longitude: null as number | null,
    // Manager
    managerName: '',
    phone: '',
    email: ''
  })

  // Fetch print services on mount
  useEffect(() => {
    const fetchPrintServices = async () => {
      try {
        const response = await fetch('/api/market/print-services')
        const data = await response.json()
        if (data.success && data.data) {
          setPrintServices(data.data)
        }
      } catch (err) {
        console.error('Error fetching print services:', err)
      }
    }
    fetchPrintServices()
  }, [])

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep)

  // Get selected province and its municipalities
  const selectedProvince = useMemo(() =>
    PROVINCES.find(p => p.id === formData.provinceId),
    [formData.provinceId]
  )

  const municipalities = useMemo(() =>
    selectedProvince?.municipalities || [],
    [selectedProvince]
  )

  const selectedMunicipality = useMemo(() =>
    municipalities.find(m => m.id === formData.municipalityId),
    [municipalities, formData.municipalityId]
  )

  // Update coordinates when municipality changes
  useEffect(() => {
    if (selectedMunicipality) {
      setFormData(prev => ({
        ...prev,
        latitude: selectedMunicipality.coords[1],
        longitude: selectedMunicipality.coords[0]
      }))
    }
  }, [selectedMunicipality])

  // Clear municipality when province changes
  const handleProvinceChange = (provinceId: string) => {
    setFormData(prev => ({
      ...prev,
      provinceId,
      municipalityId: '',
      latitude: null,
      longitude: null
    }))
  }

  const generateCode = () => {
    const provinceCode = (selectedProvince?.name || 'ALM').toUpperCase().substring(0, 3)
    const typeCode = formData.warehouseType.substring(0, 3).toUpperCase()
    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `${provinceCode}-${typeCode}-${randomSuffix}`
  }

  const validateStep = (step: Step): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 'info') {
      if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
      if (!formData.code.trim()) newErrors.code = 'El código es requerido'
    }

    if (step === 'location') {
      if (!formData.provinceId) newErrors.province = 'Selecciona una provincia'
      if (!formData.municipalityId) newErrors.municipality = 'Selecciona un municipio'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const goToNextStep = () => {
    if (!validateStep(currentStep)) return

    const nextIndex = currentStepIndex + 1
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id)
    }
  }

  const goToPrevStep = () => {
    const prevIndex = currentStepIndex - 1
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep('review')) return

    setLoading(true)
    try {
      const response = await fetch('/api/market/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          warehouseType: formData.warehouseType,
          isCentral: formData.isCentral,
          allowNegativeStock: formData.allowNegativeStock,
          defaultPrintServiceId: formData.defaultPrintServiceId,
          address: formData.street,
          city: selectedMunicipality?.name || '',
          state: selectedProvince?.name || '',
          municipality: selectedMunicipality?.name || '',
          country: 'Cuba',
          latitude: formData.latitude,
          longitude: formData.longitude,
          managerName: formData.managerName,
          phone: formData.phone,
          email: formData.email
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear almacén')
      }

      router.push('/dashboard/market/warehouses')
    } catch (error) {
      console.error('Error creating warehouse:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Error al crear almacén' })
    } finally {
      setLoading(false)
    }
  }

  const selectedType = WAREHOUSE_TYPES.find(t => t.id === formData.warehouseType)

  return (
    
      
        <div className={cn(
          "min-h-screen pt-12 sm:pt-16 lg:pt-20 pb-20 px-4 sm:px-6 lg:px-8",
          theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
        )}>
          <div className="max-w-4xl xl:max-w-5xl mx-auto space-y-6 sm:space-y-8 relative">

            {/* Close Button */}
            <motion.button
              onClick={() => setShowCancelModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "absolute -top-14 -right-2 sm:-top-12 sm:right-0 z-10 w-8 h-8 rounded-full flex items-center justify-center",
                "transition-colors duration-200",
                theme === 'dark'
                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              )}
            >
              <X className="w-4 h-4" />
            </motion.button>

            {/* Header */}
            <div className="text-center mb-4">
              <Link
                href="/dashboard/market/warehouses"
                className={cn(
                  "inline-flex items-center gap-2 text-sm mb-4 transition-colors",
                  theme === 'dark'
                    ? 'text-gray-400 hover:text-gray-200'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                Volver a almacenes
              </Link>
              <h1 className={cn(
                "text-2xl sm:text-3xl font-bold",
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>
                Nuevo Almacén
              </h1>
            </div>

            {/* Progress Indicator */}
            <div className="mb-8 sm:mb-12">
              <div className="flex items-center justify-between">
                {STEPS.map((step, index) => (
                  <React.Fragment key={step.id}>
                    <div className="flex flex-col items-center">
                      <div className="relative w-14 h-14">
                        {/* Pulsing ring for active step */}
                        {currentStep === step.id && (
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            animate={{
                              scale: [1, 1.2, 1],
                              opacity: [0.5, 0, 0.5]
                            }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "easeInOut"
                            }}
                            style={{
                              background: theme === 'dark'
                                ? 'rgba(59, 130, 246, 0.5)'
                                : 'rgba(37, 99, 235, 0.5)'
                            }}
                          />
                        )}

                        <motion.div
                          initial={false}
                          animate={{
                            scale: currentStep === step.id ? 1.1 : 1,
                            backgroundColor: currentStep === step.id
                              ? theme === 'dark' ? '#3B82F6' : '#2563EB'
                              : currentStepIndex > index
                                ? theme === 'dark' ? '#10B981' : '#059669'
                                : theme === 'dark' ? '#374151' : '#E5E7EB'
                          }}
                          transition={{
                            scale: { duration: 0.3 },
                            backgroundColor: { duration: 0.3 }
                          }}
                          whileHover={{ scale: currentStepIndex >= index ? 1.15 : 1.05 }}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center relative z-10",
                            "transition-shadow duration-300",
                            currentStep === step.id && (
                              theme === 'dark'
                                ? 'shadow-lg shadow-blue-500/50'
                                : 'shadow-lg shadow-blue-400/50'
                            ),
                            currentStepIndex > index && (
                              theme === 'dark'
                                ? 'shadow-md shadow-green-500/30'
                                : 'shadow-md shadow-green-400/30'
                            )
                          )}
                        >
                          {currentStepIndex > index ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            >
                              <Check className="w-7 h-7 text-white" />
                            </motion.div>
                          ) : (
                            <step.icon className={cn(
                              "w-7 h-7",
                              currentStep === step.id ? 'text-white' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                          )}
                        </motion.div>
                      </div>

                      <div className="mt-3 text-center">
                        <p className={cn(
                          "text-xs sm:text-sm font-semibold",
                          currentStep === step.id
                            ? theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                            : currentStepIndex > index
                              ? theme === 'dark' ? 'text-green-400' : 'text-green-600'
                              : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                        )}>
                          {step.title}
                        </p>
                        <p className={cn(
                          "text-xs hidden sm:block mt-0.5",
                          theme === 'dark' ? 'text-gray-600' : 'text-gray-500'
                        )}>
                          {step.description}
                        </p>
                      </div>
                    </div>

                    {index < STEPS.length - 1 && (
                      <div className="flex-1 h-0.5 mx-2 sm:mx-3 mb-8 sm:mb-10 relative">
                        <div className={cn(
                          "absolute inset-0 rounded-full",
                          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                        )} />
                        <motion.div
                          initial={false}
                          animate={{
                            scaleX: currentStepIndex > index ? 1 : 0
                          }}
                          transition={{ duration: 0.5, ease: "easeInOut" }}
                          className={cn(
                            "h-full origin-left rounded-full",
                            theme === 'dark' ? 'bg-green-500' : 'bg-green-600'
                          )}
                        />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Step Content */}
            <motion.div
              className={cn(
                "rounded-2xl border p-6 sm:p-8 shadow-lg",
                theme === 'dark'
                  ? 'bg-gray-800/95 border-gray-700/50 backdrop-blur-sm'
                  : 'bg-white border-gray-200 backdrop-blur-sm'
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <AnimatePresence mode="wait">
                {/* Step 1: Information */}
                {currentStep === 'info' && (
                  <motion.div
                    key="info"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Building className="w-5 h-5 text-white" />
                      </div>
                      Información del Almacén
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre del Almacén *
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Ej: Almacén Central La Habana"
                          className={cn(
                            'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                            errors.name
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                          )}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Código *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                            placeholder="ALM-001"
                            className={cn(
                              'flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all font-mono',
                              errors.code
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="button"
                            onClick={() => setFormData({ ...formData, code: generateCode() })}
                            className={cn(
                              "px-4 py-3 rounded-xl font-medium transition-all",
                              theme === 'dark'
                                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            )}
                          >
                            Auto
                          </motion.button>
                        </div>
                        {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code}</p>}
                      </div>

                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-3",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Tipo de Almacén
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {WAREHOUSE_TYPES.map((type) => (
                            <motion.button
                              key={type.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              type="button"
                              onClick={() => setFormData({ ...formData, warehouseType: type.id })}
                              className={cn(
                                "p-4 rounded-xl border-2 transition-all text-left relative",
                                formData.warehouseType === type.id
                                  ? theme === 'dark'
                                    ? 'border-blue-500 bg-blue-900/20'
                                    : 'border-blue-500 bg-blue-50'
                                  : theme === 'dark'
                                    ? 'border-gray-700 hover:border-gray-600'
                                    : 'border-gray-200 hover:border-gray-300'
                              )}
                            >
                              {formData.warehouseType === type.id && (
                                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                              <type.icon className={cn(
                                "w-6 h-6 mb-2",
                                formData.warehouseType === type.id
                                  ? 'text-blue-500'
                                  : theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                              )} />
                              <p className={cn(
                                "font-medium text-sm",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                {type.label}
                              </p>
                              <p className={cn(
                                "text-xs mt-0.5",
                                theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                              )}>
                                {type.description}
                              </p>
                            </motion.button>
                          ))}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="md:col-span-2 flex flex-wrap gap-4">
                        <label className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          formData.isCentral
                            ? theme === 'dark'
                              ? 'border-amber-500 bg-amber-900/20'
                              : 'border-amber-500 bg-amber-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}>
                          <input
                            type="checkbox"
                            checked={formData.isCentral}
                            onChange={(e) => setFormData({ ...formData, isCentral: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            formData.isCentral
                              ? 'bg-amber-500 border-amber-500'
                              : theme === 'dark' ? 'border-gray-500' : 'border-gray-400'
                          )}>
                            {formData.isCentral && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Star className={cn(
                                "w-4 h-4",
                                formData.isCentral ? 'text-amber-500' : 'text-gray-400'
                              )} />
                              <span className={cn(
                                "font-medium text-sm",
                                theme === 'dark' ? 'text-white' : 'text-gray-900'
                              )}>
                                Almacén Central
                              </span>
                            </div>
                            <p className={cn(
                              "text-xs mt-0.5",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              Solo puede haber uno por empresa
                            </p>
                          </div>
                        </label>

                        <label className={cn(
                          "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          formData.allowNegativeStock
                            ? theme === 'dark'
                              ? 'border-red-500 bg-red-900/20'
                              : 'border-red-500 bg-red-50'
                            : theme === 'dark'
                              ? 'border-gray-700 hover:border-gray-600'
                              : 'border-gray-200 hover:border-gray-300'
                        )}>
                          <input
                            type="checkbox"
                            checked={formData.allowNegativeStock}
                            onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            formData.allowNegativeStock
                              ? 'bg-red-500 border-red-500'
                              : theme === 'dark' ? 'border-gray-500' : 'border-gray-400'
                          )}>
                            {formData.allowNegativeStock && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <span className={cn(
                              "font-medium text-sm",
                              theme === 'dark' ? 'text-white' : 'text-gray-900'
                            )}>
                              Permitir Stock Negativo
                            </span>
                            <p className={cn(
                              "text-xs mt-0.5",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              Vender sin stock disponible
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Print Service Selector */}
                      {printServices.length > 0 && (
                        <div className="md:col-span-2">
                          <label className={cn(
                            "block text-sm font-medium mb-2",
                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                          )}>
                            <div className="flex items-center gap-2">
                              <Printer className="w-4 h-4 text-blue-500" />
                              Servicio de Impresión
                            </div>
                          </label>
                          <p className={cn(
                            "text-xs mb-3",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>
                            Selecciona el servicio de impresión que se usará para imprimir documentos en este almacén
                          </p>
                          <div className="relative">
                            <select
                              value={formData.defaultPrintServiceId || ''}
                              onChange={(e) => setFormData({ ...formData, defaultPrintServiceId: e.target.value ? parseInt(e.target.value) : null })}
                              className={cn(
                                'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer',
                                theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                              )}
                            >
                              <option value="">Sin servicio de impresión</option>
                              {printServices.map(ps => (
                                <option key={ps.id} value={ps.id}>
                                  {ps.name} ({ps.code})
                                </option>
                              ))}
                            </select>
                            <ChevronDown className={cn(
                              "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                              theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                            )} />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Location */}
                {currentStep === 'location' && (
                  <motion.div
                    key="location"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      Ubicación del Almacén
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Province Dropdown */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Provincia *
                        </label>
                        <div className="relative">
                          <select
                            value={formData.provinceId}
                            onChange={(e) => handleProvinceChange(e.target.value)}
                            className={cn(
                              'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer',
                              errors.province
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                            )}
                          >
                            <option value="">Seleccionar provincia...</option>
                            {PROVINCES.map((province) => (
                              <option key={province.id} value={province.id}>
                                {province.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className={cn(
                            "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                        </div>
                        {errors.province && <p className="text-red-500 text-xs mt-1">{errors.province}</p>}
                      </div>

                      {/* Municipality Dropdown */}
                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Municipio *
                        </label>
                        <div className="relative">
                          <select
                            value={formData.municipalityId}
                            onChange={(e) => setFormData({ ...formData, municipalityId: e.target.value })}
                            disabled={!formData.provinceId}
                            className={cn(
                              'w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer',
                              'disabled:opacity-50 disabled:cursor-not-allowed',
                              errors.municipality
                                ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : theme === 'dark'
                                  ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                  : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                            )}
                          >
                            <option value="">
                              {formData.provinceId ? 'Seleccionar municipio...' : 'Primero selecciona una provincia'}
                            </option>
                            {municipalities.map((municipality) => (
                              <option key={municipality.id} value={municipality.id}>
                                {municipality.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className={cn(
                            "absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                        </div>
                        {errors.municipality && <p className="text-red-500 text-xs mt-1">{errors.municipality}</p>}
                      </div>

                      {/* Street Address */}
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Dirección (calle, número, entre calles)
                        </label>
                        <div className="relative">
                          <MapPin className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="text"
                            value={formData.street}
                            onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                            placeholder="Ej: Calle 23 #456 entre G y H"
                            className={cn(
                              'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-emerald-500 focus:ring-emerald-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-emerald-500 focus:ring-emerald-500/20'
                            )}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mapa para seleccionar ubicación con pin */}
                    {formData.provinceId && formData.municipalityId && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="md:col-span-2"
                      >
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Ubicación en el Mapa - Haz clic para colocar el pin
                        </label>
                        <WarehouseMapPicker
                          theme={theme}
                          provinceId={formData.provinceId}
                          municipalityId={formData.municipalityId}
                          latitude={formData.latitude}
                          longitude={formData.longitude}
                          onLocationChange={(lat: number, lng: number) => {
                            setFormData(prev => ({
                              ...prev,
                              latitude: lat,
                              longitude: lng
                            }))
                          }}
                        />
                      </motion.div>
                    )}

                    {/* Coordinates Display */}
                    {formData.latitude && formData.longitude && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-xl border md:col-span-2",
                          theme === 'dark'
                            ? 'bg-emerald-900/20 border-emerald-800'
                            : 'bg-emerald-50 border-emerald-200'
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? 'bg-emerald-900/50' : 'bg-emerald-100'
                        )}>
                          <MapIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1">
                          <p className={cn(
                            "font-medium text-sm",
                            theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'
                          )}>
                            Coordenadas seleccionadas
                          </p>
                          <p className="text-xs text-emerald-600">
                            Lat: {formData.latitude.toFixed(6)}, Lng: {formData.longitude.toFixed(6)}
                          </p>
                        </div>
                        <Check className="w-6 h-6 text-emerald-600" />
                      </motion.div>
                    )}

                    {/* Location Preview */}
                    {selectedProvince && selectedMunicipality && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-4 rounded-xl border md:col-span-2",
                          theme === 'dark'
                            ? 'bg-gray-900/50 border-gray-700'
                            : 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <p className="text-xs text-gray-500 mb-1">Ubicación seleccionada:</p>
                        <p className={cn(
                          "font-medium",
                          theme === 'dark' ? 'text-white' : 'text-gray-900'
                        )}>
                          {formData.street && `${formData.street}, `}
                          {selectedMunicipality.name}, {selectedProvince.name}, Cuba
                        </p>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Manager */}
                {currentStep === 'manager' && (
                  <motion.div
                    key="manager"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      Responsable del Almacén
                    </h2>

                    <p className={cn(
                      "text-sm",
                      theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                    )}>
                      Esta información es opcional pero recomendada para contacto.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Nombre del Responsable
                        </label>
                        <div className="relative">
                          <User className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="text"
                            value={formData.managerName}
                            onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                            placeholder="Juan Pérez"
                            className={cn(
                              'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Teléfono
                        </label>
                        <div className="relative">
                          <Phone className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+53 5XXX XXXX"
                            className={cn(
                              'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                      </div>

                      <div>
                        <label className={cn(
                          "block text-sm font-medium mb-2",
                          theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                        )}>
                          Email
                        </label>
                        <div className="relative">
                          <Mail className={cn(
                            "absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
                          )} />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="almacen@empresa.com"
                            className={cn(
                              'w-full pl-12 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 transition-all',
                              theme === 'dark'
                                ? 'bg-gray-900/50 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20'
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20'
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Review */}
                {currentStep === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    <h2 className={cn(
                      "text-xl font-bold flex items-center gap-3",
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      Revisión del Almacén
                    </h2>

                    <div className={cn(
                      'rounded-2xl p-6 space-y-6',
                      theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50'
                    )}>
                      {/* Header */}
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-16 h-16 rounded-xl flex items-center justify-center",
                          theme === 'dark' ? 'bg-blue-900/50' : 'bg-blue-100'
                        )}>
                          <Warehouse className={cn(
                            "w-8 h-8",
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {formData.name || 'Sin nombre'}
                          </h3>
                          <p className={cn(
                            "font-mono text-sm",
                            theme === 'dark' ? 'text-gray-500' : 'text-gray-500'
                          )}>
                            {formData.code || 'Sin código'}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              theme === 'dark'
                                ? 'bg-blue-900/50 text-blue-300'
                                : 'bg-blue-100 text-blue-700'
                            )}>
                              {selectedType?.label}
                            </span>
                            {formData.isCentral && (
                              <span className={cn(
                                "text-xs px-2 py-0.5 rounded-full flex items-center gap-1",
                                theme === 'dark'
                                  ? 'bg-amber-900/50 text-amber-300'
                                  : 'bg-amber-100 text-amber-700'
                              )}>
                                <Star className="w-3 h-3" />
                                Central
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Location */}
                      {(selectedProvince || formData.street) && (
                        <div className={cn(
                          "p-4 rounded-xl",
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs text-gray-500">Ubicación</span>
                          </div>
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {[
                              formData.street,
                              selectedMunicipality?.name,
                              selectedProvince?.name,
                              'Cuba'
                            ].filter(Boolean).join(', ')}
                          </p>
                          {formData.latitude && formData.longitude && (
                            <p className="text-xs text-green-600 mt-1">
                              Coordenadas: {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Manager */}
                      {formData.managerName && (
                        <div className={cn(
                          "p-4 rounded-xl",
                          theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                        )}>
                          <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-purple-500" />
                            <span className="text-xs text-gray-500">Responsable</span>
                          </div>
                          <p className={cn(
                            "font-medium",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            {formData.managerName}
                          </p>
                          <div className="flex items-center gap-4 mt-1">
                            {formData.phone && (
                              <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {formData.phone}
                              </span>
                            )}
                            {formData.email && (
                              <span className="text-sm text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {formData.email}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {errors.submit && (
                      <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                        <p className="text-red-600 text-sm">{errors.submit}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  theme === 'dark'
                    ? 'bg-gray-700 hover:bg-gray-600 text-white shadow-lg'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-900 shadow-md'
                )}
              >
                <ArrowLeft className="w-5 h-5" />
                Anterior
              </motion.button>

              {currentStep === 'review' ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={loading}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    theme === 'dark'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30'
                      : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-400/30',
                    'text-white'
                  )}
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  <Check className="w-5 h-5" />
                  Crear Almacén
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={goToNextStep}
                  className={cn(
                    "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all",
                    theme === 'dark'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                      : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/30',
                    'text-white'
                  )}
                >
                  Siguiente
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
          </div>

          {/* Cancel Modal */}
          <AnimatePresence>
            {showCancelModal && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowCancelModal(false)}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ type: "spring", duration: 0.3 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4"
                >
                  <div
                    className={cn(
                      "w-full max-w-md rounded-2xl shadow-2xl border",
                      theme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-6 pb-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                          theme === 'dark' ? 'bg-red-900/30' : 'bg-red-100'
                        )}>
                          <X className={cn(
                            "w-6 h-6",
                            theme === 'dark' ? 'text-red-400' : 'text-red-600'
                          )} />
                        </div>
                        <div className="flex-1">
                          <h3 className={cn(
                            "text-xl font-bold mb-2",
                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                          )}>
                            ¿Cancelar creación?
                          </h3>
                          <p className={cn(
                            "text-sm",
                            theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                          )}>
                            Se perderá toda la información ingresada y no podrás recuperarla.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className={cn(
                      "flex gap-3 p-6 pt-4 border-t",
                      theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
                    )}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowCancelModal(false)}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all",
                          theme === 'dark'
                            ? 'bg-gray-700 hover:bg-gray-600 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                        )}
                      >
                        Continuar editando
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/dashboard/market/warehouses')}
                        className={cn(
                          "flex-1 px-4 py-3 rounded-xl font-medium transition-all text-white",
                          theme === 'dark'
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-red-500 hover:bg-red-600'
                        )}
                      >
                        Sí, cancelar
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      
    
  )
}
