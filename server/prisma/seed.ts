import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('[seed] 开始写入种子数据...')

  // 清理（按依赖顺序）
  await prisma.statement.deleteMany()
  await prisma.stock.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.priceTier.deleteMany()
  await prisma.sku.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.address.deleteMany()
  await prisma.distributor.deleteMany()
  await prisma.user.deleteMany()
  await prisma.userLevel.deleteMany()
  await prisma.operationLog.deleteMany()
  await prisma.adminUserRole.deleteMany()
  await prisma.role.deleteMany()
  await prisma.adminUser.deleteMany()
  await prisma.dictItem.deleteMany()
  await prisma.dictType.deleteMany()

  // 1. 角色
  const [superRole, productMgr, orderMgr] = await Promise.all([
    prisma.role.create({
      data: {
        code: 'super_admin',
        name: '超级管理员',
        description: '拥有所有权限',
        menuPerms: ['*'],
        dataPerms: { scope: 'all' },
        apiPerms: ['*'],
        sort: 1,
      },
    }),
    prisma.role.create({
      data: {
        code: 'product_mgr',
        name: '商品运营',
        description: '管理商品、分类、库存',
        menuPerms: ['dashboard', 'product:*', 'inventory:*'],
        dataPerms: { scope: 'all' },
        sort: 2,
      },
    }),
    prisma.role.create({
      data: {
        code: 'order_mgr',
        name: '订单销售',
        description: '订单处理、客户查看',
        menuPerms: ['dashboard', 'order:*', 'user:customer'],
        dataPerms: { scope: 'all' },
        sort: 3,
      },
    }),
  ])

  // 2. 管理员账号
  const pwd = await bcrypt.hash('admin123', 10)
  const admin = await prisma.adminUser.create({
    data: {
      username: 'admin',
      password: pwd,
      realName: '系统管理员',
      phone: '13800000000',
      email: 'admin@yangming.com',
      department: '信息部',
      roles: { create: [{ roleId: superRole.id }] },
    },
  })
  const operator = await prisma.adminUser.create({
    data: {
      username: 'operator',
      password: pwd,
      realName: '王运营',
      phone: '13800000001',
      department: '运营部',
      roles: { create: [{ roleId: productMgr.id }] },
    },
  })
  const sale = await prisma.adminUser.create({
    data: {
      username: 'sale01',
      password: pwd,
      realName: '李销售',
      phone: '13800000002',
      department: '销售部',
      roles: { create: [{ roleId: orderMgr.id }] },
    },
  })

  // 3. 字典（v2 简化：移除工艺 / 胎质字典；保留为空，留待业务侧自定义）

  // 4. 会员等级
  const [bronze, silver, gold, diamond] = await Promise.all([
    prisma.userLevel.create({ data: { code: 'bronze', name: '普通', minSpent: 0, discount: 1.0, pointsRate: 1.0 } }),
    prisma.userLevel.create({ data: { code: 'silver', name: '白银', minSpent: 1000, discount: 0.98, pointsRate: 1.2 } }),
    prisma.userLevel.create({ data: { code: 'gold', name: '黄金', minSpent: 5000, discount: 0.95, pointsRate: 1.5 } }),
    prisma.userLevel.create({ data: { code: 'diamond', name: '钻石', minSpent: 20000, discount: 0.9, pointsRate: 2.0 } }),
  ])

  // 5. 分类（三级树）
  const cateCha = await prisma.category.create({ data: { code: 'C001', name: '茶具', sort: 1, level: 1 } })
  const cateHua = await prisma.category.create({ data: { code: 'C002', name: '花瓶', sort: 2, level: 1 } })
  const cateCan = await prisma.category.create({ data: { code: 'C003', name: '餐具', sort: 3, level: 1 } })
  const cateChabei = await prisma.category.create({
    data: { code: 'C001001', name: '主人杯', sort: 1, level: 2, parentId: cateCha.id },
  })
  const cateChahu = await prisma.category.create({
    data: { code: 'C001002', name: '紫砂壶', sort: 2, level: 2, parentId: cateCha.id },
  })
  await prisma.category.create({
    data: { code: 'C001003', name: '盖碗', sort: 3, level: 2, parentId: cateCha.id },
  })
  await prisma.category.create({
    data: { code: 'C002001', name: '家用花瓶', sort: 1, level: 2, parentId: cateHua.id },
  })

  // 6. 品牌（v2 简化：已移除品牌实体）

  // 7. 仓库
  const [whMain, whJD] = await Promise.all([
    prisma.warehouse.create({
      data: { code: 'WH-MAIN', name: '总仓-上海', address: '上海市嘉定区XX路100号', manager: '刘仓库', phone: '13600000001', isDefault: true },
    }),
    prisma.warehouse.create({
      data: { code: 'WH-JD', name: '景德镇分仓', address: '江西景德镇XX路', manager: '陈主管', phone: '13600000002' },
    }),
  ])

  // 8. 商品 + SKU + 阶梯价 + 多仓库存
  const product1 = await prisma.product.create({
    data: {
      code: 'P-CHA-001',
      name: '青花瓷功夫茶具一套·六件装',
      categoryId: cateChabei.id,
      mainImage: '/placeholder.svg',
      images: ['/placeholder.svg', '/placeholder.svg'],
      detail: '<p>精选景德镇高岭土，匠心手绘青花，茶壶+四茶杯+茶盘一套六件</p>',
      tags: ['热销', '推荐'],
      retailEnabled: true,
      retailPrice: 398,
      memberPrice: 358,
      costPrice: 180,
      promoActivities: ['满减', '拼团'],
      wholesaleEnabled: true,
      minWholesaleQty: 10,
      dealerLevels: ['silver', 'gold', 'diamond'],
      salesCount: 1280,
      rating: 4.8,
    },
  })
  const sku1a = await prisma.sku.create({
    data: {
      productId: product1.id,
      code: 'SKU-CHA-001-A',
      specs: { 款式: '青花', 规格: '六件套', 包装: '精装' },
      image: '/placeholder.svg',
      retailPrice: 398,
      memberPrice: 358,
      costPrice: 180,
      weight: 2.5,
    },
  })
  const sku1b = await prisma.sku.create({
    data: {
      productId: product1.id,
      code: 'SKU-CHA-001-B',
      specs: { 款式: '青花', 规格: '六件套', 包装: '礼盒装' },
      image: '/placeholder.svg',
      retailPrice: 458,
      memberPrice: 418,
      costPrice: 210,
      weight: 3.0,
    },
  })

  // 多仓库存
  await prisma.stock.createMany({
    data: [
      { skuId: sku1a.id, warehouseId: whMain.id, onHand: 120 },
      { skuId: sku1a.id, warehouseId: whJD.id, onHand: 66 },
      { skuId: sku1b.id, warehouseId: whMain.id, onHand: 68 },
    ],
  })

  // 阶梯价
  await prisma.priceTier.createMany({
    data: [
      { skuId: sku1a.id, minQty: 10, maxQty: 49, price: 320 },
      { skuId: sku1a.id, minQty: 50, maxQty: 199, price: 280 },
      { skuId: sku1a.id, minQty: 200, maxQty: null, price: 240 },
    ],
  })

  const product2 = await prisma.product.create({
    data: {
      code: 'P-HUA-001',
      name: '羊脂玉白骨瓷花瓶',
      categoryId: cateHua.id,
      mainImage: '/placeholder.svg',
      tags: ['新品'],
      retailEnabled: true,
      retailPrice: 1299,
      memberPrice: 1099,
      costPrice: 580,
      wholesaleEnabled: true,
      minWholesaleQty: 5,
      dealerLevels: ['gold', 'diamond'],
      salesCount: 215,
    },
  })
  const sku2a = await prisma.sku.create({
    data: {
      productId: product2.id,
      code: 'SKU-HUA-001-A',
      specs: { 颜色: '白色', 尺寸: '大号' },
      image: '/placeholder.svg',
      retailPrice: 1299,
      memberPrice: 1099,
      costPrice: 580,
      weight: 3.5,
    },
  })
  await prisma.stock.create({
    data: { skuId: sku2a.id, warehouseId: whMain.id, onHand: 8 },
  })
  await prisma.priceTier.createMany({
    data: [
      { skuId: sku2a.id, minQty: 5, maxQty: 19, price: 980 },
      { skuId: sku2a.id, minQty: 20, maxQty: null, price: 880 },
    ],
  })

  const product3 = await prisma.product.create({
    data: {
      code: 'P-CHA-002',
      name: '汝窑开片主人杯',
      categoryId: cateChabei.id,
      mainImage: '/placeholder.svg',
      retailEnabled: true,
      retailPrice: 288,
      memberPrice: 258,
      wholesaleEnabled: true,
      minWholesaleQty: 20,
      salesCount: 156,
    },
  })
  const sku3a = await prisma.sku.create({
    data: {
      productId: product3.id,
      code: 'SKU-CHA-002-A',
      specs: { 颜色: '天青色' },
      image: '/placeholder.svg',
      retailPrice: 288,
      memberPrice: 258,
      weight: 0.3,
    },
  })
  await prisma.stock.create({
    data: { skuId: sku3a.id, warehouseId: whMain.id, onHand: 386 },
  })
  await prisma.priceTier.createMany({
    data: [
      { skuId: sku3a.id, minQty: 20, maxQty: 99, price: 220 },
      { skuId: sku3a.id, minQty: 100, maxQty: null, price: 180 },
    ],
  })

  // 8. 零售会员
  const customer1 = await prisma.user.create({
    data: {
      openid: 'oYZ_c_001',
      phone: '13900000001',
      nickname: '张女士',
      role: 'retail',
      levelId: gold.id,
      points: 469,
      balance: 50,
      totalSpent: 4688,
    },
  })
  await prisma.address.create({
    data: {
      userId: customer1.id,
      receiver: '张女士',
      phone: '13900000001',
      province: '广东省',
      city: '广州市',
      district: '天河区',
      detail: '天河路100号',
      isDefault: true,
      tag: '家',
    },
  })
  const customer2 = await prisma.user.create({
    data: {
      openid: 'oYZ_c_002',
      phone: '13900000002',
      nickname: '李先生',
      role: 'retail',
      levelId: silver.id,
      points: 158,
      totalSpent: 1580,
    },
  })
  await prisma.user.create({
    data: {
      openid: 'oYZ_c_003',
      phone: '13900000003',
      nickname: '王女士',
      role: 'retail',
      levelId: bronze.id,
      points: 56,
      totalSpent: 566,
    },
  })

  // 9. 分销商
  const dealerUser1 = await prisma.user.create({
    data: {
      openid: 'oYZ_d_001',
      phone: '13700000001',
      nickname: '广州茶文化',
      role: 'dealer',
    },
  })
  await prisma.distributor.create({
    data: {
      userId: dealerUser1.id,
      companyName: '广州茶文化贸易有限公司',
      contactName: '陈老板',
      contactPhone: '13700000001',
      region: '广东·广州',
      level: 'diamond',
      creditLimit: 500000,
      creditUsed: 180000,
      totalPurchase: 580000,
      auditStatus: 'approved',
      auditedBy: admin.id,
      auditedAt: new Date(),
      salesmanId: sale.id,
    },
  })

  const dealerUser2 = await prisma.user.create({
    data: { openid: 'oYZ_d_002', phone: '13700000002', nickname: '景德陶坊', role: 'dealer' },
  })
  await prisma.distributor.create({
    data: {
      userId: dealerUser2.id,
      companyName: '景德镇御品陶瓷工坊',
      contactName: '李师傅',
      contactPhone: '13700000002',
      region: '江西·景德镇',
      level: 'gold',
      creditLimit: 200000,
      creditUsed: 45000,
      totalPurchase: 235000,
      auditStatus: 'approved',
      auditedBy: admin.id,
      auditedAt: new Date(),
      salesmanId: sale.id,
    },
  })

  const dealerUser3 = await prisma.user.create({
    data: { openid: 'oYZ_d_003', phone: '13700000003', nickname: '上海品茗', role: 'dealer' },
  })
  await prisma.distributor.create({
    data: {
      userId: dealerUser3.id,
      companyName: '上海品茗文化传播',
      contactName: '王总',
      contactPhone: '13700000003',
      region: '上海',
      level: 'normal',
      auditStatus: 'pending',
    },
  })

  // 10. 订单
  await prisma.order.create({
    data: {
      orderNo: 'YM20260424001',
      userId: customer1.id,
      channel: 'retail',
      source: 'miniprogram',
      status: 'pending_ship',
      totalAmount: 398,
      discountAmount: 40,
      freight: 0,
      paidAmount: 358,
      payMethod: 'wechat',
      paidAt: new Date(),
      receiverSnapshot: {
        receiver: '张女士',
        phone: '13900000001',
        province: '广东省',
        city: '广州市',
        district: '天河区',
        detail: '天河路100号',
      },
      items: {
        create: [
          {
            productId: product1.id,
            skuId: sku1a.id,
            productName: product1.name,
            skuSpec: '青花 · 六件套 · 精装',
            skuImage: sku1a.image,
            qty: 1,
            unitPrice: 358,
            subtotal: 358,
          },
        ],
      },
    },
  })

  await prisma.order.create({
    data: {
      orderNo: 'YM20260424002',
      userId: dealerUser1.id,
      channel: 'wholesale',
      source: 'b2b',
      status: 'shipped',
      totalAmount: 32000,
      discountAmount: 0,
      freight: 200,
      paidAmount: 32200,
      useCredit: true,
      payMethod: 'credit',
      paidAt: new Date(),
      shippedAt: new Date(),
      logisticsCompany: '顺丰速运',
      trackingNo: 'SF1234567890',
      receiverSnapshot: {
        receiver: '广州茶文化',
        phone: '13700000001',
        province: '广东省',
        city: '广州市',
        district: '越秀区',
        detail: '东风东路200号',
      },
      remark: '批发订单，走授信',
      items: {
        create: [
          {
            productId: product1.id,
            skuId: sku1a.id,
            productName: product1.name,
            skuSpec: '青花 · 六件套 · 精装',
            skuImage: sku1a.image,
            qty: 100,
            unitPrice: 280,
            subtotal: 28000,
          },
          {
            productId: product3.id,
            skuId: sku3a.id,
            productName: product3.name,
            skuSpec: '天青色',
            skuImage: sku3a.image,
            qty: 20,
            unitPrice: 220,
            subtotal: 4400,
          },
        ],
      },
    },
  })

  await prisma.order.create({
    data: {
      orderNo: 'YM20260424003',
      userId: customer2.id,
      channel: 'retail',
      source: 'miniprogram',
      status: 'pending_pay',
      totalAmount: 1299,
      discountAmount: 200,
      freight: 15,
      receiverSnapshot: {
        receiver: '李先生',
        phone: '13900000002',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国路50号',
      },
      items: {
        create: [
          {
            productId: product2.id,
            skuId: sku2a.id,
            productName: product2.name,
            skuSpec: '白色 · 大号',
            skuImage: sku2a.image,
            qty: 1,
            unitPrice: 1099,
            subtotal: 1099,
          },
        ],
      },
    },
  })

  console.log('[seed] 完成')
  console.log('[seed] 默认管理员：admin / admin123')
}

main()
  .catch(e => {
    console.error('[seed] 失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
