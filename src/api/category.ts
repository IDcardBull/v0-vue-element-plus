import request from './request'

export function fetchCategoryTree() {
  return request.get<any, any[]>('/admin/categories/tree')
}

export function fetchCategory(id: number) {
  return request.get<any, any>(`/admin/categories/${id}`)
}

export function createCategory(data: any) {
  return request.post<any, any>('/admin/categories', data)
}

export function updateCategory(id: number, data: any) {
  return request.patch<any, any>(`/admin/categories/${id}`, data)
}

export function deleteCategory(id: number) {
  return request.delete<any, any>(`/admin/categories/${id}`)
}
