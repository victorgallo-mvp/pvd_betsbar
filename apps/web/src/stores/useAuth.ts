import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserDTO } from '@pdv/shared'
import { api } from '../lib/api'

interface AuthState {
  user: UserDTO | null
  isLoading: boolean
  error: string | null
  login: (pin: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      error: null,

      login: async (pin) => {
        set({ isLoading: true, error: null })
        try {
          const user = await api.post<UserDTO>('/auth/login', { pin })
          set({ user, isLoading: false })
          return true
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Erro ao autenticar',
            isLoading: false,
          })
          return false
        }
      },

      logout: () => set({ user: null, error: null }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'pdv-auth',
      partialize: (state) => ({ user: state.user }),
    },
  ),
)
