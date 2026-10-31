// 舞台：一条记忆 = 基础矩阵 + 完整逆序数索引 + 截断 + 阶段长度。
// 任意信息提取 = 在"索引顺序"上取一个区间（截断 + 阶段长度）。
import { rankOf, unrank } from './perm.js'
import { sanEntropy } from './san-entropy.js'
import { splitUnits, layoutMatrix } from './matrix-memory.js'

export function makeStage(key, text, { cols = 4 } = {}) {
  const units = splitUnits(text)
  if (!units.length) return null
  const matrix = layoutMatrix(units, cols)
  // 完整索引：由 key 派生一个排列（这条排列就是"叙述顺序"）
  let h = 2166136261
  for (let i = 0; i < String(key).length; i += 1) { h ^= String(key).charCodeAt(i); h = Math.imul(h, 16777619) >>> 0 }
  const order = Array.from({ length: units.length }, (_, i) => i)
  let state = h
  for (let i = units.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    const j = state % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return {
    key: String(key),
    matrix,
    units,
    narrative: { permutation: order, rank: rankOf(order) },
    stageLength: units.length,
    truncation: 0,
  }
}

// 任意提取：截断（起点）+ 阶段长度（取多少）
export function extract(stage, { truncation = 0, length = null } = {}) {
  const n = stage.units.length
  const start = Math.max(0, Math.min(n - 1, truncation))
  const span = Math.max(1, Math.min(n - start, length ?? stage.stageLength))
  const { permutation } = unrank(stage.narrative.rank, n)
  const picked = permutation.slice(start, start + span).map((index) => stage.units[index])
  return { text: picked.join(''), units: picked, start, span }
}

// 熵：字符分布的信息熵（bit）
// 统一用 SAN 指纹熵（SAD 分布的熵），与插件侧保持一致
export function entropyOf(text) {
  return sanEntropy(String(text), { window: 6 }).entropy
}

// 演化：找一条"比当前熵略低一点"的状态，差值就是推动力
export function evolve(stages, currentText, { tolerance = 0.4 } = {}) {
  const current = entropyOf(currentText)
  const candidates = []
  for (const stage of stages) {
    for (let start = 0; start < stage.units.length; start += 1) {
      for (const span of [Math.ceil(stage.stageLength / 2), stage.stageLength]) {
        const { text } = extract(stage, { truncation: start, length: span })
        if (text.length < 4) continue
        const entropy = entropyOf(text)
        candidates.push({ key: stage.key, entropy, text, delta: Number((current - entropy).toFixed(4)) })
      }
    }
  }
  // 取"略低"的那一档：delta 在 (0, tolerance] 里最接近 0 的
  const lower = candidates
    .filter((item) => item.delta > 0 && item.delta <= tolerance)
    .sort((a, b) => a.delta - b.delta)
  return {
    current,
    push: lower[0] ?? null,
    alternatives: lower.slice(1, 4),
    higher: candidates.filter((item) => item.delta < 0).sort((a, b) => b.delta - a.delta).slice(0, 2),
  }
}
