<template>
  <div class="account-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">账号管理</h2>
        <p class="page-subtitle">后台操作员账号、角色、部门管理</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增账号</el-button>
    </div>

    <el-alert v-if="loadError" :title="loadError" type="error" show-icon :closable="false" style="margin-bottom: 12px">
      <template #default>
        <span>后端服务不可用。</span>
        <el-button type="danger" size="small" link @click="loadAccounts">点击重试</el-button>
      </template>
    </el-alert>

    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="关键字">
          <el-input v-model="filter.keyword" placeholder="账号 / 姓名 / 手机号" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="filter.roleId" placeholder="全部" clearable style="width: 160px">
            <el-option v-for="r in roleList" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
            <el-option label="锁定" value="locked" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="loadAccounts">查询</el-button>
          <el-button :icon="RefreshLeft" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="accountList" stripe border>
        <el-table-column label="账号信息" min-width="220">
          <template #default="{ row }">
            <div class="account-cell">
              <el-avatar :size="40">{{ row.name.charAt(0) }}</el-avatar>
              <div>
                <div class="username">{{ row.username }}</div>
                <div class="name">{{ row.name }} · {{ row.phone }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="140">
          <template #default="{ row }">
            <el-tag type="primary" size="small">{{ row.roleName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="部门" prop="dept" width="140" />
        <el-table-column label="邮箱" prop="email" min-width="180" />
        <el-table-column label="最近登录" min-width="200">
          <template #default="{ row }">
            <div>{{ row.lastLogin }}</div>
            <div class="muted">IP: {{ row.lastIp }}</div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createdAt" width="170" />
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="warning" @click="handleResetPassword(row)">重置密码</el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'danger' : 'success'"
              @click="handleToggle(row)"
            >
              {{ row.status === 'active' ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增 / 编辑 对话框 -->
    <el-dialog v-model="dialogVisible" :title="mode === 'create' ? '新增账号' : '编辑账号'" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" :disabled="mode === 'edit'" placeholder="建议字母 + 数字" />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="form.realName" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
        </el-form-item>
        <!-- 密码：仅新增时显示。编辑时若需改密走"重置密码"入口，更显式 -->
        <el-form-item v-if="mode === 'create'" label="登录密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="至少 8 位，含字母和数字"
            show-password
            autocomplete="new-password"
            maxlength="32"
          />
        </el-form-item>
        <el-form-item v-if="mode === 'create'" label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="再次输入登录密码"
            show-password
            autocomplete="new-password"
            maxlength="32"
          />
        </el-form-item>
        <el-form-item label="所属部门">
          <el-select v-model="form.dept" style="width: 100%">
            <el-option label="总经办" value="总经办" />
            <el-option label="销售中心" value="销售中心" />
            <el-option label="运营中心" value="运营中心" />
            <el-option label="仓储物流" value="仓储物流" />
            <el-option label="客户服务" value="客户服务" />
            <el-option label="财务部" value="财务部" />
          </el-select>
        </el-form-item>
        <el-form-item label="分配角色" prop="roleId">
          <el-select v-model="form.roleId" style="width: 100%">
            <el-option v-for="r in roleList" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, RefreshLeft } from '@element-plus/icons-vue'
import { accountApi } from '@/api/account'
import { roleApi } from '@/api/role'

interface Account {
  id: number
  username: string
  name: string
  phone: string
  email: string
  dept: string
  roleId: number | null
  roleName: string
  lastLogin: string
  lastIp: string
  status: 'active' | 'inactive'
  createdAt: string
}

interface RoleItem {
  id: number
  code: string
  name: string
  accounts: number
  desc: string
}

const roleList = ref<RoleItem[]>([])
const loading = ref(false)
const submitting = ref(false)

async function loadRoles() {
  try {
    const res: any = await roleApi.list()
    const rows: any[] = Array.isArray(res) ? res : (res?.list ?? [])
    roleList.value = rows.map((r: any) => ({
      id: r.id,
      code: r.code || '',
      name: r.name || '',
      accounts: r._count?.users ?? r.accountCount ?? 0,
      desc: r.description || '',
    }))
  } catch {
    console.warn('加载角色列表失败')
  }
}

const filter = reactive({ keyword: '', roleId: null as number | null, status: '' })

const accountList = ref<Account[]>([])
const loadError = ref('')

function mapAccountRow(r: any): Account {
  const firstRole = r.role ?? r.roles?.[0]
  return {
    id: r.id,
    username: r.username || '',
    name: r.realName || r.name || '',
    phone: r.phone || '',
    email: r.email || '',
    dept: r.department || r.dept || '',
    roleId: r.roleId ?? firstRole?.id ?? null,
    roleName: firstRole?.name || r.roleName || '未分配',
    lastLogin: r.lastLoginAt || r.lastLogin || '',
    lastIp: r.lastLoginIp || r.lastIp || '',
    status: typeof r.status === 'number' ? (r.status === 1 ? 'active' : 'inactive') : (r.status || 'active'),
    createdAt: r.createdAt || '',
  }
}

async function loadAccounts() {
  loadError.value = ''
  loading.value = true
  try {
    const params: any = { page: 1, pageSize: 100 }
    if (filter.keyword) params.keyword = filter.keyword
    if (filter.roleId) params.roleId = filter.roleId
    if (filter.status) params.status = filter.status
    const res: any = await accountApi.list(params)
    const rows = (res?.list ?? []) as any[]
    accountList.value = rows.map(mapAccountRow)
  } catch (e: any) {
    loadError.value = e?.message || '后端服务不可用'
    accountList.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadRoles()
  loadAccounts()
})

function statusType(s: string): 'success' | 'info' {
  return s === 'active' ? 'success' : 'info'
}
function statusText(s: string) {
  return s === 'active' ? '启用' : '停用'
}

const dialogVisible = ref(false)
const mode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()
const form = reactive({
  id: 0,
  username: '',
  realName: '',
  phone: '',
  email: '',
  dept: '',
  roleId: null as number | null,
  password: '',
  confirmPassword: '',
  status: 'active' as 'active' | 'inactive',
})

// 密码强度：8-32 位，至少含字母 + 数字（不强制特殊字符，避免运营吐槽）
const STRONG_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]{8,32}$/

const rules: FormRules = {
  username: [
    { required: true, message: '请输入登录账号', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_]{4,20}$/u, message: '4-20 位字母/数字/下划线', trigger: 'blur' },
  ],
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/u, message: '请输入正确的 11 位手机号', trigger: 'blur' },
  ],
  roleId: [{ required: true, message: '请选择角色', trigger: 'change' }],
  // 密码字段：编辑模式下不渲染对应输入框，所以即便 required 也不会触发
  password: [
    { required: true, message: '请输入登录密码', trigger: 'blur' },
    {
      validator: (_rule, val: string, cb) => {
        if (mode.value !== 'create') return cb()
        if (!val) return cb(new Error('请输入登录密码'))
        if (!STRONG_PASSWORD.test(val)) {
          return cb(new Error('密码 8-32 位且必须同时包含字母和数字'))
        }
        cb()
      },
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    {
      validator: (_rule, val: string, cb) => {
        if (mode.value !== 'create') return cb()
        if (!val) return cb(new Error('请再次输入登录密码'))
        if (val !== form.password) return cb(new Error('两次输入的密码不一致'))
        cb()
      },
      trigger: 'blur',
    },
  ],
}

function handleCreate() {
  mode.value = 'create'
  Object.assign(form, {
    id: 0, username: '', realName: '', phone: '', email: '', dept: '运营中心',
    roleId: null, password: '', confirmPassword: '',
    status: 'active',
  })
  // resetFields 必须在 v-model 已绑定值之后调，nextTick 保险
  setTimeout(() => formRef.value?.resetFields(), 0)
  dialogVisible.value = true
}

function handleEdit(row: Account) {
  mode.value = 'edit'
  Object.assign(form, {
    id: row.id,
    username: row.username,
    realName: row.name,
    phone: row.phone,
    email: row.email,
    dept: row.dept,
    roleId: row.roleId,
    password: '',
    confirmPassword: '',
    status: row.status,
  })
  setTimeout(() => formRef.value?.resetFields(), 0)
  dialogVisible.value = true
}

async function handleToggle(row: Account) {
  const nextStatus = row.status === 'active' ? 'inactive' : 'active'
  try {
    await accountApi.update(row.id, { status: nextStatus })
    row.status = nextStatus
    ElMessage.success(`已${row.status === 'active' ? '启用' : '停用'}账号：${row.username}`)
  } catch (error: any) {
    ElMessage.error(error?.message || '操作失败')
  }
}

async function handleResetPassword(row: Account) {
  // 弹出输入框让管理员填新密码；不填则不允许提交（不再回退到默认 123456）
  let newPwd = ''
  try {
    const res = await ElMessageBox.prompt(
      `请为账号「${row.username}」设置新的登录密码：`,
      '重置密码',
      {
        confirmButtonText: '确认重置',
        cancelButtonText: '取消',
        inputType: 'password',
        inputPlaceholder: '8-32 位，必须同时包含字母和数字',
        inputValidator: (val: string) => {
          if (!val) return '请输入新密码'
          if (!STRONG_PASSWORD.test(val)) return '密码 8-32 位且必须同时包含字母和数字'
          return true
        },
      },
    )
    newPwd = res.value
  } catch {
    return // 用户取消
  }
  try {
    await accountApi.resetPassword(row.id, newPwd)
    ElMessage.success(`已为「${row.username}」重置密码`)
  } catch (error: any) {
    ElMessage.error(error?.message || '重置失败')
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const payload = {
    username: form.username,
    realName: form.realName,
    phone: form.phone,
    email: form.email,
    department: form.dept,
    roleId: form.roleId,
    password: form.password || undefined,
    status: form.status,
  }
  try {
    if (mode.value === 'create') {
      await accountApi.create(payload)
      ElMessage.success('账号创建成功')
    } else {
      await accountApi.update(form.id, payload)
      ElMessage.success('已更新')
    }
    dialogVisible.value = false
    await loadAccounts()
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  }
}

function handleReset() {
  filter.keyword = ''
  filter.roleId = null
  filter.status = ''
}
</script>

<style scoped>
.account-page { padding: 20px; }

.page-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; font-weight: 600; color: #1f2d3d; }
.page-subtitle { margin: 4px 0 0; font-size: 13px; color: #909399; }

.filter-card { margin-bottom: 16px; border-radius: 8px; }
.filter-form :deep(.el-form-item) { margin-bottom: 0; }
.content-card { border-radius: 8px; }

.account-cell { display: flex; align-items: center; gap: 10px; }
.username { font-size: 14px; font-weight: 600; color: #1f2d3d; }
.name { font-size: 12px; color: #909399; margin-top: 2px; }
.muted { font-size: 12px; color: #909399; }
</style>
