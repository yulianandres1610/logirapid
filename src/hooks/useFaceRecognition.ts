'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

// Types for face-api.js
interface FaceDetection {
  detection: {
    box: { x: number; y: number; width: number; height: number }
    score: number
  }
  descriptor: Float32Array
}

// Expression scores from face-api.js
export interface FaceExpressions {
  neutral: number
  happy: number
  sad: number
  angry: number
  fearful: number
  disgusted: number
  surprised: number
}

// Detection result with landmarks for anti-spoofing
export interface FaceDetectionWithLandmarks {
  descriptor: Float32Array
  landmarks: any // Face landmarks object from face-api.js
  expressions: FaceExpressions | null
  score: number
  box: { x: number; y: number; width: number; height: number }
}

interface EmployeeFace {
  employeeId: number
  employeeCode: string
  fullName: string
  faceEncoding: string // JSON stringified Float32Array
}

interface MatchResult {
  employeeId: number
  employeeCode: string
  fullName: string
  distance: number
  confidence: number
}

// Cache for parsed face descriptors to avoid re-parsing on every comparison
const descriptorCache = new Map<string, Float32Array>()

// Security constants
const FACE_DESCRIPTOR_LENGTH = 128 // Standard face-api.js descriptor size
const MIN_DETECTION_SCORE = 0.5 // Minimum confidence for face detection
const MIN_FACE_SIZE = 100 // Minimum face bounding box size in pixels
const DEFAULT_MATCH_THRESHOLD = 0.5 // Stricter threshold for better security (lower = stricter)

export function useFaceRecognition() {
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const faceapiRef = useRef<any>(null)
  const lastDetectionTime = useRef<number>(0)
  const detectionCooldown = 200 // Minimum ms between detections for performance

  // Load face-api.js models
  useEffect(() => {
    loadModels()

    // Cleanup cache on unmount
    return () => {
      descriptorCache.clear()
    }
  }, [])

  const loadModels = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Dynamic import for face-api
      const faceapi = await import('@vladmandic/face-api')
      faceapiRef.current = faceapi

      // Models URL - using jsdelivr CDN for vladmandic/face-api models
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

      // Load required models for face recognition
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])

      setIsModelLoaded(true)
      console.log('Face recognition models loaded successfully')
    } catch (err: any) {
      console.error('Error loading face-api models:', err)
      setError('Error loading face recognition models: ' + err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Detect face and get descriptor from video element with quality validation
  const detectFace = useCallback(async (
    videoElement: HTMLVideoElement,
    options?: { skipCooldown?: boolean; minFaceSize?: number }
  ): Promise<Float32Array | null> => {
    if (!isModelLoaded || !faceapiRef.current) {
      setError('Models not loaded yet')
      return null
    }

    // Performance: Apply cooldown between detections
    const now = Date.now()
    if (!options?.skipCooldown && now - lastDetectionTime.current < detectionCooldown) {
      return null
    }
    lastDetectionTime.current = now

    try {
      const faceapi = faceapiRef.current

      // Detect single face with landmarks and descriptor
      const detection = await faceapi
        .detectSingleFace(videoElement)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        return null
      }

      // Security: Validate detection confidence
      if (detection.detection.score < MIN_DETECTION_SCORE) {
        console.log('Face detection score too low:', detection.detection.score)
        return null
      }

      // Security: Validate face size (prevent distant/small faces)
      const { width, height } = detection.detection.box
      const minSize = options?.minFaceSize || MIN_FACE_SIZE
      if (width < minSize || height < minSize) {
        console.log('Face too small:', width, 'x', height)
        return null
      }

      // Security: Validate descriptor integrity
      if (!detection.descriptor || detection.descriptor.length !== FACE_DESCRIPTOR_LENGTH) {
        console.error('Invalid face descriptor length:', detection.descriptor?.length)
        return null
      }

      return detection.descriptor
    } catch (err: any) {
      console.error('Error detecting face:', err)
      setError('Error detecting face: ' + err.message)
      return null
    }
  }, [isModelLoaded])

  // Detect face with landmarks and expressions for anti-spoofing
  const detectFaceWithLandmarks = useCallback(async (
    videoElement: HTMLVideoElement,
    options?: { skipCooldown?: boolean; minFaceSize?: number }
  ): Promise<FaceDetectionWithLandmarks | null> => {
    if (!isModelLoaded || !faceapiRef.current) {
      setError('Models not loaded yet')
      return null
    }

    // Performance: Apply cooldown between detections
    const now = Date.now()
    if (!options?.skipCooldown && now - lastDetectionTime.current < detectionCooldown) {
      return null
    }
    lastDetectionTime.current = now

    try {
      const faceapi = faceapiRef.current

      // Detect single face with landmarks and descriptor (no expressions for speed)
      const detection = await faceapi
        .detectSingleFace(videoElement)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        return null
      }

      // Security: Validate detection confidence
      if (detection.detection.score < MIN_DETECTION_SCORE) {
        return null
      }

      // Security: Validate face size (prevent distant/small faces)
      const { width, height, x, y } = detection.detection.box
      const minSize = options?.minFaceSize || MIN_FACE_SIZE
      if (width < minSize || height < minSize) {
        return null
      }

      // Security: Validate descriptor integrity
      if (!detection.descriptor || detection.descriptor.length !== FACE_DESCRIPTOR_LENGTH) {
        return null
      }

      return {
        descriptor: detection.descriptor,
        landmarks: detection.landmarks,
        expressions: null,
        score: detection.detection.score,
        box: { x, y, width, height }
      }
    } catch (err: any) {
      console.error('Error detecting face with landmarks:', err)
      setError('Error detecting face: ' + err.message)
      return null
    }
  }, [isModelLoaded])

  // Detect face from canvas element
  const detectFaceFromCanvas = useCallback(async (
    canvas: HTMLCanvasElement
  ): Promise<Float32Array | null> => {
    if (!isModelLoaded || !faceapiRef.current) {
      setError('Models not loaded yet')
      return null
    }

    try {
      const faceapi = faceapiRef.current

      const detection = await faceapi
        .detectSingleFace(canvas)
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        return null
      }

      return detection.descriptor
    } catch (err: any) {
      console.error('Error detecting face from canvas:', err)
      setError('Error detecting face: ' + err.message)
      return null
    }
  }, [isModelLoaded])

  // Calculate Euclidean distance between two face descriptors
  const calculateDistance = useCallback((
    descriptor1: Float32Array,
    descriptor2: Float32Array
  ): number => {
    if (descriptor1.length !== descriptor2.length) {
      throw new Error('Descriptor lengths do not match')
    }

    let sum = 0
    for (let i = 0; i < descriptor1.length; i++) {
      const diff = descriptor1[i] - descriptor2[i]
      sum += diff * diff
    }
    return Math.sqrt(sum)
  }, [])

  // Get cached or parse descriptor (performance optimization)
  const getCachedDescriptor = useCallback((employeeId: number, encodingString: string): Float32Array | null => {
    const cacheKey = `${employeeId}-${encodingString.slice(0, 50)}`

    if (descriptorCache.has(cacheKey)) {
      return descriptorCache.get(cacheKey)!
    }

    try {
      const parsed = JSON.parse(encodingString)

      // Security: Validate the parsed array
      if (!Array.isArray(parsed) || parsed.length !== FACE_DESCRIPTOR_LENGTH) {
        console.error('Invalid stored face encoding for employee:', employeeId)
        return null
      }

      // Security: Validate all values are numbers
      if (!parsed.every((v: any) => typeof v === 'number' && !isNaN(v))) {
        console.error('Invalid face encoding values for employee:', employeeId)
        return null
      }

      const descriptor = new Float32Array(parsed)
      descriptorCache.set(cacheKey, descriptor)
      return descriptor
    } catch (err) {
      console.error('Error parsing face encoding for employee:', employeeId, err)
      return null
    }
  }, [])

  // Find best match from employee faces with enhanced security
  const findMatch = useCallback((
    faceDescriptor: Float32Array,
    employeeFaces: EmployeeFace[],
    threshold: number = DEFAULT_MATCH_THRESHOLD // Stricter default (0.5)
  ): MatchResult | null => {
    if (!faceDescriptor || employeeFaces.length === 0) {
      return null
    }

    // Security: Validate input descriptor
    if (faceDescriptor.length !== FACE_DESCRIPTOR_LENGTH) {
      console.error('Invalid input face descriptor length:', faceDescriptor.length)
      return null
    }

    let bestMatch: MatchResult | null = null
    let minDistance = Infinity
    let secondBestDistance = Infinity

    for (const employee of employeeFaces) {
      try {
        // Use cached descriptor for performance
        const storedDescriptor = getCachedDescriptor(employee.employeeId, employee.faceEncoding)

        if (!storedDescriptor) {
          continue
        }

        const distance = calculateDistance(faceDescriptor, storedDescriptor)

        // Track second best for security (to detect ambiguous matches)
        if (distance < minDistance) {
          secondBestDistance = minDistance
          minDistance = distance
          bestMatch = {
            employeeId: employee.employeeId,
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            distance: distance,
            confidence: Math.round((1 - distance) * 100)
          }
        } else if (distance < secondBestDistance) {
          secondBestDistance = distance
        }
      } catch (err) {
        console.error('Error comparing face with employee:', employee.employeeId, err)
      }
    }

    // Security: Reject if match is above threshold
    if (!bestMatch || bestMatch.distance > threshold) {
      return null
    }

    // Security: Reject ambiguous matches (second best is too close)
    // This prevents false positives when two faces are similar
    const ambiguityThreshold = 0.15 // Minimum difference between best and second best
    if (secondBestDistance - minDistance < ambiguityThreshold && secondBestDistance <= threshold + 0.1) {
      console.log('Ambiguous face match detected, rejecting for security')
      return null
    }

    return bestMatch
  }, [calculateDistance, getCachedDescriptor])

  // Convert descriptor to JSON string for storage
  const descriptorToString = useCallback((descriptor: Float32Array): string => {
    return JSON.stringify(Array.from(descriptor))
  }, [])

  // Convert JSON string back to Float32Array
  const stringToDescriptor = useCallback((str: string): Float32Array => {
    return new Float32Array(JSON.parse(str))
  }, [])

  // Draw detection box on canvas (optional, for UI feedback)
  const drawDetection = useCallback(async (
    videoElement: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ) => {
    if (!isModelLoaded || !faceapiRef.current) return

    const faceapi = faceapiRef.current

    const detection = await faceapi
      .detectSingleFace(videoElement)
      .withFaceLandmarks()

    if (detection) {
      const dims = faceapi.matchDimensions(canvas, videoElement, true)
      const resizedDetection = faceapi.resizeResults(detection, dims)

      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        faceapi.draw.drawDetections(canvas, resizedDetection)
        faceapi.draw.drawFaceLandmarks(canvas, resizedDetection)
      }
    }
  }, [isModelLoaded])

  return {
    isModelLoaded,
    isLoading,
    error,
    detectFace,
    detectFaceWithLandmarks,
    detectFaceFromCanvas,
    findMatch,
    descriptorToString,
    stringToDescriptor,
    drawDetection,
    calculateDistance
  }
}
