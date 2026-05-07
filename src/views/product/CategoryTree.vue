<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Document, Edit, FolderOpened, Goods, Plus, Search } from '@element-plus/icons-vue'
import { categoryApi } from '@/api/category'

interface CategoryNode {
  id: string
  name: string
  code: string
  sort: number
  enabled: boolean
  product_count: number
  description?: string
  children?: CategoryNode[]
}

const loading = ref(false)
const loadError = ref('')
const treeData = ref<CategoryNode[]>([])
const selectedNode = ref<CategoryNode | null>(null)
const filterText = ref('')
const treeRef = ref()
const expandedKeys = ref<string[]>([])

const treeProps = {
  children: 'children',
  label: 'name',
}

function normalize(list: any[]): CategoryNode[] {
  return (list || []).map((item) => ({
    id: String(item.id),
    name: item.name || '',
    code: item.code || '',
    sort: Number(item.sort || 0),
    enabled: item.status === 1 || item.status === 'active' || item.enabled === true,
    product_count: Number(item.productCount ?? item.product_count ?? 0),
    description: item.description || '',
    children: item.children?.length ? normalize(item.children) : undefined,
  }))
}

function flatten(list: CategoryNode[]): CategoryNode[] {
  return list.flatMap((item) => [item, ...(item.children ? flatten(item.children) : [])])
}

async function loadTree() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await categoryApi.tree()
    const list = Array.isArray(res) ? res : (res as any)?.list || []
    treeData.value = normalize(list)
    expandedKeys.value = treeData.value.map((item) => item.id)
  } catch (error: any) {
    loadError.value = error?.message || '分类加载失败'
    treeData.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadTree)

const stats = computed(() => {
  const all = flatten(treeData.value)
  return {
    total: all.length,
    level1: treeData.value.length,
    enabled: all.filter((item) => item.enabled).length,
    products: all.reduce((sum, item) => sum + item.product_count, 0),
  }
})

function filterNode(value: string, data: CategoryNode) {
  if (!value) return true
  return data.name.includes(value) || data.code.includes(value)
}

function handleFilter(val: string) {
  treeRef.value?.filter(val)
}

function handleNodeClick(data: CategoryNode) {
  selectedNode.value = data
}

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit' | 'createSub'>('create')
const dialogParentName = ref('')
const dialogParentId = ref<string | null>(null)
const formRef = ref<FormInstance>()

const formModel = reactive({
  id: '',
  name: '',
  code: '',
  sort: 1,
  enabled: true,
  description: '',
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入分类编码', trigger: 'blur' }],
}

const dialogTitle = computed(() => {
  if (dialogMode.value === 'create') return '新增一级分类'
  if (dialogMode.value === 'createSub') return `新增「${dialogParentName.value}」的子分类`
  return '编辑分类'
})

function resetForm() {
  Object.assign(formModel, {
    id: '',
    name: '',
    code: '',
    sort: 1,
    enabled: true,
    description: '',
  })
}

function openCreateRoot() {
  dialogMode.value = 'create'
  dialogParentId.value = null
  resetForm()
  formModel.sort = treeData.value.length + 1
  dialogVisible.value = true
}

function openCreateSub(parent: CategoryNode) {
  dialogMode.value = 'createSub'
  dialogParentId.value = parent.id
  dialogParentName.value = parent.name
  resetForm()
  formModel.sort = (parent.children?.length || 0) + 1
  dialogVisible.value = true
}

function openEdit(node: CategoryNode) {
  dialogMode.value = 'edit'
  Object.assign(formModel, {
    id: node.id,
    name: node.name,
    code: node.code,
    sort: node.sort,
    enabled: node.enabled,
    description: node.description || '',
  })
  dialogVisible.value = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload: any = {
    name: formModel.name,
    code: formModel.code,
    sort: Number(formModel.sort || 0),
    status: formModel.enabled ? 1 : 0,
    description: formModel.description,
  }
  if (dialogMode.value === 'createSub' && dialogParentId.value) {
    payload.parentId = Number(dialogParentId.value)
  }

  try {
    if (dialogMode.value === 'edit') {
      await categoryApi.update(Number(formModel.id), payload)
    } else {
      await categoryApi.create(payload)
    }
    ElMessage.success(dialogMode.value === 'edit' ? '已保存修改' : '已新增分类')
    dialogVisible.value = false
    await loadTree()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  }
}

async function handleDelete(node: CategoryNode) {
  if (node.children?.length) {
    ElMessage.warning('该分类下存在子分类，无法删除')
    return
  }
  if (node.product_count > 0) {
    ElMessage.warning(`该分类下存在 ${node.product_count} 个商品，无法直接删除`)
    return
  }
  try {
    await ElMessageBox.confirm(`确定删除分类「${node.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await categoryApi.remove(Number(node.id))
    if (selectedNode.value?.id === node.id) selectedNode.value = null
    ElMessage.success('已删除')
    await loadTree()
  } catch (error: any) {
    if (error !== 'cancel') ElMessage.error(error?.message || '删除失败')
  }
}

async function handleToggle(node: CategoryNode) {
  const next = !node.enabled
  try {
    await categoryApi.update(Number(node.id), { status: next ? 1 : 0 })
    node.enabled = next
    ElMessage.success(`已${next ? '启用' : '停用'}「${node.name}」`)
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败')
  }
}
</script>

<template>
  <div class="category-page">
    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" class="mb-12">
      <template #default>
        <span>分类数据加载失败。</span>
        <el-button type="danger" size="small" link @click="loadTree">点击重试</el-button>
      </template>
    </el-alert>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon gold"><el-icon><FolderOpened /></el-icon></div>
        <div class="stat-body"><div class="stat-label">分类总数</div><div class="stat-value">{{ stats.total }}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><el-icon><Document /></el-icon></div>
        <div class="stat-body"><div class="stat-label">一级分类</div><div class="stat-value">{{ stats.level1 }}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><el-icon><FolderOpened /></el-icon></div>
        <div class="stat-body"><div class="stat-label">启用中</div><div class="stat-value">{{ stats.enabled }}</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><el-icon><Goods /></el-icon></div>
        <div class="stat-body"><div class="stat-label">关联商品</div><div class="stat-value">{{ stats.products }}</div></div>
      </div>
    </div>

    <div class="main-layout">
      <el-card class="tree-card" shadow="never" v-loading="loading">
        <template #header>
          <div class="tree-header">
            <span class="tree-title">分类树</span>
            <el-button type="primary" :icon="Plus" size="small" @click="openCreateRoot">一级分类</el-button>
          </div>
        </template>
        <el-input
          v-model="filterText"
          placeholder="搜索分类名称 / 编码"
          clearable
          :prefix-icon="Search"
          class="tree-search"
          @input="handleFilter"
        />
        <el-tree
          ref="treeRef"
          :data="treeData"
          :props="treeProps"
          node-key="id"
          :default-expanded-keys="expandedKeys"
          :filter-node-method="filterNode"
          :expand-on-click-node="false"
          highlight-current
          class="cat-tree"
          @node-click="handleNodeClick"
        >
          <template #default="{ data }">
            <div class="tree-node">
              <div class="tree-node-main">
                <el-icon class="tree-icon">
                  <FolderOpened v-if="data.children && data.children.length" />
                  <Document v-else />
                </el-icon>
                <span :class="['tree-name', { disabled: !data.enabled }]">{{ data.name }}</span>
                <span class="tree-code">{{ data.code }}</span>
                <el-tag v-if="!data.enabled" size="small" type="info">停用</el-tag>
              </div>
              <div class="tree-node-actions">
                <el-button link type="primary" :icon="Plus" @click.stop="openCreateSub(data)">子类</el-button>
                <el-button link type="primary" :icon="Edit" @click.stop="openEdit(data)">编辑</el-button>
                <el-button link :type="data.enabled ? 'warning' : 'success'" @click.stop="handleToggle(data)">
                  {{ data.enabled ? '停用' : '启用' }}
                </el-button>
                <el-button link type="danger" :icon="Delete" @click.stop="handleDelete(data)">删除</el-button>
              </div>
            </div>
          </template>
        </el-tree>
      </el-card>

      <el-card class="detail-card" shadow="never">
        <template #header><span class="tree-title">分类详情</span></template>
        <el-empty v-if="!selectedNode" description="请选择左侧分类" />
        <el-descriptions v-else :column="1" border>
          <el-descriptions-item label="分类名称">{{ selectedNode.name }}</el-descriptions-item>
          <el-descriptions-item label="分类编码">{{ selectedNode.code }}</el-descriptions-item>
          <el-descriptions-item label="排序">{{ selectedNode.sort }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ selectedNode.enabled ? '启用' : '停用' }}</el-descriptions-item>
          <el-descriptions-item label="关联商品">{{ selectedNode.product_count }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ selectedNode.description || '-' }}</el-descriptions-item>
        </el-descriptions>
      </el-card>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="formModel" :rules="rules" label-width="100px">
        <el-form-item label="分类名称" prop="name"><el-input v-model="formModel.name" /></el-form-item>
        <el-form-item label="分类编码" prop="code"><el-input v-model="formModel.code" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="formModel.sort" :min="0" :max="999" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="formModel.enabled" active-text="启用" inactive-text="停用" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="formModel.description" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.category-page { padding: 20px; }
.mb-12 { margin-bottom: 12px; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.stat-card { display: flex; align-items: center; gap: 12px; padding: 18px; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; }
.stat-icon { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #fff; font-size: 20px; }
.stat-icon.gold { background: #c8a96a; }
.stat-icon.blue { background: #409eff; }
.stat-icon.green { background: #67c23a; }
.stat-icon.red { background: #f56c6c; }
.stat-label { color: #909399; font-size: 13px; }
.stat-value { margin-top: 4px; font-size: 22px; font-weight: 700; color: #303133; }
.main-layout { display: grid; grid-template-columns: minmax(640px, 1fr) 360px; gap: 16px; }
.tree-header { display: flex; align-items: center; justify-content: space-between; }
.tree-title { font-size: 16px; font-weight: 600; color: #303133; }
.tree-search { margin-bottom: 14px; }
.cat-tree { min-height: 420px; }
.tree-node { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-right: 8px; }
.tree-node-main { min-width: 0; display: flex; align-items: center; gap: 8px; }
.tree-icon { color: #c8a96a; }
.tree-name { font-weight: 500; color: #303133; }
.tree-name.disabled { color: #a8abb2; }
.tree-code { color: #909399; font-size: 12px; }
.tree-node-actions { display: none; align-items: center; gap: 4px; }
.tree-node:hover .tree-node-actions { display: flex; }
.detail-card { min-height: 520px; }
@media (max-width: 1200px) { .stats-row { grid-template-columns: repeat(2, 1fr); } .main-layout { grid-template-columns: 1fr; } }
</style>
