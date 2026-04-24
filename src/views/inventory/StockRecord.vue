<template>
  <div class="record-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">出入库记录</h2>
        <p class="page-subtitle">完整的库存变动流水，支持按类型、单号、经办人检索</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Download">导出 Excel</el-button>
        <el-button type="primary" :icon="Plus">手动新增单据</el-button>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="业务类型">
          <el-select v-model="filter.type" placeholder="全部" clearable style="width: 140px">
            <el-option label="采购入库" value="purchase" />
            <el-option label="销售出库" value="sale" />
            <el-option label="调拨" value="transfer" />
            <el-option label="盘盈" value="surplus" />
            <el-option label="盘亏" value="loss" />
            <el-option label="退货入库" value="return" />
          </el-select>
        </el-form-item>
        <el-form-item label="方向">
          <el-select v-model="filter.direction" placeholder="全部" clearable style="width: 120px">
            <el-option label="入库" value="in" />
            <el-option label="出库" value="out" />
          </el-select>
        </el-form-item>
        <el-form-item label="单据号">
          <el-input v-model="filter.orderNo" placeholder="单据号 / SKU" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="filter.warehouse" placeholder="全部" clearable style="width: 160px">
            <el-option label="主仓（景德镇）" value="main" />
            <el-option label="华东仓（上海）" value="east" />
            <el-option label="华南仓（广州）" value="south" />
          </el-select>
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
          <el-button type="primary" :icon="Search">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="recordList" stripe border>
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
        <el-table-column label="仓库" prop="warehouseName" width="140" />
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
  purchase: '采购入库',
  sale: '销售出库',
  transfer: '调拨',
  surplus: '盘盈',
  loss: '盘亏',
  return: '退货入库',
}

const filter = reactive({
  type: '',
  direction: '',
  orderNo: '',
  warehouse: '',
  dateRange: [] as string[],
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 8,
})

const recordList = ref<StockItem[]>([
  {
    id: 1,
    orderNo: 'IN-20260420-00128',
    createdAt: '2026-04-20 14:32:18',
    direction: 'in',
    type: 'purchase',
    sku: 'YM-QHC-001-R',
    productName: '青花瓷盖碗茶具（10头）',
    warehouseName: '主仓（景德镇）',
    qty: 200,
    beforeQty: 156,
    afterQty: 356,
    refOrder: 'PO-2026-0412-003',
    operator: '张建国',
    remark: '春季补货批次',
  },
  {
    id: 2,
    orderNo: 'OUT-20260420-00542',
    createdAt: '2026-04-20 11:08:45',
    direction: 'out',
    type: 'sale',
    sku: 'YM-YZHP-002-W',
    productName: '羊脂玉白瓷花瓶',
    warehouseName: '主仓（景德镇）',
    qty: 5,
    beforeQty: 28,
    afterQty: 23,
    refOrder: 'SO-2026-04200-891',
    operator: '李明',
    remark: '批发订单出库',
  },
  {
    id: 3,
    orderNo: 'OUT-20260420-00541',
    createdAt: '2026-04-20 10:45:22',
    direction: 'out',
    type: 'sale',
    sku: 'YM-QHCP-005',
    productName: '青花瓷餐盘（8寸）',
    warehouseName: '华南仓（广州）',
    qty: 12,
    beforeQty: 432,
    afterQty: 420,
    refOrder: 'SO-2026-04200-890',
    operator: '李明',
    remark: '零售订单合并出库',
  },
  {
    id: 4,
    orderNo: 'TRANS-20260419-00012',
    createdAt: '2026-04-19 16:20:10',
    direction: 'in',
    type: 'transfer',
    sku: 'YM-RYZRB-003',
    productName: '汝窑主人杯（天青釉）',
    warehouseName: '华东仓（上海）',
    qty: 50,
    beforeQty: 0,
    afterQty: 50,
    refOrder: 'TR-2026-0419-002',
    operator: '王芳',
    remark: '从主仓调拨至华东仓',
  },
  {
    id: 5,
    orderNo: 'TRANS-20260419-00011',
    createdAt: '2026-04-19 16:20:10',
    direction: 'out',
    type: 'transfer',
    sku: 'YM-RYZRB-003',
    productName: '汝窑主人杯（天青釉）',
    warehouseName: '主仓（景德镇）',
    qty: 50,
    beforeQty: 60,
    afterQty: 10,
    refOrder: 'TR-2026-0419-002',
    operator: '王芳',
    remark: '调拨至华东仓',
  },
  {
    id: 6,
    orderNo: 'IN-20260418-00456',
    createdAt: '2026-04-18 09:15:33',
    direction: 'in',
    type: 'return',
    sku: 'YM-QHC-001-R',
    productName: '青花瓷盖碗茶具（10头）',
    warehouseName: '主仓（景德镇）',
    qty: 2,
    beforeQty: 154,
    afterQty: 156,
    refOrder: 'RT-2026-0418-007',
    operator: '张建国',
    remark: '客户退货：包装破损',
  },
  {
    id: 7,
    orderNo: 'ADJ-20260417-00003',
    createdAt: '2026-04-17 17:45:00',
    direction: 'in',
    type: 'surplus',
    sku: 'YM-DHBC-006',
    productName: '德化白瓷观音摆件',
    warehouseName: '主仓（景德镇）',
    qty: 3,
    beforeQty: 42,
    afterQty: 45,
    operator: '盘点组',
    remark: '月度盘点盘盈',
  },
  {
    id: 8,
    orderNo: 'ADJ-20260417-00002',
    createdAt: '2026-04-17 17:42:00',
    direction: 'out',
    type: 'loss',
    sku: 'YM-LQQP-007',
    productName: '龙泉青瓷莲花碗',
    warehouseName: '华东仓（上海）',
    qty: 2,
    beforeQty: 91,
    afterQty: 89,
    operator: '盘点组',
    remark: '月度盘点盘亏：运输破损',
  },
])

async function loadRecords() {
  try {
    const res: any = await inventoryApi.records({ page: 1, pageSize: 100 })
    const rows = (res?.list ?? []) as any[]
    if (rows.length) {
      recordList.value = rows.map((r: any, i: number) => ({
        id: r.id ?? i + 1,
        orderNo: r.orderNo || r.code || '',
        type: r.type || 'in',
        warehouseName: r.warehouse?.name || r.warehouseName || '',
        sku: r.sku?.code || r.skuCode || '',
        productName: r.sku?.product?.name || r.productName || '',
        spec: r.sku?.specs || r.spec || '',
        qty: Number(r.qty ?? 0),
        beforeQty: Number(r.beforeQty ?? 0),
        afterQty: Number(r.afterQty ?? 0),
        operator: r.operator || r.createdBy?.realName || '',
        remark: r.remark || '',
        createdAt: r.createdAt || '',
      })) as any
    }
  } catch {
    // 保留 mock
  }
}

onMounted(loadRecords)

function handleReset() {
  filter.type = ''
  filter.direction = ''
  filter.orderNo = ''
  filter.warehouse = ''
  filter.dateRange = []
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
