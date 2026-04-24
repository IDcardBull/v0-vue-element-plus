<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productApi } from '@/api/product'

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

/** 零售商品 */
export interface RetailProduct {
  id: string
  code: string
  name: string
  image: string
  category: ProductCategory
  craft: ProductCraft
  retail_price: number
  member_price: number
  retail_on_sale: boolean
  sales_30d: number // 近 30 天销量
  rating: number // 评分 0-5
  stock_available: number
  stock_warning: number
  campaign: '' | '满减' | '拼团' | '限时折扣' | '积分兑换' // 关联营销
}

/* ===================== 筛选 & 分页 ===================== */

const filter = reactive({
  keyword: '',
  category: '' as ProductCategory | '',
  retail: '' as '' | 'on' | 'off',
  stock: '' as '' | 'normal' | 'warning',
  campaign: '' as RetailProduct['campaign'] | '',
})

const categoryOptions: ProductCategory[] = ['茶器', '花器', '餐具', '酒器', '摆件']
const campaignOptions: RetailProduct['campaign'][] = [
  '满减',
  '拼团',
  '限时折扣',
  '积分兑换',
]

const page = reactive({ current: 1, size: 10 })
const products = ref<RetailProduct[]>([])
const loadError = ref('')

/** 后端商品映射为前端零售商品结构 */
function mapFromApi(row: any): RetailProduct {
  const firstSku = row.skus?.[0]
  return {
    id: String(row.id),
    code: row.code || firstSku?.code || '',
    name: row.name,
    image: row.mainImage || row.coverImage || row.image || '/placeholder.svg',
    category: row.category?.name || row.categoryName || '茶器',
    craft: row.craft || '青花瓷',
    retail_price: Number(firstSku?.retailPrice ?? row.retailPrice ?? 0),
    member_price: Number(firstSku?.memberPrice ?? row.memberPrice ?? 0),
    retail_on_sale: row.status === 'on_sale' || row.retailEnabled === true,
    sales_30d: row.sales30d ?? 0,
    rating: row.rating ?? 5,
    stock_available: Number(firstSku?.stock ?? 0),
    stock_warning: Number(firstSku?.stockWarning ?? 20),
    campaign: row.campaign || '',
  }
}

async function loadList() {
  loading.value = true
  loadError.value = ''
  try {
    const res: any = await productApi.list({ page: page.current, pageSize: 100, channel: 'retail' })
    const rows = (res?.list ?? []) as any[]
    products.value = rows.map(mapFromApi)
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    products.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadList)

const filteredList = computed(() => {
  return products.value.filter((p) => {
    if (
      filter.keyword &&
      !p.name.includes(filter.keyword) &&
      !p.code.includes(filter.keyword)
    )
      return false
    if (filter.category && p.category !== filter.category) return false
    if (filter.retail === 'on' && !p.retail_on_sale) return false
    if (filter.retail === 'off' && p.retail_on_sale) return false
    if (filter.stock === 'warning' && p.stock_available >= p.stock_warning)
      return false
    if (filter.stock === 'normal' && p.stock_available < p.stock_warning)
      return false
    if (filter.campaign && p.campaign !== filter.campaign) return false
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
  const onSale = products.value.filter((p) => p.retail_on_sale).length
  const lowStock = products.value.filter(
    (p) => p.stock_available < p.stock_warning,
  ).length
  const sales30d = products.value.reduce((s, p) => s + p.sales_30d, 0)
  return { total, onSale, lowStock, sales30d }
})

/* ===================== 操作 ===================== */

function handleSearch() {
  page.current = 1
  ElMessage.success(`已查询，共 ${filteredList.value.length} 条结果`)
}

function handleReset() {
  filter.keyword = ''
  filter.category = ''
  filter.retail = ''
  filter.stock = ''
  filter.campaign = ''
  page.current = 1
}

function toggleRetailStatus(row: RetailProduct, val: boolean | string | number) {
  row.retail_on_sale = Boolean(val)
  ElMessage.success(
    `${row.name} 已${row.retail_on_sale ? '上架' : '下架'}零售`,
  )
}

function handleCreate() {
  router.push({ path: '/product/create', query: { channel: 'retail' } })
}
function handleEdit(row: RetailProduct) {
  router.push({
    path: '/product/edit',
    query: { id: row.id, channel: 'retail' },
  })
}
function handleSku(row: RetailProduct) {
  ElMessage.info(`SKU 配置：${row.name}`)
}
function handleCampaign(row: RetailProduct) {
  ElMessage.info(`关联营销活动：${row.name}`)
}
async function handleDelist(row: RetailProduct) {
  try {
    await ElMessageBox.confirm(`确定下架「${row.name}」吗？`, '下架确认', {
      type: 'warning',
    })
    row.retail_on_sale = false
    ElMessage.success('已下架')
  } catch {
    /* 取消 */
  }
}

function campaignTagType(c: RetailProduct['campaign']) {
  switch (c) {
    case '满减':
      return 'success'
    case '拼团':
      return 'warning'
    case '限时折扣':
      return 'danger'
    case '积分兑换':
      return 'primary'
    default:
      return 'info'
  }
}
</script>

<template>
  <div class="retail-product">
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadList">点击重试</el-button>
      </template>
    </el-alert>
    <!-- 顶部统计 -->
    <div class="stat-row">
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">零售 SKU 总数</div>
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-sub">含全部分类</div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">上架中</div>
        <div class="stat-value success">{{ stats.onSale }}</div>
        <div class="stat-sub">占比 {{ Math.round((stats.onSale / stats.total) * 100) }}%</div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">库存预警</div>
        <div class="stat-value danger">{{ stats.lowStock }}</div>
        <div class="stat-sub">低于预警阈值</div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">近 30 天销量</div>
        <div class="stat-value primary">{{ stats.sales30d.toLocaleString() }}</div>
        <div class="stat-sub">全零售渠道合计</div>
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
          <el-select v-model="filter.category" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="c in categoryOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="上架状态">
          <el-select v-model="filter.retail" placeholder="全部" clearable style="width: 120px">
            <el-option label="上架" value="on" />
            <el-option label="下架" value="off" />
          </el-select>
        </el-form-item>
        <el-form-item label="库存">
          <el-select v-model="filter.stock" placeholder="全部" clearable style="width: 120px">
            <el-option label="正常" value="normal" />
            <el-option label="预警" value="warning" />
          </el-select>
        </el-form-item>
        <el-form-item label="营销活动">
          <el-select v-model="filter.campaign" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="c in campaignOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="handleSearch">查询</el-button>
          <el-button :icon="'RefreshLeft'" @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item class="form-item-right">
          <el-button type="success" :icon="'Plus'" @click="handleCreate">新增零售商品</el-button>
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
          </template>
        </el-table-column>

        <el-table-column label="分类 / 工艺" width="140">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.category }}</el-tag>
            <div class="craft">{{ row.craft }}</div>
          </template>
        </el-table-column>

        <el-table-column label="零售价 / 会员价" width="150">
          <template #default="{ row }">
            <div class="price-retail">¥ {{ row.retail_price.toFixed(2) }}</div>
            <div class="price-member">
              <el-tag size="small" type="warning" effect="dark">会员</el-tag>
              <span>¥ {{ row.member_price.toFixed(2) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="销量 / 评分" width="130">
          <template #default="{ row }">
            <div class="sales">
              <span class="num">{{ row.sales_30d.toLocaleString() }}</span>
              <span class="unit">件 / 30天</span>
            </div>
            <div class="rating">
              <el-rate
                :model-value="row.rating"
                disabled
                :max="5"
                allow-half
                size="small"
                :colors="['#f7ba2a', '#f7ba2a', '#f7ba2a']"
              />
              <span class="rate-num">{{ row.rating.toFixed(1) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="营销活动" width="120" align="center">
          <template #default="{ row }">
            <el-tag
              v-if="row.campaign"
              :type="campaignTagType(row.campaign)"
              size="small"
              effect="plain"
            >
              {{ row.campaign }}
            </el-tag>
            <span v-else class="text-placeholder">—</span>
          </template>
        </el-table-column>

        <el-table-column label="可用库存" width="100" align="right">
          <template #default="{ row }">
            <span class="stock" :class="{ warning: row.stock_available < row.stock_warning }">
              {{ row.stock_available }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="上下架" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.retail_on_sale"
              inline-prompt
              active-text="上架"
              inactive-text="下架"
              style="--el-switch-on-color: #67c23a; --el-switch-off-color: #909399"
              @update:model-value="(v: string | number | boolean) => toggleRetailStatus(row, Boolean(v))"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleSku(row)">SKU</el-button>
            <el-button link type="primary" size="small" @click="handleCampaign(row)">
              营销
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelist(row)">下架</el-button>
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
.retail-product {
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
.craft {
  color: var(--ym-text-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.price-retail {
  font-size: 15px;
  color: var(--ym-danger);
  font-weight: 700;
}
.price-member {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #b88a2e;
  font-weight: 600;
}

.sales .num {
  font-weight: 700;
  color: var(--ym-primary);
  font-family: 'Menlo', 'Consolas', monospace;
  font-size: 14px;
}
.sales .unit {
  margin-left: 4px;
  font-size: 12px;
  color: var(--ym-text-secondary);
}
.rating {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.rate-num {
  font-size: 12px;
  color: #b88a2e;
  font-weight: 600;
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
