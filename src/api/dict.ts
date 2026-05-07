import request from './request'

export interface DictItem {
  id: number
  typeCode: string
  label: string
  value: string
  sort: number
  status: number
  remark?: string
}

export function fetchDictItems(typeCode: string, includeDisabled = false) {
  return request.get<any, DictItem[]>(`/admin/dicts/${typeCode}`, {
    params: { includeDisabled },
  })
}

export function createDictItem(typeCode: string, data: Partial<DictItem> & { label: string }) {
  return request.post<any, DictItem>(`/admin/dicts/${typeCode}/items`, data)
}

export function updateDictItem(id: number, data: Partial<DictItem>) {
  return request.patch<any, DictItem>(`/admin/dicts/items/${id}`, data)
}

export function deleteDictItem(id: number) {
  return request.delete<any, DictItem>(`/admin/dicts/items/${id}`)
}

export const dictApi = {
  items: fetchDictItems,
  createItem: createDictItem,
  updateItem: updateDictItem,
  removeItem: deleteDictItem,
}
