import axios from 'axios'
import { ElMessage } from 'element-plus'
import { Capacitor } from '@capacitor/core'

// 判断是否在 Electron 环境中运行
const isElectron = window.electronAPI !== undefined

// 判断是否在 Capacitor (移动端 APP) 环境中运行
const isCapacitor = Capacitor.isNativePlatform()

// 是否使用本地数据库模式（移动端默认使用本地模式）
let useLocalMode = isCapacitor

// 本地 API 服务（延迟加载）
let localApiModule = null

async function getLocalApi() {
  if (!localApiModule) {
    localApiModule = await import('../services/localApi')
  }
  return localApiModule
}

// 根据环境设置 baseURL
const getBaseURL = () => {
  if (isElectron) {
    return 'http://localhost:3000/api'
  }
  // Web 环境或远程模式
  return '/api'
}

// 导出函数供设置页面使用
export const setUseLocalMode = (value) => {
  useLocalMode = value
  localStorage.setItem('use_local_mode', value ? 'true' : 'false')
}

export const getUseLocalMode = () => {
  const saved = localStorage.getItem('use_local_mode')
  if (saved !== null) {
    return saved === 'true'
  }
  return isCapacitor // 移动端默认使用本地模式
}

export const isNativeApp = () => {
  return isCapacitor
}

// 初始化时读取配置
useLocalMode = getUseLocalMode()

const axiosInstance = axios.create({
  baseURL: getBaseURL(),
  timeout: 1200000 // 20分钟
})

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    const res = response.data
    
    if (res.success === false) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    
    return res
  },
  (error) => {
    let message = '网络错误'
    
    if (error.response) {
      switch (error.response.status) {
        case 400:
          message = error.response.data?.message || '请求参数错误'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 500:
          message = '服务器内部错误'
          break
        default:
          message = error.response.data?.message || `请求失败 (${error.response.status})`
      }
    } else if (error.code === 'ECONNABORTED') {
      message = '请求超时，请稍后重试'
    }
    
    ElMessage.error(message)
    return Promise.reject(error)
  }
)

// 创建代理请求对象，支持本地模式和远程模式切换
const request = {
  async get(url, config = {}) {
    if (useLocalMode && isCapacitor) {
      const localApi = await getLocalApi()
      return localApi.localRequest({
        method: 'GET',
        url,
        params: config.params
      })
    }
    return axiosInstance.get(url, config)
  },
  
  async post(url, data, config = {}) {
    if (useLocalMode && isCapacitor) {
      const localApi = await getLocalApi()
      return localApi.localRequest({
        method: 'POST',
        url,
        data
      })
    }
    return axiosInstance.post(url, data, config)
  },
  
  async put(url, data, config = {}) {
    if (useLocalMode && isCapacitor) {
      const localApi = await getLocalApi()
      return localApi.localRequest({
        method: 'PUT',
        url,
        data
      })
    }
    return axiosInstance.put(url, data, config)
  },
  
  async delete(url, config = {}) {
    if (useLocalMode && isCapacitor) {
      const localApi = await getLocalApi()
      return localApi.localRequest({
        method: 'DELETE',
        url
      })
    }
    return axiosInstance.delete(url, config)
  }
}

export default request
