'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

// Types for face-api.js
interface FaceDetection {
  detection: {
    box: { x: number; y: number; width: number; height: number }
  }
  descriptor: Float32Array
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

export function useFaceRecognition() {
  const [isModelLoaded, setIsModelLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const faceapiRef = useRef<any>(null)

  // Load face-api.js models
  useEffect(() => {
    loadModels()
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

  // Detect face and get descriptor from video element
  const detectFace = useCallback(async (
    videoElement: HTMLVideoElement
  ): Promise<Float32Array | null> => {
    if (!isModelLoaded || !faceapiRef.current) {
      setError('Models not loaded yet')
      return null
    }

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

      return detection.descriptor
    } catch (err: any) {
      console.error('Error detecting face:', err)
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

  // Find best match from employee faces
  const findMatch = useCallback((
    faceDescriptor: Float32Array,
    employeeFaces: EmployeeFace[],
    threshold: number = 0.6 // Lower is better, 0.6 is a good default
  ): MatchResult | null => {
    if (!faceDescriptor || employeeFaces.length === 0) {
      return null
    }

    let bestMatch: MatchResult | null = null
    let minDistance = Infinity

    for (const employee of employeeFaces) {
      try {
        // Parse the stored face encoding
        const storedDescriptor = new Float32Array(JSON.parse(employee.faceEncoding))
        const distance = calculateDistance(faceDescriptor, storedDescriptor)

        if (distance < minDistance && distance <= threshold) {
          minDistance = distance
          bestMatch = {
            employeeId: employee.employeeId,
            employeeCode: employee.employeeCode,
            fullName: employee.fullName,
            distance: distance,
            confidence: Math.round((1 - distance) * 100)
          }
        }
      } catch (err) {
        console.error('Error comparing face with employee:', employee.employeeId, err)
      }
    }

    return bestMatch
  }, [calculateDistance])

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
    detectFaceFromCanvas,
    findMatch,
    descriptorToString,
    stringToDescriptor,
    drawDetection,
    calculateDistance
  }
}
