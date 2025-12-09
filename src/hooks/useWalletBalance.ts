'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

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

// Polling interval in milliseconds (10 seconds)
const POLLING_INTERVAL = 10000

/**
 * Hook for fetching and managing wallet balances with auto-polling
 *
 * Returns wallet information for both:
 * - The user's company
 * - The user themselves
 *
 * Features:
 * - Auto-polling every 10 seconds
 * - Tracks previous balance for change detection
 * - Provides balance change direction (up/down)
 */
export function useWalletBalance() {
  const [data, setData] = useState<WalletBalanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track previous balances for animation
  const [prevCompanyBalance, setPrevCompanyBalance] = useState<number | null>(null)
  const [prevUserBalance, setPrevUserBalance] = useState<number | null>(null)

  // Track balance changes
  const [companyBalanceChange, setCompanyBalanceChange] = useState<'up' | 'down' | null>(null)
  const [userBalanceChange, setUserBalanceChange] = useState<'up' | 'down' | null>(null)

  // Ref to track if it's the first fetch
  const isFirstFetch = useRef(true)

  const fetchBalances = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)

      const response = await fetch('/api/wallet/balance')
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Error al obtener saldos')
      }

      const newData = result.data as WalletBalanceData

      // Detect balance changes (only after first fetch)
      if (!isFirstFetch.current && data) {
        const newCompanyBalance = newData?.company?.walletBalance ?? 0
        const oldCompanyBalance = data?.company?.walletBalance ?? 0

        if (newCompanyBalance !== oldCompanyBalance) {
          setPrevCompanyBalance(oldCompanyBalance)
          setCompanyBalanceChange(newCompanyBalance > oldCompanyBalance ? 'up' : 'down')
          // Clear the change indicator after animation
          setTimeout(() => setCompanyBalanceChange(null), 2000)
        }

        const newUserBalance = newData?.user?.walletBalance ?? 0
        const oldUserBalance = data?.user?.walletBalance ?? 0

        if (newUserBalance !== oldUserBalance) {
          setPrevUserBalance(oldUserBalance)
          setUserBalanceChange(newUserBalance > oldUserBalance ? 'up' : 'down')
          // Clear the change indicator after animation
          setTimeout(() => setUserBalanceChange(null), 2000)
        }
      }

      isFirstFetch.current = false
      setData(newData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [data])

  // Initial fetch
  useEffect(() => {
    fetchBalances()
  }, [])

  // Polling effect
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBalances(true) // Silent fetch (no loading state)
    }, POLLING_INTERVAL)

    return () => clearInterval(interval)
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

    // Previous balances (for animation)
    prevCompanyBalance,
    prevUserBalance,

    // Balance change direction
    companyBalanceChange,
    userBalanceChange,

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
    refresh: () => fetchBalances(false)
  }
}
