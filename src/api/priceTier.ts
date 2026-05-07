import request from './request'

export interface PriceTier {
  id?: number
  minQty: number
  maxQty: number | null
  price: number
}

export function fetchTiersBySku(skuId: number) {
  return request.get<any, PriceTier[]>(`/admin/price-tier/by-sku/${skuId}`)
}

export function saveTiers(skuId: number, tiers: PriceTier[]) {
  return request.put<any, any>(`/admin/price-tier/by-sku/${skuId}`, { tiers })
}
