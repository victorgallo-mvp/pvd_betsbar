import { z } from 'zod'
import { PaymentMethod, SaleType, TableStatus, UserRole } from './types.js'

// Auth
// PIN: exatamente 6 dígitos (vale para login, criação e troca)
export const PIN_LENGTH = 6
export const PinSchema = z.string().regex(/^\d{6}$/, 'PIN deve ter 6 dígitos')
export const LoginSchema = z.object({
  pin: PinSchema,
})
export type LoginInput = z.infer<typeof LoginSchema>

// Tables
export const TableStatusSchema = z.enum([
  TableStatus.FREE,
  TableStatus.OPEN,
  TableStatus.AWAITING_PAYMENT,
])

// Sales
export const GuestNameSchema = z.string().trim().min(1, 'Nome obrigatório').max(40)

export const OpenSaleSchema = z.object({
  type: z.enum([SaleType.TABLE, SaleType.COUNTER, SaleType.DELIVERY]),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerAddress: z.string().optional(),
  // Pessoas da mesa informadas já na abertura (opcional)
  guests: z.array(GuestNameSchema).max(20).optional(),
})
export type OpenSaleInput = z.infer<typeof OpenSaleSchema>

export const AddItemSchema = z.object({
  productId: z.string(),
  qty: z.number().int().positive(),
  // null/ausente = item da mesa (compartilhado)
  guestId: z.string().nullable().optional(),
})
export type AddItemInput = z.infer<typeof AddItemSchema>

// Mover item para outra pessoa (null = volta para a mesa)
export const MoveItemSchema = z.object({
  guestId: z.string().nullable(),
})
export type MoveItemInput = z.infer<typeof MoveItemSchema>

export const AddGuestSchema = z.object({ name: GuestNameSchema })
export type AddGuestInput = z.infer<typeof AddGuestSchema>

export const RequestBillSchema = z.object({
  peopleCount: z.number().int().positive(),
  // Conta de uma pessoa só; ausente = mesa toda
  guestId: z.string().nullable().optional(),
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
  // Pagamento atribuído a uma pessoa da mesa (opcional)
  guestId: z.string().nullable().optional(),
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
