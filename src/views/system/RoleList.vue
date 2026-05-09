<template>
  <div class="role-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">角色权限</h2>
        <p class="page-subtitle">角色维护与菜单/操作权限分配</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增角色</el-button>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadRoles">点击重试</el-button>
      </template>
    </el-alert>

    <div class="main-layout">
      <!-- 左侧角色列表 -->
      <el-card class="role-list-card" shadow="never">
        <template #header>
          <div class="card-title">角色列表</div>
        </template>
        <div class="role-list">
          <div
            v-for="r in roleList"
            :key="r.id"
            class="role-item"
            :class="{ active: currentRole?.id === r.id }"
            @click="selectRole(r)"
          >
            <div class="role-item-main">
              <div class="role-name">{{ r.name }}</div>
              <div class="role-code">{{ r.code }}</div>
            </div>
            <el-tag size="small" :type="r.accounts > 0 ? 'primary' : 'info'">
              {{ r.accounts }} 人
            </el-tag>
          </div>
        </div>
      </el-card>

      <!-- 右侧权限配置 -->
      <el-card class="perm-card" shadow="never">
        <template #header>
          <div class="perm-header">
            <div>
              <div class="perm-title">{{ currentRole?.name || '请选择角色' }}</div>
              <div v-if="currentRole" class="perm-meta">
                角色编码：{{ currentRole.code }} · {{ currentRole.accounts }} 位成员 · {{ currentRole.desc }}
              </div>
            </div>
            <div v-if="currentRole" class="perm-actions">
              <el-button :icon="Edit" @click="handleEditRole">编辑角色</el-button>
              <el-button type="primary" :icon="Check" @click="handleSavePerm">保存权限</el-button>
            </div>
          </div>
        </template>

        <div v-if="!currentRole" class="empty">
          <el-empty description="从左侧选择一个角色以配置权限" />
        </div>

        <div v-else class="perm-body">
          <el-tabs v-model="activeTab">
            <el-tab-pane label="菜单权限" name="menu">
              <div class="perm-tip">
                勾选允许该角色访问的菜单节点。父节点会级联控制子节点的可见性。
              </div>
              <el-tree
                ref="menuTreeRef"
                :data="menuTree"
                show-checkbox
                node-key="key"
                :default-checked-keys="checkedMenus"
                :default-expand-all="true"
                :expand-on-click-node="false"
              >
                <template #default="{ node }">
                  <div class="tree-node">
                    <span class="tree-label">{{ node.label }}</span>
                  </div>
                </template>
              </el-tree>
            </el-tab-pane>

            <el-tab-pane label="数据权限" name="data">
              <el-form label-width="130px" class="data-form">
                <el-form-item label="订单数据范围">
                  <el-radio-group v-model="dataScope.order">
                    <el-radio value="all">全部订单</el-radio>
                    <el-radio value="dept">本部门订单</el-radio>
                    <el-radio value="self">仅本人订单</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="客户数据范围">
                  <el-radio-group v-model="dataScope.customer">
                    <el-radio value="all">全部客户</el-radio>
                    <el-radio value="dept">本部门客户</el-radio>
                    <el-radio value="self">仅跟进客户</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item label="仓库数据范围">
                  <el-checkbox-group v-model="dataScope.warehouses">
                    <el-checkbox value="main">主仓（景德镇）</el-checkbox>
                    <el-checkbox value="east">华东仓（上海）</el-checkbox>
                    <el-checkbox value="south">华南仓（广州）</el-checkbox>
                  </el-checkbox-group>
                </el-form-item>
                <el-form-item label="数据导出权限">
                  <el-switch v-model="dataScope.canExport" />
                  <span class="form-tip inline">是否允许该角色导出 Excel / CSV 报表</span>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="操作按钮权限" name="action">
              <el-table :data="actionList" border size="small">
                <el-table-column label="模块" prop="module" width="140" />
                <el-table-column label="操作" prop="action" />
                <el-table-column label="允许" width="90" align="center">
                  <template #default="{ row }">
                    <el-switch v-model="row.enabled" />
                  </template>
                </el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { ElTree } from 'element-plus'
import { Plus, Edit, Check } from '@element-plus/icons-vue'
import { roleApi } from '@/api/role'

interface Role {
  id: number
  code: string
  name: string
  accounts: number
  desc: string
  menuPerms: string[]
  dataPerms: any
  apiPerms: any
  status: number
}

const roleList = ref<Role[]>([])
const currentRole = ref<Role | null>(null)
const loadError = ref('')
const menuTreeRef = ref<InstanceType<typeof ElTree>>()

async function loadRoles() {
  loadError.value = ''
  try {
    const res: any = await roleApi.list()
    const rows = (res?.list ?? res ?? []) as any[]
    roleList.value = (Array.isArray(rows) ? rows : []).map((r: any, i: number) => ({
      id: r.id ?? i + 1,
      code: r.code || '',
      name: r.name || '',
      accounts: Number(r._count?.users ?? r.accountCount ?? r.accounts ?? 0),
      desc: r.description || r.desc || '',
      menuPerms: Array.isArray(r.menuPerms) ? r.menuPerms : [],
      dataPerms: r.dataPerms || {},
      apiPerms: r.apiPerms || [],
      status: Number(r.status ?? 1),
    }))
    currentRole.value = roleList.value[0] ?? null
    if (currentRole.value) applyRolePermissions(currentRole.value)
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    roleList.value = []
    currentRole.value = null
  }
}

onMounted(loadRoles)

const activeTab = ref('menu')

const menuTree = [
  {
    key: 'dashboard', label: '控制台',
  },
  {
    key: 'product', label: '商品管理',
    children: [
      { key: 'product.list', label: '商品列表' },
      { key: 'product.category', label: '分类管理' },
    ],
  },
  {
    // 库存管理简化版：单页权限即可
    key: 'inventory.stock', label: '库存管理',
  },
  {
    key: 'order', label: '订单管理',
    children: [
      { key: 'order.retail', label: '零售订单' },
      { key: 'order.wholesale', label: '批发订单' },
    ],
  },
  {
    key: 'user', label: '用户管理',
    children: [
      { key: 'user.customer', label: '零售客户' },
      { key: 'user.distributor', label: '批发客商' },
    ],
  },
  {
    key: 'system', label: '系统管理',
    children: [
      { key: 'system.account', label: '账号管理' },
      { key: 'system.role', label: '角色权限' },
      { key: 'system.log', label: '操作日志' },
    ],
  },
]

const checkedMenus = ref<string[]>([
  'dashboard', 'product.list', 'product.category',
  'inventory.stock',
  'order.retail', 'order.wholesale', 'user.customer', 'user.distributor',
])

const dataScope = reactive({
  order: 'all',
  customer: 'dept',
  warehouses: ['main', 'east', 'south'] as string[],
  canExport: true,
})

const actionList = reactive([
  { module: '商品管理', action: '新增商品', enabled: true },
  { module: '商品管理', action: '编辑商品', enabled: true },
  { module: '商品管理', action: '删除商品', enabled: false },
  { module: '商品管理', action: '批量上下架', enabled: true },
  { module: '库存管理', action: '库存调整', enabled: true },
  { module: '库存管理', action: '生成采购单', enabled: true },
  { module: '订单管理', action: '订单发货', enabled: true },
  { module: '订单管理', action: '订单退款', enabled: false },
  { module: '用户管理', action: '调整积分', enabled: true },
  { module: '用户管理', action: '冻结账号', enabled: false },
  { module: '系统管理', action: '创建账号', enabled: false },
])

function actionKey(item: { module: string; action: string }) {
  return `${item.module}:${item.action}`
}

function applyRolePermissions(role: Role) {
  checkedMenus.value = role.menuPerms || []
  const data = role.dataPerms || {}
  dataScope.order = data.order || data.scope || 'all'
  dataScope.customer = data.customer || data.scope || 'all'
  dataScope.warehouses = Array.isArray(data.warehouses) ? data.warehouses : ['main', 'east', 'south']
  dataScope.canExport = data.canExport !== false
  const enabledActions = Array.isArray(role.apiPerms) ? role.apiPerms : []
  actionList.forEach((item) => {
    item.enabled = enabledActions.includes(actionKey(item))
  })
  nextTick(() => {
    menuTreeRef.value?.setCheckedKeys(checkedMenus.value)
  })
}

function selectRole(r: Role) {
  currentRole.value = r
  applyRolePermissions(r)
}

async function handleCreate() {
  try {
    const name = await ElMessageBox.prompt('请输入角色名称', '新增角色', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPattern: /^.{2,20}$/,
      inputErrorMessage: '角色名称需为 2-20 个字符',
    })
    const code = `custom_${Date.now().toString().slice(-6)}`
    await roleApi.create({ name: name.value, code, description: '', permissions: [], status: 1 })
    ElMessage.success('角色已创建')
    await loadRoles()
  } catch {
    // 用户取消
  }
}

async function handleEditRole() {
  if (!currentRole.value) return
  try {
    const name = await ElMessageBox.prompt('请输入角色名称', '编辑角色', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputValue: currentRole.value.name,
      inputPattern: /^.{2,20}$/,
      inputErrorMessage: '角色名称需为 2-20 个字符',
    })
    await roleApi.update(currentRole.value.id, {
      name: name.value,
      description: currentRole.value.desc,
      status: currentRole.value.status,
    })
    ElMessage.success('角色信息已更新')
    await loadRoles()
  } catch {
    // 用户取消
  }
}

async function handleSavePerm() {
  if (!currentRole.value) return
  const permissions = menuTreeRef.value?.getCheckedKeys(false).map(String) || checkedMenus.value
  const apiPerms = actionList.filter((item) => item.enabled).map(actionKey)
  try {
    await roleApi.update(currentRole.value.id, {
      menuPerms: permissions,
      dataPerms: { ...dataScope },
      apiPerms,
    })
    currentRole.value.menuPerms = permissions
    currentRole.value.dataPerms = { ...dataScope }
    currentRole.value.apiPerms = apiPerms
    ElMessage.success(`角色「${currentRole.value.name}」的权限配置已保存`)
  } catch (error: any) {
    ElMessage.error(error?.message || '保存权限失败')
  }
}
</script>

<style scoped>
.role-page { padding: 20px; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2d3d; }
.page-subtitle { margin: 4px 0 0; font-size: 13px; color: #909399; }

.main-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
}

.role-list-card, .perm-card { border-radius: 8px; }

.card-title { font-size: 15px; font-weight: 600; color: #1f2d3d; }

.role-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: -8px;
}
.role-item {
  padding: 12px 14px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.15s;
  border: 1px solid transparent;
}
.role-item:hover { background: #f5f7fa; }
.role-item.active {
  background: rgba(200, 169, 106, 0.1);
  border-color: #c8a96a;
}
.role-item.active .role-name { color: #c8a96a; }
.role-name { font-size: 14px; font-weight: 600; color: #1f2d3d; }
.role-code { font-size: 12px; color: #909399; font-family: 'Courier New', monospace; margin-top: 2px; }

.perm-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}
.perm-title { font-size: 16px; font-weight: 600; color: #1f2d3d; }
.perm-meta { font-size: 12px; color: #909399; margin-top: 4px; }
.perm-actions { display: flex; gap: 8px; }

.empty { padding: 40px 0; }

.perm-tip {
  background: #f4f5f7;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 13px;
  color: #606266;
  margin-bottom: 14px;
}

.tree-node { display: flex; align-items: center; }
.tree-label { font-size: 13px; }

.data-form :deep(.el-form-item) { margin-bottom: 20px; }
.form-tip { font-size: 12px; color: #909399; }
.form-tip.inline { margin-left: 12px; }
</style>
