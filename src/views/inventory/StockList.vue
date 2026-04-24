<template>
  <div class="stock-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">实时库存</h2>
        <p class="page-subtitle">按 SKU 维度查看各仓库的可用与占用库存</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Download">导出库存报表</el-button>
        <el-button type="primary" :icon="Refresh" @click="handleRefresh">刷新</el-button>
      </div>
    </div>

    <!-- 库存汇总卡片 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-icon blue"><el-icon><Box /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">SKU 总数</div>
          <div class="stat-value">{{ stats.skuTotal }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><el-icon><Goods /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">库存总量（件）</div>
          <div class="stat-value">{{ stats.totalQty.toLocaleString() }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><el-icon><Coin /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">库存总值（元）</div>
          <div class="stat-value">¥{{ stats.totalValue.toLocaleString() }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><el-icon><Warning /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">预警 SKU 数</div>
          <div class="stat-value">{{ stats.warningCount }}</div>
        </div>
      </div>
    </div>

    <!-- 筛选 -->
    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="SKU / 商品">
          <el-input v-model="filter.keyword" placeholder="SKU 编码 / 商品名称" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="仓库">
          <el-select v-model="filter.warehouse" placeholder="全部仓库" clearable style="width: 160px">
            <el-option label="主仓（景德镇）" value="main" />
            <el-option label="华东仓（上海）" value="east" />
            <el-option label="华南仓（广州）" value="south" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-cascader
            v-model="filter.category"
            :options="categoryOptions"
            placeholder="全部分类"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="库存状态">
          <el-select v-model="filter.stockStatus" placeholder="全部" clearable style="width: 140px">
            <el-option label="正常" value="normal" />
            <el-option label="预警" value="warning" />
            <el-option label="缺货" value="shortage" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="stockList" stripe border>
        <el-table-column label="商品图" width="80" align="center">
          <template #default="{ row }">
            <el-image :src="row.image" fit="cover" style="width: 48px; height: 48px; border-radius: 4px" />
          </template>
        </el-table-column>
        <el-table-column label="SKU / 商品" min-width="240">
          <template #default="{ row }">
            <div class="sku-cell">
              <div class="sku-code">{{ row.sku }}</div>
              <div class="sku-name">{{ row.productName }}</div>
              <div class="sku-spec">{{ row.spec }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分类" prop="category" width="120" />
        <el-table-column label="仓库" prop="warehouseName" width="140" />
        <el-table-column label="可用库存" width="110" align="right">
          <template #default="{ row }">
            <span :class="{ danger: row.available <= row.warningLine }">
              {{ row.available }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="占用库存" width="100" align="right">
          <template #default="{ row }">
            <span class="locked">{{ row.locked }}</span>
          </template>
        </el-table-column>
        <el-table-column label="在途库存" prop="inTransit" width="100" align="right" />
        <el-table-column label="预警值" prop="warningLine" width="90" align="right" />
        <el-table-column label="库存水位" width="160">
          <template #default="{ row }">
            <el-progress
              :percentage="Math.min(100, Math.round((row.available / row.maxStock) * 100))"
              :status="getWaterStatus(row)"
              :stroke-width="10"
              :show-text="false"
            />
            <div class="water-text">
              <span>{{ row.available }}</span>
              <span>/</span>
              <span>{{ row.maxStock }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row).type" size="small">
              {{ getStatusTag(row).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleInbound(row)">入库</el-button>
            <el-button link type="warning" @click="handleOutbound(row)">出库</el-button>
            <el-button link type="info" @click="handleHistory(row)">明细</el-button>
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

    <!-- 出入库抽屉 -->
    <el-drawer
      v-model="adjustVisible"
      :title="adjustMode === 'in' ? '入库登记' : '出库登记'"
      size="460px"
    >
      <el-form :model="adjustForm" label-width="100px">
        <el-form-item label="SKU">
          <el-input :model-value="adjustForm.sku" disabled />
        </el-form-item>
        <el-form-item label="商品">
          <el-input :model-value="adjustForm.productName" disabled />
        </el-form-item>
        <el-form-item label="当前库存">
          <el-input :model-value="String(adjustForm.available)" disabled />
        </el-form-item>
        <el-form-item :label="adjustMode === 'in' ? '入库数量' : '出库数量'" required>
          <el-input-number v-model="adjustForm.qty" :min="1" :max="9999" style="width: 100%" />
        </el-form-item>
        <el-form-item label="业务单号">
          <el-input v-model="adjustForm.orderNo" placeholder="采购单 / 销售单 / 调拨单号" />
        </el-form-item>
        <el-form-item label="经办人">
          <el-input v-model="adjustForm.operator" placeholder="操作人姓名" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="adjustForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="adjustVisible = false">取消</el-button>
          <el-button type="primary" @click="handleAdjustSubmit">确认{{ adjustMode === 'in' ? '入库' : '出库' }}</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Box, Goods, Coin, Warning, Search, Refresh, RefreshLeft, Download,
} from '@element-plus/icons-vue'
import { inventoryApi } from '@/api/inventory'

const loading = ref(false)

interface StockRow {
  id: number
  sku: string
  productName: string
  spec: string
  image: string
  category: string
  warehouseName: string
  available: number
  locked: number
  inTransit: number
  warningLine: number
  maxStock: number
  unitPrice: number
}

const filter = reactive({
  keyword: '',
  warehouse: '',
  category: [] as string[],
  stockStatus: '',
})

const categoryOptions = [
  {
    value: 'teaware',
    label: '茶具',
    children: [
      { value: 'teapot', label: '紫砂壶' },
      { value: 'teacup', label: '品茗杯' },
      { value: 'teaset', label: '茶具套装' },
    ],
  },
  {
    value: 'vase',
    label: '花瓶',
    children: [
      { value: 'blue', label: '青花瓷' },
      { value: 'celadon', label: '青瓷' },
    ],
  },
  { value: 'dining', label: '餐具' },
]

const pagination = reactive({
  page: 1,
  size: 10,
  total: 8,
})

const stockList = ref<StockRow[]>([
  {
    id: 1,
    sku: 'YM-QHC-001-R',
    productName: '青花瓷盖碗茶具（10头）',
    spec: '红色礼盒 / 标准款',
    image: '/placeholder.svg?height=48&width=48',
    category: '茶具套装',
    warehouseName: '主仓（景德镇）',
    available: 156,
    locked: 12,
    inTransit: 200,
    warningLine: 50,
    maxStock: 500,
    unitPrice: 880,
  },
  {
    id: 2,
    sku: 'YM-YZHP-002-W',
    productName: '羊脂玉白瓷花瓶',
    spec: '30cm 高 / 白色',
    image: '/placeholder.svg?height=48&width=48',
    category: '花瓶',
    warehouseName: '主仓（景德镇）',
    available: 23,
    locked: 5,
    inTransit: 50,
    warningLine: 30,
    maxStock: 200,
    unitPrice: 1280,
  },
  {
    id: 3,
    sku: 'YM-RYZRB-003',
    productName: '汝窑主人杯（天青釉）',
    spec: '单杯 80ml',
    image: '/placeholder.svg?height=48&width=48',
    category: '品茗杯',
    warehouseName: '华东仓（上海）',
    available: 8,
    locked: 2,
    inTransit: 100,
    warningLine: 30,
    maxStock: 300,
    unitPrice: 380,
  },
  {
    id: 4,
    sku: 'YM-ZSHU-004-XS',
    productName: '紫砂西施壶（原矿朱泥）',
    spec: '200ml / 小号',
    image: '/placeholder.svg?height=48&width=48',
    category: '紫砂壶',
    warehouseName: '主仓（景德镇）',
    available: 0,
    locked: 0,
    inTransit: 30,
    warningLine: 20,
    maxStock: 150,
    unitPrice: 1680,
  },
  {
    id: 5,
    sku: 'YM-QHCP-005',
    productName: '青花瓷餐盘（8寸）',
    spec: '8寸 / 传统花纹',
    image: '/placeholder.svg?height=48&width=48',
    category: '餐具',
    warehouseName: '华南仓（广州）',
    available: 420,
    locked: 32,
    inTransit: 0,
    warningLine: 80,
    maxStock: 600,
    unitPrice: 128,
  },
  {
    id: 6,
    sku: 'YM-DHBC-006',
    productName: '德化白瓷观音摆件',
    spec: '高 38cm',
    image: '/placeholder.svg?height=48&width=48',
    category: '摆件',
    warehouseName: '主仓（景德镇）',
    available: 45,
    locked: 3,
    inTransit: 20,
    warningLine: 15,
    maxStock: 100,
    unitPrice: 2680,
  },
  {
    id: 7,
    sku: 'YM-LQQP-007',
    productName: '龙泉青瓷莲花碗',
    spec: '直径 15cm',
    image: '/placeholder.svg?height=48&width=48',
    category: '餐具',
    warehouseName: '华东仓（上海）',
    available: 89,
    locked: 8,
    inTransit: 50,
    warningLine: 40,
    maxStock: 250,
    unitPrice: 360,
  },
  {
    id: 8,
    sku: 'YM-FSGJ-008',
    productName: '仿宋官窑茶叶罐',
    spec: '中号 / 开片釉',
    image: '/placeholder.svg?height=48&width=48',
    category: '茶具配件',
    warehouseName: '主仓（景德镇）',
    available: 15,
    locked: 1,
    inTransit: 0,
    warningLine: 25,
    maxStock: 120,
    unitPrice: 560,
  },
])

async function loadList() {
  loading.value = true
  try {
    const res: any = await inventoryApi.stockList({ page: 1, pageSize: 100 })
    const rows = (res?.list ?? []) as any[]
    if (rows.length) {
      stockList.value = rows.map((r: any, i: number) => ({
        id: r.id ?? i + 1,
        sku: r.sku?.code || r.skuCode || '',
        product: r.sku?.product?.name || r.productName || '',
        cover: r.sku?.product?.mainImage || '/placeholder.svg',
        specs: r.sku?.specs || r.specs || '',
        warehouse: r.warehouse?.name || r.warehouseName || '主仓',
        available: Number(r.available ?? r.availableQty ?? 0),
        locked: Number(r.locked ?? r.lockedQty ?? 0),
        inTransit: Number(r.inTransit ?? 0),
        warningLine: Number(r.warningLine ?? r.safetyStock ?? 20),
        maxStock: Number(r.maxStock ?? 200),
        unitPrice: Number(r.unitPrice ?? r.sku?.retailPrice ?? 0),
      })) as any
    }
  } catch {
    // 保留 mock
  } finally {
    loading.value = false
  }
}

onMounted(loadList)

const stats = computed(() => {
  const skuTotal = stockList.value.length
  const totalQty = stockList.value.reduce((sum, row) => sum + row.available + row.locked, 0)
  const totalValue = stockList.value.reduce(
    (sum, row) => sum + (row.available + row.locked) * row.unitPrice,
    0,
  )
  const warningCount = stockList.value.filter((r) => r.available <= r.warningLine).length
  return { skuTotal, totalQty, totalValue, warningCount }
})

function getStatusTag(row: StockRow) {
  if (row.available === 0) return { type: 'danger' as const, text: '缺货' }
  if (row.available <= row.warningLine) return { type: 'warning' as const, text: '预警' }
  return { type: 'success' as const, text: '正常' }
}

function getWaterStatus(row: StockRow) {
  if (row.available === 0) return 'exception'
  if (row.available <= row.warningLine) return 'warning'
  return 'success'
}

const adjustVisible = ref(false)
const adjustMode = ref<'in' | 'out'>('in')
const adjustForm = reactive({
  sku: '',
  productName: '',
  available: 0,
  qty: 1,
  orderNo: '',
  operator: '',
  remark: '',
})

function handleInbound(row: StockRow) {
  adjustMode.value = 'in'
  Object.assign(adjustForm, {
    sku: row.sku,
    productName: row.productName,
    available: row.available,
    qty: 1,
    orderNo: '',
    operator: '',
    remark: '',
  })
  adjustVisible.value = true
}

function handleOutbound(row: StockRow) {
  adjustMode.value = 'out'
  Object.assign(adjustForm, {
    sku: row.sku,
    productName: row.productName,
    available: row.available,
    qty: 1,
    orderNo: '',
    operator: '',
    remark: '',
  })
  adjustVisible.value = true
}

function handleHistory(row: StockRow) {
  ElMessage.info(`查看 ${row.sku} 的出入库明细（占位）`)
}

function handleAdjustSubmit() {
  ElMessage.success(`${adjustMode.value === 'in' ? '入库' : '出库'}登记成功：${adjustForm.qty} 件`)
  adjustVisible.value = false
}

function handleRefresh() {
  ElMessage.success('库存数据已刷新')
}

function handleReset() {
  filter.keyword = ''
  filter.warehouse = ''
  filter.category = []
  filter.stockStatus = ''
}
</script>

<style scoped>
.stock-page { padding: 20px; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2d3d; }
.page-subtitle { margin: 4px 0 0; font-size: 13px; color: #909399; }

.header-actions { display: flex; gap: 8px; }

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid #ebeef5;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
}
.stat-icon.blue { background: #409eff; }
.stat-icon.green { background: #67c23a; }
.stat-icon.orange { background: #e6a23c; }
.stat-icon.red { background: #f56c6c; }

.stat-label { font-size: 13px; color: #909399; }
.stat-value { font-size: 22px; font-weight: 600; color: #1f2d3d; margin-top: 2px; }

.filter-card { margin-bottom: 16px; border-radius: 8px; }
.filter-form :deep(.el-form-item) { margin-bottom: 0; }
.content-card { border-radius: 8px; }

.sku-cell { display: flex; flex-direction: column; gap: 2px; }
.sku-code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #c8a96a;
  font-weight: 600;
}
.sku-name { font-size: 13px; font-weight: 500; color: #1f2d3d; }
.sku-spec { font-size: 12px; color: #909399; }

.danger { color: #f56c6c; font-weight: 600; }
.locked { color: #e6a23c; }

.water-text {
  font-size: 11px;
  color: #909399;
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
