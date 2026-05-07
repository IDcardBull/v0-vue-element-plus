<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type UploadRequestOptions } from 'element-plus'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
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

const router = useRouter()
const bannerLoading = ref(false)
const bannerSaving = ref(false)
const bannerUploadingIndex = ref<number | null>(null)
const banners = ref<BannerFormItem[]>([])

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

function addBanner() {
  banners.value.push({
    id: `local-${Date.now()}`,
    title: '',
    imageUrl: '',
    linkUrl: '',
    sort: banners.value.length + 1,
    enabled: true,
  })
}

function removeBanner(index: number) {
  banners.value.splice(index, 1)
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
  const invalid = banners.value.find((item) => !item.imageUrl)
  if (invalid) {
    ElMessage.error('请先上传所有轮播图图片')
    return
  }
  bannerSaving.value = true
  try {
    const payload = banners.value.map(({ id, ...item }) => ({
      ...item,
      sort: Number(item.sort) || 0,
    }))
    await homeApi.saveBanners(payload)
    ElMessage.success('首页轮播图已保存')
    await loadBanners()
  } finally {
    bannerSaving.value = false
  }
}

function goBack() {
  router.push('/product/retail')
}

onMounted(loadBanners)
</script>

<template>
  <div class="home-banner-page">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
        <el-divider direction="vertical" />
        <div>
          <h2 class="page-title">首页轮播图设置</h2>
          <div class="page-desc">用于小程序首页顶部轮播，接口：/api/home/banners</div>
        </div>
      </div>
      <div class="header-actions">
        <el-button :icon="'RefreshLeft'" @click="loadBanners">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="addBanner">新增轮播图</el-button>
        <el-button type="success" :loading="bannerSaving" @click="saveBanners">保存设置</el-button>
      </div>
    </div>

    <el-card shadow="never" class="banner-card" v-loading="bannerLoading">
      <el-empty v-if="banners.length === 0" description="暂无轮播图">
        <el-button type="primary" :icon="Plus" @click="addBanner">新增轮播图</el-button>
      </el-empty>

      <div v-else class="banner-list">
        <div v-for="(banner, index) in banners" :key="banner.id" class="banner-item">
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
                <el-icon><Plus /></el-icon>
                <span>{{ bannerUploadingIndex === index ? '上传中...' : '上传图片' }}</span>
              </div>
              <div v-if="banner.imageUrl" class="banner-image-mask">点击更换</div>
            </div>
          </el-upload>

          <div class="banner-form">
            <el-input v-model="banner.title" placeholder="轮播标题" />
            <el-input v-model="banner.linkUrl" placeholder="跳转链接，如 /pages/product/detail?id=1" />
            <div class="banner-form-row">
              <el-input-number v-model="banner.sort" :min="0" controls-position="right" placeholder="排序" />
              <el-switch v-model="banner.enabled" active-text="启用" inactive-text="停用" inline-prompt />
              <el-button type="danger" plain @click="removeBanner(index)">删除</el-button>
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

.header-left,
.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-actions {
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
  margin-top: 4px;
  font-size: 12px;
  color: var(--ym-text-secondary);
}

.banner-card :deep(.el-card__body) {
  padding: 20px;
}

.banner-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
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

.banner-upload,
.banner-upload :deep(.el-upload) {
  display: block;
  flex: none;
}

.banner-image-box {
  position: relative;
  width: 200px;
  height: 106px;
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
  gap: 6px;
  color: #909399;
  font-size: 12px;
}

.banner-image-placeholder .el-icon {
  font-size: 22px;
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
</style>
