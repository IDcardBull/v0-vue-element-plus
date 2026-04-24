import request from './request'

export interface PriceTier {
  id?: number
  minQty: number
  maxQty: number | null
  price: number
}

export function fetchTiersBySku(skuId: number) {
  return request.get<any, PriceTier[]>(`/admin/skus/${skuId}/tiers`)
}

export function saveTiers(skuId: number, tiers: PriceTier[]) {
  return request.put<any, any>(`/admin/skus/${skuId}/tiers`, { tiers })
}
