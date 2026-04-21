<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import PriceTierConfig from './PriceTierConfig.vue'

const router = useRouter()

/* ===================== 类型定义 ===================== */

/** 商品分类 */
export type ProductCategory = '茶器' | '花器' | '餐具' | '酒器' | '摆件'

/** 工艺 */
export type ProductCraft = '青花瓷' | '粉彩' | '汝窑天青釉' | '羊脂玉白瓷' | '手绘青釉'

/** 商品数据结构 */
export interface Product {
  id: string
  code: string
  name: string
  image: string
  category: ProductCategory
  craft: ProductCraft
  retail_price: number
  retail_on_sale: boolean // 零售上架状态
  wholesale_enabled: boolean // 是否支持批发
  min_wholesale_qty: number // 起批量
  stock_available: number
  stock_warning: number // 预警阈值
}

/** 批发阶梯价（与 PriceTierConfig 保持一致） */
interface PriceTier {
  min_qty: number | null
  max_qty: number | null
  price: number | null
}

interface SkuInfo {
  sku_id: string
  sku_name: string
  image: string
  retail_price: number
}

/* ===================== 模拟数据 ===================== */

const mockProducts: Product[] = [
  {
    id: '1',
    code: 'YM-CHA-0001',
    name: '青花瓷手绘八宝纹茶具套装（一壶四杯）',
    image:
      'https://images.unsplash.com/photo-1563822249366-3efb23b8e0c9?w=200&q=80&auto=format&fit=crop',
    category: '茶器',
    craft: '青花瓷',
    retail_price: 688.0,
    retail_on_sale: true,
    wholesale_enabled: true,
    min_wholesale_qty: 10,
    stock_available: 156,
    stock_warning: 30,
  },
  {
    id: '2',
    code: 'YM-HUA-0012',
    name: '羊脂玉白瓷·梅兰竹菊浮雕花瓶',
    image:
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=200&q=80&auto=format&fit=crop',
    category: '花器',
    craft: '羊脂玉白瓷',
    retail_price: 1280.0,
    retail_on_sale: true,
    wholesale_enabled: true,
    min_wholesale_qty: 5,
    stock_available: 12,
    stock_warning: 20,
  },
  {
    id: '3',
    code: 'YM-CHA-0027',
    name: '汝窑天青釉·开片主人杯（单只礼盒装）',
    image:
      'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=200&q=80&auto=format&fit=crop',
    category: '茶器',
    craft: '汝窑天青釉',
    retail_price: 398.0,
    retail_on_sale: false,
    wholesale_enabled: false,
    min_wholesale_qty: 0,
    stock_available: 248,
    stock_warning: 50,
  },
]

/* ===================== 筛选 & 分页 ===================== */

const filter = reactive({
  keyword: '',
  category: '' as ProductCategory | '',
  retail: '' as '' | 'on' | 'off',
  wholesale: '' as '' | 'on' | 'off',
})

const categoryOptions: ProductCategory[] = ['茶器', '花器', '餐具', '酒器', '摆件']

const page = reactive({ current: 1, size: 10, total: mockProducts.length })

// 这里简单以全量模拟数据做客户端筛选
const products = ref<Product[]>([...mockProducts])

const filteredList = computed(() => {
  return products.value.filter((p) => {
    if (filter.keyword && !p.name.includes(filter.keyword) && !p.code.includes(filter.keyword))
      return false
    if (filter.category && p.category !== filter.category) return false
    if (filter.retail === 'on' && !p.retail_on_sale) return false
    if (filter.retail === 'off' && p.retail_on_sale) return false
    if (filter.wholesale === 'on' && !p.wholesale_enabled) return false
    if (filter.wholesale === 'off' && p.wholesale_enabled) return false
    return true
  })
})

const pagedList = computed(() => {
  const start = (page.current - 1) * page.size
  return filteredList.value.slice(start, start + page.size)
})

function handleSearch() {
  page.current = 1
  page.total = filteredList.value.length
  ElMessage.success(`已查询，共 ${filteredList.value.length} 条结果`)
}

function handleReset() {
  filter.keyword = ''
  filter.category = ''
  filter.retail = ''
  filter.wholesale = ''
  page.current = 1
  page.total = products.value.length
}

/* ===================== 操作 ===================== */

function toggleRetailStatus(row: Product, val: boolean | string | number) {
  row.retail_on_sale = Boolean(val)
  ElMessage.success(`${row.name} 已${row.retail_on_sale ? '上架' : '下架'}零售`)
}

function handleCreate() {
  router.push('/product/create')
}
function handleEdit(row: Product) {
  router.push({ path: '/product/edit', query: { id: row.id } })
}
function handleSku(row: Product) {
  ElMessage.info(`SKU 配置：${row.name}`)
}
function handleStock(row: Product) {
  ElMessage.info(`调整库存：${row.name}`)
}

/* ===================== 阶梯价抽屉 ===================== */

const tierDrawerVisible = ref(false)
const currentSku = ref<SkuInfo | null>(null)
const currentTiers = ref<PriceTier[]>([])
// 保存各商品阶梯价的内存映射
const tierStore = reactive<Record<string, PriceTier[]>>({})

function openPriceTier(row: Product) {
  if (!row.wholesale_enabled) {
    ElMessage.warning('该商品未开启批发，无法配置阶梯价')
    return
  }
  currentSku.value = {
    sku_id: row.code,
    sku_name: row.name,
    image: row.image,
    retail_price: row.retail_price,
  }
  currentTiers.value = tierStore[row.code] ?? []
  tierDrawerVisible.value = true
}

function handleTierSave(payload: { sku_id: string; tiers: PriceTier[] }) {
  tierStore[payload.sku_id] = payload.tiers
  console.log('[v0] 保存阶梯价', payload)
}
</script>

<template>
  <div class="product-list">
    <!-- 顶部筛选 -->
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
            <el-option
              v-for="c in categoryOptions"
              :key="c"
              :label="c"
              :value="c"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="零售状态">
          <el-select v-model="filter.retail" placeholder="全部" clearable style="width: 120px">
            <el-option label="上架" value="on" />
            <el-option label="下架" value="off" />
          </el-select>
        </el-form-item>
        <el-form-item label="批发状态">
          <el-select v-model="filter.wholesale" placeholder="全部" clearable style="width: 120px">
            <el-option label="开启" value="on" />
            <el-option label="关闭" value="off" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="'Search'" @click="handleSearch">查询</el-button>
          <el-button :icon="'RefreshLeft'" @click="handleReset">重置</el-button>
        </el-form-item>
        <el-form-item class="form-item-right">
          <el-button type="success" :icon="'Plus'" @click="handleCreate">新增商品</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 数据表格 -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="pagedList"
        border
        stripe
        style="width: 100%"
        :header-cell-style="{ background: '#fafbfc', color: '#303133', fontWeight: 600 }"
      >
        <el-table-column label="商品主图" width="92" align="center">
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
            <span class="slash">/</span>
            <span class="craft">{{ row.craft }}</span>
          </template>
        </el-table-column>

        <el-table-column label="零售价 / 状态" width="150">
          <template #default="{ row }">
            <div class="price">¥ {{ row.retail_price.toFixed(2) }}</div>
            <div class="switch-row">
              <el-switch
                :model-value="row.retail_on_sale"
                inline-prompt
                active-text="上架"
                inactive-text="下架"
                style="--el-switch-on-color: #67c23a; --el-switch-off-color: #909399"
                @update:model-value="(v) => toggleRetailStatus(row, v)"
              />
            </div>
          </template>
        </el-table-column>

        <el-table-column label="批发" width="130">
          <template #default="{ row }">
            <template v-if="row.wholesale_enabled">
              <el-tag size="small" type="success">支持批发</el-tag>
              <div class="min-qty">起批量：{{ row.min_wholesale_qty }} 件</div>
            </template>
            <el-tag v-else size="small" type="info" effect="plain">仅零售</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="可用库存" width="100" align="right">
          <template #default="{ row }">
            <span
              class="stock"
              :class="{ warning: row.stock_available < row.stock_warning }"
            >
              {{ row.stock_available }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="handleSku(row)">
              SKU 配置
            </el-button>
            <el-button link type="primary" size="small" @click="openPriceTier(row)">
              价格阶梯
            </el-button>
            <el-button link type="primary" size="small" @click="handleStock(row)">
              调整库存
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
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

    <!-- 批发阶梯价配置抽屉 -->
    <PriceTierConfig
      v-model="tierDrawerVisible"
      :sku="currentSku"
      :tiers="currentTiers"
      @save="handleTierSave"
    />
  </div>
</template>

<style scoped>
.product-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.table-card :deep(.el-table) {
  border-radius: 4px 4px 0 0;
}

.product-img {
  width: 56px;
  height: 56px;
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

.slash {
  color: #c0c4cc;
  margin: 0 6px;
}
.craft {
  color: var(--ym-text-secondary);
}

.price {
  font-size: 15px;
  color: var(--ym-danger);
  font-weight: 600;
}
.switch-row {
  margin-top: 6px;
}

.min-qty {
  margin-top: 4px;
  font-size: 12px;
  color: var(--ym-text-secondary);
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
