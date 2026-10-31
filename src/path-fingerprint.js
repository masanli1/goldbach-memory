// 拓扑指纹：把一段数值序列（文字/图像/声音的一维坐标）映射成"路径分布"特征。
//
// 做法与《项目结构》里的 SAD/SAN 一致：
//   1. 对序列下标做随机哈密顿路径采样（一个排列 = 一条路径）；
//   2. 每条路径上按顺序取相邻元素的 |差值| 求和，得到 SAD；
//   3. 统计 SAD 的分布（直方图，归一化），就是这条序列的拓扑指纹；
//   4. 同一体量下不同序列的指纹可以比较（余弦相似）。
//
// 附加：每条路径用一个素数标记；多条路径用素数积/素数和组合（融合/复合）。

const PRIMES = (() => {
  const out = []
  for (let n = 2; out.length < 1024; n += 1) {
    if (out.every((p) => n % p !== 0)) out.push(n)
  }
  return out
})()

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffledPath(n, random) {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export function sadOf(values, path) {
  let sum = 0
  for (let i = 1; i < path.length; i += 1) sum += Math.abs(values[path[i]] - values[path[i - 1]])
  return sum
}

// 采样 paths 条哈密顿路径，统计 SAD 分布（bins 个桶），归一化成概率向量
export function topologyFingerprint(values, { paths = 256, bins = 24, seed = 1 } = {}) {
  const n = values.length
  if (n < 3) return { vector: new Array(bins).fill(0), samples: [], primes: [] }
  const random = mulberry32(seed)
  const samples = []
  const primes = []
  for (let i = 0; i < paths; i += 1) {
    const path = shuffledPath(n, random)
    samples.push(sadOf(values, path))
    primes.push(PRIMES[Math.floor(random() * PRIMES.length)])
  }
  const min = Math.min(...samples)
  const max = Math.max(...samples)
  const span = Math.max(1e-9, max - min)
  const counts = new Array(bins).fill(0)
  for (const value of samples) {
    const index = Math.min(bins - 1, Math.floor(((value - min) / span) * bins))
    counts[index] += 1
  }
  const total = counts.reduce((sum, value) => sum + value, 0)
  const vector = counts.map((value) => value / total)
  return { vector, samples, primes, range: { min, max }, n, bins }
}

export function fingerprintSimilarity(a, b) {
  if (!a?.vector || !b?.vector) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.vector.length; i += 1) {
    dot += a.vector[i] * b.vector[i]
    na += a.vector[i] ** 2
    nb += b.vector[i] ** 2
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0
}

// 素数标记：一条路径的标记值 / 多条路径的乘积与和
export function pathPrimeTag(fingerprint, { mode = 'product', limit = 64 } = {}) {
  const primes = (fingerprint.primes ?? []).slice(0, limit)
  if (!primes.length) return 1n
  if (mode === 'sum') return primes.reduce((sum, p) => sum + BigInt(p), 0n)
  return primes.reduce((product, p) => product * BigInt(p), 1n)
}

// 序列 → 一维坐标（文本按字符码，图像可按像素亮度）
export function toCoordinates(input) {
  if (typeof input === 'string') return Array.from(input).map((char) => char.codePointAt(0))
  return Array.from(input)
}
