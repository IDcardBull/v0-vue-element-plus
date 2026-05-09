<template>
  <div class="login-page">
    <div class="login-bg" />
    <div class="login-orbs">
      <span class="orb orb-1" />
      <span class="orb orb-2" />
      <span class="orb orb-3" />
    </div>

    <div class="login-card">
      <div class="login-brand">
        <div class="brand-logo">
          <img src="/logo.png" alt="央皿" />
        </div>
        <h1 class="brand-title">央&nbsp;皿</h1>
        <p class="brand-sub">YANG MIN · 一库多端管理系统</p>
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
            placeholder="账号"
            :prefix-icon="User"
            autocomplete="username"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
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
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-tip">
        <span>默认账号  admin / admin123</span>
      </div>

      <div class="login-footer">
        <span>© 2026 央皿陶瓷 · 一库多端管理系统</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
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
  background: linear-gradient(135deg, #1a2533 0%, #243447 50%, #2d2418 100%);
}
.login-bg {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 18% 28%, rgba(200, 169, 106, 0.18) 0%, transparent 55%),
    radial-gradient(circle at 82% 72%, rgba(94, 158, 255, 0.10) 0%, transparent 55%);
  pointer-events: none;
}
.login-orbs {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: 0.35;
}
.orb-1 { width: 320px; height: 320px; background: #c8a96a; top: -80px; left: -60px; }
.orb-2 { width: 260px; height: 260px; background: #5e9eff; bottom: -80px; right: -40px; }
.orb-3 { width: 180px; height: 180px; background: #c8a96a; top: 40%; right: 18%; opacity: 0.18; }

.login-card {
  position: relative;
  width: 420px;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border-radius: 20px;
  padding: 44px 40px 28px;
  box-shadow:
    0 30px 80px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(255, 255, 255, 0.4) inset;
}
.login-brand {
  text-align: center;
  margin-bottom: 28px;
}
.brand-logo {
  width: 84px;
  height: 84px;
  margin: 0 auto 14px;
  border-radius: 22px;
  background: linear-gradient(135deg, #ffffff 0%, #f5efe1 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 24px rgba(200, 169, 106, 0.28);
  overflow: hidden;
}
.brand-logo img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}
.brand-title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: #1f2d3d;
  letter-spacing: 8px;
}
.brand-sub {
  margin: 8px 0 0;
  color: #8492a6;
  font-size: 12px;
  letter-spacing: 3px;
}

.login-form :deep(.el-input__wrapper) {
  padding: 6px 14px;
  border-radius: 10px !important;
  box-shadow: 0 0 0 1px #e8ecf1 inset;
  transition: box-shadow 0.2s;
}
.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c8a96a inset;
}
.login-form :deep(.el-input.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 1.5px #c8a96a inset !important;
}

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  letter-spacing: 8px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1f2d3d 0%, #2a3f5f 100%);
  border: none;
  box-shadow: 0 6px 18px rgba(31, 45, 61, 0.28);
  transition: transform 0.15s, box-shadow 0.2s;
}
.login-btn:hover {
  background: linear-gradient(135deg, #2a3f5f 0%, #1f2d3d 100%);
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(31, 45, 61, 0.36);
}

.login-tip {
  text-align: center;
  color: #c8a96a;
  font-size: 12px;
  letter-spacing: 1px;
  padding: 4px 0 14px;
}
.login-footer {
  text-align: center;
  color: #c0c4cc;
  font-size: 12px;
  margin-top: 4px;
}
</style>
