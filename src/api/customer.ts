import request from './request'

export function fetchCustomers(params: any) {
  return request.get<any, { list: any[]; total: number }>('/admin/customers', { params })
}

export function fetchCustomer(id: number) {
  return request.get<any, any>(`/admin/customers/${id}`)
}

export function updateCustomer(id: number, data: any) {
  return request.patch<any, any>(`/admin/customers/${id}`, data)
}

export interface CustomerStats {
  total: number
  newThisMonth: number
  paid: number
  paidRate: number
  avgOrder: number
  avgOrderPrev: number
  avgOrderTrend: number | null
  active: number
  activeRate: number
}

export function fetchCustomerStats() {
  return request.get<any, CustomerStats>('/admin/customers/stats')
}

export const customerApi = {
  list: fetchCustomers,
  get: fetchCustomer,
  update: updateCustomer,
  stats: fetchCustomerStats,
}
