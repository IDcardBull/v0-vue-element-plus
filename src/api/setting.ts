import request from './request'

export interface SettingItem {
  id?: number
  key: string
  value: string
  remark?: string
}

export const settingApi = {
  list: () => request.get<any, SettingItem[]>('/admin/settings'),
  get: (key: string) => request.get<any, SettingItem>(`/admin/settings/${encodeURIComponent(key)}`),
  set: (key: string, value: string, remark?: string) =>
    request.put<any, SettingItem>(`/admin/settings/${encodeURIComponent(key)}`, { value, remark }),
  testWework: (url?: string) =>
    request.post<any, { ok: boolean; status?: number; response?: string; message?: string }>(
      '/admin/feedbacks/test-wework',
      { url },
    ),
}
