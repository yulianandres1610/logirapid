import React from 'react'
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/src/lib/utils'

const buttonVariants = cva('flex-row items-center justify-center rounded-2xl', {
  variants: {
    variant: {
      default: 'bg-brand-500',
      secondary: 'bg-dark-100',
      outline: 'border-2 border-dark-200 bg-white',
      danger: 'bg-red-500',
      ghost: 'bg-transparent',
      dark: 'bg-dark-800',
    },
    size: {
      sm: 'px-4 py-2.5',
      md: 'px-5 py-3.5',
      lg: 'px-6 py-4',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

const textVariants = cva('font-bold text-center', {
  variants: {
    variant: {
      default: 'text-white',
      secondary: 'text-dark-700',
      outline: 'text-dark-700',
      danger: 'text-white',
      ghost: 'text-dark-500',
      dark: 'text-white',
    },
    size: {
      sm: 'text-sm',
      md: 'text-sm',
      lg: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
})

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  onPress: () => void
  children: string
  disabled?: boolean
  loading?: boolean
  className?: string
}

export function Button({ onPress, children, variant, size, disabled, loading, className }: ButtonProps) {
  const shadow = variant === 'default'
    ? { shadowColor: '#eb5b0c', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 }
    : undefined

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size }), disabled && 'opacity-40', className)}
      activeOpacity={0.8}
      style={disabled ? undefined : shadow}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'outline' || variant === 'ghost' ? '#3f3b39' : '#fff'} size="small" />
      ) : (
        <Text className={textVariants({ variant, size })}>{children}</Text>
      )}
    </TouchableOpacity>
  )
}
