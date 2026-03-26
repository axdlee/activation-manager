import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

test('Prisma client generator 包含 Docker 运行所需的 OpenSSL 3 binaryTargets', () => {
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
  const schema = fs.readFileSync(schemaPath, 'utf8')

  assert.match(schema, /binaryTargets\s*=\s*\[[^\]]*"linux-arm64-openssl-3\.0\.x"/)
  assert.match(schema, /binaryTargets\s*=\s*\[[^\]]*"debian-openssl-3\.0\.x"/)
})
