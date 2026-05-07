<template>
  <div class="log-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">操作日志</h2>
        <p class="page-subtitle">系统关键操作审计，保留 365 天</p>
      </div>
      <el-button :icon="Download" @click="exportLogs">导出日志</el-button>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadLogs">点击重试</el-button>
      </template>
    </el-alert>

    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="操作人">
          <el-input v-model="filter.operator" placeholder="账号 / 姓名" clearable style="width: 180px" />
        </el-form-item>
        <el-form-item label="模块">
          <el-select v-model="filter.module" placeholder="全部" clearable style="width: 160px">
            <el-option v-for="m in modules" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作类型">
          <el-select v-model="filter.action" placeholder="全部" clearable style="width: 140px">
            <el-option label="新增" value="create" />
            <el-option label="修改" value="update" />
            <el-option label="删除" value="delete" />
            <el-option label="登录" value="login" />
            <el-option label="导出" value="export" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-radio-group v-model="filter.status">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="success">成功</el-radio-button>
            <el-radio-button value="fail">失败</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="时间">
          <el-date-picker
            v-model="filter.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="logList" stripe border>
        <el-table-column label="时间" prop="time" width="170" />
        <el-table-column label="操作人" width="140">
          <template #default="{ row }">
            <div class="op-cell">
              <el-avatar :size="28">{{ row.name.charAt(0) }}</el-avatar>
              <div>
                <div class="op-name">{{ row.name }}</div>
                <div class="op-account">{{ row.account }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="模块" prop="module" width="120" />
        <el-table-column label="操作" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="actionTag(row.action)" size="small">{{ actionText(row.action) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="描述" prop="desc" min-width="220" show-overflow-tooltip />
        <el-table-column label="IP 地址" prop="ip" width="130" />
        <el-table-column label="结果" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'success' ? 'success' : 'danger'" size="small" effect="dark">
              {{ row.status === 'success' ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadLogs"
          @size-change="loadLogs"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="日志详情" width="620px">
      <el-descriptions v-if="currentLog" :column="2" border>
        <el-descriptions-item label="时间">{{ currentLog.time }}</el-descriptions-item>
        <el-descriptions-item label="操作人">{{ currentLog.name }}（{{ currentLog.account }}）</el-descriptions-item>
        <el-descriptions-item label="模块">{{ currentLog.module }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ actionText(currentLog.action) }}</el-descriptions-item>
        <el-descriptions-item label="IP 地址">{{ currentLog.ip }}</el-descriptions-item>
        <el-descriptions-item label="浏览器">Chrome 124.0</el-descriptions-item>
        <el-descriptions-item label="结果">
          <el-tag :type="currentLog.status === 'success' ? 'success' : 'danger'" size="small">
            {{ currentLog.status === 'success' ? '成功' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="耗时">{{ currentLog.duration }} ms</el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ currentLog.desc }}</el-descriptions-item>
        <el-descriptions-item label="请求参数" :span="2">
          <pre class="json-block">{{ mockParams }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Download, Search, RefreshLeft } from '@element-plus/icons-vue'
import { logApi } from '@/api/log'

interface LogItem {
  id: number
  time: string
  name: string
  account: string
  module: string
  action: 'create' | 'update' | 'delete' | 'login' | 'export'
  desc: string
  ip: string
  status: 'success' | 'fail'
  duration: number
}

const modules = ['商品管理', '库存管理', '订单管理', '用户管理', '分销商管理', '系统管理', '登录认证']

const filter = reactive({
  operator: '',
  module: '',
  action: '',
  status: '',
  dateRange: [] as string[],
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 12,
})

const logList = ref<LogItem[]>([])
const loadError = ref('')

async function loadLogs() {
  loadError.value = ''
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.size,
    }
    if (filter.operator) params.keyword = filter.operator
    if (filter.module) params.module = filter.module
    if (filter.action) params.action = filter.action
    if (filter.status) params.status = filter.status
    if (filter.dateRange?.length === 2) {
      params.startTime = filter.dateRange[0]
      params.endTime = filter.dateRange[1]
    }
    const res: any = await logApi.list(params)
    const rows = (res?.list ?? []) as any[]
    logList.value = rows.map((r: any, i: number) => ({
      id: r.id ?? i + 1,
      time: r.createdAt || r.time || '',
      name: r.adminUser?.realName || r.operator?.realName || r.username || r.name || '',
      account: r.username || r.operator?.username || r.account || '',
      module: r.module || '',
      action: r.action || 'update',
      desc: r.description || r.desc || '',
      ip: r.ip || '',
      status: r.status || 'success',
      duration: Number(r.durationMs ?? r.duration ?? 0),
    })) as any
    pagination.total = Number(res?.total ?? logList.value.length)
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    logList.value = []
  }
}

onMounted(loadLogs)

function actionTag(a: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const map: any = { create: 'success', update: 'primary', delete: 'danger', login: 'info', export: 'warning' }
  return map[a] || 'info'
}
function actionText(a: string) {
  const map: any = { create: '新增', update: '修改', delete: '删除', login: '登录', export: '导出' }
  return map[a] || a
}

const detailVisible = ref(false)
const currentLog = ref<LogItem | null>(null)
const mockParams = `{
  "productId": 1,
  "updates": {
    "wholesalePrice": 650,
    "minWholesale": 10
  },
  "userAgent": "Mozilla/5.0 ... Chrome/124.0"
}`

function escapeCsvCell(value: unknown) {
  const text = String(value ?? '')
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<unknown>>) {
  const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportLogs() {
  const rows = logList.value.map((r) => [
    r.time,
    r.name,
    r.account,
    r.module,
    actionText(r.action),
    r.desc,
    r.ip,
    r.status === 'success' ? '成功' : '失败',
    r.duration,
  ])
  downloadCsv(
    `操作日志-${new Date().toISOString().slice(0, 10)}.csv`,
    ['时间', '操作人', '账号', '模块', '操作', '描述', 'IP', '结果', '耗时(ms)'],
    rows,
  )
}

function handleDetail(row: LogItem) {
  currentLog.value = row
  detailVisible.value = true
}

function handleSearch() {
  pagination.page = 1
  loadLogs()
}

function handleReset() {
  filter.operator = ''
  filter.module = ''
  filter.action = ''
  filter.status = ''
  filter.dateRange = []
  handleSearch()
}
</script>

<style scoped>
.log-page { padding: 20px; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2d3d; }
.page-subtitle { margin: 4px 0 0; font-size: 13px; color: #909399; }

.filter-card { margin-bottom: 16px; border-radius: 8px; }
.filter-form :deep(.el-form-item) { margin-bottom: 0; }
.content-card { border-radius: 8px; }

.op-cell { display: flex; align-items: center; gap: 8px; }
.op-name { font-size: 13px; font-weight: 500; color: #1f2d3d; }
.op-account { font-size: 11px; color: #909399; font-family: 'Courier New', monospace; }

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.json-block {
  background: #f4f5f7;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #1f2d3d;
  margin: 0;
  white-space: pre-wrap;
}
</style>
