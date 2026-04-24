import request from './request'

export function fetchOverview() {
  return request.get<any, any>('/admin/dashboard/overview')
}

export function fetchSalesTrend(days = 30) {
  return request.get<any, Array<{ date: string; retail: number; wholesale: number }>>(
    '/admin/dashboard/sales-trend',
    { params: { days } },
  )
}

export function fetchTopProducts(limit = 10) {
  return request.get<any, any[]>('/admin/dashboard/top-products', { params: { limit } })
}
