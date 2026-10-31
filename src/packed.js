// 紧凑索引：把大量"排名"直接塞进一块连续缓冲区（可以看成一个矩阵），
// 不保存每条的排列/逆序数，用到时才 unrank 展开。
// 17 阶排名 < 2^53，用 48 bit（6 字节）定宽存储。
import { unrank } from './perm.js'

const WIDTH = 6  // 48 bit

export class PackedIndex {
  constructor({ width = WIDTH, initial = 1024 } = {}) {
    this.width = width
    this.buffer = new Uint8Array(Math.max(1, initial) * width)
    this.count = 0
  }

  _ensure(extra = 1) {
    const need = (this.count + extra) * this.width
    if (need <= this.buffer.length) return
    let size = this.buffer.length || this.width
    while (size < need) size *= 2
    const next = new Uint8Array(size)
    next.set(this.buffer.subarray(0, this.count * this.width))
    this.buffer = next
  }

  push(rank) {
    this._ensure(1)
    const base = this.count * this.width
    let value = BigInt(Math.floor(rank))
    for (let i = this.width - 1; i >= 0; i -= 1) {
      this.buffer[base + i] = Number(value & 0xffn)
      value >>= 8n
    }
    this.count += 1
    return this.count - 1
  }

  get(index) {
    if (index < 0 || index >= this.count) return null
    const base = index * this.width
    let value = 0n
    for (let i = 0; i < this.width; i += 1) value = (value << 8n) | BigInt(this.buffer[base + i])
    return Number(value)
  }

  // 用到时才展开成排列/逆序数
  expand(index, order) {
    const rank = this.get(index)
    if (rank === null) return null
    return unrank(rank, order)
  }

  // 把索引看成 rows × cols 的矩阵（最后一行可能不满）
  matrix(cols = 16) {
    const rows = Math.ceil(this.count / cols)
    const grid = []
    for (let r = 0; r < rows; r += 1) {
      const row = []
      for (let c = 0; c < cols; c += 1) {
        const index = r * cols + c
        row.push(index < this.count ? this.get(index) : null)
      }
      grid.push(row)
    }
    return { cols, rows, grid }
  }

  toBase64() {
    return Buffer.from(this.buffer.subarray(0, this.count * this.width)).toString('base64')
  }

  static fromBase64(text, width = WIDTH) {
    const bytes = Buffer.from(text, 'base64')
    const index = new PackedIndex({ width, initial: Math.max(1, Math.ceil(bytes.length / width)) })
    index.buffer = new Uint8Array(bytes.length)
    index.buffer.set(bytes)
    index.count = Math.floor(bytes.length / width)
    return index
  }

  stats() {
    const bytes = this.count * this.width
    return {
      count: this.count,
      width: this.width,
      bytes,
      bytesPerEntry: this.width,
      base64Length: Math.ceil(bytes / 3) * 4,
      // 对比：JSON 数组形式（每个排名约 15 字符）
      jsonEquivalentBytes: this.count * 15,
    }
  }
}
