<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadRequestOptions } from 'element-plus'
import { Plus, Delete, ArrowLeft } from '@element-plus/icons-vue'
import { uploadApi } from '@/api/upload'
import { productApi } from '@/api/product'
import { categoryApi } from '@/api/category'
import { brandApi } from '@/api/brand'
import { dictApi } from '@/api/dict'

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
  id?: number
  key: string
  combo: Record<string, string>
  sku_code: string
  sku_image: string
  retail_price: number | null
  wholesale_price: number | null
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
  app_scope: Array<'retail' | 'wholesale'>
  min_wholesale_qty: number | null
  unit: string
  weight: number | null
  main_image: string
  gallery: string[]
  description: string
  status: 'on' | 'off' | 'draft'
  /** 是否包邮（true 时忽略运费） */
  free_shipping: boolean
  /** 默认运费（元）。结合用户地址做远近分区运费时再扩展运费模板 */
  shipping_fee: number | null
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
  app_scope: ['retail'],
  min_wholesale_qty: 6,
  unit: '件',
  weight: null,
  main_image: '',
  gallery: [],
  description: '',
  status: 'draft',
  free_shipping: false,
  shipping_fee: 0,
})

const rules: FormRules<ProductFormModel> = {
  name: [{ required: true, message: '请输入商品名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入商品编码', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择商品分类', trigger: 'change' }],
  craft: [{ required: true, message: '请选择工艺', trigger: 'change' }],
  unit: [{ required: true, message: '请输入单位', trigger: 'blur' }],
}

/* --------------------------------- 选项数据 -------------------------------- */
const categoryOptions = ref<{ value: string; label: string }[]>([])
const brandOptions = ref<{ value: string; label: string }[]>([])
const craftOptions = ref<{ value: string; label: string }[]>([])
const materialOptions = ref<{ value: string; label: string }[]>([])
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
        sku_image: '',
        retail_price: 0,
        wholesale_price: form.market_price,
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
const batchRetailPrice = ref<number | null>(null)
const batchWholesalePrice = ref<number | null>(null)
const batchStock = ref<number | null>(null)

function applyBatchRetailPrice() {
  if (batchRetailPrice.value === null) return
  skuList.value.forEach((r) => (r.retail_price = batchRetailPrice.value))
  ElMessage.success('已批量设置零售价')
}

function applyBatchWholesalePrice() {
  if (batchWholesalePrice.value === null) return
  skuList.value.forEach((r) => (r.wholesale_price = batchWholesalePrice.value))
  ElMessage.success('已批量设置批发价')
}
function applyBatchStock() {
  if (batchStock.value === null) return
  skuList.value.forEach((r) => (r.stock = batchStock.value))
  ElMessage.success('已批量设置库存')
}

/* ---------------------------------- 图片 ---------------------------------- */
const mainImageUploading = ref(false)
const galleryUploading = ref(false)

function validateImageFile(file: File) {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isImage) {
    ElMessage.error('只能上传图片文件')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

async function uploadImageFile(options: UploadRequestOptions) {
  const file = options.file
  if (!validateImageFile(file)) {
    options.onError(new Error('图片校验失败') as any)
    return ''
  }
  try {
    const res = await uploadApi.file(file)
    if (!res?.url) throw new Error('上传接口未返回图片地址')
    options.onSuccess(res)
    return res.url
  } catch (error) {
    options.onError(error as any)
    ElMessage.error((error as Error)?.message || '图片上传失败')
    return ''
  }
}

async function handleMainUpload(options: UploadRequestOptions) {
  mainImageUploading.value = true
  const url = await uploadImageFile(options)
  if (url) {
    form.main_image = url
    ElMessage.success('主图上传成功')
  }
  mainImageUploading.value = false
}

async function handleGalleryUpload(options: UploadRequestOptions) {
  if (form.gallery.length >= 8) {
    ElMessage.warning('最多 8 张')
    options.onError(new Error('最多 8 张') as any)
    return
  }
  galleryUploading.value = true
  const url = await uploadImageFile(options)
  if (url) {
    form.gallery.push(url)
    ElMessage.success('轮播图上传成功')
  }
  galleryUploading.value = false
}

function removeGalleryImage(idx: number) {
  form.gallery.splice(idx, 1)
}

async function handleSkuImageUpload(options: UploadRequestOptions, row: SkuRow) {
  const url = await uploadImageFile(options)
  if (url) {
    row.sku_image = url
    ElMessage.success('SKU 图片上传成功')
  }
}

function clearSkuImage(row: SkuRow) {
  row.sku_image = ''
}

function getSkuUploadHandler(row: SkuRow) {
  return (options: UploadRequestOptions) => handleSkuImageUpload(options, row)
}

function flattenCategories(list: any[]): any[] {
  return list.flatMap((item) => [item, ...flattenCategories(item.children || [])])
}

async function loadOptions() {
  try {
    const [categories, brands, crafts, materials] = await Promise.all([
      categoryApi.tree(),
      brandApi.list({ page: 1, pageSize: 100 }),
      dictApi.items('craft'),
      dictApi.items('material'),
    ])
    categoryOptions.value = flattenCategories(categories || []).map((item) => ({
      value: String(item.id),
      label: `${'　'.repeat(Math.max(Number(item.level || 1) - 1, 0))}${item.name}`,
    }))
    brandOptions.value = (brands?.list || []).map((item) => ({
      value: String(item.id),
      label: item.name,
    }))
    craftOptions.value = (crafts || []).map((item) => ({ value: item.value, label: item.label }))
    materialOptions.value = (materials || []).map((item) => ({ value: item.value, label: item.label }))
  } catch (error) {
    ElMessage.error('分类或品牌加载失败')
  }
}

function normalizeImageList(images: unknown): string[] {
  return Array.isArray(images) ? images.filter((item): item is string => typeof item === 'string' && !!item) : []
}

function normalizeSkuImageUrl(sku: any): string {
  return sku?.image || sku?.skuImage || sku?.sku_image || sku?.imageUrl || sku?.image_url || ''
}

function rebuildSpecsFromSkus(skus: any[]) {
  const specsList = skus.map((sku) => sku.specs || {}).filter((specs) => Object.keys(specs).length > 0)
  if (specsList.length === 0) return

  const groupMap = new Map<string, Set<string>>()
  specsList.forEach((specs) => {
    Object.entries(specs).forEach(([name, value]) => {
      if (!groupMap.has(name)) groupMap.set(name, new Set())
      if (value !== undefined && value !== null) groupMap.get(name)?.add(String(value))
    })
  })

  specGroups.value = Array.from(groupMap.entries()).map(([name, values], index) => ({
    id: `s-${index + 1}`,
    name,
    values: Array.from(values).map((value, valueIndex) => ({
      id: `sv-${index + 1}-${valueIndex + 1}`,
      value,
    })),
  }))
}

function fillSkuList(skus: any[]) {
  if (!Array.isArray(skus) || skus.length === 0) {
    regenerateSkuMatrix()
    return
  }
  rebuildSpecsFromSkus(skus)
  skuList.value = skus.map((sku, index) => {
    const combo = sku.specs || {}
    // 批发价从 priceTiers 取最低档：[{minQty, price}, ...]
    const tiers = Array.isArray(sku.priceTiers) ? sku.priceTiers : []
    const firstTier = tiers
      .slice()
      .sort((a: any, b: any) => Number(a.minQty || 0) - Number(b.minQty || 0))[0]
    return {
      id: sku.id,
      key: Object.values(combo).join('|') || `sku-${sku.id || index}`,
      combo,
      sku_code: sku.code || '',
      sku_image: normalizeSkuImageUrl(sku),
      retail_price: Number(sku.retailPrice ?? form.retail_price ?? 0),
      wholesale_price: firstTier && firstTier.price != null ? Number(firstTier.price) : null,
      cost: sku.costPrice === null || sku.costPrice === undefined ? null : Number(sku.costPrice),
      stock: Number(sku.stock ?? 0),
      enabled: sku.status !== 0,
    }
  })
}

async function loadProductDetail() {
  if (!productId) return
  try {
    const item = await productApi.get(Number(productId))
    Object.assign(form, {
      name: item.name || '',
      code: item.code || '',
      category_id: item.categoryId ? String(item.categoryId) : '',
      brand_id: item.brandId ? String(item.brandId) : '',
      craft: item.craft || '',
      material: item.material || '',
      origin: item.origin || '景德镇',
      tags: normalizeImageList(item.tags),
      retail_price: item.retailPrice === null || item.retailPrice === undefined ? null : Number(item.retailPrice),
      market_price: item.memberPrice === null || item.memberPrice === undefined ? null : Number(item.memberPrice),
      stock_warning: form.stock_warning,
      wholesale_enabled: !!item.wholesaleEnabled,
      app_scope: [
        ...(item.retailEnabled ? ['retail' as const] : []),
        ...(item.wholesaleEnabled ? ['wholesale' as const] : []),
      ],
      min_wholesale_qty: item.minWholesaleQty ?? 1,
      unit: form.unit,
      weight: item.skus?.[0]?.weight === null || item.skus?.[0]?.weight === undefined ? null : Number(item.skus[0].weight),
      main_image: item.mainImage || '',
      gallery: normalizeImageList(item.images),
      description: item.detail || '',
      status: item.status === 1 ? 'on' : 'draft',
      free_shipping: item.freeShipping === true,
      shipping_fee: item.shippingFee == null ? 0 : Number(item.shippingFee),
    })
    fillSkuList(item.skus || [])
  } catch (error) {
    ElMessage.error('商品详情加载失败')
  }
}

async function persistCustomDictOptions() {
  const tasks: Promise<unknown>[] = []
  if (form.craft && !craftOptions.value.some((item) => item.value === form.craft)) {
    tasks.push(
      dictApi.createItem('craft', { label: form.craft, value: form.craft }).then((item) => {
        craftOptions.value.push({ value: item.value, label: item.label })
      }),
    )
  }
  if (form.material && !materialOptions.value.some((item) => item.value === form.material)) {
    tasks.push(
      dictApi.createItem('material', { label: form.material, value: form.material }).then((item) => {
        materialOptions.value.push({ value: item.value, label: item.label })
      }),
    )
  }
  await Promise.all(tasks)
}

function buildProductPayload(status: 'on' | 'draft') {
  const categoryId = Number(form.category_id)
  const brandId = form.brand_id ? Number(form.brand_id) : undefined
  const minQty = Math.max(Number(form.min_wholesale_qty || 1), 1)
  const wholesaleEnabled = form.app_scope.includes('wholesale')
  return {
    code: form.code,
    name: form.name,
    categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
    brandId: Number.isFinite(Number(brandId)) ? brandId : undefined,
    craft: form.craft,
    material: form.material || undefined,
    mainImage: form.main_image || undefined,
    images: form.gallery,
    detail: form.description || undefined,
    tags: form.tags,
    retailEnabled: form.app_scope.includes('retail'),
    retailPrice: Number(skuList.value.find((s) => s.enabled)?.retail_price || 0),
    // memberPrice 严格表示"零售会员价/活动价"，由"市场价"输入框驱动；为空就 null
    memberPrice: form.market_price === null ? null : Number(form.market_price),
    wholesaleEnabled,
    minWholesaleQty: minQty,
    freeShipping: !!form.free_shipping,
    shippingFee: form.free_shipping ? 0 : Number(form.shipping_fee || 0),
    status: status === 'on' ? 1 : 0,
    skus: skuList.value
      .filter((sku) => sku.enabled)
      .map((sku, index) => {
        // 批发价 → 一档 priceTier；如果没启批发或没填批发价，priceTiers 留空数组（后端会清掉旧档）
        const wp = sku.wholesale_price
        const priceTiers =
          wholesaleEnabled && wp !== null && wp !== undefined && Number(wp) >= 0
            ? [{ minQty, maxQty: null, price: Number(wp) }]
            : []
        return {
          id: sku.id,
          code: sku.sku_code || `${form.code}-SKU-${index + 1}`,
          specs: sku.combo,
          image: sku.sku_image || form.main_image || undefined,
          skuImage: sku.sku_image || form.main_image || undefined,
          sku_image: sku.sku_image || form.main_image || undefined,
          retailPrice: Number(sku.retail_price || form.retail_price || 0),
          // SKU 级别的会员价同步 form.market_price，避免和 product.memberPrice 不一致
          memberPrice: form.market_price === null ? null : Number(form.market_price),
          costPrice: sku.cost === null ? null : Number(sku.cost),
          stock: Number(sku.stock || 0),
          weight: form.weight === null ? null : Number(form.weight),
          status: 1,
          priceTiers,
        }
      }),
  }
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
  if (form.app_scope.length === 0) {
    ElMessage.error('请至少选择一个小程序上架范围')
    return
  }
  const invalidSku = skuList.value.find((r) => r.retail_price === null || r.stock === null)
  if (invalidSku) {
    ElMessage.error('SKU 的零售价和库存必须填写')
    return
  }
  submitting.value = true
  form.status = status
  try {
    await persistCustomDictOptions()
    const payload = buildProductPayload(status)
    if (isEdit.value && productId) {
      await productApi.update(Number(productId), payload)
    } else {
      await productApi.create(payload)
    }
    ElMessage.success(status === 'on' ? '已保存并上架' : '已保存为草稿')
    router.push('/product/list')
  } catch (error) {
    ElMessage.error(isEdit.value ? '商品更新失败' : '商品创建失败')
  } finally {
    submitting.value = false
  }
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
onMounted(async () => {
  await loadOptions()
  if (isEdit.value) {
    await loadProductDetail()
  } else {
    regenerateSkuMatrix()
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
          <el-col :span="24">
            <el-form-item label="上架范围">
              <el-checkbox-group v-model="form.app_scope">
                <el-checkbox label="retail">小程序A（零售）</el-checkbox>
                <el-checkbox label="wholesale">小程序B（批发）</el-checkbox>
              </el-checkbox-group>
              <div class="form-tip">选择商品在哪个小程序中展示；可同时上架到两个小程序。</div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="工艺" prop="craft">
              <el-select
                v-model="form.craft"
                placeholder="请选择或输入工艺"
                filterable
                allow-create
                default-first-option
                style="width: 100%"
              >
                <el-option v-for="o in craftOptions" :key="o.value" :value="o.value" :label="o.label" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="胎质">
              <el-select
                v-model="form.material"
                placeholder="请选择或输入胎质"
                filterable
                allow-create
                default-first-option
                clearable
                style="width: 100%"
              >
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
            <el-form-item label="起批数量">
              <el-input-number
                v-model="form.min_wholesale_qty"
                :min="1"
                :controls="false"
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
          <el-col :span="8">
            <el-form-item label="是否包邮">
              <el-switch
                v-model="form.free_shipping"
                active-text="包邮"
                inactive-text="按运费"
                inline-prompt
              />
              <div class="form-tip">开启后忽略默认运费；可在订单结算时按用户地址再做远近调整。</div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="默认运费">
              <el-input-number
                v-model="form.shipping_fee"
                :min="0"
                :precision="2"
                :controls="false"
                :disabled="form.free_shipping"
                placeholder="不包邮时收取的默认运费"
                style="width: 100%"
              />
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
            v-model="batchRetailPrice"
            :min="0"
            :precision="2"
            placeholder="零售价"
            controls-position="right"
            style="width: 160px"
          />
          <el-button @click="applyBatchRetailPrice">应用零售价</el-button>
          <el-input-number
            v-model="batchWholesalePrice"
            :min="0"
            :precision="2"
            placeholder="批发价"
            controls-position="right"
            style="width: 160px"
          />
          <el-button @click="applyBatchWholesalePrice">应用批发价</el-button>
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
          <el-table-column label="SKU 图片" width="120" align="center">
            <template #default="{ row }">
              <el-upload
                :show-file-list="false"
                :http-request="getSkuUploadHandler(row)"
                accept="image/*"
              >
                <el-image
                  v-if="row.sku_image"
                  :src="row.sku_image"
                  fit="cover"
                  style="width: 44px; height: 44px; border-radius: 4px"
                />
                <el-button v-else size="small" text type="primary">上传</el-button>
              </el-upload>
              <el-button
                v-if="row.sku_image"
                size="small"
                text
                type="danger"
                @click="clearSkuImage(row)"
              >删除</el-button>
            </template>
          </el-table-column>
          <el-table-column label="SKU 编码" min-width="160">
            <template #default="{ row }">
              <el-input v-model="row.sku_code" placeholder="自动生成" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="零售价 (元)" width="150">
            <template #default="{ row }">
              <el-input-number
                v-model="row.retail_price"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="批发价 (元)" width="150">
            <template #default="{ row }">
              <el-input-number
                v-model="row.wholesale_price"
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
            <el-upload
              v-else
              class="image-upload-wrapper"
              :show-file-list="false"
              :http-request="handleMainUpload"
              :disabled="mainImageUploading"
              accept="image/*"
            >
              <div class="image-uploader main">
                <el-icon><Plus /></el-icon>
                <span>{{ mainImageUploading ? '上传中...' : '上传主图' }}</span>
              </div>
            </el-upload>
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
            <el-upload
              v-if="form.gallery.length < 8"
              class="image-upload-wrapper"
              :show-file-list="false"
              :http-request="handleGalleryUpload"
              :disabled="galleryUploading"
              accept="image/*"
            >
              <div class="image-uploader">
                <el-icon><Plus /></el-icon>
                <span>{{ galleryUploading ? '上传中...' : '添加' }}</span>
              </div>
            </el-upload>
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
.image-upload-wrapper {
  display: inline-flex;
}

.image-upload-wrapper :deep(.el-upload) {
  display: block;
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
