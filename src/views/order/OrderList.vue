<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '@/api/order'
import {
  Search,
  Refresh,
  Download,
  Van,
  View,
  CopyDocument,
  Money,
  Files,
} from '@element-plus/icons-vue'

/* ----------------------------------- 类型 ---------------------------------- */
type OrderChannel = 'retail' | 'wholesale' | 'live' | 'offline'
type OrderStatus =
  | 'pending_pay' // 待付款
  | 'pending_ship' // 待发货
  | 'shipped' // 已发货
  | 'completed' // 已完成
  | 'refund' // 售后
  | 'closed' // 已关闭

interface OrderItem {
  sku_id: string
  name: string
  spec: string
  price: number
  qty: number
  image: string
}
interface Order {
  id: string
  order_no: string
  channel: OrderChannel
  status: OrderStatus
  buyer: string
  buyer_phone: string
  province: string
  total: number
  paid: number
  pay_method: string
  created_at: string
  items: OrderItem[]
  logistics?: { company: string; tracking_no: string }
}

/* --------------------------------- 状态配置 -------------------------------- */
const statusTabs: { key: OrderStatus | 'all'; label: string; count: number }[] = [
  { key: 'all', label: '全部', count: 0 },
  { key: 'pending_pay', label: '待付款', count: 0 },
  { key: 'pending_ship', label: '待发货', count: 0 },
  { key: 'shipped', label: '已发货', count: 0 },
  { key: 'completed', label: '已完成', count: 0 },
  { key: 'refund', label: '售后', count: 0 },
  { key: 'closed', label: '已关闭', count: 0 },
]
const tabs = ref(statusTabs)
const activeTab = ref<OrderStatus | 'all'>('all')

const statusMeta: Record<OrderStatus, { label: string; type: 'info' | 'warning' | 'success' | 'danger' | 'primary' }> = {
  pending_pay: { label: '待付款', type: 'warning' },
  pending_ship: { label: '待发货', type: 'primary' },
  shipped: { label: '已发货', type: 'info' },
  completed: { label: '已完成', type: 'success' },
  refund: { label: '售后中', type: 'danger' },
  closed: { label: '已关闭', type: 'info' },
}
const channelMeta: Record<OrderChannel, { label: string; color: string }> = {
  retail: { label: '零售', color: '#2d8cf0' },
  wholesale: { label: '批发', color: '#c8a96a' },
  live: { label: '直播', color: '#e6a23c' },
  offline: { label: '线下', color: '#909399' },
}

/* --------------------------------- 筛选条件 -------------------------------- */
const filters = reactive({
  keyword: '',
  channel: '' as '' | OrderChannel,
  dateRange: [] as string[],
  province: '',
})

/* --------------------------------- 模拟数据 -------------------------------- */
const allOrders = ref<Order[]>([
  {
    id: 'o-1',
    order_no: 'YM20260418001',
    channel: 'retail',
    status: 'pending_pay',
    buyer: '王雅婷',
    buyer_phone: '138****2345',
    province: '浙江',
    total: 1280,
    paid: 0,
    pay_method: '待选择',
    created_at: '2026-04-18 14:22',
    items: [
      {
        sku_id: 'sku-1',
        name: '青花缠枝莲茶具套装',
        spec: '标准款',
        price: 1280,
        qty: 1,
        image: '/placeholder.svg?height=56&width=56',
      },
    ],
  },
  {
    id: 'o-2',
    order_no: 'YM20260418002',
    channel: 'wholesale',
    status: 'pending_ship',
    buyer: '杭州茗茶行',
    buyer_phone: '139****6789',
    province: '浙江',
    total: 15600,
    paid: 15600,
    pay_method: '对公转账',
    created_at: '2026-04-18 10:08',
    items: [
      {
        sku_id: 'sku-2',
        name: '羊脂玉长颈花瓶',
        spec: '36cm 高',
        price: 520,
        qty: 20,
        image: '/placeholder.svg?height=56&width=56',
      },
      {
        sku_id: 'sku-3',
        name: '汝窑天青主人杯',
        spec: '120ml',
        price: 280,
        qty: 20,
        image: '/placeholder.svg?height=56&width=56',
      },
    ],
  },
  {
    id: 'o-3',
    order_no: 'YM20260417008',
    channel: 'live',
    status: 'shipped',
    buyer: '陈先生',
    buyer_phone: '136****8888',
    province: '广东',
    total: 480,
    paid: 480,
    pay_method: '微信支付',
    created_at: '2026-04-17 20:45',
    items: [
      {
        sku_id: 'sku-4',
        name: '青瓷莲花碗',
        spec: '礼盒装',
        price: 480,
        qty: 1,
        image: '/placeholder.svg?height=56&width=56',
      },
    ],
    logistics: { company: '顺丰速运', tracking_no: 'SF1234567890' },
  },
  {
    id: 'o-4',
    order_no: 'YM20260417003',
    channel: 'retail',
    status: 'completed',
    buyer: '李美玲',
    buyer_phone: '137****5566',
    province: '江苏',
    total: 896,
    paid: 896,
    pay_method: '支付宝',
    created_at: '2026-04-17 11:30',
    items: [
      {
        sku_id: 'sku-5',
        name: '粉彩仕女盖碗',
        spec: '150ml',
        price: 448,
        qty: 2,
        image: '/placeholder.svg?height=56&width=56',
      },
    ],
    logistics: { company: '京东物流', tracking_no: 'JD5566778899' },
  },
  {
    id: 'o-5',
    order_no: 'YM20260416012',
    channel: 'wholesale',
    status: 'refund',
    buyer: '北京瓷器商行',
    buyer_phone: '135****9999',
    province: '北京',
    total: 9600,
    paid: 9600,
    pay_method: '对公转账',
    created_at: '2026-04-16 15:12',
    items: [
      {
        sku_id: 'sku-6',
        name: '结晶釉观音瓶',
        spec: '大号',
        price: 960,
        qty: 10,
        image: '/placeholder.svg?height=56&width=56',
      },
    ],
  },
  {
    id: 'o-6',
    order_no: 'YM20260415006',
    channel: 'offline',
    status: 'closed',
    buyer: '散客',
    buyer_phone: '--',
    province: '江西',
    total: 380,
    paid: 0,
    pay_method: '--',
    created_at: '2026-04-15 16:00',
    items: [
      {
        sku_id: 'sku-7',
        name: '青花小茶壶',
        spec: '200ml',
        price: 380,
        qty: 1,
        image: '/placeholder.svg?height=56&width=56',
      },
    ],
  },
])

async function loadOrders() {
  try {
    const res: any = await orderApi.list({ page: 1, pageSize: 100 })
    const rows = (res?.list ?? []) as any[]
    if (rows.length) {
      allOrders.value = rows.map((r: any) => ({
        id: String(r.id),
        order_no: r.orderNo || r.code || '',
        status: r.status || 'pending_payment',
        channel: r.channel || 'retail',
        customer_name: r.customerName || r.user?.realName || r.user?.nickname || '',
        customer_phone: r.customerPhone || r.user?.phone || '',
        province: r.province || r.shippingAddress?.province || '',
        city: r.city || r.shippingAddress?.city || '',
        amount: Number(r.totalAmount ?? r.amount ?? 0),
        paid_amount: Number(r.paidAmount ?? 0),
        created_at: r.createdAt || r.created_at || '',
        items: r.items?.map((it: any) => ({
          name: it.productName || it.name || '',
          spec: it.spec || it.skuSpecs || '',
          price: Number(it.price ?? 0),
          qty: Number(it.qty ?? 1),
          image: it.image || it.cover || '/placeholder.svg?height=56&width=56',
        })) || [],
      })) as any
    }
  } catch {
    // 保留 mock
  }
}

onMounted(loadOrders)

// 计算各状态数量
const tabWithCount = computed(() =>
  tabs.value.map((t) => ({
    ...t,
    count:
      t.key === 'all'
        ? allOrders.value.length
        : allOrders.value.filter((o) => o.status === t.key).length,
  })),
)

/* --------------------------------- 过滤计算 -------------------------------- */
const filteredOrders = computed(() => {
  let list = allOrders.value
  if (activeTab.value !== 'all') {
    list = list.filter((o) => o.status === activeTab.value)
  }
  if (filters.keyword.trim()) {
    const kw = filters.keyword.trim().toLowerCase()
    list = list.filter(
      (o) =>
        o.order_no.toLowerCase().includes(kw) ||
        o.buyer.toLowerCase().includes(kw) ||
        o.items.some((it) => it.name.toLowerCase().includes(kw)),
    )
  }
  if (filters.channel) {
    list = list.filter((o) => o.channel === filters.channel)
  }
  if (filters.province) {
    list = list.filter((o) => o.province === filters.province)
  }
  return list
})

const provinceOptions = computed(() =>
  Array.from(new Set(allOrders.value.map((o) => o.province))).map((p) => ({
    value: p,
    label: p,
  })),
)

/* --------------------------------- 分页状态 -------------------------------- */
const page = reactive({ current: 1, size: 10, total: 0 })
const pagedOrders = computed(() => {
  page.total = filteredOrders.value.length
  const start = (page.current - 1) * page.size
  return filteredOrders.value.slice(start, start + page.size)
})

/* --------------------------------- 统计数据 -------------------------------- */
const stats = computed(() => {
  const list = filteredOrders.value
  return {
    count: list.length,
    amount: list.reduce((sum, o) => sum + o.total, 0),
    paid: list.reduce((sum, o) => sum + o.paid, 0),
  }
})

/* --------------------------------- 操作方法 -------------------------------- */
function resetFilters() {
  filters.keyword = ''
  filters.channel = ''
  filters.province = ''
  filters.dateRange = []
  page.current = 1
}

function handleShip(order: Order) {
  ElMessageBox.prompt(`请输入物流单号（订单号 ${order.order_no}）`, '发货', {
    confirmButtonText: '确认发货',
    cancelButtonText: '取消',
    inputPlaceholder: '例如：SF1234567890',
    inputPattern: /^[A-Za-z0-9]{6,}$/,
    inputErrorMessage: '请输入有效单号',
  })
    .then(({ value }) => {
      order.status = 'shipped'
      order.logistics = { company: '顺丰速运', tracking_no: value }
      ElMessage.success('已发货')
    })
    .catch(() => void 0)
}

function copyOrderNo(no: string) {
  navigator.clipboard?.writeText(no)
  ElMessage.success('订单号已复制')
}

const detailVisible = ref(false)
const detailOrder = ref<Order | null>(null)
function viewDetail(order: Order) {
  detailOrder.value = order
  detailVisible.value = true
}

function exportData() {
  ElMessage.success(`正在导出 ${stats.value.count} 条订单...`)
}
</script>

<template>
  <div class="order-list-page">
    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon blue">
          <el-icon><Files /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">订单数</div>
          <div class="stat-value">{{ stats.count }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon gold">
          <el-icon><Money /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">订单总额 (元)</div>
          <div class="stat-value">{{ stats.amount.toLocaleString() }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon><Money /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">实收金额 (元)</div>
          <div class="stat-value">{{ stats.paid.toLocaleString() }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">
          <el-icon><Van /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">待发货</div>
          <div class="stat-value">
            {{ allOrders.filter((o) => o.status === 'pending_ship').length }}
          </div>
        </div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <el-card class="filter-card" shadow="never">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="搜索">
          <el-input
            v-model="filters.keyword"
            placeholder="订单号 / 客户 / 商品"
            clearable
            style="width: 240px"
            :prefix-icon="Search"
          />
        </el-form-item>
        <el-form-item label="下单渠道">
          <el-select v-model="filters.channel" placeholder="全部渠道" clearable style="width: 140px">
            <el-option value="retail" label="零售" />
            <el-option value="wholesale" label="批发" />
            <el-option value="live" label="直播" />
            <el-option value="offline" label="线下" />
          </el-select>
        </el-form-item>
        <el-form-item label="省份">
          <el-select v-model="filters.province" placeholder="全部省份" clearable style="width: 140px">
            <el-option
              v-for="o in provinceOptions"
              :key="o.value"
              :value="o.value"
              :label="o.label"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="下单时间">
          <el-date-picker
            v-model="filters.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
          <el-button :icon="Download" @click="exportData">导出</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 状态 Tabs + 表格 -->
    <el-card class="main-card" shadow="never">
      <el-tabs v-model="activeTab" class="status-tabs">
        <el-tab-pane
          v-for="tab in tabWithCount"
          :key="tab.key"
          :name="tab.key"
        >
          <template #label>
            <span class="tab-label">
              {{ tab.label }}
              <el-badge
                v-if="tab.count > 0"
                :value="tab.count"
                :max="999"
                class="tab-badge"
                :type="activeTab === tab.key ? 'primary' : 'info'"
              />
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>

      <el-table
        :data="pagedOrders"
        stripe
        style="width: 100%"
        row-key="id"
        empty-text="暂无订单数据"
      >
        <el-table-column label="订单号 / 时间" min-width="220">
          <template #default="{ row }">
            <div class="order-no-cell">
              <div class="no-line">
                <span class="order-no">{{ row.order_no }}</span>
                <el-button
                  type="primary"
                  link
                  :icon="CopyDocument"
                  size="small"
                  @click="copyOrderNo(row.order_no)"
                />
              </div>
              <div class="sub">{{ row.created_at }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="商品信息" min-width="320">
          <template #default="{ row }">
            <div class="items-cell">
              <div
                v-for="(it, idx) in row.items.slice(0, 2)"
                :key="it.sku_id"
                class="item-line"
                :class="{ 'with-divider': idx > 0 }"
              >
                <img :src="it.image" :alt="it.name" class="item-img" />
                <div class="item-info">
                  <div class="item-name">{{ it.name }}</div>
                  <div class="item-spec">{{ it.spec }} × {{ it.qty }}</div>
                </div>
              </div>
              <div v-if="row.items.length > 2" class="items-more">
                等 {{ row.items.length }} 件商品
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="客户信息" min-width="160">
          <template #default="{ row }">
            <div class="buyer-cell">
              <div class="buyer-name">{{ row.buyer }}</div>
              <div class="sub">{{ row.buyer_phone }}</div>
              <div class="sub">{{ row.province }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="渠道" width="90" align="center">
          <template #default="{ row }">
            <el-tag
              size="small"
              effect="plain"
              :style="{
                color: channelMeta[row.channel].color,
                borderColor: channelMeta[row.channel].color,
              }"
            >
              {{ channelMeta[row.channel].label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            <div class="amount-cell">
              <div class="amount-total">¥{{ row.total.toLocaleString() }}</div>
              <div class="sub">
                实收 ¥{{ row.paid.toLocaleString() }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusMeta[row.status as OrderStatus].type" effect="light">
              {{ statusMeta[row.status as OrderStatus].label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="viewDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'pending_ship'"
              type="primary"
              link
              :icon="Van"
              @click="handleShip(row)"
            >发货</el-button>
            <el-button
              v-if="row.status === 'pending_pay'"
              type="danger"
              link
            >关闭</el-button>
            <el-button
              v-if="row.status === 'shipped' || row.status === 'completed'"
              type="primary"
              link
            >物流</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <el-pagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="page.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" size="560px" :with-header="false">
      <div v-if="detailOrder" class="order-detail">
        <div class="detail-header">
          <div>
            <div class="detail-title">订单详情</div>
            <div class="detail-no">{{ detailOrder.order_no }}</div>
          </div>
          <el-tag
            :type="statusMeta[detailOrder.status].type"
            effect="dark"
            size="large"
          >
            {{ statusMeta[detailOrder.status].label }}
          </el-tag>
        </div>

        <el-descriptions :column="2" border class="detail-section">
          <el-descriptions-item label="客户姓名">
            {{ detailOrder.buyer }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ detailOrder.buyer_phone }}
          </el-descriptions-item>
          <el-descriptions-item label="收货省份">
            {{ detailOrder.province }}
          </el-descriptions-item>
          <el-descriptions-item label="下单渠道">
            {{ channelMeta[detailOrder.channel].label }}
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">
            {{ detailOrder.created_at }}
          </el-descriptions-item>
          <el-descriptions-item label="支付方式">
            {{ detailOrder.pay_method }}
          </el-descriptions-item>
          <el-descriptions-item v-if="detailOrder.logistics" label="物流公司">
            {{ detailOrder.logistics.company }}
          </el-descriptions-item>
          <el-descriptions-item v-if="detailOrder.logistics" label="物流单号">
            {{ detailOrder.logistics.tracking_no }}
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <div class="section-title">商品清单</div>
          <div v-for="it in detailOrder.items" :key="it.sku_id" class="detail-item">
            <img :src="it.image" :alt="it.name" class="detail-img" />
            <div class="detail-item-info">
              <div class="detail-item-name">{{ it.name }}</div>
              <div class="sub">规格：{{ it.spec }}</div>
            </div>
            <div class="detail-item-price">
              <div>¥{{ it.price.toLocaleString() }}</div>
              <div class="sub">× {{ it.qty }}</div>
            </div>
          </div>
        </div>

        <div class="detail-summary">
          <div class="summary-line">
            <span>订单总额</span>
            <span>¥{{ detailOrder.total.toLocaleString() }}</span>
          </div>
          <div class="summary-line">
            <span>实收金额</span>
            <span class="highlight">¥{{ detailOrder.paid.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.order-list-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- stats ---------- */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff;
  padding: 18px 20px;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  border: 1px solid #ebeef5;
}
.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 20px;
}
.stat-icon.blue { background: #2d8cf0; }
.stat-icon.gold { background: #c8a96a; }
.stat-icon.green { background: #67c23a; }
.stat-icon.red { background: #f56c6c; }
.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: #1f2d3d;
  font-family: 'Geist Mono', 'Menlo', monospace;
}

/* ---------- filter ---------- */
.filter-card :deep(.el-card__body) {
  padding: 16px 20px 0;
}
.filter-form {
  display: flex;
  flex-wrap: wrap;
}

/* ---------- main card ---------- */
.main-card :deep(.el-card__body) {
  padding: 0 20px 20px;
}
.status-tabs {
  margin: 0 -20px;
  padding: 0 20px;
}
.status-tabs :deep(.el-tabs__header) {
  margin: 0 0 14px;
}
.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tab-badge :deep(.el-badge__content) {
  transform: scale(0.85);
  transform-origin: center;
}

/* ---------- table cells ---------- */
.order-no-cell .no-line {
  display: flex;
  align-items: center;
  gap: 4px;
}
.order-no {
  font-family: 'Geist Mono', 'Menlo', monospace;
  color: #1f2d3d;
  font-weight: 500;
}
.sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}
.items-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.item-line {
  display: flex;
  align-items: center;
  gap: 10px;
}
.item-line.with-divider {
  padding-top: 6px;
  border-top: 1px dashed #ebeef5;
}
.item-img {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  background: #f7f9fc;
  flex-shrink: 0;
}
.item-info {
  flex: 1;
  min-width: 0;
}
.item-name {
  color: #1f2d3d;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-spec {
  font-size: 12px;
  color: #606266;
  margin-top: 2px;
}
.items-more {
  font-size: 12px;
  color: #c8a96a;
}
.buyer-cell .buyer-name {
  color: #1f2d3d;
  font-weight: 500;
}
.amount-cell .amount-total {
  color: #1f2d3d;
  font-weight: 600;
  font-size: 15px;
  font-family: 'Geist Mono', 'Menlo', monospace;
}

/* ---------- footer ---------- */
.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* ---------- detail drawer ---------- */
.order-detail {
  padding: 0 4px;
}
.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 20px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 20px;
}
.detail-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
}
.detail-no {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
  font-family: 'Geist Mono', monospace;
}
.detail-section {
  margin-bottom: 24px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
  margin-bottom: 12px;
  padding-left: 10px;
  border-left: 3px solid #c8a96a;
}
.detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed #ebeef5;
}
.detail-item:last-child {
  border-bottom: none;
}
.detail-img {
  width: 56px;
  height: 56px;
  border-radius: 4px;
  object-fit: cover;
  background: #f7f9fc;
}
.detail-item-info {
  flex: 1;
  min-width: 0;
}
.detail-item-name {
  color: #1f2d3d;
  font-size: 14px;
  font-weight: 500;
}
.detail-item-price {
  text-align: right;
  font-family: 'Geist Mono', monospace;
  color: #1f2d3d;
  font-weight: 500;
}
.detail-summary {
  background: #fafbfc;
  border-radius: 4px;
  padding: 16px 20px;
}
.summary-line {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
  color: #606266;
}
.summary-line .highlight {
  color: #c8a96a;
  font-weight: 600;
  font-size: 18px;
  font-family: 'Geist Mono', monospace;
}

@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
