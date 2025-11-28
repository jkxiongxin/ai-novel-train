import axios from 'axios'
import { ElMessage } from 'element-plus'

// 判断是否在 Electron 环境中运行
const isElectron = window.electronAPI !== undefined

// 根据环境设置 baseURL
// 在 Electron 生产环境中，前后端在同一个端口
const getBaseURL = () => {
  if (isElectron) {
    // Electron 环境：使用本地服务器
    return 'http://localhost:3000/api'
  }
  // Web 环境：使用相对路径（由 Vite proxy 处理）
  return '/api'
}

const request = axios.create({
  baseURL: getBaseURL(),
  timeout: 1200000 // 20分钟
})

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
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

export default request
