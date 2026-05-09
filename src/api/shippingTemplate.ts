import request from './request'

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

export interface ShippingTemplate {
  id: number
  name: string
  templateName?: string
  calcType: 1 | 2
  defaultRule: ShippingRule
  specialRules: SpecialRule[]
  freeShippingEnabled: boolean
  freeShippingRules: FreeShippingRule[]
  createdAt?: string
  updatedAt?: string
}

export interface ShippingTemplatePayload {
  templateName: string
  calcType: 1 | 2
  defaultRule: ShippingRule
  specialRules: SpecialRule[]
  freeShippingEnabled: boolean
  freeShippingRules: FreeShippingRule[]
}

export const shippingTemplateApi = {
  list: () => request.get<any, ShippingTemplate[]>('/admin/shipping-templates'),
  detail: (id: number) => request.get<any, ShippingTemplate>(`/admin/shipping-templates/${id}`),
  create: (data: ShippingTemplatePayload) =>
    request.post<any, ShippingTemplate>('/admin/shipping-templates', data),
  update: (id: number, data: ShippingTemplatePayload) =>
    request.patch<any, ShippingTemplate>(`/admin/shipping-templates/${id}`, data),
  remove: (id: number) => request.delete<any, void>(`/admin/shipping-templates/${id}`),
}
