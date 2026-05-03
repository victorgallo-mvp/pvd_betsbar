import { z } from 'zod'
import { PaymentMethod, SaleType, TableStatus, UserRole } from './types.js'

// Auth
export const LoginSchema = z.object({
  pin: z.string().min(4).max(8),
})
export type LoginInput = z.infer<typeof LoginSchema>

// Tables
export const TableStatusSchema = z.enum([
  TableStatus.FREE,
  TableStatus.OPEN,
  TableStatus.AWAITING_PAYMENT,
])

// Sales
export const OpenSaleSchema = z.object({
  type: z.enum([SaleType.TABLE, SaleType.COUNTER, SaleType.DELIVERY]),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
})
export type OpenSaleInput = z.infer<typeof OpenSaleSchema>

export const AddItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
})
export type AddItemInput = z.infer<typeof AddItemSchema>

export const RequestBillSchema = z.object({
  peopleCount: z.number().int().positive(),
})
export type RequestBillInput = z.infer<typeof RequestBillSchema>

export const RegisterPaymentSchema = z.object({
  method: z.enum([
    PaymentMethod.CASH,
    PaymentMethod.DEBIT,
    PaymentMethod.CREDIT,
    PaymentMethod.PIX,
    PaymentMethod.VOUCHER,
    PaymentMethod.CONTA_RECEITA,
  ]),
  amount: z.number().positive(),
})
export type RegisterPaymentInput = z.infer<typeof RegisterPaymentSchema>

// Cash session
export const OpenCashSessionSchema = z.object({
  openingFund: z.number().min(0),
})
export type OpenCashSessionInput = z.infer<typeof OpenCashSessionSchema>

export const WithdrawalSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
})
export type WithdrawalInput = z.infer<typeof WithdrawalSchema>

// User roles
export const UserRoleSchema = z.enum([UserRole.ADMIN, UserRole.OPERATOR, UserRole.WAITER])
