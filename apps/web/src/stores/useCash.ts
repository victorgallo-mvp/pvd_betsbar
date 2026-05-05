import { create } from 'zustand'
import { api } from '../lib/api'

export interface CashWithdrawal {
  id: string
  amount: number
  reason: string
  createdAt: string
}

export interface CashSession {
  id: string
  operatorId: string
  operatorName: string
  openedAt: string
  closedAt: string | null
  openingFund: number
  total: number | null
  withdrawals: CashWithdrawal[]
}

export interface SalesByMethod {
  method: string
  count: number
  total: number
}

export interface CashReport {
  session: CashSession
  salesByMethod: SalesByMethod[]
  paidSalesCount: number
  totalSales: number
  cashSales: number
  totalWithdrawals: number
  expectedCash: number
  withdrawals: CashWithdrawal[]
}

interface CashState {
  activeSession: CashSession | null
  isLoading: boolean
  initialized: boolean
  error: string | null
  fetchActiveSession: () => Promise<void>
  openSession: (operatorId: string, openingFund: number) => Promise<void>
  withdraw: (amount: number, reason: string) => Promise<void>
  getReport: (sessionId: string) => Promise<CashReport>
  closeSession: (sessionId: string) => Promise<CashReport>
  clearError: () => void
}

export const useCash = create<CashState>((set, get) => ({
  activeSession: null,
  isLoading: false,
  initialized: false,
  error: null,

  fetchActiveSession: async () => {
    set({ isLoading: true, error: null })
    try {
      const session = await api.get<CashSession>('/cash/active')
      set({ activeSession: session, isLoading: false, initialized: true })
    } catch {
      // 404 = no active session — that's normal
      set({ activeSession: null, isLoading: false, initialized: true })
    }
  },

  openSession: async (operatorId, openingFund) => {
    set({ isLoading: true, error: null })
    try {
      const session = await api.post<CashSession>('/cash/open', { operatorId, openingFund })
      set({ activeSession: session, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
      throw err
    }
  },

  withdraw: async (amount, reason) => {
    const { activeSession } = get()
    if (!activeSession) throw new Error('Nenhum caixa aberto')
    set({ isLoading: true, error: null })
    try {
      await api.post(`/cash/${activeSession.id}/withdraw`, { amount, reason })
      // Refresh session to get updated withdrawals list
      await get().fetchActiveSession()
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
      throw err
    }
  },

  getReport: async (sessionId) => {
    return api.get<CashReport>(`/cash/${sessionId}/report`)
  },

  closeSession: async (sessionId) => {
    set({ isLoading: true, error: null })
    try {
      const report = await api.post<CashReport>(`/cash/${sessionId}/close`, {})
      set({ activeSession: null, isLoading: false })
      return report
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))
