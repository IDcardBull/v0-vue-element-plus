<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox, type UploadRequestOptions } from 'element-plus'
import {
  Bottom,
  Delete as DeleteIcon,
  Picture,
  Plus,
  Refresh,
  Top,
} from '@element-plus/icons-vue'
import { homeApi, type HomeBanner } from '@/api/home'
import { uploadApi } from '@/api/upload'

interface BannerFormItem extends HomeBanner {
  id: number | string
  title: string
  imageUrl: string
  linkUrl: string
  sort: number
  enabled: boolean
}

const bannerLoading = ref(false)
const bannerSaving = ref(false)
const bannerUploadingIndex = ref<number | null>(null)
const banners = ref<BannerFormItem[]>([])

const enabledCount = computed(() => banners.value.filter((b) => b.enabled).length)

function normalizeBanner(item: HomeBanner, index: number): BannerFormItem {
  return {
    id: item.id ?? `local-${Date.now()}-${index}`,
    title: item.title || '',
    imageUrl: item.imageUrl || item.image || '',
    linkUrl: item.linkUrl || item.link || '',
    sort: item.sort ?? index + 1,
    enabled: item.enabled ?? true,
  }
}

async function loadBanners() {
  bannerLoading.value = true
  try {
    const res = await homeApi.banners()
    const list = Array.isArray(res) ? res : res?.list ?? []
    banners.value = list.map(normalizeBanner)
  } catch (error) {
    banners.value = []
  } finally {
    bannerLoading.value = false
  }
}

function nextSort() {
  if (banners.value.length === 0) return 1
  return Math.max(...banners.value.map((b) => Number(b.sort) || 0)) + 1
}

function addBanner() {
  banners.value.push({
    id: `local-${Date.now()}`,
    title: '',
    imageUrl: '',
    linkUrl: '',
    sort: nextSort(),
    enabled: true,
  })
}

async function removeBanner(index: number) {
  const target = banners.value[index]
  if (!target) return
  // 已上传过图片的需要二次确认，纯空行直接删
  if (target.imageUrl) {
    try {
      await ElMessageBox.confirm(
        `确认删除${target.title ? `「${target.title}」` : '这张轮播图'}？`,
        '删除轮播图',
        { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
      )
    } catch {
      return
    }
  }
  banners.value.splice(index, 1)
  reflowSort()
}

function moveBanner(index: number, delta: -1 | 1) {
  const target = index + delta
  if (target < 0 || target >= banners.value.length) return
  const arr = banners.value.slice()
  ;[arr[index], arr[target]] = [arr[target], arr[index]]
  banners.value = arr
  reflowSort()
}

/** 调整后按当前数组顺序重写 sort，避免运营手动改数字 */
function reflowSort() {
  banners.value.forEach((b, i) => {
    b.sort = i + 1
  })
}

function validateBannerImage(file: File) {
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

function createBannerUploadHandler(index: number) {
  return async (options: UploadRequestOptions) => {
    const file = options.file
    if (!validateBannerImage(file)) {
      options.onError(new Error('图片校验失败') as any)
      return
    }
    bannerUploadingIndex.value = index
    try {
      const res = await uploadApi.file(file)
      if (!res?.url) throw new Error('上传接口未返回图片地址')
      banners.value[index].imageUrl = res.url
      options.onSuccess(res)
      ElMessage.success('轮播图上传成功')
    } catch (error) {
      options.onError(error as any)
      ElMessage.error((error as Error)?.message || '轮播图上传失败')
    } finally {
      bannerUploadingIndex.value = null
    }
  }
}

async function saveBanners() {
  const invalidIdx = banners.value.findIndex((item) => !item.imageUrl)
  if (invalidIdx >= 0) {
    ElMessage.error(`第 ${invalidIdx + 1} 项还没上传图片`)
    return
  }
  reflowSort()
  bannerSaving.value = true
  try {
    const payload = banners.value.map(({ id, ...item }, idx) => ({
      // 只把真正来自后端的数字 id 上送，本地占位 id 丢掉让后端走 create 分支
      ...(typeof id === 'number' ? { id } : {}),
      ...item,
      sort: Number(item.sort) || idx + 1,
    }))
    await homeApi.saveBanners(payload)
    ElMessage.success('首页轮播图已保存')
    await loadBanners()
  } finally {
    bannerSaving.value = false
  }
}

onMounted(loadBanners)
</script>

<template>
  <div class="home-banner-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">零售首页轮播</h2>
        <div class="page-desc">
          B2C 小程序首页顶部 swiper · 建议比例 4:3（1200×900）·
          已启用 <span class="strong">{{ enabledCount }}</span> / 共 {{ banners.length }} 张
        </div>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadBanners">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="addBanner">新增轮播图</el-button>
        <el-button type="success" :loading="bannerSaving" @click="saveBanners">保存设置</el-button>
      </div>
    </div>

    <el-card shadow="never" class="banner-card" v-loading="bannerLoading">
      <el-empty v-if="banners.length === 0" description="暂无轮播图，新增第一张试试">
        <el-button type="primary" :icon="Plus" @click="addBanner">新增轮播图</el-button>
      </el-empty>

      <div v-else class="banner-list">
        <div v-for="(banner, index) in banners" :key="banner.id" class="banner-item">
          <div class="banner-index">
            <span class="index-num">{{ index + 1 }}</span>
            <div class="index-tools">
              <el-button
                size="small"
                text
                :icon="Top"
                :disabled="index === 0"
                @click="moveBanner(index, -1)"
                title="上移"
              />
              <el-button
                size="small"
                text
                :icon="Bottom"
                :disabled="index === banners.length - 1"
                @click="moveBanner(index, 1)"
                title="下移"
              />
            </div>
          </div>

          <el-upload
            class="banner-upload"
            :show-file-list="false"
            :http-request="createBannerUploadHandler(index)"
            :disabled="bannerUploadingIndex === index"
            accept="image/*"
          >
            <div class="banner-image-box">
              <img v-if="banner.imageUrl" :src="banner.imageUrl" alt="轮播图" />
              <div v-else class="banner-image-placeholder">
                <el-icon><Picture /></el-icon>
                <span>{{ bannerUploadingIndex === index ? '上传中…' : '点击上传图片' }}</span>
                <span class="hint">建议 4:3，≤ 5MB</span>
              </div>
              <div v-if="banner.imageUrl" class="banner-image-mask">点击更换</div>
            </div>
          </el-upload>

          <div class="banner-form">
            <el-input v-model="banner.title" placeholder="轮播标题（仅后台展示，可空）" maxlength="30" show-word-limit />
            <el-input v-model="banner.linkUrl" placeholder="点击跳转，例：/pages/detail/detail?id=1（留空则不跳转）" />
            <div class="banner-form-row">
              <el-switch
                v-model="banner.enabled"
                active-text="启用"
                inactive-text="停用"
                inline-prompt
              />
              <el-tag v-if="!banner.enabled" type="info" size="small">客户端不显示</el-tag>
              <span class="spacer" />
              <el-button type="danger" plain :icon="DeleteIcon" @click="removeBanner(index)">删除</el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.home-banner-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid var(--ym-border);
}

.header-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--ym-primary);
}

.page-desc {
  font-size: 12px;
  color: var(--ym-text-secondary);
}

.page-desc .strong {
  color: var(--ym-primary);
  font-weight: 600;
}

.banner-card :deep(.el-card__body) {
  padding: 20px;
}

.banner-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  gap: 16px;
}

.banner-item {
  display: flex;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--ym-border);
  border-radius: 8px;
  background: #fafbfc;
}

.banner-index {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: none;
}

.index-num {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ym-primary);
  color: #fff;
  font-weight: 600;
  font-size: 13px;
}

.index-tools {
  display: flex;
  flex-direction: column;
}

.banner-upload,
.banner-upload :deep(.el-upload) {
  display: block;
  flex: none;
}

.banner-image-box {
  position: relative;
  width: 200px;
  height: 150px; /* 4:3 */
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  overflow: hidden;
  background: #fff;
  cursor: pointer;
}

.banner-image-box img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.banner-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #909399;
  font-size: 12px;
}

.banner-image-placeholder .el-icon {
  font-size: 26px;
}

.banner-image-placeholder .hint {
  font-size: 11px;
  color: #c0c4cc;
}

.banner-image-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.2s;
}

.banner-image-box:hover .banner-image-mask {
  opacity: 1;
}

.banner-form {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.banner-form-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.banner-form-row .spacer {
  flex: 1;
}
</style>
