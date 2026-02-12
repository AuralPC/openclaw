# OpenClaw Agent 可配置参数全解

## 一、配置的整体结构

OpenClaw 的 Agent 配置分为两个层级：

| 层级 | 位置 | 作用 |
|------|------|------|
| **全局默认** | `agents.defaults` | 所有 Agent 共享的默认配置 |
| **单个 Agent** | `agents.list[]` | 某个具体 Agent 的专属配置，会覆盖全局默认 |

也就是说，你可以在 `agents.defaults` 里设一套"底线配置"，然后在每个 Agent 上按需覆盖。覆盖的优先级是：

```
单个 Agent 的配置 > 全局默认 > 系统内置默认值
```

---

## 二、Agent 的基本身份

每个 Agent 在 `agents.list` 中是一个条目，最基本的信息如下：

### 2.1 id（必填）

Agent 的唯一标识符。

**命名规则：**
- 只能包含小写字母、数字、下划线、短横线
- 必须以字母或数字开头
- 最长 64 个字符
- 不区分大小写（系统会自动转小写）
- 保留名称：`"main"` 是默认 Agent，不能删除

如果你输入了不合规的名字（比如含中文或特殊符号），系统会自动做"清洗"：把非法字符替换为短横线、去掉首尾短横线、截断到 64 字符。

### 2.2 name（可选）

Agent 的显示名称，给人看的。不受命名规则限制，可以是任何文字。

### 2.3 default（可选）

标记为 `true` 时，这个 Agent 就是"默认 Agent"——当路由绑定规则没有匹配到任何条目时，消息会兜底交给默认 Agent。

如果没有任何 Agent 标记 `default: true`，系统会用 `agents.list` 数组中的第一个。如果列表为空，默认就是 `"main"`。

### 2.4 identity（可选）

Agent 的"外观"设置，用于在 UI 和消息渠道中展示：

| 字段 | 含义 | 示例 |
|------|------|------|
| `name` | 显示名称 | "小助手" |
| `emoji` | 标志性表情 | "🤖" |
| `theme` | UI 主题色 | "#FF6B6B" |
| `avatar` | 头像（支持文件路径、URL 或 data URI） | "avatar.png" |

---

## 三、模型配置

### 3.1 主模型与备选（model）

每个 Agent 可以指定自己使用的 AI 模型：

| 配置 | 含义 |
|------|------|
| `model`（字符串） | 直接指定一个模型 |
| `model.primary` | 主模型 |
| `model.fallbacks` | 备选模型列表（主模型不可用时依次尝试） |

如果单个 Agent 没设，就用 `agents.defaults.model`。

### 3.2 图像模型（imageModel）

专门用于处理图像的模型，结构和 model 一样有 primary 和 fallbacks。在全局默认中设置。

### 3.3 模型目录（models）

可以在全局默认中定义一个模型目录，给各个模型起别名、设置特殊参数：

| 字段 | 含义 |
|------|------|
| `alias` | 模型别名（方便引用） |
| `params` | 模型专属参数（传给 API 的额外参数） |
| `streaming` | 是否启用流式输出 |

---

## 四、工作空间（Workspace）

### 4.1 workspace（目录路径）

Agent 的工作目录。所有人设文件、记忆文件、技能文件都存在这里。

默认路径：`~/.openclaw/workspace`

每个 Agent 可以指定自己的工作目录，从而实现文件层面的隔离。

### 4.2 人设文件系统

Workspace 里有一套"人设文件"，每个文件控制 Agent 行为的一个方面：

| 文件 | 作用 | 什么时候加载 | 重要程度 |
|------|------|-------------|---------|
| **AGENTS.md** | 操作指南——Agent 的行为准则、群聊礼仪、记忆工作流 | 每个会话开始时 | 核心 |
| **SOUL.md** | 灵魂——Agent 的性格、价值观、语气、边界 | 每个会话开始时 | 核心 |
| **USER.md** | 用户画像——你是谁、时区、偏好 | 每个会话开始时 | 核心 |
| **IDENTITY.md** | 身份——名字、表情、头像 | 每个会话开始时 | 一般 |
| **TOOLS.md** | 工具说明——环境特定的设备名、SSH 主机等 | 每个会话开始时 | 一般 |
| **MEMORY.md** | 长期记忆——精炼的关键信息 | 仅在主会话加载 | 重要 |
| **HEARTBEAT.md** | 心跳检查清单——定期执行的任务 | 心跳触发时 | 可选 |
| **BOOTSTRAP.md** | 首次引导——一次性的初始化向导 | 仅首次运行 | 临时 |
| **BOOT.md** | 启动清单——网关重启时执行 | 网关启动时 | 可选 |

**重要细节：**
- 子 Agent（被 sessions_spawn 派遣的）只能看到 AGENTS.md 和 TOOLS.md，看不到 SOUL.md、USER.md、MEMORY.md——这是安全机制，防止个人信息泄露给临时工作者
- MEMORY.md 只在主会话（直接对话）中加载，不在群聊或共享场景中加载——同样是隐私保护
- BOOTSTRAP.md 只在全新工作空间中创建，完成初始化后会被删除
- 所有文件超过 20,000 字符会被截断（可通过 `bootstrapMaxChars` 调整）

### 4.3 记忆目录

除了 MEMORY.md，还有一个 `memory/` 目录，按日期存放每日记忆：

```
memory/
├── 2024-01-15.md
├── 2024-01-16.md
└── 2024-01-17.md
```

Agent 通常会读取"今天 + 昨天"的日记来获得最近上下文。

### 4.4 技能目录

`skills/` 目录存放工作空间级别的自定义技能：

```
skills/
└── my-skill/
    └── SKILL.md
```

工作空间技能会覆盖同名的系统内置技能。

---

## 五、沙箱配置（Sandbox）

沙箱决定了 Agent 在什么环境中执行代码和操作文件。

### 5.1 基本设置

| 参数 | 可选值 | 含义 |
|------|-------|------|
| `sandbox.mode` | `"off"` / `"non-main"` / `"all"` | 关闭 / 仅非主会话沙箱化 / 所有会话沙箱化 |
| `sandbox.scope` | `"session"` / `"agent"` / `"shared"` | 每会话一个容器 / 每Agent一个 / 所有共享一个 |
| `sandbox.workspaceAccess` | `"none"` / `"ro"` / `"rw"` | 沙箱中是否能访问工作空间（不可 / 只读 / 读写） |
| `sandbox.workspaceRoot` | 路径 | 沙箱工作空间的根目录 |
| `sandbox.sessionToolsVisibility` | `"spawned"` / `"all"` | 沙箱会话能看到自己派遣的会话 / 所有会话 |

### 5.2 Docker 容器设置

如果沙箱模式开启，Agent 会在 Docker 容器中运行。可以精细控制容器的资源和安全：

**资源限制：**

| 参数 | 含义 | 示例 |
|------|------|------|
| `docker.memory` | 内存上限 | "512m"、"2g" |
| `docker.memorySwap` | 交换内存上限 | "1g" |
| `docker.cpus` | CPU 份额 | 0.5、1、2 |
| `docker.pidsLimit` | 最大进程数 | 100 |

**安全设置：**

| 参数 | 含义 |
|------|------|
| `docker.readOnlyRoot` | 根文件系统只读 |
| `docker.capDrop` | 丢弃的 Linux 能力 |
| `docker.seccompProfile` | Seccomp 安全配置文件 |
| `docker.apparmorProfile` | AppArmor 配置文件 |
| `docker.user` | 容器运行用户 |

**网络设置：**

| 参数 | 含义 |
|------|------|
| `docker.network` | 网络模式（bridge / none / 自定义） |
| `docker.dns` | DNS 服务器列表 |
| `docker.extraHosts` | 额外的 hosts 映射 |

**其他：**

| 参数 | 含义 |
|------|------|
| `docker.image` | Docker 镜像名 |
| `docker.containerPrefix` | 容器名前缀 |
| `docker.workdir` | 容器内工作目录（默认 /workspace） |
| `docker.env` | 额外环境变量 |
| `docker.binds` | 额外的目录挂载 |
| `docker.setupCommand` | 容器创建后的一次性初始化命令 |

### 5.3 浏览器设置

沙箱中还可以运行一个浏览器实例：

| 参数 | 含义 |
|------|------|
| `browser.enabled` | 是否启用浏览器 |
| `browser.image` | 浏览器容器镜像 |
| `browser.headless` | 是否无头模式 |
| `browser.cdpPort` | Chrome DevTools 端口 |
| `browser.vncPort` | VNC 远程桌面端口 |
| `browser.autoStart` | 需要时自动启动 |

### 5.4 自动清理

| 参数 | 含义 |
|------|------|
| `prune.idleHours` | 空闲超过 N 小时后清理 |
| `prune.maxAgeDays` | 超过 N 天后清理 |

---

## 六、工具配置（Tools）

### 6.1 工具策略

控制 Agent 能使用哪些工具：

| 参数 | 含义 |
|------|------|
| `tools.profile` | 工具预设方案（minimal / coding / messaging / full） |
| `tools.allow` | 白名单——只允许这些工具 |
| `tools.alsoAllow` | 追加白名单——在预设基础上额外允许 |
| `tools.deny` | 黑名单——明确禁止这些工具（优先级最高） |

注意：`allow` 和 `alsoAllow` 不能同时使用。要么用 `allow` 完全自定义，要么用 `profile` + `alsoAllow` 在预设上追加。

还可以按模型供应商单独设置工具策略（`tools.byProvider`），比如某个模型只能用编程工具，不能用消息工具。

### 6.2 代码执行工具（exec）

控制 Agent 执行命令行的行为：

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `exec.host` | 在哪执行（sandbox / gateway / node） | sandbox |
| `exec.security` | 安全模式（deny / allowlist / full） | deny |
| `exec.ask` | 遇到不在白名单的命令时是否询问用户 | on-miss |
| `exec.timeoutSec` | 命令超时时间（秒） | — |
| `exec.backgroundMs` | 多久后自动转为后台执行（毫秒） | — |
| `exec.pathPrepend` | 追加到 PATH 的目录 | — |
| `exec.safeBins` | 安全的标准输入程序（不需要白名单） | — |
| `exec.applyPatch.enabled` | 是否启用 apply_patch 子工具 | false |

### 6.3 提权工具（elevated）

某些高权限操作需要授权才能执行：

| 参数 | 含义 |
|------|------|
| `elevated.enabled` | 是否开启提权功能 |
| `elevated.allowFrom` | 哪些用户可以触发提权（按渠道分，比如 Discord 的某些用户 ID） |

### 6.4 Agent 间通信工具（agentToAgent）

控制 `sessions_send` 工具的权限（详见"沟通机制"文档）：

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `agentToAgent.enabled` | 是否允许跨 Agent 发消息 | false |
| `agentToAgent.allow` | 允许通信的 Agent 白名单（支持通配符） | — |

### 6.5 子 Agent 工具策略

子 Agent 默认被禁用了一批工具（会话管理、网关管理、定时任务、记忆系统等），可以通过以下参数调整：

| 参数 | 含义 |
|------|------|
| `subagents.tools.allow` | 子 Agent 允许的工具 |
| `subagents.tools.deny` | 子 Agent 禁止的工具 |

### 6.6 沙箱工具策略

沙箱中运行的会话也有独立的工具策略：

| 参数 | 含义 |
|------|------|
| `sandbox.tools.allow` | 沙箱中允许的工具 |
| `sandbox.tools.deny` | 沙箱中禁止的工具 |

---

## 七、会话配置（Session）

会话相关的配置主要在全局层面的 `session` 中：

### 7.1 会话范围

| 参数 | 含义 |
|------|------|
| `session.scope` | 会话范围（per-sender / global） |
| `session.dmScope` | 私聊会话的合并粒度 |

dmScope 的取值和效果（之前路由绑定文档详述过）：

| 值 | 效果 |
|---|------|
| `"main"` | 所有私聊合为一个会话（默认） |
| `"per-peer"` | 按对方区分 |
| `"per-channel-peer"` | 按渠道+对方区分 |
| `"per-account-channel-peer"` | 最细粒度（按账号+渠道+对方） |

### 7.2 会话重置

Agent 的会话可以自动重置（清除上下文、重新开始）：

| 参数 | 含义 |
|------|------|
| `session.reset.mode` | 重置模式（daily / idle） |
| `session.reset.atHour` | 每日重置的小时（0-23） |
| `session.reset.idleMinutes` | 空闲多少分钟后重置 |
| `session.resetByType` | 按聊天类型（私聊/群聊/线程）分别设置重置策略 |
| `session.resetByChannel` | 按渠道分别设置重置策略 |

### 7.3 身份关联（identityLinks）

可以把不同平台的同一个人关联起来：

```
identityLinks: {
  "whatsapp:+8613800000001": ["telegram:12345678"]
}
```

这样 WhatsApp 和 Telegram 上的同一用户会共享同一个会话。

### 7.4 Agent 间对话设置

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `session.agentToAgent.maxPingPongTurns` | Ping-Pong 最大轮次 | 5（最多5） |

### 7.5 发送策略

| 参数 | 含义 |
|------|------|
| `session.sendPolicy.default` | 默认发送策略（allow / deny） |
| `session.sendPolicy.rules` | 按渠道、聊天类型、会话前缀设置允许/拒绝规则 |

---

## 八、子 Agent 配置（Subagents）

### 8.1 全局默认

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `subagents.maxConcurrent` | 最大并发子 Agent 数 | 8 |
| `subagents.archiveAfterMinutes` | 子 Agent 完成后多久自动归档 | 60 分钟 |
| `subagents.model` | 子 Agent 默认模型 | 继承主 Agent |
| `subagents.thinking` | 子 Agent 默认思考级别 | 继承主 Agent |

### 8.2 单个 Agent 级别

| 参数 | 含义 |
|------|------|
| `subagents.allowAgents` | 允许以哪些 Agent 身份派遣子 Agent（`["*"]` 表示任意） |
| `subagents.model` | 这个 Agent 派遣子 Agent 时的默认模型 |
| `subagents.thinking` | 这个 Agent 派遣子 Agent 时的默认思考级别 |

---

## 九、心跳配置（Heartbeat）

心跳是 Agent 的"定时巡逻"机制——定期自动运行，执行 HEARTBEAT.md 中定义的检查清单。

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `heartbeat.every` | 心跳间隔 | "30m"（30分钟） |
| `heartbeat.activeHours.start` | 活跃时段开始 | — |
| `heartbeat.activeHours.end` | 活跃时段结束 | — |
| `heartbeat.activeHours.timezone` | 时区 | 用户时区 |
| `heartbeat.model` | 心跳时用的模型 | 继承主模型 |
| `heartbeat.session` | 心跳运行在哪个会话 | "main" |
| `heartbeat.target` | 心跳结果发到哪里 | — |
| `heartbeat.to` | 目标地址（手机号或聊天ID） | — |
| `heartbeat.prompt` | 自定义心跳提示词 | — |
| `heartbeat.includeReasoning` | 是否把推理过程也发出来 | false |

心跳只在活跃时段内执行。如果 HEARTBEAT.md 为空或只有注释，心跳会跳过执行（不消耗 API 调用）。

---

## 十、思考与输出配置

### 10.1 思考级别（thinking）

| 参数 | 含义 |
|------|------|
| `thinkingDefault` | 默认思考级别 |

可选值：`"off"` / `"minimal"` / `"low"` / `"medium"` / `"high"` / `"xhigh"`

级别越高，模型在回答前"思考"的时间越长、质量可能越高，但成本和延迟也越大。

### 10.2 详细程度（verbose）

| 参数 | 含义 |
|------|------|
| `verboseDefault` | 默认详细程度（off / on / full） |

### 10.3 提权级别（elevated）

| 参数 | 含义 |
|------|------|
| `elevatedDefault` | 默认提权级别（off / on / ask / full） |

---

## 十一、消息输出配置

### 11.1 分块流式输出（Block Streaming）

控制 Agent 的回复是一次性发出还是分段发出：

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `blockStreamingDefault` | 是否启用分块输出 | "on" |
| `blockStreamingBreak` | 分块边界（文本结束 / 消息结束） | "text_end" |
| `blockStreamingChunk.minChars` | 每块最少字符 | — |
| `blockStreamingChunk.maxChars` | 每块最多字符 | — |
| `blockStreamingChunk.breakPreference` | 偏好在哪断行（段落 / 换行 / 句子） | — |

### 11.2 合并设置（Coalesce）

| 参数 | 含义 |
|------|------|
| `blockStreamingCoalesce.minChars` | 累积多少字符才发出 |
| `blockStreamingCoalesce.maxChars` | 最多累积多少字符 |
| `blockStreamingCoalesce.idleMs` | 空闲多少毫秒后强制发出 |

### 11.3 拟人延迟（Human Delay）

让 Agent 的回复有"打字中"的感觉，不是瞬间弹出：

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `humanDelay.mode` | 延迟模式 | "off" |
| `humanDelay.minMs` | 最短延迟（毫秒） | 800 |
| `humanDelay.maxMs` | 最长延迟（毫秒） | 2500 |

模式可选：`"off"`（关闭）/ `"natural"`（自然延迟）/ `"custom"`（自定义延迟范围）

### 11.4 打字指示器（Typing Indicator）

| 参数 | 含义 |
|------|------|
| `typingMode` | 什么时候显示"对方正在输入"（never / instant / thinking / message） |
| `typingIntervalSeconds` | 打字指示器刷新间隔 |

---

## 十二、记忆搜索配置（Memory Search）

Agent 的向量记忆搜索系统，让 Agent 能从历史记忆中检索相关信息。

### 12.1 基本设置

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `memorySearch.enabled` | 是否启用 | true |
| `memorySearch.sources` | 搜索来源 | ["memory"] |
| `memorySearch.extraPaths` | 额外的搜索路径 | — |

sources 可选值：`"memory"`（MEMORY.md + memory/目录）、`"sessions"`（会话记录）

### 12.2 嵌入（Embedding）供应商

| 参数 | 含义 |
|------|------|
| `memorySearch.provider` | 嵌入供应商（openai / gemini / local / voyage） |
| `memorySearch.fallback` | 嵌入失败时的备选 |
| `memorySearch.model` | 嵌入模型名称 |

### 12.3 搜索参数

| 参数 | 含义 |
|------|------|
| `query.maxResults` | 最多返回几条结果 |
| `query.minScore` | 最低相关度分数（0-1） |
| `query.hybrid.enabled` | 是否启用混合搜索（向量 + 文本） |
| `query.hybrid.vectorWeight` | 向量搜索的权重 |
| `query.hybrid.textWeight` | 文本搜索的权重 |

### 12.4 同步设置

| 参数 | 含义 |
|------|------|
| `sync.onSessionStart` | 会话开始时同步索引 |
| `sync.onSearch` | 搜索时同步索引 |
| `sync.watch` | 监控文件变化自动同步 |
| `sync.intervalMinutes` | 定期同步间隔 |

---

## 十三、上下文管理

### 13.1 上下文裁剪（Context Pruning）

当对话变长时，自动裁剪旧的工具调用结果，节省 token：

| 参数 | 含义 |
|------|------|
| `contextPruning.mode` | 裁剪模式（off / cache-ttl） |
| `contextPruning.ttl` | 过期时间（比如 "30m"） |
| `contextPruning.keepLastAssistants` | 保留最近几条 Assistant 回复 |
| `contextPruning.tools.allow` | 哪些工具的结果可以裁剪 |
| `contextPruning.tools.deny` | 哪些工具的结果不能裁剪 |

### 13.2 上下文压缩（Compaction）

当上下文接近模型的上限时，自动做摘要压缩：

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `compaction.mode` | 压缩模式（default / safeguard） | "default" |
| `compaction.maxHistoryShare` | 历史记录最多占上下文的比例 | 0.5 |
| `compaction.memoryFlush.enabled` | 压缩前是否先刷新记忆 | true |

### 13.3 上下文窗口

| 参数 | 含义 |
|------|------|
| `contextTokens` | 上下文窗口 token 上限（用于估算） |

---

## 十四、群聊配置

| 参数 | 含义 |
|------|------|
| `groupChat.mentionPatterns` | 识别 @提及 的正则表达式列表 |
| `groupChat.historyLimit` | 群聊中包含的最大历史消息数 |

---

## 十五、技能配置（Skills）

| 参数 | 含义 |
|------|------|
| `skills` | 技能白名单（字符串数组） |

- 不设此参数 → 允许所有技能
- 设为空数组 `[]` → 禁用所有技能
- 设为具体列表 → 只允许列出的技能

---

## 十六、时间与时区

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `userTimezone` | 用户时区（IANA 格式） | 宿主机时区 |
| `timeFormat` | 时间格式 | "auto" |
| `envelopeTimezone` | 消息时间戳的时区 | "utc" |
| `envelopeTimestamp` | 是否显示绝对时间戳 | "on" |
| `envelopeElapsed` | 是否显示经过时间 | "on" |

---

## 十七、并发与超时

| 参数 | 含义 | 默认值 |
|------|------|-------|
| `maxConcurrent` | Agent 同时处理的最大对话数 | 1 |
| `timeoutSeconds` | Agent 单次运行的超时时间 | — |
| `mediaMaxMb` | 最大媒体附件大小（MB） | — |

---

## 十八、认证配置（Auth）

在全局 `auth` 中配置：

| 参数 | 含义 |
|------|------|
| `auth.profiles` | 认证配置文件（按名称索引） |
| `auth.order` | 不同场景下的认证配置优先顺序 |
| `auth.cooldowns.billingBackoffHours` | 计费错误后的退避时间 |

每个认证配置文件包含：供应商名称、认证模式（API Key / OAuth / Token）、邮箱等。实际的密钥存储在独立的安全文件中（不在主配置里）。

---

## 十九、Hooks（钩子）

外部事件触发 Agent 行动的机制：

| 参数 | 含义 |
|------|------|
| `hooks.enabled` | 是否启用钩子 |
| `hooks.path` | Webhook 监听路径 |
| `hooks.mappings` | 事件映射规则列表 |

每条映射规则可以指定：匹配条件、触发动作（唤醒 / 执行）、模型覆盖、超时时间等。

还支持 Gmail 钩子（监听邮件）和内部钩子（监听系统事件）。

---

## 二十、定时任务（Cron）

| 参数 | 含义 |
|------|------|
| `cron.enabled` | 是否启用定时任务 |
| `cron.maxConcurrentRuns` | 最大并发定时任务数 |

实际的定时任务在工作空间的文件中定义，不在主配置中。

---

## 二十一、审批配置（Approvals）

Agent 执行敏感操作时的审批流程：

| 参数 | 含义 |
|------|------|
| `approvals.exec.enabled` | 是否启用执行审批 |
| `approvals.exec.mode` | 审批模式（session / targets / both） |
| `approvals.exec.targets` | 审批通知发到哪里（渠道 + 地址） |

---

## 二十二、配置覆盖优先级总结

```
具体到抽象，越具体优先级越高：

第 1 级：单个 Agent 的配置（agents.list[].xxx）
    ↓ 如果没设
第 2 级：按模型供应商的配置（tools.byProvider[provider]）
    ↓ 如果没设
第 3 级：全局默认（agents.defaults.xxx）
    ↓ 如果没设
第 4 级：顶层全局配置（tools.xxx、session.xxx 等）
    ↓ 如果没设
第 5 级：系统内置默认值
```

---

## 二十三、在多用户方案中最需要关注的参数

如果你要做多用户产品，以下参数是最关键的：

| 关注点 | 关键参数 | 建议 |
|--------|---------|------|
| 用户隔离 | `sandbox.scope` | 设为 `"agent"` 或 `"session"` |
| 会话隔离 | `session.dmScope` | 设为 `"per-account-channel-peer"` |
| 文件隔离 | `workspace`（每 Agent 独立） | 每用户一个独立的 workspace 路径 |
| 工具安全 | `tools.exec.security` | 设为 `"deny"` 或 `"allowlist"` |
| 资源限制 | `sandbox.docker.memory/cpus/pidsLimit` | 根据服务器规格设定上限 |
| 跨 Agent 通信 | `agentToAgent.enabled` | 按需开启，配好白名单 |
| 并发控制 | `maxConcurrent` | 根据负载设定 |
| 模型成本 | `model` | 轻量级角色用便宜模型，重要角色用强模型 |
