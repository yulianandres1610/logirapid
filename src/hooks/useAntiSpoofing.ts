'use client'

import { useCallback, useRef, useState } from 'react'
import type { FaceExpressions } from './useFaceRecognition'

// Configuration - Smile-based liveness detection
export const ANTI_SPOOFING_CONFIG = {
  // Smile detection thresholds
  SMILE_THRESHOLD: 0.6,        // Minimum happiness score to count as smile (0-1)
  NEUTRAL_THRESHOLD: 0.3,      // Minimum neutral score when not smiling

  // Validation
  SMILE_HOLD_FRAMES: 4,        // Frames to hold smile to count
  NEUTRAL_HOLD_FRAMES: 4,      // Frames to hold neutral after smile

  // Timing
  LIVENESS_TIMEOUT_MS: 15000,  // 15 seconds total timeout

  // Retry limits
  MAX_ATTEMPTS: 3,
  LOCKOUT_DURATION_MS: 30000,
}

export type LivenessPhase = 'waiting' | 'detecting' | 'smile' | 'neutral' | 'verified' | 'failed' | 'timeout'

export interface LivenessState {
  phase: LivenessPhase
  blinksDetected: number
  message: string
  isLive: boolean
  progress: number
  happyScore?: number
}

/**
 * Anti-spoofing hook using smile detection
 *
 * How it works:
 * 1. User is asked to SMILE
 * 2. System detects happiness expression score
 * 3. User must then return to NEUTRAL expression
 * 4. This proves the face is real (photos can't change expression)
 */
export function useAntiSpoofing() {
  const [livenessState, setLivenessState] = useState<LivenessState>({
    phase: 'waiting',
    blinksDetected: 0,
    message: '',
    isLive: false,
    progress: 0
  })

  // Tracking refs
  const startTimeRef = useRef<number | null>(null)
  const attemptsRef = useRef(0)
  const lockedUntilRef = useRef<number | null>(null)

  // Smile detection tracking
  const smileFramesRef = useRef(0)
  const neutralFramesRef = useRef(0)
  const hasSmiled = useRef(false)

  const resetLiveness = useCallback((fullReset: boolean = true) => {
    startTimeRef.current = null
    smileFramesRef.current = 0
    neutralFramesRef.current = 0
    hasSmiled.current = false

    if (fullReset) {
      attemptsRef.current = 0
    }

    setLivenessState({
      phase: 'waiting',
      blinksDetected: 0,
      message: '',
      isLive: false,
      progress: 0
    })
  }, [])

  const isLockedOut = useCallback((): boolean => {
    if (lockedUntilRef.current && Date.now() < lockedUntilRef.current) {
      return true
    }
    lockedUntilRef.current = null
    return false
  }, [])

  const checkLiveness = useCallback((
    _landmarks: any,
    expressions?: FaceExpressions | null
  ): LivenessState => {
    if (isLockedOut()) {
      return livenessState
    }

    const now = Date.now()

    // Initialize on first call
    if (!startTimeRef.current) {
      startTimeRef.current = now
      const newState: LivenessState = {
        phase: 'smile',
        blinksDetected: 0,
        message: 'SONRÍE 😊',
        isLive: false,
        progress: 0
      }
      setLivenessState(newState)
      return newState
    }

    // Check timeout
    const elapsed = now - startTimeRef.current
    if (elapsed > ANTI_SPOOFING_CONFIG.LIVENESS_TIMEOUT_MS) {
      attemptsRef.current++

      if (attemptsRef.current >= ANTI_SPOOFING_CONFIG.MAX_ATTEMPTS) {
        lockedUntilRef.current = now + ANTI_SPOOFING_CONFIG.LOCKOUT_DURATION_MS
        const newState: LivenessState = {
          phase: 'failed',
          blinksDetected: 0,
          message: 'Verificación fallida',
          isLive: false,
          progress: 0
        }
        setLivenessState(newState)
        return newState
      }

      const newState: LivenessState = {
        phase: 'timeout',
        blinksDetected: 0,
        message: 'Tiempo agotado. Intenta de nuevo.',
        isLive: false,
        progress: 0
      }
      setLivenessState(newState)
      return newState
    }

    // If no expressions available, keep waiting
    if (!expressions) {
      return livenessState
    }

    const { happy, neutral } = expressions
    const currentPhase = livenessState.phase

    // Phase 1: Waiting for SMILE
    if (currentPhase === 'smile' && !hasSmiled.current) {
      if (happy >= ANTI_SPOOFING_CONFIG.SMILE_THRESHOLD) {
        smileFramesRef.current++

        if (smileFramesRef.current >= ANTI_SPOOFING_CONFIG.SMILE_HOLD_FRAMES) {
          // Smile detected! Now ask for neutral
          hasSmiled.current = true
          smileFramesRef.current = 0

          const newState: LivenessState = {
            phase: 'neutral',
            blinksDetected: 1,
            message: 'Bien! Ahora RELAJA el rostro 😐',
            isLive: false,
            progress: 50,
            happyScore: happy
          }
          setLivenessState(newState)
          return newState
        }
      } else {
        // Reset smile counter if not smiling enough
        smileFramesRef.current = Math.max(0, smileFramesRef.current - 1)
      }

      const progress = Math.min(45, (happy / ANTI_SPOOFING_CONFIG.SMILE_THRESHOLD) * 45)
      const newState: LivenessState = {
        phase: 'smile',
        blinksDetected: 0,
        message: 'SONRÍE 😊',
        isLive: false,
        progress,
        happyScore: happy
      }
      setLivenessState(newState)
      return newState
    }

    // Phase 2: Waiting for NEUTRAL after smile
    if (currentPhase === 'neutral' && hasSmiled.current) {
      // Check if face returned to neutral (low happy score)
      if (happy < 0.35 && neutral > ANTI_SPOOFING_CONFIG.NEUTRAL_THRESHOLD) {
        neutralFramesRef.current++

        if (neutralFramesRef.current >= ANTI_SPOOFING_CONFIG.NEUTRAL_HOLD_FRAMES) {
          // Verification complete!
          attemptsRef.current = 0
          const newState: LivenessState = {
            phase: 'verified',
            blinksDetected: 2,
            message: 'Verificado ✓',
            isLive: true,
            progress: 100,
            happyScore: happy
          }
          setLivenessState(newState)
          return newState
        }
      } else {
        neutralFramesRef.current = Math.max(0, neutralFramesRef.current - 1)
      }

      const progress = 50 + Math.min(50, ((1 - happy) / 0.65) * 50)
      const newState: LivenessState = {
        phase: 'neutral',
        blinksDetected: 1,
        message: 'Relaja el rostro 😐',
        isLive: false,
        progress,
        happyScore: happy
      }
      setLivenessState(newState)
      return newState
    }

    return livenessState
  }, [livenessState, isLockedOut])

  const getCurrentEAR = useCallback((_landmarks: any): number => {
    return 0.3 // Not used in expression-based detection
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
