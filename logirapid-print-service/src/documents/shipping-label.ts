/**
 * Shipping Label Generator - Generates 4x6 shipping labels as PDF
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import bwipjs from 'bwip-js'

interface ShippingLabelData {
  // Tracking
  trackingNumber: string
  routeNumber?: string
  packageNumber?: string

  // Sender
  senderName: string
  senderAddress: string
  senderCity: string
  senderState?: string
  senderZip?: string
  senderPhone?: string

  // Recipient
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientState?: string
  recipientZip?: string
  recipientPhone: string

  // Package info
  weight?: string
  dimensions?: string
  serviceType?: string

  // Company
  companyName: string
  companyLogo?: string
}

export async function generateShippingLabel(data: ShippingLabelData): Promise<Buffer> {
  // Create 4x6 inch PDF (288 x 432 points at 72 DPI)
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([288, 432])

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const { width, height } = page.getSize()
  const margin = 10
  let y = height - margin

  // Company header
  page.drawText(data.companyName, {
    x: margin,
    y: y - 15,
    size: 14,
    font: boldFont,
    color: rgb(0, 0, 0)
  })
  y -= 25

  // Horizontal line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0, 0, 0)
  })
  y -= 10

  // FROM section
  page.drawText('DE:', {
    x: margin,
    y: y - 10,
    size: 8,
    font: boldFont,
    color: rgb(0.4, 0.4, 0.4)
  })
  y -= 12

  page.drawText(data.senderName, {
    x: margin,
    y: y - 10,
    size: 10,
    font: boldFont
  })
  y -= 14

  page.drawText(data.senderAddress, {
    x: margin,
    y: y - 10,
    size: 9,
    font
  })
  y -= 12

  const senderLocation = [
    data.senderCity,
    data.senderState,
    data.senderZip
  ].filter(Boolean).join(', ')

  page.drawText(senderLocation, {
    x: margin,
    y: y - 10,
    size: 9,
    font
  })
  y -= 12

  if (data.senderPhone) {
    page.drawText(`Tel: ${data.senderPhone}`, {
      x: margin,
      y: y - 10,
      size: 8,
      font
    })
    y -= 12
  }

  y -= 10

  // Horizontal line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 2,
    color: rgb(0, 0, 0)
  })
  y -= 15

  // TO section (larger, more prominent)
  page.drawText('PARA:', {
    x: margin,
    y: y - 10,
    size: 10,
    font: boldFont,
    color: rgb(0, 0, 0)
  })
  y -= 16

  page.drawText(data.recipientName, {
    x: margin,
    y: y - 14,
    size: 14,
    font: boldFont
  })
  y -= 20

  page.drawText(data.recipientAddress, {
    x: margin,
    y: y - 12,
    size: 11,
    font
  })
  y -= 16

  const recipientLocation = [
    data.recipientCity,
    data.recipientState,
    data.recipientZip
  ].filter(Boolean).join(', ')

  page.drawText(recipientLocation, {
    x: margin,
    y: y - 12,
    size: 11,
    font: boldFont
  })
  y -= 16

  page.drawText(`Tel: ${data.recipientPhone}`, {
    x: margin,
    y: y - 10,
    size: 10,
    font
  })
  y -= 20

  // Horizontal line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0, 0, 0)
  })
  y -= 15

  // Package info
  if (data.serviceType) {
    page.drawText(data.serviceType.toUpperCase(), {
      x: margin,
      y: y - 12,
      size: 12,
      font: boldFont
    })
    y -= 16
  }

  if (data.routeNumber) {
    page.drawText(`Ruta: ${data.routeNumber}`, {
      x: margin,
      y: y - 10,
      size: 9,
      font
    })
    y -= 14
  }

  if (data.packageNumber) {
    page.drawText(`Paquete: ${data.packageNumber}`, {
      x: margin,
      y: y - 10,
      size: 9,
      font
    })
    y -= 14
  }

  const packageInfo = [
    data.weight && `Peso: ${data.weight}`,
    data.dimensions && `Dim: ${data.dimensions}`
  ].filter(Boolean).join('  |  ')

  if (packageInfo) {
    page.drawText(packageInfo, {
      x: margin,
      y: y - 10,
      size: 8,
      font
    })
    y -= 14
  }

  // Generate barcode
  try {
    const barcodeBuffer = await bwipjs.toBuffer({
      bcid: 'code128',
      text: data.trackingNumber,
      scale: 2,
      height: 12,
      includetext: true,
      textxalign: 'center',
      textsize: 10
    })

    const barcodeImage = await pdfDoc.embedPng(barcodeBuffer)
    const barcodeWidth = width - (margin * 2)
    const barcodeHeight = 50
    const barcodeY = 40

    page.drawImage(barcodeImage, {
      x: margin,
      y: barcodeY,
      width: barcodeWidth,
      height: barcodeHeight
    })

    // Tracking number text below barcode (redundant but readable)
    page.drawText(data.trackingNumber, {
      x: width / 2 - (data.trackingNumber.length * 4),
      y: barcodeY - 12,
      size: 10,
      font: boldFont
    })
  } catch (error) {
    console.error('Barcode generation failed:', error)
    // Fallback: just print the tracking number
    page.drawText(data.trackingNumber, {
      x: margin,
      y: 60,
      size: 16,
      font: boldFont
    })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

export type { ShippingLabelData }
