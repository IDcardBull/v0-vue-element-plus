<template>
  <div class="brand-list-page">
    <div class="page-header">
      <div>
        <h2 class="page-title">品牌管理</h2>
        <p class="page-subtitle">维护商品品牌信息，用于商品归类与筛选</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="handleCreate">新增品牌</el-button>
    </div>

    <el-card class="filter-card" shadow="never">
      <el-form inline :model="filter" class="filter-form">
        <el-form-item label="品牌名称">
          <el-input v-model="filter.keyword" placeholder="输入品牌名称 / 编码" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" placeholder="全部" clearable style="width: 140px">
            <el-option label="启用" value="active" />
            <el-option label="停用" value="inactive" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="content-card" shadow="never">
      <el-table :data="brandList" stripe border v-loading="loading">
        <el-table-column label="LOGO" width="90" align="center">
          <template #default="{ row }">
            <el-avatar :src="row.logo" :size="48" shape="square" class="brand-logo">
              {{ row.name.charAt(0) }}
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column label="品牌名称" min-width="200">
          <template #default="{ row }">
            <div class="brand-name-cell">
              <span class="brand-name">{{ row.name }}</span>
              <span class="brand-en">{{ row.englishName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="品牌编码" prop="code" width="140" />
        <el-table-column label="产地 / 所属" width="180">
          <template #default="{ row }">
            <div class="origin-cell">
              <div>{{ row.origin }}</div>
              <div class="owner">{{ row.owner }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="关联商品" width="100" align="right">
          <template #default="{ row }">
            <span class="goods-count">{{ row.goodsCount }}</span>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="90" align="center" prop="sort" />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180" prop="createdAt" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" :icon="Edit" @click="handleEdit(row)">编辑</el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'warning' : 'success'"
              @click="handleToggle(row)"
            >
              {{ row.status === 'active' ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" :icon="Delete" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.size"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadList"
          @size-change="loadList"
        />
      </div>
    </el-card>

    <!-- 新增 / 编辑 抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="formMode === 'create' ? '新增品牌' : '编辑品牌'"
      size="520px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="品牌 LOGO">
          <el-upload
            class="logo-uploader"
            :show-file-list="false"
            :auto-upload="false"
            :on-change="handleLogoChange"
          >
            <el-avatar :src="form.logo" :size="80" shape="square" class="logo-preview">
              <el-icon><Plus /></el-icon>
            </el-avatar>
          </el-upload>
          <div class="form-tip">建议 200 x 200 像素，支持 JPG / PNG</div>
        </el-form-item>
        <el-form-item label="品牌名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入品牌中文名称" />
        </el-form-item>
        <el-form-item label="英文名称">
          <el-input v-model="form.englishName" placeholder="请输入品牌英文名称（可选）" />
        </el-form-item>
        <el-form-item label="品牌编码" prop="code">
          <el-input v-model="form.code" placeholder="大写字母 + 数字组合" />
        </el-form-item>
        <el-form-item label="产地">
          <el-input v-model="form.origin" placeholder="如：江西景德镇" />
        </el-form-item>
        <el-form-item label="所属公司">
          <el-input v-model="form.owner" placeholder="品牌所属运营公司" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" :max="999" />
          <span class="form-tip inline-tip">数值越小越靠前</span>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="品牌简介">
          <el-input v-model="form.description" type="textarea" :rows="4" placeholder="品牌历史、工艺传承等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="drawer-footer">
          <el-button @click="drawerVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">保存</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete } from '@element-plus/icons-vue'
import { brandApi } from '@/api/brand'

interface Brand {
  id: number
  logo: string
  name: string
  englishName: string
  code: string
  origin: string
  owner: string
  goodsCount: number
  sort: number
  status: 'active' | 'inactive'
  createdAt: string
  description?: string
}

const loading = ref(false)
const filter = reactive({
  keyword: '',
  status: '',
})

const pagination = reactive({
  page: 1,
  size: 10,
  total: 0,
})

/** 默认数据：后端未就绪时使用，上线后自动被 API 数据覆盖 */
const fallbackBrands: Brand[] = [
  {
    id: 1,
    logo: '/placeholder.svg?height=48&width=48',
    name: '央茗',
    englishName: 'YANGMING',
    code: 'YM001',
    origin: '江西景德镇',
    owner: '央茗陶瓷有限公司',
    goodsCount: 128,
    sort: 1,
    status: 'active',
    createdAt: '2024-03-15 10:23:00',
    description: '央茗陶瓷传承千年景德镇制瓷工艺，专注高端日用瓷与艺术瓷创作。',
  },
  {
    id: 2,
    logo: '/placeholder.svg?height=48&width=48',
    name: '御窑',
    englishName: 'YUYAO',
    code: 'YY002',
    origin: '江西景德镇',
    owner: '御窑文化艺术有限公司',
    goodsCount: 86,
    sort: 2,
    status: 'active',
    createdAt: '2024-03-20 14:12:00',
  },
  {
    id: 3,
    logo: '/placeholder.svg?height=48&width=48',
    name: '龙泉青瓷',
    englishName: 'LONGQUAN',
    code: 'LQ003',
    origin: '浙江龙泉',
    owner: '龙泉青瓷研究院',
    goodsCount: 54,
    sort: 3,
    status: 'active',
    createdAt: '2024-04-02 09:30:00',
  },
  {
    id: 4,
    logo: '/placeholder.svg?height=48&width=48',
    name: '汝窑',
    englishName: 'RUYAO',
    code: 'RY004',
    origin: '河南宝丰',
    owner: '汝州汝窑瓷业',
    goodsCount: 42,
    sort: 4,
    status: 'active',
    createdAt: '2024-04-15 11:45:00',
  },
  {
    id: 5,
    logo: '/placeholder.svg?height=48&width=48',
    name: '紫砂堂',
    englishName: 'ZISHA',
    code: 'ZS005',
    origin: '江苏宜兴',
    owner: '宜兴紫砂工艺厂',
    goodsCount: 73,
    sort: 5,
    status: 'active',
    createdAt: '2024-05-08 16:20:00',
  },
  {
    id: 6,
    logo: '/placeholder.svg?height=48&width=48',
    name: '德化白瓷',
    englishName: 'DEHUA',
    code: 'DH006',
    origin: '福建德化',
    owner: '德化陶瓷集团',
    goodsCount: 38,
    sort: 6,
    status: 'inactive',
    createdAt: '2024-06-01 13:10:00',
  },
]

const brandList = ref<Brand[]>([])

async function loadList() {
  loading.value = true
  try {
    const res: any = await brandApi.list({
      keyword: filter.keyword,
      status: filter.status,
      page: pagination.page,
      pageSize: pagination.size,
    })
    const rows = (res?.list ?? []) as Brand[]
    brandList.value = rows
    pagination.total = res?.total ?? rows.length
  } catch (err) {
    // 后端未就绪时使用种子数据兜底，保证前端可演示
    brandList.value = fallbackBrands
    pagination.total = fallbackBrands.length
  } finally {
    loading.value = false
  }
}

onMounted(loadList)

const drawerVisible = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const formRef = ref<FormInstance>()

const defaultForm = (): Brand => ({
  id: 0,
  logo: '/placeholder.svg?height=80&width=80',
  name: '',
  englishName: '',
  code: '',
  origin: '',
  owner: '',
  goodsCount: 0,
  sort: 99,
  status: 'active',
  createdAt: '',
  description: '',
})

const form = reactive<Brand>(defaultForm())

const rules: FormRules = {
  name: [{ required: true, message: '请输入品牌名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入品牌编码', trigger: 'blur' }],
}

function handleSearch() {
  pagination.page = 1
  loadList()
}

function handleReset() {
  filter.keyword = ''
  filter.status = ''
  pagination.page = 1
  loadList()
}

function handleCreate() {
  formMode.value = 'create'
  Object.assign(form, defaultForm())
  drawerVisible.value = true
}

function handleEdit(row: Brand) {
  formMode.value = 'edit'
  Object.assign(form, row)
  drawerVisible.value = true
}

async function handleToggle(row: Brand) {
  const next = row.status === 'active' ? 'inactive' : 'active'
  try {
    await brandApi.update(row.id, { status: next })
    row.status = next
    ElMessage.success(`已${next === 'active' ? '启用' : '停用'}品牌：${row.name}`)
  } catch (e: any) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function handleDelete(row: Brand) {
  try {
    await ElMessageBox.confirm(`确定删除品牌「${row.name}」？该操作不可撤销。`, '删除确认', {
      type: 'warning',
    })
    await brandApi.remove(row.id)
    ElMessage.success('删除成功')
    loadList()
  } catch (err: any) {
    if (err !== 'cancel') ElMessage.error(err?.message || '删除失败')
  }
}

function handleLogoChange(file: any) {
  form.logo = URL.createObjectURL(file.raw)
}

function handleSubmit() {
  formRef.value?.validate(async (valid) => {
    if (!valid) return
    try {
      if (formMode.value === 'create') {
        await brandApi.create({ ...form })
        ElMessage.success('品牌创建成功')
      } else {
        await brandApi.update(form.id, { ...form })
        ElMessage.success('品牌信息已更新')
      }
      drawerVisible.value = false
      loadList()
    } catch (e: any) {
      ElMessage.error(e?.message || '保存失败')
    }
  })
}
</script>

<style scoped>
.brand-list-page {
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #1f2d3d;
}

.page-subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: #909399;
}

.filter-card {
  margin-bottom: 16px;
  border-radius: 8px;
}

.filter-form {
  margin-bottom: 0;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.content-card {
  border-radius: 8px;
}

.brand-logo {
  background: linear-gradient(135deg, #c8a96a 0%, #a88a4a 100%);
  color: #fff;
  font-weight: 600;
}

.brand-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}

.brand-en {
  font-size: 12px;
  color: #909399;
  letter-spacing: 0.5px;
}

.origin-cell {
  font-size: 13px;
  line-height: 1.5;
}

.owner {
  font-size: 12px;
  color: #909399;
}

.goods-count {
  font-weight: 600;
  color: #c8a96a;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.logo-uploader {
  display: inline-block;
}

.logo-preview {
  background: #f4f5f7;
  color: #909399;
  cursor: pointer;
  border: 1px dashed #dcdfe6;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.inline-tip {
  margin-left: 12px;
  display: inline-block;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
