import request from './request'

export function fetchBrands(params: { page?: number; pageSize?: number; keyword?: string; status?: string }) {
  return request.get<any, { list: any[]; total: number; page: number; pageSize: number }>(
    '/admin/brands',
    { params },
  )
}

export function fetchBrand(id: number) {
  return request.get<any, any>(`/admin/brands/${id}`)
}

export function createBrand(data: any) {
  return request.post<any, any>('/admin/brands', data)
}

export function updateBrand(id: number, data: any) {
  return request.patch<any, any>(`/admin/brands/${id}`, data)
}

export function deleteBrand(id: number) {
  return request.delete<any, any>(`/admin/brands/${id}`)
}

export function toggleBrandStatus(id: number, status: 'active' | 'disabled') {
  return request.patch<any, any>(`/admin/brands/${id}/status`, { status })
}

/** 聚合对象导出（供页面以 brandApi.xxx 调用） */
export const brandApi = {
  list: fetchBrands,
  get: fetchBrand,
  create: createBrand,
  update: updateBrand,
  remove: deleteBrand,
  toggleStatus: toggleBrandStatus,
}
