import request from './request'

export function fetchRoles() {
  return request.get<any, any[]>('/admin/roles')
}

export function fetchRole(id: number) {
  return request.get<any, any>(`/admin/roles/${id}`)
}

export function createRole(data: any) {
  return request.post<any, any>('/admin/roles', data)
}

export function updateRole(id: number, data: any) {
  return request.patch<any, any>(`/admin/roles/${id}`, data)
}

export function deleteRole(id: number) {
  return request.delete<any, any>(`/admin/roles/${id}`)
}

export function updateRolePermissions(id: number, permissions: string[]) {
  return request.patch<any, any>(`/admin/roles/${id}/permissions`, { permissions })
}

export const roleApi = {
  list: fetchRoles,
  get: fetchRole,
  create: createRole,
  update: updateRole,
  remove: deleteRole,
  updatePermissions: updateRolePermissions,
}
