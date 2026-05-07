<template>
  <div class="record-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">出入库记录</h2>
        <p class="page-subtitle">完整的库存变动流水，支持按类型、单号、经办人检索</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Download" @click="exportRecords">导出 Excel</el-button>
        <el-button type="primary" :icon="Plus">手动新增单据</el-button>
      </div>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadRecords">点击重试</el-button>
      </template>
    </el-alert>

    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="业务类型">
          <el-select v-model="filter.type" placeholder="全部" clearable style="width: 140px">
            <el-option label="入库" value="in" />
            <el-option label="出库" value="out" />
            <el-option label="调拨" value="transfer" />
            <el-option label="盘点" value="inventory" />
            <el-option label="退货入库" value="return" />
          </el-select>
        </el-form-item>
        <el-form-item label="单据号">
          <el-input v-model="filter.orderNo" placeholder="单据号 / SKU" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="filter.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始"
            end-placeholder="结束"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="recordList" stripe border v-loading="loading">
        <el-table-column label="单据号" width="200">
          <template #default="{ row }">
            <div class="order-no">{{ row.orderNo }}</div>
            <div class="order-time">{{ row.createdAt }}</div>
          </template>
        </el-table-column>
        <el-table-column label="方向" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.direction === 'in' ? 'success' : 'warning'" effect="dark" size="small">
              {{ row.direction === 'in' ? '入库' : '出库' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="业务类型" width="110">
          <template #default="{ row }">
            <span>{{ typeMap[row.type] }}</span>
          </template>
        </el-table-column>
        <el-table-column label="SKU / 商品" min-width="240">
          <template #default="{ row }">
            <div class="sku-cell">
              <div class="sku-code">{{ row.sku }}</div>
              <div class="sku-name">{{ row.productName }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="数量" width="100" align="right">
          <template #default="{ row }">
            <span :class="row.direction === 'in' ? 'qty-in' : 'qty-out'">
              {{ row.direction === 'in' ? '+' : '-' }}{{ row.qty }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="变动前" prop="beforeQty" width="90" align="right" />
        <el-table-column label="变动后" prop="afterQty" width="90" align="right">
          <template #default="{ row }">
            <strong>{{ row.afterQty }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="关联单据" width="160">
          <template #default="{ row }">
            <el-link v-if="row.refOrder" type="primary" :underline="false">{{ row.refOrder }}</el-link>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="经办人" prop="operator" width="100" />
        <el-table-column label="备注" prop="remark" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="110" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleDetail(row)">详情</el-button>
            <el-button link type="danger" @click="handleReverse(row)">冲销</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadRecords"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Download, Search, RefreshLeft } from '@element-plus/icons-vue'
import { inventoryApi } from '@/api/inventory'

interface StockItem {
  id: number
  orderNo: string
  createdAt: string
  direction: 'in' | 'out'
  type: string
  sku: string
  productName: string
  warehouseName: string
  qty: number
  beforeQty: number
  afterQty: number
  refOrder?: string
  operator: string
  remark: string
}

const typeMap: Record<string, string> = {
  in: '入库',
  out: '出库',
  transfer: '调拨',
  inventory: '盘点',
  return: '退货入库',
  purchase: '采购入库',
  sale: '销售出库',
  surplus: '盘盈',
  loss: '盘亏',
}

const filter = reactive({
  type: '',
  orderNo: '',
  dateRange: [] as string[],
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0,
})

const recordList = ref<StockItem[]>([])
const loading = ref(false)
const loadError = ref('')

async function loadRecords() {
  loading.value = true
  loadError.value = ''
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.size,
      keyword: filter.orderNo || undefined,
      dateFrom: filter.dateRange?.[0] || undefined,
      dateTo: filter.dateRange?.[1] || undefined,
    }
    if (filter.type) params.type = filter.type
    const res: any = await inventoryApi.records(params)
    const rows = (res?.list ?? []) as any[]
    recordList.value = rows.map((r: any, i: number) => ({
      id: r.id ?? i + 1,
      orderNo: r.orderNo || r.code || '',
      direction: r.type === 'in' || r.type === 'return' ? 'in' : 'out',
      type: r.type || 'in',
      warehouseName: r.warehouse?.name || r.warehouseName || '',
      sku: r.sku?.code || r.skuCode || '',
      productName: r.sku?.product?.name || r.productName || '',
      qty: Number(r.qty ?? 0),
      beforeQty: Number(r.beforeOnHand ?? r.beforeQty ?? 0),
      afterQty: Number(r.afterOnHand ?? r.afterQty ?? 0),
      refOrder: r.relatedType && r.relatedId ? `${r.relatedType}:${r.relatedId}` : '',
      operator: r.operator || r.createdBy?.realName || '',
      remark: r.remark || '',
      createdAt: r.createdAt || '',
    })) as any
    pagination.total = Number(res?.total ?? recordList.value.length)
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    recordList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadRecords()
})

function handleSearch() {
  pagination.page = 1
  loadRecords()
}

function handleSizeChange() {
  pagination.page = 1
  loadRecords()
}

function handleReset() {
  filter.type = ''
  filter.orderNo = ''
  filter.dateRange = []
  pagination.page = 1
  loadRecords()
}

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

function exportRecords() {
  const rows = recordList.value.map((row) => [
    row.orderNo,
    row.createdAt,
    row.direction === 'in' ? '入库' : '出库',
    typeMap[row.type] || row.type,
    row.sku,
    row.productName,
    row.warehouseName,
    row.qty,
    row.beforeQty,
    row.afterQty,
    row.refOrder || '',
    row.operator,
    row.remark,
  ])
  downloadCsv(
    `出入库记录-${new Date().toISOString().slice(0, 10)}.csv`,
    ['单据号', '时间', '方向', '业务类型', 'SKU', '商品名', '仓库', '数量', '变动前', '变动后', '关联单据', '经办人', '备注'],
    rows,
  )
  ElMessage.success(`已导出 ${rows.length} 条记录`)
}

function handleDetail(row: StockItem) {
  ElMessage.info(`查看单据详情：${row.orderNo}`)
}

function handleReverse(row: StockItem) {
  ElMessage.warning(`冲销单据：${row.orderNo}（占位）`)
}
</script>

<style scoped>
.record-page { padding: 20px; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2d3d; }
.page-subtitle { margin: 4px 0 0; font-size: 13px; color: #909399; }
.header-actions { display: flex; gap: 8px; }

.filter-card { margin-bottom: 16px; border-radius: 8px; }
.filter-form :deep(.el-form-item) { margin-bottom: 0; }
.content-card { border-radius: 8px; }

.order-no {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #1f2d3d;
  font-weight: 600;
}
.order-time { font-size: 12px; color: #909399; margin-top: 2px; }

.sku-cell { display: flex; flex-direction: column; gap: 2px; }
.sku-code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #c8a96a;
  font-weight: 600;
}
.sku-name { font-size: 13px; color: #1f2d3d; }

.qty-in { color: #67c23a; font-weight: 600; }
.qty-out { color: #f56c6c; font-weight: 600; }
.muted { color: #c0c4cc; }

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
