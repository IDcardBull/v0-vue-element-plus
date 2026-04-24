import request from './request'

export function fetchLogs(params: any) {
  return request.get<any, { list: any[]; total: number }>('/admin/logs', { params })
}

export function fetchLog(id: number) {
  return request.get<any, any>(`/admin/logs/${id}`)
}

export const logApi = {
  list: fetchLogs,
  get: fetchLog,
}
