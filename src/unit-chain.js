// 单位链：大模型的"基础单元有限"，输出是无限的——靠单位之间的转移生成。
// 这里把语料切成有限单位，统计单位间的转移概率，再走链生成。
export function buildUnitChain(texts, { maxUnits = 5000, order = 1 } = {}) {
  const units = []
  for (const text of texts) {
    const pieces = String(text).split(/(?<=[。！？；，,:：;.!?])/).map((part) => part.trim()).filter(Boolean)
    for (const piece of pieces) units.push(piece)
  }
  const vocabulary = [...new Set(units)].slice(0, maxUnits)
  const index = new Map(vocabulary.map((unit, i) => [unit, i]))
  const transitions = new Map()   // fromIndex -> Map(toIndex -> count)
  const starts = new Array(vocabulary.length).fill(0)
  const seq = units.map((u) => index.get(u)).filter((v) => v !== undefined)
  for (let i = 0; i < seq.length; i += 1) {
    if (i === 0 || /[。！？!?]$/.test(units[i - 1] ?? '')) starts[seq[i]] += 1
    if (i + 1 < seq.length) {
      // order=2 时用"上一个单位 + 当前单位"当状态
      const from = order >= 2 && i > 0 ? `${seq[i - 1]}>${seq[i]}` : String(seq[i])
      const to = seq[i + 1]
      const row = transitions.get(from) ?? new Map()
      row.set(to, (row.get(to) ?? 0) + 1)
      transitions.set(from, row)
    }
  }
  return { vocabulary, transitions, starts, unitCount: units.length, order }
}

function normalizeRow(row) {
  let total = 0
  for (const value of row.values()) total += value
  const out = []
  let acc = 0
  for (const [key, value] of row) {
    acc += value / total
    out.push({ key, p: acc })
  }
  return out
}

export function generateFromChain(chain, { steps = 12, seed = 1, restart = 0.15 } = {}) {
  const order = chain.order ?? 1
  let state = seed >>> 0
  const random = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0
    return state / 4294967296
  }
  const startTotal = chain.starts.reduce((sum, value) => sum + value, 0) || 1
  let current = -1
  let pick = random() * startTotal
  for (let i = 0; i < chain.starts.length; i += 1) { pick -= chain.starts[i]; if (pick <= 0) { current = i; break } }
  if (current < 0) current = Math.floor(random() * chain.vocabulary.length)

  const out = []
  for (let step = 0; step < steps; step += 1) {
    out.push(chain.vocabulary[current])
    const key = order >= 2 && out.length >= 1 ? `${chain.vocabulary.indexOf(out[out.length - 1])}>${current}` : String(current)
    const row = chain.transitions.get(key) ?? chain.transitions.get(String(current))
    if (!row || random() < restart) {
      // 重启：按起始分布重新取样
      let p = random() * startTotal
      for (let i = 0; i < chain.starts.length; i += 1) { p -= chain.starts[i]; if (p <= 0) { current = i; break } }
      continue
    }
    const cumulative = normalizeRow(row)
    const r = random()
    current = cumulative.find((item) => r <= item.p)?.key ?? cumulative[cumulative.length - 1].key
  }
  return out.join('')
}

export function chainStats(chain) {
  let edges = 0
  for (const row of chain.transitions.values()) edges += row.size
  return { units: chain.unitCount, vocabulary: chain.vocabulary.length, edges }
}
