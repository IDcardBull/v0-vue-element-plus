<template>
  <div class="account-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">账号管理</h2>
        <p class="page-subtitle">后台操作员账号、角色、部门管理</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增账号</el-button>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="关键字">
          <el-input v-model="filter.keyword" placeholder="账号 / 姓名 / 手机号" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="filter.role" placeholder="全部" clearable style="width: 160px">
            <el-option v-for="r in roleList" :key="r.code" :label="r.name" :value="r.code" />
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
          <el-button type="primary" :icon="Search">查询</el-button>
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
            <el-button link type="warning" @click="handleReset2FA(row)">重置密码</el-button>
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
        <el-form-item label="真实姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" />
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
        <el-form-item label="分配角色" prop="roleCode">
          <el-select v-model="form.roleCode" style="width: 100%">
            <el-option v-for="r in roleList" :key="r.code" :label="r.name" :value="r.code" />
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
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, RefreshLeft } from '@element-plus/icons-vue'

interface Account {
  id: number
  username: string
  name: string
  phone: string
  email: string
  dept: string
  roleCode: string
  roleName: string
  lastLogin: string
  lastIp: string
  status: 'active' | 'inactive' | 'locked'
  createdAt: string
}

const roleList = [
  { code: 'super', name: '超级管理员' },
  { code: 'admin', name: '运营管理员' },
  { code: 'finance', name: '财务' },
  { code: 'warehouse', name: '仓管' },
  { code: 'cs', name: '客服' },
  { code: 'sales', name: '销售' },
]

const filter = reactive({ keyword: '', role: '', status: '' })

const accountList = ref<Account[]>([
  {
    id: 1,
    username: 'admin',
    name: '张建国',
    phone: '138****8800',
    email: 'zhang.jg@yangming.com',
    dept: '总经办',
    roleCode: 'super',
    roleName: '超级管理员',
    lastLogin: '2026-04-21 09:12:33',
    lastIp: '120.36.182.55',
    status: 'active',
    createdAt: '2023-06-10',
  },
  {
    id: 2,
    username: 'ops.lm',
    name: '李明',
    phone: '186****5521',
    email: 'li.ming@yangming.com',
    dept: '运营中心',
    roleCode: 'admin',
    roleName: '运营管理员',
    lastLogin: '2026-04-21 08:45:12',
    lastIp: '120.36.182.63',
    status: 'active',
    createdAt: '2023-09-15',
  },
  {
    id: 3,
    username: 'finance.wf',
    name: '王芳',
    phone: '139****2266',
    email: 'wang.fang@yangming.com',
    dept: '财务部',
    roleCode: 'finance',
    roleName: '财务',
    lastLogin: '2026-04-20 17:30:45',
    lastIp: '120.36.182.42',
    status: 'active',
    createdAt: '2023-11-02',
  },
  {
    id: 4,
    username: 'wh.zq',
    name: '赵勤',
    phone: '157****8080',
    email: 'zhao.qin@yangming.com',
    dept: '仓储物流',
    roleCode: 'warehouse',
    roleName: '仓管',
    lastLogin: '2026-04-21 07:58:20',
    lastIp: '120.36.182.88',
    status: 'active',
    createdAt: '2024-01-18',
  },
  {
    id: 5,
    username: 'cs.liu',
    name: '刘静',
    phone: '159****6611',
    email: 'liu.jing@yangming.com',
    dept: '客户服务',
    roleCode: 'cs',
    roleName: '客服',
    lastLogin: '2026-04-21 09:02:15',
    lastIp: '120.36.182.92',
    status: 'active',
    createdAt: '2024-03-08',
  },
  {
    id: 6,
    username: 'sales.hu',
    name: '胡伟',
    phone: '180****3344',
    email: 'hu.wei@yangming.com',
    dept: '销售中心',
    roleCode: 'sales',
    roleName: '销售',
    lastLogin: '2026-03-12 15:22:08',
    lastIp: '120.36.182.17',
    status: 'locked',
    createdAt: '2024-05-22',
  },
  {
    id: 7,
    username: 'sales.xy',
    name: '徐阳',
    phone: '177****9900',
    email: 'xu.yang@yangming.com',
    dept: '销售中心',
    roleCode: 'sales',
    roleName: '销售',
    lastLogin: '2025-12-18 10:05:42',
    lastIp: '120.36.182.24',
    status: 'inactive',
    createdAt: '2024-08-30',
  },
])

function statusType(s: string): 'success' | 'info' | 'danger' {
  return s === 'active' ? 'success' : s === 'locked' ? 'danger' : 'info'
}
function statusText(s: string) {
  return s === 'active' ? '启用' : s === 'locked' ? '锁定' : '停用'
}

const dialogVisible = ref(false)
const mode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()
const form = reactive<Account>({
  id: 0,
  username: '',
  name: '',
  phone: '',
  email: '',
  dept: '',
  roleCode: '',
  roleName: '',
  lastLogin: '',
  lastIp: '',
  status: 'active',
  createdAt: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

function handleCreate() {
  mode.value = 'create'
  Object.assign(form, {
    id: 0, username: '', name: '', phone: '', email: '', dept: '运营中心',
    roleCode: '', roleName: '', lastLogin: '-', lastIp: '-',
    status: 'active', createdAt: new Date().toISOString().slice(0, 10),
  })
  dialogVisible.value = true
}

function handleEdit(row: Account) {
  mode.value = 'edit'
  Object.assign(form, row)
  dialogVisible.value = true
}

function handleToggle(row: Account) {
  row.status = row.status === 'active' ? 'inactive' : 'active'
  ElMessage.success(`已${row.status === 'active' ? '启用' : '停用'}账号：${row.username}`)
}

function handleReset2FA(row: Account) {
  ElMessageBox.confirm(`确定重置账号「${row.username}」的登录密码？`, '重置确认', {
    type: 'warning',
  }).then(() => {
    ElMessage.success('已发送重置密码链接至用户邮箱')
  }).catch(() => {})
}

function handleSubmit() {
  formRef.value?.validate((valid) => {
    if (!valid) return
    const role = roleList.find((r) => r.code === form.roleCode)
    form.roleName = role?.name || ''
    if (mode.value === 'create') {
      accountList.value.unshift({ ...form, id: Date.now() })
      ElMessage.success('账号创建成功')
    } else {
      const idx = accountList.value.findIndex((a) => a.id === form.id)
      if (idx >= 0) accountList.value[idx] = { ...form }
      ElMessage.success('已更新')
    }
    dialogVisible.value = false
  })
}

function handleReset() {
  filter.keyword = ''
  filter.role = ''
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
