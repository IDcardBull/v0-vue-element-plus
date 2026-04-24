import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

// 后端 API 基地址：支持 .env.local 覆盖
const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

const service: AxiosInstance = axios.create({
  baseURL,
  timeout: 5000,
  withCredentials: false,
})

// ========= 请求拦截 =========
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('admin_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error),
)

// ========= 响应拦截 =========
service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    // 识别 HTML 响应（后端未就绪时 vite 代理回落到 index.html）
    if (typeof res === 'string' && res.trimStart().startsWith('<')) {
      return Promise.reject(new Error('后端未就绪'))
    }
    // 统一 { code, data, message } 结构
    if (res && typeof res === 'object' && 'code' in res) {
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res
  },
  error => {
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || error.message
      if (status === 401) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('admin_user')
        if (location.hash !== '#/login') {
          ElMessage.error('登录已过期，请重新登录')
          location.hash = '#/login'
        }
      } else if (status === 403) {
        ElMessage.error('没有权限访问该资源')
      }
      // 其他错误静默（由页面 catch 自行 fallback）
    }
    return Promise.reject(error)
  },
)

export default service
