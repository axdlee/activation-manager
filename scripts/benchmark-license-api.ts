/**
 * License API 性能基准测试
 *
 * 测试激活码系统核心 API 的响应时间与吞吐量。
 * 用法：
 *   npx tsx scripts/benchmark-license-api.ts
 *   BASE_URL=http://localhost:3000 npx tsx scripts/benchmark-license-api.ts
 */

import { randomBytes } from 'node:crypto'

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000'
const PROJECT_KEY = 'default'
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '5', 10)
const REQUESTS = parseInt(process.env.REQUESTS || '20', 10)

type BenchmarkResult = {
  name: string
  total: number
  success: number
  failed: number
  totalTimeMs: number
  avgMs: number
  minMs: number
  maxMs: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  throughput: number
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatThroughput(reqPerSec: number): string {
  return `${reqPerSec.toFixed(1)} req/s`
}

async function measureLatency(
  name: string,
  fn: () => Promise<boolean>,
  count: number,
  concurrency: number,
): Promise<BenchmarkResult> {
  const latencies: number[] = []

  const runBatch = async (batchSize: number): Promise<void> => {
    const batch = Array.from({ length: batchSize }, async () => {
      const start = performance.now()
      try {
        const success = await fn()
        latencies.push(performance.now() - start)
        if (!success) process.stdout.write('x')
        else process.stdout.write('.')
      } catch {
        latencies.push(performance.now() - start)
        process.stdout.write('E')
      }
    })
    await Promise.all(batch)
  }

  process.stdout.write(`\n  ${name}: `)
  const totalStart = performance.now()

  const batches = Math.ceil(count / concurrency)
  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(concurrency, count - i * concurrency)
    await runBatch(batchSize)
  }

  const totalTimeMs = performance.now() - totalStart
  process.stdout.write('\n')

  const sorted = [...latencies].sort((a, b) => a - b)
  const success = latencies.length
  const failed = 0

  return {
    name,
    total: success + failed,
    success,
    failed,
    totalTimeMs,
    avgMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    minMs: sorted[0] || 0,
    maxMs: sorted[sorted.length - 1] || 0,
    p50Ms: sorted[Math.floor(sorted.length * 0.5)] || 0,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)] || 0,
    p99Ms: sorted[Math.floor(sorted.length * 0.99)] || 0,
    throughput: (success + failed) / (totalTimeMs / 1000),
  }
}

function printResults(results: BenchmarkResult[]) {
  const header = (name: string, ...cols: string[]) =>
    `  ${name.padEnd(20)}${cols.map((c) => c.padStart(8)).join('')}`

  console.log('\n' + '='.repeat(90))
  console.log('  License API 性能基准测试结果')
  console.log('='.repeat(90))
  console.log(`  服务器: ${BASE_URL}`)
  console.log(`  并发数: ${CONCURRENCY}`)
  console.log(`  请求数: ${REQUESTS}`)
  console.log(`  机器ID: 随机（每次运行唯一）`)
  console.log('-'.repeat(90))
  console.log(header('接口', '请求', '成功', '总耗时', '平均', 'P50', 'P95', 'P99', '吞吐'))
  console.log('-'.repeat(90))

  for (const r of results) {
    console.log(
      header(
        r.name,
        String(r.total),
        String(r.success),
        formatDuration(r.totalTimeMs),
        formatDuration(r.avgMs),
        formatDuration(r.p50Ms),
        formatDuration(r.p95Ms),
        formatDuration(r.p99Ms),
        formatThroughput(r.throughput),
      ),
    )
  }
  console.log('-'.repeat(90))
}

async function main() {
  console.log(`\n  🚀 License API 性能基准测试`)
  // 每次运行使用唯一机器标识，避免命中「同一设备只能激活一个激活码」约束
  const machineId = `bench-${Date.now().toString(36)}`
  console.log(`  服务器: ${BASE_URL}`)
  console.log(`  并发数: ${CONCURRENCY}`)
  console.log(`  请求数: ${REQUESTS}`)
  console.log(`  机器ID: 随机（每次运行唯一）`)
  console.log()

  // 1. 准备：登录后台生成测试用激活码（供 status / consume 压测）
  console.log('  [准备] 登录后台生成测试用激活码...')
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || '123456'

  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: adminUsername, password: adminPassword }),
  })
  const loginData = await loginRes.json() as { success?: boolean }
  if (!loginData.success) {
    console.log('  ❌ 后台登录失败，请设置 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量')
    process.exit(1)
  }

  const setCookie = loginRes.headers.get('set-cookie') || ''
  const cookieMatch = setCookie.match(/auth-token=([^;]+)/)
  if (!cookieMatch) {
    console.log('  ❌ 登录响应缺少 auth-token cookie')
    process.exit(1)
  }
  const authCookie = `auth-token=${cookieMatch[1]}`

  // 生成激活码（amount=2：1 个用于 status/consume，1 个用于 activate 压测）
  const generateRes = await fetch(`${BASE_URL}/api/admin/codes/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: authCookie },
    body: JSON.stringify({
      projectKey: PROJECT_KEY,
      amount: 2,
      licenseMode: 'TIME',
      validDays: 30,
    }),
  })
  const generateData = await generateRes.json() as {
    success?: boolean
    codes?: Array<{ code: string }>
  }
  if (!generateData.success || !generateData.codes?.[0] || !generateData.codes[1]) {
    console.log('  ❌ 激活码生成失败，请先确保服务运行正常')
    process.exit(1)
  }
  const code = generateData.codes[0].code
  const activateBenchmarkCode = generateData.codes[1].code

  // 激活主码（绑定 benchmark-machine，供 status / consume 压测）
  const activateRes = await fetch(`${BASE_URL}/api/license/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectKey: PROJECT_KEY, code, machineId }),
  })
  const activateData = await activateRes.json() as { success?: boolean }
  if (!activateData.success) {
    console.log('  ❌ 激活码激活失败，请先确保服务运行正常')
    process.exit(1)
  }
  console.log(`  ✅ 测试激活码: ${code}`)
  console.log(`  ✅ activate 压测码: ${activateBenchmarkCode}`)

  // 2. 基准测试
  const results: BenchmarkResult[] = []

  results.push(await measureLatency(
    'status',
    async () => {
      const res = await fetch(`${BASE_URL}/api/license/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: PROJECT_KEY, code, machineId }),
      })
      return res.ok
    },
    REQUESTS,
    CONCURRENCY,
  ))

  results.push(await measureLatency(
    'activate（新码）',
    async () => {
      const res = await fetch(`${BASE_URL}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: PROJECT_KEY, code: activateBenchmarkCode, machineId }),
      })
      const data = await res.json() as { success?: boolean }
      return data.success === true
    },
    REQUESTS,
    CONCURRENCY,
  ))

  results.push(await measureLatency(
    'consume',
    async () => {
      const res = await fetch(`${BASE_URL}/api/license/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectKey: PROJECT_KEY,
          code,
          machineId,
          requestId: randomBytes(8).toString('hex'),
        }),
      })
      return res.ok
    },
    REQUESTS,
    CONCURRENCY,
  ))

  // 3. 打印结果
  printResults(results)

  // 4. 汇总
  console.log()
  const totalRequests = results.reduce((sum, r) => sum + r.total, 0)
  const totalTime = Math.max(...results.map((r) => r.totalTimeMs))
  const totalThroughput = totalRequests / (totalTime / 1000)
  console.log(`  总计: ${totalRequests} 请求 | 总耗时: ${formatDuration(totalTime)} | 总吞吐: ${formatThroughput(totalThroughput)}`)
  console.log()
}

main().catch((err) => {
  console.error('基准测试失败:', err)
  process.exit(1)
})