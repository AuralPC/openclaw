# OpenClaw Multi-Agent 架构解析

> 本文面向对 AI Agent 有基本概念但不深入了解底层实现的读者，从逻辑角度梳理 OpenClaw 项目的多智能体（Multi-Agent）能力。

---

## 一、先搞清楚一个问题：什么是 Agent？

在 OpenClaw 的语境中，一个 **Agent** 不是一段简单的聊天程序，而是一个**完整的、隔离的"大脑"**。每个 Agent 拥有：

| 组成部分 | 作用 | 存储位置 |
|---------|------|---------|
| **Workspace（工作空间）** | Agent 的"家"，存放人设文件、操作指令、记忆日志 | `~/.openclaw/workspace-<agentId>/` |
| **State Directory（状态目录）** | 认证信息、模型配置等运行状态 | `~/.openclaw/agents/<agentId>/agent/` |
| **Session Store（会话存储）** | 所有聊天历史，按对话维度分文件 | `~/.openclaw/agents/<agentId>/sessions/` |

简单来说：**一个 Agent = 独立的人格 + 独立的记忆 + 独立的权限**。

Workspace 内部的文件也很有讲究，各司其职：

```
workspace-<agentId>/
├── AGENTS.md      ← 操作指令（"你应该怎么做事"）
├── SOUL.md        ← 人格设定（"你是谁、说话什么风格"）
├── USER.md        ← 用户画像（"你的主人是谁"）
├── IDENTITY.md    ← 身份标识（名字、头像、emoji）
├── TOOLS.md       ← 工具使用备注
├── BOOTSTRAP.md   ← 首次启动仪式（用完即删）
├── HEARTBEAT.md   ← 定期心跳检查清单
├── memory/        ← 每日记忆日志（YYYY-MM-DD.md）
├── MEMORY.md      ← 长期记忆（精选）
└── skills/        ← Agent 专属技能
```

---

## 二、能力架构：多 Agent 是怎么组织起来的？

OpenClaw 的 Multi-Agent 体系可以用一句话概括：

> **一个 Gateway 进程，托管多个隔离的 Agent，通过 Binding 规则将消息路由到对应 Agent。**

用更直白的话说，想象一个公司的前台（Gateway），来了电话（消息），前台根据来电号码（Binding 规则），把电话转给不同的部门（Agent）。每个部门有自己的办公室（Workspace）、自己的档案柜（Sessions）、自己的权限卡（Auth）。

### 整体架构图

```
┌─────────────────────────────────────────────────────┐
│                    消息来源                           │
│   WhatsApp  /  Telegram  /  Slack  /  Discord  / …  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    Gateway       │  ← 统一的控制中枢（WebSocket 服务）
              │   （路由调度器）   │
              └────────┬────────┘
                       │
              ┌────────▼────────┐
              │  Binding 路由表  │  ← 决定"这条消息交给谁处理"
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ Agent A  │ │ Agent B  │ │ Agent C  │   ← 各自隔离的"大脑"
    │ (home)   │ │ (work)   │ │ (family) │
    ├──────────┤ ├──────────┤ ├──────────┤
    │ 独立人格  │ │ 独立人格  │ │ 独立人格  │
    │ 独立记忆  │ │ 独立记忆  │ │ 独立记忆  │
    │ 独立权限  │ │ 独立权限  │ │ 独立权限  │
    │ 独立模型  │ │ 独立模型  │ │ 独立模型  │
    └──────────┘ └──────────┘ └──────────┘
```

---

## 三、实现方法：三大核心机制

### 机制一：Binding 路由 —— "谁的消息交给谁"

这是 Multi-Agent 最基础的能力。Binding 是一套**确定性的匹配规则**，按精确度从高到低排列：

| 优先级 | 匹配维度 | 含义 | 举例 |
|-------|---------|------|-----|
| 1（最高） | `peer` | 精确匹配某个对话（DM/群组） | "张三的私聊 → Agent A" |
| 2 | `guildId` | Discord 服务器级别 | "某个 Discord 服务器 → Agent B" |
| 3 | `teamId` | Slack 工作区级别 | "某个 Slack 团队 → Agent C" |
| 4 | `accountId` | 渠道账号级别 | "个人微信号 → Agent A" |
| 5 | `channel` | 整个渠道 | "所有 WhatsApp 消息 → Agent A" |
| 6（最低） | 默认 | 兜底 | "其他消息 → 默认 Agent" |

**关键特性：最具体的规则优先。** 比如你给整个 WhatsApp 设了一个默认 Agent，但又给某个特定联系人设了另一个 Agent，那这个特定联系人的消息会走专属规则。

配置示例：

```json5
{
  bindings: [
    // 规则1：老板的私聊 → 交给"工作"Agent（peer 匹配，优先级最高）
    { agentId: "work", match: { channel: "whatsapp", peer: { kind: "dm", id: "+8613800000001" } } },

    // 规则2：个人号的其他消息 → 交给"生活"Agent（账号级别，优先级较低）
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },

    // 规则3：工作号的消息 → 交给"工作"Agent
    { agentId: "work", match: { channel: "whatsapp", accountId: "business" } },
  ],
}
```

### 机制二：Session Key —— "对话不串台"

每个对话都有一个唯一的 Session Key，格式为：

```
agent:<agentId>:<会话标识>
```

比如：
- `agent:home:main` — home Agent 的主会话
- `agent:work:whatsapp:+8613800000001` — work Agent 与某人的对话
- `agent:home:subagent:uuid-123` — home Agent 派出的子 Agent 的会话

这个设计有两个好处：
1. **从 Key 本身就能知道属于哪个 Agent**，不需要额外查表
2. **天然隔离**，不同 Agent 的会话数据物理上分开存储

### 机制三：Sub-Agent（子 Agent）—— "Agent 也能派助手"

这是 Multi-Agent 体系中最有意思的部分。一个 Agent 在运行过程中，可以**派出子 Agent 去后台执行任务**，自己继续工作，等子 Agent 完成后，结果会被"公告"回来。

子 Agent 的工作流：

```
主 Agent 运行中
    │
    ├─→ 调用 sessions_spawn 派出子 Agent
    │       │
    │       ├─→ 子 Agent 在独立 Session 中运行
    │       │       （agent:<id>:subagent:<uuid>）
    │       │
    │       ├─→ 子 Agent 完成任务
    │       │
    │       └─→ 子 Agent 将结果"公告"回主对话
    │
    ├─→ 主 Agent 继续处理其他事情（不阻塞）
    │
    └─→ 收到子 Agent 的公告结果
```

子 Agent 的关键设计决策：

| 特性 | 说明 |
|------|------|
| **隔离运行** | 有自己的 Session，不共享主 Agent 上下文 |
| **不可嵌套** | 子 Agent 不能再派出子 Agent（防止失控扇出） |
| **受限工具** | 默认不给 session 相关工具（防止越权） |
| **独立模型** | 可以用更便宜的模型来降低成本 |
| **并发控制** | 最多同时 8 个子 Agent（可配置） |
| **自动清理** | 默认 60 分钟后自动归档会话 |
| **结果公告** | 完成后自动向主对话发送结构化的结果摘要 |

公告结果的格式：

```
Status: success / error / timeout
Result: [任务摘要]
Notes: [补充说明]
runtime: 5m12s
tokens: in=X out=Y total=Z
cost: $X.XX
```

---

## 四、Agent 运行的完整生命周期

一条消息从进入系统到被 Agent 处理完毕，经历以下步骤：

```
1. 消息进入 → 通道层（WhatsApp/Telegram/Slack...）接收

2. 路由解析 → resolveAgentRoute() 匹配 Binding 规则，确定目标 Agent

3. 会话定位 → 构建 Session Key，找到或创建对应的会话

4. 队列排队 → 每个 Session 有独立队列，保证串行处理，不会冲突

5. Agent 运行 → runEmbeddedPiAgent()
   ├── 加载 Workspace 中的人设文件（AGENTS.md, SOUL.md 等）
   ├── 构建系统提示词
   ├── 调用 AI 模型推理
   ├── 执行工具调用（读写文件、执行命令、发消息等）
   └── 流式输出响应

6. 会话持久化 → 对话内容追加写入 JSONL 文件

7. 消息投递 → 将回复发送回来源渠道
```

---

## 五、达成效果：能用来干什么？

### 场景一：一人多面 —— 生活/工作分离

```json5
{
  agents: [
    { id: "home", model: "claude-sonnet-4-5", workspace: "~/.openclaw/workspace-home" },
    { id: "work", model: "claude-opus-4-5",   workspace: "~/.openclaw/workspace-work" },
  ],
  bindings: [
    { agentId: "home", match: { channel: "whatsapp", accountId: "personal" } },
    { agentId: "work", match: { channel: "whatsapp", accountId: "business" } },
  ],
}
```

- 个人号消息用 Sonnet（快速、便宜），工作号用 Opus（更深度）
- 两边记忆完全隔离，工作 Agent 不知道你周末在干什么

### 场景二：多人共享 —— 一台服务器服务多人

不同人的聊天可以路由到不同的 Agent，每个人有专属的 AI 助手，互相看不到对方的数据。

### 场景三：渠道分工 —— 日常闲聊 vs 深度工作

```json5
{
  bindings: [
    { agentId: "chat", match: { channel: "whatsapp" } },   // 日常快聊
    { agentId: "opus", match: { channel: "telegram" } },    // 深度思考
  ],
}
```

WhatsApp 用快速模型日常聊天，Telegram 用高能力模型处理复杂问题。

### 场景四：后台并行 —— 子 Agent 并发干活

主 Agent 可以同时派出多个子 Agent 分别执行：调研任务、数据查询、代码审查……自己不阻塞，等结果汇总。

### 场景五：家庭群 Agent —— 受限权限的群助手

为家庭群专门绑定一个 Agent，只给读取权限，开启沙箱隔离，通过 @提及 来触发。安全且可控。

---

## 六、优势与劣势分析

### 优势

| 优势 | 说明 |
|------|------|
| **强隔离** | 每个 Agent 的人格、记忆、认证、会话完全独立，没有数据交叉风险 |
| **确定性路由** | Binding 规则是声明式的、可预测的，不依赖 AI 来"判断"该交给谁，排查问题时很清晰 |
| **灵活的模型配置** | 每个 Agent 可以用不同的 AI 模型，甚至支持失败自动降级（failover chain） |
| **细粒度权限控制** | 工具可以按 Agent 维度开关，比如"家庭 Agent 只能读不能写" |
| **沙箱支持** | 可以按 Agent 配置 Docker 沙箱，物理级别隔离执行环境 |
| **子 Agent 并行** | 能把耗时任务委派出去，主 Agent 不阻塞，提高效率 |
| **插件/钩子体系** | 在 Agent 运行的各个阶段都有 Hook 点，扩展性强 |
| **会话持久化** | JSONL 追加写入，抗崩溃；会话可压缩、可归档 |

### 劣势

| 劣势 | 说明 |
|------|------|
| **路由是静态配置的** | Binding 规则需要人工在配置文件中编写，不能根据消息内容动态选择 Agent。如果你希望"AI 自己判断该交给谁"，需要额外开发 |
| **子 Agent 不可嵌套** | 子 Agent 不能再派子 Agent，限制了复杂的多层级协作场景 |
| **子 Agent 公告是尽力而为** | 如果 Gateway 重启，还没来得及公告的子 Agent 结果会丢失 |
| **Agent 间通信需要显式开启** | 默认关闭 Agent-to-Agent 通信，且需要配置允许列表。跨 Agent 协作不是"开箱即用"的 |
| **单进程架构** | 所有 Agent 跑在一个 Gateway 进程中，资源共享。Agent 过多或子 Agent 并发过高时，可能互相影响 |
| **配置复杂度** | 多 Agent 配置涉及 bindings、workspace、auth、tools、sandbox 等多个维度，学习曲线不低 |
| **认证不完全隔离** | 子 Agent 的认证会 fallback 到主 Agent，做不到 100% 的认证边界隔离 |
| **没有动态 Agent 编排** | 不像 CrewAI 或 AutoGen 那样有"角色分配 + 对话协商"的编排能力。OpenClaw 的 Multi-Agent 更像是"多实例部署"而非"多角色协作" |

---

## 七、与其他 Multi-Agent 框架的对比

| 维度 | OpenClaw | CrewAI / AutoGen 等框架 |
|------|---------|----------------------|
| **Agent 协作方式** | 静态路由 + 消息传递 | 动态任务分配 + 角色对话 |
| **适用场景** | 多渠道消息托管、多人/多人格隔离 | 复杂任务拆解、角色扮演协作 |
| **Agent 定义** | 配置驱动（JSON5） | 代码驱动（Python/TS） |
| **隔离性** | 强（独立 workspace + session + auth） | 弱（通常共享内存/上下文） |
| **生产就绪度** | 高（持久化、沙箱、权限、超时、队列） | 中低（多为实验/原型阶段） |
| **动态编排** | 无 | 有（Manager Agent、Round Robin 等） |
| **子任务** | 子 Agent（不可嵌套，结果公告） | 任务委托链（可嵌套） |

---

## 八、总结

OpenClaw 的 Multi-Agent 体系，核心定位是：

> **面向生产环境的、多渠道消息场景下的多 Agent 隔离托管平台。**

它不追求"AI 自主编排、角色协商"这类学术前沿能力，而是解决一个非常实际的问题：**怎么让多个具有不同人格、权限、记忆的 AI 助手，安全、可靠地跑在同一套基础设施上，同时服务不同的渠道和用户。**

如果你需要的是"一堆 AI 角色开会讨论怎么完成一个复杂任务"，OpenClaw 不是最合适的选择。但如果你需要的是"给不同的人、不同的场景部署不同的 AI 助手，且要求生产级的隔离和可靠性"，OpenClaw 的 Multi-Agent 架构是非常扎实的方案。
