import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'

import App from './App.vue'
import router from './router'
import './styles/global.css'

// 调试：把错误暴露到 window.__errors 以便 agent-browser 读取
;(window as any).__errors = []
window.addEventListener('error', e => (window as any).__errors.push(String(e.error?.stack || e.message)))
window.addEventListener('unhandledrejection', e => (window as any).__errors.push('reject:' + String((e as any).reason?.stack || (e as any).reason)))

const app = createApp(App)
app.config.errorHandler = (err: any) => (window as any).__errors.push('vue:' + String(err?.stack || err))

// 注册 Element Plus 所有图标为全局组件
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component as any)
}

app.use(createPinia())
app.use(ElementPlus, { locale: zhCn })
app.use(router)
app.mount('#app')
