<template>
  <div class="settings-page">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>系统设置</span>
        </div>
      </template>

      <el-form label-width="200px" :model="form">
        <el-form-item label="企业微信机器人 Webhook">
          <el-input
            v-model="form.weworkBotUrl"
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
            clearable
          />
          <div class="hint">
            零售小程序「客服」页提交的反馈会异步推送到此机器人。留空则不推送（仍存库）。
          </div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
          <el-button :loading="testing" @click="test">发送测试消息</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { settingApi } from '@/api/setting'

const form = ref({ weworkBotUrl: '' })
const saving = ref(false)
const testing = ref(false)

async function load() {
  try {
    const res: any = await settingApi.get('wework_bot_url')
    form.value.weworkBotUrl = res?.value || ''
  } catch (e: any) {
    ElMessage.error(e?.message || '加载失败')
  }
}

async function save() {
  saving.value = true
  try {
    await settingApi.set(
      'wework_bot_url',
      form.value.weworkBotUrl.trim(),
      '企业微信群机器人 Webhook URL（用于客服反馈通知）',
    )
    ElMessage.success('已保存')
  } catch (e: any) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function test() {
  testing.value = true
  try {
    const res: any = await settingApi.testWework(form.value.weworkBotUrl.trim() || undefined)
    if (res?.ok) ElMessage.success('测试消息已发送，请到企业微信群查看')
    else ElMessage.error('发送失败：' + (res?.message || res?.response || res?.status || '未知错误'))
  } catch (e: any) {
    ElMessage.error(e?.message || '测试失败')
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.settings-page { padding: 16px; }
.card-header { font-weight: 600; }
.hint { color: #999; font-size: 12px; margin-top: 4px; line-height: 1.6; }
</style>
