import { NativeModules } from 'react-native'

const { Feedback } = NativeModules

export function playSuccessBeep(): void {
  Feedback?.playSuccessBeep()
}

export function playErrorBeep(): void {
  Feedback?.playErrorBeep()
}

export function vibrateSuccess(): void {
  Feedback?.vibrateSuccess()
}

export function vibrateError(): void {
  Feedback?.vibrateError()
}
