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

## 拓扑指纹（SAD 分布）

把序列下标当作哈密顿路径，随机采样若干条路径，统计路径上相邻差值之和（SAD）的分布：

```js
import { topologyFingerprint, fingerprintSimilarity, toCoordinates } from 'goldbach-memory'

const fp = topologyFingerprint(toCoordinates('一段文字'), { paths: 256, bins: 24 })
fingerprintSimilarity(fpA, fpB)   // 0..1
```

**诚实结论（实测）**：在本项目的 113 条中文短文上，SAD 分布指纹与语义相似度的
**秩相关只有 0.06**（排名化后 0.15）。也就是说它捕捉的是**尺度/统计量**，
不足以单独当语义特征。要让它有区分力，需要改成"局部路径 + 顺序敏感特征"，而不是均匀随机排列。

## 矩阵压缩存储：索引只留排名，载荷按需展开

`MatrixStore` 把"一堆键值记忆"压成两个文件：

```
<base>.idx   magic + count + count × rank(6 字节)
<base>.dat   brotli( 每行 [key, payload] )
```

实测：

| 记录数 | JSON 体积 | 矩阵存储 | 倍数 | 每条 |
|---|---|---|---|---|
| 500 | 51 KB | 5.2 KB | ~10× | 10 字节 |
| 2000 | 201 KB | 19.8 KB | **10.2×** | 10.2 字节 |

用法：

```js
import { MatrixStore } from 'goldbach-memory'

const store = new MatrixStore({ base: '~/.dsh/my-memory', order: 17 })
store.put('名字', { value: '马三立' })
store.address('名字')      // 只取排名，不展开
store.get('名字')          // 按需展开
store.save()               // 落盘（索引 + 压缩载荷）
store.load()               // 重新加载
```

> 真实数据实测：把 dsh-dafeiyu 的 17 条记忆（6.2 KB）压成 776 字节，**7.95 倍**；
> 条数越多倍数越高（固定 8 字节头会被摊薄）。

## 紧凑矩阵索引：不存逆序数，只存排名

一条记忆在旧格式里要存 `rank + permutation[17] + inversion[17] + shard + surges`，
JSON 化后约 **228 字节/条**。改成"把排名按 48 bit 定宽塞进一块连续缓冲区"（可看成一个矩阵）：

| 格式 | 10000 条 | 每条 |
|---|---|---|
| JSON（含排列/逆序数） | 2.17 MB | 228 字节 |
| **紧凑矩阵（仅排名）** | **58.6 KB** | **6 字节** |

**约 38 倍**，而且用时才展开：

```js
import { PackedIndex } from 'goldbach-memory'

const index = new PackedIndex()       // 48 bit/条
index.push(rank)                       // 只存排名
index.get(42)                          // 读排名
index.expand(42, 17)                   // 用到时才 unrank 成排列/逆序数
index.matrix(16)                       // 看成 6250 × 16 的矩阵
index.toBase64()                       // 可直接落盘/传输
```

> 注意：省下的是**索引部分**；键名与正文仍需另存（若正文很短，整体约 10 倍；纯索引则 38 倍）。

## 稀疏寻址：中间断掉的部分可以省略

地址空间足够细时，只需要保留"有意义的关键点"，其余用插值还原——前提是数据**有结构**。

实测（512 点序列，自适应关键点）：

| 容差 | 平滑信号保留比例 | 最大误差 | 随机信号保留比例 |
|---|---|---|---|
| 0.10 | **2.3%** | 0.066 | 91.6% |
| 0.05 | **3.1%** | 0.046 | 95.3% |
| 0.02 | **5.5%** | 0.017 | 98.2% |
| 0.01 | **7.0%** | 0.010 | 99.2% |

结论很清晰：
- **有结构的数据**（轨迹、曲线、embedding、激活、行为序列）→ 保留 2–7% 即可还原；
- **随机数据**（无结构权重）→ 必须几乎全存，省略不了。

```js
import { sparseProfile } from 'goldbach-memory'
sparseProfile(series, 0.02)   // → { ratio, maxError, rmse }
```

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

**学术免费，商用收费**：

- 学术 / 个人 / 非商业：免费，详见 [LICENSE](./LICENSE)
- 商业使用：按档位购买授权，价格见 [COMMERCIAL.md](./COMMERCIAL.md)
- **授权咨询：2459551532@qq.com**

作者：**masanli1**
