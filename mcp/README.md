# @marsio/vue-draggable-mcp

vue-draggable 的 MCP 服务器，让 AI IDE 能够精准使用 vue-draggable 组件。

> 数据来源：直接基于仓库 `lib/Draggable*.tsx` 的 props 定义，与列表拖拽库无关。

## 工具（精简版）

- `get_vue_draggable_docs`：返回完整文档（Markdown）
- `list_vue_draggable_props`：列出 props 结构化信息（JSON，包含类型/默认值/来源）
- `get_vue_draggable_type`：获取某个类型的定义（Text）

## 使用

### Cursor / Claude Desktop 配置

```json
{
  "mcpServers": {
    "vue-draggable": {
      "command": "npx",
      "args": ["@marsio/vue-draggable-mcp"]
    }
  }
}
```

### 本地开发

```bash
cd mcp
yarn install
yarn build
node dist/index.js
```

## 调试

```bash
# 列出工具
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# 列出 props（结构化）
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_vue_draggable_props","arguments":{"component":"Draggable","includeInherited":false}}}' | node dist/index.js

# 获取某个类型定义
echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_vue_draggable_type","arguments":{"name":"Axis"}}}' | node dist/index.js

# 获取完整文档
echo '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_vue_draggable_docs","arguments":{}}}' | node dist/index.js
```

调用时输出日志：
```
[时间戳] 🔧 Tool called: get_vue_draggable_docs
[时间戳] 📄 Returning docs (xxxx chars)
```

## 发布

```bash
yarn build && npm publish
```
