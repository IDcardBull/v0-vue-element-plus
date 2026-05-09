import request from './request'

export interface ProductQuery {
  page?: number
  pageSize?: number
  keyword?: string
  categoryId?: number
  status?: string
  channel?: 'retail' | 'wholesale'
}

export function fetchProducts(params: ProductQuery) {
  return request.get<any, { list: any[]; total: number; page: number; pageSize: number }>(
    '/admin/products',
    { params },
  )
}

export function fetchProduct(id: number) {
  return request.get<any, any>(`/admin/products/${id}`)
}

export function createProduct(data: any) {
  return request.post<any, any>('/admin/products', data)
}

export function updateProduct(id: number, data: any) {
  return request.patch<any, any>(`/admin/products/${id}`, data)
}

export function deleteProduct(id: number) {
  return request.delete<any, any>(`/admin/products/${id}`)
}

export function toggleProductStatus(id: number, status: 'on_sale' | 'off_sale') {
  return request.patch<any, any>(`/admin/products/${id}/status`, { status })
}

export function toggleChannel(id: number, channel: 'retail' | 'wholesale', enabled: boolean) {
  return request.patch<any, any>(`/admin/products/${id}/channel`, { channel, enabled })
}

export const productApi = {
  list: fetchProducts,
  get: fetchProduct,
  create: createProduct,
  update: updateProduct,
  remove: deleteProduct,
  toggleStatus: toggleProductStatus,
  toggleChannel,
}
