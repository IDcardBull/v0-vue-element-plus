import request from './request'

export function fetchStockList(params: any) {
  return request.get<any, { list: any[]; total: number; stats: any }>('/admin/inventory/stocks', { params })
}

export function fetchStockWarning(params: any) {
  return request.get<any, { list: any[]; total: number }>('/admin/inventory/warnings', { params })
}

export function fetchStockRecords(params: any) {
  return request.get<any, { list: any[]; total: number }>('/admin/inventory/records', { params })
}

export function createStockIn(data: any) {
  return request.post<any, any>('/admin/inventory/stock-in', data)
}

export function createStockOut(data: any) {
  return request.post<any, any>('/admin/inventory/stock-out', data)
}

export function createStockAdjust(data: any) {
  return request.post<any, any>('/admin/inventory/adjust', data)
}
