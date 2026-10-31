// 用 SAN / KAN 指纹分布来度量熵：
//   路径 = 坐标序列（自然数）→ 首位插值 n+1 → 相邻绝对差 → SAD 和
//   统计不同 SAD 的出现次数 → SAN 分布 → 分布熵（bit）
// 这比"字频熵"更能反映顺序结构，所以用它作为统一的熵度量。

export function toCoordinates(text) {
  // 默认把字符映射成码点（自然数坐标）；调用方可传入自己的坐标序列
  return Array.from(String(text ?? '')).map((ch) => ch.codePointAt(0) ?? 0)
}

export function sadOf(path) {
  if (!path || path.length < 2) return 0
  let max = -Infinity
  for (const value of path) if (value > max) max = value
  const padded = [max + 1, ...path]
  let sum = 0
  for (let i = 1; i < padded.length; i += 1) sum += Math.abs(padded[i] - padded[i - 1])
  return sum
}

export function sanDistribution(coordinates, { window = 8, stride = null } = {}) {
  const step = stride ?? window
  const counts = new Map()
  let paths = 0
  for (let i = 0; i + window <= coordinates.length; i += step) {
    const sad = sadOf(coordinates.slice(i, i + window))
    counts.set(sad, (counts.get(sad) ?? 0) + 1)
    paths += 1
  }
  return { counts, paths }
}

export function entropyOfDistribution(counts) {
  let total = 0
  for (const value of counts.values()) total += value
  if (!total) return 0
  let entropy = 0
  for (const value of counts.values()) {
    const p = value / total
    entropy -= p * Math.log2(p)
  }
  return Number(entropy.toFixed(4))
}

// 对外主入口：文本（或坐标序列）→ SAN 熵
export function sanEntropy(input, { window = 8 } = {}) {
  const coordinates = Array.isArray(input) ? input : toCoordinates(input)
  if (coordinates.length < window + 1) {
    // 太短就退化为单窗口
    return Number(entropyOfDistribution(new Map([[sadOf(coordinates), 1]])).toFixed(4))
  }
  const { counts, paths } = sanDistribution(coordinates, { window })
  return { entropy: entropyOfDistribution(counts), paths, distinctSad: counts.size, window }
}
