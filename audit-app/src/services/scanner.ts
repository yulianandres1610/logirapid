import { NativeModules, NativeEventEmitter } from 'react-native'

const { DataWedge } = NativeModules
const emitter = new NativeEventEmitter(DataWedge)

export function configureDataWedge(): void {
  DataWedge?.configureProfile()
}

export function subscribeToScanner(
  callback: (data: string, symbology: string) => void,
): () => void {
  const subscription = emitter.addListener('onBarcodeScan', (event) => {
    callback(event.data, event.symbology)
  })
  return () => subscription.remove()
}
