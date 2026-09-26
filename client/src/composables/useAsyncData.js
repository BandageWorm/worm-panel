import { ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 收敛「设置 loading → 请求 → 失败提示 → 复位 loading」的样板代码。
 *
 * 只用于同构的列表/状态加载：单次请求、单个数据 ref、失败时仅弹错误提示。
 * 带额外副作用的流程（上传、登录、重建配置等）保持各自写法，避免引入行为差异。
 *
 * 用法：
 *   const { loading, data: rules, load: loadRules } = useAsyncData(
 *     () => get('/firewall/rules'),
 *     { errorPrefix: '加载规则失败' }
 *   )
 *
 * @param {(...args: any[]) => Promise<any>} loader
 * @param {{ errorPrefix?: string, initial?: any }} [options]
 *   - initial: data 的初始值，默认 null。
 *     列表类数据务必传 []，否则模板首次渲染访问 .length 会抛错
 */
export function useAsyncData(loader, options = {}) {
  const { errorPrefix = '', initial = null } = options

  const loading = ref(false)
  const data = ref(initial)
  const error = ref(null)

  async function load(...args) {
    loading.value = true
    error.value = null
    try {
      const result = await loader(...args)
      data.value = result
      return result
    } catch (e) {
      error.value = e
      ElMessage.error(errorPrefix ? `${errorPrefix}: ${e.message}` : e.message)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, data, error, load }
}
