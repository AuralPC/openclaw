# OpenClaw 后端 API 完整列表

> 本文档整理了 OpenClaw 后端暴露的所有 API 接口，供独立开发新前端时参考。
> 涵盖 WebSocket RPC 方法、WebSocket 事件、HTTP 端点三大类。

---

## 目录

- [一、通信协议概览](#一通信协议概览)
- [二、连接与认证](#二连接与认证)
- [三、Chat 聊天 API（核心）](#三chat-聊天-api核心)
- [四、Agent 调用 API](#四agent-调用-api)
- [五、Agent 管理 API](#五agent-管理-api)
- [六、会话管理 API](#六会话管理-api)
- [七、WebSocket 事件（服务器推送）](#七websocket-事件服务器推送)
- [八、HTTP 端点](#八http-端点)
- [九、配置管理 API](#九配置管理-api)
- [十、状态与监控 API](#十状态与监控-api)
- [十一、用量与成本 API](#十一用量与成本-api)
- [十二、模型管理 API](#十二模型管理-api)
- [十三、技能管理 API](#十三技能管理-api)
- [十四、定时任务 API](#十四定时任务-api)
- [十五、执行审批 API](#十五执行审批-api)
- [十六、设备与节点配对 API](#十六设备与节点配对-api)
- [十七、节点操作 API](#十七节点操作-api)
- [十八、渠道与消息 API](#十八渠道与消息-api)
- [十九、TTS 语音合成 API](#十九tts-语音合成-api)
- [二十、其他 API](#二十其他-api)
- [附录：错误码与协议版本](#附录错误码与协议版本)

---

## 一、通信协议概览

OpenClaw 的前后端通信主要通过 **WebSocket** 进行，辅以少量 **HTTP 端点**。

### 1.1 WebSocket 帧格式

所有 WebSocket 消息都是 JSON 文本，通过 `type` 字段区分三种帧：

| 帧类型 | type 值 | 方向 | 说明 |
|--------|---------|------|------|
| 请求帧 | `"req"` | 客户端 → 服务器 | 调用一个 RPC 方法，携带唯一 `id` 用于匹配响应 |
| 响应帧 | `"res"` | 服务器 → 客户端 | 返回请求结果，`id` 与请求匹配，`ok` 表示是否成功 |
| 事件帧 | `"event"` | 服务器 → 客户端 | 服务端主动推送，携带事件名和序列号 |

**请求帧结构**：
- `type`：固定为 `"req"`
- `id`：UUID，用于追踪请求-响应对
- `method`：RPC 方法名（如 `"chat.send"`）
- `params`：方法参数（JSON 对象）

**响应帧结构**：
- `type`：固定为 `"res"`
- `id`：与请求的 id 匹配
- `ok`：布尔值，是否成功
- `payload`：成功时的返回数据
- `error`：失败时的错误信息（含 code、message、是否可重试等）

**事件帧结构**：
- `type`：固定为 `"event"`
- `event`：事件名称（如 `"chat"`、`"agent"`）
- `payload`：事件数据
- `seq`：序列号，用于检测消息是否遗漏

---

## 二、连接与认证

### 2.1 WebSocket 连接地址

`ws://主机:端口/` 或 `wss://主机:端口/`

### 2.2 连接握手流程

连接 WebSocket 后，客户端必须先完成握手才能调用其他 API：

1. （可选）客户端发送 `connect.challenge` 请求，服务器返回一个 nonce 随机数
2. 客户端发送 `connect` 请求，携带身份信息
3. 服务器返回 `hello-ok` 响应，包含可用方法列表、初始快照等

### 2.3 `connect`（握手请求）

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| minProtocol | number | 是 | 最低支持的协议版本（当前填 3） |
| maxProtocol | number | 是 | 最高支持的协议版本（当前填 3） |
| client.id | string | 是 | 客户端标识，如 `"my-custom-ui"` |
| client.displayName | string | 否 | 客户端显示名称 |
| client.version | string | 是 | 客户端版本号 |
| client.platform | string | 是 | 平台标识，如 `"browser"`、`"node"` |
| client.mode | string | 是 | 连接模式：`"webchat"`、`"ui"`、`"cli"`、`"backend"`、`"node"` |
| client.instanceId | string | 否 | 客户端实例唯一 ID |
| caps | string[] | 否 | 客户端支持的能力，如 `["tool-events"]` 表示要接收工具执行事件 |
| role | string | 否 | 角色：`"operator"`（操作员）或 `"node"`（节点） |
| scopes | string[] | 否 | 权限范围列表 |
| auth.token | string | 否 | 共享令牌认证 |
| auth.password | string | 否 | 密码认证 |
| device.id | string | 否 | 设备 ID（公钥的 SHA-256 指纹） |
| device.publicKey | string | 否 | Ed25519 公钥（Base64URL 编码） |
| device.signature | string | 否 | 签名（Base64URL 编码） |
| device.signedAt | number | 否 | 签名时间戳（毫秒） |
| device.nonce | string | 否 | 服务器提供的 nonce（v2 签名需要） |
| locale | string | 否 | 语言区域设置 |

**返回（hello-ok）**：

| 字段 | 说明 |
|------|------|
| protocol | 协商后的协议版本 |
| server.version | 服务器版本 |
| server.connId | 连接 ID |
| features.methods | 服务器支持的所有 RPC 方法名列表 |
| features.events | 服务器支持的所有事件名列表 |
| snapshot.presence | 当前在线的客户端列表 |
| snapshot.sessionDefaults | 默认的 Agent ID、主会话 Key 等 |
| auth.deviceToken | 服务器签发的设备令牌（下次连接可复用） |
| auth.role | 认证后的角色 |
| auth.scopes | 认证后的权限范围 |
| policy.maxPayload | 单条消息最大字节数 |
| canvasHostUrl | Canvas UI 地址（如有） |

### 2.4 认证方式

OpenClaw 支持多种认证方式，可组合使用：

| 方式 | 说明 |
|------|------|
| 共享令牌 | 在 `auth.token` 中传入预配置的令牌 |
| 密码 | 在 `auth.password` 中传入密码 |
| 设备签名 | 用 Ed25519 私钥签名，服务器用公钥验证 |
| 设备令牌 | 首次认证后服务器签发的令牌，后续连接直接使用 |
| IP 白名单 | 本地连接可能直接放行 |

### 2.5 权限范围（Scopes）

| 范围 | 说明 |
|------|------|
| operator.admin | 完整的管理权限（配置、节点管理等） |
| operator.read | 只读权限（查看状态、日志） |
| operator.write | 读写权限（发消息、调用 Agent） |
| operator.approvals | 审批权限（管理执行审批） |
| operator.pairing | 配对权限（设备/节点配对） |

---

## 三、Chat 聊天 API（核心）

> 这是开发聊天前端最核心的 API 组。

### 3.1 `chat.send` — 发送聊天消息

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionKey | string | 是 | 会话标识 |
| message | string | 是 | 消息文本 |
| attachments | array | 否 | 附件列表，每项含 type、mimeType、fileName、content（Base64） |
| thinking | string | 否 | 思考模式覆盖 |
| deliver | boolean | 否 | 是否将回复投递到渠道 |
| timeoutMs | number | 否 | 超时时间（毫秒） |
| idempotencyKey | string | 是 | 幂等键（UUID），防止重复发送 |

**返回**：

| 字段 | 说明 |
|------|------|
| runId | 本次运行的唯一 ID，用于追踪流式回复和中止 |
| status | 状态：`"started"`、`"in_flight"`、`"ok"`、`"error"` |
| summary | 摘要信息（可选） |

**说明**：发送后，AI 的回复通过 `chat` 事件流式推送，不在此响应中返回。

### 3.2 `chat.history` — 获取聊天历史

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionKey | string | 是 | 会话标识 |
| limit | number | 否 | 返回消息条数上限，默认 200，最大 1000 |

**返回**：

| 字段 | 说明 |
|------|------|
| sessionKey | 会话标识 |
| sessionId | 会话 ID |
| messages | 消息数组，每条含 role、content、timestamp 等 |
| thinkingLevel | 当前思考级别设置 |
| verboseLevel | 当前详细度设置 |

### 3.3 `chat.abort` — 中止回复

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionKey | string | 是 | 会话标识 |
| runId | string | 否 | 指定中止某次运行；省略则中止该会话所有运行 |

**返回**：

| 字段 | 说明 |
|------|------|
| ok | 是否成功 |
| aborted | 是否确实中止了运行中的任务 |
| runIds | 被中止的 runId 列表 |

### 3.4 `chat.inject` — 注入系统消息

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sessionKey | string | 是 | 会话标识 |
| message | string | 是 | 要注入的消息内容 |
| label | string | 否 | 标签（最长 100 字符） |

**返回**：

| 字段 | 说明 |
|------|------|
| ok | 是否成功 |
| messageId | 注入的消息 ID |

**说明**：向对话历史中插入一条消息，不触发 AI 回复。适合注入系统提示或上下文。

---

## 四、Agent 调用 API

### 4.1 `agent` — 调用 Agent

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| message | string | 是 | 发送给 Agent 的消息 |
| agentId | string | 否 | 指定 Agent ID |
| sessionKey | string | 否 | 会话标识 |
| sessionId | string | 否 | 会话 ID |
| to | string | 否 | 目标地址 |
| replyTo | string | 否 | 回复地址 |
| thinking | string | 否 | 思考模式 |
| deliver | boolean | 否 | 是否投递到渠道 |
| attachments | array | 否 | 附件列表 |
| channel | string | 否 | 渠道名称（如 telegram、whatsapp） |
| replyChannel | string | 否 | 回复渠道 |
| accountId | string | 否 | 渠道账号 ID |
| threadId | string | 否 | 线程 ID |
| groupId | string | 否 | 群组 ID |
| timeout | number | 否 | 超时秒数 |
| lane | string | 否 | 执行通道 |
| extraSystemPrompt | string | 否 | 额外的系统提示词 |
| idempotencyKey | string | 是 | 幂等键 |
| label | string | 否 | 标签 |

**返回**：含 runId 和状态。

### 4.2 `agent.wait` — 等待 Agent 执行完成

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| runId | string | 是 | 要等待的运行 ID |
| timeoutMs | number | 否 | 等待超时 |

### 4.3 `agent.identity.get` — 获取 Agent 身份信息

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agentId | string | 否 | Agent ID |
| sessionKey | string | 否 | 或通过 sessionKey 推断 |

**返回**：

| 字段 | 说明 |
|------|------|
| agentId | Agent ID |
| name | Agent 名称 |
| avatar | 头像 URL |
| emoji | Agent 表情符号 |

---

## 五、Agent 管理 API

### 5.1 `agents.list` — 列出所有 Agent

**参数**：无

**返回**：Agent 数组，每项含 id、name、emoji、avatar 等。

### 5.2 `agents.create` — 创建 Agent

**参数**：含 id、name、emoji、avatar、systemPrompt 等字段。

### 5.3 `agents.update` — 更新 Agent

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | Agent ID |
| patch | object | 是 | 要更新的字段 |

### 5.4 `agents.delete` — 删除 Agent

**参数**：含 id。

### 5.5 `agents.files.list` — 列出 Agent 文件

**参数**：含 agentId。

**返回**：文件列表。

### 5.6 `agents.files.get` — 获取 Agent 文件内容

**参数**：含 agentId、fileName。

### 5.7 `agents.files.set` — 写入 Agent 文件

**参数**：含 agentId、fileName、content。

---

## 六、会话管理 API

### 6.1 `sessions.list` — 列出会话

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agentId | string | 否 | 按 Agent 过滤 |
| activeMinutes | number | 否 | 只返回最近 N 分钟内活跃的 |
| includeEmpty | boolean | 否 | 是否包含空会话 |
| limit | number | 否 | 返回数量限制 |

### 6.2 `sessions.preview` — 批量预览会话

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keys | string[] | 是 | 会话 Key 列表（最多 64 个） |
| limit | number | 否 | 每个会话预览的消息数（默认 12） |
| maxChars | number | 否 | 每条消息的最大字符数（默认 240） |

### 6.3 `sessions.resolve` — 解析会话

**参数**：含 agentId、key、scope。

**说明**：根据参数解析出完整的会话信息。

### 6.4 `sessions.patch` — 修改会话设置

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 会话 Key |
| patch.label | string | 否 | 会话标签 |
| patch.model | string | 否 | 使用的模型 |
| patch.thinkingLevel | string | 否 | 思考级别 |
| patch.verboseLevel | string | 否 | 详细度 |
| patch.contextTokens | number | 否 | 上下文令牌数 |

### 6.5 `sessions.reset` — 重置会话

**参数**：含 key。

**说明**：清空会话的消息历史。

### 6.6 `sessions.delete` — 删除会话

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 会话 Key |
| deleteTranscript | boolean | 否 | 是否删除对话记录（默认 true） |

### 6.7 `sessions.compact` — 压缩会话上下文

**参数**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 会话 Key |
| maxLines | number | 否 | 最大行数（默认 400） |

### 6.8 `sessions.usage` — 查询会话用量

**参数**：含 startDate、endDate、days、agentId。

### 6.9 `sessions.usage.timeseries` — 会话用量时间序列

**参数**：含 key。

### 6.10 `sessions.usage.logs` — 会话用量日志

**参数**：含 key、limit（最大 500）。

---

## 七、WebSocket 事件（服务器推送）

> 这些事件由服务器主动推送给客户端，不需要客户端请求。

### 7.1 `chat` — 聊天回复事件（最核心）

**推送时机**：AI 生成回复时持续推送。

**payload 字段**：

| 字段 | 说明 |
|------|------|
| runId | 对应 `chat.send` 返回的 runId |
| sessionKey | 会话标识 |
| seq | 序列号 |
| state | 状态：`"delta"`（增量文本）、`"final"`（完成）、`"aborted"`（已中止）、`"error"`（错误） |
| message | 消息内容（delta 时为增量文本片段，final 时为完整消息） |
| errorMessage | 错误时的消息 |
| usage | token 用量信息 |
| stopReason | 停止原因 |

**典型流程**：
1. 收到多个 `state: "delta"` 事件，逐步拼接文本
2. 最后收到一个 `state: "final"` 事件，标志回复完成

### 7.2 `agent` — Agent 工具执行事件

**推送时机**：Agent 执行工具调用时推送。

**前提**：连接时 `caps` 中需包含 `"tool-events"`。

**payload 字段**：

| 字段 | 说明 |
|------|------|
| runId | 运行 ID |
| seq | 序列号 |
| stream | 流类型：`"tool"`、`"stdout"`、`"stderr"`、`"thinking"` 等 |
| ts | 时间戳 |
| data | 工具执行数据（含工具名、参数、阶段、结果等） |

**工具执行阶段**（data 中体现）：
- `start`：工具开始执行，附带工具名称和参数
- `update`：工具产出中间结果
- `result`：工具执行完毕，附带最终结果

### 7.3 `presence` — 在线状态事件

**推送时机**：有客户端上线/下线/状态变更时推送。

**payload 字段**：含 presence 数组，每项包括主机、IP、版本、平台、设备类型、模式、最后输入时间等。

### 7.4 `tick` — 心跳事件

**推送时机**：服务器定期推送（间隔由 `policy.tickIntervalMs` 定义）。

**payload**：含 ts（时间戳）。

### 7.5 `shutdown` — 服务器关闭事件

**payload 字段**：

| 字段 | 说明 |
|------|------|
| reason | 关闭原因 |
| restartExpectedMs | 预计重启毫秒数（如有） |

### 7.6 `health` — 健康状态变更事件

**推送时机**：服务健康状态发生变化时推送。

### 7.7 `heartbeat` — 心跳事件

**推送时机**：定期心跳。

### 7.8 `connect.challenge` — 认证挑战事件

**payload**：含 nonce（随机数），用于 v2 签名认证。

### 7.9 `talk.mode` — 对话模式变更事件

**推送时机**：对话模式切换时推送。

### 7.10 `cron` — 定时任务执行事件

**推送时机**：定时任务触发或完成时推送。

### 7.11 `exec.approval.requested` — 执行审批请求事件

**payload 字段**：含 id、command、args、sessionKey、expiresAtMs 等。

**说明**：当 Agent 要执行一个需要人工审批的操作时推送。

### 7.12 `exec.approval.resolved` — 执行审批结果事件

**payload 字段**：含 id、approved（是否批准）、reason。

### 7.13 `device.pair.requested` — 设备配对请求事件

### 7.14 `device.pair.resolved` — 设备配对结果事件

### 7.15 `node.pair.requested` — 节点配对请求事件

### 7.16 `node.pair.resolved` — 节点配对结果事件

### 7.17 `node.invoke.request` — 节点调用请求事件

### 7.18 `voicewake.changed` — 语音唤醒配置变更事件

---

## 八、HTTP 端点

> 除 WebSocket 外，OpenClaw 还暴露了一些 HTTP 端点，适合不需要持久连接的场景。

### 8.1 OpenAI 兼容接口

**端点**：`POST /v1/chat/completions`

**认证**：`Authorization: Bearer <token>`

**请求体**：

| 字段 | 类型 | 说明 |
|------|------|------|
| model | string | 模型名称（可选） |
| stream | boolean | 是否流式返回 |
| messages | array | 消息数组，每条含 role 和 content |
| user | string | 用户标识（可选） |

messages 中的 role 支持：`"system"`、`"user"`、`"assistant"`、`"developer"`、`"tool"`、`"function"`

**流式响应**：SSE（Server-Sent Events）格式，每行 `data: {...}`，最后一行 `data: [DONE]`。

**说明**：这个端点兼容 OpenAI API 格式，意味着任何支持 OpenAI 的客户端库（如 Python 的 openai 包）都能直接对接。

### 8.2 OpenResponses 兼容接口

**端点**：`POST /v1/responses`

**认证**：`Authorization: Bearer <token>`

**请求体**：

| 字段 | 类型 | 说明 |
|------|------|------|
| model | string | 模型名称（可选） |
| stream | boolean | 是否流式返回 |
| input | array | 输入消息数组 |
| tools | array | 工具定义（可选） |
| response_format | object | 响应格式（可选，支持 JSON Schema） |
| max_tokens | number | 最大令牌数 |
| temperature | number | 温度参数 |

**说明**：兼容 OpenResponses 规范，支持结构化输出。

### 8.3 工具调用接口

**端点**：`POST /tools/invoke`

**请求体**：

| 字段 | 类型 | 说明 |
|------|------|------|
| tool | string | 工具名称 |
| action | string | 操作名称（可选） |
| args | object | 工具参数 |
| sessionKey | string | 会话标识（可选） |
| dryRun | boolean | 是否只模拟不执行 |

**返回**：含 ok、result、error。

### 8.4 Webhook 钩子端点

**基础路径**：可配置，默认 `/hooks`

**认证**：`Authorization: Bearer <token>` 或 `X-OpenClaw-Token` 头

#### `POST /hooks/wake` — 唤醒

| 字段 | 类型 | 说明 |
|------|------|------|
| text | string | 唤醒文本 |
| mode | string | `"now"` 或 `"next-heartbeat"` |

#### `POST /hooks/agent` — 调用 Agent

| 字段 | 类型 | 说明 |
|------|------|------|
| message | string | 消息内容 |
| name | string | 发送者名称（可选） |
| sessionKey | string | 会话标识（可选） |
| deliver | boolean | 是否投递回复（可选） |
| channel | string | 渠道（可选） |
| to | string | 接收人（可选） |
| model | string | 模型（可选） |
| thinking | string | 思考模式（可选） |
| timeoutSeconds | number | 超时秒数（可选） |

#### `POST /hooks/{自定义路径}` — 自定义钩子

可在配置中定义自定义路径映射，将外部 webhook 转化为 wake 或 agent 调用。

### 8.5 静态资源与头像

| 端点 | 说明 |
|------|------|
| `GET /` | 控制台 UI 页面 |
| `GET /assets/*` | 静态资源文件 |
| `GET /avatar/{agentId}` | Agent 头像图片 |

### 8.6 Slack 集成端点

| 端点 | 说明 |
|------|------|
| `POST /slack/events` | Slack 事件订阅 |
| `POST /slack/interactions` | Slack 交互组件回调 |
| `POST /slack/commands` | Slack 斜杠命令 |

### 8.7 Canvas 端点

| 端点 | 说明 |
|------|------|
| `GET /a2ui/` | Canvas UI 页面 |
| `GET /canvas-host/*` | Canvas 宿主资源 |
| `WS /canvas-ws` | Canvas WebSocket |

---

## 九、配置管理 API

| 方法 | 说明 |
|------|------|
| `config.get` | 获取当前配置（JSON） |
| `config.set` | 覆盖整个配置，参数含 raw（JSON 字符串）和 baseHash（乐观锁哈希） |
| `config.patch` | 局部更新配置，参数含 patch（JSON patch 对象）和 baseHash |
| `config.apply` | 应用配置变更，可选择是否重启服务 |
| `config.schema` | 获取配置的 JSON Schema，用于前端生成配置表单 |

---

## 十、状态与监控 API

| 方法 | 说明 |
|------|------|
| `health` | 获取服务健康状态 |
| `status` | 获取系统状态摘要 |
| `system-presence` | 获取当前所有在线客户端列表 |
| `last-heartbeat` | 获取最后一次心跳时间 |
| `set-heartbeats` | 设置心跳参数 |
| `logs.tail` | 读取服务日志尾部，参数含 cursor（字节偏移）、limit（最多 5000 行）、maxBytes（最多 1MB） |

---

## 十一、用量与成本 API

| 方法 | 参数 | 说明 |
|------|------|------|
| `usage.status` | 无 | 获取用量摘要 |
| `usage.cost` | startDate、endDate、days | 查询指定时间范围的费用 |

---

## 十二、模型管理 API

| 方法 | 说明 |
|------|------|
| `models.list` | 列出所有可用模型，返回含 provider 和 model 名称 |

---

## 十三、技能管理 API

| 方法 | 参数 | 说明 |
|------|------|------|
| `skills.status` | agentId（可选） | 获取技能状态 |
| `skills.bins` | 无 | 获取技能二进制元数据 |
| `skills.install` | skillKey | 安装技能 |
| `skills.update` | skillKey、enabled、apiKey | 更新技能配置 |

---

## 十四、定时任务 API

| 方法 | 参数 | 说明 |
|------|------|------|
| `cron.list` | 无 | 列出所有定时任务 |
| `cron.status` | 无 | 获取定时任务服务状态 |
| `cron.add` | schedule、command、enabled 等 | 添加定时任务 |
| `cron.update` | id、patch | 更新定时任务 |
| `cron.remove` | id | 删除定时任务 |
| `cron.run` | id、mode（`"force"` 或 `"normal"`） | 手动触发定时任务 |
| `cron.runs` | id、limit | 查看定时任务的运行历史 |

---

## 十五、执行审批 API

| 方法 | 参数 | 说明 |
|------|------|------|
| `exec.approvals.get` | 无 | 获取审批配置 |
| `exec.approvals.set` | 审批规则 | 设置审批规则 |
| `exec.approvals.node.get` | nodeId | 获取某节点的审批配置 |
| `exec.approvals.node.set` | nodeId、approvals | 设置某节点的审批规则 |
| `exec.approval.request` | command、args、sessionKey | 提交审批请求 |
| `exec.approval.resolve` | id、approved、reason | 处理审批（批准或拒绝） |

---

## 十六、设备与节点配对 API

### 设备配对

| 方法 | 说明 |
|------|------|
| `device.pair.list` | 列出设备配对请求 |
| `device.pair.approve` | 批准配对，参数含 requestId |
| `device.pair.reject` | 拒绝配对，参数含 requestId |
| `device.token.rotate` | 轮换设备令牌 |
| `device.token.revoke` | 吊销设备令牌，参数含 deviceId、role |

### 节点配对

| 方法 | 说明 |
|------|------|
| `node.pair.request` | 发起节点配对请求 |
| `node.pair.list` | 列出节点配对请求 |
| `node.pair.approve` | 批准配对 |
| `node.pair.reject` | 拒绝配对 |
| `node.pair.verify` | 验证配对 |
| `node.rename` | 重命名节点，参数含 nodeId、name |

---

## 十七、节点操作 API

| 方法 | 参数 | 说明 |
|------|------|------|
| `node.list` | 无 | 列出所有连接的节点 |
| `node.describe` | nodeId | 获取节点详细信息 |
| `node.invoke` | nodeId、command、params、timeoutMs、idempotencyKey | 远程调用节点上的方法 |
| `node.invoke.result` | 运行结果 | 节点向 Gateway 返回调用结果 |
| `node.event` | 事件数据 | 节点向 Gateway 推送事件 |

---

## 十八、渠道与消息 API

### 渠道管理

| 方法 | 说明 |
|------|------|
| `channels.status` | 获取所有渠道状态（Telegram、WhatsApp 等） |
| `channels.logout` | 登出某个渠道，参数含 channel 名称 |

### 直接发送消息

**方法**：`send`

| 字段 | 类型 | 说明 |
|------|------|------|
| to | string | 接收人标识 |
| message | string | 消息内容 |
| mediaUrl | string | 媒体文件 URL（可选） |
| mediaUrls | string[] | 多个媒体文件 URL（可选） |
| gifPlayback | boolean | 是否以 GIF 方式播放（可选） |
| channel | string | 渠道名称（可选） |
| accountId | string | 渠道账号 ID（可选） |
| sessionKey | string | 会话标识（可选） |
| idempotencyKey | string | 幂等键 |

### 唤醒

**方法**：`wake`

| 字段 | 类型 | 说明 |
|------|------|------|
| mode | string | `"now"` 或 `"next-heartbeat"` |
| text | string | 唤醒文本 |

### Web 登录

| 方法 | 说明 |
|------|------|
| `web.login.start` | 发起渠道 Web 登录 |
| `web.login.wait` | 等待登录完成 |

---

## 十九、TTS 语音合成 API

| 方法 | 参数 | 说明 |
|------|------|------|
| `tts.status` | 无 | 获取 TTS 服务状态 |
| `tts.providers` | 无 | 列出可用的 TTS 提供商 |
| `tts.enable` | 无 | 启用 TTS |
| `tts.disable` | 无 | 禁用 TTS |
| `tts.convert` | text、provider | 将文本转为语音 |
| `tts.setProvider` | provider | 设置默认 TTS 提供商 |

---

## 二十、其他 API

| 方法 | 说明 |
|------|------|
| `browser.request` | 浏览器自动化请求，参数含 method、path、query、body、timeoutMs |
| `talk.mode` | 设置对话模式 |
| `voicewake.get` | 获取语音唤醒配置 |
| `voicewake.set` | 设置语音唤醒 |
| `wizard.start` | 启动引导向导 |
| `wizard.next` | 向导下一步 |
| `wizard.cancel` | 取消向导 |
| `wizard.status` | 获取向导状态 |
| `update.run` | 运行系统更新，参数含 version、restart |

---

## 附录：错误码与协议版本

### 错误码

| 错误码 | 说明 |
|--------|------|
| `INVALID_REQUEST` | 请求格式错误或参数无效 |
| `UNAVAILABLE` | 服务不可用或超时 |
| `UNAUTHORIZED` | 认证失败 |
| `FORBIDDEN` | 权限不足 |

错误响应中还可能包含 `retryable`（是否可重试）和 `retryAfterMs`（建议重试间隔）。

### 协议版本

当前协议版本为 **3**，在连接握手时通过 `minProtocol` / `maxProtocol` 协商。

---

## 快速参考：开发聊天前端的最小 API 集

如果只需要实现一个基本的聊天界面，以下是最小必需的 API：

| 优先级 | API | 用途 |
|--------|-----|------|
| **必须** | `connect`（握手） | 建立连接并认证 |
| **必须** | `chat.send` | 发送用户消息 |
| **必须** | `chat` 事件监听 | 接收 AI 流式回复 |
| **必须** | `chat.history` | 加载历史消息 |
| **推荐** | `chat.abort` | 中止正在进行的回复 |
| **推荐** | `agent` 事件监听 | 展示工具调用过程 |
| **推荐** | `agents.list` | 获取可用 Agent 列表 |
| **推荐** | `sessions.list` | 获取会话列表 |
| **推荐** | `sessions.reset` | 重置会话 |
| **可选** | `agent.identity.get` | 获取 Agent 头像/名称 |
| **可选** | `sessions.patch` | 修改会话参数（模型、思考级别等） |
| **可选** | `sessions.compact` | 手动压缩上下文 |
| **可选** | `models.list` | 让用户选择模型 |

**最简实现路径**：如果不想处理 WebSocket，可以直接使用 `POST /v1/chat/completions`（OpenAI 兼容接口），用任何 HTTP 客户端即可对接，但会失去工具流式展示、会话管理等高级功能。
