<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productApi } from '@/api/product'
import { categoryApi } from '@/api/category'
import { fetchTiersBySku, saveTiers } from '@/api/priceTier'

const router = useRouter()
const loading = ref(false)

/* ===================== 类型定义 ===================== */

export type ProductCategory = '茶器' | '花器' | '餐具' | '酒器' | '摆件'
export type ProductCraft =
  | '青花瓷'
  | '粉彩'
  | '汝窑天青釉'
  | '羊脂玉白瓷'
  | '手绘青釉'

/** 分销商等级 */
export type DealerLevel = '普通' | '白银' | '黄金' | '钻石'
type ChannelFilter = '' | 'retail' | 'wholesale'


export interface ProductManageItem {
  id: string
  sku_id?: number
  code: string
  name: string
  image: string
  category: string
  retail_price_ref: number
  retail_enabled: boolean
  wholesale_enabled: boolean
  min_wholesale_qty: number
  authorized_levels: DealerLevel[]
  dealer_count: number
  wholesale_sales_30d: number
  stock_available: number
  stock_warning: number
  /** 关联的运费模板 id（null = 未挂模板，零售下单将走 freeShipping/shippingFee 兜底） */
  shipping_template_id: number | null
  /** 模板名称，便于在表格里显示 */
  shipping_template_name: string
  /** 未挂模板时：是否标记为整单包邮 */
  free_shipping: boolean
  /** 未挂模板时：商品默认运费（元） */
  shipping_fee: number
}

interface SkuInfo {
  sku_id: number
  sku_name: string
  image: string
  retail_price: number
}

/* ===================== 筛选 ===================== */

const filter = reactive({
  keyword: '',
  category: '',
  channel: '' as ChannelFilter,
  retail: '' as '' | 'on' | 'off',
  wholesale: '' as '' | 'on' | 'off',
  level: '' as DealerLevel | '',
  stock: '' as '' | 'normal' | 'warning',
})

const categoryOptions = ref<string[]>([])
const levelOptions: DealerLevel[] = ['普通', '白银', '黄金', '钻石']

const page = reactive({ current: 1, size: 10 })
const products = ref<ProductManageItem[]>([])
const loadError = ref('')

async function loadCategories() {
  try {
    const res = await categoryApi.tree()
    const flatten = (list: any[]): any[] => list.flatMap((item) => [item, ...flatten(item.children || [])])
    categoryOptions.value = flatten(Array.isArray(res) ? res : (res as any)?.list || []).map((item) => item.name)
  } catch {
    categoryOptions.value = []
  }
}

async function loadList() {
  loading.value = true
  loadError.value = ''
  try {
    const res: any = await productApi.list({ page: 1, pageSize: 100 })
    const rows = (res?.list ?? []) as any[]
    products.value = rows.map((r: any) => {
      const sku = r.skus?.[0] || {}
      return {
        id: String(r.id),
        sku_id: sku.id,
        code: r.code || sku.code || '',
        name: r.name,
        image: r.mainImage || r.coverImage || '/placeholder.svg',
        category: r.category?.name || '未分类',
        retail_price_ref: Number(sku.retailPrice ?? r.retailPrice ?? 0),
        retail_enabled: r.retailEnabled === true,
        wholesale_enabled: r.wholesaleEnabled === true,
        min_wholesale_qty: Number(sku.minOrderQty ?? r.minWholesaleQty ?? 1),
        authorized_levels: (r.authorizedLevels || r.authLevels || []) as DealerLevel[],
        dealer_count: Number(r.dealerCount ?? r.distributorCount ?? 0),
        wholesale_sales_30d: Number(r.wholesaleSales30d ?? r.monthlyAmount ?? 0),
        stock_available: Number(sku.stock ?? sku.stockAvailable ?? 0),
        stock_warning: Number(sku.stockWarning ?? 20),
        shipping_template_id:
          r.shippingTemplateId == null ? null : Number(r.shippingTemplateId),
        shipping_template_name: r.shippingTemplate?.name || '',
        free_shipping: r.freeShipping === true,
        shipping_fee: Number(r.shippingFee || 0),
      }
    })
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    products.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadList()
})

const filteredList = computed(() => {
  return products.value.filter((p) => {
    if (
      filter.keyword &&
      !p.name.includes(filter.keyword) &&
      !p.code.includes(filter.keyword)
    )
      return false
    if (filter.category && p.category !== filter.category) return false
    if (filter.channel === 'retail' && !p.retail_enabled) return false
    if (filter.channel === 'wholesale' && !p.wholesale_enabled) return false
    if (filter.retail === 'on' && !p.retail_enabled) return false
    if (filter.retail === 'off' && p.retail_enabled) return false
    if (filter.wholesale === 'on' && !p.wholesale_enabled) return false
    if (filter.wholesale === 'off' && p.wholesale_enabled) return false
    if (filter.level && !p.authorized_levels.includes(filter.level)) return false
    if (filter.stock === 'warning' && p.stock_available >= p.stock_warning)
      return false
    if (filter.stock === 'normal' && p.stock_available < p.stock_warning)
      return false
    return true
  })
})

const pagedList = computed(() => {
  const start = (page.current - 1) * page.size
  return filteredList.value.slice(start, start + page.size)
})

/* ===================== 顶部统计 ===================== */

const stats = computed(() => {
  const total = products.value.length
  const retailEnabled = products.value.filter((p) => p.retail_enabled).length
  const wholesaleEnabled = products.value.filter((p) => p.wholesale_enabled).length
  const bothEnabled = products.value.filter((p) => p.retail_enabled && p.wholesale_enabled).length
  return { total, retailEnabled, wholesaleEnabled, bothEnabled }
})

/* ===================== 操作 ===================== */

function handleSearch() {
  page.current = 1
  ElMessage.success(`已查询，共 ${filteredList.value.length} 条结果`)
}

function handleReset() {
  filter.keyword = ''
  filter.category = ''
  filter.channel = ''
  filter.retail = ''
  filter.wholesale = ''
  filter.level = ''
  filter.stock = ''
  page.current = 1
}

async function toggleRetail(row: ProductManageItem, val: boolean | string | number) {
  const next = Boolean(val)
  try {
    await productApi.toggleChannel(Number(row.id), 'retail', next)
    row.retail_enabled = next
    ElMessage.success(`${row.name} 已${next ? '开启' : '关闭'}零售`)
  } catch (error: any) {
    ElMessage.error(error?.message || '状态更新失败')
  }
}

async function toggleWholesale(row: ProductManageItem, val: boolean | string | number) {
  const next = Boolean(val)
  try {
    await productApi.toggleChannel(Number(row.id), 'wholesale', next)
    row.wholesale_enabled = next
    ElMessage.success(`${row.name} 已${next ? '开启' : '关闭'}批发`)
  } catch (error: any) {
    ElMessage.error(error?.message || '状态更新失败')
  }
}

function handleCreate() {
  router.push('/product/create')
}
function handleEdit(row: ProductManageItem) {
  router.push({
    path: '/product/edit',
    query: { id: row.id },
  })
}
function handleSku(row: ProductManageItem) {
  ElMessage.info(`SKU 配置：${row.name}`)
}
function handleAuthorize(row: ProductManageItem) {
  ElMessage.info(`设置可批发等级：${row.name}`)
}
async function handleStopWholesale(row: ProductManageItem) {
  try {
    await ElMessageBox.confirm(
      `确定停止「${row.name}」的批发供货吗？所有等级的分销商将无法下单。`,
      '停批确认',
      { type: 'warning' },
    )
    await productApi.toggleChannel(Number(row.id), 'wholesale', false)
    row.wholesale_enabled = false
    ElMessage.success('已停止批发')
  } catch {
    /* 取消 */
  }
}

function levelTagType(l: DealerLevel) {
  switch (l) {
    case '钻石':
      return 'primary'
    case '黄金':
      return 'warning'
    case '白银':
      return 'info'
    case '普通':
    default:
      return 'success'
  }
}
</script>

<template>
  <div class="product-manage">
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadList">点击重试</el-button>
      </template>
    </el-alert>
    <!-- 顶部统计 -->
    <div class="stat-row">
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">商品总数</div>
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-sub">零售 / 批发统一管理</div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">零售上架</div>
        <div class="stat-value success">{{ stats.retailEnabled }}</div>
        <div class="stat-sub">
          占比 {{ Math.round((stats.retailEnabled / Math.max(stats.total, 1)) * 100) }}%
        </div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">批发上架</div>
        <div class="stat-value primary">{{ stats.wholesaleEnabled }}</div>
        <div class="stat-sub">可在批发端展示</div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">双端上架</div>
        <div class="stat-value danger">
          {{ stats.bothEnabled }}
        </div>
        <div class="stat-sub">零售和批发同时展示</div>
      </el-card>
    </div>

    <!-- 筛选 -->
    <el-card shadow="never" class="filter-card">
      <el-form :inline="true" :model="filter" @submit.prevent>
        <el-form-item label="商品名称">
          <el-input
            v-model="filter.keyword"
            placeholder="输入名称或编码"
            clearable
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="filter.category"
            placeholder="全部"
            clearable
            style="width: 140px"
          >
            <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="销售渠道">
          <el-select
            v-model="filter.channel"
            placeholder="全部商品"
            clearable
            style="width: 130px"
          >
            <el-option label="零售商品" value="retail" />
            <el-option label="批发商品" value="wholesale" />
          </el-select>
        </el-form-item>
        <el-form-item label="零售状态">
          <el-select
            v-model="filter.retail"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option label="已开启" value="on" />
            <el-option label="未开启" value="off" />
          </el-select>
        </el-form-item>
        <el-form-item label="批发状态">
          <el-select
            v-model="filter.wholesale"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option label="已开启" value="on" />
            <el-option label="未开启" value="off" />
          </el-select>
        </el-form-item>
        <el-form-item label="授权等级">
          <el-select
            v-model="filter.level"
            placeholder="全部"
            clearable
            style="width: 120px"
          >
            <el-option v-for="l in levelOptions" :key="l" :label="l" :value="l" />
          </el-select>
        </el-form-item>
        <el-form-item label="库存">
          <el-select v-model="filter.stock" placeholder="全部" clearable style="width: 120px">
            <el-option label="正常" value="normal" />
            <el-option label="预警" value="warning" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="handleSearch">查询</el-button>
          <el-button :icon="'RefreshLeft'" @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item class="form-item-right">
          <el-button type="success" :icon="'Plus'" @click="handleCreate">
            新增商品
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="pagedList"
        border
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#303133', fontWeight: 600 }"
      >
        <el-table-column label="主图" width="80" align="center">
          <template #default="{ row }">
            <el-image
              :src="row.image"
              :preview-src-list="[row.image]"
              fit="cover"
              class="product-img"
              preview-teleported
              hide-on-click-modal
            />
          </template>
        </el-table-column>

        <el-table-column label="商品编码 / 名称" min-width="220">
          <template #default="{ row }">
            <div class="cell-code">{{ row.code }}</div>
            <div class="cell-name">{{ row.name }}</div>
            <div class="retail-ref">
              零售价参考：¥ {{ row.retail_price_ref.toFixed(2) }}
            </div>
          </template>
        </el-table-column>

        <el-table-column label="分类" width="130">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.category }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="起批量" width="100" align="center">
          <template #default="{ row }">
            <template v-if="row.wholesale_enabled">
              <div class="moq">{{ row.min_wholesale_qty }}</div>
              <div class="moq-unit">件起批</div>
            </template>
            <span v-else class="text-placeholder">—</span>
          </template>
        </el-table-column>


        <el-table-column label="授权等级" min-width="200">
          <template #default="{ row }">
            <template v-if="row.wholesale_enabled && row.authorized_levels.length">
              <el-tag
                v-for="l in row.authorized_levels"
                :key="l"
                :type="levelTagType(l)"
                size="small"
                effect="plain"
                class="level-tag"
              >
                {{ l }}
              </el-tag>
            </template>
            <span v-else class="text-placeholder">—</span>
          </template>
        </el-table-column>

        <el-table-column label="分销商 / 月销" width="140">
          <template #default="{ row }">
            <div class="dealer-row">
              <span class="num">{{ row.dealer_count }}</span>
              <span class="unit">家</span>
            </div>
            <div class="sales-row">
              ¥ {{ row.wholesale_sales_30d.toLocaleString() }}
            </div>
          </template>
        </el-table-column>

        <el-table-column label="可用库存" width="100" align="right">
          <template #default="{ row }">
            <span class="stock" :class="{ warning: row.stock_available < row.stock_warning }">
              {{ row.stock_available }}
            </span>
          </template>
        </el-table-column>

        <!--
          运费来源：
          1. 挂了模板 → 显示模板名称（绿色 success tag）
          2. 没模板但 freeShipping=true → 显示"包邮"灰色 tag
          3. 没模板且 shippingFee > 0 → 显示"¥X 默认运费"info tag
          4. 都没有 → 红色 danger tag「未配置」+ 提示去编辑挂模板
          运营在这一列就能一眼看出"为什么零售下单 0 元运费"
        -->
        <el-table-column label="运费配置" width="150" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.shipping_template_id"
              type="success"
              effect="plain"
              size="small"
            >
              {{ row.shipping_template_name || '已挂模板' }}
            </el-tag>
            <el-tag
              v-else-if="row.free_shipping"
              type="info"
              effect="plain"
              size="small"
            >
              整单包邮
            </el-tag>
            <el-tag
              v-else-if="row.shipping_fee > 0"
              type="warning"
              effect="plain"
              size="small"
            >
              ¥{{ row.shipping_fee.toFixed(2) }} 默认
            </el-tag>
            <el-tag v-else type="danger" effect="plain" size="small">
              未配置
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="零售开关" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.retail_enabled"
              inline-prompt
              active-text="开启"
              inactive-text="关闭"
              style="--el-switch-on-color: #409eff; --el-switch-off-color: #909399"
              @update:model-value="(v: string | number | boolean) => toggleRetail(row, Boolean(v))"
            />
          </template>
        </el-table-column>

        <el-table-column label="批发开关" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.wholesale_enabled"
              inline-prompt
              active-text="开启"
              inactive-text="关闭"
              style="--el-switch-on-color: #67c23a; --el-switch-off-color: #909399"
              @update:model-value="(v: string | number | boolean) => toggleWholesale(row, Boolean(v))"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleSku(row)">SKU</el-button>
            <el-button link type="primary" size="small" @click="handleAuthorize(row)">
              授权
            </el-button>
            <el-button link type="danger" size="small" @click="handleStopWholesale(row)">
              停批
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :page-sizes="[10, 20, 50, 100]"
          :total="filteredList.length"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

  </div>
</template>

<style scoped>
.product-manage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  border-radius: 6px;
}
.stat-card :deep(.el-card__body) {
  padding: 18px 20px;
}
.stat-label {
  font-size: 13px;
  color: var(--ym-text-secondary);
}
.stat-value {
  font-size: 26px;
  font-weight: 700;
  margin-top: 6px;
  color: var(--ym-primary);
  line-height: 1.2;
  font-family: 'Menlo', 'Consolas', monospace;
}
.stat-value.success {
  color: #67c23a;
}
.stat-value.danger {
  color: var(--ym-danger);
}
.stat-value.primary {
  color: var(--ym-accent, #c8a96a);
}
.stat-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ym-text-secondary);
}

.filter-card :deep(.el-form--inline .el-form-item) {
  margin-right: 16px;
  margin-bottom: 0;
}
.filter-card :deep(.el-form) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 0;
  align-items: center;
}
.form-item-right {
  margin-left: auto !important;
  margin-right: 0 !important;
}

.table-card :deep(.el-card__body) {
  padding: 0;
}

.product-img {
  width: 52px;
  height: 52px;
  border-radius: 4px;
  background: #f5f7fa;
}

.cell-code {
  font-size: 12px;
  color: var(--ym-text-secondary);
  font-family: 'Menlo', 'Consolas', monospace;
}
.cell-name {
  font-weight: 600;
  color: var(--ym-primary);
  margin-top: 4px;
  line-height: 1.45;
}
.retail-ref {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ym-text-secondary);
}
.craft {
  color: var(--ym-text-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.moq {
  font-size: 18px;
  font-weight: 700;
  color: var(--ym-primary);
  font-family: 'Menlo', 'Consolas', monospace;
}
.moq-unit {
  font-size: 12px;
  color: var(--ym-text-secondary);
  margin-top: 2px;
}


.level-tag {
  margin-right: 6px;
  margin-bottom: 4px;
}

.dealer-row .num {
  font-weight: 700;
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 16px;
  color: var(--ym-primary);
}
.dealer-row .unit {
  margin-left: 4px;
  font-size: 12px;
  color: var(--ym-text-secondary);
}
.sales-row {
  margin-top: 4px;
  font-size: 13px;
  color: #b88a2e;
  font-weight: 600;
  font-family: 'Menlo', 'Consolas', monospace;
}

.text-placeholder {
  color: #c0c4cc;
}

.stock {
  font-weight: 600;
  font-family: 'Menlo', 'Consolas', monospace;
}
.stock.warning {
  color: var(--ym-danger);
}

.pagination-wrap {
  padding: 14px 16px;
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid var(--ym-border);
  background: #fff;
}
</style>
