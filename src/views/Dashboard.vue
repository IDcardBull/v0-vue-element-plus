<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { fetchOverview, fetchTopProducts, fetchSalesTrend } from '@/api/dashboard'

interface StatCard {
  label: string
  value: string | number
  tone: 'primary' | 'success' | 'warning' | 'danger'
  icon: string
}

const stats = ref<StatCard[]>([
  { label: '今日订单数', value: '-', tone: 'primary', icon: 'ShoppingCart' },
  { label: '今日支付金额', value: '-', tone: 'success', icon: 'Money' },
  { label: '低库存 SKU', value: '-', tone: 'warning', icon: 'Warning' },
  { label: '待发货订单', value: '-', tone: 'danger', icon: 'Box' },
])

const topProducts = ref<Array<{ name: string; quantity: number; amount: number }>>([])
const trendDays = ref<7 | 30 | 90>(30)
const trendPoints = ref<Array<{ date: string; retail: number; wholesale: number }>>([])
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
const loading = ref(true)
const errorMsg = ref('')

function formatMoney(n: number) {
  return '¥' + Math.round(n).toLocaleString('zh-CN')
}

function renderTrendChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)

  const xData = trendPoints.value.map((p) => p.date.slice(5))
  const retail = trendPoints.value.map((p) => Number(p.retail || 0))
  const wholesale = trendPoints.value.map((p) => Number(p.wholesale || 0))

  chart.setOption({
    color: ['#2d8cf0', '#c8a96a'],
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number) => `¥${Math.round(Number(v || 0)).toLocaleString('zh-CN')}`,
    },
    legend: {
      data: ['零售', '批发'],
      top: 8,
      right: 12,
    },
    grid: { left: 48, right: 24, top: 64, bottom: 30 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xData,
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (v: number) => `¥${Math.round(v)}`,
      },
    },
    series: [
      {
        name: '零售',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.12 },
        data: retail,
      },
      {
        name: '批发',
        type: 'line',
        smooth: true,
        showSymbol: false,
        areaStyle: { opacity: 0.12 },
        data: wholesale,
      },
    ],
  })
}

function handleResize() {
  chart?.resize()
}

async function onTrendDaysChange() {
  try {
    await loadTrend()
  } catch (e: any) {
    errorMsg.value = e?.message || '销售趋势加载失败'
    trendPoints.value = []
    chart?.clear()
  }
}

async function loadTrend() {
  const trend = await fetchSalesTrend(trendDays.value)
  trendPoints.value = Array.isArray(trend) ? trend : []
  await nextTick()
  renderTrendChart()
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [overview, top] = await Promise.all([
      fetchOverview(),
      fetchTopProducts(5),
    ])
    stats.value = [
      { label: '今日订单数', value: overview.todayOrderCount ?? 0, tone: 'primary', icon: 'ShoppingCart' },
      { label: '今日支付金额', value: formatMoney(overview.todayOrderAmount ?? 0), tone: 'success', icon: 'Money' },
      { label: '低库存 SKU', value: overview.lowStockCount ?? 0, tone: 'warning', icon: 'Warning' },
      { label: '待发货订单', value: overview.pendingShipCount ?? 0, tone: 'danger', icon: 'Box' },
    ]
    topProducts.value = Array.isArray(top) ? top : []
    await loadTrend()
  } catch (e: any) {
    errorMsg.value = e?.message || '后端服务不可用，请检查 NestJS 是否已启动'
    stats.value = [
      { label: '今日订单数', value: 0, tone: 'primary', icon: 'ShoppingCart' },
      { label: '今日支付金额', value: formatMoney(0), tone: 'success', icon: 'Money' },
      { label: '低库存 SKU', value: 0, tone: 'warning', icon: 'Warning' },
      { label: '待发货订单', value: 0, tone: 'danger', icon: 'Box' },
    ]
    topProducts.value = []
    trendPoints.value = []
    chart?.clear()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <el-alert
      v-if="errorMsg"
      :title="errorMsg"
      type="error"
      show-icon
      :closable="false"
      class="err-alert"
    >
      <template #default>
        <div>后端服务不可用，数据无法加载。请检查 NestJS 是否运行在 :3001 并确认 MySQL 已连接。</div>
        <el-button type="danger" size="small" link @click="loadData">点击重试</el-button>
      </template>
    </el-alert>
    <el-row :gutter="16">
      <el-col v-for="s in stats" :key="s.label" :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-row">
            <div>
              <div class="stat-label">{{ s.label }}</div>
              <div class="stat-value">{{ s.value }}</div>
            </div>
            <div class="stat-icon" :class="s.tone">
              <el-icon :size="26"><component :is="s.icon" /></el-icon>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mt-16">
      <el-col :xs="24" :md="16">
        <el-card shadow="never" class="trend-card">
          <template #header>
            <div class="trend-head">
              <span>销售趋势</span>
              <el-radio-group v-model="trendDays" size="small" @change="onTrendDaysChange">
                <el-radio-button :value="7">近7日</el-radio-button>
                <el-radio-button :value="30">近30日</el-radio-button>
                <el-radio-button :value="90">近90日</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="chartRef" class="trend-chart" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" header="热销商品 TOP 5">
          <el-table :data="topProducts" size="small" :show-header="false">
            <el-table-column prop="name" label="商品" show-overflow-tooltip />
            <el-table-column prop="quantity" label="销量" width="70" align="right">
              <template #default="{ row }">{{ row.quantity }} 件</template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!topProducts.length" description="暂无销售数据" :image-size="80" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.err-alert {
  margin-bottom: 4px;
  border-radius: var(--ym-radius-md);
}
.mt-16 {
  margin-top: 18px;
}

.stat-card {
  border: none !important;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfd 100%);
  box-shadow: var(--ym-shadow-sm) !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ym-shadow-md) !important;
}
.stat-card :deep(.el-card__body) {
  padding: 20px 22px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stat-label {
  font-size: 13px;
  color: var(--ym-text-secondary);
  letter-spacing: 0.3px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--ym-primary);
  margin: 8px 0 0;
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.06);
}
.stat-icon.primary { background: linear-gradient(135deg, #5e9eff, #2d7af0); color: #fff; }
.stat-icon.success { background: linear-gradient(135deg, #4ad97e, #2bb564); color: #fff; }
.stat-icon.warning { background: linear-gradient(135deg, #ffc46a, #ff9f0a); color: #fff; }
.stat-icon.danger  { background: linear-gradient(135deg, #ff7a70, #ff453a); color: #fff; }

.trend-card :deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid var(--ym-border-light);
}

.trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
  color: var(--ym-text);
}

.trend-chart {
  height: 300px;
  width: 100%;
}
</style>
