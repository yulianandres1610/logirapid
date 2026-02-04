'use client'

import { useCallback, useRef, useState } from 'react'

// Configuration - Fast micro-movement liveness detection
export const ANTI_SPOOFING_CONFIG = {
  // Frame collection
  FRAMES_TO_COLLECT: 12,       // Frames to analyze (at ~10fps = ~1.2 seconds)
  MIN_FRAMES_FOR_CHECK: 8,     // Minimum frames before checking

  // Variance thresholds
  MIN_VARIANCE: 0.3,           // Minimum variance (reject static photos)
  MAX_CORRELATION: 0.85,       // Maximum movement correlation (reject moving photos)

  // Timing
  LIVENESS_TIMEOUT_MS: 8000,   // 8 seconds max

  // Retry limits
  MAX_ATTEMPTS: 3,
  LOCKOUT_DURATION_MS: 30000,
}

export type LivenessPhase = 'waiting' | 'detecting' | 'analyzing' | 'verified' | 'failed' | 'timeout'

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

// Key landmarks to track (subset for speed)
const TRACKING_INDICES = [
  30,  // Nose tip
  36,  // Left eye outer
  45,  // Right eye outer
  48,  // Left mouth corner
  54,  // Right mouth corner
  8,   // Chin
]

/**
 * Extract point from landmark position
 */
function getPoint(positions: any[], index: number): Point2D {
  const p = positions[index]
  if (!p) return { x: 0, y: 0 }
  const x = typeof p.x === 'number' ? p.x : (typeof p._x === 'number' ? p._x : 0)
  const y = typeof p.y === 'number' ? p.y : (typeof p._y === 'number' ? p._y : 0)
  return { x, y }
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squaredDiffs = values.map(v => (v - mean) ** 2)
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length
}

/**
 * Calculate movement correlation between landmarks
 * High correlation = all points moving together (photo being moved)
 * Low correlation = independent movements (real face)
 */
function calculateMovementCorrelation(history: Point2D[][]): number {
  if (history.length < 3) return 0

  // Calculate frame-to-frame movements for each landmark
  const movements: number[][] = []

  for (let i = 1; i < history.length; i++) {
    const frameMoves: number[] = []
    for (let j = 0; j < TRACKING_INDICES.length; j++) {
      const prev = history[i - 1][j]
      const curr = history[i][j]
      const move = Math.sqrt((curr.x - prev.x) ** 2 + (curr.y - prev.y) ** 2)
      frameMoves.push(move)
    }
    movements.push(frameMoves)
  }

  // Calculate correlation between different landmarks' movements
  // If all landmarks move similarly, it's a photo being moved
  let totalCorrelation = 0
  let pairCount = 0

  for (let i = 0; i < TRACKING_INDICES.length - 1; i++) {
    for (let j = i + 1; j < TRACKING_INDICES.length; j++) {
      const movesI = movements.map(m => m[i])
      const movesJ = movements.map(m => m[j])

      const meanI = movesI.reduce((a, b) => a + b, 0) / movesI.length
      const meanJ = movesJ.reduce((a, b) => a + b, 0) / movesJ.length

      let numerator = 0
      let denomI = 0
      let denomJ = 0

      for (let k = 0; k < movesI.length; k++) {
        const diffI = movesI[k] - meanI
        const diffJ = movesJ[k] - meanJ
        numerator += diffI * diffJ
        denomI += diffI ** 2
        denomJ += diffJ ** 2
      }

      const denom = Math.sqrt(denomI * denomJ)
      if (denom > 0.001) {
        totalCorrelation += Math.abs(numerator / denom)
        pairCount++
      }
    }
  }

  return pairCount > 0 ? totalCorrelation / pairCount : 0
}

/**
 * Fast anti-spoofing hook using micro-movement analysis
 *
 * How it works:
 * 1. Collect landmark positions over ~1 second
 * 2. Analyze variance (static photos have zero variance)
 * 3. Analyze movement correlation (moving photos have high correlation)
 * 4. Real faces have non-zero variance with low correlation
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

  // Landmark history for analysis
  const historyRef = useRef<Point2D[][]>([])
  const lastCheckTimeRef = useRef<number>(0)

  const resetLiveness = useCallback((fullReset: boolean = true) => {
    startTimeRef.current = null
    historyRef.current = []
    lastCheckTimeRef.current = 0

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
      historyRef.current = []
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

    // Extract positions from landmarks
    let positions: any[] | null = null
    if (landmarks?.positions) {
      positions = landmarks.positions
    } else if (landmarks?._positions) {
      positions = landmarks._positions
    }

    if (!positions || positions.length < 68) {
      return livenessState
    }

    // Collect current frame's landmark positions
    const currentPoints = TRACKING_INDICES.map(idx => getPoint(positions!, idx))
    historyRef.current.push(currentPoints)

    // Keep only recent frames
    if (historyRef.current.length > ANTI_SPOOFING_CONFIG.FRAMES_TO_COLLECT) {
      historyRef.current.shift()
    }

    const frameCount = historyRef.current.length
    const progress = Math.min(95, (frameCount / ANTI_SPOOFING_CONFIG.FRAMES_TO_COLLECT) * 100)

    // Not enough frames yet
    if (frameCount < ANTI_SPOOFING_CONFIG.MIN_FRAMES_FOR_CHECK) {
      const newState: LivenessState = {
        phase: 'detecting',
        blinksDetected: 0,
        message: 'Mantén el rostro visible',
        isLive: false,
        progress
      }
      setLivenessState(newState)
      return newState
    }

    // Throttle analysis to avoid excessive computation
    if (now - lastCheckTimeRef.current < 150) {
      return livenessState
    }
    lastCheckTimeRef.current = now

    // Analyze collected frames
    const history = historyRef.current

    // Calculate total variance across all landmarks
    let totalVariance = 0
    for (let i = 0; i < TRACKING_INDICES.length; i++) {
      const xValues = history.map(frame => frame[i].x)
      const yValues = history.map(frame => frame[i].y)
      totalVariance += calculateVariance(xValues) + calculateVariance(yValues)
    }
    totalVariance /= TRACKING_INDICES.length

    // Calculate movement correlation
    const correlation = calculateMovementCorrelation(history)

    // Decision logic
    const hasVariance = totalVariance > ANTI_SPOOFING_CONFIG.MIN_VARIANCE
    const hasLowCorrelation = correlation < ANTI_SPOOFING_CONFIG.MAX_CORRELATION

    // Real face: has some variance AND movements are not highly correlated
    if (hasVariance && hasLowCorrelation && frameCount >= ANTI_SPOOFING_CONFIG.FRAMES_TO_COLLECT) {
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

    // Still analyzing
    const newState: LivenessState = {
      phase: 'analyzing',
      blinksDetected: 0,
      message: 'Analizando...',
      isLive: false,
      progress
    }
    setLivenessState(newState)
    return newState
  }, [livenessState, isLockedOut])

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
