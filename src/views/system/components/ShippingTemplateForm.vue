<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import type {
  FreeShippingRule,
  ShippingRule,
  ShippingTemplate,
  ShippingTemplatePayload,
  SpecialRule,
} from '@/api/shippingTemplate'
import { REGION_OPTIONS } from './regions'

interface Props {
  /** 编辑时传入完整数据；新建时传 null */
  source?: ShippingTemplate | null
  /** 由父组件控制保存按钮 loading */
  busy?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  source: null,
  busy: false,
})

const emit = defineEmits<{
  (e: 'submit', payload: ShippingTemplatePayload): void
  (e: 'cancel'): void
}>()

// ============ 状态 ============
function emptyRule(): ShippingRule {
  return { firstAmount: 1, firstPrice: 0, continueAmount: 1, continuePrice: 0 }
}

const formRef = ref<FormInstance>()

const form = reactive<ShippingTemplatePayload>({
  templateName: '',
  calcType: 1,
  defaultRule: emptyRule(),
  specialRules: [],
  freeShippingEnabled: false,
  freeShippingRules: [],
})

// 当父组件传入 source 时同步进表单
watch(
  () => props.source,
  (next) => {
    if (next) {
      form.templateName = next.templateName || next.name || ''
      form.calcType = (next.calcType === 2 ? 2 : 1) as 1 | 2
      form.defaultRule = { ...emptyRule(), ...(next.defaultRule || {}) }
      form.specialRules = Array.isArray(next.specialRules)
        ? next.specialRules.map((r) => ({
            regions: Array.isArray(r.regions) ? [...r.regions] : [],
            firstAmount: Number(r.firstAmount) || 1,
            firstPrice: Number(r.firstPrice) || 0,
            continueAmount: Number(r.continueAmount) || 1,
            continuePrice: Number(r.continuePrice) || 0,
          }))
        : []
      form.freeShippingEnabled = !!next.freeShippingEnabled
      form.freeShippingRules = Array.isArray(next.freeShippingRules)
        ? next.freeShippingRules.map((r) => ({
            regions: Array.isArray(r.regions) ? [...r.regions] : [],
            threshold: Number(r.threshold) || 0,
          }))
        : []
    } else {
      form.templateName = ''
      form.calcType = 1
      form.defaultRule = emptyRule()
      form.specialRules = []
      form.freeShippingEnabled = false
      form.freeShippingRules = []
    }
  },
  { immediate: true, deep: false },
)

// ============ 计价单位（按件 / 按重量）切换时表头联动 ============
const labels = computed(() => {
  const isWeight = form.calcType === 2
  return {
    unit: isWeight ? 'kg' : '个',
    firstAmount: isWeight ? '首重(kg)' : '首件(个)',
    firstPrice: '首费(元)',
    continueAmount: isWeight ? '续重(kg)' : '续件(个)',
    continuePrice: '续费(元)',
    threshold: isWeight ? '满 (元)' : '满 (元)', // 包邮无论按件按重，都按金额阈值更直观
  }
})

// ============ 校验规则 ============
const rules: FormRules = {
  templateName: [
    { required: true, message: '请输入模板名称', trigger: 'blur' },
    { max: 64, message: '名称不能超过 64 字', trigger: 'blur' },
  ],
}

// ============ 指定地区行操作 ============
function addSpecial() {
  form.specialRules.push({
    regions: [],
    ...emptyRule(),
  })
}

function removeSpecial(idx: number) {
  form.specialRules.splice(idx, 1)
}

function addFreeRule() {
  form.freeShippingRules.push({ regions: [], threshold: 0 })
}

function removeFreeRule(idx: number) {
  form.freeShippingRules.splice(idx, 1)
}

// 关闭包邮开关时清空已配置的规则，避免下次打开还有脏数据
watch(
  () => form.freeShippingEnabled,
  (enabled) => {
    if (!enabled) form.freeShippingRules = []
    else if (form.freeShippingRules.length === 0) addFreeRule()
  },
)

// ============ 校验地区不可重复（不同行选了同一省份会冲突）============
function validateRegions(): boolean {
  const used = new Set<string>()
  for (const row of form.specialRules) {
    for (const r of row.regions) {
      if (used.has(r)) {
        ElMessage.error(`地区 "${r}" 在多行特殊运费中重复`)
        return false
      }
      used.add(r)
    }
  }
  return true
}

// ============ 提交 ============
async function onSubmit() {
  const fr = formRef.value
  if (!fr) return
  await fr.validate(async (valid) => {
    if (!valid) return
    // 至少一行特殊运费但没有选地区 → 提示
    const blank = form.specialRules.findIndex((r) => r.regions.length === 0)
    if (blank >= 0) {
      ElMessage.error(`第 ${blank + 1} 行特殊运费还没选择地区`)
      return
    }
    if (!validateRegions()) return
    if (form.freeShippingEnabled) {
      const badIdx = form.freeShippingRules.findIndex(
        (r) => r.regions.length === 0 || r.threshold <= 0,
      )
      if (badIdx >= 0) {
        ElMessage.error(`第 ${badIdx + 1} 条包邮规则不完整`)
        return
      }
    }
    // 提交克隆数据，避免父组件后续操作影响响应式
    emit('submit', JSON.parse(JSON.stringify(form)))
  })
}

</script>

<template>
  <el-form
    ref="formRef"
    :model="form"
    :rules="rules"
    label-position="top"
    class="ship-form"
  >
    <!-- ========== 基础信息 ========== -->
    <section class="form-section">
      <header class="section-header">
        <span class="section-title">基础信息</span>
      </header>

      <div class="grid grid-2">
        <el-form-item label="模板名称" prop="templateName" required>
          <el-input
            v-model="form.templateName"
            maxlength="64"
            show-word-limit
            placeholder="例：默认小件陶瓷模板"
          />
        </el-form-item>

        <el-form-item label="计价方式" prop="calcType" required>
          <el-radio-group v-model="form.calcType">
            <el-radio-button :value="1">按件数</el-radio-button>
            <el-radio-button :value="2">按重量</el-radio-button>
          </el-radio-group>
          <span class="hint">切换后，下方规则的计量单位会自动联动。</span>
        </el-form-item>
      </div>
    </section>

    <!-- ========== 默认运费 ========== -->
    <section class="form-section">
      <header class="section-header">
        <span class="section-title">默认运费</span>
        <span class="section-sub">未命中下方"指定地区"时按此规则计算</span>
      </header>

      <div class="rule-line">
        <span class="rule-label">默认全国发货</span>
        <span class="rule-text">·</span>
        <span class="rule-text">{{ labels.firstAmount }}</span>
        <el-input-number
          v-model="form.defaultRule.firstAmount"
          :min="0"
          :step="form.calcType === 2 ? 0.5 : 1"
          :precision="form.calcType === 2 ? 2 : 0"
          controls-position="right"
          class="num-input"
        />
        <span class="rule-text">{{ labels.firstPrice }}</span>
        <el-input-number
          v-model="form.defaultRule.firstPrice"
          :min="0"
          :step="1"
          :precision="2"
          controls-position="right"
          class="num-input"
        />
        <span class="rule-text rule-text--mute">|</span>
        <span class="rule-text">{{ labels.continueAmount }}</span>
        <el-input-number
          v-model="form.defaultRule.continueAmount"
          :min="0"
          :step="form.calcType === 2 ? 0.5 : 1"
          :precision="form.calcType === 2 ? 2 : 0"
          controls-position="right"
          class="num-input"
        />
        <span class="rule-text">{{ labels.continuePrice }}</span>
        <el-input-number
          v-model="form.defaultRule.continuePrice"
          :min="0"
          :step="1"
          :precision="2"
          controls-position="right"
          class="num-input"
        />
      </div>
    </section>

    <!-- ========== 指定地区特殊运费 ========== -->
    <section class="form-section">
      <header class="section-header">
        <span class="section-title">指定地区特殊运费</span>
        <span class="section-sub">命中地区时优先使用此处规则，未命中走默认</span>
      </header>

      <el-empty
        v-if="form.specialRules.length === 0"
        description="暂未设置特殊运费"
        :image-size="56"
      />

      <div v-else class="special-list">
        <div
          v-for="(row, idx) in form.specialRules"
          :key="idx"
          class="special-row"
        >
          <div class="special-row-head">
            <span class="row-tag">规则 {{ idx + 1 }}</span>
            <el-select
              v-model="row.regions"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              :max-collapse-tags="3"
              placeholder="选择地区（省级）"
              class="region-select"
            >
              <el-option
                v-for="opt in REGION_OPTIONS"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              />
            </el-select>
            <el-button
              type="danger"
              link
              :icon="Delete"
              @click="removeSpecial(idx)"
            >
              删除
            </el-button>
          </div>

          <div class="rule-line rule-line--indent">
            <span class="rule-text">{{ labels.firstAmount }}</span>
            <el-input-number
              v-model="row.firstAmount"
              :min="0"
              :step="form.calcType === 2 ? 0.5 : 1"
              :precision="form.calcType === 2 ? 2 : 0"
              controls-position="right"
              class="num-input"
            />
            <span class="rule-text">{{ labels.firstPrice }}</span>
            <el-input-number
              v-model="row.firstPrice"
              :min="0"
              :step="1"
              :precision="2"
              controls-position="right"
              class="num-input"
            />
            <span class="rule-text rule-text--mute">|</span>
            <span class="rule-text">{{ labels.continueAmount }}</span>
            <el-input-number
              v-model="row.continueAmount"
              :min="0"
              :step="form.calcType === 2 ? 0.5 : 1"
              :precision="form.calcType === 2 ? 2 : 0"
              controls-position="right"
              class="num-input"
            />
            <span class="rule-text">{{ labels.continuePrice }}</span>
            <el-input-number
              v-model="row.continuePrice"
              :min="0"
              :step="1"
              :precision="2"
              controls-position="right"
              class="num-input"
            />
          </div>
        </div>
      </div>

      <el-button
        :icon="Plus"
        plain
        class="add-btn"
        @click="addSpecial"
      >
        为指定地区设置运费
      </el-button>
    </section>

    <!-- ========== 条件包邮 ========== -->
    <section class="form-section">
      <header class="section-header">
        <span class="section-title">条件包邮</span>
        <el-switch
          v-model="form.freeShippingEnabled"
          active-text="开启满额包邮"
          inline-prompt
        />
      </header>

      <div v-if="form.freeShippingEnabled" class="free-list">
        <div
          v-for="(row, idx) in form.freeShippingRules"
          :key="idx"
          class="rule-line rule-line--free"
        >
          <span class="row-tag">规则 {{ idx + 1 }}</span>
          <el-select
            v-model="row.regions"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            :max-collapse-tags="3"
            placeholder="选择地区（留空=全国）"
            class="region-select region-select--narrow"
          >
            <el-option
              v-for="opt in REGION_OPTIONS"
              :key="opt.value"
              :value="opt.value"
              :label="opt.label"
            />
          </el-select>
          <span class="rule-text">满</span>
          <el-input-number
            v-model="row.threshold"
            :min="0"
            :step="10"
            :precision="2"
            controls-position="right"
            class="num-input"
          />
          <span class="rule-text">元 即包邮</span>
          <el-button
            type="danger"
            link
            :icon="Delete"
            @click="removeFreeRule(idx)"
          />
        </div>

        <el-button
          :icon="Plus"
          plain
          class="add-btn"
          @click="addFreeRule"
        >
          再加一条包邮规则
        </el-button>
      </div>
    </section>

    <!-- ========== 表单底部操作 ========== -->
    <footer class="form-footer">
      <el-button @click="emit('cancel')">取消</el-button>
      <el-button type="primary" :loading="props.busy" @click="onSubmit">
        保存模板
      </el-button>
    </footer>
  </el-form>
</template>

<style scoped>
.ship-form {
  --gap-section: 24px;
  --border-soft: var(--ym-border, #e6e6e6);
  display: flex;
  flex-direction: column;
  gap: var(--gap-section);
}

.form-section {
  padding: 16px 18px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--ym-text, #1f2828);
}

.section-sub {
  font-size: 12px;
  color: var(--ym-text-secondary, #909399);
  flex: 1;
  text-align: right;
}

.grid {
  display: grid;
  gap: 16px;
}
.grid-2 {
  grid-template-columns: 1fr 1fr;
}

.hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--ym-text-secondary, #909399);
}

/* 一行规则：标签 + 输入数字 + 标签 + 输入数字 ... */
.rule-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px 14px;
  background: #fafbfc;
  border: 1px solid var(--border-soft);
  border-radius: 6px;
}
.rule-line--indent {
  background: #fff;
  border-style: dashed;
}
.rule-line--free {
  background: #fff;
  flex-wrap: wrap;
}

.rule-label {
  font-weight: 600;
  color: var(--ym-text, #1f2828);
}

.rule-text {
  font-size: 13px;
  color: var(--ym-text-secondary, #5c6470);
}
.rule-text--mute {
  color: #d4d7de;
  margin: 0 4px;
}

.num-input {
  width: 120px;
}

.special-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.special-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  background: #fcfcfd;
}

.special-row-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.row-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ym-primary, #1f2828);
  background: rgba(31, 40, 40, 0.06);
  border-radius: 4px;
  flex: none;
}

.region-select {
  flex: 1;
  min-width: 240px;
}
.region-select--narrow {
  min-width: 200px;
  max-width: 360px;
}

.add-btn {
  align-self: flex-start;
}

.free-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  position: sticky;
  bottom: 0;
  margin-top: 8px;
  padding: 14px 0 4px;
  background: linear-gradient(to top, #fff 80%, rgba(255, 255, 255, 0));
}

@media (max-width: 720px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
  .num-input {
    width: 100px;
  }
}
</style>
