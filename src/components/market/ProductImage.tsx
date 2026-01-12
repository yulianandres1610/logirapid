'use client'

import { useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProductImageProps {
  src: string | null | undefined
  alt: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  containerClassName?: string
  theme?: 'light' | 'dark'
}

const sizeClasses = {
  xs: 'w-8 h-8',
  sm: 'w-12 h-12',
  md: 'w-14 h-14',
  lg: 'w-16 h-16',
  xl: 'w-20 h-20'
}

const iconSizes = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-7 h-7',
  xl: 'w-8 h-8'
}

/**
 * ProductImage Component
 *
 * Displays product images with:
 * - Skeleton loader while image loads
 * - Fallback icon if no image
 * - Smooth transition when image appears
 * - Prevents line-by-line progressive loading appearance
 */
export function ProductImage({
  src,
  alt,
  size = 'md',
  className,
  containerClassName,
  theme = 'dark'
}: ProductImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const showPlaceholder = !src || hasError

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden flex items-center justify-center shadow-sm border relative',
        sizeClasses[size],
        theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200',
        containerClassName
      )}
    >
      {/* Skeleton loader - shows while image is loading */}
      {src && !hasError && isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-600 dark:via-gray-500 dark:to-gray-600 bg-[length:200%_100%]" />
      )}

      {/* Actual image - hidden until fully loaded */}
      {src && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Fallback icon - shows if no image or error */}
      {showPlaceholder && (
        <ImageIcon className={cn('text-gray-400', iconSizes[size])} />
      )}
    </div>
  )
}

/**
 * ProductImageSquare Component
 *
 * Similar to ProductImage but with aspect-ratio: 1 for grid layouts
 * Used in POS product grids
 */
export function ProductImageSquare({
  src,
  alt,
  className,
  theme = 'dark'
}: {
  src: string | null | undefined
  alt: string
  className?: string
  theme?: 'light' | 'dark'
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  const showPlaceholder = !src || hasError

  return (
    <div
      className={cn(
        'w-full aspect-square rounded-md lg:rounded-lg flex items-center justify-center overflow-hidden relative',
        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100',
        className
      )}
    >
      {/* Skeleton loader */}
      {src && !hasError && isLoading && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 dark:from-gray-600 dark:via-gray-500 dark:to-gray-600 bg-[length:200%_100%]" />
      )}

      {/* Image */}
      {src && !hasError && (
        <img
          src={src}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100'
          )}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
          decoding="async"
        />
      )}

      {/* Fallback */}
      {showPlaceholder && (
        <ImageIcon className="w-8 h-8 text-gray-400" />
      )}
    </div>
  )
}

export default ProductImage
