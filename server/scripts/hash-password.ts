/**
 * 生成 bcrypt 密码哈希
 * 用法： pnpm tsx scripts/hash-password.ts 你的密码
 */
import * as bcrypt from 'bcryptjs'

const raw = process.argv[2]
if (!raw) {
  console.error('用法: pnpm tsx scripts/hash-password.ts <密码>')
  process.exit(1)
}

const hash = bcrypt.hashSync(raw, 10)
console.log('原始密码:', raw)
console.log('bcrypt 哈希:', hash)
console.log('\n更新 SQL:')
console.log(
  `UPDATE admin_users SET password = '${hash}' WHERE username = 'admin123';`,
)
