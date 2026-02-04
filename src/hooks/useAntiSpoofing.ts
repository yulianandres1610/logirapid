'use client'

import { useCallback, useRef, useState } from 'react'

// Configuration - Head pose challenge detection
export const ANTI_SPOOFING_CONFIG = {
  // Head pose thresholds
  YAW_THRESHOLD: 12,           // Degrees of head turn required (left/right)
  PITCH_THRESHOLD: 10,         // Degrees of head nod required (up/down)
  CENTER_TOLERANCE: 8,         // Tolerance for "centered" position

  // Challenge settings
  CHALLENGE_HOLD_FRAMES: 5,    // Frames to hold position to count

  // Timing
  LIVENESS_TIMEOUT_MS: 10000,  // 10 seconds total
  PHASE_TIMEOUT_MS: 5000,      // 5 seconds per phase

  // Retry limits
  MAX_ATTEMPTS: 3,
  LOCKOUT_DURATION_MS: 30000,
}

export type LivenessPhase = 'waiting' | 'turn_left' | 'turn_right' | 'center' | 'verified' | 'failed' | 'timeout'

export interface LivenessState {
  phase: LivenessPhase
  blinksDetected: number
  message: string
  isLive: boolean
  progress: number
  currentYaw?: number
  currentPitch?: number
}

interface HeadPose {
  yaw: number    // Left-right rotation (-90 to 90)
  pitch: number  // Up-down rotation (-90 to 90)
  roll: number   // Tilt (-180 to 180)
}

interface Point2D {
  x: number
  y: number
}

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
 * Estimate head pose from facial landmarks
 * Uses geometric relationships between facial features to estimate 3D rotation
 */
function estimateHeadPose(landmarks: any): HeadPose | null {
  let positions: any[] | null = null
  if (landmarks?.positions) {
    positions = landmarks.positions
  } else if (landmarks?._positions) {
    positions = landmarks._positions
  }

  if (!positions || positions.length < 68) {
    return null
  }

  // Key facial landmarks (68-point model)
  const noseTip = getPoint(positions, 30)       // Nose tip
  const noseBridge = getPoint(positions, 27)    // Top of nose bridge
  const chin = getPoint(positions, 8)           // Chin
  const leftEyeOuter = getPoint(positions, 36)  // Left eye outer corner
  const leftEyeInner = getPoint(positions, 39)  // Left eye inner corner
  const rightEyeInner = getPoint(positions, 42) // Right eye inner corner
  const rightEyeOuter = getPoint(positions, 45) // Right eye outer corner
  const leftMouth = getPoint(positions, 48)     // Left mouth corner
  const rightMouth = getPoint(positions, 54)    // Right mouth corner

  // Calculate eye centers
  const leftEyeCenter = {
    x: (leftEyeOuter.x + leftEyeInner.x) / 2,
    y: (leftEyeOuter.y + leftEyeInner.y) / 2
  }
  const rightEyeCenter = {
    x: (rightEyeOuter.x + rightEyeInner.x) / 2,
    y: (rightEyeOuter.y + rightEyeInner.y) / 2
  }

  // Eye width (inter-ocular distance) for normalization
  const eyeWidth = Math.abs(rightEyeCenter.x - leftEyeCenter.x)
  if (eyeWidth < 10) return null // Face too small or invalid

  // Calculate face center (between eyes)
  const faceCenter = {
    x: (leftEyeCenter.x + rightEyeCenter.x) / 2,
    y: (leftEyeCenter.y + rightEyeCenter.y) / 2
  }

  // === YAW (Left-Right rotation) ===
  // When head turns, nose tip moves relative to eye center
  // Also, the ratio of left vs right eye size changes
  const noseOffsetX = noseTip.x - faceCenter.x

  // Normalize by eye width and convert to approximate degrees
  // When looking straight: noseOffsetX ≈ 0
  // When turned fully: noseOffsetX ≈ ±eyeWidth/2
  const yawRatio = noseOffsetX / (eyeWidth * 0.5)
  const yaw = Math.max(-45, Math.min(45, yawRatio * 35)) // Clamp to reasonable range

  // === PITCH (Up-Down rotation) ===
  // When head tilts up/down, the vertical distance from nose to eyes vs nose to chin changes
  const faceHeight = Math.abs(chin.y - noseBridge.y)
  if (faceHeight < 10) return null

  const noseToEyeY = noseTip.y - faceCenter.y
  const pitchRatio = noseToEyeY / (faceHeight * 0.3)
  const pitch = Math.max(-30, Math.min(30, (pitchRatio - 1) * 25))

  // === ROLL (Tilt) ===
  // Eye line angle relative to horizontal
  const eyeDeltaY = rightEyeCenter.y - leftEyeCenter.y
  const eyeDeltaX = rightEyeCenter.x - leftEyeCenter.x
  const roll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI)

  return { yaw, pitch, roll }
}

/**
 * Anti-spoofing hook with head pose challenge
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
  const phaseStartTimeRef = useRef<number | null>(null)
  const attemptsRef = useRef(0)
  const lockedUntilRef = useRef<number | null>(null)

  // Challenge tracking
  const challengeTypeRef = useRef<'left' | 'right'>('left')
  const challengeCompletedRef = useRef(false)
  const holdFramesRef = useRef(0)
  const initialPoseRef = useRef<HeadPose | null>(null)

  const resetLiveness = useCallback((fullReset: boolean = true) => {
    startTimeRef.current = null
    phaseStartTimeRef.current = null
    initialPoseRef.current = null
    challengeCompletedRef.current = false
    holdFramesRef.current = 0

    // Randomize challenge direction
    challengeTypeRef.current = Math.random() > 0.5 ? 'left' : 'right'

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
      phaseStartTimeRef.current = now

      // Start with turn challenge
      const direction = challengeTypeRef.current
      const newState: LivenessState = {
        phase: direction === 'left' ? 'turn_left' : 'turn_right',
        blinksDetected: 0,
        message: direction === 'left' ? 'Gira la cabeza a la IZQUIERDA' : 'Gira la cabeza a la DERECHA',
        isLive: false,
        progress: 0
      }
      setLivenessState(newState)
      return newState
    }

    // Check total timeout
    const totalElapsed = now - startTimeRef.current
    if (totalElapsed > ANTI_SPOOFING_CONFIG.LIVENESS_TIMEOUT_MS) {
      attemptsRef.current++

      if (attemptsRef.current >= ANTI_SPOOFING_CONFIG.MAX_ATTEMPTS) {
        lockedUntilRef.current = now + ANTI_SPOOFING_CONFIG.LOCKOUT_DURATION_MS
        const newState: LivenessState = {
          phase: 'failed',
          blinksDetected: 0,
          message: 'Verificación fallida. Intenta más tarde.',
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

    // Estimate head pose
    const pose = estimateHeadPose(landmarks)
    if (!pose) {
      return livenessState
    }

    // Store initial pose if not set
    if (!initialPoseRef.current) {
      initialPoseRef.current = pose
    }

    const currentPhase = livenessState.phase
    const { YAW_THRESHOLD, CENTER_TOLERANCE, CHALLENGE_HOLD_FRAMES } = ANTI_SPOOFING_CONFIG

    // Phase: Turn left
    if (currentPhase === 'turn_left') {
      // Check if head is turned left (negative yaw)
      if (pose.yaw < -YAW_THRESHOLD) {
        holdFramesRef.current++

        if (holdFramesRef.current >= CHALLENGE_HOLD_FRAMES) {
          // Challenge completed, now return to center
          holdFramesRef.current = 0
          phaseStartTimeRef.current = now

          const newState: LivenessState = {
            phase: 'center',
            blinksDetected: 1,
            message: 'Bien! Ahora mira al CENTRO',
            isLive: false,
            progress: 50,
            currentYaw: pose.yaw
          }
          setLivenessState(newState)
          return newState
        }
      } else {
        holdFramesRef.current = 0
      }

      const progress = Math.min(40, Math.abs(pose.yaw) / YAW_THRESHOLD * 40)
      const newState: LivenessState = {
        phase: 'turn_left',
        blinksDetected: 0,
        message: 'Gira la cabeza a la IZQUIERDA ←',
        isLive: false,
        progress,
        currentYaw: pose.yaw
      }
      setLivenessState(newState)
      return newState
    }

    // Phase: Turn right
    if (currentPhase === 'turn_right') {
      // Check if head is turned right (positive yaw)
      if (pose.yaw > YAW_THRESHOLD) {
        holdFramesRef.current++

        if (holdFramesRef.current >= CHALLENGE_HOLD_FRAMES) {
          // Challenge completed, now return to center
          holdFramesRef.current = 0
          phaseStartTimeRef.current = now

          const newState: LivenessState = {
            phase: 'center',
            blinksDetected: 1,
            message: 'Bien! Ahora mira al CENTRO',
            isLive: false,
            progress: 50,
            currentYaw: pose.yaw
          }
          setLivenessState(newState)
          return newState
        }
      } else {
        holdFramesRef.current = 0
      }

      const progress = Math.min(40, Math.abs(pose.yaw) / YAW_THRESHOLD * 40)
      const newState: LivenessState = {
        phase: 'turn_right',
        blinksDetected: 0,
        message: 'Gira la cabeza a la DERECHA →',
        isLive: false,
        progress,
        currentYaw: pose.yaw
      }
      setLivenessState(newState)
      return newState
    }

    // Phase: Return to center
    if (currentPhase === 'center') {
      // Check if head is centered
      if (Math.abs(pose.yaw) < CENTER_TOLERANCE) {
        holdFramesRef.current++

        if (holdFramesRef.current >= CHALLENGE_HOLD_FRAMES) {
          // Verification complete!
          attemptsRef.current = 0
          const newState: LivenessState = {
            phase: 'verified',
            blinksDetected: 2,
            message: 'Verificado ✓',
            isLive: true,
            progress: 100,
            currentYaw: pose.yaw
          }
          setLivenessState(newState)
          return newState
        }
      } else {
        holdFramesRef.current = Math.max(0, holdFramesRef.current - 1)
      }

      const progress = 50 + Math.min(50, (1 - Math.abs(pose.yaw) / YAW_THRESHOLD) * 50)
      const newState: LivenessState = {
        phase: 'center',
        blinksDetected: 1,
        message: 'Mira al CENTRO de la cámara',
        isLive: false,
        progress,
        currentYaw: pose.yaw
      }
      setLivenessState(newState)
      return newState
    }

    return livenessState
  }, [livenessState, isLockedOut])

  const getCurrentEAR = useCallback((_landmarks: any): number => {
    return 0.3 // Not used in pose-based detection
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
