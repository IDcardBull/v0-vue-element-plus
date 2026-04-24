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
