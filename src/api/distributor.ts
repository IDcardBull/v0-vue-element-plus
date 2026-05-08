import request from './request'

export function fetchDistributors(params: any) {
  return request.get<any, { list: any[]; total: number }>('/admin/distributors', { params })
}

export function fetchDistributor(id: number) {
  return request.get<any, any>(`/admin/distributors/${id}`)
}

export function updateDistributor(id: number, data: any) {
  return request.patch<any, any>(`/admin/distributors/${id}`, data)
}

export function auditDistributor(id: number, pass: boolean, remark?: string) {
  return request.post<any, any>(`/admin/distributors/${id}/audit`, { pass, remark })
}

export interface DistributorStats {
  total: number
  approved: number
  pending: number
  rejected: number
  disabled: number
  totalAmount: number
  thisMonthAmount: number
  lastMonthAmount: number
  amountTrend: number | null
}

export function fetchDistributorStats() {
  return request.get<any, DistributorStats>('/admin/distributors/stats')
}

export const distributorApi = {
  list: fetchDistributors,
  get: fetchDistributor,
  update: updateDistributor,
  audit: auditDistributor,
  stats: fetchDistributorStats,
}
