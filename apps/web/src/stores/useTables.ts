import { create } from 'zustand'
import type { TableDTO } from '@pdv/shared'
import { api } from '../lib/api'

interface TablesState {
  tables: TableDTO[]
  isLoading: boolean
  fetchError: boolean
  fetchTables: () => Promise<void>
  updateTable: (table: TableDTO) => void
}

export const useTables = create<TablesState>((set) => ({
  tables: [],
  isLoading: false,
  fetchError: false,

  fetchTables: async () => {
    set({ isLoading: true })
    try {
      const tables = await api.get<TableDTO[]>('/tables')
      set({ tables, isLoading: false, fetchError: false })
    } catch {
      // Falha silenciosa aqui já causou mesas "sumindo" — o erro precisa ficar visível
      set({ isLoading: false, fetchError: true })
    }
  },

  // Called by the WebSocket hook when a table_update event arrives
  updateTable: (table) =>
    set((state) => ({
      tables: state.tables.map((t) => (t.id === table.id ? table : t)),
    })),
}))
