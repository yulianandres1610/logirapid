'use client'

import { useState, useEffect, useCallback } from 'react'

interface WalletData {
  walletNumber: string | null
  walletBalance: number
  companyName?: string
  userName?: string
}

interface WalletBalanceData {
  company: WalletData | null
  user: WalletData | null
}

/**
 * Hook for fetching and managing wallet balances
 *
 * Returns wallet information for both:
 * - The user's company
 * - The user themselves
 */
export function useWalletBalance() {
  const [data, setData] = useState<WalletBalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/wallet/balance')
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener saldos')
      }

      setData(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  return {
    // Raw data
    data,

    // Convenience accessors
    companyWallet: data?.company || null,
    userWallet: data?.user || null,

    // Balances
    companyBalance: data?.company?.walletBalance ?? 0,
    userBalance: data?.user?.walletBalance ?? 0,

    // Wallet numbers
    companyWalletNumber: data?.company?.walletNumber || null,
    userWalletNumber: data?.user?.walletNumber || null,

    // Names
    companyName: data?.company?.companyName || null,
    userName: data?.user?.userName || null,

    // State
    loading,
    error,

    // Actions
    refresh: fetchBalances
  }
}
