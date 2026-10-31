# goldbach-memory

> 大容量排列记忆 + 哥德巴赫联想。两条独立的引擎，也可以组合使用。

- **排列记忆**：用逆序数（Lehmer 码）把记忆编码进排列，容量 = n!。
  10 阶 362 万、12 阶 4.79 亿、**17 阶 3.56 万亿**；配合 CRT 分片、AES 校验、多文档存储。
- **哥德巴赫联想**：把每条记忆映射成一个素数，用「素数周期叠加 + 素数和分解」计算两条记忆之间的桥、
  重合周期、关联强度与联想的节奏。

零依赖（只用 Node 内置模块），可单独引入，也可作为记忆层嵌进别的 Agent。

## 安装

```bash
npm install goldbach-memory
# 或直接复制 src/ 到你的项目
```

## 快速开始

```js
import { createPermMemory, createGoldbachMemory } from 'goldbach-memory'

const memory = createPermMemory({ order: 17 })
const association = createGoldbachMemory()

const entry = memory.remember('2026-10-30 降噪', '把 120 个视频的降噪跑完了')
console.log(entry.rank, entry.inversion)          // 排名 + 逆序数轨迹

memory.recall('2026-10-30 降噪')                   // → 取回记忆
memory.stats()                                     // 阶数 / 容量 / 碰撞界 / 已用

association.register('2026-10-30 降噪', '把 120 个视频的降噪跑完了')
association.register('2026-10-31 记忆', '矩阵扩到 17 阶')
association.link('2026-10-30 降噪', '2026-10-31 记忆')   // 桥 / 周期 / 强度
association.chain('2026-10-30 降噪', 4)                  // 联想链 + 节奏
```

## 容量对照

| 阶数 n | 容量 n! | 生日碰撞界 √(n!) |
|---|---|---|
| 10 | 3,628,800 | 1,905 |
| 12 | 479,001,600 | 21,886 |
| **17** | **355,687,428,096,000** | **18,859,677** |

## 设计要点

- **排列即地址**：`unrank(rank, n)` 把整数展开成逆序数向量与排列，`rankOf` 可逆；
- **分片寻址**：排列前两位 Lehmer 数字决定桶号（n(n−1) 个桶），按桶扫描；
- **多文档存储**：条目超过 500 自动切成 `part-XXXX.json`，只重写变化的分片；
- **原子写入**：临时文件 → fsync → rename，断电不会留下半个 JSON；
- **CRT 校验**：信息模数 + 冗余模数，可检出并纠正 1–2 位余数错误；
- **哥德巴赫联想**：以 `gcd/lcm/贝祖等式` 衡量周期叠加，以 `p₁+p₂` 的素数对数目衡量联想丰富度，
  再与语义相似度相乘得到关联强度。

## 局限（请诚实使用）

- 排列编码提供的是**地址空间**，不是信息压缩：n 阶排列只携带约 log₂(n!) 比特；
- 联想强度里语义是主导项，素数结构是调制项，别把“素数决定关联”当成定律；
- 哥德巴赫是**加法**猜想（偶数 = 两素数之和），不是乘积分解。

## 许可

**学术免费，商用收费**，详见 [LICENSE](./LICENSE)。

作者：**masanli1**
