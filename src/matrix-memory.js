// 矩阵记忆：一条记忆 = 一个矩阵（散点单位信息）+ 一个逆序数索引（叙述排序）。
// 矩阵里没有"组合信息"，只有单位信息；组合是读取时按索引顺序展开出来的。
import { rankOf, unrank } from './perm.js'

// 把文本切成"单位信息"（矩阵的散点）
export function splitUnits(text, maxUnits = 24) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  // 先按标点切成小段，太长再按长度切
  const pieces = clean.split(/(?<=[。！？；，,:：;.!?])/).map((part) => part.trim()).filter(Boolean)
  const units = []
  for (const piece of pieces) {
    if (piece.length <= 60) { units.push(piece); continue }
    for (let i = 0; i < piece.length; i += 60) units.push(piece.slice(i, i + 60))
  }
  return units.slice(0, maxUnits)
}

// 矩阵布局：把散点按 cols 列铺开（行优先）
export function layoutMatrix(units, cols = 4) {
  const rows = Math.ceil(units.length / cols) || 1
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(null))
  units.forEach((unit, index) => { grid[Math.floor(index / cols)][index % cols] = unit })
  return { rows, cols, grid }
}

// 由 key 派生一个"叙述排序"（排列），并用逆序数排名索引它
export function narrativeRank(key, n) {
  let h = 2166136261
  const text = String(key)
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  const permutation = Array.from({ length: n }, (_, i) => i)
  let state = h
  for (let i = n - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    const j = state % (i + 1)
    ;[permutation[i], permutation[j]] = [permutation[j], permutation[i]]
  }
  return { permutation, rank: rankOf(permutation) }
}

export class MatrixMemory {
  constructor({ cols = 4 } = {}) {
    this.cols = cols
    this.entries = new Map()   // key -> { units, grid, permutation, rank }
  }

  // 写入：矩阵（散点）+ 索引（排序）
  put(key, text) {
    const units = splitUnits(text)
    if (!units.length) return null
    const grid = layoutMatrix(units, this.cols)
    const { permutation, rank } = narrativeRank(key, units.length)
    const entry = { key: String(key), units, grid, permutation, rank }
    this.entries.set(String(key), entry)
    return entry
  }

  // 读取：按索引顺序展开矩阵里的散点，得到"叙述"
  read(key) {
    const entry = this.entries.get(String(key))
    if (!entry) return null
    const { permutation } = unrank(entry.rank, entry.units.length)
    return permutation.map((index) => entry.units[index]).join('')
  }

  // 用任意排序读（展示"同矩阵、不同叙述"）
  readWithOrder(key, order) {
    const entry = this.entries.get(String(key))
    if (!entry) return null
    return order.map((index) => entry.units[index] ?? '').join('')
  }

  // 索引 → 矩阵（把一条排名还原成散点布局）
  expand(rank, units) {
    const { permutation } = unrank(rank, units.length)
    const ordered = permutation.map((index) => units[index])
    return layoutMatrix(ordered, this.cols)
  }

  stats() {
    const rows = [...this.entries.values()].reduce((sum, entry) => sum + entry.grid.rows, 0)
    return { entries: this.entries.size, units: [...this.entries.values()].reduce((sum, e) => sum + e.units.length, 0), rows }
  }
}
