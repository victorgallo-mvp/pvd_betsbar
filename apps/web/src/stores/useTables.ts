import { create } from 'zustand'
import type { TableDTO } from '@pdv/shared'
import { api } from '../lib/api'

interface TablesState {
  tables: TableDTO[]
  isLoading: boolean
  fetchTables: () => Promise<void>
  updateTable: (table: TableDTO) => void
}

export const useTables = create<TablesState>((set) => ({
  tables: [],
  isLoading: false,

  fetchTables: async () => {
    set({ isLoading: true })
    try {
      const tables = await api.get<TableDTO[]>('/tables')
      set({ tables, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  // Called by the WebSocket hook when a table_update event arrives
  updateTable: (table) =>
    set((state) => ({
      tables: state.tables.map((t) => (t.id === table.id ? table : t)),
    })),
}))
