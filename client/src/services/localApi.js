/**
 * 本地 API 服务 - 统一入口
 * 将本地服务包装成与远程 API 相同的接口
 */

import * as settingsService from './local/settingsService'
import * as freewriteService from './local/freewriteService'
import * as practicesService from './local/practicesService'
import * as questionsService from './local/questionsService'
import * as statisticsService from './local/statisticsService'
import * as aiConfigService from './local/aiConfigService'
import * as dictionaryService from './local/dictionaryService'
import * as evaluationsService from './local/evaluationsService'

// 服务映射
const services = {
  // 设置
  'GET /settings': () => settingsService.getSettings(),
  'PUT /settings': (data) => settingsService.updateSettings(data),
  
  // AI 配置
  'GET /ai-config': () => aiConfigService.getAIConfig(),
  'GET /ai-config/all': () => aiConfigService.getAIConfigs(),
  'POST /ai-config': (data) => aiConfigService.saveAIConfig(data),
  'DELETE /ai-config/:id': (id) => aiConfigService.deleteAIConfig(id),
  'PUT /ai-config/:id/activate': (id) => aiConfigService.activateAIConfig(id),
  'POST /ai-config/test': (data) => aiConfigService.testAIConnection(data),
  'POST /ai-config/models': (data) => aiConfigService.getAIModels(data),
  'GET /ai-config/features': () => aiConfigService.getAIFeatures(),
  'GET /ai-config/feature-configs': () => aiConfigService.getFeatureConfigs(),
  'PUT /ai-config/feature-configs': (data) => aiConfigService.saveFeatureConfig(data),
  'PUT /ai-config/feature-configs/batch': (data) => aiConfigService.saveFeatureConfigsBatch(data),
  
  // 随心练习
  'GET /freewrite': (params) => freewriteService.getFreewriteList(params),
  'GET /freewrite/:id': (id) => freewriteService.getFreewrite(id),
  'POST /freewrite': (data) => freewriteService.createFreewrite(data),
  'PUT /freewrite/:id': (id, data) => freewriteService.updateFreewrite(id, data),
  'POST /freewrite/:id/finish': (id, data) => freewriteService.finishFreewrite(id, data),
  'POST /freewrite/:id/self-review': (id, data) => freewriteService.submitSelfReview(id, data),
  'DELETE /freewrite/:id': (id) => freewriteService.deleteFreewrite(id),
  'GET /freewrite/stats/overview': () => freewriteService.getFreewriteStats(),
  
  // 练习
  'GET /practices': (params) => practicesService.getPracticeList(params),
  'GET /practices/:id': (id) => practicesService.getPractice(id),
  'POST /practices': (data) => practicesService.createPractice(data),
  'PUT /practices/:id': (id, data) => practicesService.updatePractice(id, data),
  'POST /practices/:id/submit': (id, data) => practicesService.submitPractice(id, data),
  'DELETE /practices/:id': (id) => practicesService.deletePractice(id),
  
  // 题目
  'GET /questions': (params) => questionsService.getQuestionList(params),
  'GET /questions/:id': (id) => questionsService.getQuestion(id),
  'POST /questions': (data) => questionsService.createQuestion(data),
  'POST /questions/generate': (data) => questionsService.generateQuestion(data),
  'PUT /questions/:id': (id, data) => questionsService.updateQuestion(id, data),
  'DELETE /questions/:id': (id) => questionsService.deleteQuestion(id),
  'POST /questions/:id/favorite': (id) => questionsService.toggleFavorite(id),
  'GET /questions/types/list': () => questionsService.getQuestionTypes(),
  
  // 统计
  'GET /statistics/overview': () => statisticsService.getOverview(),
  'GET /statistics/daily': (params) => statisticsService.getDailyStats(params?.days),
  'GET /statistics/scores': () => statisticsService.getScoreStats(),
  
  // 评审
  'POST /evaluations': (data) => evaluationsService.requestEvaluation(data),
  'GET /evaluations/:practiceId': (id) => evaluationsService.getEvaluations(id),
  'GET /evaluations/detail/:id': (id) => evaluationsService.getEvaluationDetail(id),
  
  // 词典
  'GET /dictionary/categories': () => dictionaryService.getCategories(),
  'GET /dictionary/words': (params) => dictionaryService.getWords(params),
  'POST /dictionary/words': (data) => dictionaryService.addWord(data),
  'POST /dictionary/words/batch': (data) => dictionaryService.addWordsBatch(data),
  'PUT /dictionary/words/:id': (id, data) => dictionaryService.updateWord(id, data),
  'DELETE /dictionary/words/:id': (id) => dictionaryService.deleteWord(id),
  'POST /dictionary/words/:id/use': (id) => dictionaryService.useWord(id),
  'POST /dictionary/ai/search': (data) => dictionaryService.aiSearchWords(data),
  'POST /dictionary/ai/generate': (data) => dictionaryService.aiGenerateWords(data),
  'GET /dictionary/stats': () => dictionaryService.getDictionaryStats(),
}

/**
 * 匹配路由
 */
function matchRoute(method, path) {
  // 先尝试精确匹配
  const exactKey = `${method} ${path}`
  if (services[exactKey]) {
    return { handler: services[exactKey], params: {} }
  }
  
  // 尝试带参数的路由匹配
  for (const [pattern, handler] of Object.entries(services)) {
    const [routeMethod, routePath] = pattern.split(' ')
    
    if (routeMethod !== method) continue
    
    // 检查是否是参数路由
    const patternParts = routePath.split('/')
    const pathParts = path.split('/')
    
    if (patternParts.length !== pathParts.length) continue
    
    const params = {}
    let match = true
    
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i]
      } else if (patternParts[i] !== pathParts[i]) {
        match = false
        break
      }
    }
    
    if (match) {
      return { handler, params }
    }
  }
  
  return null
}

/**
 * 本地 API 请求处理
 */
export async function localRequest(config) {
  const { method = 'GET', url, data, params } = config
  
  // 移除 /api 前缀
  const path = url.replace(/^\/api/, '')
  
  // 匹配路由
  const route = matchRoute(method.toUpperCase(), path)
  
  if (!route) {
    console.warn(`本地 API 未实现: ${method} ${path}`)
    throw new Error(`API 未实现: ${method} ${path}`)
  }
  
  try {
    // 调用对应的服务
    const { handler, params: routeParams } = route
    
    // 根据路由参数和请求数据调用处理函数
    const id = routeParams.id
    
    if (id && data) {
      return await handler(id, data)
    } else if (id) {
      return await handler(id)
    } else if (data) {
      return await handler(data)
    } else if (params) {
      return await handler(params)
    } else {
      return await handler()
    }
  } catch (error) {
    console.error(`本地 API 错误: ${method} ${path}`, error)
    throw error
  }
}
