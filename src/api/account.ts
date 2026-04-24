import request from './request'

export function fetchAccounts(params: any) {
  return request.get<any, { list: any[]; total: number }>('/admin/accounts', { params })
}

export function fetchAccount(id: number) {
  return request.get<any, any>(`/admin/accounts/${id}`)
}

export function createAccount(data: any) {
  return request.post<any, any>('/admin/accounts', data)
}

export function updateAccount(id: number, data: any) {
  return request.patch<any, any>(`/admin/accounts/${id}`, data)
}

export function deleteAccount(id: number) {
  return request.delete<any, any>(`/admin/accounts/${id}`)
}

export function resetAccountPassword(id: number, password?: string) {
  return request.post<any, any>(`/admin/accounts/${id}/reset-password`, { password })
}

export const accountApi = {
  list: fetchAccounts,
  get: fetchAccount,
  create: createAccount,
  update: updateAccount,
  remove: deleteAccount,
  resetPassword: resetAccountPassword,
}
