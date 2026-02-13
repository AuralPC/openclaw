# OpenClaw Token 上下文组装与消耗分析

> 调查范围：OpenClaw 上下文组装全流程中所有 Token 消费者
> 调查时间：2025-02-12
> 最后更新：2025-02-12（按"是否有独立文件"重新分类）
> 目的：为前端 Token "库存"仪表盘提供数据模型参考

---

## 一、Token 预算（总量）

| 配置项 | 默认值 | 配置路径 | 源文件 |
|--------|--------|----------|--------|
| 上下文窗口总量 | 200,000 tokens | `config.agents.defaults.contextTokens` 或模型定义 `contextWindow` | `src/agents/defaults.ts:6`、`src/agents/context-window-guard.ts:21-50` |
| 输出预留 | 20,000 tokens | `config.agents.defaults.compaction.reserveTokensFloor` | `src/agents/pi-settings.ts:3` |
| 有效预算 | = 总量 - 预留 | — | — |

### 上下文窗口解析优先级

`resolveContextWindowInfo()`（`context-window-guard.ts:21`）：

1. `cfg.agents.defaults.contextTokens` — 显式上限
2. 模型注册表 `models.json` → `contextWindow`
3. 模型对象的 `contextWindow` 属性
4. 兜底：`DEFAULT_CONTEXT_TOKENS`（200,000）

### 安全阈值

| 阈值 | 值 | 行为 |
|------|-----|------|
| 硬最低 | 16,000 tokens | 阻断运行 |
| 软警告 | 32,000 tokens | 输出警告 |

---

## 二、上下文组成部分 — 按存储方式分类

### A. 有独立文件（BFF 可直接读取并计算 token）

#### A1. Bootstrap 文件

**磁盘位置**：`<workspace-dir>/<文件名>`

| 文件名 | 作用 |
|--------|------|
| `SOUL.md` | Agent 人格/角色设定 |
| `TOOLS.md` | 工具使用指引 |
| `IDENTITY.md` | 身份信息（名称、emoji、头像） |
| `USER.md` | 用户相关说明 |
| `HEARTBEAT.md` | 心跳/定时行为指引 |
| `BOOTSTRAP.md` | 启动引导指令 |
| `AGENTS.md` | 多 Agent 协作说明 |
| `MEMORY.md` / `MEMORIES.md` | Agent 长期记忆（二选一） |

**截断规则**：

每个文件**独立截断**，互不影响。`buildBootstrapContextFiles()` 循环遍历每个文件，逐一调用 `trimBootstrapContent(content, name, maxChars)` 判断是否超限，没有全局累加。

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `bootstrapMaxChars` | 20,000 字符 | 单个文件的字符上限（每个文件独立计算，非所有文件总和） |
| 截断策略 | 70% 头部 + 20% 尾部 | 单个文件超限时截断中间部分，插入 truncated 标记 |

**单位区分**：
- **截断上限是字符数**：单个文件超过 20,000 字符时被截断，这是代码里的硬限制
- **Token 是换算值**：用于估算占用多少上下文预算（粗略按 4 字符 ≈ 1 token）
- 单个文件：上限 20,000 字符，约消耗 5,000 tokens 的上下文预算
- 8 个文件全满：上限 160,000 字符，约消耗 40,000 tokens 的上下文预算
- 实际消耗取决于每个文件各自的内容长度

**BFF 计算方式**：`fs.readFile` 逐文件读取 → 每个文件超 20,000 字符的按 20,000 字符计 → tokenizer 逐文件计数后求和。

**前端交互**：不做硬限制（AI 也可能自行修改文件），仅在编辑器中当文件超过 20,000 字符时显示警告标识（字符计数变红 + 提示"超出部分将不会注入上下文"）。

---

#### A2. Skills 文件

**磁盘位置**（4 个来源，优先级由低到高）：

| 来源 | 路径 | 说明 |
|------|------|------|
| extra（插件） | `config.skills.load.extraDirs[]` 指定的目录 | 插件注册的技能 |
| bundled（内置） | OpenClaw 安装目录下的 `/skills/` | 随 OpenClaw 分发的 50+ 技能 |
| managed（托管） | `~/.openclaw/skills/` | 用户安装到全局的技能 |
| workspace（工作区） | `<workspace-dir>/skills/` | Agent 自己创建/安装的技能 |

**单个技能文件结构**：
```
skills/<skill-name>/
  SKILL.md          ← 主文件（YAML frontmatter + Markdown 正文）
  references/       ← 可选的参考文档
    cli-examples.md
    ...
```

**SKILL.md 格式**：
```yaml
---
name: skill-name
description: 简短描述
metadata:
  openclaw:
    emoji: "🔐"
    requires:
      bins: ["binary-name"]
      env: ["ENV_VAR"]
    os: ["darwin", "linux"]
---

# 技能正文（Markdown）
使用说明、示例、参考...
```

**注入流程**：所有启用技能的 SKILL.md 正文经 `formatSkillsForPrompt()` 拼接后注入系统提示。

| 特征 | 说明 |
|------|------|
| 上限 | **无显式上限** |
| 去重 | 按 `skill.name`，后来源覆盖先来源 |
| 估算 | ~1,000-10,000 tokens（视启用数量） |

**BFF 计算方式**：遍历 4 个目录读取 `SKILL.md` → 按 name 去重 → 过滤启用列表 → tokenizer 计数总和。

---

#### A3. 对话历史（JSONL 转录文件）

**磁盘位置**：`~/.openclaw/sessions/<agentId>/<sessionKey>.jsonl`

**文件内容**：每行一条 JSON 记录，包含所有消息类型：

| 消息类型 | role | 说明 |
|----------|------|------|
| 用户消息 | `user` | 用户发送的文本/附件 |
| AI 回复 | `assistant` | 模型生成的回复 |
| 工具调用 | `assistant`（含 tool_use） | 模型发起的工具调用请求 |
| 工具结果 | `user`（含 tool_result） | 工具执行返回的结果 |

**重要**：工具执行结果**不是**独立文件，而是对话历史的一部分。它只有独立的截断规则：

| 截断配置 | 默认值 | 说明 |
|----------|--------|------|
| 单结果占比上限 | 上下文的 30% | `MAX_TOOL_RESULT_CONTEXT_SHARE` |
| 硬字符上限 | 400,000 字符 | `HARD_MAX_TOOL_RESULT_CHARS` |
| 最低保留 | 2,000 字符 | 截断后至少保留头部 |

**对话历史的多层压缩机制**：

| 层级 | 机制 | 配置 |
|------|------|------|
| 第 1 层 | 轮次限制 | `dmHistoryLimit`（per-provider / per-user） |
| 第 2 层 | 上下文裁剪 | `contextPruning`（mode/ttl/softTrimRatio/hardClearRatio） |
| 第 3 层 | 压缩摘要 | `compaction`（分块 40% → 调用模型生成摘要替换原文） |

**BFF 计算方式**：`fs.readFile` 读取 JSONL → 逐行 JSON.parse → 按 role 分类 → tokenizer 计数。

---

#### A4. 配置文件

**磁盘位置**：`~/.openclaw/openclaw.json`

BFF 从中读取 token 预算相关配置：

| 配置路径 | 用途 |
|----------|------|
| `agents.defaults.contextTokens` | 上下文窗口总量 |
| `agents.defaults.compaction.reserveTokensFloor` | 输出预留 |
| `agents.defaults.bootstrapMaxChars` | Bootstrap 单文件字符上限 |
| `skills.entries[key].enabled` | 全局技能启用状态 |
| `agents.list[].skills` | Per-agent 技能白名单 |

---

### B. 无独立文件（代码运行时动态生成，BFF 无法直接读取）

#### B1. 系统提示（System Prompt 固定部分）

由 `buildAgentSystemPrompt()`（`src/agents/system-prompt.ts:164+`）在代码中拼装。

包含子段（`PromptMode="full"` 时全部注入）：

| 子段 | 内容 |
|------|------|
| Safety | 安全规则（硬编码） |
| Tooling | 可用工具名列表 + 摘要 |
| Tool Call Style | 调用格式说明（硬编码） |
| Skills | ← 来自 A2 的技能提示文本 |
| Memory Recall | 记忆搜索指引（如有 memory_search 工具） |
| User Identity | ownerNumbers |
| Time | 当前时间、时区 |
| Reply Tags | 回复标签规则 |
| Messaging | 消息格式说明 |
| Voice/TTS | 语音指引 |
| Documentation | 文档路径 |
| Workspace | 工作区注释 |
| Sandbox | 沙箱说明（如有） |
| CLI Reference | OpenClaw CLI 参考（硬编码） |
| Self-Update | 自更新指引（如有 gateway 工具） |
| Model Aliases | 模型别名（可选） |

**估算**：~2,000-5,000 tokens（不含 Skills 部分，Skills 已在 A2 独立计算）

**BFF 能做什么**：BFF 无法精确复制这段逻辑，但可以用固定估算值（如 3,000 tokens）作为近似值。具体参数变化不大。

---

#### B2. Tool 定义（函数 Schema）

由 `createOpenClawCodingTools()`（`src/agents/pi-tools.ts`）在代码中创建。

| 类型 | 说明 | 文件来源 |
|------|------|----------|
| 内置工具 | read、write、edit、exec、browser 等 | `pi-tools.ts`、`bash-tools.ts`、`openclaw-tools.ts` |
| 技能工具 | Skills 注册的工具 | 从 SKILL.md frontmatter 的 `command-tool` 字段解析 |
| MCP 工具 | 外部 MCP Server 提供的工具 | 运行时从 MCP Server 获取 |

工具的 JSON Schema 定义在 TypeScript 代码中，不存为独立文件。有一个 `tool-display.json` 但只是展示用的 emoji/标题元数据，不包含 Schema。

**估算**：~5,000-15,000 tokens（视工具数量）

**BFF 能做什么**：无法直接读取工具 Schema。可选方案：
- 固定估算值（如 8,000 tokens）
- 或从 OpenClaw Gateway 获取当前工具列表（如有此 API）

---

#### B3. Memory 检索结果

由 `memory_search` 工具运行时查询返回，结果临时注入对话中。

| 配置 | 说明 |
|------|------|
| `maxInjectedChars` | 后端级别配置（QMD/Pinecone 等） |
| 生命周期 | 临时的，作为 toolResult 存入 JSONL |

**BFF 能做什么**：Memory 结果已经作为 toolResult 存在 JSONL 中（A3），不需要单独计算。

---

## 三、Token 分配流模型（修正版）

```
┌──────────────────────────────────────────────────────┐
│           上下文窗口总量（contextWindow）                │
│             默认 200,000 tokens                        │
│             来源：openclaw.json 配置                    │
├──────────────────────────────────────────────────────┤
│  输出预留           -20,000 tokens                     │
│  来源：openclaw.json 配置                               │
├──────────────────────────────────────────────────────┤
│                                                        │
│  ┌─ 有独立文件（BFF 可精确计算）─────────────────────┐  │
│  │                                                    │  │
│  │  Bootstrap 文件   ≤40,000 tokens                   │  │
│  │  (8 个 .md 文件，per-file 上限 20,000 字符)         │  │
│  │                                                    │  │
│  │  Skills 提示      ~1,000-10,000 tokens             │  │
│  │  (各目录下 SKILL.md 文件，去重+过滤后拼接)           │  │
│  │                                                    │  │
│  │  对话历史         动态（消费剩余全部空间）            │  │
│  │  (JSONL 转录文件，含用户/AI/工具调用/工具结果)       │  │
│  │  └─ 其中工具结果：单次≤30%上下文，截断后存入 JSONL   │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                        │
│  ┌─ 无独立文件（BFF 只能估算）───────────────────────┐  │
│  │                                                    │  │
│  │  系统提示         ~2,000-5,000 tokens（固定文本段） │  │
│  │  (代码拼装，硬编码+动态参数)                        │  │
│  │                                                    │  │
│  │  Tool 定义        ~5,000-15,000 tokens             │  │
│  │  (TypeScript 代码中的 JSON Schema，含 MCP 工具)     │  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                        │
└──────────────────────────────────────────────────────┘
```

---

## 四、前端"库存"仪表盘数据模型

### BFF 可精确计算的部分

| 组件 | 数据来源 | BFF 计算方式 |
|------|----------|-------------|
| 总量 | `openclaw.json` → `contextTokens` + 模型定义 | 读取配置文件 |
| 输出预留 | `openclaw.json` → `reserveTokensFloor` | 读取配置文件 |
| Bootstrap 文件（逐文件） | `<workspace>/*.md`（8 个文件） | `fs.readFile` → 超 20,000 字符按 20,000 计 → tokenizer |
| Skills 提示（逐技能） | `skills/*/SKILL.md`（4 个目录） | 遍历目录 → 去重+过滤 → tokenizer |
| 对话历史 | `sessions/<agentId>/<sessionKey>.jsonl` | 逐行解析 → 按 role 分类 → tokenizer |

### BFF 只能估算的部分

| 组件 | 建议处理方式 |
|------|-------------|
| 系统提示 | 固定估算 ~3,000 tokens（变化不大） |
| Tool 定义 | 固定估算 ~8,000 tokens，或按工具数量 × ~500 tokens/工具 |

### 建议的 JSON 接口

```json
{
  "budget": {
    "total": 200000,
    "reserved": 20000,
    "effective": 180000
  },
  "consumers": {
    "bootstrap": {
      "tokens": 4800,
      "label": "Bootstrap 文件",
      "source": "file",
      "files": [
        { "name": "SOUL.md", "tokens": 1200, "chars": 4800, "overLimit": false },
        { "name": "TOOLS.md", "tokens": 800, "chars": 3200, "overLimit": false },
        { "name": "IDENTITY.md", "tokens": 300, "chars": 1200, "overLimit": false },
        { "name": "USER.md", "tokens": 400, "chars": 1600, "overLimit": false },
        { "name": "HEARTBEAT.md", "tokens": 200, "chars": 800, "overLimit": false },
        { "name": "BOOTSTRAP.md", "tokens": 0, "chars": 0, "missing": true },
        { "name": "AGENTS.md", "tokens": 500, "chars": 2000, "overLimit": false },
        { "name": "MEMORY.md", "tokens": 0, "chars": 0, "missing": true }
      ]
    },
    "skills": {
      "tokens": 3500,
      "label": "技能提示",
      "source": "file",
      "count": 12,
      "enabledCount": 10
    },
    "history": {
      "tokens": 120000,
      "label": "对话历史",
      "source": "file",
      "breakdown": {
        "userMessages": 15000,
        "assistantMessages": 80000,
        "toolResults": 25000
      },
      "turns": 24
    },
    "systemPrompt": {
      "tokens": 3000,
      "label": "系统提示",
      "source": "estimate"
    },
    "toolDefinitions": {
      "tokens": 8000,
      "label": "工具定义",
      "source": "estimate",
      "count": 15
    }
  },
  "used": 139300,
  "remaining": 40700
}
```

`source` 字段区分数据精度：
- `"file"` — 从文件精确计算
- `"estimate"` — 固定估算值（前端可用虚线边框或淡色标识区分）
