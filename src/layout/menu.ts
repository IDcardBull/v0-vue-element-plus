/**
 * 侧边栏菜单数据结构
 * icon 字段直接使用 Element Plus Icons 组件名（已全局注册）
 */
export interface MenuItem {
  index: string
  title: string
  icon?: string
  children?: MenuItem[]
}

export const menuData: MenuItem[] = [
  {
    index: '/dashboard',
    title: '控制台',
    icon: 'Odometer',
  },
  {
    index: '/product',
    title: '商品管理',
    icon: 'Goods',
    children: [
      { index: '/product/manage', title: '管理商品', icon: 'Goods' },
      { index: '/product/category', title: '分类管理', icon: 'Collection' },
      { index: '/product/retail-banners', title: '零售首页轮播', icon: 'Picture' },
    ],
  },
  {
    // 库存管理简化版：单页，去掉了"库存预警"和"出入库记录"两个子菜单
    index: '/inventory/stock',
    title: '库存管理',
    icon: 'Box',
  },
  {
    index: '/order',
    title: '订单管理',
    icon: 'Document',
    children: [
      { index: '/order/retail', title: '零售订单', icon: 'ShoppingCart' },
      { index: '/order/wholesale', title: '批发订单', icon: 'Van' },
    ],
  },
  {
    index: '/user',
    title: '用户管理',
    icon: 'User',
    children: [
      { index: '/user/customer', title: '零售客户', icon: 'UserFilled' },
      { index: '/user/distributor', title: '批发客商', icon: 'OfficeBuilding' },
    ],
  },
  {
    index: '/system',
    title: '系统管理',
    icon: 'Setting',
    children: [
      { index: '/system/account', title: '账号管理', icon: 'Avatar' },
      { index: '/system/role', title: '角色权限', icon: 'Key' },
      { index: '/system/log', title: '操作日志', icon: 'Memo' },
    ],
  },
]
