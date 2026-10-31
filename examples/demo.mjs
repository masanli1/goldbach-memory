// 演示：把一段经历编码进排列记忆，再用哥德巴赫联想把它和别的事连起来。
import { createPermMemory, createGoldbachMemory } from '../src/index.js'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'gb-demo-'))
const memory = createPermMemory({ path: join(dir, 'perm.json'), order: 12 })
const association = createGoldbachMemory({ path: join(dir, 'gb.json') })

const events = [
  ['2026-10-30 降噪', '把 120 个视频的降噪跑完了'],
  ['2026-10-31 进化', '进化到传说形态'],
  ['2026-10-31 记忆', '矩阵扩到 17 阶'],
]

for (const [key, text] of events) {
  const entry = memory.remember(key, text)
  association.register(key, text)
  console.log(`写入 ${key} → 排名 ${entry.rank}，逆序 ${entry.inversion.slice(0, 6).join('')}…`)
}

console.log('\n容量：', memory.stats().capacity.toLocaleString(), '条，已用', memory.stats().used)

const linked = association.link('2026-10-30 降噪', '2026-10-31 记忆')
console.log(`\n关联「降噪」与「记忆」：素数 ${linked.primeA}+${linked.primeB}，桥 ${linked.bridge}，强度 ${linked.strength}`)
console.log('联想链：', association.chain('2026-10-30 降噪', 3).path.join(' → '))
