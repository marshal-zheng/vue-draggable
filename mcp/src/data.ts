/**
 * vue-draggable MCP 文档（部分内容为生成）
 *
 * ⚠️ Props 数据来源：
 * - lib/Draggable.tsx (draggableProps)
 * - lib/DraggableCore.tsx (draggableCoreProps)
 *
 * 文档中的 props 表格由 `src/props.generated.ts` 生成，避免手动同步类型/默认值。
 */

import type { VueDraggableProp } from './props.generated.js'
import { DRAGGABLE_CORE_PROPS, DRAGGABLE_PROPS } from './props.generated.js'

const EVENT_CALLBACK_NAMES = ['startFn', 'dragFn', 'stopFn'] as const
const EVENT_CALLBACK_SET = new Set<string>(EVENT_CALLBACK_NAMES)

const corePropsCount = DRAGGABLE_CORE_PROPS.length
const draggablePropsCount = DRAGGABLE_PROPS.length
const draggableSpecificProps = DRAGGABLE_PROPS.filter((p) => !p.inheritedFrom)
const draggableSpecificCount = draggableSpecificProps.length

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim()
}

function formatCodeCell(text: string | null | undefined): string {
  if (!text) return '-'
  return `\`${escapeTableCell(text)}\``
}

function formatDefault(prop: Pick<VueDraggableProp, 'default' | 'defaultIsFactory'>): string {
  if (!prop.default) return '-'

  let output = prop.default
  if (prop.defaultIsFactory) {
    const arrow = output.match(/=>\s*(.+)$/)
    if (arrow) output = arrow[1].trim()

    if (output.startsWith('(') && output.endsWith(')')) {
      const inner = output.slice(1, -1).trim()
      if (inner.startsWith('{') || inner.startsWith('[') || inner === 'null') output = inner
    }
  }

  return formatCodeCell(output)
}

function formatType(prop: Pick<VueDraggableProp, 'tsType' | 'vueRuntimeTypes'>): string {
  if (prop.tsType) return formatCodeCell(prop.tsType)
  if (prop.vueRuntimeTypes.length > 0) return formatCodeCell(prop.vueRuntimeTypes.join(' | '))
  return formatCodeCell('unknown')
}

function sortByPreferredOrder<T extends { name: string }>(items: T[], preferredOrder: string[]): T[] {
  const index = new Map<string, number>()
  preferredOrder.forEach((name, i) => index.set(name, i))

  return [...items].sort((a, b) => {
    const ai = index.has(a.name) ? index.get(a.name)! : Number.POSITIVE_INFINITY
    const bi = index.has(b.name) ? index.get(b.name)! : Number.POSITIVE_INFINITY
    if (ai !== bi) return ai - bi
    return a.name.localeCompare(b.name)
  })
}

function buildPropsTable(
  props: VueDraggableProp[],
  _ignoredDescriptionMap: Record<string, string>,
  preferredOrder: string[]
): string {
  const rows = sortByPreferredOrder(props, preferredOrder).map((p) => {
    const desc = p.description || ''
    return `| \`${p.name}\` | ${formatType(p)} | ${formatDefault(p)} | ${escapeTableCell(desc)} |`
  })

  return ['| Prop | 类型 | 默认值 | 说明 |', '|------|------|--------|------|', ...rows].join('\n')
}

function buildEventCallbackTable(preferredOrder: ReadonlyArray<string>): string {
  const rows = sortByPreferredOrder(
    DRAGGABLE_CORE_PROPS.filter((p) => EVENT_CALLBACK_SET.has(p.name)),
    [...preferredOrder]
  ).map((p) => {
    const desc = p.description || ''
    return `| \`${p.name}\` | ${formatType(p)} | ${escapeTableCell(desc)} |`
  })

  return ['| Prop | 类型 | 说明 |', '|------|------|------|', ...rows].join('\n')
}

const PREFERRED_DRAGGABLE_SPECIFIC_ORDER = [
  'axis',
  'bounds',
  'position',
  'defaultPosition',
  'positionOffset',
  'directionLock',
  'directionLockThreshold',
  'defaultClassName',
  'defaultClassNameDragging',
  'defaultClassNameDragged',
]

const PREFERRED_CORE_ORDER = [
  'disabled',
  'allowAnyClick',
  'handle',
  'cancel',
  'grid',
  'scale',
  'offsetParent',
  'nodeRef',
  'enableUserSelectHack',
  'allowMobileScroll',
  'autoScroll',
  'autoScrollThreshold',
  'autoScrollMaxSpeed',
  'autoScrollAxis',
  'autoScrollIncludeWindow',
  'autoScrollContainer',
  'cancelInteractiveElements',
  'enableClickSuppression',
  'clickSuppressionDuration',
  'dragStartThreshold',
  'dragStartDelay',
  'dragStartDelayTolerance',
  'useRafDrag',
]

const draggableSpecificPropsTable = buildPropsTable(
  draggableSpecificProps,
  {},
  PREFERRED_DRAGGABLE_SPECIFIC_ORDER
)

const draggableCorePropsTable = buildPropsTable(
  DRAGGABLE_CORE_PROPS.filter((p) => !EVENT_CALLBACK_SET.has(p.name)),
  {},
  PREFERRED_CORE_ORDER
)

const eventCallbacksTable = buildEventCallbackTable(EVENT_CALLBACK_NAMES)

export const DOCS = `# @marsio/vue-draggable

Vue 3 拖拽组件库，提供简单易用的拖拽功能。

## 安装

\`\`\`bash
npm install @marsio/vue-draggable
# 或
yarn add @marsio/vue-draggable
# 或
pnpm add @marsio/vue-draggable
\`\`\`

## 组件选择指南

| 组件 | 使用场景 |
|------|---------|
| \`Draggable\` | 大多数场景，自动管理位置状态，支持边界限制、网格吸附等 |
| \`DraggableCore\` | 需要完全控制位置时使用，只提供事件回调，不管理状态 |

**推荐**：优先使用 \`Draggable\`，只有需要完全控制位置计算时才用 \`DraggableCore\`。

---

## Draggable 组件（数量）

- Props：${draggablePropsCount} 个（继承 DraggableCore ${corePropsCount} 个 + 本组件 ${draggableSpecificCount} 个）
- Events：3 个（通过 props: startFn / dragFn / stopFn）
- Slots：1 个（默认插槽，包裹子节点）

继承 DraggableCore 的所有 props，并增加以下 props：

### Draggable 专有 Props

${draggableSpecificPropsTable}

---

## DraggableCore 组件（数量）

- Props：${corePropsCount} 个（下表列出）
- Events：3 个 emits（mousedown / mouseup / touchend）；回调通过 startFn / dragFn / stopFn
- Slots：1 个（默认插槽，包裹子节点）

低级组件，只提供拖拽事件，不管理位置状态。Draggable 继承了以下所有 props。

### DraggableCore Props

${draggableCorePropsTable}

### 事件回调（两个组件通用）

${eventCallbacksTable}

### DraggableData 对象

\`\`\`typescript
interface DraggableData {
  node: HTMLElement  // 被拖拽的元素
  x: number          // 当前 X 位置
  y: number          // 当前 Y 位置
  deltaX: number     // X 方向的增量
  deltaY: number     // Y 方向的增量
  lastX: number      // 上一次的 X 位置
  lastY: number      // 上一次的 Y 位置
}
\`\`\`

---

## 代码示例

### 基础拖拽

\`\`\`vue
<template>
  <Draggable>
    <div class="box">拖拽我</div>
  </Draggable>
</template>

<script setup>
import { Draggable } from '@marsio/vue-draggable'
</script>

<style>
.box {
  width: 100px;
  height: 100px;
  background: #3498db;
  cursor: move;
}
</style>
\`\`\`

### 限制方向

\`\`\`vue
<template>
  <!-- 只能水平拖动 -->
  <Draggable axis="x">
    <div class="box">水平拖动</div>
  </Draggable>
  
  <!-- 只能垂直拖动 -->
  <Draggable axis="y">
    <div class="box">垂直拖动</div>
  </Draggable>
</template>

<script setup>
import { Draggable } from '@marsio/vue-draggable'
</script>
\`\`\`

### 边界限制

\`\`\`vue
<template>
  <!-- 限制在父元素内 -->
  <div class="container">
    <Draggable bounds="parent">
      <div class="box">限制在父元素内</div>
    </Draggable>
  </div>
  
  <!-- 自定义边界 -->
  <Draggable :bounds="{ left: 0, top: 0, right: 200, bottom: 200 }">
    <div class="box">自定义边界</div>
  </Draggable>
</template>

<script setup>
import { Draggable } from '@marsio/vue-draggable'
</script>
\`\`\`

### 网格吸附

\`\`\`vue
<template>
  <Draggable :grid="[25, 25]">
    <div class="box">每次移动 25px</div>
  </Draggable>
</template>

<script setup>
import { Draggable } from '@marsio/vue-draggable'
</script>
\`\`\`

### 拖拽手柄

\`\`\`vue
<template>
  <Draggable handle=".handle">
    <div class="box">
      <div class="handle">拖这里</div>
      <div>内容区域（不可拖拽）</div>
    </div>
  </Draggable>
</template>

<script setup>
import { Draggable } from '@marsio/vue-draggable'
</script>
\`\`\`

### 受控模式

\`\`\`vue
<template>
  <Draggable :position="position" :dragFn="handleDrag">
    <div class="box">受控拖拽</div>
  </Draggable>
  <p>位置: x={{ position.x }}, y={{ position.y }}</p>
</template>

<script setup>
import { ref } from 'vue'
import { Draggable } from '@marsio/vue-draggable'

const position = ref({ x: 0, y: 0 })

const handleDrag = (e, data) => {
  position.value = { x: data.x, y: data.y }
}
</script>
\`\`\`

### 事件处理

\`\`\`vue
<template>
  <Draggable
    :startFn="onStart"
    :dragFn="onDrag"
    :stopFn="onStop"
  >
    <div class="box">拖拽我</div>
  </Draggable>
</template>

<script setup>
import { Draggable } from '@marsio/vue-draggable'

const onStart = (e, data) => {
  console.log('开始拖拽', data.x, data.y)
}

const onDrag = (e, data) => {
  console.log('拖拽中', data.x, data.y, 'delta:', data.deltaX, data.deltaY)
}

const onStop = (e, data) => {
  console.log('拖拽结束', data.x, data.y)
}
</script>
\`\`\`

### 使用 DraggableCore（完全控制）

\`\`\`vue
<template>
  <DraggableCore :dragFn="handleDrag" :stopFn="handleStop">
    <div class="box" :style="{ transform: \`translate(\${x}px, \${y}px)\` }">
      完全控制
    </div>
  </DraggableCore>
</template>

<script setup>
import { ref } from 'vue'
import { DraggableCore } from '@marsio/vue-draggable'

const x = ref(0)
const y = ref(0)

const handleDrag = (e, data) => {
  x.value += data.deltaX
  y.value += data.deltaY
}

const handleStop = () => {
  console.log('最终位置:', x.value, y.value)
}
</script>
\`\`\`

---

## 常见问题

### 拖拽时文字被选中？
默认已启用 \`enableUserSelectHack\`，如果仍有问题，添加 CSS：
\`\`\`css
.box { user-select: none; }
\`\`\`

### 在缩放容器内拖拽不准？
设置 \`scale\` prop 匹配容器的缩放比例：
\`\`\`vue
<Draggable :scale="0.5">...</Draggable>
\`\`\`

### 移动端触摸问题？
如果需要同时支持滚动和拖拽，设置 \`allowMobileScroll\`：
\`\`\`vue
<DraggableCore :allowMobileScroll="true">...</DraggableCore>
\`\`\`
`
