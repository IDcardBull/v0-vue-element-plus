<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import PriceTierConfig from './PriceTierConfig.vue'

const router = useRouter()

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

interface PriceTier {
  min_qty: number | null
  max_qty: number | null
  price: number | null
}

export interface WholesaleProduct {
  id: string
  code: string
  name: string
  image: string
  category: ProductCategory
  craft: ProductCraft
  retail_price_ref: number // 零售价参考
  wholesale_enabled: boolean
  min_wholesale_qty: number
  tier_count: number // 阶梯档位数
  tier_min_price: number // 最低阶梯价
  tier_max_price: number // 最高阶梯价
  authorized_levels: DealerLevel[] // 可批发的分销商等级
  dealer_count: number // 关联分销商数
  wholesale_sales_30d: number // 近 30 天批发销售额
  stock_available: number
  stock_warning: number
  tiers: PriceTier[]
}

interface SkuInfo {
  sku_id: string
  sku_name: string
  image: string
  retail_price: number
}

/* ===================== 模拟数据 ===================== */

const mockProducts: WholesaleProduct[] = [
  {
    id: '1',
    code: 'YM-CHA-0001',
    name: '青花瓷手绘八宝纹茶具套装（一壶四杯）',
    image:
      'https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=200&q=80&auto=format&fit=crop',
    category: '茶器',
    craft: '青花瓷',
    retail_price_ref: 688,
    wholesale_enabled: true,
    min_wholesale_qty: 10,
    tier_count: 3,
    tier_min_price: 380,
    tier_max_price: 520,
    authorized_levels: ['普通', '白银', '黄金', '钻石'],
    dealer_count: 48,
    wholesale_sales_30d: 286400,
    stock_available: 156,
    stock_warning: 30,
    tiers: [
      { min_qty: 10, max_qty: 49, price: 520 },
      { min_qty: 50, max_qty: 199, price: 450 },
      { min_qty: 200, max_qty: null, price: 380 },
    ],
  },
  {
    id: '2',
    code: 'YM-HUA-0012',
    name: '羊脂玉白瓷·梅兰竹菊浮雕花瓶',
    image:
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=200&q=80&auto=format&fit=crop',
    category: '花器',
    craft: '羊脂玉白瓷',
    retail_price_ref: 1280,
    wholesale_enabled: true,
    min_wholesale_qty: 5,
    tier_count: 2,
    tier_min_price: 780,
    tier_max_price: 920,
    authorized_levels: ['黄金', '钻石'],
    dealer_count: 12,
    wholesale_sales_30d: 156800,
    stock_available: 12,
    stock_warning: 20,
    tiers: [
      { min_qty: 5, max_qty: 29, price: 920 },
      { min_qty: 30, max_qty: null, price: 780 },
    ],
  },
  {
    id: '3',
    code: 'YM-CHA-0027',
    name: '汝窑天青釉·开片主人杯（单只礼盒装）',
    image:
      'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&q=80&auto=format&fit=crop',
    category: '茶器',
    craft: '汝窑天青釉',
    retail_price_ref: 398,
    wholesale_enabled: false,
    min_wholesale_qty: 0,
    tier_count: 0,
    tier_min_price: 0,
    tier_max_price: 0,
    authorized_levels: [],
    dealer_count: 0,
    wholesale_sales_30d: 0,
    stock_available: 248,
    stock_warning: 50,
    tiers: [],
  },
  {
    id: '4',
    code: 'YM-CAN-0008',
    name: '粉彩描金·福寿双全祝寿餐具 28 件套',
    image:
      'https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=200&q=80&auto=format&fit=crop',
    category: '餐具',
    craft: '粉彩',
    retail_price_ref: 2680,
    wholesale_enabled: true,
    min_wholesale_qty: 2,
    tier_count: 3,
    tier_min_price: 1580,
    tier_max_price: 2080,
    authorized_levels: ['白银', '黄金', '钻石'],
    dealer_count: 36,
    wholesale_sales_30d: 428600,
    stock_available: 46,
    stock_warning: 15,
    tiers: [
      { min_qty: 2, max_qty: 9, price: 2080 },
      { min_qty: 10, max_qty: 49, price: 1880 },
      { min_qty: 50, max_qty: null, price: 1580 },
    ],
  },
  {
    id: '5',
    code: 'YM-JIU-0003',
    name: '手绘青釉·山水纹品酒对杯',
    image:
      'https://images.unsplash.com/photo-1536520002442-39764a41e987?w=200&q=80&auto=format&fit=crop',
    category: '酒器',
    craft: '手绘青釉',
    retail_price_ref: 268,
    wholesale_enabled: true,
    min_wholesale_qty: 20,
    tier_count: 2,
    tier_min_price: 128,
    tier_max_price: 168,
    authorized_levels: ['普通', '白银', '黄金', '钻石'],
    dealer_count: 62,
    wholesale_sales_30d: 98600,
    stock_available: 8,
    stock_warning: 20,
    tiers: [
      { min_qty: 20, max_qty: 99, price: 168 },
      { min_qty: 100, max_qty: null, price: 128 },
    ],
  },
]

/* ===================== 筛选 ===================== */

const filter = reactive({
  keyword: '',
  category: '' as ProductCategory | '',
  wholesale: '' as '' | 'on' | 'off',
  level: '' as DealerLevel | '',
  stock: '' as '' | 'normal' | 'warning',
})

const categoryOptions: ProductCategory[] = ['茶器', '花器', '餐具', '酒器', '摆件']
const levelOptions: DealerLevel[] = ['普通', '白银', '黄金', '钻石']

const page = reactive({ current: 1, size: 10 })
const products = ref<WholesaleProduct[]>([...mockProducts])

const filteredList = computed(() => {
  return products.value.filter((p) => {
    if (
      filter.keyword &&
      !p.name.includes(filter.keyword) &&
      !p.code.includes(filter.keyword)
    )
      return false
    if (filter.category && p.category !== filter.category) return false
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
  const enabled = products.value.filter((p) => p.wholesale_enabled).length
  const dealers = Math.max(...products.value.map((p) => p.dealer_count), 0)
  const sales30d = products.value.reduce((s, p) => s + p.wholesale_sales_30d, 0)
  return { total, enabled, dealers, sales30d }
})

/* ===================== 操作 ===================== */

function handleSearch() {
  page.current = 1
  ElMessage.success(`已查询，共 ${filteredList.value.length} 条结果`)
}

function handleReset() {
  filter.keyword = ''
  filter.category = ''
  filter.wholesale = ''
  filter.level = ''
  filter.stock = ''
  page.current = 1
}

function toggleWholesale(row: WholesaleProduct, val: boolean | string | number) {
  row.wholesale_enabled = Boolean(val)
  ElMessage.success(
    `${row.name} 已${row.wholesale_enabled ? '开启' : '关闭'}批发`,
  )
}

function handleCreate() {
  router.push({ path: '/product/create', query: { channel: 'wholesale' } })
}
function handleEdit(row: WholesaleProduct) {
  router.push({
    path: '/product/edit',
    query: { id: row.id, channel: 'wholesale' },
  })
}
function handleSku(row: WholesaleProduct) {
  ElMessage.info(`SKU 配置：${row.name}`)
}
function handleAuthorize(row: WholesaleProduct) {
  ElMessage.info(`设置可批发等级：${row.name}`)
}
async function handleStopWholesale(row: WholesaleProduct) {
  try {
    await ElMessageBox.confirm(
      `确定停止「${row.name}」的批发供货吗？所有等级的分销商将无法下单。`,
      '停批确认',
      { type: 'warning' },
    )
    row.wholesale_enabled = false
    ElMessage.success('已停止批发')
  } catch {
    /* 取消 */
  }
}

/* ===================== 阶梯价抽屉 ===================== */

const tierDrawerVisible = ref(false)
const currentSku = ref<SkuInfo | null>(null)
const currentTiers = ref<PriceTier[]>([])
const currentRowId = ref<string>('')

function openPriceTier(row: WholesaleProduct) {
  if (!row.wholesale_enabled) {
    ElMessage.warning('该商品未开启批发，无法配置阶梯价')
    return
  }
  currentSku.value = {
    sku_id: row.code,
    sku_name: row.name,
    image: row.image,
    retail_price: row.retail_price_ref,
  }
  currentTiers.value = [...row.tiers]
  currentRowId.value = row.id
  tierDrawerVisible.value = true
}

function handleTierSave(payload: { sku_id: string; tiers: PriceTier[] }) {
  const row = products.value.find((p) => p.id === currentRowId.value)
  if (row) {
    row.tiers = payload.tiers
    row.tier_count = payload.tiers.length
    const prices = payload.tiers
      .map((t) => Number(t.price ?? 0))
      .filter((n) => n > 0)
    if (prices.length) {
      row.tier_min_price = Math.min(...prices)
      row.tier_max_price = Math.max(...prices)
    }
    const firstMin = payload.tiers[0]?.min_qty
    if (typeof firstMin === 'number' && firstMin > 0) {
      row.min_wholesale_qty = firstMin
    }
  }
  console.log('[v0] 保存阶梯价', payload)
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
  <div class="wholesale-product">
    <!-- 顶部统计 -->
    <div class="stat-row">
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">批发 SKU 总数</div>
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-sub">含未开启批发的商品</div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">已开启批发</div>
        <div class="stat-value success">{{ stats.enabled }}</div>
        <div class="stat-sub">
          占比 {{ Math.round((stats.enabled / Math.max(stats.total, 1)) * 100) }}%
        </div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">关联分销商</div>
        <div class="stat-value primary">{{ stats.dealers }}</div>
        <div class="stat-sub">最多覆盖分销商数</div>
      </el-card>
      <el-card shadow="never" class="stat-card">
        <div class="stat-label">近 30 天批发额</div>
        <div class="stat-value danger">
          ¥ {{ stats.sales30d.toLocaleString() }}
        </div>
        <div class="stat-sub">全渠道批发合计</div>
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
            新增批发商品
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

        <el-table-column label="分类 / 工艺" width="130">
          <template #default="{ row }">
            <el-tag size="small" type="info" effect="plain">{{ row.category }}</el-tag>
            <div class="craft">{{ row.craft }}</div>
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

        <el-table-column label="阶梯价" width="170">
          <template #default="{ row }">
            <template v-if="row.wholesale_enabled && row.tier_count > 0">
              <div class="tier-price">
                ¥ {{ row.tier_min_price.toFixed(0) }} -
                {{ row.tier_max_price.toFixed(0) }}
              </div>
              <div class="tier-meta">
                <el-tag size="small" type="warning" effect="plain">
                  {{ row.tier_count }} 档
                </el-tag>
                <el-button
                  link
                  type="primary"
                  size="small"
                  style="padding: 0 0 0 8px"
                  @click="openPriceTier(row)"
                >
                  查看
                </el-button>
              </div>
            </template>
            <el-button
              v-else-if="row.wholesale_enabled"
              link
              type="primary"
              size="small"
              @click="openPriceTier(row)"
            >
              配置阶梯价
            </el-button>
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

        <el-table-column label="批发开关" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.wholesale_enabled"
              inline-prompt
              active-text="开启"
              inactive-text="关闭"
              style="--el-switch-on-color: #67c23a; --el-switch-off-color: #909399"
              @update:model-value="(v) => toggleWholesale(row, v)"
            />
          </template>
        </el-table-column>

        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleSku(row)">SKU</el-button>
            <el-button link type="primary" size="small" @click="openPriceTier(row)">
              阶梯价
            </el-button>
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

    <!-- 阶梯价抽屉 -->
    <PriceTierConfig
      v-model="tierDrawerVisible"
      :sku="currentSku"
      :tiers="currentTiers"
      @save="handleTierSave"
    />
  </div>
</template>

<style scoped>
.wholesale-product {
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

.tier-price {
  font-size: 15px;
  font-weight: 700;
  color: var(--ym-danger);
}
.tier-meta {
  margin-top: 6px;
  display: flex;
  align-items: center;
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
