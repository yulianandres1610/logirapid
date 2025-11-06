'use client'

import React, { Component, ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="p-4 border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <div>
              <h3 className="font-medium">Error en el componente</h3>
              <p className="text-sm text-red-500 dark:text-red-300 mt-1">
                {this.state.error?.message || 'Ha ocurrido un error inesperado'}
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}