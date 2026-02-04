'use client'

import { useCallback, useRef, useState } from 'react'

// Configuration constants - optimized for faster, more reliable detection
export const ANTI_SPOOFING_CONFIG = {
  // Blink detection thresholds (very permissive for reliability)
  EAR_BLINK_THRESHOLD: 0.18,     // EAR below this = eyes closing/closed
  EAR_OPEN_THRESHOLD: 0.24,      // EAR above this = eyes definitely open
  MIN_EAR_DROP: 0.04,            // Minimum drop from baseline to count as blink

  // Timing
  BLINK_DURATION_MAX_MS: 600,    // Maximum duration for a valid blink
  BLINK_COOLDOWN_MS: 150,        // Minimum time between blinks
  REQUIRED_BLINKS: 1,            // Number of blinks required
  LIVENESS_TIMEOUT_MS: 12000,    // 12 seconds to complete

  // History for baseline calculation
  EAR_HISTORY_SIZE: 8,           // Frames to average for baseline

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
  progress: number
}

// Eye landmark indices from face-api.js 68-point model
const LEFT_EYE_INDICES = [36, 37, 38, 39, 40, 41]
const RIGHT_EYE_INDICES = [42, 43, 44, 45, 46, 47]

interface Point2D {
  x: number
  y: number
}

/**
 * Calculate Eye Aspect Ratio (EAR) for a single eye
 * Using the standard formula: EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
 */
function calculateEyeAspectRatio(eyePoints: Point2D[]): number {
  if (eyePoints.length !== 6) return 0.3

  // Vertical distances (p2-p6 and p3-p5)
  const v1 = Math.hypot(
    eyePoints[1].x - eyePoints[5].x,
    eyePoints[1].y - eyePoints[5].y
  )
  const v2 = Math.hypot(
    eyePoints[2].x - eyePoints[4].x,
    eyePoints[2].y - eyePoints[4].y
  )

  // Horizontal distance (p1-p4)
  const h = Math.hypot(
    eyePoints[0].x - eyePoints[3].x,
    eyePoints[0].y - eyePoints[3].y
  )

  if (h === 0) return 0.3
  return (v1 + v2) / (2 * h)
}

/**
 * Calculate average EAR for both eyes
 */
function calculateAverageEAR(landmarks: any): number {
  // Handle different landmark formats from face-api.js
  let positions: any[] | null = null

  if (landmarks?.positions) {
    positions = landmarks.positions
  } else if (landmarks?._positions) {
    positions = landmarks._positions
  } else if (Array.isArray(landmarks)) {
    positions = landmarks
  }

  if (!positions || positions.length < 68) {
    console.warn('[Liveness] Invalid landmarks:', positions?.length || 'null')
    return 0.3
  }

  const getPoint = (i: number): Point2D => {
    const p = positions![i]
    if (!p) return { x: 0, y: 0 }

    // Handle both { x, y } and { _x, _y } formats
    const x = typeof p.x === 'number' ? p.x : (typeof p._x === 'number' ? p._x : 0)
    const y = typeof p.y === 'number' ? p.y : (typeof p._y === 'number' ? p._y : 0)
    return { x, y }
  }

  const leftEye = LEFT_EYE_INDICES.map(getPoint)
  const rightEye = RIGHT_EYE_INDICES.map(getPoint)

  const leftEAR = calculateEyeAspectRatio(leftEye)
  const rightEAR = calculateEyeAspectRatio(rightEye)

  // Use the average of both eyes
  return (leftEAR + rightEAR) / 2
}

export function useAntiSpoofing() {
  const [livenessState, setLivenessState] = useState<LivenessState>({
    phase: 'waiting',
    blinksDetected: 0,
    message: 'Posiciónate frente a la cámara',
    isLive: false,
    progress: 0
  })

  // Tracking refs
  const blinksCountRef = useRef(0)
  const startTimeRef = useRef<number | null>(null)
  const attemptsRef = useRef(0)
  const lockedUntilRef = useRef<number | null>(null)

  // Blink detection state
  const earHistoryRef = useRef<number[]>([])
  const baselineEARRef = useRef<number>(0.28)
  const wasBlinkingRef = useRef(false)
  const lastBlinkTimeRef = useRef(0)
  const blinkStartTimeRef = useRef<number | null>(null)

  const resetLiveness = useCallback((fullReset: boolean = true) => {
    blinksCountRef.current = 0
    startTimeRef.current = null
    earHistoryRef.current = []
    baselineEARRef.current = 0.28
    wasBlinkingRef.current = false
    lastBlinkTimeRef.current = 0
    blinkStartTimeRef.current = null

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

  const isLockedOut = useCallback((): boolean => {
    if (lockedUntilRef.current && Date.now() < lockedUntilRef.current) {
      const remainingSeconds = Math.ceil((lockedUntilRef.current - Date.now()) / 1000)
      setLivenessState(prev => ({
        ...prev,
        phase: 'failed',
        message: `Espera ${remainingSeconds}s`,
        isLive: false
      }))
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
      setLivenessState(prev => ({
        ...prev,
        phase: 'detecting',
        message: 'Parpadea para verificar'
      }))
    }

    // Check timeout
    const elapsed = now - startTimeRef.current
    if (elapsed > ANTI_SPOOFING_CONFIG.LIVENESS_TIMEOUT_MS) {
      attemptsRef.current++

      if (attemptsRef.current >= ANTI_SPOOFING_CONFIG.MAX_ATTEMPTS) {
        lockedUntilRef.current = now + ANTI_SPOOFING_CONFIG.LOCKOUT_DURATION_MS
        const newState: LivenessState = {
          phase: 'failed',
          blinksDetected: blinksCountRef.current,
          message: 'Verificación fallida',
          isLive: false,
          progress: 0
        }
        setLivenessState(newState)
        return newState
      }

      const newState: LivenessState = {
        phase: 'timeout',
        blinksDetected: blinksCountRef.current,
        message: `Intenta de nuevo (${ANTI_SPOOFING_CONFIG.MAX_ATTEMPTS - attemptsRef.current} intentos)`,
        isLive: false,
        progress: 0
      }
      setLivenessState(newState)
      return newState
    }

    // Calculate current EAR
    const currentEAR = calculateAverageEAR(landmarks)

    // Debug: Log EAR values periodically
    if (earHistoryRef.current.length % 10 === 0) {
      console.log(`[Liveness] EAR: ${currentEAR.toFixed(3)}, Baseline: ${baselineEARRef.current.toFixed(3)}, Blinking: ${wasBlinkingRef.current}`)
    }

    // Update EAR history for baseline calculation
    earHistoryRef.current.push(currentEAR)
    if (earHistoryRef.current.length > ANTI_SPOOFING_CONFIG.EAR_HISTORY_SIZE) {
      earHistoryRef.current.shift()
    }

    // Calculate baseline from recent high values (when eyes are open)
    if (earHistoryRef.current.length >= 3) {
      const sortedEars = [...earHistoryRef.current].sort((a, b) => b - a)
      // Use average of top values as baseline
      const topValues = sortedEars.slice(0, Math.ceil(sortedEars.length / 2))
      baselineEARRef.current = topValues.reduce((a, b) => a + b, 0) / topValues.length
    }

    // Simple blink detection:
    // 1. Eyes closing: EAR drops significantly below baseline
    // 2. Eyes opening: EAR returns above threshold
    const isBlinking = currentEAR < ANTI_SPOOFING_CONFIG.EAR_BLINK_THRESHOLD ||
                       (currentEAR < baselineEARRef.current - ANTI_SPOOFING_CONFIG.MIN_EAR_DROP)

    const isOpen = currentEAR > ANTI_SPOOFING_CONFIG.EAR_OPEN_THRESHOLD

    // Track blink start
    if (isBlinking && !wasBlinkingRef.current) {
      blinkStartTimeRef.current = now
      wasBlinkingRef.current = true
    }

    // Detect blink completion (eyes opened after being closed)
    if (wasBlinkingRef.current && isOpen) {
      const blinkDuration = blinkStartTimeRef.current ? now - blinkStartTimeRef.current : 0
      const timeSinceLastBlink = now - lastBlinkTimeRef.current

      // Valid blink conditions:
      // 1. Duration is reasonable (not too long)
      // 2. Enough time since last blink (cooldown)
      if (blinkDuration > 0 &&
          blinkDuration <= ANTI_SPOOFING_CONFIG.BLINK_DURATION_MAX_MS &&
          timeSinceLastBlink >= ANTI_SPOOFING_CONFIG.BLINK_COOLDOWN_MS) {

        blinksCountRef.current++
        lastBlinkTimeRef.current = now
        console.log(`✓ Blink detected! Count: ${blinksCountRef.current}, EAR: ${currentEAR.toFixed(3)}, Duration: ${blinkDuration}ms`)
      }

      wasBlinkingRef.current = false
      blinkStartTimeRef.current = null
    }

    // Reset if eyes stayed closed too long (not a natural blink)
    if (wasBlinkingRef.current && blinkStartTimeRef.current) {
      const closedDuration = now - blinkStartTimeRef.current
      if (closedDuration > ANTI_SPOOFING_CONFIG.BLINK_DURATION_MAX_MS * 2) {
        wasBlinkingRef.current = false
        blinkStartTimeRef.current = null
      }
    }

    // Calculate progress
    const progress = Math.min(100, (blinksCountRef.current / ANTI_SPOOFING_CONFIG.REQUIRED_BLINKS) * 100)

    // Check if verified
    if (blinksCountRef.current >= ANTI_SPOOFING_CONFIG.REQUIRED_BLINKS) {
      attemptsRef.current = 0
      const newState: LivenessState = {
        phase: 'verified',
        blinksDetected: blinksCountRef.current,
        message: 'Verificado',
        isLive: true,
        progress: 100
      }
      setLivenessState(newState)
      return newState
    }

    // Update state
    const newState: LivenessState = {
      phase: 'detecting',
      blinksDetected: blinksCountRef.current,
      message: 'Parpadea para verificar',
      isLive: false,
      progress
    }
    setLivenessState(newState)
    return newState
  }, [livenessState, isLockedOut])

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
