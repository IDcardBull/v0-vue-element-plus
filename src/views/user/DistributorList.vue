<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { distributorApi } from '@/api/distributor'
import {
  Search,
  Refresh,
  Plus,
  Edit,
  View,
  Check,
  Close,
  OfficeBuilding,
  User,
  Location,
  Medal,
} from '@element-plus/icons-vue'

/* ----------------------------------- 类型 ---------------------------------- */
type DistLevel = 'diamond' | 'gold' | 'silver' | 'regular'
type DistStatus = 'pending' | 'approved' | 'rejected' | 'disabled'

interface Distributor {
  id: string
  code: string
  company_name: string
  contact: string
  phone: string
  province: string
  city: string
  level: DistLevel
  status: DistStatus
  credit_limit: number
  used_credit: number
  order_count: number
  total_amount: number
  join_date: string
  last_order_date?: string
  remark?: string
}

/* --------------------------------- 等级配置 -------------------------------- */
const levelMeta: Record<
  DistLevel,
  { label: string; color: string; bg: string; discount: string }
> = {
  diamond: { label: '钻石', color: '#0a7fdc', bg: '#e7f3fd', discount: '6.5折' },
  gold: { label: '黄金', color: '#c8a96a', bg: '#faf5ea', discount: '7折' },
  silver: { label: '白银', color: '#8a94a6', bg: '#f2f4f7', discount: '7.5折' },
  regular: { label: '普通', color: '#606266', bg: '#f7f9fc', discount: '8折' },
}
const statusMeta: Record<
  DistStatus,
  { label: string; type: 'warning' | 'success' | 'danger' | 'info' }
> = {
  pending: { label: '待审核', type: 'warning' },
  approved: { label: '已通过', type: 'success' },
  rejected: { label: '已拒绝', type: 'danger' },
  disabled: { label: '已禁用', type: 'info' },
}

const allList = ref<Distributor[]>([])
const loadError = ref('')

function mapLevel(v: any): DistLevel {
  const s = String(v || '').toLowerCase()
  if (['diamond', 'gold', 'silver', 'regular'].includes(s)) return s as DistLevel
  if (['钻石'].includes(s)) return 'diamond'
  if (['黄金', 'bronze'].includes(s)) return 'gold'
  if (['白银'].includes(s)) return 'silver'
  return 'regular'
}
function mapStatus(v: any): DistStatus {
  const s = String(v || '').toLowerCase()
  if (['pending', 'approved', 'rejected', 'disabled'].includes(s)) return s as DistStatus
  return 'pending'
}

async function loadDistributors() {
  loadError.value = ''
  try {
    const res: any = await distributorApi.list({ page: 1, pageSize: 100 })
    const rows = (res?.list ?? []) as any[]
    allList.value = rows.map((r: any, i: number) => ({
      id: String(r.id ?? i + 1),
      code: r.code || '',
      company_name: r.companyName || r.shopName || r.name || '',
      contact: r.contactName || r.user?.realName || '',
      phone: r.contactPhone || r.user?.phone || '',
      province: r.province || '',
      city: r.city || '',
      level: mapLevel(r.level),
      status: mapStatus(r.auditStatus || r.status),
      credit_limit: Number(r.creditLimit ?? 0),
      used_credit: Number(r.creditUsed ?? r.usedCredit ?? 0),
      order_count: Number(r.orderCount ?? 0),
      total_amount: Number(r.totalAmount ?? 0),
      join_date: r.joinDate || r.createdAt || '',
      last_order_date: r.lastOrderDate || undefined,
      remark: r.remark || '',
    }))
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    allList.value = []
  }
  // 列表刷新后顺带刷新统计卡，让 audit/update 后头部数字也实时变
  loadStats()
}

onMounted(loadDistributors)

/* --------------------------------- 筛选条件 -------------------------------- */
const filters = reactive({
  keyword: '',
  level: '' as '' | DistLevel,
  status: '' as '' | DistStatus,
  province: '',
})

const provinceOptions = computed(() =>
  Array.from(new Set(allList.value.map((d) => d.province))).map((p) => ({
    value: p,
    label: p,
  })),
)

const filteredList = computed(() => {
  return allList.value.filter((d) => {
    if (filters.keyword.trim()) {
      const kw = filters.keyword.trim().toLowerCase()
      if (
        !d.company_name.toLowerCase().includes(kw) &&
        !d.contact.toLowerCase().includes(kw) &&
        !d.phone.includes(kw) &&
        !d.code.toLowerCase().includes(kw)
      )
        return false
    }
    if (filters.level && d.level !== filters.level) return false
    if (filters.status && d.status !== filters.status) return false
    if (filters.province && d.province !== filters.province) return false
    return true
  })
})

const page = reactive({ current: 1, size: 10, total: 0 })
const pagedList = computed(() => {
  page.total = filteredList.value.length
  const start = (page.current - 1) * page.size
  return filteredList.value.slice(start, start + page.size)
})

/* --------------------------------- 统计数据 -------------------------------- */
// 后端 /admin/distributors/stats 走全表聚合，本地分页不影响数字
const stats = ref({
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  disabled: 0,
  totalAmount: 0,
  thisMonthAmount: 0,
  lastMonthAmount: 0,
  amountTrend: null as number | null,
})

async function loadStats() {
  try {
    const data = await distributorApi.stats()
    if (data) Object.assign(stats.value, data)
  } catch {
    // 失败保持 0
  }
}

/* --------------------------------- 操作方法 -------------------------------- */
function resetFilters() {
  filters.keyword = ''
  filters.level = ''
  filters.status = ''
  filters.province = ''
  page.current = 1
}

async function handleApprove(row: Distributor) {
  try {
    await ElMessageBox.confirm(
      `确认通过 "${row.company_name}" 的入驻申请？通过后该用户在批发端可以看到批发价。`,
      '审核通过',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'success' },
    )
  } catch {
    return
  }
  try {
    await distributorApi.audit(Number(row.id), true)
    ElMessage.success('已审核通过，已通知运营群')
    await loadDistributors()
  } catch (err: any) {
    ElMessage.error(err?.message || '审核失败')
  }
}

async function handleReject(row: Distributor) {
  let reason = ''
  try {
    const res = await ElMessageBox.prompt(`请输入拒绝理由`, `拒绝 "${row.company_name}"`, {
      confirmButtonText: '确认拒绝',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputPlaceholder: '请填写拒绝原因...',
      inputValidator: (v) => (v && v.trim().length >= 3 ? true : '理由不少于 3 字'),
    })
    reason = res.value
  } catch {
    return
  }
  try {
    await distributorApi.audit(Number(row.id), false, reason)
    ElMessage.success('已拒绝')
    await loadDistributors()
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败')
  }
}

async function handleToggleStatus(row: Distributor) {
  const next = row.status === 'approved' ? 'disabled' : 'approved'
  const word = next === 'disabled' ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定${word}分销商 "${row.company_name}" ？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await distributorApi.update(Number(row.id), { status: next })
    ElMessage.success(`已${word}`)
    await loadDistributors()
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败')
  }
}

/* ---------------------------- 新增 / 编辑 分销商 Dialog ---------------------------- */
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogTitle = computed(() =>
  dialogMode.value === 'create' ? '新增分销商' : '编辑分销商',
)
const formRef = ref<FormInstance>()
const formModel = reactive<Partial<Distributor>>({
  company_name: '',
  contact: '',
  phone: '',
  province: '',
  city: '',
  level: 'regular',
  credit_limit: 50000,
  remark: '',
})

function openCreate() {
  dialogMode.value = 'create'
  Object.assign(formModel, {
    id: '',
    company_name: '',
    contact: '',
    phone: '',
    province: '',
    city: '',
    level: 'regular',
    credit_limit: 50000,
    remark: '',
  })
  dialogVisible.value = true
}

function openEdit(row: Distributor) {
  dialogMode.value = 'edit'
  Object.assign(formModel, { ...row })
  dialogVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (dialogMode.value === 'create') {
    // 分销商不支持后台直接新增（必须由用户在批发小程序端发起入驻申请）
    // 这里给个明确提示，避免运营误用
    ElMessage.warning(
      '分销商需由用户在批发小程序端提交入驻申请，运营仅做审核 / 编辑',
    )
    dialogVisible.value = false
    return
  }
  // 编辑：调真实 update API
  try {
    await distributorApi.update(Number(formModel.id), {
      company_name: formModel.company_name,
      contact: formModel.contact,
      phone: formModel.phone,
      province: formModel.province,
      city: formModel.city,
      level: formModel.level,
      credit_limit: formModel.credit_limit,
      remark: formModel.remark,
    })
    ElMessage.success('已保存修改')
    dialogVisible.value = false
    await loadDistributors()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  }
}

/* ---------------------------- 详情抽屉 ---------------------------- */
const detailVisible = ref(false)
const detailData = ref<Distributor | null>(null)
function viewDetail(row: Distributor) {
  detailData.value = row
  detailVisible.value = true
}
</script>

<template>
  <div class="distributor-page">
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadDistributors">点击重试</el-button>
      </template>
    </el-alert>
    <!-- 顶部统计 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon gold">
          <el-icon><OfficeBuilding /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">分销商总数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon><Check /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">已审核通过</div>
          <div class="stat-value">{{ stats.approved }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">
          <el-icon><User /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">待审核</div>
          <div class="stat-value">{{ stats.pending }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">
          <el-icon><Medal /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">累计批发额 (元)</div>
          <div class="stat-value">{{ stats.totalAmount.toLocaleString() }}</div>
        </div>
      </div>
    </div>

    <!-- 筛选 + 操作栏 -->
    <el-card class="filter-card" shadow="never">
      <div class="filter-inner">
        <el-form :inline="true" :model="filters" class="filter-form">
          <el-form-item>
            <el-input
              v-model="filters.keyword"
              placeholder="公司 / 联系人 / 电话 / 编号"
              clearable
              style="width: 260px"
              :prefix-icon="Search"
            />
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.level" placeholder="所有等级" clearable style="width: 130px">
              <el-option value="diamond" label="钻石" />
              <el-option value="gold" label="黄金" />
              <el-option value="silver" label="白银" />
              <el-option value="regular" label="普通" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.status" placeholder="所有状态" clearable style="width: 130px">
              <el-option value="pending" label="待审核" />
              <el-option value="approved" label="已通过" />
              <el-option value="rejected" label="已拒绝" />
              <el-option value="disabled" label="已禁用" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="filters.province" placeholder="所有省份" clearable style="width: 130px">
              <el-option
                v-for="o in provinceOptions"
                :key="o.value"
                :value="o.value"
                :label="o.label"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search">查询</el-button>
            <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增分销商</el-button>
      </div>
    </el-card>

    <!-- 表格 -->
    <el-card class="table-card" shadow="never">
      <el-table :data="pagedList" stripe empty-text="暂无分销商" row-key="id">
        <el-table-column label="分销商" min-width="240">
          <template #default="{ row }">
            <div class="biz-cell">
              <div class="biz-avatar" :style="{ background: levelMeta[row.level as DistLevel].bg }">
                <span :style="{ color: levelMeta[row.level as DistLevel].color }">
                  {{ row.company_name.slice(0, 1) }}
                </span>
              </div>
              <div class="biz-info">
                <div class="biz-name">{{ row.company_name }}</div>
                <div class="biz-code">{{ row.code }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="联系人 / 电话" min-width="170">
          <template #default="{ row }">
            <div class="contact-cell">
              <div>
                <el-icon class="inline-icon"><User /></el-icon>
                {{ row.contact }}
              </div>
              <div class="sub">
                <el-icon class="inline-icon"><Location /></el-icon>
                {{ row.province }} · {{ row.city }}
              </div>
              <div class="sub phone">{{ row.phone }}</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="等级 / 折扣" width="150" align="center">
          <template #default="{ row }">
            <div class="level-cell">
              <el-tag
                :color="levelMeta[row.level as DistLevel].bg"
                :style="{
                  color: levelMeta[row.level as DistLevel].color,
                  borderColor: levelMeta[row.level as DistLevel].color,
                }"
                effect="plain"
              >
                {{ levelMeta[row.level as DistLevel].label }}
              </el-tag>
              <div class="sub">
                批发价 {{ levelMeta[row.level as DistLevel].discount }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="授信额度" width="180">
          <template #default="{ row }">
            <div v-if="row.credit_limit > 0" class="credit-cell">
              <div class="credit-line">
                <span class="sub">已用 ¥{{ row.used_credit.toLocaleString() }}</span>
                <span class="sub">¥{{ row.credit_limit.toLocaleString() }}</span>
              </div>
              <el-progress
                :percentage="Math.round((row.used_credit / row.credit_limit) * 100)"
                :stroke-width="6"
                :show-text="false"
                :status="
                  row.used_credit / row.credit_limit > 0.8
                    ? 'warning'
                    : 'success'
                "
              />
            </div>
            <span v-else class="sub">未授信</span>
          </template>
        </el-table-column>

        <el-table-column label="业绩" width="140" align="right">
          <template #default="{ row }">
            <div class="sales-cell">
              <div class="amount">¥{{ row.total_amount.toLocaleString() }}</div>
              <div class="sub">{{ row.order_count }} 单</div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="statusMeta[row.status as DistStatus].type"
              effect="light"
              size="small"
            >
              {{ statusMeta[row.status as DistStatus].label }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="入驻时间" width="110" align="center">
          <template #default="{ row }">
            <span class="sub">{{ row.join_date }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="viewDetail(row)">
              详情
            </el-button>
            <template v-if="row.status === 'pending'">
              <el-button type="success" link :icon="Check" @click="handleApprove(row)">
                通过
              </el-button>
              <el-button type="danger" link :icon="Close" @click="handleReject(row)">
                拒绝
              </el-button>
            </template>
            <template v-else-if="row.status === 'approved' || row.status === 'disabled'">
              <el-button type="primary" link :icon="Edit" @click="openEdit(row)">
                编辑
              </el-button>
              <el-button
                :type="row.status === 'approved' ? 'danger' : 'success'"
                link
                @click="handleToggleStatus(row)"
              >
                {{ row.status === 'approved' ? '禁用' : '启用' }}
              </el-button>
            </template>
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

    <!-- 新增 / 编辑 Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form
        ref="formRef"
        :model="formModel"
        label-width="90px"
        :rules="{
          company_name: [{ required: true, message: '请输入公司名称' }],
          contact: [{ required: true, message: '请输入联系人' }],
          phone: [
            { required: true, message: '请输入电话' },
            { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
          ],
          province: [{ required: true, message: '请输入省份' }],
        }"
      >
        <el-form-item label="公司名称" prop="company_name">
          <el-input v-model="formModel.company_name" placeholder="如：杭州茗茶行" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="联系人" prop="contact">
              <el-input v-model="formModel.contact" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电话" prop="phone">
              <el-input v-model="formModel.phone" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="省份" prop="province">
              <el-input v-model="formModel.province" placeholder="如：浙江" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="城市">
              <el-input v-model="formModel.city" placeholder="如：杭州" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="等级">
          <el-radio-group v-model="formModel.level">
            <el-radio-button value="regular">普通</el-radio-button>
            <el-radio-button value="silver">白银</el-radio-button>
            <el-radio-button value="gold">黄金</el-radio-button>
            <el-radio-button value="diamond">钻石</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="授信额度">
          <el-input-number
            v-model="formModel.credit_limit"
            :min="0"
            :step="10000"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="formModel.remark"
            type="textarea"
            :rows="3"
            placeholder="内部备注信息"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" size="520px" :with-header="false">
      <div v-if="detailData" class="detail-panel">
        <div class="detail-top">
          <div
            class="detail-avatar"
            :style="{ background: levelMeta[detailData.level].bg }"
          >
            <span :style="{ color: levelMeta[detailData.level].color }">
              {{ detailData.company_name.slice(0, 1) }}
            </span>
          </div>
          <div class="detail-top-info">
            <div class="detail-name">{{ detailData.company_name }}</div>
            <div class="detail-code">{{ detailData.code }}</div>
            <div class="detail-tags">
              <el-tag
                :style="{
                  color: levelMeta[detailData.level].color,
                  borderColor: levelMeta[detailData.level].color,
                  background: levelMeta[detailData.level].bg,
                }"
                effect="plain"
                size="small"
              >
                {{ levelMeta[detailData.level].label }}级
              </el-tag>
              <el-tag
                :type="statusMeta[detailData.status].type"
                effect="light"
                size="small"
              >
                {{ statusMeta[detailData.status].label }}
              </el-tag>
            </div>
          </div>
        </div>

        <div class="detail-stats">
          <div class="detail-stat">
            <div class="detail-stat-label">订单数</div>
            <div class="detail-stat-value">{{ detailData.order_count }}</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">累计金额</div>
            <div class="detail-stat-value">
              ¥{{ detailData.total_amount.toLocaleString() }}
            </div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-label">授信使用</div>
            <div class="detail-stat-value">
              {{
                detailData.credit_limit > 0
                  ? Math.round((detailData.used_credit / detailData.credit_limit) * 100)
                  : 0
              }}%
            </div>
          </div>
        </div>

        <el-descriptions :column="1" border>
          <el-descriptions-item label="联系人">
            {{ detailData.contact }}
          </el-descriptions-item>
          <el-descriptions-item label="联系电话">
            {{ detailData.phone }}
          </el-descriptions-item>
          <el-descriptions-item label="所在地">
            {{ detailData.province }} · {{ detailData.city }}
          </el-descriptions-item>
          <el-descriptions-item label="入驻时间">
            {{ detailData.join_date }}
          </el-descriptions-item>
          <el-descriptions-item label="最近下单">
            {{ detailData.last_order_date || '暂无' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">
            {{ detailData.remark || '--' }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.distributor-page {
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
  border: 1px solid #ebeef5;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
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
.stat-icon.gold { background: #c8a96a; }
.stat-icon.green { background: #67c23a; }
.stat-icon.orange { background: #e6a23c; }
.stat-icon.blue { background: #2d8cf0; }
.stat-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: #1f2d3d;
  font-family: 'Geist Mono', 'Menlo', monospace;
}

/* ---------- filter ---------- */
.filter-card :deep(.el-card__body) {
  padding: 16px 20px;
}
.filter-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.filter-form {
  display: flex;
  flex-wrap: wrap;
}
.filter-form :deep(.el-form-item) {
  margin-right: 8px;
  margin-bottom: 0;
}

/* ---------- table cells ---------- */
.biz-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.biz-avatar {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}
.biz-name { color: #1f2d3d; font-weight: 500; }
.biz-code {
  font-size: 12px;
  color: #909399;
  font-family: 'Geist Mono', monospace;
  margin-top: 2px;
}

.contact-cell .inline-icon {
  margin-right: 4px;
  vertical-align: -2px;
  color: #909399;
}
.sub { font-size: 12px; color: #909399; margin-top: 2px; }
.phone { font-family: 'Geist Mono', monospace; }

.level-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.credit-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.credit-line {
  display: flex;
  justify-content: space-between;
  font-family: 'Geist Mono', monospace;
}

.sales-cell .amount {
  color: #1f2d3d;
  font-weight: 600;
  font-family: 'Geist Mono', monospace;
}

/* ---------- footer ---------- */
.table-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

/* ---------- detail drawer ---------- */
.detail-panel {
  padding: 0 4px;
}
.detail-top {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 20px;
}
.detail-avatar {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  flex-shrink: 0;
}
.detail-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
}
.detail-code {
  font-family: 'Geist Mono', monospace;
  color: #909399;
  font-size: 12px;
  margin: 4px 0 8px;
}
.detail-tags {
  display: flex;
  gap: 6px;
}
.detail-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.detail-stat {
  background: #fafbfc;
  border-radius: 4px;
  padding: 14px 12px;
  text-align: center;
}
.detail-stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.detail-stat-value {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
  font-family: 'Geist Mono', monospace;
}

@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
