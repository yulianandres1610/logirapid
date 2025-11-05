'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import QRCodeLib from 'qrcode'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import {
  Package,
  Plus,
  Search,
  QrCode,
  Printer,
  Box,
  Tag,
  Download,
  ChevronLeft,
  ChevronRight,
  FileDown,
  X,
  Clock,
  User,
  Calendar,
  PackageOpen,
  Truck,
  PackageCheck
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/contexts/NotificationContext'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface BoxItem {
  id: string
  barcode: string
  size: string
  status: string
  createdAt: string
  qrCode: string
  supplier: string
  cost: number
  hasBarcode?: boolean
  current_location?: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function PackageRoute() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { showNotification } = useNotifications()

  const [boxes, setBoxes] = useState<BoxItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // Estados para filtros
  const [selectedWarehouse, setSelectedWarehouse] = useState('')
  const [selectedSize, setSelectedSize] = useState('')

  // Form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newBoxForm, setNewBoxForm] = useState({
    quantity: 100,
    size: 'mediano',
    supplier: 'LogiRapid',
    cost: 0,
    warehouseId: '', // Nuevo campo para almacén
    labelSize: '2x2' // '2x2' o 'carta'
  })
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [selectedBox, setSelectedBox] = useState<BoxItem | null>(null)
  const [showBoxDetails, setShowBoxDetails] = useState(false)
  const [boxQRCode, setBoxQRCode] = useState<string>('')
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)

  // Generate unique barcode
  const generateUniqueBarcode = () => {
    return `PKG${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`
  }

  // Generate QR code for selected box
  const generateBoxQRCode = async (box: BoxItem) => {
    try {
      const qrDataUrl = await QRCodeLib.toDataURL(box.barcode, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      })
      setBoxQRCode(qrDataUrl)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  // Load warehouses from API
  const loadWarehouses = async () => {
    try {
      setLoadingWarehouses(true)
      const response = await fetch('/api/warehouses')
      if (response.ok) {
        const data = await response.json()
        setWarehouses(data.data || [])
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
      showNotification('error', 'Error', 'No se pudieron cargar los almacenes')
    } finally {
      setLoadingWarehouses(false)
    }
  }

  // Load boxes with pagination
  const loadBoxes = async (page: number = 1) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/packages?type=boxes&page=${page}&limit=${pagination.limit}`)
      if (response.ok) {
        const data = await response.json()
        console.log('Cajas cargadas:', data.boxes?.[0]) // Debug
        setBoxes(data.boxes || [])
        setPagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages
        })
      } else {
        showNotification('error', 'Error', 'Error al cargar las cajas')
      }
    } catch (error) {
      console.error('Error loading boxes:', error)
      showNotification('error', 'Error', 'Error al cargar las cajas')
    } finally {
      setLoading(false)
    }
  }

  // Crear nuevas cajas y generar PDF
  const createBoxesAndGeneratePDF = async () => {
    if (!newBoxForm.quantity || newBoxForm.quantity < 1) {
      showNotification('warning', 'Advertencia', 'Ingrese una cantidad válida (mínimo 1)')
      return
    }

    if (!newBoxForm.warehouseId) {
      showNotification('warning', 'Advertencia', 'Seleccione un almacén para crear las cajas')
      return
    }

    try {
      setLoading(true)

      // Obtener nombre del almacén seleccionado
      console.log('Warehouses disponibles:', warehouses) // Debug
      console.log('Warehouse ID seleccionado:', newBoxForm.warehouseId) // Debug

      // Buscar el almacén de forma más robusta
      const selectedWarehouse = warehouses.find(w =>
        w.id.toString() === newBoxForm.warehouseId.toString()
      )

      let warehouseName = selectedWarehouse ? selectedWarehouse.name : ''

      // Si aún no encontramos el almacén, intentar con diferentes formatos
      if (!warehouseName && newBoxForm.warehouseId) {
        console.log('Buscando almacén con ID:', newBoxForm.warehouseId) // Debug

        // Intentar búsqueda exacta
        const exactMatch = warehouses.find(w =>
          String(w.id) === String(newBoxForm.warehouseId) ||
          w.id === newBoxForm.warehouseId
        )

        if (exactMatch) {
          warehouseName = exactMatch.name
          console.log('Almacén encontrado por coincidencia exacta:', warehouseName) // Debug
        } else {
          warehouseName = 'Almacén desconocido'
          console.log('Almacén no encontrado, usando fallback') // Debug
        }
      }

      console.log('Warehouse encontrado:', selectedWarehouse, 'Nombre final:', warehouseName) // Debug

      // Validación final
      if (!warehouseName) {
        showNotification('warning', 'Advertencia', 'No se pudo determinar el almacén seleccionado')
        return
      }

      // Generar codigos para todas las cajas
      const newBoxes: BoxItem[] = []
      for (let i = 0; i < newBoxForm.quantity; i++) {
        const barcode = generateUniqueBarcode()
        newBoxes.push({
          id: '',
          barcode,
          size: newBoxForm.size,
          status: 'CREATED',
          createdAt: new Date().toISOString(),
          qrCode: barcode,
          supplier: newBoxForm.supplier,
          cost: newBoxForm.cost,
          current_location: warehouseName // Agregar el almacén
        })
      }

      // Guardar en base de datos
      console.log('Enviando cajas con almacén:', warehouseName, newBoxes[0]) // Debug
      const response = await fetch('/api/packages?type=boxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boxes: newBoxes,
          batch: {
            size: newBoxForm.size,
            supplier: newBoxForm.supplier,
            cost: newBoxForm.cost,
            current_location: warehouseName, // Agregar almacén al batch
            created_at: new Date().toISOString()
          }
        }),
      })

      if (response.ok) {
        showNotification('success', 'Éxito', `✅ Se crearon ${newBoxForm.quantity} cajas exitosamente`)

        // Generar PDF automáticamente según el tamaño de etiqueta
        await generatePDFWithAllQR(newBoxes, newBoxForm.labelSize)

        setShowCreateForm(false)
        setNewBoxForm({
          quantity: 100,
          size: 'mediano',
          supplier: 'LogiRapid',
          cost: 0,
          warehouseId: '',
          labelSize: '2x2'
        })
        loadBoxes(1) // Recargar primera pagina
      } else {
        showNotification('error', 'Error', 'Error al crear las cajas')
      }
    } catch (error) {
      console.error('Error creating boxes:', error)
      showNotification('error', 'Error', 'Error al crear las cajas')
    } finally {
      setLoading(false)
    }
  }

  // Generar PDF con un solo QR para impresión individual
  const generateSingleQRLabel = async (box: BoxItem) => {
    try {
      setIsGeneratingPDF(true)

      // Generar QR code para esta caja específica
      const qrDataUrl = await QRCodeLib.toDataURL(box.barcode, {
        width: 220,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      })

      // Crear HTML para etiqueta individual de 2x2 pulgadas
      const labelContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Etiqueta QR - ${box.barcode}</title>
            <style>
              @page {
                size: 2in 2in;
                margin: 0;
              }
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 0;
                background: white;
                width: 2in;
                height: 2in;
              }
              .page-wrapper {
                width: 2in;
                height: 2in;
                display: flex;
                flex-direction: column;
                position: relative;
              }
              .page-content {
                flex: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 100%;
                padding: 0;
                margin: 0;
              }
              .label-container {
                width: 2in;
                height: 2in;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 0;
                margin: 0;
              }
              .label-page {
                width: 2in;
                height: 2in;
                background: white;
                border: 2px solid #000;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                position: relative;
                padding: 4px;
                box-sizing: border-box;
              }
              .label-qr {
                display: flex;
                justify-content: center;
                align-items: center;
                margin-bottom: 4px;
              }
              .label-qr img {
                width: 140px;
                height: 140px;
                object-fit: contain;
              }
              .label-text {
                font-size: 6px;
                font-weight: bold;
                text-align: center;
                line-height: 1.1;
                width: 100%;
                margin-bottom: 2px;
              }
              .label-info {
                font-size: 5px;
                color: #666;
                text-align: center;
                width: 100%;
                margin-bottom: 0px;
              }
              .agency-name {
                font-size: 4px;
                color: #333;
                font-weight: bold;
                margin-top: 1px;
                text-align: center;
                width: 100%;
                position: absolute;
                bottom: 4px;
                left: 0;
                right: 0;
              }
              @media print {
                body {
                  margin: 0;
                  padding: 0;
                  background: white;
                  width: 2in;
                  height: 2in;
                }
                .page-wrapper {
                  margin: 0;
                  padding: 0;
                  page-break-inside: avoid;
                  width: 2in;
                  height: 2in;
                }
                .page-content {
                  margin: 0;
                  padding: 0;
                  width: 2in;
                  height: 2in;
                }
                .label-container {
                  width: 2in;
                  height: 2in;
                }
                .label-page {
                  width: 2in;
                  height: 2in;
                  border: 2px solid #000;
                  margin: 0;
                  padding: 4px;
                  box-sizing: border-box;
                }
                .agency-name {
                  font-size: 4px;
                  color: #333;
                  font-weight: bold;
                  margin-top: 1px;
                  text-align: center;
                  width: 100%;
                  position: absolute;
                  bottom: 4px;
                  left: 0;
                  right: 0;
                }
              }
            </style>
          </head>
          <body>
            <div class="page-wrapper">
              <div class="page-content">
                <div class="label-container">
                  <div class="label-page">
                    <div class="label-qr">
                      <img src="${qrDataUrl}" alt="QR Code" />
                    </div>
                    <div class="label-text">${box.barcode}</div>
                    <div class="label-info">
                      Caja ${box.size.toUpperCase() === 'MEDIANO' ? 'MEDIANA' : box.size.toUpperCase()}
                    </div>
                    <div class="agency-name">
                      CUBARAPID EXPRESS
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                }, 500);
              }
            </script>
          </body>
        </html>
      `

      // Abrir ventana de impresión
      const printWindow = window.open('', '_blank', 'width=200,height=200')
      if (printWindow) {
        printWindow.document.write(labelContent)
        printWindow.document.close()

        showNotification('success', 'Éxito', `Etiqueta generada para ${box.barcode}`)
      }

    } catch (error) {
      console.error('Error generating single QR label:', error)
      showNotification('error', 'Error', 'Error al generar etiqueta individual')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // Descargar PDF de una caja individual
  const downloadBoxPDF = async (box: BoxItem) => {
    try {
      setIsGeneratingPDF(true)

      // Generar QR code para esta caja específica
      const qrDataUrl = await QRCodeLib.toDataURL(box.barcode, {
        width: 220,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      })

      // Crear elemento HTML temporal para generar el PDF
      const tempDiv = document.createElement('div')
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.top = '-9999px'
      tempDiv.style.width = '144px'
      tempDiv.style.height = '144px'
      tempDiv.style.background = 'white'
      tempDiv.style.border = '2px solid #000'
      tempDiv.style.padding = '8px'
      tempDiv.style.display = 'flex'
      tempDiv.style.flexDirection = 'column'
      tempDiv.style.justifyContent = 'center'
      tempDiv.style.alignItems = 'center'
      tempDiv.style.fontFamily = 'Arial, sans-serif'

      tempDiv.innerHTML = `
        <div style="margin-bottom: 4px;">
          <img src="${qrDataUrl}" style="width: 120px; height: 120px;" alt="QR Code" />
        </div>
        <div style="font-size: 8px; font-weight: bold; text-align: center; margin-bottom: 2px; line-height: 1.1;">
          ${box.barcode}
        </div>
        <div style="font-size: 6px; color: #666; text-align: center; margin-bottom: 1px;">
          Caja ${box.size.toUpperCase() === 'MEDIANO' ? 'MEDIANA' : box.size.toUpperCase()}
        </div>
        <div style="font-size: 5px; color: #333; font-weight: bold; text-align: center; margin-top: 2px;">
          CUBARAPID EXPRESS
        </div>
      `

      document.body.appendChild(tempDiv)

      // Generar PDF usando html2canvas y jsPDF
      const canvas = await html2canvas(tempDiv, {
        scale: 4,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [50.8, 50.8] // 2x2 pulgadas = 50.8x50.8mm
      })

      pdf.addImage(imgData, 'PNG', 0, 0, 50.8, 50.8)

      // Descargar el PDF
      pdf.save(`etiqueta_${box.barcode}.pdf`)

      // Limpiar elemento temporal
      document.body.removeChild(tempDiv)

      showNotification('success', 'Éxito', `PDF descargado para ${box.barcode}`)

    } catch (error) {
      console.error('Error downloading box PDF:', error)
      showNotification('error', 'Error', 'Error al descargar PDF de la caja')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // Función para obtener el nombre del almacén basado en el current_location
  const getWarehouseDisplayName = (currentLocation: string) => {
    if (!currentLocation || currentLocation === 'Almacén Principal') {
      return currentLocation
    }

    // Si contiene "Almacén ID:", buscar el código real
    if (currentLocation.includes('Almacén ID:')) {
      const warehouseId = currentLocation.replace('Almacén ID:', '').trim()
      const warehouse = warehouses.find(w => w.id.toString() === warehouseId)
      return warehouse ? `${warehouse.name} (${warehouse.code})` : currentLocation
    }

    // Si es un nombre de ciudad o nombre de almacén, buscar por nombre o ciudad
    const warehouse = warehouses.find(w =>
      w.name === currentLocation ||
      w.city === currentLocation ||
      w.code === currentLocation
    )

    if (warehouse) {
      return `${warehouse.name} (${warehouse.code})`
    }

    return currentLocation
  }

  // Generar datos de trazabilidad dinámicos para una caja
  const getBoxTrackingData = (box: BoxItem) => {
    // Obtener información dinámica del almacén con nombre real
    const warehouseLocation = getWarehouseDisplayName(box.current_location || 'warehouse_1')

    // Solo mostrar el evento real de creación
    const trackingEvents = [
      {
        id: 1,
        date: box.createdAt,
        type: 'created',
        description: 'Caja creada y registrada en el sistema',
        location: warehouseLocation,
        user: user?.name || 'Sistema',
        icon: Package,
        color: 'blue'
      }
    ]

    return trackingEvents
  }

  // Formatear fecha para mostrar
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible'

    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Fecha inválida'

    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Generar PDF con todos los QR reales según tamaño de etiqueta
  const generatePDFWithAllQR = async (boxList?: BoxItem[], labelSize?: string) => {
    const boxesToProcess = boxList || boxes
    const selectedLabelSize = labelSize || '2x2'

    if (boxesToProcess.length === 0) {
      showNotification('warning', 'Advertencia', 'No hay cajas para generar PDF')
      return
    }

    try {
      setIsGeneratingPDF(true)

      // Generar codigos QR reales para todas las cajas
      const qrCodesData = []
      for (let i = 0; i < boxesToProcess.length; i++) {
        const box = boxesToProcess[i]
        try {
          const qrDataUrl = await QRCodeLib.toDataURL(box.barcode, {
            width: selectedLabelSize === '2x2' ? 144 : 200, // Tamaño según etiqueta
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
          })
          qrCodesData.push({
            ...box,
            qrDataUrl,
            index: i + 1
          })
        } catch (error) {
          console.error('Error generating QR for box', box.id, error)
        }
      }

      let pdfContent = ''

      if (selectedLabelSize === '2x2') {
        // Generar PDF con etiquetas 2x2 (1 etiqueta por página, página de 2x2 pulgadas)
        const totalPages = qrCodesData.length // 1 etiqueta por página

        let allPagesHTML = ''
        for (let page = 0; page < totalPages; page++) {
          const item = qrCodesData[page]

          // Generar HTML para esta página con 1 sola etiqueta de 2x2 pulgadas
          allPagesHTML += `
            <div class="page-wrapper" ${page > 0 ? 'style="page-break-before: always;"' : ''}>
              <div class="page-content">
                <div class="label-container">
                  <div class="label-page">
                    <div class="cut-line"></div>
                    <div class="label-qr">
                      <img src="${item.qrDataUrl}" alt="QR Code" />
                    </div>
                    <div class="label-text">${item.barcode}</div>
                    <div class="label-info">
                      Caja ${item.index + 1} | ${item.size.toUpperCase()}
                    </div>
                    <div class="agency-name">
                      CUBARAPID EXPRESS
                    </div>
                  </div>
                </div>
              </div>
              <div class="page-number">
                Etiqueta ${page + 1} de ${totalPages}
              </div>
            </div>
          `
        }

        pdfContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Etiquetas QR 2x2 - Sistema de Empaque</title>
              <style>
                @page {
                  size: 2in 2in;
                  margin: 0;
                }
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 0;
                  background: white;
                  width: 2in;
                  height: 2in;
                }
                .page-wrapper {
                  width: 2in;
                  height: 2in;
                  display: flex;
                  flex-direction: column;
                  position: relative;
                }
                .page-content {
                  flex: 1;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  width: 100%;
                  height: 100%;
                  padding: 0;
                  margin: 0;
                }
                .label-container {
                  width: 2in;
                  height: 2in;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  padding: 0;
                  margin: 0;
                }
                .label-page {
                  width: 2in;
                  height: 2in;
                  background: white;
                  border: 2px solid #000;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  position: relative;
                  padding: 4px;
                  box-sizing: border-box;
                }
                  align-items: center;
                  justify-content: center;
                  padding: 8px;
                  box-sizing: border-box;
                  position: relative;
                  margin: 0;
                }
                .label-qr {
                  width: 1.2in;
                  height: 1.2in;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-bottom: 4px;
                }
                .label-qr img {
                  max-width: 100%;
                  max-height: 100%;
                  object-fit: contain;
                }
                .label-text {
                  font-family: monospace;
                  font-size: 7px;
                  text-align: center;
                  word-break: break-all;
                  line-height: 1.1;
                  width: 100%;
                  font-weight: bold;
                }
                .label-info {
                  font-size: 6px;
                  color: #666;
                  margin-top: 2px;
                  text-align: center;
                  width: 100%;
                }
                .agency-name {
                  font-size: 4px;
                  color: #333;
                  font-weight: bold;
                  margin-top: 1px;
                  text-align: center;
                  width: 100%;
                  position: absolute;
                  bottom: 4px;
                  left: 0;
                  right: 0;
                }
                .cut-line {
                  position: absolute;
                  border: 1px dashed #ccc;
                  top: 2px;
                  left: 2px;
                  right: 2px;
                  bottom: 2px;
                  pointer-events: none;
                }
                .page-number {
                  text-align: center;
                  font-size: 10px;
                  color: #999;
                  margin-top: 10px;
                  padding: 5px;
                }
                @media print {
                  body {
                    margin: 0;
                    padding: 0;
                    background: white;
                    width: 2in;
                    height: 2in;
                  }
                  .page-wrapper {
                    margin: 0;
                    padding: 0;
                    page-break-inside: avoid;
                    width: 2in;
                    height: 2in;
                  }
                  .page-content {
                    margin: 0;
                    padding: 0;
                    width: 2in;
                    height: 2in;
                  }
                  .label-container {
                    width: 2in;
                    height: 2in;
                  }
                  .label-page {
                    width: 2in;
                    height: 2in;
                    border: 2px solid #000;
                    margin: 0;
                    padding: 4px;
                    box-sizing: border-box;
                  }
                  .cut-line {
                    display: none;
                  }
                  .page-number {
                    display: none;
                  }
                  .agency-name {
                    font-size: 4px;
                    color: #333;
                    font-weight: bold;
                    margin-top: 1px;
                    text-align: center;
                    width: 100%;
                    position: absolute;
                    bottom: 4px;
                    left: 0;
                    right: 0;
                  }
                }
              </style>
            </head>
            <body>
              ${allPagesHTML}
              <script>
                window.onload = function() {
                  setTimeout(() => {
                    window.print();
                  }, 2000);
                }
              </script>
            </body>
          </html>
        `
      } else {
        // Generar PDF con etiquetas tamaño carta (todas en una página)
        const labelsHTML = qrCodesData.map((item) => {
          return `
            <div class="label-item">
              <div class="label-qr">
                <img src="${item.qrDataUrl}" alt="QR Code" />
              </div>
              <div class="label-text">${item.barcode}</div>
              <div class="label-info">
                Caja ${item.index} | ${item.size.toUpperCase()}
              </div>
            </div>
          `
        }).join('')

        pdfContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Etiquetas QR Carta - Sistema de Empaque</title>
              <style>
                @page {
                  size: Letter;
                  margin: 1cm;
                  orientation: landscape;
                }
                body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background: white;
                }
                .header {
                  text-align: center;
                  margin-bottom: 20px;
                  padding: 10px;
                  background: #f9f9f9;
                  border-radius: 5px;
                  border: 1px solid #ddd;
                }
                .label-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                  gap: 15px;
                  justify-items: center;
                }
                .label-item {
                  width: 140px;
                  height: 140px;
                  background: white;
                  border: 2px solid #333;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 8px;
                  box-sizing: border-box;
                  position: relative;
                  border-radius: 8px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .label-qr {
                  width: 80px;
                  height: 80px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin-bottom: 4px;
                }
                .label-qr img {
                  max-width: 100%;
                  max-height: 100%;
                  object-fit: contain;
                }
                .label-text {
                  font-family: monospace;
                  font-size: 8px;
                  text-align: center;
                  word-break: break-all;
                  line-height: 1.1;
                  width: 100%;
                  font-weight: bold;
                }
                .label-info {
                  font-size: 7px;
                  color: #666;
                  margin-top: 2px;
                  text-align: center;
                  width: 100%;
                }
                @media print {
                  body {
                    margin: 0.5cm;
                    padding: 10px;
                  }
                  .header {
                    display: none;
                  }
                  .label-grid {
                    gap: 10px;
                  }
                  .label-item {
                    box-shadow: none;
                  }
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h2>Etiquetas QR - Sistema de Empaque</h2>
                <p>Fecha: ${new Date().toLocaleDateString('es-CO')} | Total: ${qrCodesData.length} etiquetas</p>
                <p style="font-size: 12px; color: #666;">Formato: Tamaño Carta | Todas las etiquetas en una página</p>
              </div>
              <div class="label-grid">
                ${labelsHTML}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(() => {
                    window.print();
                  }, 1500);
                }
              </script>
            </body>
          </html>
        `
      }

      // Abrir nueva ventana para imprimir
      const printWindow = window.open('', '_blank', 'width=1200,height=800')
      if (printWindow) {
        printWindow.document.write(pdfContent)
        printWindow.document.close()

        showNotification('success', 'Éxito', `✅ PDF generado con ${qrCodesData.length} códigos QR (Formato: ${selectedLabelSize})`)
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      showNotification('error', 'Error', 'Error al generar el PDF')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // Filtrar cajas
  const filteredBoxes = boxes.filter(box => {
    // Filtro de búsqueda general
    const matchesSearch =
      box.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      box.size.toLowerCase().includes(searchTerm.toLowerCase()) ||
      box.supplier.toLowerCase().includes(searchTerm.toLowerCase())

    // Filtro por almacén
    const matchesWarehouse = !selectedWarehouse || (() => {
      // Si no hay almacén seleccionado, mostrar todos
      if (!selectedWarehouse) return true

      // Buscar el almacén seleccionado por ID
      const selectedWarehouseData = warehouses.find(w => w.id.toString() === selectedWarehouse)

      if (!selectedWarehouseData) return true

      // Comparar con el current_location de la caja por nombre, ciudad o código
      return box.current_location === selectedWarehouseData.name ||
             box.current_location === selectedWarehouseData.city ||
             box.current_location === selectedWarehouseData.code ||
             box.current_location === `Almacén ID: ${selectedWarehouse}`
    })()

    // Filtro por tamaño
    const matchesSize = !selectedSize || box.size === selectedSize

    return matchesSearch && matchesWarehouse && matchesSize
  })

  // Paginación
  const goToPage = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      loadBoxes(page)
    }
  }

  // Cargar datos iniciales
  useEffect(() => {
    loadBoxes(1)
    loadWarehouses()
  }, [])

  if (!user) {
    return <div>Cargando...</div>
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col p-6">
        {/* Header */}
    
        {/* Estadisticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
          {/* Total Cajas */}
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
                    <Box className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>Total Cajas</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{pagination.total}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>En inventario</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Disponibles */}
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
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-green-900/30 border border-green-800/50'
                      : 'bg-gradient-to-br from-green-50 to-green-100 border border-green-200'
                  )}>
                    <Package className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>Disponibles</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{boxes.filter(b => b.status === 'AVAILABLE').length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>Listas para uso</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Entregadas */}
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
                    <Truck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>Entregadas</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{boxes.filter(b => b.status === 'IN_USE').length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>Entregadas a clientes</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Recogidas */}
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
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-orange-600"></div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'p-3 rounded-xl shadow-sm',
                    theme === 'dark'
                      ? 'bg-orange-900/30 border border-orange-800/50'
                      : 'bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200'
                  )}>
                    <PackageCheck className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <p className={cn(
                      'text-sm font-medium',
                      theme === 'dark' ? 'text-gray-400' : 'text-black'
                    )}>Recogidas</p>
                    <p className={cn(
                      'text-3xl font-bold mt-1',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}>{boxes.filter(b => b.hasBarcode).length}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  <span className={cn(
                    'text-xs font-medium',
                    theme === 'dark' ? 'text-gray-500' : 'text-black'
                  )}>Con código QR</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Barra de busqueda y botones */}
        <div className={cn(
          "rounded-lg border p-4 mb-6",
          theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center justify-between gap-4">
            {/* Buscador y filtros en una línea */}
            <div className="flex items-center gap-3 flex-1">
              <div className="flex-1 relative max-w-md">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                  theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )} />
                <Input
                  placeholder="Buscar cajas por codigo, tamano o proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "pl-10 w-full h-10",
                    theme === 'dark' ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"
                  )}
                />
              </div>

              {/* Filtros de píldora compactos */}
              <div className="flex items-center gap-2">
                {/* Filtro por almacenes */}
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-xs font-medium mr-1 whitespace-nowrap",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    Almacén:
                  </span>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-md border w-40",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-700"
                    )}
                  >
                    <option value="">Todos</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro por tamaños */}
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-xs font-medium mr-1 whitespace-nowrap",
                    theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    Tamaño:
                  </span>
                  <select
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    className={cn(
                      "px-3 py-2 text-sm rounded-md border w-40 capitalize",
                      theme === 'dark'
                        ? "bg-gray-700 border-gray-600 text-white"
                        : "bg-white border-gray-300 text-gray-700"
                    )}
                  >
                    <option value="">Todos</option>
                    <option value="pequeño">Pequeño</option>
                    <option value="mediano">Mediano</option>
                    <option value="grande">Grande</option>
                    <option value="extra grande">Extra Grande</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Botón Crear Cajas */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowCreateForm(true)}
                className="text-white px-4 border-0 transition-colors"
                style={{
                  background: 'var(--brand-blue)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--brand-blue-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--brand-blue)'
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Cajas
              </Button>
            </div>
          </div>
        </div>

        {/* Formulario de creacion */}
        {showCreateForm && (
          <div className={cn(
            "rounded-xl border-2 shadow-xl p-8 mb-6",
            theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          )}>
            <div className="text-center mb-8">
              <h3 className={cn(
                "text-2xl font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                Generador de Códigos de Barras
              </h3>
              <p className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Complete la información para generar códigos QR únicos
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Cantidad */}
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              )}>
                <label className={cn(
                  "block text-sm font-semibold mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  📦 Cantidad de Cajas
                </label>
                <Input
                  type="number"
                  min="1"
                  max="1000"
                  value={newBoxForm.quantity}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setNewBoxForm({...newBoxForm, quantity: 0});
                    } else {
                      const numValue = parseInt(value);
                      if (!isNaN(numValue) && numValue >= 1) {
                        setNewBoxForm({...newBoxForm, quantity: numValue});
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '' || parseInt(value) < 1) {
                      setNewBoxForm({...newBoxForm, quantity: 1});
                    }
                  }}
                  className={cn(
                    "text-lg font-semibold",
                    theme === 'dark' ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                  )}
                  placeholder="100"
                />
              </div>

              {/* Tamano de caja */}
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              )}>
                <label className={cn(
                  "block text-sm font-semibold mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  📏 Tamaño de Caja
                </label>
                <select
                  value={newBoxForm.size}
                  onChange={(e) => setNewBoxForm({...newBoxForm, size: e.target.value})}
                  className={cn(
                    "w-full px-3 py-2 h-10 rounded-md border text-lg font-semibold",
                    theme === 'dark' ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                  )}
                >
                  <option value="pequeno">Pequeno</option>
                  <option value="mediano">Mediano</option>
                  <option value="grande">Grande</option>
                  <option value="extra grande">Extra Grande</option>
                </select>
              </div>

              {/* Precio */}
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              )}>
                <label className={cn(
                  "block text-sm font-semibold mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  💰 Precio Unitario
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newBoxForm.cost}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setNewBoxForm({...newBoxForm, cost: 0});
                    } else {
                      const numValue = parseFloat(value);
                      if (!isNaN(numValue) && numValue >= 0) {
                        setNewBoxForm({...newBoxForm, cost: numValue});
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value === '' || parseFloat(value) < 0) {
                      setNewBoxForm({...newBoxForm, cost: 0});
                    }
                  }}
                  className={cn(
                    "text-lg font-semibold",
                    theme === 'dark' ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                  )}
                  placeholder="0.00"
                />
              </div>

              {/* Nombre del proveedor */}
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              )}>
                <label className={cn(
                  "block text-sm font-semibold mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  🏢 Nombre del Proveedor
                </label>
                <Input
                  value={newBoxForm.supplier}
                  onChange={(e) => setNewBoxForm({...newBoxForm, supplier: e.target.value})}
                  className={cn(
                    theme === 'dark' ? "bg-gray-600 border-gray-500 text-white" : "bg-white border-gray-300"
                  )}
                  placeholder="LogiRapid"
                />
              </div>

              {/* Tamano del label */}
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              )}>
                <label className={cn(
                  "block text-sm font-semibold mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  🏷️ Tamaño de Etiqueta
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNewBoxForm({...newBoxForm, labelSize: '2x2'})}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200 border-0 hover:scale-105 transform",
                      newBoxForm.labelSize === '2x2'
                        ? "text-white shadow-lg"
                        : "text-white shadow-md hover:shadow-lg"
                    )}
                    style={{
                      background: newBoxForm.labelSize === '2x2'
                        ? 'var(--brand-blue)'
                        : 'var(--brand-gray)',
                    }}
                    onMouseEnter={(e) => {
                      if (newBoxForm.labelSize !== '2x2') {
                        e.currentTarget.style.background = 'var(--brand-blue)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (newBoxForm.labelSize !== '2x2') {
                        e.currentTarget.style.background = 'var(--brand-gray)'
                      }
                    }}
                  >
                    2x2
                  </button>
                  <button
                    onClick={() => setNewBoxForm({...newBoxForm, labelSize: 'carta'})}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-semibold transition-all duration-200 border-0 hover:scale-105 transform",
                      newBoxForm.labelSize === 'carta'
                        ? "text-white shadow-lg"
                        : "text-white shadow-md hover:shadow-lg"
                    )}
                    style={{
                      background: newBoxForm.labelSize === 'carta'
                        ? 'var(--brand-blue)'
                        : 'var(--brand-gray)',
                    }}
                    onMouseEnter={(e) => {
                      if (newBoxForm.labelSize !== 'carta') {
                        e.currentTarget.style.background = 'var(--brand-blue)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (newBoxForm.labelSize !== 'carta') {
                        e.currentTarget.style.background = 'var(--brand-gray)'
                      }
                    }}
                  >
                    Carta
                  </button>
                </div>
              </div>

              {/* Selección de Almacén */}
              <div className={cn(
                "p-4 rounded-lg border",
                theme === 'dark' ? "bg-gray-700 border-gray-600" : "bg-gray-50 border-gray-200"
              )}>
                <label className={cn(
                  "block text-sm font-semibold mb-2",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  🏢 Almacén de Creación <span className="text-red-500">*</span>
                </label>
                <select
                  value={newBoxForm.warehouseId}
                  onChange={(e) => setNewBoxForm({...newBoxForm, warehouseId: e.target.value})}
                  className={cn(
                    "w-full px-3 py-2 h-10 rounded-md border text-lg font-semibold transition-colors",
                    theme === 'dark'
                      ? "bg-gray-600 border-gray-500 text-white"
                      : "bg-white border-gray-300",
                    // Validación visual
                    !newBoxForm.warehouseId
                      ? "border-red-500 focus:ring-red-500 focus:border-red-500"
                      : "focus:ring-blue-500 focus:border-blue-500"
                  )}
                  disabled={loadingWarehouses}
                  required
                >
                  <option value="">Selecciona un almacén...</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} - {warehouse.code} - {warehouse.city}
                    </option>
                  ))}
                </select>
                {!newBoxForm.warehouseId && (
                  <p className="mt-1 text-sm text-red-500">
                    ⚠️ Debes seleccionar un almacén para continuar
                  </p>
                )}
                  </div>
            </div>

            {/* Botones de acción */}
            <div className="flex gap-4 justify-center">
              <Button
                onClick={createBoxesAndGeneratePDF}
                disabled={loading || !newBoxForm.quantity || newBoxForm.quantity < 1 || !newBoxForm.warehouseId || newBoxForm.warehouseId === ''}
                className="shadow-lg transform transition-all hover:scale-105 text-white px-8 py-3 text-lg font-semibold border-0"
                style={{
                  background: 'var(--brand-blue)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--brand-blue-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--brand-blue)'
                }}
              >
                <QrCode className="w-5 h-5 mr-2" />
                {loading ? 'Generando...' : 'Generar'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                className="shadow-lg transform transition-all hover:scale-105 text-white px-8 py-3 text-lg font-semibold border-0"
                style={{
                  background: 'var(--brand-red)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--brand-red-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--brand-red)'
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Información de la Caja Seleccionada */}
        {selectedBox && (
          <div className="rounded-lg p-4 mb-6 bg-gray-800 border border-gray-700">
            <h3 className="text-lg font-medium mb-3 text-white">Información de la Caja</h3>
            <div className="flex gap-6">
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-400">Código:</span>
                    <p className="font-mono text-white">{selectedBox.barcode}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">Tamaño:</span>
                    <p className="text-white">{selectedBox.size.toUpperCase()}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">Proveedor:</span>
                    <p className="text-white">{selectedBox.supplier}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">Costo:</span>
                    <p className="text-white">${selectedBox.cost.toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">Estado:</span>
                    <p className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium inline-block w-fit",
                      selectedBox.status === 'AVAILABLE'
                        ? "bg-green-900 text-green-200"
                        : "bg-blue-900 text-blue-200"
                    )}>
                      {selectedBox.status === 'AVAILABLE' ? 'Disponible' : 'En Uso'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-400">Creada:</span>
                    <p className="text-white">{formatDate(selectedBox.createdAt)}</p>
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-start">
                <div className="w-44 h-44 rounded-lg border-2 border-dashed flex items-center justify-center p-4 border-gray-600 bg-gray-700/50">
                  <img
                    alt="QR Code"
                    className="w-40 h-40"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(selectedBox.barcode)}`}
                  />
                </div>
              </div>
            </div>
            {/* Botones de acción */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => generateSingleQRLabel(selectedBox)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-green-600 hover:bg-green-700 text-white",
                  "flex items-center gap-2",
                  isGeneratingPDF && "opacity-50 cursor-not-allowed"
                )}
                disabled={isGeneratingPDF}
              >
                <QrCode className="w-4 h-4" />
                Imprimir Etiqueta
              </button>
              <button
                onClick={() => console.log('Generate PDF for box:', selectedBox.id)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  "bg-blue-600 hover:bg-blue-700 text-white",
                  "flex items-center gap-2",
                  isGeneratingPDF && "opacity-50 cursor-not-allowed"
                )}
                disabled={isGeneratingPDF}
              >
                <FileDown className="w-4 h-4" />
                Descargar PDF
              </button>
            </div>
          </div>
        )}

        {/* Lista de cajas con paginacion */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-4">
            {filteredBoxes.map((box, index) => (
              <div
                key={box.id}
                onClick={() => {
                  setSelectedBox(box)
                  setShowBoxDetails(true)
                  generateBoxQRCode(box)
                }}
                className={cn(
                  "group relative overflow-hidden rounded-xl border transition-all duration-300 cursor-pointer",
                  "hover:shadow-lg hover:border-blue-500/50",
                  theme === 'dark'
                    ? "bg-gray-800/80 border-gray-700"
                    : "bg-white border-gray-200"
                )}
              >
                {/* Contenido horizontal */}
                <div className="flex items-center gap-4 p-4">
                  {/* Icono de la caja */}
                  <div className="relative">
                    <div className={cn(
                      "w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0",
                      box.status === 'AVAILABLE'
                        ? theme === 'dark' ? "bg-green-900/30" : "bg-green-100"
                        : theme === 'dark' ? "bg-blue-900/30" : "bg-blue-100"
                    )}>
                      <Box className={cn(
                        "w-8 h-8",
                        box.status === 'AVAILABLE'
                          ? "text-green-600"
                          : "text-blue-600"
                      )} />
                    </div>

                    {/* Indicador de estado */}
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                      theme === 'dark' ? "border-gray-800" : "border-white",
                      box.status === 'AVAILABLE'
                        ? "bg-green-500"
                        : "bg-blue-500"
                    )}>
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  </div>

                  {/* Contenido principal con QR Code centrado a la derecha */}
                  <div className="flex flex-1 min-w-0 gap-3">
                    {/* Contenido de información - lado izquierdo */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Título y etiquetas */}
                      <div className="min-w-0">
                        <h3 className={cn(
                          "font-bold text-lg mb-1 group-hover:text-blue-600 transition-colors truncate",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          Caja {box.size.toUpperCase()} #{(pagination.page - 1) * pagination.limit + index + 1}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-md font-medium",
                            theme === 'dark' ? "bg-gray-700 text-gray-300" : "bg-gray-100 text-gray-700"
                          )}>
                            {box.size === 'mediano' ? 'Mediana' : box.size.toUpperCase()}
                          </span>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            box.status === 'AVAILABLE'
                              ? theme === 'dark' ? "bg-green-900/50 text-green-300" : "bg-green-100 text-green-800"
                              : theme === 'dark' ? "bg-blue-900/50 text-blue-300" : "bg-blue-100 text-blue-800"
                          )}>
                            {box.status === 'AVAILABLE' ? 'Disponible' : 'En Uso'}
                          </span>
                          <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full font-medium",
                              theme === 'dark' ? "bg-orange-900/50 text-orange-300" : "bg-orange-100 text-orange-800"
                            )}>
                              📍 {getWarehouseDisplayName(box.current_location || 'warehouse_1')}
                            </span>
                          {box.hasBarcode && (
                            <div className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded bg-purple-600 border border-purple-600 flex items-center justify-center">
                                <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <span className={cn(
                                "text-xs font-medium",
                                theme === 'dark' ? "text-purple-400" : "text-purple-600"
                              )}>
                                Código
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Información adicional */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "text-sm font-mono font-medium",
                            theme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>
                            {box.barcode}
                          </div>
                          <div className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                          )}>
                            🕒 {formatDate(box.createdAt)}
                          </div>
                        </div>
                        <div className={cn(
                          "text-xs",
                          theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>
                          {box.supplier}
                        </div>
                        </div>
                    </div>

                    {/* QR Code y botones - centrado en el espacio disponible */}
                    {box.hasBarcode && (
                      <div className="flex flex-col items-center justify-center gap-2 pr-2">
                        {/* QR Code pequeño con generación real */}
                        <div className="relative">
                          <div className={cn(
                            "w-12 h-12 rounded border border-gray-300 dark:border-gray-600 bg-white flex items-center justify-center",
                            "overflow-hidden"
                          )}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=48x48&data=${encodeURIComponent(box.barcode)}`}
                              alt="QR Code"
                              className="w-10 h-10"
                              onError={(e) => {
                                // Fallback a icono si la imagen no carga
                                e.currentTarget.style.display = 'none'
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex'
                                }
                              }}
                            />
                            <div className="hidden w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                              <QrCode className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                            </div>
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              generateSingleQRLabel(box)
                            }}
                            className={cn(
                              "p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                              "cursor-pointer",
                              isGeneratingPDF && "opacity-50 cursor-not-allowed"
                            )}
                            disabled={isGeneratingPDF}
                            title={`Imprimir etiqueta para ${box.barcode}`}
                          >
                            <QrCode className={cn(
                              "w-3 h-3",
                              theme === 'dark' ? "text-green-400" : "text-green-600"
                            )} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadBoxPDF(box)
                            }}
                            className={cn(
                              "p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                              "cursor-pointer",
                              isGeneratingPDF && "opacity-50 cursor-not-allowed"
                            )}
                            disabled={isGeneratingPDF}
                            title={`Descargar PDF para ${box.barcode}`}
                          >
                            <FileDown className={cn(
                              "w-3 h-3",
                              theme === 'dark' ? "text-blue-400" : "text-blue-600"
                            )} />
                          </button>
                        </div>

                        {/* Precio */}
                        <div className={cn(
                          "px-1.5 py-0.5 rounded text-xs border text-center font-semibold",
                          theme === 'dark'
                            ? "bg-green-900/30 border-green-700 text-green-300"
                            : "bg-green-50 border-green-200 text-green-700"
                        )}>
                          ${box.cost.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Paginacion */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className={cn(
                "text-sm",
                theme === 'dark' ? "text-gray-400" : "text-gray-600"
              )}>
                Mostrando {filteredBoxes.length} de {pagination.total} cajas
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="text-white border-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--brand-blue)',
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = 'var(--brand-blue-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = 'var(--brand-blue)'
                    }
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className={cn(
                  "px-3 py-1 text-sm font-medium",
                  theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="text-white border-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--brand-blue)',
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = 'var(--brand-blue-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.disabled) {
                      e.currentTarget.style.background = 'var(--brand-blue)'
                    }
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Trazabilidad de la Caja */}
      {showBoxDetails && selectedBox && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={cn(
            "rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden",
            theme === 'dark' ? "bg-gray-900" : "bg-white"
          )}>
            {/* Header */}
            <div className={cn(
              "flex items-center justify-between p-6 border-b",
              theme === 'dark' ? "border-gray-700" : "border-gray-200"
            )}>
              <div>
                <h2 className={cn(
                  "text-xl font-semibold",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Trazabilidad - Caja {selectedBox.size.toUpperCase()}
                </h2>
                <p className={cn(
                  "text-sm mt-1",
                  theme === 'dark' ? "text-gray-400" : "text-gray-600"
                )}>
                  Código: {selectedBox.barcode}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowBoxDetails(false)
                  setSelectedBox(null)
                }}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  theme === 'dark' ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-600"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {/* Información General */}
              <div className={cn(
                "rounded-lg p-4 mb-6",
                theme === 'dark' ? "bg-gray-800 border border-gray-700" : "bg-gray-50 border border-gray-200"
              )}>
                <h3 className={cn(
                  "text-lg font-medium mb-3",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Información de la Caja
                </h3>
                <div className="flex gap-6">
                  {/* Información de la caja - lado izquierdo */}
                  <div className="flex-1">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>Código:</span>
                        <p className={cn(
                          "font-mono",
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>{selectedBox.barcode}</p>
                      </div>
                      <div>
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>Tamaño:</span>
                        <p className={cn(
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>{selectedBox.size.toUpperCase()}</p>
                      </div>
                      <div>
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>Proveedor:</span>
                        <p className={cn(
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>{selectedBox.supplier}</p>
                      </div>
                      <div>
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>Costo:</span>
                        <p className={cn(
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>${selectedBox.cost.toFixed(2)}</p>
                      </div>
                      <div>
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>Estado:</span>
                        <p className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium inline-block w-fit",
                          selectedBox.status === 'AVAILABLE'
                            ? theme === 'dark' ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800"
                            : theme === 'dark' ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-800"
                        )}>
                          {selectedBox.status === 'AVAILABLE' ? 'Disponible' : 'En Uso'}
                        </p>
                      </div>
                      <div>
                        <span className={cn(
                          "font-medium",
                          theme === 'dark' ? "text-gray-400" : "text-gray-600"
                        )}>Creada:</span>
                        <p className={cn(
                          theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>{formatDate(selectedBox.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* QR Code - lado derecho */}
                  <div className="flex-shrink-0 flex flex-col items-center">
                    {/* QR Code */}
                    <div className={cn(
                      "w-44 h-44 rounded-lg border-2 border-dashed flex items-center justify-center p-4",
                      theme === 'dark'
                        ? "border-gray-600 bg-gray-700/50"
                        : "border-gray-300 bg-gray-50"
                    )}>
                      {boxQRCode ? (
                        <img
                          src={boxQRCode}
                          alt="QR Code"
                          className="w-40 h-40"
                        />
                      ) : (
                        <div className="text-center">
                          <QrCode className={cn(
                            "w-14 h-14 mx-auto mb-1",
                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                          )} />
                          <p className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-500" : "text-gray-400"
                          )}>
                            Código QR
                          </p>
                        </div>
                      )}
                    </div>
                    {/* Botones de acción */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => generateSingleQRLabel(selectedBox)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium transition-colors",
                          "bg-green-600 hover:bg-green-700 text-white",
                          "flex items-center gap-1",
                          isGeneratingPDF && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isGeneratingPDF}
                        title="Imprimir etiqueta"
                      >
                        <QrCode className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => console.log('Generate PDF for box:', selectedBox.id)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium transition-colors",
                          "bg-blue-600 hover:bg-blue-700 text-white",
                          "flex items-center gap-1",
                          isGeneratingPDF && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isGeneratingPDF}
                        title="Descargar PDF"
                      >
                        <FileDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Historial de Trazabilidad */}
              <div>
                <h3 className={cn(
                  "text-lg font-medium mb-4",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  Historial de Trazabilidad
                </h3>
                <div className="space-y-4">
                  {getBoxTrackingData(selectedBox).map((event, index) => {
                    const Icon = event.icon
                    return (
                      <div key={event.id} className="relative">
                        {/* Timeline Line */}
                        {index < getBoxTrackingData(selectedBox).length - 1 && (
                          <div className={cn(
                            "absolute left-6 top-12 w-0.5 h-full",
                            theme === 'dark' ? "bg-gray-700" : "bg-gray-300"
                          )} />
                        )}

                        {/* Event Card */}
                        <div className="flex gap-4">
                          {/* Icon */}
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                            event.color === 'blue' && theme === 'dark' ? "bg-blue-900 text-blue-400" : event.color === 'blue' ? "bg-blue-100 text-blue-600" : "",
                            event.color === 'green' && theme === 'dark' ? "bg-green-900 text-green-400" : event.color === 'green' ? "bg-green-100 text-green-600" : "",
                            event.color === 'purple' && theme === 'dark' ? "bg-purple-900 text-purple-400" : event.color === 'purple' ? "bg-purple-100 text-purple-600" : "",
                            event.color === 'emerald' && theme === 'dark' ? "bg-emerald-900 text-emerald-400" : event.color === 'emerald' ? "bg-emerald-100 text-emerald-600" : ""
                          )}>
                            <Icon className="w-5 h-5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <div className={cn(
                              "rounded-lg p-4",
                              theme === 'dark' ? "bg-gray-800 border border-gray-700" : "bg-gray-50 border border-gray-200"
                            )}>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className={cn(
                                  "font-medium",
                                  theme === 'dark' ? "text-white" : "text-gray-900"
                                )}>
                                  {event.description}
                                </h4>
                                <div className="flex items-center gap-1 text-xs">
                                  <Calendar className="w-3 h-3" />
                                  <span className={cn(
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>
                                    {formatDate(event.date)}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>Ubicación:</span>
                                  <p className={cn(
                                    theme === 'dark' ? "text-white" : "text-gray-900"
                                  )}>{event.location}</p>
                                </div>
                                <div>
                                  <span className={cn(
                                    "font-medium",
                                    theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                  )}>Usuario:</span>
                                  <p className={cn(
                                    theme === 'dark' ? "text-white" : "text-gray-900"
                                  )}>{event.user}</p>
                                </div>
                                {false && (
                                  <div>
                                    <span className={cn(
                                      "font-medium",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                    )}>Cliente:</span>
                                    <p className={cn(
                                      theme === 'dark' ? "text-white" : "text-gray-900"
                                    )}>{'Cliente'}</p>
                                  </div>
                                )}
                                {false && (
                                  <div>
                                    <span className={cn(
                                      "font-medium",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                    )}>Orden:</span>
                                    <p className={cn(
                                      theme === 'dark' ? "text-white" : "text-gray-900"
                                    )}>{'#Orden'}</p>
                                  </div>
                                )}
                                {false && (
                                  <div className="col-span-2">
                                    <span className={cn(
                                      "font-medium",
                                      theme === 'dark' ? "text-gray-400" : "text-gray-600"
                                    )}>Recibido por:</span>
                                    <p className={cn(
                                      theme === 'dark' ? "text-white" : "text-gray-900"
                                    )}>{'Destinatario'}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}