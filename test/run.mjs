// 最小测试：排列往返、容量、CRT 纠错、哥德巴赫关联、分区存储。
import { createPermMemory, unrank, rankOf, capacityOf, createCrtMemory, createGoldbachMemory, createPartitionedStore, sparseProfile, PackedIndex, MatrixStore, generateWorld, topologyFingerprint, fingerprintSimilarity, pathPrimeTag, positionOf, positionDistance, toCoordinates } from '../src/index.js'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let passed = 0
let failed = 0
const check = (name, condition) => {
  if (condition) { passed += 1; console.log(`  ✓ ${name}`) } else { failed += 1; console.log(`  ✗ ${name}`) }
}

const dir = mkdtempSync(join(tmpdir(), 'goldbach-memory-'))

console.log('排列记忆')
{
  const memory = createPermMemory({ path: join(dir, 'perm.json'), order: 12, logger: { warn() {} } })
  for (let i = 0; i < 1200; i += 1) memory.remember(`key${i}`, `value${i}`)
  check('写入 1200 条', memory.stats().used === 1200)
  check('分片落盘（>500 条切成多文档）', readdirSync(join(dir, 'perm.json.d')).length === 3)
  const reloaded = createPermMemory({ path: join(dir, 'perm.json'), logger: { warn() {} } })
  check('重新加载条数一致', reloaded.stats().used === 1200)
  check('召回正确', reloaded.recall('key777')?.text === 'value777')
  const big = Math.floor(capacityOf(17) * 0.91)
  check('17 阶 unrank→rankOf 往返', rankOf(unrank(big, 17).permutation) === big)
  check('17 阶容量 = 355,687,428,096,000', capacityOf(17) === 355687428096000)
}

console.log('CRT 编码')
{
  const crt = createCrtMemory()
  const value = 98765432n
  const residues = crt.encode(value)
  check('编解码往返', crt.decode(residues) === value)
  const broken = [...residues]
  broken[2] = (broken[2] + 1) % 7
  check('单错可纠正', crt.correct(broken).value === value.toString())
  const two = [...residues]
  two[1] = (two[1] + 2) % 5
  two[5] = (two[5] + 3) % 17
  check('双错可纠正', crt.correct(two).value === value.toString())
}

console.log('哥德巴赫联想')
{
  const association = createGoldbachMemory({ path: join(dir, 'gb.json'), logger: { warn() {} } })
  association.register('降噪完成', '把 120 个视频的降噪跑完了')
  association.register('视频处理', '批量给视频降噪')
  association.register('名字', '主人叫马三立')
  const linked = association.link('降噪完成', '视频处理')
  const unrelated = association.link('降噪完成', '名字')
  check('相关记忆强度 > 无关记忆', linked.strength > unrelated.strength)
  check('互素素数桥为 1', linked.bridge === 1)
  check('联想链长度 ≥ 2', association.chain('降噪完成', 4).path.length >= 2)
  check('按和分族返回结果', Array.isArray(association.families()))
}

console.log('紧凑矩阵索引')
{
  const packed = new PackedIndex()
  const cap = capacityOf(17)
  let seed = 42
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  for (let i = 0; i < 10000; i += 1) packed.push(Math.floor(rnd() * cap))
  check('写入 10000 条', packed.stats().count === 10000)
  check('每条 6 字节', packed.stats().bytesPerEntry === 6)
  check('按下标读回', packed.get(1234) !== null)
  check('按需展开成排列', packed.expand(7, 17).permutation.length === 17)
  check('可看成矩阵', packed.matrix(16).rows === 625)
  const round = PackedIndex.fromBase64(packed.toBase64())
  check('base64 往返一致', round.get(1234) === packed.get(1234) && round.count === 10000)
}

console.log('三层生成（混沌→时序→空间）')
{
  const world = generateWorld({ seed: 0.4, length: 512 })
  check('混沌层有确定熵值', world.chaosEntropy > 3 && world.chaosEntropy < 4.2)
  check('自适应参数落在混沌区', world.r >= 3.57 && world.r <= 4)
  check('时序层产生排列', world.points === 512)
  check('空间层地址基本唯一（>99%）', world.uniqueAddresses / world.points > 0.99)
  const a = generateWorld({ seed: 0.4, length: 128 })
  const b = generateWorld({ seed: 0.7, length: 128 })
  check('不同种子产生不同轨迹', JSON.stringify(a.sample) !== JSON.stringify(b.sample))
}

console.log('拓扑指纹')
{
  const a = topologyFingerprint(toCoordinates('把 120 个视频的降噪跑完了'), { paths: 64, bins: 16, seed: 1 })
  const b = topologyFingerprint(toCoordinates('把 120 个视频的降噪跑完了'), { paths: 64, bins: 16, seed: 1 })
  const c = topologyFingerprint(toCoordinates('今天天气不错适合出门散步'), { paths: 64, bins: 16, seed: 1 })
  check('同输入指纹一致', fingerprintSimilarity(a, b) === 1)
  check('不同输入指纹有差异', fingerprintSimilarity(a, c) < 1)
  check('相似度在 0..1', fingerprintSimilarity(a, c) >= 0 && fingerprintSimilarity(a, c) <= 1)
  check('素数标记可计算', typeof pathPrimeTag(a, { mode: 'sum' }) === 'bigint')
  const positions = ['降噪跑完了', '今天天气不错', '记忆矩阵扩容', '英语打卡三天'].map((text) =>
    positionOf(topologyFingerprint(toCoordinates(text), { paths: 64, bins: 16, seed: 1 }), { precision: 2 }))
  check('不同输入落到不同位置', new Set(positions).size === positions.length)
  const sameText = '降噪跑完了'
  const p1 = positionOf(topologyFingerprint(toCoordinates(sameText), { paths: 64, bins: 16, seed: 1 }), { precision: 2 })
  const p2 = positionOf(topologyFingerprint(toCoordinates(sameText), { paths: 64, bins: 16, seed: 1 }), { precision: 2 })
  check('同一输入位置稳定', p1 === p2)
}

console.log('矩阵压缩存储')
{
  const store = new MatrixStore({ base: join(dir, 'matrix'), order: 17 })
  const facts = Array.from({ length: 500 }, (_, i) => [`key${i}`, { text: `第 ${i} 条记忆：降噪跑完了`, n: i }])
  for (const [key, value] of facts) store.put(key, value)
  const stats = store.save()
  check('写入 500 条', stats.entries === 500)
  check('索引每条 6 字节', stats.indexBytes === 8 + 500 * 6)
  check('载荷被压缩', stats.compressionRatio > 3)
  const reloaded = new MatrixStore({ base: join(dir, 'matrix'), order: 17 })
  check('可从磁盘重载', reloaded.load() && reloaded.rows.length === 500)
  check('按需展开单条', reloaded.get('key77').n === 77)
  check('可按地址查排名', typeof reloaded.address('key77') === 'number')
  const jsonBytes = Buffer.byteLength(JSON.stringify(Object.fromEntries(facts)))
  check('总体积小于 JSON', stats.totalBytes < jsonBytes)
}

console.log('稀疏寻址')
{
  const N = 512
  const smooth = Array.from({ length: N }, (_, i) => Math.sin(2 * Math.PI * i / N) + 0.3 * Math.sin(6 * Math.PI * i / N))
  let seed = 7
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 * 2 - 1 }
  const noise = Array.from({ length: N }, rand)
  const smoothProfile = sparseProfile(smooth, 0.02)
  const noiseProfile = sparseProfile(noise, 0.02)
  check('平滑数据保留 < 10%', smoothProfile.ratio < 0.1)
  check('平滑数据还原误差 < 容差', smoothProfile.maxError <= 0.02 + 1e-9)
  check('随机数据必须几乎全存', noiseProfile.ratio > 0.9)
  check('随机数据的边界被正确暴露', noiseProfile.ratio > smoothProfile.ratio)
}

console.log('分区存储')
{
  const store = createPartitionedStore({ base: join(dir, 'store.json'), partSize: 3, name: 'items' })
  store.load()
  for (let i = 0; i < 8; i += 1) store.append({ i })
  check('8 条切成 3 片', store.stats().parts === 3)
  check('读回 8 条', store.all().length === 8)
}

console.log(`\n通过 ${passed}，失败 ${failed}`)
process.exit(failed === 0 ? 0 : 1)
