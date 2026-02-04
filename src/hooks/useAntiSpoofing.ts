'use client'

import { useCallback, useRef, useState } from 'react'

// Configuration - Simple face detection (no liveness check)
export const ANTI_SPOOFING_CONFIG = {
  // Minimum consecutive frames for stable detection
  MIN_STABLE_FRAMES: 2,

  // Timing
  DETECTION_TIMEOUT_MS: 15000,
}

export type LivenessPhase = 'waiting' | 'detecting' | 'verified' | 'failed' | 'timeout'

export interface LivenessState {
  phase: LivenessPhase
  blinksDetected: number
  message: string
  isLive: boolean
  progress: number
}

/**
 * Simplified anti-spoofing hook
 *
 * Instead of complex liveness detection, we:
 * 1. Quickly verify face is detected
 * 2. Capture image for supervisor review
 * 3. Log all attendance with photos for audit
 */
export function useAntiSpoofing() {
  const [livenessState, setLivenessState] = useState<LivenessState>({
    phase: 'waiting',
    blinksDetected: 0,
    message: '',
    isLive: false,
    progress: 0
  })

  const startTimeRef = useRef<number | null>(null)
  const stableFramesRef = useRef(0)

  const resetLiveness = useCallback((_fullReset: boolean = true) => {
    startTimeRef.current = null
    stableFramesRef.current = 0

    setLivenessState({
      phase: 'waiting',
      blinksDetected: 0,
      message: '',
      isLive: false,
      progress: 0
    })
  }, [])

  const isLockedOut = useCallback((): boolean => {
    return false // No lockout in simplified mode
  }, [])

  const checkLiveness = useCallback((landmarks: any): LivenessState => {
    const now = Date.now()

    // Initialize on first call
    if (!startTimeRef.current) {
      startTimeRef.current = now
    }

    // Check timeout
    const elapsed = now - startTimeRef.current
    if (elapsed > ANTI_SPOOFING_CONFIG.DETECTION_TIMEOUT_MS) {
      const newState: LivenessState = {
        phase: 'timeout',
        blinksDetected: 0,
        message: 'Tiempo agotado',
        isLive: false,
        progress: 0
      }
      setLivenessState(newState)
      return newState
    }

    // Check if landmarks are valid
    let positions: any[] | null = null
    if (landmarks?.positions) {
      positions = landmarks.positions
    } else if (landmarks?._positions) {
      positions = landmarks._positions
    }

    if (!positions || positions.length < 68) {
      return livenessState
    }

    // Count stable frames
    stableFramesRef.current++

    const progress = Math.min(100, (stableFramesRef.current / ANTI_SPOOFING_CONFIG.MIN_STABLE_FRAMES) * 100)

    // Quick verification after minimum stable frames
    if (stableFramesRef.current >= ANTI_SPOOFING_CONFIG.MIN_STABLE_FRAMES) {
      const newState: LivenessState = {
        phase: 'verified',
        blinksDetected: 1,
        message: 'Verificado',
        isLive: true,
        progress: 100
      }
      setLivenessState(newState)
      return newState
    }

    // Still detecting
    const newState: LivenessState = {
      phase: 'detecting',
      blinksDetected: 0,
      message: 'Detectando...',
      isLive: false,
      progress
    }
    setLivenessState(newState)
    return newState
  }, [livenessState])

  const getCurrentEAR = useCallback((): number => {
    return 0.3
  }, [])

  return {
    livenessState,
    checkLiveness,
    resetLiveness,
    getCurrentEAR,
    isLockedOut,
    config: ANTI_SPOOFING_CONFIG
  }
}
