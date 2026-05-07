<template>
  <div class="craft-material-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">工艺 / 胎质管理</h2>
        <p class="page-subtitle">维护商品编辑页中的工艺和胎质选项，用于商品归类与筛选</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增分类项</el-button>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" class="mb-12">
      <template #default>
        <span>数据加载失败。</span>
        <el-button type="danger" size="small" link @click="loadItems">点击重试</el-button>
      </template>
    </el-alert>

    <el-card class="filter-card" shadow="never">
      <el-form inline class="filter-form" @submit.prevent>
        <el-form-item label="分类类型">
          <el-select v-model="activeType" style="width: 160px" @change="handleSearch">
            <el-option v-for="type in typeOptions" :key="type.code" :label="type.name" :value="type.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="filter.keyword" placeholder="输入名称 / 值" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" placeholder="全部" clearable style="width: 140px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="pagedList" stripe border v-loading="loading">
        <el-table-column label="类型" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.typeCode === 'craft' ? 'primary' : 'warning'" effect="plain">
              {{ getTypeName(row.typeCode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="名称" prop="label" min-width="180" />
        <el-table-column label="字段值" prop="value" min-width="180" />
        <el-table-column label="关联商品" width="100" align="right">
          <template #default>
            <span class="goods-count">-</span>
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sort" width="90" align="center" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="220" show-overflow-tooltip />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button link :type="row.status === 1 ? 'warning' : 'success'" @click="handleToggle(row)">
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="filteredList.length"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

    <el-drawer
      v-model="drawerVisible"
      :title="formMode === 'create' ? '新增分类项' : '编辑分类项'"
      size="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="分类类型" prop="typeCode">
          <el-radio-group v-model="form.typeCode" :disabled="formMode === 'edit'">
            <el-radio-button label="craft">工艺</el-radio-button>
            <el-radio-button label="material">胎质</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="名称" prop="label">
          <el-input v-model="form.label" placeholder="如：青花瓷、粉彩、羊脂玉瓷" />
        </el-form-item>
        <el-form-item label="字段值" prop="value">
          <el-input v-model="form.value" placeholder="默认与名称保持一致，可手动改" @input="valueTouched = true" />
          <div class="form-tip">商品编辑页实际保存的是这个字段值。</div>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" />
          <span class="form-tip inline-tip">数值越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="4" placeholder="工艺说明、胎质特征等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { dictApi, type DictItem } from '@/api/dict'

const typeOptions = [
  { code: 'craft', name: '工艺' },
  { code: 'material', name: '胎质' },
]

const activeType = ref<'craft' | 'material'>('craft')
const loading = ref(false)
const submitting = ref(false)
const loadError = ref('')
const itemList = ref<DictItem[]>([])
const filter = reactive({
  keyword: '',
  status: undefined as number | undefined,
})
const pagination = reactive({ page: 1, size: 10 })

const filteredList = computed(() => {
  const kw = filter.keyword.trim()
  return itemList.value.filter((item) => {
    if (filter.status !== undefined && item.status !== filter.status) return false
    if (kw && !item.label.includes(kw) && !item.value.includes(kw)) return false
    return true
  })
})

const pagedList = computed(() => {
  const start = (pagination.page - 1) * pagination.size
  return filteredList.value.slice(start, start + pagination.size)
})

function getTypeName(typeCode: string) {
  return typeOptions.find((item) => item.code === typeCode)?.name || typeCode
}

async function loadItems() {
  loading.value = true
  loadError.value = ''
  try {
    itemList.value = await dictApi.items(activeType.value, true)
  } catch (error: any) {
    loadError.value = error?.message || '加载失败，后端服务不可用'
    itemList.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadItems)

function handleSearch() {
  pagination.page = 1
  loadItems()
}

function handleReset() {
  filter.keyword = ''
  filter.status = undefined
  pagination.page = 1
  loadItems()
}

const drawerVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()
const valueTouched = ref(false)
const form = reactive({
  id: 0,
  typeCode: 'craft' as 'craft' | 'material',
  label: '',
  value: '',
  sort: 99,
  status: 1,
  remark: '',
})

const rules: FormRules = {
  typeCode: [{ required: true, message: '请选择分类类型', trigger: 'change' }],
  label: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  value: [{ required: true, message: '请输入字段值', trigger: 'blur' }],
}

watch(
  () => form.label,
  (label) => {
    if (formMode.value === 'create' && !valueTouched.value) {
      form.value = (label || '').trim()
    }
  },
)

function resetForm() {
  valueTouched.value = false
  Object.assign(form, {
    id: 0,
    typeCode: activeType.value,
    label: '',
    value: '',
    sort: itemList.value.length + 1,
    status: 1,
    remark: '',
  })
}

function handleCreate() {
  formMode.value = 'create'
  resetForm()
  drawerVisible.value = true
}

function handleEdit(row: DictItem) {
  formMode.value = 'edit'
  valueTouched.value = true
  Object.assign(form, {
    id: row.id,
    typeCode: row.typeCode as 'craft' | 'material',
    label: row.label,
    value: row.value,
    sort: row.sort,
    status: row.status,
    remark: row.remark || '',
  })
  drawerVisible.value = true
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload = {
      label: form.label.trim(),
      value: form.value.trim(),
      sort: Number(form.sort || 0),
      status: Number(form.status),
      remark: form.remark || undefined,
      typeName: getTypeName(form.typeCode),
    }
    if (formMode.value === 'create') {
      await dictApi.createItem(form.typeCode, payload)
      ElMessage.success('分类项创建成功')
    } else {
      await dictApi.updateItem(form.id, payload)
      ElMessage.success('分类项已更新')
    }
    drawerVisible.value = false
    activeType.value = form.typeCode
    await loadItems()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

async function handleToggle(row: DictItem) {
  const next = row.status === 1 ? 0 : 1
  try {
    await dictApi.updateItem(row.id, { status: next })
    row.status = next
    ElMessage.success(`已${next === 1 ? '启用' : '停用'}：${row.label}`)
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败')
  }
}

async function handleDelete(row: DictItem) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.label}」？该操作不可撤销。`, '删除确认', {
      type: 'warning',
    })
    await dictApi.removeItem(row.id)
    ElMessage.success('删除成功')
    await loadItems()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '删除失败')
  }
}
</script>

<style scoped>
.craft-material-page { padding: 20px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2d3d; }
.page-subtitle { margin: 4px 0 0; font-size: 13px; color: #909399; }
.mb-12 { margin-bottom: 12px; }
.filter-card { margin-bottom: 16px; border-radius: 8px; }
.filter-form { margin-bottom: 0; }
.filter-form :deep(.el-form-item) { margin-bottom: 0; }
.content-card { border-radius: 8px; }
.goods-count { font-weight: 600; color: #c8a96a; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
.form-tip { font-size: 12px; color: #909399; margin-top: 6px; }
.inline-tip { margin-left: 12px; display: inline-block; }
.drawer-footer { display: flex; justify-content: flex-end; gap: 12px; }
</style>
