<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Delete, ArrowLeft } from '@element-plus/icons-vue'

/* ----------------------------------- 类型 ---------------------------------- */
interface SpecValue {
  id: string
  value: string
}
interface SpecGroup {
  id: string
  name: string
  values: SpecValue[]
}
interface SkuRow {
  key: string
  combo: Record<string, string>
  sku_code: string
  price: number | null
  cost: number | null
  stock: number | null
  enabled: boolean
}
interface ProductFormModel {
  name: string
  code: string
  category_id: string
  brand_id: string
  craft: string
  material: string
  origin: string
  tags: string[]
  retail_price: number | null
  market_price: number | null
  stock_warning: number | null
  wholesale_enabled: boolean
  min_wholesale_qty: number | null
  unit: string
  weight: number | null
  main_image: string
  gallery: string[]
  description: string
  status: 'on' | 'off' | 'draft'
}

/* ----------------------------------- 路由 ---------------------------------- */
const route = useRoute()
const router = useRouter()
const productId = route.query.id as string | undefined
const isEdit = computed(() => !!productId)
const pageTitle = computed(() => (isEdit.value ? '编辑商品' : '新增商品'))

/* --------------------------------- 表单数据 -------------------------------- */
const formRef = ref<FormInstance>()
const form = reactive<ProductFormModel>({
  name: '',
  code: '',
  category_id: '',
  brand_id: '',
  craft: '',
  material: '',
  origin: '景德镇',
  tags: [],
  retail_price: null,
  market_price: null,
  stock_warning: 10,
  wholesale_enabled: true,
  min_wholesale_qty: 6,
  unit: '件',
  weight: null,
  main_image: '',
  gallery: [],
  description: '',
  status: 'draft',
})

const rules: FormRules<ProductFormModel> = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
  craft: [{ required: true, message: '请选择工艺', trigger: 'change' }],
  retail_price: [{ required: true, message: '请输入零售价', trigger: 'blur' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }],
}

/* --------------------------------- 选项数据 -------------------------------- */
const categoryOptions = [
  { value: 'cat-1', label: '茶具' },
  { value: 'cat-2', label: '花瓶' },
  { value: 'cat-3', label: '餐具' },
  { value: 'cat-4', label: '摆件' },
  { value: 'cat-5', label: '茶杯' },
]
const brandOptions = [
  { value: 'brand-1', label: '央茗' },
  { value: 'brand-2', label: '景德镇官窑' },
  { value: 'brand-3', label: '汝窑传承' },
]
const craftOptions = [
  { value: '青花', label: '青花' },
  { value: '釉里红', label: '釉里红' },
  { value: '粉彩', label: '粉彩' },
  { value: '汝窑', label: '汝窑' },
  { value: '玉瓷', label: '玉瓷' },
  { value: '结晶釉', label: '结晶釉' },
]
const materialOptions = [
  { value: '高岭土', label: '高岭土' },
  { value: '紫砂', label: '紫砂' },
  { value: '骨瓷', label: '骨瓷' },
  { value: '青瓷土', label: '青瓷土' },
]
const tagOptions = ['新品', '热销', '礼盒', '手作', '限量', '非遗']

/* ---------------------------------- 规格 ---------------------------------- */
const specGroups = ref<SpecGroup[]>([
  {
    id: 's-1',
    name: '规格',
    values: [
      { id: 'sv-1', value: '标准款' },
      { id: 'sv-2', value: '豪华款' },
    ],
  },
])
const tagInputVisible = ref<Record<string, boolean>>({})
const tagInputValue = ref<Record<string, string>>({})

function addSpecGroup() {
  if (specGroups.value.length >= 3) {
    ElMessage.warning('最多支持 3 组规格')
    return
  }
  specGroups.value.push({
    id: `s-${Date.now()}`,
    name: '',
    values: [],
  })
  regenerateSkuMatrix()
}

function removeSpecGroup(id: string) {
  specGroups.value = specGroups.value.filter((g) => g.id !== id)
  regenerateSkuMatrix()
}

function showTagInput(groupId: string) {
  tagInputVisible.value[groupId] = true
}

function confirmTagInput(group: SpecGroup) {
  const val = (tagInputValue.value[group.id] || '').trim()
  if (val) {
    if (group.values.some((v) => v.value === val)) {
      ElMessage.warning('规格值重复')
    } else {
      group.values.push({ id: `sv-${Date.now()}`, value: val })
      regenerateSkuMatrix()
    }
  }
  tagInputValue.value[group.id] = ''
  tagInputVisible.value[group.id] = false
}

function removeSpecValue(group: SpecGroup, valueId: string) {
  group.values = group.values.filter((v) => v.id !== valueId)
  regenerateSkuMatrix()
}

/* ---------------------------- 生成 SKU 笛卡尔积矩阵 --------------------------- */
const skuList = ref<SkuRow[]>([])

function cartesian(groups: SpecGroup[]): Record<string, string>[] {
  const valid = groups.filter((g) => g.values.length > 0)
  if (valid.length === 0) return [{}]
  return valid.reduce<Record<string, string>[]>(
    (acc, group) => {
      const next: Record<string, string>[] = []
      for (const item of acc) {
        for (const val of group.values) {
          next.push({ ...item, [group.name || group.id]: val.value })
        }
      }
      return next
    },
    [{}],
  )
}

function regenerateSkuMatrix() {
  const combos = cartesian(specGroups.value)
  const prevMap = new Map(skuList.value.map((r) => [r.key, r]))
  skuList.value = combos.map((combo) => {
    const key = Object.values(combo).join('|') || 'default'
    const prev = prevMap.get(key)
    return (
      prev ?? {
        key,
        combo,
        sku_code: '',
        price: form.retail_price,
        cost: null,
        stock: 0,
        enabled: true,
      }
    )
  })
}

const activeSpecHeaders = computed(() =>
  specGroups.value.filter((g) => g.values.length > 0).map((g) => g.name || '规格'),
)

/* --------------------------------- 批量填充 -------------------------------- */
const batchPrice = ref<number | null>(null)
const batchStock = ref<number | null>(null)

function applyBatchPrice() {
  if (batchPrice.value === null) return
  skuList.value.forEach((r) => (r.price = batchPrice.value))
  ElMessage.success('已批量设置售价')
}
function applyBatchStock() {
  if (batchStock.value === null) return
  skuList.value.forEach((r) => (r.stock = batchStock.value))
  ElMessage.success('已批量设置库存')
}

/* ---------------------------------- 图片 ---------------------------------- */
// 演示用占位图，真实环境对接上传接口
const defaultMainImg = '/placeholder.svg?height=120&width=120'
const defaultGalleryImgs = ['/placeholder.svg?height=80&width=80']

function handleMainUpload() {
  form.main_image = defaultMainImg
  ElMessage.success('主图已上传')
}
function addGalleryImage() {
  if (form.gallery.length >= 8) {
    ElMessage.warning('最多 8 张')
    return
  }
  form.gallery.push(defaultGalleryImgs[0])
}
function removeGalleryImage(idx: number) {
  form.gallery.splice(idx, 1)
}

/* --------------------------------- 提交操作 -------------------------------- */
const submitting = ref(false)

async function handleSubmit(status: 'on' | 'draft') {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) {
    ElMessage.error('请完善必填信息')
    return
  }
  if (skuList.value.length === 0) {
    ElMessage.error('请至少配置一条 SKU')
    return
  }
  const invalidSku = skuList.value.find((r) => r.price === null || r.stock === null)
  if (invalidSku) {
    ElMessage.error('SKU 的售价和库存必须填写')
    return
  }
  submitting.value = true
  form.status = status
  console.log('[v0] submit product', { form, skuList: skuList.value })
  setTimeout(() => {
    submitting.value = false
    ElMessage.success(status === 'on' ? '已保存并上架' : '已保存为草稿')
    router.push('/product/list')
  }, 600)
}

function handleCancel() {
  ElMessageBox.confirm('确定要放弃当前编辑吗？未保存的内容将丢失。', '提示', {
    confirmButtonText: '放弃',
    cancelButtonText: '继续编辑',
    type: 'warning',
  })
    .then(() => router.push('/product/list'))
    .catch(() => void 0)
}

/* --------------------------------- 编辑回填 -------------------------------- */
onMounted(() => {
  regenerateSkuMatrix()
  if (isEdit.value) {
    // 模拟根据 id 拉取数据
    Object.assign(form, {
      name: '青花缠枝莲茶具套装',
      code: 'YM-TEA-001',
      category_id: 'cat-1',
      brand_id: 'brand-1',
      craft: '青花',
      material: '高岭土',
      origin: '景德镇',
      tags: ['新品', '礼盒'],
      retail_price: 1280,
      market_price: 1580,
      stock_warning: 10,
      wholesale_enabled: true,
      min_wholesale_qty: 6,
      unit: '套',
      weight: 2.4,
      main_image: defaultMainImg,
      gallery: [defaultGalleryImgs[0], defaultGalleryImgs[0]],
      description: '景德镇手工绘制，传统青花工艺，含一壶四杯一茶海。',
      status: 'on',
    })
  }
})
</script>

<template>
  <div class="product-form-page">
    <!-- 顶部操作栏 -->
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" text @click="handleCancel">返回</el-button>
        <el-divider direction="vertical" />
        <h2 class="page-title">{{ pageTitle }}</h2>
        <el-tag v-if="isEdit" type="info" size="small" effect="plain">
          ID: {{ productId }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-button @click="handleCancel">取消</el-button>
        <el-button :loading="submitting" @click="handleSubmit('draft')">存为草稿</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit('on')">
          保存并上架
        </el-button>
      </div>
    </div>

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="110px"
      label-position="right"
      class="form-body"
    >
      <!-- 基础信息 -->
      <el-card class="section" shadow="never">
        <template #header>
          <div class="section-header">
            <span class="bar" /> <span class="title">基础信息</span>
          </div>
        </template>
        <el-row :gutter="24">
          <el-col :span="12">
            <el-form-item label="商品名称" prop="name">
              <el-input v-model="form.name" placeholder="例如：青花缠枝莲茶具套装" maxlength="60" show-word-limit />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品编码" prop="code">
              <el-input v-model="form.code" placeholder="例如：YM-TEA-001" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="商品分类" prop="category_id">
              <el-select v-model="form.category_id" placeholder="请选择分类" style="width: 100%">
                <el-option
                  v-for="o in categoryOptions"
                  :key="o.value"
                  :value="o.value"
                  :label="o.label"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属品牌">
              <el-select v-model="form.brand_id" placeholder="请选择品牌" clearable style="width: 100%">
                <el-option
                  v-for="o in brandOptions"
                  :key="o.value"
                  :value="o.value"
                  :label="o.label"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="工艺" prop="craft">
              <el-select v-model="form.craft" placeholder="请选择工艺" style="width: 100%">
                <el-option v-for="o in craftOptions" :key="o.value" :value="o.value" :label="o.label" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="胎质">
              <el-select v-model="form.material" placeholder="请选择胎质" clearable style="width: 100%">
                <el-option
                  v-for="o in materialOptions"
                  :key="o.value"
                  :value="o.value"
                  :label="o.label"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="产地">
              <el-input v-model="form.origin" placeholder="例如：景德镇" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="商品标签">
              <el-select
                v-model="form.tags"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择或输入后回车创建"
                style="width: 100%"
              >
                <el-option v-for="t in tagOptions" :key="t" :value="t" :label="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <!-- 规格与 SKU -->
      <el-card class="section" shadow="never">
        <template #header>
          <div class="section-header">
            <span class="bar" /> <span class="title">规格与 SKU</span>
            <span class="section-desc">添加规格后将自动生成 SKU 组合，支持批量填充</span>
          </div>
        </template>

        <div v-for="group in specGroups" :key="group.id" class="spec-group">
          <div class="spec-group-head">
            <el-input
              v-model="group.name"
              placeholder="规格名，如：颜色 / 容量"
              size="default"
              style="width: 220px"
              @change="regenerateSkuMatrix"
            />
            <el-button
              type="danger"
              text
              :icon="Delete"
              @click="removeSpecGroup(group.id)"
            >删除此规格</el-button>
          </div>
          <div class="spec-values">
            <el-tag
              v-for="val in group.values"
              :key="val.id"
              closable
              type="info"
              effect="light"
              class="spec-tag"
              @close="removeSpecValue(group, val.id)"
            >{{ val.value }}</el-tag>
            <el-input
              v-if="tagInputVisible[group.id]"
              v-model="tagInputValue[group.id]"
              size="small"
              class="tag-input"
              autofocus
              @keyup.enter="confirmTagInput(group)"
              @blur="confirmTagInput(group)"
            />
            <el-button
              v-else
              size="small"
              :icon="Plus"
              @click="showTagInput(group.id)"
            >添加规格值</el-button>
          </div>
        </div>

        <el-button
          type="primary"
          plain
          :icon="Plus"
          :disabled="specGroups.length >= 3"
          @click="addSpecGroup"
        >新增规格组</el-button>

        <el-divider />

        <!-- 批量填充工具条 -->
        <div class="batch-bar">
          <span class="batch-label">批量填充：</span>
          <el-input-number
            v-model="batchPrice"
            :min="0"
            :precision="2"
            placeholder="售价"
            controls-position="right"
            style="width: 160px"
          />
          <el-button @click="applyBatchPrice">应用售价</el-button>
          <el-input-number
            v-model="batchStock"
            :min="0"
            placeholder="库存"
            controls-position="right"
            style="width: 160px"
          />
          <el-button @click="applyBatchStock">应用库存</el-button>
        </div>

        <!-- SKU 表格 -->
        <el-table :data="skuList" border stripe class="sku-table">
          <el-table-column
            v-for="header in activeSpecHeaders"
            :key="header"
            :label="header"
            min-width="120"
          >
            <template #default="{ row }">
              <span class="sku-combo">{{ row.combo[header] }}</span>
            </template>
          </el-table-column>
          <el-table-column label="SKU 编码" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.sku_code" placeholder="自动生成" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="售价 (元)" width="150">
            <template #default="{ row }">
              <el-input-number
                v-model="row.price"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="成本价 (元)" width="150">
            <template #default="{ row }">
              <el-input-number
                v-model="row.cost"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="库存" width="120">
            <template #default="{ row }">
              <el-input-number
                v-model="row.stock"
                :min="0"
                :controls="false"
                size="small"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="启用" width="80" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" size="small" />
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- 价格与销售 -->
      <el-card class="section" shadow="never">
        <template #header>
          <div class="section-header">
            <span class="bar" /> <span class="title">价格与销售</span>
          </div>
        </template>
        <el-row :gutter="24">
          <el-col :span="8">
            <el-form-item label="零售参考价" prop="retail_price">
              <el-input-number
                v-model="form.retail_price"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
              >
                <template #suffix>元</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="市场价">
              <el-input-number
                v-model="form.market_price"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="库存预警">
              <el-input-number
                v-model="form.stock_warning"
                :min="0"
                :controls="false"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="开启批发">
              <el-switch v-model="form.wholesale_enabled" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="起批数量">
              <el-input-number
                v-model="form.min_wholesale_qty"
                :min="1"
                :controls="false"
                :disabled="!form.wholesale_enabled"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="计量单位" prop="unit">
              <el-input v-model="form.unit" placeholder="件 / 套 / 对" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="重量 (kg)">
              <el-input-number
                v-model="form.weight"
                :min="0"
                :precision="2"
                :controls="false"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-card>

      <!-- 图片与详情 -->
      <el-card class="section" shadow="never">
        <template #header>
          <div class="section-header">
            <span class="bar" /> <span class="title">图片与详情</span>
          </div>
        </template>
        <el-form-item label="商品主图">
          <div class="image-area">
            <div v-if="form.main_image" class="image-item main">
              <img :src="form.main_image" alt="商品主图" />
              <div class="image-mask">
                <el-button type="danger" :icon="Delete" circle size="small" @click="form.main_image = ''" />
              </div>
            </div>
            <div v-else class="image-uploader main" @click="handleMainUpload">
              <el-icon><Plus /></el-icon>
              <span>上传主图</span>
            </div>
            <span class="image-tip">建议尺寸 800×800，JPG/PNG，不超过 2MB</span>
          </div>
        </el-form-item>
        <el-form-item label="商品轮播图">
          <div class="image-area">
            <div v-for="(img, idx) in form.gallery" :key="idx" class="image-item">
              <img :src="img" alt="轮播图" />
              <div class="image-mask">
                <el-button
                  type="danger"
                  :icon="Delete"
                  circle
                  size="small"
                  @click="removeGalleryImage(idx)"
                />
              </div>
            </div>
            <div v-if="form.gallery.length < 8" class="image-uploader" @click="addGalleryImage">
              <el-icon><Plus /></el-icon>
              <span>添加</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="详情描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="5"
            placeholder="介绍商品的工艺、材质、故事、使用建议等..."
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-card>
    </el-form>

    <!-- 底部操作条（粘性） -->
    <div class="footer-bar">
      <el-button @click="handleCancel">取消</el-button>
      <el-button :loading="submitting" @click="handleSubmit('draft')">存为草稿</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit('on')">
        保存并上架
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.product-form-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding-bottom: 72px;
}

/* ---------- header ---------- */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #fff;
  border-radius: 4px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2d3d;
  margin: 0;
}
.header-right {
  display: flex;
  gap: 8px;
}

/* ---------- section ---------- */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section :deep(.el-card__header) {
  padding: 14px 20px;
  background: #fafbfc;
  border-bottom: 1px solid #ebeef5;
}
.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-header .bar {
  width: 3px;
  height: 14px;
  background: #c8a96a;
  border-radius: 2px;
}
.section-header .title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2d3d;
}
.section-desc {
  margin-left: 8px;
  font-size: 12px;
  font-weight: normal;
  color: #909399;
}

/* ---------- spec ---------- */
.spec-group {
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.spec-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.spec-values {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.spec-tag {
  padding: 0 10px;
  height: 28px;
  line-height: 26px;
}
.tag-input {
  width: 120px;
}

/* ---------- batch bar ---------- */
.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #f7f9fc;
  border-radius: 4px;
}
.batch-label {
  color: #606266;
  font-size: 13px;
}
.sku-table {
  margin-top: 8px;
}
.sku-combo {
  color: #1f2d3d;
  font-weight: 500;
}

/* ---------- image uploader ---------- */
.image-area {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.image-item {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #ebeef5;
}
.image-item.main {
  width: 120px;
  height: 120px;
}
.image-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.image-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.image-item:hover .image-mask {
  opacity: 1;
}
.image-uploader {
  width: 88px;
  height: 88px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  background: #fafbfc;
  color: #909399;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
}
.image-uploader:hover {
  border-color: #c8a96a;
  color: #c8a96a;
}
.image-uploader.main {
  width: 120px;
  height: 120px;
}
.image-uploader .el-icon {
  font-size: 22px;
  margin-bottom: 4px;
}
.image-tip {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}

/* ---------- footer bar ---------- */
.footer-bar {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  margin-top: 16px;
  margin-left: -24px;
  margin-right: -24px;
  padding: 12px 24px;
  background: #fff;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  z-index: 10;
}
</style>
