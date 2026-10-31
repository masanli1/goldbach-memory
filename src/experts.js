// 专家 = 一个固定矩阵（基础单元集合）+ 一个"滑块"（商的上限）。
// 矩阵之间求商；商的差异构成推动性：当前矩阵 → 下一个矩阵。
// 不同来源的矩阵可以拼接成新矩阵（跨模型使用）。
const normalize = (counts) => {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1
  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value / total]))
}

function unitDistribution(texts) {
  const counts = {}
  for (const text of texts) {
    for (const piece of String(text).split(/(?<=[。！？；，,:：;.!?])/)) {
      const unit = piece.trim()
      if (!unit) continue
      counts[unit] = (counts[unit] ?? 0) + 1
    }
  }
  return normalize(counts)
}

// 两个矩阵的商：按"共同的单位占比 / 各自规模"算，滑块决定上限
export function quotientOf(matrixA, matrixB, slider = 1) {
  const a = matrixA.distribution ?? unitDistribution(matrixA.texts ?? [])
  const b = matrixB.distribution ?? unitDistribution(matrixB.texts ?? [])
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let common = 0
  let onlyA = 0
  let onlyB = 0
  for (const key of keys) {
    const pa = a[key] ?? 0
    const pb = b[key] ?? 0
    common += Math.min(pa, pb)
    onlyA += Math.max(0, pa - pb)
    onlyB += Math.max(0, pb - pa)
  }
  // 商 = 差异 / 共享，滑块作为上限
  const raw = common > 0 ? (onlyA + onlyB) / common : Infinity
  const ceiling = Math.max(0.05, Number(slider) || 1)
  return {
    from: matrixA.name, to: matrixB.name,
    common: Number(common.toFixed(3)),
    onlyA: Number(onlyA.toFixed(3)),
    onlyB: Number(onlyB.toFixed(3)),
    raw: Number.isFinite(raw) ? Number(raw.toFixed(3)) : 'inf',
    quotient: Number(Math.min(ceiling, Number.isFinite(raw) ? raw : ceiling).toFixed(3)),
  }
}

export function createExpertSpace({ matrices = [], logger = console } = {}) {
  const experts = new Map()
  for (const matrix of matrices) register(matrix)

  function register(matrix) {
    const expert = {
      name: matrix.name,
      texts: matrix.texts ?? [],
      slider: Number(matrix.slider ?? 1),
      distribution: matrix.distribution ?? unitDistribution(matrix.texts ?? []),
    }
    experts.set(expert.name, expert)
    return expert
  }

  // 给当前矩阵挑下一个：商的差异最大者优先（受各自滑块上限约束）
  function route(fromName, { candidates = null } = {}) {
    const from = experts.get(fromName)
    if (!from) return []
    const pool = (candidates ?? [...experts.keys()]).filter((name) => name !== fromName && experts.has(name))
    const scored = pool.map((name) => {
      const target = experts.get(name)
      const q = quotientOf(from, target, Math.min(from.slider, target.slider))
      return { ...q, routeScore: Number((q.quotient * (target.slider ?? 1)).toFixed(3)) }
    })
    return scored.sort((a, b) => b.routeScore - a.routeScore)
  }

  // 拼接：两个矩阵合成新的（单元取并集，滑块取加权平均）
  function splice(nameA, nameB, newName) {
    const a = experts.get(nameA)
    const b = experts.get(nameB)
    if (!a || !b) throw new Error('矩阵不存在')
    const merged = { ...a.distribution }
    for (const [key, value] of Object.entries(b.distribution)) {
      merged[key] = (merged[key] ?? 0) + value
    }
    const total = Object.values(merged).reduce((sum, value) => sum + value, 0) || 1
    for (const key of Object.keys(merged)) merged[key] /= total
    const expert = {
      name: newName ?? `${nameA}+${nameB}`,
      texts: [...(a.texts ?? []), ...(b.texts ?? [])],
      slider: Number(((a.slider + b.slider) / 2).toFixed(3)),
      distribution: merged,
    }
    experts.set(expert.name, expert)
    return { name: expert.name, units: Object.keys(merged).length, slider: expert.slider }
  }

  const stats = () => ({
    experts: [...experts.values()].map((expert) => ({
      name: expert.name, units: Object.keys(expert.distribution).length, slider: expert.slider,
    })),
  })

  return { register, route, splice, stats, experts }
}
