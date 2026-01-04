#!/usr/bin/env node
/**
 * @marsio/vue-draggable MCP Server
 * 提供 vue-draggable 组件文档供 AI IDE 查询
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { DOCS } from './data.js'
import { DRAGGABLE_CORE_PROPS, DRAGGABLE_PROPS } from './props.generated.js'
import { VUE_DRAGGABLE_TYPE_DEFS } from './types.generated.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')) as { version?: string }
const serverVersion = pkg.version ?? '0.0.0'

function log(message: string, ...args: unknown[]) {
  console.error(`[${new Date().toISOString()}] ${message}`, ...args)
}

// 创建 MCP Server
const server = new McpServer({
  name: 'vue-draggable',
  version: serverVersion,
})

server.tool(
  'get_vue_draggable_docs',
  '获取 @marsio/vue-draggable 完整文档，包含组件 API、Props、Events 和代码示例',
  {},
  async () => {
    log('🔧 Tool called: get_vue_draggable_docs')
    try {
      log(`📄 Returning docs (${DOCS.length} chars)`)
      return {
        content: [
          {
            type: 'text',
            text: DOCS,
          },
        ],
      }
    } catch (error) {
      log('❌ Failed to serve docs', error)
      return {
        content: [
          {
            type: 'text',
            text: 'Failed to load docs. Please retry.',
          },
        ],
        isError: true,
      }
    }
  }
)

server.tool(
  'list_vue_draggable_props',
  '列出 Draggable / DraggableCore 的 props（结构化 JSON，包含类型与默认值）',
  {
    component: z
      .enum(['Draggable', 'DraggableCore'])
      .optional()
      .describe('不传则返回两个组件'),
    includeInherited: z
      .boolean()
      .optional()
      .describe('仅对 Draggable 生效：是否包含从 DraggableCore 继承的 props（默认 true）'),
  },
  async ({ component, includeInherited }) => {
    log(`🔧 Tool called: list_vue_draggable_props (${component ?? 'all'})`)

    const includeInheritedResolved = includeInherited ?? true
    const draggableProps = includeInheritedResolved
      ? DRAGGABLE_PROPS
      : DRAGGABLE_PROPS.filter((p) => !p.inheritedFrom)

    const payload =
      component === 'Draggable'
        ? { component: 'Draggable', props: draggableProps }
        : component === 'DraggableCore'
          ? { component: 'DraggableCore', props: DRAGGABLE_CORE_PROPS }
          : { Draggable: draggableProps, DraggableCore: DRAGGABLE_CORE_PROPS }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(payload, null, 2),
        },
      ],
    }
  }
)

server.tool(
  'get_vue_draggable_type',
  '获取某个 TypeScript 类型的定义（用于解释 props 的别名类型）',
  {
    name: z.string().min(1).describe('类型名，例如：Axis / DraggableBounds / DraggableData'),
  },
  async ({ name }) => {
    const typeName = name.trim()
    log(`🔧 Tool called: get_vue_draggable_type (${typeName})`)

    if (Object.prototype.hasOwnProperty.call(VUE_DRAGGABLE_TYPE_DEFS, typeName)) {
      const def = VUE_DRAGGABLE_TYPE_DEFS[typeName as keyof typeof VUE_DRAGGABLE_TYPE_DEFS]
      return {
        content: [
          {
            type: 'text',
            text: def,
          },
        ],
      }
    }

    const allNames = Object.keys(VUE_DRAGGABLE_TYPE_DEFS)
    const q = typeName.toLowerCase()
    const suggestions = allNames.filter((n) => n.toLowerCase().includes(q)).slice(0, 10)

    return {
      content: [
        {
          type: 'text',
          text:
            suggestions.length > 0
              ? `未找到类型：${typeName}\n\n可能想找：\n${suggestions.map((s) => `- ${s}`).join('\n')}`
              : `未找到类型：${typeName}`,
        },
      ],
      isError: true,
    }
  }
)

// 启动 STDIO 传输
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`vue-draggable MCP server started (v${serverVersion})`)
}

main().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
