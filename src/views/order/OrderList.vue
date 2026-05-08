<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
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

const logisticsCompanyOptions = [
  { label: '顺丰速运', value: '顺丰速运' },
  { label: '中通快递', value: '中通快递' },
  { label: '圆通速递', value: '圆通速递' },
  { label: '申通快递', value: '申通快递' },
  { label: '韵达速递', value: '韵达速递' },
  { label: '京东物流', value: '京东物流' },
  { label: '德邦快递', value: '德邦快递' },
]

const route = useRoute()
const pageChannel = computed<'' | 'retail' | 'wholesale'>(() => {
  if (route.path.includes('/order/wholesale')) return 'wholesale'
  if (route.path.includes('/order/retail')) return 'retail'
  return ''
})
const pageTitle = computed(() => (pageChannel.value === 'wholesale' ? '批发订单' : '零售订单'))

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
  source: string
  source_label: string
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
function getOrderStatusMeta(row: Order) {
  if (row.channel === 'wholesale' && row.status === 'pending_pay') {
    return { label: '待客服确认', type: 'warning' as const }
  }
  return statusMeta[row.status as OrderStatus]
}

const channelMeta: Record<OrderChannel, { label: string; color: string }> = {
  retail: { label: '零售', color: '#2d8cf0' },
  wholesale: { label: '批发', color: '#c8a96a' },
  live: { label: '直播', color: '#e6a23c' },
  offline: { label: '线下', color: '#909399' },
}

const sourceMeta: Record<string, { label: string; type: 'primary' | 'success' | 'warning' | 'info' }> = {
  miniprogram_a: { label: '小程序A', type: 'primary' },
  miniprogram_b: { label: '小程序B', type: 'warning' },
  miniprogram: { label: '小程序A', type: 'primary' },
  h5: { label: '批发H5', type: 'success' },
  admin: { label: '后台', type: 'info' },
  b2b: { label: '小程序B', type: 'warning' },
}

function getSourceMeta(source: string, channel?: OrderChannel) {
  if (sourceMeta[source]) return sourceMeta[source]
  return channel === 'wholesale'
    ? { label: '小程序B', type: 'warning' as const }
    : { label: '小程序A', type: 'primary' as const }
}

/* --------------------------------- 筛选条件 -------------------------------- */
const filters = reactive({
  keyword: '',
  channel: '' as '' | OrderChannel,
  dateRange: [] as string[],
  province: '',
})

const allOrders = ref<Order[]>([])
const loadError = ref('')
const isPolling = ref(true)
let loadSeq = 0
let pollingTimer: ReturnType<typeof setInterval> | null = null

function normalizeProvince(value: string) {
  const province = (value || '').trim()
  if (!province) return ''
  return province
    .replace(/省$/u, '')
    .replace(/市$/u, '')
    .replace(/壮族自治区$/u, '')
    .replace(/回族自治区$/u, '')
    .replace(/维吾尔自治区$/u, '')
    .replace(/自治区$/u, '')
    .replace(/特别行政区$/u, '')
}

function mapOrderStatus(s: any): OrderStatus {
  const m: Record<string, OrderStatus> = {
    pending_payment: 'pending_pay',
    pending_pay: 'pending_pay',
    paid: 'pending_ship',
    pending_ship: 'pending_ship',
    shipped: 'shipped',
    completed: 'completed',
    after_sale: 'refund',
    refund: 'refund',
    refunding: 'refund',
    refunded: 'refund',
    closed: 'closed',
    cancelled: 'closed',
  }
  return m[String(s)] || 'pending_pay'
}

async function loadOrders() {
  const seq = ++loadSeq
  const currentChannel = pageChannel.value
  loadError.value = ''
  try {
    const res: any = await orderApi.list({ page: 1, pageSize: 100, channel: currentChannel || undefined })
    if (seq !== loadSeq) return
    const rows = (res?.list ?? []) as any[]
    allOrders.value = rows
      .filter((r: any) => !currentChannel || r.channel === currentChannel)
      .map((r: any): Order => {
      const channel = (r.channel || pageChannel.value || 'retail') as OrderChannel
      const source = r.source || (channel === 'wholesale' ? 'miniprogram_b' : 'miniprogram_a')
      const sourceInfo = getSourceMeta(source, channel)
      return {
        id: String(r.id),
        order_no: r.orderNo || r.code || '',
        channel,
        status: mapOrderStatus(r.status),
        buyer: r.customerName || r.receiverSnapshot?.receiver || r.address?.receiver || r.user?.realName || r.user?.nickname || r.buyer || '',
        buyer_phone: r.customerPhone || r.receiverSnapshot?.phone || r.address?.phone || r.user?.phone || r.buyer_phone || '',
        province: normalizeProvince(r.province || r.receiverSnapshot?.province || r.address?.province || r.shippingAddress?.province || ''),
        total: Number(r.totalAmount ?? r.amount ?? r.total ?? 0),
        paid: Number(r.paidAmount ?? r.paid ?? 0),
        pay_method: r.payMethod || r.pay_method || '--',
        created_at: r.createdAt || r.created_at || '',
        source,
        source_label: sourceInfo.label,
        items: (r.items || []).map((it: any) => ({
          sku_id: String(it.skuId ?? it.sku_id ?? it.id ?? ''),
          name: it.productName || it.name || '',
          spec: it.spec || it.skuSpecs || '',
          price: Number(it.price ?? 0),
          qty: Number(it.qty ?? it.quantity ?? 1),
          image: it.image || it.cover || '/placeholder.svg?height=56&width=56',
        })),
        logistics: r.logistics || (r.shippingCompany ? {
          company: r.shippingCompany,
          tracking_no: r.trackingNo || '',
        } : undefined),
      }
    })
  } catch (e: any) {
    if (seq !== loadSeq) return
    loadError.value = e?.message || '后端服务不可用'
    allOrders.value = []
  }
}

onMounted(() => {
  loadOrders()
  pollingTimer = setInterval(() => {
    if (!isPolling.value) return
    loadOrders()
  }, 10000)
})

watch(pageChannel, () => {
  activeTab.value = 'all'
  filters.keyword = ''
  filters.channel = ''
  filters.province = ''
  filters.dateRange = []
  page.current = 1
  allOrders.value = []
  loadOrders()
})

onUnmounted(() => {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
})

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
  if (filters.dateRange?.length === 2) {
    const start = new Date(filters.dateRange[0]).getTime()
    const end = new Date(filters.dateRange[1]).getTime() + 24 * 60 * 60 * 1000 - 1
    if (!Number.isNaN(start) && !Number.isNaN(end)) {
      list = list.filter((o) => {
        const ts = new Date(o.created_at).getTime()
        return !Number.isNaN(ts) && ts >= start && ts <= end
      })
    }
  }
  return list
})

const provinceOptions = computed(() =>
  Array.from(
    new Set(
      allOrders.value
        .map((o) => normalizeProvince(o.province))
        .filter(Boolean),
    ),
  )
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((p) => ({
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
function handleSearch() {
  page.current = 1
  loadOrders()
}

function resetFilters() {
  filters.keyword = ''
  filters.channel = ''
  filters.province = ''
  filters.dateRange = []
  page.current = 1
  loadOrders()
}

// ─── 发货弹窗 ─────────────────────────────────────────
// 之前用 ElMessageBox + h(ElInput, ...) 的写法，但 ElMessageBox 渲染的内容不在
// 当前组件子树，resolveComponent 拿不到正确实例，导致用户截图里"输入框无法输入"。
// 改成 reactive 状态 + 模板内的 <el-dialog>，按钮用普通 <el-input>/<el-select>。
const shipVisible = ref(false)
const shipSubmitting = ref(false)
const shipForm = reactive({
  orderId: 0 as number,
  orderNo: '',
  logisticsCompany: '顺丰速运',
  logisticsNo: '',
})
const shipFormRef = ref<any>(null)
const shipRules = {
  logisticsCompany: [{ required: true, message: '请选择物流公司', trigger: 'change' }],
  logisticsNo: [
    { required: true, message: '请输入物流单号', trigger: 'blur' },
    {
      validator: (_rule: unknown, val: string, cb: (e?: Error) => void) => {
        if (!val) return cb()
        if (!/^[A-Za-z0-9-]{6,30}$/u.test(val.trim())) return cb(new Error('单号 6-30 位字母/数字'))
        cb()
      },
      trigger: 'blur',
    },
  ],
}

function handleShip(order: Order) {
  shipForm.orderId = Number(order.id)
  shipForm.orderNo = order.order_no
  shipForm.logisticsCompany = '顺丰速运'
  shipForm.logisticsNo = ''
  shipVisible.value = true
  // 等 dialog 渲染完再 clearValidate，避免上次的红字残留
  setTimeout(() => shipFormRef.value?.clearValidate?.(), 50)
}

async function submitShip() {
  // 先做手动校验，element-plus 的 validate 不抛会进 catch
  let valid = false
  try {
    await shipFormRef.value?.validate?.()
    valid = true
  } catch {
    valid = false
  }
  if (!valid) return

  shipSubmitting.value = true
  try {
    await orderApi.ship(shipForm.orderId, {
      logisticsCompany: shipForm.logisticsCompany,
      logisticsNo: shipForm.logisticsNo.trim(),
    })
    ElMessage.success('已发货，物流轨迹将自动同步')
    shipVisible.value = false
    await loadOrders()
  } catch (error: any) {
    ElMessage.error(error?.message || '发货失败')
  } finally {
    shipSubmitting.value = false
  }
}

function copyOrderNo(no: string) {
  navigator.clipboard?.writeText(no)
  ElMessage.success('订单号已复制')
}

async function handleMarkPaid(order: Order) {
  try {
    await ElMessageBox.confirm(
      `确认将订单 ${order.order_no} 标记为已付款？此操作通常用于线下汇款 / 对公转账场景。`,
      '标记已付款',
      { type: 'warning', confirmButtonText: '确认标记', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await orderApi.markPaid(Number(order.id))
    ElMessage.success('已标记为已付款，订单进入待发货')
    await loadOrders()
  } catch (e: any) {
    ElMessage.error(e?.message || '标记失败')
  }
}

async function handleClose(order: Order) {
  try {
    const { value: reason } = await ElMessageBox.prompt(
      `确认关闭订单 ${order.order_no}？`,
      '关闭订单',
      {
        type: 'warning',
        confirmButtonText: '确认关闭',
        cancelButtonText: '取消',
        inputPlaceholder: '关闭原因（可选）',
      },
    )
    await orderApi.close(Number(order.id), reason)
    ElMessage.success('订单已关闭')
    await loadOrders()
  } catch (e: any) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e?.message || '关闭失败')
  }
}

const detailVisible = ref(false)
const detailOrder = ref<Order | null>(null)
const logisticsVisible = ref(false)
const logisticsLoading = ref(false)
const logisticsInfo = ref<any>(null)

function viewDetail(order: Order) {
  detailOrder.value = order
  detailVisible.value = true
}

async function viewLogistics(order: Order) {
  logisticsVisible.value = true
  logisticsLoading.value = true
  logisticsInfo.value = {
    company: order.logistics?.company || '',
    trackingNo: order.logistics?.tracking_no || '',
    traces: [],
  }
  try {
    logisticsInfo.value = await orderApi.logistics(Number(order.id))
  } catch (error: any) {
    ElMessage.error(error?.message || '获取物流信息失败')
  } finally {
    logisticsLoading.value = false
  }
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

function exportData() {
  const rows = filteredOrders.value.map((o) => [
    o.order_no,
    o.created_at,
    channelMeta[o.channel]?.label || o.channel,
    o.source_label,
    statusMeta[o.status]?.label || o.status,
    o.buyer,
    o.buyer_phone,
    o.province,
    o.total,
    o.paid,
    o.pay_method,
    o.items.map((it) => `${it.name}(${it.spec}) x${it.qty}`).join('；'),
  ])
  downloadCsv(
    `${pageTitle.value}-${new Date().toISOString().slice(0, 10)}.csv`,
    ['订单号', '下单时间', '渠道', '来源', '状态', '客户', '手机号', '省份', '订单金额', '实收金额', '支付方式', '商品明细'],
    rows,
  )
  ElMessage.success(`已导出 ${rows.length} 条订单`) 
}
</script>

<template>
  <div class="order-list-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="page-subtitle">{{ pageChannel === 'wholesale' ? '小程序B / 批发渠道订单独立管理' : '小程序A / 零售渠道订单独立管理' }}</p>
      </div>
      <div class="page-actions">
        <el-switch v-model="isPolling" inline-prompt active-text="自动刷新" inactive-text="已暂停" />
      </div>
    </div>
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadOrders">点击重试</el-button>
      </template>
    </el-alert>
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
        <el-form-item v-if="!pageChannel" label="下单渠道">
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
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
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
                color: channelMeta[row.channel as OrderChannel]?.color,
                borderColor: channelMeta[row.channel as OrderChannel]?.color,
              }"
            >
              {{ channelMeta[row.channel as OrderChannel]?.label || row.channel }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="来源" width="110" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getSourceMeta(row.source, row.channel).type" effect="light">
              {{ row.source_label }}
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
            <el-tag :type="getOrderStatusMeta(row).type" effect="light">
              {{ getOrderStatusMeta(row).label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="viewDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'pending_pay'"
              type="success"
              link
              :icon="Money"
              @click="handleMarkPaid(row)"
            >标记已付</el-button>
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
              @click="handleClose(row)"
            >关闭</el-button>
            <el-button
              v-if="row.status === 'shipped' || row.status === 'completed'"
              type="primary"
              link
              @click="viewLogistics(row)"
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

    <!-- 发货弹窗：填快递公司 + 物流单号 → 触发后端订阅快递100 -->
    <el-dialog
      v-model="shipVisible"
      :title="shipForm.orderNo ? `订单发货：${shipForm.orderNo}` : '订单发货'"
      width="520px"
      :close-on-click-modal="false"
      append-to-body
    >
      <el-form
        ref="shipFormRef"
        :model="shipForm"
        :rules="shipRules"
        label-width="96px"
        label-position="right"
      >
        <el-form-item label="物流公司" prop="logisticsCompany">
          <el-select
            v-model="shipForm.logisticsCompany"
            placeholder="请选择物流公司"
            filterable
            allow-create
            default-first-option
            style="width: 100%"
          >
            <el-option
              v-for="item in logisticsCompanyOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="物流单号" prop="logisticsNo">
          <el-input
            v-model="shipForm.logisticsNo"
            placeholder="请输入快递单号（6-30 位）"
            clearable
            maxlength="30"
            @keyup.enter="submitShip"
          />
        </el-form-item>
        <div class="ship-tip">
          发货后小程序会推送订阅消息提醒买家；快递100 将自动同步轨迹直至签收
        </div>
      </el-form>
      <template #footer>
        <el-button @click="shipVisible = false">取消</el-button>
        <el-button type="primary" :loading="shipSubmitting" @click="submitShip">
          确认发货
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logisticsVisible" title="物流信息" width="520px">
      <div v-loading="logisticsLoading" class="logistics-panel">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="物流公司">
            {{ logisticsInfo?.company || '--' }}
          </el-descriptions-item>
          <el-descriptions-item label="物流单号">
            {{ logisticsInfo?.trackingNo || '--' }}
          </el-descriptions-item>
          <el-descriptions-item label="查询状态">
            {{ logisticsInfo?.message || (logisticsInfo?.supported ? '查询成功' : '暂无轨迹') }}
          </el-descriptions-item>
        </el-descriptions>
        <el-timeline v-if="logisticsInfo?.traces?.length" class="logistics-timeline">
          <el-timeline-item
            v-for="(trace, index) in logisticsInfo.traces"
            :key="index"
            :timestamp="trace.time || trace.acceptTime || ''"
          >
            {{ trace.context || trace.desc || trace.status || trace }}
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无物流轨迹" />
      </div>
    </el-dialog>

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
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2d3d;
}
.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}
.page-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ship-tip {
  margin-top: 4px;
  padding: 10px 12px;
  font-size: 12px;
  line-height: 1.6;
  color: #606266;
  background: #f6f7fa;
  border-radius: 6px;
}
.logistics-panel {
  min-height: 180px;
}
.logistics-timeline {
  margin-top: 18px;
}

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
