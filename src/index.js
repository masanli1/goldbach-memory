// 双引擎：大容量排列记忆 + 哥德巴赫联想。两者可独立使用，也可组合。
export { createPermMemory, unrank, rankOf, inversionOf, shardOf, capacityOf, PERM_PATH } from './perm.js'
export { createGoldbachMemory, GOLDBACH_PATH } from './goldbach.js'
export { createCrtMemory, encodeResidues, decodeResidues, productOf, residueSketch, sketchDistance } from './crt.js'
export { writeJsonAtomic, readJsonSafe, createPartitionedStore } from './atomic.js'
export { adaptiveKeyframes, restoreFromKeyframes, reconstructionError, sparseProfile } from './sparse.js'
export { PackedIndex } from './packed.js'
export { MatrixStore } from './store.js'
export { topologyFingerprint, fingerprintSimilarity, pathPrimeTag, toCoordinates, sadOf, shuffledPath } from './path-fingerprint.js'
