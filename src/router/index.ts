import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const Layout = () => import('@/layout/Layout.vue')

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录', public: true, hidden: true },
  },
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
      // ---------- 商品管理 ----------
      {
        path: 'product',
        name: 'Product',
        redirect: '/product/retail',
        meta: { title: '商品管理' },
        children: [
          {
            path: 'list',
            redirect: '/product/retail',
            meta: { hidden: true },
          },
          {
            path: 'retail',
            name: 'ProductRetail',
            component: () => import('@/views/product/RetailProductList.vue'),
            meta: { title: '零售商品' },
          },
          {
            path: 'wholesale',
            name: 'ProductWholesale',
            component: () => import('@/views/product/WholesaleProductList.vue'),
            meta: { title: '批发商品' },
          },
          {
            path: 'create',
            name: 'ProductCreate',
            component: () => import('@/views/product/ProductForm.vue'),
            meta: { title: '新增商品', hidden: true },
          },
          {
            path: 'edit',
            name: 'ProductEdit',
            component: () => import('@/views/product/ProductForm.vue'),
            meta: { title: '编辑商品', hidden: true },
          },
          {
            path: 'category',
            name: 'ProductCategory',
            component: () => import('@/views/product/CategoryTree.vue'),
            meta: { title: '分类管理' },
          },
          {
            path: 'brand',
            name: 'ProductBrand',
            component: () => import('@/views/product/BrandList.vue'),
            meta: { title: '品牌管理' },
          },
        ],
      },
      // ---------- 库存管理 ----------
      {
        path: 'inventory',
        name: 'Inventory',
        redirect: '/inventory/stock',
        meta: { title: '库存管理' },
        children: [
          {
            path: 'stock',
            name: 'InventoryStock',
            component: () => import('@/views/inventory/StockList.vue'),
            meta: { title: '实时库存' },
          },
          {
            path: 'warning',
            name: 'InventoryWarning',
            component: () => import('@/views/inventory/StockWarning.vue'),
            meta: { title: '库存预警' },
          },
          {
            path: 'record',
            name: 'InventoryRecord',
            component: () => import('@/views/inventory/StockRecord.vue'),
            meta: { title: '出入库记录' },
          },
        ],
      },
      // ---------- 订单管理 ----------
      {
        path: 'order',
        name: 'Order',
        redirect: '/order/retail',
        meta: { title: '订单管理' },
        children: [
          {
            path: 'retail',
            name: 'OrderRetail',
            component: () => import('@/views/order/OrderList.vue'),
            meta: { title: '零售订单' },
          },
          {
            path: 'wholesale',
            name: 'OrderWholesale',
            component: () => import('@/views/order/OrderList.vue'),
            meta: { title: '批发订单' },
          },
        ],
      },
      // ---------- 用户管理 ----------
      {
        path: 'user',
        name: 'User',
        redirect: '/user/customer',
        meta: { title: '用户管理' },
        children: [
          {
            path: 'customer',
            name: 'UserCustomer',
            component: () => import('@/views/user/CustomerList.vue'),
            meta: { title: '零售客户' },
          },
          {
            path: 'distributor',
            name: 'UserDistributor',
            component: () => import('@/views/user/DistributorList.vue'),
            meta: { title: '批发客商' },
          },
        ],
      },
      // ---------- 系统管理 ----------
      {
        path: 'system',
        name: 'System',
        redirect: '/system/account',
        meta: { title: '系统管理' },
        children: [
          {
            path: 'account',
            name: 'SystemAccount',
            component: () => import('@/views/system/AccountList.vue'),
            meta: { title: '账号管理' },
          },
          {
            path: 'role',
            name: 'SystemRole',
            component: () => import('@/views/system/RoleList.vue'),
            meta: { title: '角色权限' },
          },
          {
            path: 'log',
            name: 'SystemLog',
            component: () => import('@/views/system/LogList.vue'),
            meta: { title: '操作日志' },
          },
        ],
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// ========= 全局守卫：未登录跳转到 /login =========
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')
  const isPublic = to.meta?.public === true
  if (!token && !isPublic) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  if (token && to.path === '/login') {
    next({ path: '/dashboard' })
    return
  }
  next()
})

export default router
