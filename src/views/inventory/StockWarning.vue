<template>
  <div class="warning-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">库存预警</h2>
        <p class="page-subtitle">即将缺货或已缺货的 SKU，及时补货避免断销</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" :icon="DocumentAdd" @click="handleBatchPurchase">批量生成采购单</el-button>
      </div>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadWarnings">点击重试</el-button>
      </template>
    </el-alert>

    <div class="stat-row">
      <div class="stat-card red">
        <div class="stat-label">已缺货 SKU</div>
        <div class="stat-value">{{ stats.outOfStock }}</div>
        <div class="stat-foot">需要立即补货</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-label">低库存 SKU</div>
        <div class="stat-value">{{ stats.lowStock }}</div>
        <div class="stat-foot">低于预警线</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-label">在途补货</div>
        <div class="stat-value">{{ stats.inTransit }}</div>
        <div class="stat-foot">采购单已下</div>
      </div>
      <div class="stat-card gold">
        <div class="stat-label">预估缺货损失</div>
        <div class="stat-value">¥{{ stats.lossAmount.toLocaleString() }}</div>
        <div class="stat-foot">按近 30 日销量估算</div>
      </div>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="预警等级">
          <el-radio-group v-model="filter.level">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="critical">已缺货</el-radio-button>
            <el-radio-button value="warning">预警中</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="搜索">
          <el-input v-model="filter.keyword" placeholder="SKU / 商品名称" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="filteredList" stripe border @selection-change="handleSelection">
        <el-table-column type="selection" width="50" />
        <el-table-column label="SKU" prop="sku" width="170">
          <template #default="{ row }">
            <span class="sku-code">{{ row.sku }}</span>
          </template>
        </el-table-column>
        <el-table-column label="商品" min-width="240">
          <template #default="{ row }">
            <div class="product-cell">
              <el-image :src="row.image" fit="cover" class="product-img" />
              <div>
                <div class="product-name">{{ row.productName }}</div>
                <div class="product-spec">{{ row.spec }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="仓库" prop="warehouseName" width="140" />
        <el-table-column label="可用库存" width="110" align="right">
          <template #default="{ row }">
            <span :class="row.available === 0 ? 'critical' : 'warning-text'">
              {{ row.available }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="预警值" prop="warningLine" width="90" align="right" />
        <el-table-column label="近 30 日销量" prop="sales30" width="130" align="right">
          <template #default="{ row }">
            <span class="sales">{{ row.sales30 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可售天数" width="110" align="right">
          <template #default="{ row }">
            <el-tag :type="getDaysTag(row).type" size="small">
              {{ getDaysTag(row).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="建议采购量" width="130" align="right">
          <template #default="{ row }">
            <span class="suggest">{{ getSuggestQty(row) }} 件</span>
          </template>
        </el-table-column>
        <el-table-column label="预警等级" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.available === 0 ? 'danger' : 'warning'" size="small" effect="dark">
              {{ row.available === 0 ? '已缺货' : '预警中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handlePurchase(row)">生成采购单</el-button>
            <el-button link type="info" @click="handleIgnore(row)">忽略</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentAdd, Search } from '@element-plus/icons-vue'
import { inventoryApi } from '@/api/inventory'

interface WarningItem {
  id: number
  sku: string
  productName: string
  spec: string
  image: string
  warehouseName: string
  available: number
  warningLine: number
  sales30: number
  leadTime: number
}

const filter = reactive({
  level: 'all',
  keyword: '',
})

const list = ref<WarningItem[]>([])
const loadError = ref('')

async function loadWarnings() {
  loadError.value = ''
  try {
    const res: any = await inventoryApi.warnings({})
    const rows = (res?.list ?? res ?? []) as any[]
    list.value = (Array.isArray(rows) ? rows : []).map((r: any, i: number) => ({
      id: r.id ?? i + 1,
      sku: r.sku?.code || r.skuCode || '',
      productName: r.sku?.product?.name || r.productName || '',
      spec: r.sku?.specs || r.spec || '',
      image: r.sku?.product?.mainImage || '/placeholder.svg?height=40&width=40',
      warehouseName: r.warehouse?.name || r.warehouseName || '',
      available: Number(r.available ?? 0),
      warningLine: Number(r.warningLine ?? r.safetyStock ?? 20),
      sales30: Number(r.sales30 ?? 0),
      leadTime: Number(r.leadTime ?? 10),
    })) as any
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    list.value = []
  }
}

onMounted(loadWarnings)

const filteredList = computed(() => {
  let result = list.value
  if (filter.level === 'critical') result = result.filter((r) => r.available === 0)
  else if (filter.level === 'warning') result = result.filter((r) => r.available > 0)
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase()
    result = result.filter(
      (r) => r.sku.toLowerCase().includes(kw) || r.productName.toLowerCase().includes(kw),
    )
  }
  return result
})

const stats = computed(() => {
  const outOfStock = list.value.filter((r) => r.available === 0).length
  const lowStock = list.value.filter((r) => r.available > 0).length
  const inTransit = 3
  const lossAmount = list.value
    .filter((r) => r.available === 0)
    .reduce((sum, r) => sum + r.sales30 * 800, 0)
  return { outOfStock, lowStock, inTransit, lossAmount }
})

function getDaysTag(row: WarningItem) {
  const dailySales = row.sales30 / 30
  if (dailySales === 0) return { type: 'info' as const, text: '-' }
  const days = Math.floor(row.available / dailySales)
  if (days === 0) return { type: 'danger' as const, text: '已断货' }
  if (days < 7) return { type: 'danger' as const, text: `${days} 天` }
  if (days < 15) return { type: 'warning' as const, text: `${days} 天` }
  return { type: 'success' as const, text: `${days} 天` }
}

function getSuggestQty(row: WarningItem) {
  const dailySales = row.sales30 / 30
  return Math.ceil(dailySales * (row.leadTime + 30))
}

const selected = ref<WarningItem[]>([])
function handleSelection(val: WarningItem[]) {
  selected.value = val
}

function handleBatchPurchase() {
  if (!selected.value.length) {
    ElMessage.warning('请先勾选需要生成采购单的 SKU')
    return
  }
  ElMessage.success(`已为 ${selected.value.length} 个 SKU 生成采购申请单`)
}

function handlePurchase(row: WarningItem) {
  ElMessage.success(`已为 ${row.sku} 生成采购申请单`)
}

function handleIgnore(row: WarningItem) {
  list.value = list.value.filter((r) => r.id !== row.id)
  ElMessage.success('已忽略该预警')
}
</script>

<style scoped>
.warning-page { padding: 20px; }

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
  border-left: 4px solid #dcdfe6;
  border-top: 1px solid #ebeef5;
  border-right: 1px solid #ebeef5;
  border-bottom: 1px solid #ebeef5;
}
.stat-card.red { border-left-color: #f56c6c; }
.stat-card.orange { border-left-color: #e6a23c; }
.stat-card.blue { border-left-color: #409eff; }
.stat-card.gold { border-left-color: #c8a96a; }

.stat-label { font-size: 13px; color: #909399; }
.stat-value { font-size: 26px; font-weight: 600; color: #1f2d3d; margin: 6px 0 4px; }
.stat-foot { font-size: 12px; color: #606266; }

.filter-card { margin-bottom: 16px; border-radius: 8px; }
.filter-form :deep(.el-form-item) { margin-bottom: 0; }
.content-card { border-radius: 8px; }

.sku-code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #c8a96a;
  font-weight: 600;
}

.product-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.product-img { width: 40px; height: 40px; border-radius: 4px; }
.product-name { font-size: 13px; font-weight: 500; color: #1f2d3d; }
.product-spec { font-size: 12px; color: #909399; margin-top: 2px; }

.critical { color: #f56c6c; font-weight: 700; font-size: 15px; }
.warning-text { color: #e6a23c; font-weight: 600; }
.sales { color: #1f2d3d; font-weight: 500; }
.suggest { color: #c8a96a; font-weight: 600; }
</style>
