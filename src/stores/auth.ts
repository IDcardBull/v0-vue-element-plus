import { defineStore } from 'pinia'
import { login as apiLogin, getProfile as apiProfile, logout as apiLogout, type LoginDto } from '@/api/auth'

interface AuthUser {
  id: number
  username: string
  realName?: string
  role?: { id: number; code: string; name: string; permissions: string[] }
}

interface State {
  token: string
  user: AuthUser | null
}

export const useAuthStore = defineStore('auth', {
  state: (): State => ({
    token: localStorage.getItem('admin_token') || '',
    user: JSON.parse(localStorage.getItem('admin_user') || 'null'),
  }),

  getters: {
    isLoggedIn: state => !!state.token,
    permissions: state => state.user?.role?.permissions || [],
  },

  actions: {
    async login(payload: LoginDto) {
      const res = await apiLogin(payload)
      this.token = res.token
      this.user = res.user
      localStorage.setItem('admin_token', res.token)
      localStorage.setItem('admin_user', JSON.stringify(res.user))
    },

    async fetchProfile() {
      try {
        const user = await apiProfile()
        this.user = user
        localStorage.setItem('admin_user', JSON.stringify(user))
      } catch {
        this.logout()
      }
    },

    async logout() {
      try {
        await apiLogout()
      } catch {
        /* ignore */
      }
      this.token = ''
      this.user = null
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
    },

    hasPermission(code: string) {
      const perms = this.permissions
      if (perms.includes('*')) return true
      if (perms.includes(code)) return true
      const [module] = code.split(':')
      return perms.includes(`${module}:*`)
    },
  },
})
