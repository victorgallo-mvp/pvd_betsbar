// Enums as const objects for use in both runtime (Zod) and types

export const TableStatus = {
  FREE: 'free',
  OPEN: 'open',
  AWAITING_PAYMENT: 'awaiting_payment',
} as const
export type TableStatus = (typeof TableStatus)[keyof typeof TableStatus]

export const SaleType = {
  TABLE: 'table',
  COUNTER: 'counter',
  DELIVERY: 'delivery',
} as const
export type SaleType = (typeof SaleType)[keyof typeof SaleType]

export const SaleStatus = {
  OPEN: 'open',
  AWAITING_PAYMENT: 'awaiting_payment',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus]

export const PaymentMethod = {
  CASH: 'cash',
  DEBIT: 'debit',
  CREDIT: 'credit',
  PIX: 'pix',
  VOUCHER: 'voucher',
  CONTA_RECEITA: 'conta_receita',
} as const
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PrintJobType = {
  KITCHEN: 'kitchen',
  RECEIPT: 'receipt',
  FICHE: 'fiche',
} as const
export type PrintJobType = (typeof PrintJobType)[keyof typeof PrintJobType]

export const PrintJobStatus = {
  PENDING: 'pending',
  PRINTED: 'printed',
  SKIPPED: 'skipped',
} as const
export type PrintJobStatus = (typeof PrintJobStatus)[keyof typeof PrintJobStatus]

export const UserRole = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  WAITER: 'waiter',
} as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

// DTO types returned by API

export interface UserDTO {
  id: string
  name: string
  role: UserRole
  active: boolean
}

export interface CategoryDTO {
  id: string
  name: string
  color: string
  icon: string
  displayOrder: number
  active: boolean
}

export interface ProductDTO {
  id: string
  categoryId: string
  name: string
  price: number
  isFavorite: boolean
  sendToKitchen: boolean
  active: boolean
}

export interface TableDTO {
  id: string
  number: number
  status: TableStatus
  openedAt: string | null
  peopleCount: number | null
  customerName: string | null
}

export interface SaleItemDTO {
  id: string
  productId: string
  productName: string
  qty: number
  unitPrice: number
  subtotal: number
  sentToProduction: boolean
  cancelled: boolean
  sendToKitchen: boolean
  notes: string | null
}

export interface SaleDTO {
  id: string
  type: SaleType
  tableId: string | null
  tableNumber: number | null
  peopleCount: number | null
  openedAt: string
  closedAt: string | null
  operatorId: string
  operatorName: string
  status: SaleStatus
  subtotal: number
  discount: number
  surcharge: number
  total: number
  perPersonAmount: number | null
  customerName: string | null
  customerAddress: string | null
  items: SaleItemDTO[]
  payments: PaymentDTO[]
}

export interface PaymentDTO {
  id: string
  method: PaymentMethod
  amount: number
  paidAt: string
}

// WebSocket event shapes

export interface WsTableUpdate {
  event: 'table_update'
  table: TableDTO
}

export interface WsSaleUpdate {
  event: 'sale_update'
  sale: Pick<SaleDTO, 'id' | 'status' | 'total'>
}

export type WsMessage = WsTableUpdate | WsSaleUpdate
