<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'

/** 阶梯价结构 */
export interface PriceTier {
  min_qty: number | null
  max_qty: number | null
  price: number | null
}

/** 关联 SKU 信息（作为参考） */
export interface SkuInfo {
  sku_id: string
  sku_name: string
  image: string
  retail_price: number
}

const props = defineProps<{
  modelValue: boolean
  sku: SkuInfo | null
  tiers?: PriceTier[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'save', payload: { sku_id: string; tiers: PriceTier[] }): void
}>()

// 双向绑定 drawer 的显示
const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

// 内部表单状态
const tierList = ref<PriceTier[]>([])

watch(
  () => [props.modelValue, props.tiers],
  () => {
    if (props.modelValue) {
      tierList.value = props.tiers?.length
        ? JSON.parse(JSON.stringify(props.tiers))
        : [{ min_qty: 1, max_qty: 10, price: null }]
    }
  },
  { immediate: true },
)

function addTier() {
  const last = tierList.value[tierList.value.length - 1]
  const nextMin = last && typeof last.max_qty === 'number' ? last.max_qty + 1 : 1
  tierList.value.push({ min_qty: nextMin, max_qty: null, price: null })
}

function removeTier(index: number) {
  if (tierList.value.length === 1) {
    ElMessage.warning('至少保留一条价格阶梯')
    return
  }
  tierList.value.splice(index, 1)
}

/**
 * 校验：
 *  1. min_qty > 0
 *  2. max_qty > min_qty（或为空，表示无上限；只有最后一行可以为空）
 *  3. 下一阶梯的 min_qty 必须 > 上一阶梯的 max_qty
 *  4. price > 0
 */
function validateTiers(): string | null {
  for (let i = 0; i < tierList.value.length; i++) {
    const t = tierList.value[i]
    const isLast = i === tierList.value.length - 1

    if (t.min_qty == null || t.min_qty <= 0) {
      return `第 ${i + 1} 行：最小数量必须大于 0`
    }
    if (!isLast && (t.max_qty == null || t.max_qty <= 0)) {
      return `第 ${i + 1} 行：最大数量必须大于 0`
    }
    if (t.max_qty != null && t.max_qty < t.min_qty) {
      return `第 ${i + 1} 行：最大数量不能小于最小数量`
    }
    if (t.price == null || t.price <= 0) {
      return `第 ${i + 1} 行：批发价必须大于 0`
    }
    if (i > 0) {
      const prev = tierList.value[i - 1]
      if (prev.max_qty == null) {
        return `第 ${i} 行未设置最大数量，无法新增后续阶梯`
      }
      if (t.min_qty <= prev.max_qty) {
        return `第 ${i + 1} 行：最小数量必须大于上一阶梯的最大数量 (${prev.max_qty})`
      }
    }
  }
  return null
}

function handleSave() {
  if (!props.sku) return
  const err = validateTiers()
  if (err) {
    ElMessage.error(err)
    return
  }
  emit('save', {
    sku_id: props.sku.sku_id,
    tiers: JSON.parse(JSON.stringify(tierList.value)),
  })
  ElMessage.success('批发阶梯价已保存')
  visible.value = false
}

function handleCancel() {
  visible.value = false
}
</script>

<template>
  <el-drawer
    v-model="visible"
    title="批发阶梯价配置"
    size="560px"
    :close-on-click-modal="false"
  >
    <div v-if="sku" class="tier-root">
      <!-- SKU 参考信息 -->
      <div class="sku-card">
        <el-image :src="sku.image" fit="cover" class="sku-image" />
        <div class="sku-info">
          <div class="sku-name">{{ sku.sku_name }}</div>
          <div class="sku-meta">
            <span class="sku-id">SKU: {{ sku.sku_id }}</span>
            <el-divider direction="vertical" />
            <span class="sku-price">
              零售价参考
              <strong>¥{{ sku.retail_price.toFixed(2) }}</strong>
            </span>
          </div>
        </div>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="规则说明"
        description="同一 SKU 根据采购数量设置不同的批发价；下一阶梯的最小数量必须大于上一阶梯的最大数量。最后一条可不填最大数量表示无上限。"
        class="mb-16"
      />

      <!-- 阶梯列表头部 -->
      <div class="tier-header">
        <span class="col col-idx">阶梯</span>
        <span class="col col-qty">最小数量</span>
        <span class="col col-qty">最大数量</span>
        <span class="col col-price">批发价（¥）</span>
        <span class="col col-op">操作</span>
      </div>

      <!-- 阶梯列表 -->
      <div class="tier-list">
        <div v-for="(tier, index) in tierList" :key="index" class="tier-row">
          <span class="col col-idx">{{ index + 1 }}</span>
          <div class="col col-qty">
            <el-input-number
              v-model="tier.min_qty"
              :min="1"
              :step="1"
              :controls="false"
              placeholder="≥ 1"
              class="full"
            />
          </div>
          <div class="col col-qty">
            <el-input-number
              v-model="tier.max_qty"
              :min="1"
              :step="1"
              :controls="false"
              :placeholder="index === tierList.length - 1 ? '无上限' : '必填'"
              class="full"
            />
          </div>
          <div class="col col-price">
            <el-input-number
              v-model="tier.price"
              :min="0.01"
              :precision="2"
              :step="1"
              :controls="false"
              placeholder="0.00"
              class="full"
            />
          </div>
          <div class="col col-op">
            <el-button
              type="danger"
              link
              :icon="'Delete'"
              @click="removeTier(index)"
            />
          </div>
        </div>
      </div>

      <el-button
        type="primary"
        plain
        :icon="'Plus'"
        class="add-btn"
        @click="addTier"
      >
        新增价格阶梯
      </el-button>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleSave">保存阶梯价</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.tier-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sku-card {
  display: flex;
  gap: 14px;
  padding: 12px;
  background: linear-gradient(180deg, #fafbfc 0%, #fff 100%);
  border: 1px solid var(--ym-border);
  border-radius: 6px;
}

.sku-image {
  width: 64px;
  height: 64px;
  border-radius: 4px;
  flex-shrink: 0;
  background: #f0f2f5;
}

.sku-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
}

.sku-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ym-primary);
}
.sku-meta {
  font-size: 12px;
  color: var(--ym-text-secondary);
  display: flex;
  align-items: center;
}
.sku-price strong {
  color: var(--ym-danger);
  margin-left: 4px;
}

.mb-16 {
  margin-bottom: 0;
}

.tier-header,
.tier-row {
  display: grid;
  grid-template-columns: 48px 1fr 1fr 1fr 48px;
  gap: 8px;
  align-items: center;
}

.tier-header {
  font-size: 12px;
  color: var(--ym-text-secondary);
  padding: 8px 4px;
  border-bottom: 1px solid var(--ym-border);
}

.tier-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.tier-row {
  padding: 4px 0;
}

.col-idx {
  text-align: center;
  color: var(--ym-text-secondary);
  font-weight: 500;
}
.col-op {
  text-align: center;
}

.full {
  width: 100%;
}
.full :deep(.el-input__wrapper) {
  width: 100%;
}

.add-btn {
  align-self: flex-start;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
