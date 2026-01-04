#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const root = path.resolve(__dirname, '..')
const projectRoot = path.resolve(root, '..')

const read = (p) => fs.readFileSync(p, 'utf8')

function extractKeys(filePath, marker) {
  const content = read(filePath)
  const start = content.indexOf(marker)
  if (start === -1) throw new Error(`marker not found: ${marker}`)

  const braceStart = content.indexOf('{', start)
  if (braceStart === -1) throw new Error(`no object after: ${marker}`)

  // slice object literal content (inside outer braces)
  let depth = 0
  let end = braceStart
  for (let i = braceStart; i < content.length; i++) {
    const ch = content[i]
    if (ch === '{') depth++
    else if (ch === '}') depth--
    if (depth === 0) { end = i; break }
  }
  const body = content.slice(braceStart + 1, end)

  const keys = []
  let level = 0
  for (const line of body.split(/\r?\n/)) {
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length
    // capture only at top level within this object body
    if (level === 0) {
      const m = line.match(/^\s*([A-Za-z0-9_]+):/)
      if (m && !line.includes('...')) keys.push(m[1])
    }
    level += opens - closes
  }
  return keys
}

const coreDefaultKeys = extractKeys(path.join(projectRoot, 'lib/DraggableCore.tsx'), 'draggableCoreDefaultProps')
const coreExtraKeys = extractKeys(path.join(projectRoot, 'lib/DraggableCore.tsx'), 'draggableCoreProps')
const draggableExtraKeys = extractKeys(path.join(projectRoot, 'lib/Draggable.tsx'), 'draggableProps')

const coreKeys = new Set([...coreDefaultKeys, ...coreExtraKeys])
const draggableKeys = new Set([...coreKeys, ...draggableExtraKeys])

let ok = true

function printSetDiff(label, expected, actual) {
  const missing = [...expected].filter((k) => !actual.has(k)).sort()
  const extra = [...actual].filter((k) => !expected.has(k)).sort()
  if (missing.length || extra.length) {
    console.error(`❌ ${label} 不一致`)
    if (missing.length) console.error(`   缺少: ${missing.join(', ')}`)
    if (extra.length) console.error(`   多余: ${extra.join(', ')}`)
    return false
  }
  return true
}

try {
  // 1) 描述映射必须覆盖全部 props（避免新增 props 漏写说明）
  const coreDescKeys = new Set(extractKeys(path.join(root, 'src/propDescriptions.ts'), 'DRAGGABLE_CORE_PROP_DESCRIPTIONS'))
  const draggableSpecificDescKeys = new Set(
    extractKeys(path.join(root, 'src/propDescriptions.ts'), 'DRAGGABLE_SPECIFIC_PROP_DESCRIPTIONS')
  )
  const eventCallbackDescKeys = new Set(extractKeys(path.join(root, 'src/propDescriptions.ts'), 'EVENT_CALLBACK_DESCRIPTIONS'))

  // Draggable：仅校验「专有 props」描述覆盖差集（避免要求重复列出所有继承 props）
  const draggableSpecificKeys = new Set([...draggableKeys].filter((k) => !coreKeys.has(k)))
  if (!printSetDiff('Draggable 专有 props 描述', draggableSpecificKeys, draggableSpecificDescKeys)) ok = false

  // DraggableCore：描述 + 事件回调描述 必须覆盖全部 coreKeys
  const documentedCoreKeys = new Set([...coreDescKeys, ...eventCallbackDescKeys])
  if (!printSetDiff('DraggableCore props 描述', coreKeys, documentedCoreKeys)) ok = false

  const expectedEventCallbacks = new Set(['startFn', 'dragFn', 'stopFn'])
  if (!printSetDiff('事件回调描述', expectedEventCallbacks, eventCallbackDescKeys)) ok = false

  // 2) 生成的 props 数据必须与源码一致
  const generatedPath = path.join(root, 'src/props.generated.ts')
  if (!fs.existsSync(generatedPath)) {
    console.error('❌ 未找到 src/props.generated.ts，请先运行 `yarn generate:props`')
    process.exit(1)
  }

  const generated = read(generatedPath)

  function extractGeneratedArray(exportName) {
    const marker = `export const ${exportName}`
    const start = generated.indexOf(marker)
    if (start === -1) throw new Error(`marker not found in props.generated.ts: ${marker}`)

    const assign = generated.indexOf('=', start)
    if (assign === -1) throw new Error(`assignment not found for: ${exportName}`)

    const arrayStart = generated.indexOf('[', assign)
    if (arrayStart === -1) throw new Error(`array start not found for: ${exportName}`)

    let depth = 0
    let inString = false
    let escaped = false
    let end = -1
    for (let i = arrayStart; i < generated.length; i++) {
      const ch = generated[i]
      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') inString = false
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '[') depth++
      else if (ch === ']') depth--
      if (depth === 0) {
        end = i
        break
      }
    }
    if (end === -1) throw new Error(`array end not found for: ${exportName}`)

    const jsonText = generated.slice(arrayStart, end + 1)
    return JSON.parse(jsonText)
  }

  const coreGenerated = extractGeneratedArray('DRAGGABLE_CORE_PROPS')
  const draggableGenerated = extractGeneratedArray('DRAGGABLE_PROPS')

  const coreGeneratedKeys = new Set(coreGenerated.map((p) => p.name))
  const draggableGeneratedKeys = new Set(draggableGenerated.map((p) => p.name))

  if (!printSetDiff('props.generated.ts DraggableCore', coreKeys, coreGeneratedKeys)) ok = false
  if (!printSetDiff('props.generated.ts Draggable', draggableKeys, draggableGeneratedKeys)) ok = false
} catch (error) {
  ok = false
  console.error('❌ 校验失败:', error)
}

if (!ok) process.exit(1)

console.log('✅ 数据一致')
