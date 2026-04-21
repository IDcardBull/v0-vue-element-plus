<template>
  <div class="customer-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">零售客户</h2>
        <p class="page-subtitle">C 端会员管理，含消费画像、等级与标签</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Upload">导入会员</el-button>
        <el-button :icon="Download">导出</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-icon blue"><el-icon><User /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">会员总数</div>
          <div class="stat-value">{{ stats.total.toLocaleString() }}</div>
          <div class="stat-sub"><span class="up">+128</span> 本月新增</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon gold"><el-icon><Medal /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">付费会员</div>
          <div class="stat-value">{{ stats.paid.toLocaleString() }}</div>
          <div class="stat-sub">转化率 {{ stats.paidRate }}%</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><el-icon><Wallet /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">客单价</div>
          <div class="stat-value">¥{{ stats.avgOrder.toLocaleString() }}</div>
          <div class="stat-sub"><span class="up">+8.2%</span> 环比</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><el-icon><Timer /></el-icon></div>
        <div class="stat-info">
          <div class="stat-label">30 日活跃</div>
          <div class="stat-value">{{ stats.active.toLocaleString() }}</div>
          <div class="stat-sub">占比 {{ stats.activeRate }}%</div>
        </div>
      </div>
    </div>

    <!-- 筛选 -->
    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="搜索">
          <el-input v-model="filter.keyword" placeholder="昵称 / 手机号 / 会员 ID" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="会员等级">
          <el-select v-model="filter.level" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="lv in levels" :key="lv.value" :label="lv.label" :value="lv.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="性别">
          <el-radio-group v-model="filter.gender">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="male">男</el-radio-button>
            <el-radio-button value="female">女</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标签">
          <el-select v-model="filter.tag" placeholder="全部" clearable style="width: 140px">
            <el-option label="高价值" value="high-value" />
            <el-option label="活跃" value="active" />
            <el-option label="沉默" value="silent" />
            <el-option label="流失预警" value="churn" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="customers" stripe border>
        <el-table-column label="会员信息" min-width="260">
          <template #default="{ row }">
            <div class="customer-cell">
              <el-avatar :src="row.avatar" :size="44">
                {{ row.nickname.charAt(0) }}
              </el-avatar>
              <div class="info">
                <div class="name-row">
                  <span class="nickname">{{ row.nickname }}</span>
                  <el-tag v-if="row.gender === 'male'" type="primary" size="small">男</el-tag>
                  <el-tag v-else type="danger" size="small">女</el-tag>
                </div>
                <div class="phone">{{ row.phone }} · ID {{ row.memberId }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="等级" width="120">
          <template #default="{ row }">
            <div class="level-cell" :class="`level-${row.level}`">
              <el-icon><Medal /></el-icon>
              <span>{{ levelLabel(row.level) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="标签" width="220">
          <template #default="{ row }">
            <el-tag
              v-for="tag in row.tags"
              :key="tag"
              :type="tagType(tag)"
              size="small"
              effect="plain"
              class="tag-item"
            >
              {{ tag }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="累计消费" width="140" align="right">
          <template #default="{ row }">
            <div class="amount-cell">
              <div class="amount-value">¥{{ row.totalAmount.toLocaleString() }}</div>
              <div class="amount-sub">{{ row.orderCount }} 单</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="积分" prop="points" width="100" align="right">
          <template #default="{ row }">
            <span class="points">{{ row.points.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所在地" prop="region" width="160" />
        <el-table-column label="注册时间" prop="createdAt" width="160" />
        <el-table-column label="最近活跃" prop="lastActive" width="140" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleDetail(row)">详情</el-button>
            <el-button link type="warning" @click="handlePoint(row)">调分</el-button>
            <el-button link type="info" @click="handleMessage(row)">发消息</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" size="580px" title="会员详情" destroy-on-close>
      <div v-if="currentCustomer" class="detail-wrap">
        <div class="detail-header">
          <el-avatar :src="currentCustomer.avatar" :size="72">
            {{ currentCustomer.nickname.charAt(0) }}
          </el-avatar>
          <div class="detail-main">
            <div class="detail-name">
              {{ currentCustomer.nickname }}
              <el-tag size="small" type="warning">{{ levelLabel(currentCustomer.level) }}</el-tag>
            </div>
            <div class="detail-meta">
              <span>{{ currentCustomer.phone }}</span>
              <span>·</span>
              <span>ID {{ currentCustomer.memberId }}</span>
            </div>
            <div class="detail-tags">
              <el-tag v-for="tag in currentCustomer.tags" :key="tag" size="small" class="tag-item">{{ tag }}</el-tag>
            </div>
          </div>
        </div>

        <el-divider />

        <h4 class="section-title">消费数据</h4>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="累计消费">¥{{ currentCustomer.totalAmount.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="订单总数">{{ currentCustomer.orderCount }} 单</el-descriptions-item>
          <el-descriptions-item label="客单价">¥{{ Math.round(currentCustomer.totalAmount / currentCustomer.orderCount).toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="积分余额">{{ currentCustomer.points.toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="注册时间">{{ currentCustomer.createdAt }}</el-descriptions-item>
          <el-descriptions-item label="最近活跃">{{ currentCustomer.lastActive }}</el-descriptions-item>
        </el-descriptions>

        <h4 class="section-title">最近 3 笔订单</h4>
        <el-table :data="recentOrders" size="small" border>
          <el-table-column label="订单号" prop="orderNo" width="170" />
          <el-table-column label="商品" prop="product" />
          <el-table-column label="金额" width="110" align="right">
            <template #default="{ row }">¥{{ row.amount }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="row.statusType">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  User, Medal, Wallet, Timer, Search, RefreshLeft, Upload, Download,
} from '@element-plus/icons-vue'

interface Customer {
  id: number
  memberId: string
  avatar: string
  nickname: string
  phone: string
  gender: 'male' | 'female'
  level: 'V0' | 'V1' | 'V2' | 'V3' | 'V4'
  tags: string[]
  totalAmount: number
  orderCount: number
  points: number
  region: string
  createdAt: string
  lastActive: string
}

const levels = [
  { value: 'V0', label: '普通会员' },
  { value: 'V1', label: '银卡会员' },
  { value: 'V2', label: '金卡会员' },
  { value: 'V3', label: '白金会员' },
  { value: 'V4', label: '黑钻会员' },
]

const filter = reactive({
  keyword: '',
  level: '',
  gender: '',
  tag: '',
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 6,
})

const customers = ref<Customer[]>([
  {
    id: 1,
    memberId: '100028',
    avatar: '/placeholder.svg?height=44&width=44',
    nickname: '沈墨轩',
    phone: '138****8821',
    gender: 'male',
    level: 'V4',
    tags: ['高价值', '复购用户', '茶具爱好者'],
    totalAmount: 128600,
    orderCount: 42,
    points: 28560,
    region: '北京市 海淀区',
    createdAt: '2023-08-12 14:23',
    lastActive: '2 小时前',
  },
  {
    id: 2,
    memberId: '100189',
    avatar: '/placeholder.svg?height=44&width=44',
    nickname: '林雅琴',
    phone: '186****5532',
    gender: 'female',
    level: 'V3',
    tags: ['活跃', '礼品购买'],
    totalAmount: 68900,
    orderCount: 28,
    points: 14280,
    region: '上海市 浦东新区',
    createdAt: '2023-11-05 10:08',
    lastActive: '1 天前',
  },
  {
    id: 3,
    memberId: '100456',
    avatar: '/placeholder.svg?height=44&width=44',
    nickname: '陈景明',
    phone: '139****2210',
    gender: 'male',
    level: 'V2',
    tags: ['沉默用户', '流失预警'],
    totalAmount: 18200,
    orderCount: 8,
    points: 3640,
    region: '广东省 深圳市',
    createdAt: '2024-02-18 16:42',
    lastActive: '45 天前',
  },
  {
    id: 4,
    memberId: '100782',
    avatar: '/placeholder.svg?height=44&width=44',
    nickname: '苏婉清',
    phone: '157****9012',
    gender: 'female',
    level: 'V2',
    tags: ['活跃', '花瓶收藏'],
    totalAmount: 22800,
    orderCount: 12,
    points: 4560,
    region: '浙江省 杭州市',
    createdAt: '2024-03-20 09:15',
    lastActive: '3 小时前',
  },
  {
    id: 5,
    memberId: '101023',
    avatar: '/placeholder.svg?height=44&width=44',
    nickname: '周慕云',
    phone: '159****3308',
    gender: 'male',
    level: 'V1',
    tags: ['新客'],
    totalAmount: 3680,
    orderCount: 3,
    points: 736,
    region: '四川省 成都市',
    createdAt: '2026-02-08 11:30',
    lastActive: '5 分钟前',
  },
  {
    id: 6,
    memberId: '101245',
    avatar: '/placeholder.svg?height=44&width=44',
    nickname: '韩雪',
    phone: '180****7766',
    gender: 'female',
    level: 'V0',
    tags: ['新注册', '未首购'],
    totalAmount: 0,
    orderCount: 0,
    points: 100,
    region: '江苏省 南京市',
    createdAt: '2026-04-15 18:22',
    lastActive: '昨天',
  },
])

const stats = computed(() => {
  const total = 8652
  const paid = 5821
  const paidRate = ((paid / total) * 100).toFixed(1)
  const avgOrder = 486
  const active = 2108
  const activeRate = ((active / total) * 100).toFixed(1)
  return { total, paid, paidRate, avgOrder, active, activeRate }
})

function levelLabel(level: string) {
  return levels.find((l) => l.value === level)?.label || level
}

function tagType(tag: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  if (tag.includes('高价值') || tag.includes('复购')) return 'success'
  if (tag.includes('沉默') || tag.includes('流失')) return 'warning'
  if (tag.includes('预警')) return 'danger'
  if (tag.includes('活跃')) return 'primary'
  return 'info'
}

function handleReset() {
  filter.keyword = ''
  filter.level = ''
  filter.gender = ''
  filter.tag = ''
}

const detailVisible = ref(false)
const currentCustomer = ref<Customer | null>(null)
const recentOrders = ref([
  { orderNo: 'SO-2026-04200-128', product: '青花瓷盖碗茶具 × 1', amount: '880.00', status: '已完成', statusType: 'success' },
  { orderNo: 'SO-2026-03150-892', product: '汝窑主人杯 × 2', amount: '760.00', status: '已完成', statusType: 'success' },
  { orderNo: 'SO-2026-02280-445', product: '羊脂玉白瓷花瓶', amount: '1280.00', status: '售后中', statusType: 'warning' },
])

function handleDetail(row: Customer) {
  currentCustomer.value = row
  detailVisible.value = true
}

function handlePoint(row: Customer) {
  ElMessageBox.prompt(`为「${row.nickname}」调整积分`, '积分调整', {
    inputPlaceholder: '正数增加，负数扣减',
    inputValidator: (val) => {
      if (!val || Number.isNaN(Number(val))) return '请输入数字'
      return true
    },
  }).then(({ value }) => {
    row.points += Number(value)
    ElMessage.success(`积分已调整：${value > '0' ? '+' : ''}${value}`)
  }).catch(() => {})
}

function handleMessage(row: Customer) {
  ElMessage.success(`已向「${row.nickname}」发送站内信（占位）`)
}
</script>

<style scoped>
.customer-page { padding: 20px; }

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
  display: flex;
  align-items: center;
  gap: 14px;
  border: 1px solid #ebeef5;
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
}
.stat-icon.blue { background: #409eff; }
.stat-icon.gold { background: #c8a96a; }
.stat-icon.green { background: #67c23a; }
.stat-icon.orange { background: #e6a23c; }
.stat-label { font-size: 13px; color: #909399; }
.stat-value { font-size: 22px; font-weight: 600; color: #1f2d3d; margin-top: 2px; }
.stat-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.up { color: #67c23a; font-weight: 600; }

.filter-card { margin-bottom: 16px; border-radius: 8px; }
.filter-form :deep(.el-form-item) { margin-bottom: 0; }
.content-card { border-radius: 8px; }

.customer-cell { display: flex; align-items: center; gap: 10px; }
.name-row { display: flex; align-items: center; gap: 6px; }
.nickname { font-size: 14px; font-weight: 600; color: #1f2d3d; }
.phone { font-size: 12px; color: #909399; margin-top: 2px; }

.level-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}
.level-V0 { color: #909399; }
.level-V1 { color: #5fb7ff; }
.level-V2 { color: #c8a96a; }
.level-V3 { color: #a67fd4; }
.level-V4 { color: #1f2d3d; }

.tag-item { margin-right: 4px; margin-bottom: 4px; }

.amount-cell { display: flex; flex-direction: column; align-items: flex-end; }
.amount-value { font-size: 15px; font-weight: 600; color: #c8a96a; }
.amount-sub { font-size: 12px; color: #909399; margin-top: 2px; }
.points { color: #e6a23c; font-weight: 600; }

.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }

.detail-wrap { padding: 0 4px; }
.detail-header { display: flex; gap: 16px; align-items: flex-start; }
.detail-main { flex: 1; }
.detail-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-meta {
  font-size: 13px;
  color: #909399;
  margin: 6px 0 10px;
  display: flex;
  gap: 6px;
}
.detail-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
  margin: 20px 0 10px;
  padding-left: 8px;
  border-left: 3px solid #c8a96a;
}
</style>
