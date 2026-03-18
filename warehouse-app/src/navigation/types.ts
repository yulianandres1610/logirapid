import type { PendingOrder, WholesaleDelivery } from '@/src/stores/operations-store'

export type RootStackParamList = {
  Auth: undefined
  WarehouseSelect: undefined
  Main: undefined
}

export type AuthStackParamList = {
  Login: undefined
}

export type MainTabParamList = {
  Inicio: undefined
  Operaciones: undefined
  Escanear: undefined
  Config: undefined
}

export type OperationsStackParamList = {
  OperationsMenu: undefined
  TransferCreate: undefined
  TransferValidate: undefined
  ReceptionList: undefined
  ReceptionDetail: { order: PendingOrder }
  WholesaleList: undefined
  WholesaleDetail: { delivery: WholesaleDelivery }
  ScrapAdjustment: undefined
}

export type ScanStackParamList = {
  StockInquiry: undefined
  ProductMovements: undefined
  PrintLabel: undefined
}
