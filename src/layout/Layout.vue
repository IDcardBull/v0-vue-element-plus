<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { menuData, type MenuItem } from './menu'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const currentUser = computed(() => authStore.user)

const isCollapse = ref(false)

// 当前激活的菜单项：使用完整路径
const activeMenu = computed(() => route.path)

/**
 * 面包屑：根据当前 path 在 menuData 中匹配层级
 */
const breadcrumbs = computed<{ title: string; path?: string }[]>(() => {
  const path = route.path
  const result: { title: string; path?: string }[] = [{ title: '首页', path: '/dashboard' }]
  for (const top of menuData) {
    if (top.children?.length) {
      const child = top.children.find((c) => c.index === path)
      if (child) {
        result.push({ title: top.title })
        result.push({ title: child.title })
        return result
      }
    }
    if (top.index === path) {
      result.push({ title: top.title })
      return result
    }
  }
  // 兜底：如果顶级路径匹配前缀
  const matched = menuData.find((m) => path.startsWith(m.index))
  if (matched) result.push({ title: matched.title })
  return result
})

function handleMenuSelect(index: string) {
  if (index !== route.path) router.push(index)
}

function toggleCollapse() {
  isCollapse.value = !isCollapse.value
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出当前登录账号？', '退出提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await authStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch {
    // cancel
  }
}

function handleDropdown(command: string) {
  if (command === 'logout') handleLogout()
  else if (command === 'profile') ElMessage.info('打开个人中心（占位）')
}

// 类型辅助
defineExpose({})
const _ = ref<MenuItem | null>(null)
</script>

<template>
  <el-container class="layout-root">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '220px'" class="layout-aside">
      <div class="brand">
        <div class="brand-logo">央</div>
        <transition name="fade">
          <div v-if="!isCollapse" class="brand-text">
            <div class="brand-title">央皿陶瓷</div>
            <div class="brand-subtitle">一库多端管理系统</div>
          </div>
        </transition>
      </div>

      <el-scrollbar class="menu-scroll">
        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          :collapse-transition="false"
          background-color="#1f2d3d"
          text-color="#c0c7d0"
          active-text-color="#c8a96a"
          @select="handleMenuSelect"
        >
          <template v-for="item in menuData" :key="item.index">
            <!-- 含子菜单 -->
            <el-sub-menu v-if="item.children?.length" :index="item.index">
              <template #title>
                <el-icon v-if="item.icon">
                  <component :is="item.icon" />
                </el-icon>
                <span>{{ item.title }}</span>
              </template>
              <el-menu-item
                v-for="child in item.children"
                :key="child.index"
                :index="child.index"
              >
                <el-icon v-if="child.icon">
                  <component :is="child.icon" />
                </el-icon>
                <template #title>{{ child.title }}</template>
              </el-menu-item>
            </el-sub-menu>

            <!-- 单项菜单 -->
            <el-menu-item v-else :index="item.index">
              <el-icon v-if="item.icon">
                <component :is="item.icon" />
              </el-icon>
              <template #title>{{ item.title }}</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-scrollbar>
    </el-aside>

    <el-container>
      <!-- 顶栏 -->
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn" :size="20" @click="toggleCollapse">
            <component :is="isCollapse ? 'Expand' : 'Fold'" />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item
              v-for="(bc, idx) in breadcrumbs"
              :key="idx"
              :to="bc.path ? { path: bc.path } : undefined"
            >
              {{ bc.title }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <el-tooltip content="全屏" placement="bottom">
            <el-icon class="header-icon" :size="18">
              <FullScreen />
            </el-icon>
          </el-tooltip>
          <el-tooltip content="消息中心" placement="bottom">
            <el-badge :value="3" :max="99" class="header-badge">
              <el-icon class="header-icon" :size="18">
                <Bell />
              </el-icon>
            </el-badge>
          </el-tooltip>

          <el-dropdown trigger="click" @command="handleDropdown">
            <div class="user-trigger">
              <el-avatar :size="32" shape="circle">
                <el-icon><User /></el-icon>
              </el-avatar>
              <span class="user-name">{{ currentUser?.realName || currentUser?.username || '管理员' }}</span>
              <el-icon><CaretBottom /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><UserFilled /></el-icon>个人中心
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <el-icon><Setting /></el-icon>账号设置
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="layout-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout-root {
  height: 100vh;
  width: 100%;
}

.layout-aside {
  background-color: #1f2d3d;
  transition: width 0.25s ease;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  padding: 0 16px;
  color: #fff;
  border-bottom: 1px solid #2b3b52;
  flex-shrink: 0;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: linear-gradient(135deg, #c8a96a, #a78849);
  color: #1f2d3d;
  font-weight: 700;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
}

.brand-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
}

.brand-subtitle {
  font-size: 12px;
  color: #8a98a8;
  margin-top: 2px;
}

.menu-scroll {
  flex: 1;
  overflow: hidden;
}

.menu-scroll :deep(.el-menu) {
  border-right: none;
}

.menu-scroll :deep(.el-menu-item.is-active) {
  background-color: #2b3b52 !important;
}

.layout-header {
  background: #fff;
  border-bottom: 1px solid var(--ym-border);
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  cursor: pointer;
  color: var(--ym-text-secondary);
  padding: 6px;
  border-radius: 4px;
  transition: all 0.2s;
}
.collapse-btn:hover {
  background-color: var(--ym-bg);
  color: var(--ym-primary);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 18px;
}

.header-icon {
  cursor: pointer;
  color: var(--ym-text-secondary);
  transition: color 0.2s;
}
.header-icon:hover {
  color: var(--ym-primary);
}

.header-badge :deep(.el-badge__content) {
  top: 2px;
  right: 10px;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}
.user-trigger:hover {
  background: var(--ym-bg);
}

.user-name {
  font-size: 14px;
  color: var(--ym-text);
}

.layout-main {
  padding: 16px;
  background-color: var(--ym-bg);
  overflow: auto;
}
</style>
