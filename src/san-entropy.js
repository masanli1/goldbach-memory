// SAN：对一组点采样哈密顿回路（每个点恰好走一次），每条回路算一个 SAD，
// 所有 SAD 构成分布（SAN），其熵即该点集的拓扑指纹熵。
// 注意：这是对"点集"穷举路径，不是把文本切窗口。

import { toCoordinates } from './path-fingerprint.js'

// 一条回路的 SAD：首位插值（最大坐标 + 1）后，相邻绝对差之和
export function sadSum(path) {
  if (!path || path.length < 2) return 0
  let max = -Infinity
  for (const value of path) if (value > max) max = value
  let sum = 0
  let previous = max + 1
  for (const value of path) { sum += Math.abs(value - previous); previous = value }
  return sum
}

function shuffleInPlace(list, random) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 核心：点集 → SAN 分布 → 统计量
export function sanOf(values, { samples = 800, seed = 1, bins = 12 } = {}) {
  const points = Array.isArray(values) ? values.slice() : toCoordinates(values)
  const n = points.length
  if (n < 4) return { n, samples: 0, entropy: 0, meanSad: 0, stdSad: 0, histogram: [] }

  const random = mulberry32(seed)
  const order = Array.from({ length: n }, (_, i) => i)
  const sads = []
  for (let i = 0; i < samples; i += 1) {
    shuffleInPlace(order, random)
    sads.push(sadSum(order.map((index) => points[index])))
  }
  const mean = sads.reduce((sum, value) => sum + value, 0) / sads.length
  const variance = sads.reduce((sum, value) => sum + (value - mean) ** 2, 0) / sads.length
  const std = Math.sqrt(variance)

  // 分桶（等宽）
  const min = Math.min(...sads)
  const max = Math.max(...sads)
  const width = Math.max(1e-9, (max - min) / bins)
  const counts = new Array(bins).fill(0)
  for (const value of sads) counts[Math.min(bins - 1, Math.floor((value - min) / width))] += 1
  const total = counts.reduce((sum, value) => sum + value, 0)
  let entropy = 0
  for (const count of counts) {
    if (!count) continue
    const p = count / total
    entropy -= p * Math.log2(p)
  }

  return {
    n, samples: sads.length, bins,
    entropy: Number(entropy.toFixed(3)),
    meanSad: Number(mean.toFixed(2)),
    stdSad: Number(std.toFixed(2)),
    histogram: counts,
  }
}

// 兼容旧调用：文本 → 码点坐标 → SAN
export function sanEntropy(input, options = {}) {
  const coordinates = Array.isArray(input) ? input : toCoordinates(input)
  return sanOf(coordinates, options)
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

export function sanDistribution(coordinates) {
  const result = sanOf(coordinates)
  return { counts: new Map(result.histogram.map((count, index) => [index, count])), paths: result.samples }
}
