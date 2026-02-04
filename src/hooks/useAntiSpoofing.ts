'use client'

import { useCallback, useRef, useState } from 'react'

// Configuration - Movement-based liveness detection
export const ANTI_SPOOFING_CONFIG = {
  // Movement detection
  MOVEMENT_THRESHOLD: 3.0,       // Minimum movement in pixels to count
  FRAMES_REQUIRED: 8,            // Frames with movement needed
  FRAMES_TO_ANALYZE: 15,         // Total frames to analyze

  // Timing
  LIVENESS_TIMEOUT_MS: 5000,     // 5 seconds - faster timeout

  // Retry limits
  MAX_ATTEMPTS: 3,
  LOCKOUT_DURATION_MS: 30000,
}

export type LivenessPhase = 'waiting' | 'detecting' | 'verified' | 'failed' | 'timeout'

export interface LivenessState {
  phase: LivenessPhase
  blinksDetected: number
  message: string
  isLive: boolean
  progress: number
}

interface Point2D {
  x: number
  y: number
}

// Key facial landmarks for movement detection
const TRACKING_INDICES = [30, 33, 36, 45, 48, 54] // nose, eyes, mouth corners

/**
 * Calculate movement between two frames
 */
function calculateMovement(prev: Point2D[], curr: Point2D[]): number {
  if (prev.length !== curr.length || prev.length === 0) return 0

  let totalMovement = 0
  for (let i = 0; i < prev.length; i++) {
    const dx = curr[i].x - prev[i].x
    const dy = curr[i].y - prev[i].y
    totalMovement += Math.sqrt(dx * dx + dy * dy)
  }
  return totalMovement / prev.length
}

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

  // Movement detection
  const lastPointsRef = useRef<Point2D[] | null>(null)
  const movementFramesRef = useRef(0)
  const totalFramesRef = useRef(0)

  const resetLiveness = useCallback((fullReset: boolean = true) => {
    startTimeRef.current = null
    lastPointsRef.current = null
    movementFramesRef.current = 0
    totalFramesRef.current = 0

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

  const checkLiveness = useCallback((landmarks: any): LivenessState => {
    if (isLockedOut()) {
      return livenessState
    }

    const now = Date.now()

    // Initialize on first call
    if (!startTimeRef.current) {
      startTimeRef.current = now
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
        message: 'Intenta de nuevo',
        isLive: false,
        progress: 0
      }
      setLivenessState(newState)
      return newState
    }

    // Extract tracking points from landmarks
    let positions: any[] | null = null
    if (landmarks?.positions) {
      positions = landmarks.positions
    } else if (landmarks?._positions) {
      positions = landmarks._positions
    }

    if (!positions || positions.length < 68) {
      return livenessState
    }

    const getPoint = (i: number): Point2D => {
      const p = positions![i]
      if (!p) return { x: 0, y: 0 }
      const x = typeof p.x === 'number' ? p.x : (typeof p._x === 'number' ? p._x : 0)
      const y = typeof p.y === 'number' ? p.y : (typeof p._y === 'number' ? p._y : 0)
      return { x, y }
    }

    const currentPoints = TRACKING_INDICES.map(getPoint)
    totalFramesRef.current++

    // Compare with previous frame
    if (lastPointsRef.current) {
      const movement = calculateMovement(lastPointsRef.current, currentPoints)

      if (movement >= ANTI_SPOOFING_CONFIG.MOVEMENT_THRESHOLD) {
        movementFramesRef.current++
      }
    }

    lastPointsRef.current = currentPoints

    // Calculate progress
    const progress = Math.min(100, (movementFramesRef.current / ANTI_SPOOFING_CONFIG.FRAMES_REQUIRED) * 100)

    // Check if we have enough movement frames
    if (movementFramesRef.current >= ANTI_SPOOFING_CONFIG.FRAMES_REQUIRED) {
      attemptsRef.current = 0
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
      message: 'Mueve ligeramente la cabeza',
      isLive: false,
      progress
    }
    setLivenessState(newState)
    return newState
  }, [livenessState, isLockedOut])

  const getCurrentEAR = useCallback((landmarks: any): number => {
    return 0.3 // Not used anymore
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
