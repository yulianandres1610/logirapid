'use client'

import { useCallback, useRef, useState } from 'react'

// Configuration constants
export const ANTI_SPOOFING_CONFIG = {
  // Blink detection thresholds
  EAR_THRESHOLD_CLOSED: 0.21,  // Eye Aspect Ratio when eyes are closed
  EAR_THRESHOLD_OPEN: 0.25,    // Eye Aspect Ratio when eyes are open
  BLINK_DURATION_MAX_MS: 400,  // Maximum duration for a valid blink
  REQUIRED_BLINKS: 1,          // Number of blinks required for verification

  // Micro-movement detection
  MOVEMENT_HISTORY_FRAMES: 10, // Number of frames to analyze for movement
  MOVEMENT_THRESHOLD_PX: 2.0,  // Minimum movement variance in pixels

  // Timing
  LIVENESS_TIMEOUT_MS: 8000,   // Maximum time to complete liveness check

  // Retry limits
  MAX_ATTEMPTS: 3,
  LOCKOUT_DURATION_MS: 30000,
}

// Liveness detection phases
export type LivenessPhase = 'waiting' | 'detecting' | 'verified' | 'failed' | 'timeout'

export interface LivenessState {
  phase: LivenessPhase
  blinksDetected: number
  message: string
  isLive: boolean
  progress: number // 0-100 percentage
}

// Eye landmark indices from face-api.js 68-point model
// Left eye: points 36-41
// Right eye: points 42-47
const LEFT_EYE_INDICES = [36, 37, 38, 39, 40, 41]
const RIGHT_EYE_INDICES = [42, 43, 44, 47, 46, 45]

// Blink state machine
type BlinkState = 'open' | 'closing' | 'closed' | 'opening'

interface Point2D {
  x: number
  y: number
}

interface BlinkDetectionState {
  state: BlinkState
  closeStartTime: number | null
  lastEAR: number
}

/**
 * Calculate Eye Aspect Ratio (EAR) for a single eye
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * Where p1-p6 are the 6 landmarks around the eye
 */
function calculateEyeAspectRatio(eyePoints: Point2D[]): number {
  if (eyePoints.length !== 6) {
    return 0.3 // Default open value if invalid
  }

  // Vertical distances
  const v1 = Math.sqrt(
    Math.pow(eyePoints[1].x - eyePoints[5].x, 2) +
    Math.pow(eyePoints[1].y - eyePoints[5].y, 2)
  )
  const v2 = Math.sqrt(
    Math.pow(eyePoints[2].x - eyePoints[4].x, 2) +
    Math.pow(eyePoints[2].y - eyePoints[4].y, 2)
  )

  // Horizontal distance
  const h = Math.sqrt(
    Math.pow(eyePoints[0].x - eyePoints[3].x, 2) +
    Math.pow(eyePoints[0].y - eyePoints[3].y, 2)
  )

  if (h === 0) return 0.3

  return (v1 + v2) / (2 * h)
}

/**
 * Calculate average EAR for both eyes
 */
function calculateAverageEAR(landmarks: any): number {
  const positions = landmarks.positions || landmarks._positions

  if (!positions || positions.length < 68) {
    return 0.3
  }

  // Extract eye points
  const leftEye = LEFT_EYE_INDICES.map(i => ({
    x: positions[i].x || positions[i]._x,
    y: positions[i].y || positions[i]._y
  }))

  const rightEye = RIGHT_EYE_INDICES.map(i => ({
    x: positions[i].x || positions[i]._x,
    y: positions[i].y || positions[i]._y
  }))

  const leftEAR = calculateEyeAspectRatio(leftEye)
  const rightEAR = calculateEyeAspectRatio(rightEye)

  return (leftEAR + rightEAR) / 2
}

/**
 * Calculate movement variance from landmark history
 * Real faces have natural micro-movements, photos are static
 */
function calculateMovementVariance(history: Point2D[][]): number {
  if (history.length < 5) return 0

  // Use nose tip (point 30) and eye corners for movement detection
  const trackingIndices = [30, 36, 45] // nose tip, left eye corner, right eye corner

  let totalVariance = 0

  for (const idx of trackingIndices) {
    const points = history.map(frame => frame[idx])

    // Calculate mean position
    const meanX = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const meanY = points.reduce((sum, p) => sum + p.y, 0) / points.length

    // Calculate variance
    const variance = points.reduce((sum, p) => {
      return sum + Math.pow(p.x - meanX, 2) + Math.pow(p.y - meanY, 2)
    }, 0) / points.length

    totalVariance += Math.sqrt(variance)
  }

  return totalVariance / trackingIndices.length
}

export function useAntiSpoofing() {
  // State
  const [livenessState, setLivenessState] = useState<LivenessState>({
    phase: 'waiting',
    blinksDetected: 0,
    message: 'Posiciónate frente a la cámara',
    isLive: false,
    progress: 0
  })

  // Refs for tracking
  const blinkStateRef = useRef<BlinkDetectionState>({
    state: 'open',
    closeStartTime: null,
    lastEAR: 0.3
  })
  const blinksCountRef = useRef(0)
  const landmarkHistoryRef = useRef<Point2D[][]>([])
  const startTimeRef = useRef<number | null>(null)
  const attemptsRef = useRef(0)
  const lockedUntilRef = useRef<number | null>(null)

  /**
   * Reset the liveness detection state
   * @param fullReset - If true, also resets attempt counter (use when user cancels/exits)
   */
  const resetLiveness = useCallback((fullReset: boolean = true) => {
    blinkStateRef.current = {
      state: 'open',
      closeStartTime: null,
      lastEAR: 0.3
    }
    blinksCountRef.current = 0
    landmarkHistoryRef.current = []
    startTimeRef.current = null

    // Reset attempts on full reset (user canceled/exited)
    if (fullReset) {
      attemptsRef.current = 0
    }

    setLivenessState({
      phase: 'waiting',
      blinksDetected: 0,
      message: 'Posiciónate frente a la cámara',
      isLive: false,
      progress: 0
    })
  }, [])

  /**
   * Check if currently locked out due to failed attempts
   */
  const isLockedOut = useCallback((): boolean => {
    if (lockedUntilRef.current && Date.now() < lockedUntilRef.current) {
      const remainingSeconds = Math.ceil((lockedUntilRef.current - Date.now()) / 1000)
      setLivenessState(prev => ({
        ...prev,
        phase: 'failed',
        message: `Demasiados intentos fallidos. Espera ${remainingSeconds}s`,
        isLive: false
      }))
      return true
    }
    lockedUntilRef.current = null
    return false
  }, [])

  /**
   * Process a frame and detect blinks
   * Returns the current liveness state
   */
  const checkLiveness = useCallback((landmarks: any): LivenessState => {
    // Check lockout
    if (isLockedOut()) {
      return livenessState
    }

    // Initialize start time on first call
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
      setLivenessState(prev => ({
        ...prev,
        phase: 'detecting',
        message: 'Parpadea para verificar'
      }))
    }

    // Check timeout
    const elapsed = Date.now() - startTimeRef.current
    if (elapsed > ANTI_SPOOFING_CONFIG.LIVENESS_TIMEOUT_MS) {
      attemptsRef.current++

      if (attemptsRef.current >= ANTI_SPOOFING_CONFIG.MAX_ATTEMPTS) {
        lockedUntilRef.current = Date.now() + ANTI_SPOOFING_CONFIG.LOCKOUT_DURATION_MS
        const newState: LivenessState = {
          phase: 'failed',
          blinksDetected: blinksCountRef.current,
          message: 'Verificación fallida. Contacta a un manager.',
          isLive: false,
          progress: 0
        }
        setLivenessState(newState)
        return newState
      }

      const newState: LivenessState = {
        phase: 'timeout',
        blinksDetected: blinksCountRef.current,
        message: `No se detectó parpadeo. Intenta de nuevo. (${ANTI_SPOOFING_CONFIG.MAX_ATTEMPTS - attemptsRef.current} intentos restantes)`,
        isLive: false,
        progress: 0
      }
      setLivenessState(newState)
      return newState
    }

    // Calculate Eye Aspect Ratio
    const currentEAR = calculateAverageEAR(landmarks)

    // Update landmark history for micro-movement detection
    const positions = landmarks.positions || landmarks._positions
    if (positions && positions.length >= 68) {
      const framePoints = positions.map((p: any) => ({
        x: p.x || p._x,
        y: p.y || p._y
      }))
      landmarkHistoryRef.current.push(framePoints)

      // Keep only recent frames
      if (landmarkHistoryRef.current.length > ANTI_SPOOFING_CONFIG.MOVEMENT_HISTORY_FRAMES) {
        landmarkHistoryRef.current.shift()
      }
    }

    // Blink state machine
    const blinkState = blinkStateRef.current
    const { EAR_THRESHOLD_CLOSED, EAR_THRESHOLD_OPEN, BLINK_DURATION_MAX_MS } = ANTI_SPOOFING_CONFIG

    switch (blinkState.state) {
      case 'open':
        if (currentEAR < EAR_THRESHOLD_CLOSED) {
          blinkState.state = 'closing'
          blinkState.closeStartTime = Date.now()
        }
        break

      case 'closing':
        if (currentEAR < EAR_THRESHOLD_CLOSED) {
          blinkState.state = 'closed'
        } else if (currentEAR > EAR_THRESHOLD_OPEN) {
          // Quick close-open, might be a blink
          blinkState.state = 'open'
          blinkState.closeStartTime = null
        }
        break

      case 'closed':
        if (currentEAR > EAR_THRESHOLD_OPEN) {
          blinkState.state = 'opening'
        }
        // Check if eyes stayed closed too long (not a natural blink)
        if (blinkState.closeStartTime && Date.now() - blinkState.closeStartTime > BLINK_DURATION_MAX_MS * 2) {
          blinkState.state = 'open'
          blinkState.closeStartTime = null
        }
        break

      case 'opening':
        if (currentEAR > EAR_THRESHOLD_OPEN) {
          // Complete blink detected
          if (blinkState.closeStartTime) {
            const blinkDuration = Date.now() - blinkState.closeStartTime
            if (blinkDuration <= BLINK_DURATION_MAX_MS) {
              // Valid blink!
              blinksCountRef.current++
              console.log(`Blink detected! Count: ${blinksCountRef.current}, EAR: ${currentEAR.toFixed(3)}, Duration: ${blinkDuration}ms`)
            }
          }
          blinkState.state = 'open'
          blinkState.closeStartTime = null
        }
        break
    }

    blinkState.lastEAR = currentEAR

    // Calculate progress
    const progress = Math.min(100, (blinksCountRef.current / ANTI_SPOOFING_CONFIG.REQUIRED_BLINKS) * 100)

    // Check if liveness verified
    if (blinksCountRef.current >= ANTI_SPOOFING_CONFIG.REQUIRED_BLINKS) {
      // Optional: Also check for micro-movement
      const movementVariance = calculateMovementVariance(landmarkHistoryRef.current)
      const hasMovement = movementVariance >= ANTI_SPOOFING_CONFIG.MOVEMENT_THRESHOLD_PX

      // We require blinks (primary) but movement is optional for now
      // In strict mode, we could require both
      const isLive = blinksCountRef.current >= ANTI_SPOOFING_CONFIG.REQUIRED_BLINKS

      if (isLive) {
        attemptsRef.current = 0 // Reset attempts on success
        const newState: LivenessState = {
          phase: 'verified',
          blinksDetected: blinksCountRef.current,
          message: hasMovement
            ? 'Verificación exitosa'
            : 'Verificación exitosa (parpadeo detectado)',
          isLive: true,
          progress: 100
        }
        setLivenessState(newState)
        return newState
      }
    }

    // Update state
    const newState: LivenessState = {
      phase: 'detecting',
      blinksDetected: blinksCountRef.current,
      message: blinksCountRef.current > 0
        ? `¡Bien! ${ANTI_SPOOFING_CONFIG.REQUIRED_BLINKS - blinksCountRef.current > 0 ? 'Parpadea de nuevo' : 'Verificando...'}`
        : 'Parpadea para verificar',
      isLive: false,
      progress
    }
    setLivenessState(newState)
    return newState
  }, [livenessState, isLockedOut])

  /**
   * Get current EAR value for debugging/display
   */
  const getCurrentEAR = useCallback((landmarks: any): number => {
    return calculateAverageEAR(landmarks)
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
