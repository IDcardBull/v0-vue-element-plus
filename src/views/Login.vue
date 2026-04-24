<template>
  <div class="login-page">
    <div class="login-bg" />
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-logo">
          <el-icon :size="40"><Coffee /></el-icon>
        </div>
        <h1 class="brand-title">央茗陶瓷</h1>
        <p class="brand-sub">一库多端后台管理系统</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        class="login-form"
        @submit.prevent="onSubmit"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入账号"
            :prefix-icon="User"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            class="login-btn"
            :loading="loading"
            native-type="submit"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-tip">
        <span>默认账号：admin / admin123</span>
      </div>

      <div class="login-footer">
        <span>© 2026 央茗陶瓷 · 一库多端管理系统</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock, Coffee } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({
  username: 'admin',
  password: 'admin123',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 4, message: '密码至少 4 位', trigger: 'blur' },
  ],
}

async function onSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login({ username: form.username, password: form.password })
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch {
    // 错误已由 axios 拦截器提示
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #1f2d3d 0%, #2a3f5f 50%, #3a2d1f 100%);
}
.login-bg {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(200, 169, 106, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(200, 169, 106, 0.08) 0%, transparent 50%);
  pointer-events: none;
}
.login-card {
  position: relative;
  width: 420px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 16px;
  padding: 48px 40px 32px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.login-brand {
  text-align: center;
  margin-bottom: 32px;
}
.brand-logo {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c8a96a 0%, #a88a4d 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 6px 16px rgba(200, 169, 106, 0.35);
}
.brand-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  color: #1f2d3d;
  letter-spacing: 2px;
}
.brand-sub {
  margin: 8px 0 0;
  color: #8492a6;
  font-size: 14px;
  letter-spacing: 1px;
}
.login-form :deep(.el-input__wrapper) {
  padding: 4px 12px;
}
.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  letter-spacing: 4px;
  background: linear-gradient(135deg, #1f2d3d 0%, #2a3f5f 100%);
  border: none;
}
.login-btn:hover {
  background: linear-gradient(135deg, #2a3f5f 0%, #1f2d3d 100%);
}
.login-tip {
  text-align: center;
  color: #c8a96a;
  font-size: 12px;
  padding: 4px 0 16px;
}
.login-footer {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  margin-top: 8px;
}
</style>
