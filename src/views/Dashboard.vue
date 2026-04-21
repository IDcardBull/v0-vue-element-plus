<script setup lang="ts">
interface StatCard {
  label: string
  value: string
  delta: string
  tone: 'primary' | 'success' | 'warning' | 'danger'
  icon: string
}

const stats: StatCard[] = [
  { label: '今日零售订单', value: '128', delta: '+12.5%', tone: 'primary', icon: 'ShoppingCart' },
  { label: '今日批发订单', value: '23', delta: '+8.0%', tone: 'success', icon: 'Van' },
  { label: '库存预警商品', value: '17', delta: '+3', tone: 'warning', icon: 'Warning' },
  { label: '待发货订单', value: '42', delta: '-4', tone: 'danger', icon: 'Box' },
]
</script>

<template>
  <div class="dashboard">
    <el-row :gutter="16">
      <el-col v-for="s in stats" :key="s.label" :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-row">
            <div>
              <div class="stat-label">{{ s.label }}</div>
              <div class="stat-value">{{ s.value }}</div>
              <div class="stat-delta" :class="s.tone">
                较昨日 {{ s.delta }}
              </div>
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
        <el-card shadow="never" header="销售趋势（近 7 日）">
          <div class="placeholder-chart">
            <el-icon :size="48" color="#c8a96a"><DataLine /></el-icon>
            <p>此处接入销售数据图表</p>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" header="热销商品 TOP 5">
          <el-table :data="[
            { name: '青花瓷茶具套装', sales: 328 },
            { name: '羊脂玉白瓷花瓶', sales: 215 },
            { name: '粉彩盖碗·松鹤', sales: 182 },
            { name: '汝窑天青釉主人杯', sales: 156 },
            { name: '手绘青釉公道杯', sales: 134 },
          ]" size="small">
            <el-table-column prop="name" label="商品" />
            <el-table-column prop="sales" label="销量" width="80" align="right" />
          </el-table>
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
.stat-delta {
  font-size: 12px;
}
.stat-delta.primary { color: #409eff; }
.stat-delta.success { color: #67c23a; }
.stat-delta.warning { color: #e6a23c; }
.stat-delta.danger { color: #f56c6c; }

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
