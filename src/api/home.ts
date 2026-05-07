import request from './request'

export interface HomeBanner {
  id?: number | string
  title: string
  imageUrl: string
  image?: string
  linkUrl?: string
  link?: string
  sort?: number
  enabled?: boolean
}

export function fetchHomeBanners() {
  return request.get<any, HomeBanner[] | { list?: HomeBanner[] }>('/home/banners')
}

export function saveHomeBanners(data: HomeBanner[]) {
  return request.post<any, HomeBanner[]>('/home/banners', data)
}

export const homeApi = {
  banners: fetchHomeBanners,
  saveBanners: saveHomeBanners,
}
