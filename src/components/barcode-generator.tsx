'use client'

import React, { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

interface BarcodeGeneratorProps {
  value: string
  format?: string
  width?: number
  height?: number
  displayValue?: boolean
  background?: string
  lineColor?: string
  className?: string
}

export function BarcodeGenerator({
  value,
  format = 'CODE128',
  width = 2,
  height = 80,
  displayValue = true,
  background = '#ffffff',
  lineColor = '#000000',
  className = ''
}: BarcodeGeneratorProps) {
  const barcodeRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (barcodeRef.current && value) {
      try {
        JsBarcode(barcodeRef.current, value, {
          format,
          width,
          height,
          displayValue,
          background,
          lineColor,
          fontSize: 14,
          margin: 10
        })
      } catch (error) {
        console.error('Error generating barcode:', error)
      }
    }
  }, [value, format, width, height, displayValue, background, lineColor])

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <svg ref={barcodeRef} />
    </div>
  )
}

export default BarcodeGenerator