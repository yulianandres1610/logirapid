import React from 'react'
import { View, Text } from 'react-native'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/src/lib/utils'

const badgeVariants = cva('rounded-xl px-3 py-1', {
  variants: {
    variant: {
      default: 'bg-dark-100',
      success: 'bg-emerald-50',
      warning: 'bg-amber-50',
      danger: 'bg-red-50',
      info: 'bg-blue-50',
      orange: 'bg-orange-50',
      brand: 'bg-brand-50',
    },
  },
  defaultVariants: { variant: 'default' },
})

const textColors: Record<string, string> = {
  default: 'text-dark-600',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
  info: 'text-blue-700',
  orange: 'text-orange-700',
  brand: 'text-brand-600',
}

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: string
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant }), className)}>
      <Text className={cn('text-xs font-bold', textColors[variant || 'default'])}>{children}</Text>
    </View>
  )
}
