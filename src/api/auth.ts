import request from './request'

export interface LoginDto {
  username: string
  password: string
}

export interface LoginResult {
  token: string
  user: {
    id: number
    username: string
    realName?: string
    role?: { id: number; code: string; name: string; permissions: string[] }
  }
}

export function login(data: LoginDto) {
  return request.post<any, LoginResult>('/admin/auth/login', data)
}

export function getProfile() {
  return request.get<any, any>('/admin/auth/profile')
}

export function logout() {
  return request.post<any, any>('/admin/auth/logout')
}
