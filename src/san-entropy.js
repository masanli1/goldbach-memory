// 用 SAN / KAN 指纹分布来度量熵：
//   路径 = 坐标序列（自然数）→ 首位插值 n+1 → 相邻绝对差 → SAD 和
//   统计不同 SAD 的出现次数 → SAN 分布 → 分布熵（bit）
// 这比"字频熵"更能反映顺序结构，所以用它作为统一的熵度量。

import { toCoordinates } from './path-fingerprint.js'

// 本模块的 SAD：直接作用在"坐标序列"上（首位插值 max+1，再求相邻绝对差之和）
export function sadSum(path) {
  if (!path || path.length < 2) return 0
  let max = -Infinity
  for (const value of path) if (value > max) max = value
  let sum = 0
  let previous = max + 1
  for (const value of path) { sum += Math.abs(value - previous); previous = value }
  return sum
}

export function sanDistribution(coordinates, { window = 8, stride = null } = {}) {
  const step = stride ?? window
  // 先收集 SAD，再分桶（不分桶熵会饱和成 log2(路径数)）
  const values = []
  for (let i = 0; i + window <= coordinates.length; i += step) {
    values.push(sadSum(coordinates.slice(i, i + window)))
  }
  const buckets = Math.min(32, Math.max(4, Math.ceil(Math.sqrt(values.length))))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const width = Math.max(1, (max - min) / buckets)
  const counts = new Map()
  for (const value of values) {
    const bin = Math.min(buckets - 1, Math.floor((value - min) / width))
    counts.set(bin, (counts.get(bin) ?? 0) + 1)
  }
  return { counts, paths: values.length, buckets, distinctSad: new Set(values).size }
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
  // 短文本自动缩窗，避免只有一条路径（熵恒 0）
  const span = coordinates.length >= 2 * window ? window : Math.max(2, Math.floor(coordinates.length / 2))
  window = span
  if (coordinates.length < window + 1) {
    // 太短就退化为单窗口，但返回结构保持一致
    return { entropy: 0, paths: 0, distinctSad: 0, window, short: true }
  }
  const { counts, paths, buckets, distinctSad } = sanDistribution(coordinates, { window })
  return { entropy: entropyOfDistribution(counts), paths, distinctSad, buckets, window }
}
