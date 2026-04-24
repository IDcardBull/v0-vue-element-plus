<script setup lang="ts">
import { ref, reactive, computed, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import {
  Plus,
  Edit,
  Delete,
  Sort,
  FolderOpened,
  Document,
  Search,
  Goods,
} from '@element-plus/icons-vue'
import { categoryApi } from '@/api/category'

/* ----------------------------------- 类型 ---------------------------------- */
interface Category {
  id: string
  name: string
  code: string
  icon?: string
  sort: number
  enabled: boolean
  product_count: number
  description?: string
  children?: Category[]
}

/* --------------------------------- 默认数据（后端未就绪时的兜底） -------------------------------- */
const fallbackTree: Category[] = ([
  {
    id: 'c-1',
    name: '茶具',
    code: 'TEAWARE',
    sort: 1,
    enabled: true,
    product_count: 128,
    description: '茶壶、茶杯、茶海、盖碗等饮茶器具',
    children: [
      {
        id: 'c-1-1',
        name: '茶壶',
        code: 'TEA-POT',
        sort: 1,
        enabled: true,
        product_count: 48,
        children: [
          { id: 'c-1-1-1', name: '紫砂壶', code: 'TP-ZISHA', sort: 1, enabled: true, product_count: 22 },
          { id: 'c-1-1-2', name: '陶瓷壶', code: 'TP-TC', sort: 2, enabled: true, product_count: 18 },
          { id: 'c-1-1-3', name: '玻璃壶', code: 'TP-GLASS', sort: 3, enabled: false, product_count: 8 },
        ],
      },
      {
        id: 'c-1-2',
        name: '主人杯',
        code: 'TEA-CUP',
        sort: 2,
        enabled: true,
        product_count: 52,
      },
      {
        id: 'c-1-3',
        name: '盖碗',
        code: 'TEA-GAIWAN',
        sort: 3,
        enabled: true,
        product_count: 28,
      },
    ],
  },
  {
    id: 'c-2',
    name: '花瓶',
    code: 'VASE',
    sort: 2,
    enabled: true,
    product_count: 64,
    description: '观赏类陶瓷花瓶',
    children: [
      { id: 'c-2-1', name: '长颈瓶', code: 'VS-LONG', sort: 1, enabled: true, product_count: 24 },
      { id: 'c-2-2', name: '观音瓶', code: 'VS-GY', sort: 2, enabled: true, product_count: 18 },
      { id: 'c-2-3', name: '天球瓶', code: 'VS-TQ', sort: 3, enabled: true, product_count: 22 },
    ],
  },
  {
    id: 'c-3',
    name: '餐具',
    code: 'DINNERWARE',
    sort: 3,
    enabled: true,
    product_count: 92,
    description: '日用餐具套装',
    children: [
      { id: 'c-3-1', name: '碗', code: 'DW-BOWL', sort: 1, enabled: true, product_count: 38 },
      { id: 'c-3-2', name: '盘', code: 'DW-PLATE', sort: 2, enabled: true, product_count: 28 },
      { id: 'c-3-3', name: '勺筷架', code: 'DW-HOLDER', sort: 3, enabled: true, product_count: 26 },
    ],
  },
  {
    id: 'c-4',
    name: '摆件',
    code: 'ORNAMENT',
    sort: 4,
    enabled: true,
    product_count: 36,
  },
  {
    id: 'c-5',
    name: '下架类目',
    code: 'DEPRECATED',
    sort: 99,
    enabled: false,
    product_count: 0,
    description: '已停用的历史分类归档',
  },
])

const treeData = ref<Category[]>([])
const loading = ref(false)

/** 把后端返回的扁平/嵌套分类数据规范化成树 */
function normalize(list: any[]): Category[] {
  return (list || []).map((n) => ({
    id: String(n.id),
    name: n.name,
    code: n.code || '',
    sort: n.sort ?? 0,
    enabled: n.status === 'active' || n.enabled === true,
    product_count: n.productCount ?? 0,
    description: n.description || '',
    children: n.children?.length ? normalize(n.children) : undefined,
  }))
}

async function loadTree() {
  loading.value = true
  try {
    const res: any = await categoryApi.tree()
    const list = Array.isArray(res) ? res : res?.list || []
    treeData.value = list.length ? normalize(list) : fallbackTree
  } catch {
    treeData.value = fallbackTree
  } finally {
    loading.value = false
  }
}

onMounted(loadTree)

/* --------------------------------- 树状态 --------------------------------- */
const filterText = ref('')
const treeRef = ref()
const expandedKeys = ref<string[]>(['c-1', 'c-1-1', 'c-2', 'c-3'])

const treeProps = {
  children: 'children',
  label: 'name',
}

function filterNode(value: string, data: Category) {
  if (!value) return true
  return data.name.includes(value) || data.code.includes(value)
}

function handleFilter(val: string) {
  treeRef.value?.filter(val)
}

/* --------------------------------- 选中节点 -------------------------------- */
const selectedNode = ref<Category | null>(null)

function handleNodeClick(data: Category) {
  selectedNode.value = data
}

/* --------------------------------- 统计数据 -------------------------------- */
function flatten(list: Category[]): Category[] {
  const result: Category[] = []
  const walk = (arr: Category[]) => {
    for (const c of arr) {
      result.push(c)
      if (c.children?.length) walk(c.children)
    }
  }
  walk(list)
  return result
}

const stats = computed(() => {
  const all = flatten(treeData.value)
  return {
    total: all.length,
    level1: treeData.value.length,
    enabled: all.filter((c) => c.enabled).length,
    products: all.reduce((s, c) => s + c.product_count, 0),
  }
})

/* --------------------------------- Dialog -------------------------------- */
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit' | 'createSub'>('create')
const dialogTitle = computed(() => {
  if (dialogMode.value === 'create') return '新增一级分类'
  if (dialogMode.value === 'createSub')
    return `新增「${dialogParentName.value}」的子分类`
  return '编辑分类'
})
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

function openCreateSub(parent: Category) {
  dialogMode.value = 'createSub'
  dialogParentId.value = parent.id
  dialogParentName.value = parent.name
  resetForm()
  formModel.sort = (parent.children?.length || 0) + 1
  dialogVisible.value = true
}

function openEdit(node: Category) {
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

function findNode(list: Category[], id: string): Category | null {
  for (const c of list) {
    if (c.id === id) return c
    if (c.children) {
      const hit = findNode(c.children, id)
      if (hit) return hit
    }
  }
  return null
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload: any = {
    name: formModel.name,
    code: formModel.code,
    sort: formModel.sort,
    status: formModel.enabled ? 'active' : 'inactive',
    description: formModel.description,
  }
  if (dialogMode.value === 'createSub' && dialogParentId.value) {
    payload.parentId = Number(dialogParentId.value.replace(/\D/g, ''))
  }

  try {
    if (dialogMode.value === 'edit') {
      await categoryApi.update(formModel.id as any, payload)
    } else {
      await categoryApi.create(payload)
    }
    ElMessage.success(dialogMode.value === 'edit' ? '已保存修改' : '已新增分类')
    dialogVisible.value = false
    loadTree()
    return
  } catch {
    // 后端未就绪：回退到本地 mock 操作
  }

  if (dialogMode.value === 'edit') {
    const target = findNode(treeData.value, formModel.id)
    if (target) {
      target.name = formModel.name
      target.code = formModel.code
      target.sort = formModel.sort
      target.enabled = formModel.enabled
      target.description = formModel.description
    }
    ElMessage.success('已保存修改')
  } else {
    const newNode: Category = {
      id: `c-${Date.now()}`,
      name: formModel.name,
      code: formModel.code,
      sort: formModel.sort,
      enabled: formModel.enabled,
      product_count: 0,
      description: formModel.description,
    }
    if (dialogMode.value === 'create') {
      treeData.value.push(newNode)
    } else if (dialogMode.value === 'createSub' && dialogParentId.value) {
      const parent = findNode(treeData.value, dialogParentId.value)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(newNode)
        await nextTick()
        if (!expandedKeys.value.includes(parent.id)) {
          expandedKeys.value.push(parent.id)
        }
      }
    }
    ElMessage.success('已新增分类')
  }
  dialogVisible.value = false
}

/* --------------------------------- 删除操作 -------------------------------- */
function handleDelete(node: Category) {
  const hasChildren = node.children && node.children.length > 0
  const hasProducts = node.product_count > 0
  if (hasChildren) {
    ElMessage.warning('该分类下存在子分类，无法删除')
    return
  }
  if (hasProducts) {
    ElMessage.warning(`该分类下存在 ${node.product_count} 个商品，无法直接删除`)
    return
  }
  ElMessageBox.confirm(`确定删除分类 "${node.name}" ？`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消',
  })
    .then(async () => {
      try {
        await categoryApi.remove(node.id as any)
        if (selectedNode.value?.id === node.id) selectedNode.value = null
        ElMessage.success('已删除')
        loadTree()
      } catch (e: any) {
        // 无后端时：本地删除
        function remove(list: Category[]): boolean {
          const idx = list.findIndex((c) => c.id === node.id)
          if (idx > -1) { list.splice(idx, 1); return true }
          for (const c of list) { if (c.children && remove(c.children)) return true }
          return false
        }
        remove(treeData.value)
        if (selectedNode.value?.id === node.id) selectedNode.value = null
        ElMessage.success('已删除')
      }
    })
    .catch(() => void 0)
}

async function handleToggle(node: Category) {
  const next = !node.enabled
  try {
    await categoryApi.update(node.id as any, { status: next ? 'active' : 'inactive' })
    node.enabled = next
    ElMessage.success(`已${next ? '启用' : '停用'} "${node.name}"`)
  } catch {
    node.enabled = next
    ElMessage.success(`已${next ? '启用' : '停用'} "${node.name}"`)
  }
}
</script>

<template>
  <div class="category-page">
    <!-- 顶部统计 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon gold">
          <el-icon><FolderOpened /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">分类总数</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue">
          <el-icon><Document /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">一级分类</div>
          <div class="stat-value">{{ stats.level1 }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <el-icon><FolderOpened /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">启用中</div>
          <div class="stat-value">{{ stats.enabled }}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">
          <el-icon><Goods /></el-icon>
        </div>
        <div class="stat-body">
          <div class="stat-label">关联商品</div>
          <div class="stat-value">{{ stats.products }}</div>
        </div>
      </div>
    </div>

    <!-- 两栏主体 -->
    <div class="main-layout">
      <!-- 左：树 -->
      <el-card class="tree-card" shadow="never">
        <template #header>
          <div class="tree-header">
            <span class="tree-title">分类树</span>
            <el-button type="primary" :icon="Plus" size="small" @click="openCreateRoot">
              一级分类
            </el-button>
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
          <template #default="{ node, data }">
            <div class="tree-node">
              <div class="tree-node-main">
                <el-icon class="tree-icon">
                  <FolderOpened v-if="data.children && data.children.length" />
                  <Document v-else />
                </el-icon>
                <span :class="['tree-name', { disabled: !data.enabled }]">
                  {{ data.name }}
                </span>
                <span class="tree-code">{{ data.code }}</span>
                <el-tag
                  v-if="!data.enabled"
                  size="small"
                  type="info"
                  effect="plain"
                >已停用</el-tag>
                <span v-if="data.product_count > 0" class="tree-count">
                  {{ data.product_count }}
                </span>
              </div>
              <div class="tree-node-actions">
                <el-tooltip content="新增子分类" placement="top">
                  <el-button
                    link
                    :icon="Plus"
                    size="small"
                    @click.stop="openCreateSub(data)"
                  />
                </el-tooltip>
                <el-tooltip content="编辑" placement="top">
                  <el-button
                    link
                    :icon="Edit"
                    size="small"
                    @click.stop="openEdit(data)"
                  />
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button
                    link
                    :icon="Delete"
                    size="small"
                    type="danger"
                    @click.stop="handleDelete(data)"
                  />
                </el-tooltip>
              </div>
            </div>
          </template>
        </el-tree>
      </el-card>

      <!-- 右：详情 -->
      <el-card class="detail-card" shadow="never">
        <template #header>
          <div class="tree-header">
            <span class="tree-title">分类详情</span>
            <div v-if="selectedNode" class="header-actions">
              <el-button :icon="Edit" size="small" @click="openEdit(selectedNode)">
                编辑
              </el-button>
              <el-button
                :type="selectedNode.enabled ? 'danger' : 'success'"
                size="small"
                plain
                @click="handleToggle(selectedNode)"
              >
                {{ selectedNode.enabled ? '停用' : '启用' }}
              </el-button>
            </div>
          </div>
        </template>

        <div v-if="selectedNode" class="detail-body">
          <div class="detail-banner">
            <div class="detail-banner-icon">
              <el-icon><FolderOpened /></el-icon>
            </div>
            <div>
              <div class="detail-banner-name">{{ selectedNode.name }}</div>
              <div class="detail-banner-code">
                编码：{{ selectedNode.code }}
              </div>
            </div>
            <el-tag
              v-if="selectedNode.enabled"
              type="success"
              effect="light"
              class="detail-status"
            >启用中</el-tag>
            <el-tag v-else type="info" effect="light" class="detail-status">
              已停用
            </el-tag>
          </div>

          <el-descriptions :column="2" border class="detail-desc">
            <el-descriptions-item label="排序权重">
              <el-icon class="inline-icon"><Sort /></el-icon>
              {{ selectedNode.sort }}
            </el-descriptions-item>
            <el-descriptions-item label="关联商品数">
              {{ selectedNode.product_count }}
            </el-descriptions-item>
            <el-descriptions-item label="子分类数">
              {{ selectedNode.children?.length || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              {{ selectedNode.enabled ? '启用中' : '已停用' }}
            </el-descriptions-item>
            <el-descriptions-item label="描述" :span="2">
              {{ selectedNode.description || '暂无描述' }}
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="selectedNode.children?.length" class="sub-list">
            <div class="sub-list-title">
              <span class="bar" />
              <span>子分类</span>
              <span class="sub-list-count">{{ selectedNode.children.length }}</span>
            </div>
            <div class="sub-grid">
              <div
                v-for="sub in selectedNode.children"
                :key="sub.id"
                class="sub-item"
                @click="handleNodeClick(sub)"
              >
                <div class="sub-item-head">
                  <el-icon><Document /></el-icon>
                  <span class="sub-item-name">{{ sub.name }}</span>
                  <el-tag
                    v-if="!sub.enabled"
                    size="small"
                    type="info"
                    effect="plain"
                  >停用</el-tag>
                </div>
                <div class="sub-item-meta">
                  <span>{{ sub.code }}</span>
                  <span>{{ sub.product_count }} 商品</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <el-empty
          v-else
          description="请选择左侧分类查看详情"
          :image-size="120"
        />
      </el-card>
    </div>

    <!-- 新增 / 编辑 Dialog -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form
        ref="formRef"
        :model="formModel"
        label-width="90px"
        :rules="{
          name: [{ required: true, message: '请输入分类名称' }],
          code: [
            { required: true, message: '请输入分类编码' },
            { pattern: /^[A-Z][A-Z0-9-]{1,20}$/, message: '大写字母开头，可含数字和短横线' },
          ],
        }"
      >
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="formModel.name" placeholder="如：茶壶" />
        </el-form-item>
        <el-form-item label="分类编码" prop="code">
          <el-input
            v-model="formModel.code"
            placeholder="如：TEA-POT"
            style="text-transform: uppercase"
          />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="排序权重">
              <el-input-number
                v-model="formModel.sort"
                :min="0"
                :max="999"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="是否启用">
              <el-switch v-model="formModel.enabled" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="描述">
          <el-input
            v-model="formModel.description"
            type="textarea"
            :rows="3"
            placeholder="简要说明该分类的定位与范围"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.category-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

/* stats */
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
.stat-icon.blue { background: #2d8cf0; }
.stat-icon.green { background: #67c23a; }
.stat-icon.red { background: #f56c6c; }
.stat-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: #1f2d3d;
  font-family: 'Geist Mono', 'Menlo', monospace;
}

/* main layout */
.main-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.tree-card,
.detail-card {
  display: flex;
  flex-direction: column;
  min-height: 600px;
}
.tree-card :deep(.el-card__body),
.detail-card :deep(.el-card__body) {
  flex: 1;
  overflow: auto;
  padding: 14px 18px;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.tree-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2d3d;
}
.header-actions { display: flex; gap: 6px; }

.tree-search {
  margin-bottom: 12px;
}
.cat-tree {
  background: transparent;
}
.cat-tree :deep(.el-tree-node__content) {
  height: 38px;
  border-radius: 4px;
}
.cat-tree :deep(.el-tree-node__content):hover {
  background: #fafbfc;
}
.cat-tree :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #faf5ea;
}
.tree-node {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 4px;
}
.tree-node-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.tree-icon {
  color: #c8a96a;
  font-size: 16px;
}
.tree-name {
  color: #1f2d3d;
  font-weight: 500;
}
.tree-name.disabled {
  color: #a8abb2;
  text-decoration: line-through;
}
.tree-code {
  font-size: 12px;
  color: #909399;
  font-family: 'Geist Mono', monospace;
}
.tree-count {
  min-width: 26px;
  padding: 0 6px;
  height: 18px;
  line-height: 18px;
  font-size: 11px;
  background: #f2f4f7;
  color: #606266;
  border-radius: 9px;
  text-align: center;
  font-family: 'Geist Mono', monospace;
}
.tree-node-actions {
  display: none;
  gap: 0;
}
.cat-tree :deep(.el-tree-node__content):hover .tree-node-actions {
  display: flex;
}

/* detail */
.detail-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.detail-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #faf5ea 0%, #ffffff 100%);
  border: 1px solid #f2e7d1;
  border-radius: 4px;
  position: relative;
}
.detail-banner-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: #c8a96a;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}
.detail-banner-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
}
.detail-banner-code {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  font-family: 'Geist Mono', monospace;
}
.detail-status {
  margin-left: auto;
}
.inline-icon {
  vertical-align: -2px;
  margin-right: 4px;
  color: #909399;
}

/* sub list */
.sub-list-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}
.sub-list-title .bar {
  width: 3px;
  height: 14px;
  background: #c8a96a;
  border-radius: 2px;
}
.sub-list-count {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}
.sub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.sub-item {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
}
.sub-item:hover {
  border-color: #c8a96a;
  background: #faf5ea;
  transform: translateY(-1px);
}
.sub-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.sub-item-head .el-icon {
  color: #c8a96a;
}
.sub-item-name {
  font-weight: 500;
  color: #1f2d3d;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-item-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
  font-family: 'Geist Mono', monospace;
}

@media (max-width: 1200px) {
  .main-layout { grid-template-columns: 1fr; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
