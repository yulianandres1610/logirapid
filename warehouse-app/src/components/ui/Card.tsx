import React from 'react'
import { View, type ViewProps } from 'react-native'
import { cn } from '@/src/lib/utils'

interface CardProps extends ViewProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <View
      className={cn('bg-white rounded-2xl p-4 border border-dark-100', className)}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
      {...props}
    >
      {children}
    </View>
  )
}
