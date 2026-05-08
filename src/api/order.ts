import request from './request'

export interface OrderQuery {
  page?: number
  pageSize?: number
  keyword?: string
  channel?: string
  status?: string
  startTime?: string
  endTime?: string
}

export function fetchOrders(params: OrderQuery) {
  return request.get<any, { list: any[]; total: number; stats: any }>('/admin/orders', { params })
}

export function fetchOrder(id: number) {
  return request.get<any, any>(`/admin/orders/${id}`)
}

export function shipOrder(
  id: number,
  data: { logisticsCompany: string; logisticsNo: string; remark?: string },
) {
  return request.post<any, any>(`/admin/orders/${id}/ship`, data)
}

export function fetchOrderLogistics(id: number) {
  return request.get<any, any>(`/admin/orders/${id}/logistics`)
}

export function completeOrder(id: number) {
  return request.post<any, any>(`/admin/orders/${id}/complete`)
}

export function closeOrder(id: number, reason?: string) {
  return request.post<any, any>(`/admin/orders/${id}/close`, { reason })
}

export function refundOrder(id: number, amount?: number, reason?: string) {
  return request.post<any, any>(`/admin/orders/${id}/refund`, { amount, reason })
}

export function markOrderPaid(id: number) {
  return request.patch<any, any>(`/admin/orders/${id}/mark-paid`)
}

export const orderApi = {
  list: fetchOrders,
  get: fetchOrder,
  ship: shipOrder,
  logistics: fetchOrderLogistics,
  complete: completeOrder,
  close: closeOrder,
  refund: refundOrder,
  markPaid: markOrderPaid,
}
