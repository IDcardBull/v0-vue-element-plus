/**
 * 运费模板计算工具
 *
 * 在 OrderService.createOrder 里被调用：
 *   - 同一订单按 shippingTemplateId 分组
 *   - 每组内按"件数(calcType=1) / 重量(calcType=2)"汇总
 *   - 命中 specialRules.regions（按收件省匹配）→ 用特殊规则覆盖默认规则
 *   - freeShippingEnabled=true 且小计 >= threshold → 该组运费为 0
 *   - 各组运费相加返回
 *
 * 设计原则：所有规则字段都做防御性 Number()，避免 Prisma JSON 里存的 '0' 字符串
 * 直接被 NaN 污染。
 */

export interface ShippingRule {
  firstAmount: number
  firstPrice: number
  continueAmount: number
  continuePrice: number
}
export interface SpecialRule extends ShippingRule {
  regions: string[]
}
export interface FreeShippingRule {
  regions: string[]
  threshold: number
}
export interface ShippingTemplateLike {
  id: number
  calcType: number // 1 按件 / 2 按重量
  defaultRule: ShippingRule | any
  specialRules: SpecialRule[] | any
  freeShippingEnabled: boolean
  freeShippingRules: FreeShippingRule[] | any
}

export interface ShippingItemInput {
  /** 件数 */
  qty: number
  /** 单 SKU 重量（kg），仅 calcType=2 用得到 */
  weight?: number | null
  /** 该商品行小计（元），用于满额包邮 */
  subtotal: number
}

function asArray<T>(v: any): T[] {
  if (Array.isArray(v)) return v as T[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function asObject(v: any): any {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }
  return {}
}

function regionMatch(regions: string[] | undefined, province?: string | null): boolean {
  // regions 为空或未传 → 全国适用
  if (!regions || !regions.length) return true
  if (!province) return false
  return regions.some((r) => province.includes(r) || r.includes(province))
}

function pickRule(template: ShippingTemplateLike, province?: string | null): ShippingRule {
  const specials = asArray<SpecialRule>(template.specialRules)
  const matched = specials.find((r) => regionMatch(r.regions, province))
  const raw = matched || asObject(template.defaultRule)
  return {
    firstAmount: Math.max(Number(raw.firstAmount) || 0, 0),
    firstPrice: Math.max(Number(raw.firstPrice) || 0, 0),
    continueAmount: Math.max(Number(raw.continueAmount) || 0, 0),
    continuePrice: Math.max(Number(raw.continuePrice) || 0, 0),
  }
}

/**
 * 用模板算一组商品的运费。
 * units = 总件数（calcType=1）或 总重量 kg（calcType=2）
 */
export function calcShippingByTemplate(
  template: ShippingTemplateLike,
  items: ShippingItemInput[],
  province?: string | null,
): number {
  if (!items?.length) return 0

  const units =
    Number(template.calcType) === 2
      ? items.reduce((sum, it) => sum + (Number(it.weight) || 0) * (Number(it.qty) || 0), 0)
      : items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)

  if (units <= 0) return 0

  // 满额包邮：在所选地区内 && 小计 >= 阈值 → 该模板免邮
  if (template.freeShippingEnabled) {
    const subtotal = items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0)
    const rules = asArray<FreeShippingRule>(template.freeShippingRules)
    const hit = rules.find(
      (r) => regionMatch(r.regions, province) && subtotal >= (Number(r.threshold) || Infinity),
    )
    if (hit) return 0
  }

  const rule = pickRule(template, province)
  if (rule.firstAmount <= 0) return 0 // 模板未配置首件，按免邮处理

  if (units <= rule.firstAmount) return rule.firstPrice

  if (rule.continueAmount <= 0) return rule.firstPrice // 没配续费，只收首费

  // 超出首件部分：每 continueAmount 单位收 continuePrice，向上取整
  const extra = units - rule.firstAmount
  const extraGroups = Math.ceil(extra / rule.continueAmount)
  return Number((rule.firstPrice + extraGroups * rule.continuePrice).toFixed(2))
}
