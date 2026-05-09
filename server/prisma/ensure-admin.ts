/**
 * 幂等地确保 super_admin 角色 + admin/admin123 账号存在。
 * 用法：cd server && pnpm tsx prisma/ensure-admin.ts
 *
 * 逻辑：
 *  1. 找/建 super_admin 角色（不动已存在角色的权限配置）
 *  2. 用 username='admin' upsert 一条 AdminUser，密码强制刷新为 bcrypt('admin123')
 *  3. 确保 admin 已被分配 super_admin 角色
 *  4. 确保 status=1（启用）
 *
 * 跟 seed.ts 不同：本脚本绝不 deleteMany，安全用于已有真实数据的库。
 */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const USERNAME = 'admin'
const PASSWORD = 'admin123'

async function main() {
  console.log('[ensure-admin] 开始...')

  // 1. super_admin 角色：有就用、没有就建
  let superRole = await prisma.role.findUnique({ where: { code: 'super_admin' } })
  if (!superRole) {
    superRole = await prisma.role.create({
      data: {
        code: 'super_admin',
        name: '超级管理员',
        description: '拥有所有权限',
        menuPerms: ['*'],
        dataPerms: { scope: 'all' },
        apiPerms: ['*'],
        sort: 1,
      },
    })
    console.log('[ensure-admin] 已创建角色 super_admin (id=' + superRole.id + ')')
  } else {
    console.log('[ensure-admin] 角色 super_admin 已存在 (id=' + superRole.id + ')')
  }

  // 2. admin 用户：upsert + 强制刷新密码 + 启用
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const adminUser = await prisma.adminUser.upsert({
    where: { username: USERNAME },
    update: {
      password: passwordHash,
      status: 1,
    },
    create: {
      username: USERNAME,
      password: passwordHash,
      realName: '系统管理员',
      department: '信息部',
      status: 1,
    },
  })
  console.log('[ensure-admin] AdminUser upserted (id=' + adminUser.id + ')')

  // 3. 角色绑定（联合主键 [adminUserId, roleId]，所以用 upsert 等价于"有就跳过"）
  await prisma.adminUserRole.upsert({
    where: {
      adminUserId_roleId: { adminUserId: adminUser.id, roleId: superRole.id },
    },
    update: {},
    create: { adminUserId: adminUser.id, roleId: superRole.id },
  })
  console.log('[ensure-admin] 已绑定角色 super_admin → admin')

  // 4. 验证：从库里再读一次密码并 bcrypt.compare 一次，给运行人足够信心
  const verify = await prisma.adminUser.findUnique({
    where: { username: USERNAME },
    select: { password: true, status: true },
  })
  if (!verify) throw new Error('写入后查不到 admin 用户，奇怪')
  const pwdOk = await bcrypt.compare(PASSWORD, verify.password)
  if (!pwdOk) throw new Error('密码 bcrypt 校验失败 - 此环境的 bcrypt 实现异常')
  if (verify.status !== 1) throw new Error('账号状态不是 1（启用）')

  console.log('[ensure-admin] ✓ 校验通过')
  console.log('')
  console.log('  用户名：' + USERNAME)
  console.log('  密码  ：' + PASSWORD)
  console.log('  角色  ：super_admin (拥有所有权限)')
  console.log('')
  console.log('[ensure-admin] 完成')
}

main()
  .catch((e) => {
    console.error('[ensure-admin] 失败:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
