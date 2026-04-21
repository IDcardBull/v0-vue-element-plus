<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <el-card shadow="never">
    <el-empty :description="`${String(route.meta.title ?? '该模块')} · 建设中`">
      <template #image>
        <el-icon :size="64" color="#c8a96a"><Tools /></el-icon>
      </template>
    </el-empty>
  </el-card>
</template>
