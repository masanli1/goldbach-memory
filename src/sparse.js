// 稀疏寻址：把"地址空间足够大"变成"只存需要存的点"。
// 做法：对一条有序序列做自适应关键点提取（Douglas–Peucker 的 1D/2D 版本），
// 只保留误差超过容差的点，其余由线性插值还原。
// 适用前提：数据有结构（平滑、低维流形）；随机噪声无法省。
export function adaptiveKeyframes(values, tolerance = 0.02) {
  const n = values.length
  if (n <= 2) return { indices: values.map((_, i) => i), maxError: 0, ratio: 1 }
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[n - 1] = 1
  const stack = [[0, n - 1]]
  let maxError = 0
  while (stack.length) {
    const [start, end] = stack.pop()
    if (end - start < 2) continue
    let worst = -1
    let worstIndex = -1
    for (let i = start + 1; i < end; i += 1) {
      const t = (i - start) / (end - start)
      const predicted = values[start] * (1 - t) + values[end] * t
      const error = Math.abs(values[i] - predicted)
      if (error > worst) { worst = error; worstIndex = i }
    }
    maxError = Math.max(maxError, worst)
    if (worst > tolerance) {
      keep[worstIndex] = 1
      stack.push([start, worstIndex], [worstIndex, end])
    }
  }
  const indices = []
  for (let i = 0; i < n; i += 1) if (keep[i]) indices.push(i)
  return { indices, maxError: Number(maxError.toFixed(6)), ratio: Number((indices.length / n).toFixed(4)) }
}

// 用关键点线性插值还原整条序列
export function restoreFromKeyframes(values, indices) {
  const out = new Array(values.length).fill(0)
  for (let k = 0; k < indices.length; k += 1) {
    const start = indices[k]
    const end = indices[k + 1] ?? start
    if (start === end) { out[start] = values[start]; continue }
    for (let i = start; i <= end; i += 1) {
      const t = (i - start) / (end - start)
      out[i] = values[start] * (1 - t) + values[end] * t
    }
  }
  return out
}

export function reconstructionError(original, restored) {
  let worst = 0
  let sum = 0
  for (let i = 0; i < original.length; i += 1) {
    const error = Math.abs(original[i] - restored[i])
    worst = Math.max(worst, error)
    sum += error * error
  }
  return { maxError: Number(worst.toFixed(6)), rmse: Number(Math.sqrt(sum / original.length).toFixed(6)) }
}

// 给一串记忆的"语义指纹"（例如 CRT 素描）排序后做稀疏化，估算可省多少
export function sparseProfile(series, tolerance = 0.02) {
  const { indices, ratio, maxError } = adaptiveKeyframes(series, tolerance)
  const restored = restoreFromKeyframes(series, indices)
  const error = reconstructionError(series, restored)
  return { points: series.length, kept: indices.length, ratio, tolerance, maxError, ...error }
}
