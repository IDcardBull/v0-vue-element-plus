import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 通用分页列表 composable，统一处理 loading、分页、查询、刷新
 *
 * 用法：
 *   const { list, loading, pagination, query, reload } = useTable({
 *     fetcher: (params) => productApi.list(params),
 *     initialQuery: { keyword: '', status: '' },
 *   })
 */
export function useTable<Row = any, Query extends Record<string, any> = any>(opts: {
  fetcher: (params: Query & { page: number; pageSize: number }) => Promise<any>
  initialQuery?: Query
  immediate?: boolean
  onSuccess?: (data: any) => void
}) {
  const list = ref<Row[]>([]) as any
  const loading = ref(false)
  const pagination = reactive({
    page: 1,
    pageSize: 10,
    total: 0,
  })
  const query = reactive({ ...(opts.initialQuery || {}) }) as Query

  async function reload() {
    loading.value = true
    try {
      const params = {
        ...(query as any),
        page: pagination.page,
        pageSize: pagination.pageSize,
      } as Query & { page: number; pageSize: number }
      const res = await opts.fetcher(params)
      // 约定：后端返回 { list, total, page, pageSize } 或直接数组
      if (Array.isArray(res)) {
        list.value = res as Row[]
        pagination.total = res.length
      } else if (res && typeof res === 'object') {
        list.value = (res.list ?? []) as Row[]
        pagination.total = res.total ?? 0
      }
      opts.onSuccess?.(res)
    } catch (err: any) {
      ElMessage.error(err?.message || '加载失败')
      list.value = [] as Row[]
      pagination.total = 0
    } finally {
      loading.value = false
    }
  }

  function onPageChange(page: number) {
    pagination.page = page
    reload()
  }

  function onSizeChange(size: number) {
    pagination.pageSize = size
    pagination.page = 1
    reload()
  }

  function onSearch() {
    pagination.page = 1
    reload()
  }

  function resetQuery() {
    Object.keys(query as any).forEach((k) => {
      ;(query as any)[k] = ''
    })
    pagination.page = 1
    reload()
  }

  if (opts.immediate !== false) {
    onMounted(() => reload())
  }

  return {
    list,
    loading,
    pagination,
    query,
    reload,
    onPageChange,
    onSizeChange,
    onSearch,
    resetQuery,
  }
}
