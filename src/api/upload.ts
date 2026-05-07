import request from './request'

export interface UploadResult {
  url: string
}

export function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return request.post<any, UploadResult>('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 30000,
  })
}

export const uploadApi = {
  file: uploadFile,
}
