<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { fetchOverview, fetchTopProducts } from '@/api/dashboard'

interface StatCard {
  label: string
  value: string | number
  tone: 'primary' | 'success' | 'warning' | 'danger'
  icon: string
}

const stats = ref<StatCard[]>([
  { label: '今日订单数', value: '-', tone: 'primary', icon: 'ShoppingCart' },
  { label: '今日支付金额', value: '-', tone: 'success', icon: 'Money' },
  { label: '库存预警 SKU', value: '-', tone: 'warning', icon: 'Warning' },
  { label: '待发货订单', value: '-', tone: 'danger', icon: 'Box' },
])

const topProducts = ref<Array<{ name: string; quantity: number; amount: number }>>([])
const loading = ref(true)
const errorMsg = ref('')

function formatMoney(n: number) {
  return '¥' + Math.round(n).toLocaleString('zh-CN')
}

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [overview, top] = await Promise.all([fetchOverview(), fetchTopProducts(5)])
    stats.value = [
      { label: '今日订单数', value: overview.todayOrderCount ?? 0, tone: 'primary', icon: 'ShoppingCart' },
      { label: '今日支付金额', value: formatMoney(overview.todayOrderAmount ?? 0), tone: 'success', icon: 'Money' },
      { label: '库存预警 SKU', value: overview.lowStockCount ?? 0, tone: 'warning', icon: 'Warning' },
      { label: '待发货订单', value: overview.pendingShipCount ?? 0, tone: 'danger', icon: 'Box' },
    ]
    topProducts.value = Array.isArray(top) ? top : []
  } catch (e: any) {
    errorMsg.value = e?.message || '后端服务不可用，请检查 NestJS 是否已启动'
    stats.value = [
      { label: '今日订单数', value: 0, tone: 'primary', icon: 'ShoppingCart' },
      { label: '今日支付金额', value: formatMoney(0), tone: 'success', icon: 'Money' },
      { label: '库存预警 SKU', value: 0, tone: 'warning', icon: 'Warning' },
      { label: '待发货订单', value: 0, tone: 'danger', icon: 'Box' },
    ]
    topProducts.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
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
        <el-card shadow="never" header="销售趋势（近 30 日）">
          <div class="placeholder-chart">
            <el-icon :size="48" color="#c8a96a"><DataLine /></el-icon>
            <p>可接入 ECharts 展示 /admin/dashboard/sales-trend</p>
          </div>
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
  gap: 16px;
}
.err-alert {
  margin-bottom: 4px;
}
.mt-16 {
  margin-top: 16px;
}

.stat-card :deep(.el-card__body) {
  padding: 18px 20px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-label {
  font-size: 13px;
  color: var(--ym-text-secondary);
}
.stat-value {
  font-size: 26px;
  font-weight: 600;
  color: var(--ym-primary);
  margin: 6px 0 4px;
  line-height: 1.2;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.stat-icon.primary { background: #ecf5ff; color: #409eff; }
.stat-icon.success { background: #f0f9eb; color: #67c23a; }
.stat-icon.warning { background: #fdf6ec; color: #e6a23c; }
.stat-icon.danger  { background: #fef0f0; color: #f56c6c; }

.placeholder-chart {
  height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--ym-text-secondary);
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  border-radius: 6px;
}
</style>
