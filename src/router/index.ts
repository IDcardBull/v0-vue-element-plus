import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const Layout = () => import('@/layout/Layout.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '控制台' },
      },
      {
        path: 'product',
        name: 'Product',
        redirect: '/product/list',
        meta: { title: '商品管理' },
        children: [
          {
            path: 'list',
            name: 'ProductList',
            component: () => import('@/views/product/ProductList.vue'),
            meta: { title: '商品列表' },
          },
        ],
      },
      {
        path: 'inventory',
        name: 'Inventory',
        component: () => import('@/views/Placeholder.vue'),
        meta: { title: '库存管理' },
      },
      {
        path: 'order',
        name: 'Order',
        component: () => import('@/views/Placeholder.vue'),
        meta: { title: '订单管理' },
      },
      {
        path: 'user',
        name: 'User',
        component: () => import('@/views/Placeholder.vue'),
        meta: { title: '用户管理' },
      },
      {
        path: 'system',
        name: 'System',
        component: () => import('@/views/Placeholder.vue'),
        meta: { title: '系统管理' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
