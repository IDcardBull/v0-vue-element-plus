<template>
  <div class="stock-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">库存管理</h2>
        <p class="page-subtitle">查看商品现存数量。点击数量可直接修改</p>
      </div>
      <el-button type="primary" :icon="Refresh" @click="loadList">刷新</el-button>
    </div>

    <el-alert
      v-if="loadError"
      :title="loadError"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 12px"
    >
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadList">点击重试</el-button>
      </template>
    </el-alert>

    <!-- 简化版仅保留两张统计卡：SKU 总数 + 库存总量 -->
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
    </div>

    <!-- 筛选 -->
    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="SKU / 商品">
          <el-input
            v-model="filter.keyword"
            placeholder="SKU 编码 / 商品名称"
            clearable
            style="width: 240px"
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="仓库" v-if="warehouses.length > 1">
          <el-select v-model="filter.warehouseId" placeholder="全部仓库" clearable style="width: 180px">
            <el-option v-for="w in warehouses" :key="w.id" :label="w.name" :value="w.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="stockList" stripe border v-loading="loading">
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
              <div class="sku-spec">{{ row.spec || '默认规格' }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分类" prop="category" width="120">
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </el-table-column>
        <el-table-column label="仓库" prop="warehouseName" width="140" />
        <el-table-column label="库存数量" width="200" align="right">
          <template #default="{ row }">
            <template v-if="editingId === row.id">
              <el-input-number
                v-model="editingValue"
                :min="0"
                :max="999999"
                :step="1"
                size="small"
                style="width: 130px"
                @keyup.enter="commitEdit(row)"
              />
            </template>
            <span v-else class="onhand" @click="startEdit(row)">{{ row.onHand }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <template v-if="editingId === row.id">
              <el-button link type="primary" @click="commitEdit(row)">保存</el-button>
              <el-button link @click="cancelEdit">取消</el-button>
            </template>
            <el-button v-else link type="primary" @click="startEdit(row)">修改数量</el-button>
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
          @current-change="loadList"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Box, Goods, Search, Refresh, RefreshLeft,
} from '@element-plus/icons-vue'
import { inventoryApi } from '@/api/inventory'

const loading = ref(false)
const loadError = ref('')

interface StockRow {
  id: number
  skuId: number
  warehouseId: number
  sku: string
  productName: string
  spec: string
  image: string
  category: string
  warehouseName: string
  onHand: number
}

const filter = reactive({
  keyword: '',
  warehouseId: null as number | null,
})

const pagination = reactive({
  page: 1,
  size: 20,
  total: 0,
})

const stockList = ref<StockRow[]>([])
const warehouses = ref<Array<{ id: number; name: string }>>([])

// 在 row.onHand 上做内联编辑：editingId 控制哪一行进入编辑态
const editingId = ref<number | null>(null)
const editingValue = ref<number>(0)

async function loadWarehouses() {
  try {
    warehouses.value = (await inventoryApi.warehouses()) || []
  } catch {
    warehouses.value = []
  }
}

async function loadList() {
  loading.value = true
  loadError.value = ''
  try {
    const params: Record<string, unknown> = {
      page: pagination.page,
      pageSize: pagination.size,
    }
    if (filter.keyword.trim()) params.keyword = filter.keyword.trim()
    if (filter.warehouseId) params.warehouseId = filter.warehouseId

    const res: any = await inventoryApi.stockList(params)
    const rows = (res?.list ?? []) as any[]
    stockList.value = rows.map((r: any, i: number) => ({
      id: r.id ?? i + 1,
      skuId: Number(r.skuId ?? r.sku?.id ?? 0),
      warehouseId: Number(r.warehouseId ?? r.warehouse?.id ?? 0),
      sku: r.sku?.code || r.skuCode || '',
      productName: r.sku?.product?.name || r.productName || '',
      spec: r.sku?.specs || r.spec || '',
      image: r.sku?.image || r.sku?.product?.mainImage || '/placeholder.svg',
      category: r.sku?.product?.category?.name || r.category || '',
      warehouseName: r.warehouse?.name || r.warehouseName || '主仓',
      onHand: Number(r.onHand ?? 0),
    }))
    pagination.total = Number(res?.total ?? stockList.value.length)
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    stockList.value = []
    pagination.total = 0
  } finally {
    loading.value = false
  }
}

const stats = computed(() => {
  const skuTotal = stockList.value.length
  const totalQty = stockList.value.reduce((sum, row) => sum + row.onHand, 0)
  return { skuTotal, totalQty }
})

function startEdit(row: StockRow) {
  editingId.value = row.id
  editingValue.value = row.onHand
}

function cancelEdit() {
  editingId.value = null
  editingValue.value = 0
}

async function commitEdit(row: StockRow) {
  const newVal = Number(editingValue.value)
  if (Number.isNaN(newVal) || newVal < 0) {
    ElMessage.error('库存数量必须是非负整数')
    return
  }
  if (newVal === row.onHand) {
    cancelEdit()
    return
  }
  try {
    await inventoryApi.updateOnHand(row.id, newVal)
    row.onHand = newVal
    ElMessage.success('库存已更新')
    cancelEdit()
  } catch (e: any) {
    ElMessage.error(e?.message || '更新失败')
  }
}

function handleSearch() {
  pagination.page = 1
  loadList()
}

function handleReset() {
  filter.keyword = ''
  filter.warehouseId = null
  pagination.page = 1
  loadList()
}

function handleSizeChange() {
  pagination.page = 1
  loadList()
}

onMounted(async () => {
  await loadWarehouses()
  await loadList()
})
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

.stat-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
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

.onhand {
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  color: var(--el-color-primary);
}
.onhand:hover { text-decoration: underline; }

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
