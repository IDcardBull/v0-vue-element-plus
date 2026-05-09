import request from './request'

/**
 * 简化版（v2）：
 * 库存只做"商品 + 数量"展示。
 * 后端去掉了 stockLog 流水、warnMin/warnMax 预警阈值、reserved 占用、inTransit 在途。
 * 前端只保留 list、updateOnHand、warehouses 三个接口。
 */

export function fetchStockList(params: any) {
  return request.get<any, { list: any[]; total: number }>('/admin/inventory/stocks', { params })
}

export function updateStockOnHand(id: number, onHand: number) {
  return request.patch<any, any>(`/admin/inventory/stocks/${id}`, { onHand })
}

export function fetchWarehouses() {
  return request.get<any, Array<{ id: number; name: string; code?: string }>>(
    '/admin/inventory/warehouses',
  )
}

export const inventoryApi = {
  warehouses: fetchWarehouses,
  stockList: fetchStockList,
  updateOnHand: updateStockOnHand,
}
