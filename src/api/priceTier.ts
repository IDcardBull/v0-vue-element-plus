import request from './request'

export interface PriceTierPayload {
  minQty: number
  maxQty?: number | null
  price: number
}

export function fetchTiersBySku(skuId: number | string) {
  return request.get<any, PriceTierPayload[]>(`/admin/price-tier/by-sku/${skuId}`)
}

export function saveTiers(skuId: number | string, tiers: PriceTierPayload[]) {
  return request.put<any, PriceTierPayload[]>(`/admin/price-tier/by-sku/${skuId}`, { tiers })
}

export const priceTierApi = {
  fetchTiersBySku,
  saveTiers,
}
