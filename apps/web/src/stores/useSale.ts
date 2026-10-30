import { create } from 'zustand'
import type { SaleDTO, UserDTO } from '@pdv/shared'
import { api } from '../lib/api'

interface SaleState {
  // Who is operating this sale (per-sale PIN, not persisted)
  saleOperator: UserDTO | null
  // The sale currently being worked on
  currentSale: SaleDTO | null
  isLoading: boolean
  error: string | null

  setSaleOperator: (user: UserDTO) => void
  clearSaleOperator: () => void

  loadSale: (saleId: string) => Promise<void>

  openSale: (input: {
    type: string
    tableId?: string
    operatorId: string
    customerName?: string
    customerAddress?: string
    guests?: string[]
  }) => Promise<SaleDTO>

  updateSale: (saleId: string, input: { customerName?: string; customerAddress?: string }) => Promise<void>
  addItem: (saleId: string, productId: string, qty?: number, guestId?: string | null) => Promise<void>
  removeItem: (saleId: string, itemId: string) => Promise<void>
  cancelItem: (saleId: string, itemId: string) => Promise<void>
  moveItem: (saleId: string, itemId: string, guestId: string | null) => Promise<void>
  // Pessoas da mesa (divisão por pessoa). Lançam erro para a tela mostrar a mensagem.
  addGuest: (saleId: string, name: string) => Promise<void>
  renameGuest: (saleId: string, guestId: string, name: string) => Promise<void>
  removeGuest: (saleId: string, guestId: string) => Promise<void>
  concludeItems: (saleId: string) => Promise<{ printed: number; queued: number }>
  requestBill: (saleId: string, peopleCount: number, guestId?: string | null) => Promise<void>
  cancelSale: (saleId: string) => Promise<void>
  registerPayment: (
    saleId: string,
    method: string,
    amount: number,
    guestId?: string | null,
  ) => Promise<SaleDTO>

  clearSale: () => void
  clearError: () => void
}

export const useSale = create<SaleState>((set, get) => ({
  saleOperator: null,
  currentSale: null,
  isLoading: false,
  error: null,

  setSaleOperator: (user) => set({ saleOperator: user }),
  clearSaleOperator: () => set({ saleOperator: null }),

  loadSale: async (saleId) => {
    set({ isLoading: true, error: null })
    try {
      const sale = await api.get<SaleDTO>(`/sales/${saleId}`)
      set({ currentSale: sale, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  openSale: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const sale = await api.post<SaleDTO>('/sales', input)
      set({ currentSale: sale, isLoading: false })
      return sale
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
      throw err
    }
  },

  updateSale: async (saleId, input) => {
    try {
      const sale = await api.patch<SaleDTO>(`/sales/${saleId}`, input)
      set({ currentSale: sale })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  addItem: async (saleId, productId, qty = 1, guestId = null) => {
    try {
      const sale = await api.post<SaleDTO>(`/sales/${saleId}/items`, {
        productId,
        qty,
        guestId,
        // garçom deste aparelho: o item conta para ele, não para quem abriu a mesa
        operatorId: get().saleOperator?.id,
      })
      set({ currentSale: sale })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  removeItem: async (saleId, itemId) => {
    try {
      const sale = await api.delete<SaleDTO>(`/sales/${saleId}/items/${itemId}`)
      set({ currentSale: sale })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  cancelItem: async (saleId, itemId) => {
    try {
      const sale = await api.patch<SaleDTO>(`/sales/${saleId}/items/${itemId}/cancel`, { operatorId: get().saleOperator?.id })
      set({ currentSale: sale })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  moveItem: async (saleId, itemId, guestId) => {
    try {
      const sale = await api.patch<SaleDTO>(`/sales/${saleId}/items/${itemId}`, { guestId })
      set({ currentSale: sale })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  addGuest: async (saleId, name) => {
    const sale = await api.post<SaleDTO>(`/sales/${saleId}/guests`, { name })
    set({ currentSale: sale })
  },

  renameGuest: async (saleId, guestId, name) => {
    const sale = await api.patch<SaleDTO>(`/sales/${saleId}/guests/${guestId}`, { name })
    set({ currentSale: sale })
  },

  removeGuest: async (saleId, guestId) => {
    const sale = await api.delete<SaleDTO>(`/sales/${saleId}/guests/${guestId}`)
    set({ currentSale: sale })
  },

  concludeItems: async (saleId) => {
    try {
      const result = await api.post<SaleDTO & { _kitchen: { printed: number; queued: number } }>(
        `/sales/${saleId}/conclude`,
        {},
      )
      const { _kitchen, ...sale } = result
      set({ currentSale: sale as SaleDTO })
      return _kitchen
    } catch (err) {
      set({ error: (err as Error).message })
      return { printed: 0, queued: 0 }
    }
  },

  requestBill: async (saleId, peopleCount, guestId = null) => {
    try {
      const sale = await api.post<SaleDTO>(`/sales/${saleId}/request-bill`, { peopleCount, guestId })
      set({ currentSale: sale })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  cancelSale: async (saleId) => {
    try {
      await api.delete(`/sales/${saleId}`)
      set({ currentSale: null })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  registerPayment: async (saleId, method, amount, guestId = null) => {
    set({ isLoading: true })
    try {
      const sale = await api.post<SaleDTO>(`/sales/${saleId}/payments`, { method, amount, guestId })
      set({ currentSale: sale, isLoading: false })
      return sale
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
      throw err
    }
  },

  clearSale: () => set({ currentSale: null }),
  clearError: () => set({ error: null }),
}))
