<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'
import {
  shippingTemplateApi,
  type ShippingTemplate,
  type ShippingTemplatePayload,
} from '@/api/shippingTemplate'
import ShippingTemplateForm from './components/ShippingTemplateForm.vue'

interface Row extends ShippingTemplate {
  templateName: string
}

const list = ref<Row[]>([])
const loading = ref(false)
const drawerVisible = ref(false)
const drawerBusy = ref(false)
const editingSource = ref<ShippingTemplate | null>(null)

const drawerTitle = computed(() => (editingSource.value ? '编辑运费模板' : '新建运费模板'))

function normalizeRow(item: ShippingTemplate): Row {
  return {
    ...item,
    templateName: item.templateName || (item as any).name || '',
  }
}

async function loadList() {
  loading.value = true
  try {
    const res = await shippingTemplateApi.list()
    list.value = (Array.isArray(res) ? res : []).map(normalizeRow)
  } catch (err: any) {
    ElMessage.error(err?.message || '运费模板加载失败')
    list.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingSource.value = null
  drawerVisible.value = true
}

function openEdit(row: Row) {
  // 用一份独立拷贝，避免抽屉里改动直接污染列表
  editingSource.value = JSON.parse(JSON.stringify(row))
  drawerVisible.value = true
}

async function onRemove(row: Row) {
  try {
    await ElMessageBox.confirm(
      `确认删除模板「${row.templateName}」？已绑定该模板的商品将回退到默认运费。`,
      '删除运费模板',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    await shippingTemplateApi.remove(row.id)
    ElMessage.success('已删除')
    await loadList()
  } catch (err: any) {
    ElMessage.error(err?.message || '删除失败')
  }
}

async function onSubmit(payload: ShippingTemplatePayload) {
  drawerBusy.value = true
  try {
    if (editingSource.value && editingSource.value.id) {
      await shippingTemplateApi.update(editingSource.value.id, payload)
      ElMessage.success('已更新')
    } else {
      await shippingTemplateApi.create(payload)
      ElMessage.success('已创建')
    }
    drawerVisible.value = false
    await loadList()
  } catch (err: any) {
    ElMessage.error(err?.message || '保存失败')
  } finally {
    drawerBusy.value = false
  }
}

function calcTypeText(t: number) {
  return t === 2 ? '按重量' : '按件数'
}

function ruleSummary(row: Row): string {
  const r = row.defaultRule
  if (!r) return '-'
  const unit = row.calcType === 2 ? 'kg' : '件'
  return `${r.firstAmount}${unit} ${r.firstPrice}元 / 续${r.continueAmount}${unit} +${r.continuePrice}元`
}

function formatDate(value?: string) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

onMounted(loadList)
</script>

<template>
  <div class="page">
    <header class="page-header">
      <div class="page-header-left">
        <h2 class="page-title">运费模板</h2>
        <p class="page-subtitle">
          B2C 零售订单运费规则 · 支持按件数 / 按重量计价、指定地区差异化、满额包邮
        </p>
      </div>
      <div class="page-header-actions">
        <el-button :icon="Refresh" @click="loadList">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新建运费模板</el-button>
      </div>
    </header>

    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-table
        :data="list"
        empty-text="暂无运费模板，点击右上角「新建运费模板」开始"
        stripe
        border
      >
        <el-table-column label="模板名称" prop="templateName" min-width="180">
          <template #default="{ row }: { row: Row }">
            <span class="row-name">{{ row.templateName }}</span>
            <el-tag
              v-if="row.freeShippingEnabled"
              type="success"
              size="small"
              effect="plain"
              class="row-tag"
            >
              满额包邮
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="计价方式" width="120">
          <template #default="{ row }: { row: Row }">
            <el-tag :type="row.calcType === 2 ? 'warning' : 'info'" effect="plain" size="small">
              {{ calcTypeText(row.calcType) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="默认规则" min-width="240">
          <template #default="{ row }: { row: Row }">
            <span class="muted">首{{ ruleSummary(row) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="特殊地区数" width="110" align="center">
          <template #default="{ row }: { row: Row }">
            {{ (row.specialRules || []).length }}
          </template>
        </el-table-column>

        <el-table-column label="最后修改时间" width="180">
          <template #default="{ row }: { row: Row }">
            <span class="muted">{{ formatDate(row.updatedAt) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }: { row: Row }">
            <el-button text type="primary" :icon="Edit" @click="openEdit(row)">
              编辑
            </el-button>
            <el-button text type="danger" :icon="Delete" @click="onRemove(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑/新建抽屉：宽度大一些以承载复杂动态表单 -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerTitle"
      direction="rtl"
      size="780px"
      :destroy-on-close="true"
    >
      <ShippingTemplateForm
        :source="editingSource"
        :busy="drawerBusy"
        @submit="onSubmit"
        @cancel="drawerVisible = false"
      />
    </el-drawer>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: #fff;
  border: 1px solid var(--ym-border, #e6e6e6);
  border-radius: 6px;
}

.page-header-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ym-primary, #1f2828);
}

.page-subtitle {
  margin: 0;
  font-size: 12px;
  color: var(--ym-text-secondary, #909399);
}

.page-header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.table-card :deep(.el-card__body) {
  padding: 0;
}

.row-name {
  font-weight: 600;
  color: var(--ym-text, #1f2828);
}

.row-tag {
  margin-left: 8px;
}

.muted {
  color: var(--ym-text-secondary, #5c6470);
  font-size: 13px;
}
</style>
