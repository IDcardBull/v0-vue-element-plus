import request from './request'

export interface UploadResult {
  url: string
}

/**
 * 把后端返回的图片地址归一化成同源相对路径：
 * - 老数据带 http://127.0.0.1:3001/uploads/xxx → /uploads/xxx
 * - 完整远程 CDN（http(s)://其它域名）保持原样
 * - 已经是相对路径或 base64 直接返回
 */
export function normalizeImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('data:')) return url
  // 剥掉 localhost / 127.0.0.1 / 0.0.0.0 等本机绝对前缀
  const localPrefix = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i
  return url.replace(localPrefix, '')
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await request.post<any, UploadResult>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
  return { ...res, url: normalizeImageUrl(res.url) }
}

export const uploadApi = {
  file: uploadFile,
  normalize: normalizeImageUrl,
}
