import request from './request'

export function fetchSkusByProduct(productId: number) {
  return request.get<any, any[]>(`/admin/products/${productId}/skus`)
}

export function createSku(productId: number, data: any) {
  return request.post<any, any>(`/admin/products/${productId}/skus`, data)
}

export function updateSku(id: number, data: any) {
  return request.patch<any, any>(`/admin/skus/${id}`, data)
}

export function deleteSku(id: number) {
  return request.delete<any, any>(`/admin/skus/${id}`)
}
