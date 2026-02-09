# Sandbox 本质深度解析

## 🎯 核心问题：Sandbox 本质是什么？

### 表面理解（不完全正确）
```
Sandbox = Docker 容器
代码在 Docker 里运行
```

### 完整理解（正确）
```
Sandbox = 安全策略系统
    ├─ 工具策略层（第一道防线）
    ├─ 执行决策层（选择在哪里运行）
    ├─ Docker 隔离层（物理隔离）
    ├─ 配置管理层（灵活配置）
    ├─ 生命周期管理（容器复用和清理）
    └─ 工作区管理（数据共享和隔离）
```

---

## 🏗️ Sandbox 的完整架构

### 从用户请求到执行的完整流程

```
1️⃣ 用户发送消息
   ↓
   "帮我执行这个 Python 脚本"

2️⃣ Gateway 接收并路由到 Agent
   ↓

3️⃣ Agent 判断需要使用工具：exec
   ↓

4️⃣ 【第一层检查】工具策略检查
   ├─ 检查 deny 列表：exec 被禁止了吗？❌
   ├─ 检查 allow 列表：exec 被允许吗？✅
   └─ 通过！继续
   ↓

5️⃣ 【第二层检查】沙箱模式检查
   ├─ 读取配置：mode = "non-main"
   ├─ 判断：这是主会话吗？
   │   ├─ 是 → 直接在主机执行（跳过沙箱）
   │   └─ 否 → 进入沙箱流程
   └─ 假设：不是主会话，进入沙箱
   ↓

6️⃣ 【第三层】容器解析
   ├─ 读取 scope 配置："per-agent"
   ├─ 计算容器名：openclaw-sbx-agent-default-xxxx
   ├─ 检查：容器存在吗？
   │   ├─ 存在 → 复用
   │   └─ 不存在 → 创建新容器
   └─ 假设：需要创建
   ↓

7️⃣ 【Docker 层】容器创建
   ├─ 拉取镜像：debian:bookworm-slim
   ├─ 应用安全配置：
   │   ├─ --read-only（只读根文件系统）
   │   ├─ --network=none（无网络）
   │   ├─ --cap-drop=ALL（去除所有权限）
   │   ├─ --memory=512m（内存限制）
   │   └─ --tmpfs /tmp（临时文件系统）
   ├─ 挂载工作区（如果配置了 workspaceAccess）
   ├─ 运行 setupCommand（如果有）
   └─ 容器创建完成，状态：Running
   ↓

8️⃣ 【执行层】在容器中执行命令
   ├─ 构建 docker exec 命令：
   │   docker exec -i <container> sh -lc "python script.py"
   ├─ 执行命令
   ├─ 捕获输出（stdout + stderr）
   └─ 返回结果
   ↓

9️⃣ 【结果返回】
   ├─ 结果传回 Agent
   ├─ Agent 生成响应
   └─ 通过 Gateway 发送给用户
   ↓

🔟 【后台管理】（异步进行）
   ├─ 更新容器注册表（registry.json）
   ├─ 记录最后使用时间
   ├─ 清理工定期检查（每 5 分钟）
   └─ 删除闲置 >24h 的容器
```

---

## 🧩 Sandbox 的六大核心组件

### 组件 1：工具策略系统

**位置**：[src/agents/sandbox/tool-policy.ts](../src/agents/sandbox/tool-policy.ts)

**职责**：
- 维护允许/拒绝列表
- 编译策略规则（支持通配符和正则）
- 检查工具是否允许执行

**工作原理**：
```
输入：工具名称 "exec"
  ↓
1. 检查 deny 列表
   - "exec" 在里面吗？→ ❌
   - "exec_*" 匹配吗？→ ❌
   - 正则匹配吗？→ ❌

2. 检查 allow 列表
   - "exec" 在里面吗？→ ✅ 找到了！
   - 返回：允许执行

3. 如果都没找到
   - 返回默认策略（通常是拒绝）
```

**不仅仅是 Docker**：
这一层完全独立于 Docker，纯粹的策略检查。

---

### 组件 2：配置系统

**位置**：[src/agents/sandbox/config.ts](../src/agents/sandbox/config.ts)

**职责**：
- 合并全局配置和 Agent 配置
- 解析默认值
- 处理配置继承

**工作原理**：
```
全局配置（agents.defaults.sandbox）
    +
Agent 配置（agents.list[0].sandbox）
    ↓
合并规则：
- Agent 配置优先
- 未设置的使用全局默认
- 特殊处理：tools.allow/deny 会合并而非覆盖
    ↓
最终配置对象
```

**为什么重要**：
- 不是简单地"在 Docker 运行"
- 而是根据复杂的配置决定**如何运行**、**在哪运行**

---

### 组件 3：上下文管理系统

**位置**：[src/agents/sandbox/context.ts](../src/agents/sandbox/context.ts)

**职责**：
- 确保容器存在（不存在则创建）
- 同步技能文件到沙箱
- 同步工作区文件
- 初始化工作环境

**工作原理**：
```
ensureSandboxContext(config, sessionKey):
  1. 检查容器是否存在
     ├─ 存在 → 检查配置是否变化
     │   ├─ 变化 → 删除旧容器，创建新的
     │   └─ 未变化 → 复用
     └─ 不存在 → 创建新容器

  2. 初始化工作区
     ├─ 创建沙箱工作区目录
     └─ 同步技能文件（如果需要）

  3. 返回上下文对象
     ├─ 容器 ID
     ├─ 工作区路径
     └─ 浏览器端口（如果启用）
```

**不仅仅是 Docker**：
- 管理文件同步
- 管理生命周期
- 管理状态持久化

---

### 组件 4：Docker 管理层

**位置**：[src/agents/sandbox/docker.ts](../src/agents/sandbox/docker.ts)

**职责**：
- Docker API 交互
- 容器生命周期管理
- 安全参数配置

**核心函数**：
```typescript
// 创建容器
createSandboxContainer(config, sessionKey)
  → docker create <安全参数> <镜像>

// 启动容器
docker start <container>

// 执行命令
docker exec -i <container> sh -lc "<command>"

// 检查容器
docker inspect <container>

// 删除容器
docker rm -f <container>
```

**安全参数的应用**：
```bash
docker create \
  --name openclaw-sbx-xxx \
  --read-only \                    # 只读根系统
  --tmpfs /tmp:rw,exec,size=1g \   # 临时文件系统
  --tmpfs /var/tmp:rw,exec,size=1g \
  --network none \                  # 无网络
  --cap-drop ALL \                  # 去除所有权限
  --security-opt no-new-privileges \  # 禁止提权
  --memory 512m \                   # 内存限制
  --cpus 1.0 \                      # CPU 限制
  --pids-limit 100 \                # 进程数限制
  -v /host/workspace:/workspace \   # 挂载工作区
  debian:bookworm-slim              # 基础镜像
```

**这才是 Docker 的部分**！
但即使是 Docker 层，也包含了复杂的配置逻辑。

---

### 组件 5：注册表系统

**位置**：[src/agents/sandbox/registry.ts](../src/agents/sandbox/registry.ts)

**职责**：
- 持久化容器信息
- 记录最后使用时间
- 提供容器查询接口

**存储格式**：
```json
{
  "containers": {
    "openclaw-sbx-agent-default-abc123": {
      "id": "abc123...",
      "sessionKey": "main",
      "createdAt": "2026-02-05T10:00:00Z",
      "lastUsedAt": "2026-02-05T10:30:00Z",
      "configHash": "sha1hash..."
    }
  },
  "browsers": {
    "openclaw-sbx-browser-xyz789": {
      "id": "xyz789...",
      "cdpPort": 9222,
      "vncPort": 5900
    }
  }
}
```

**为什么需要注册表**：
- Docker 本身不记录"最后使用时间"
- 需要跟踪配置变化
- 需要关联会话和容器

**不仅仅是 Docker**：
这是 OpenClaw 自己的管理层。

---

### 组件 6：清理系统

**位置**：[src/agents/sandbox/prune.ts](../src/agents/sandbox/prune.ts)

**职责**：
- 定期清理闲置容器
- 删除过期容器
- 清理注册表

**清理逻辑**：
```
每 5 分钟运行一次：

for each container in registry:
  idle_hours = now - lastUsedAt
  age_days = now - createdAt

  if idle_hours > 24 or age_days > 7:
    docker rm -f container
    delete from registry
```

**不仅仅是 Docker**：
- 智能的生命周期管理
- 防止资源泄漏
- 自动垃圾回收

---

## 🆚 Docker vs OpenClaw Sandbox

### 纯 Docker（手动管理）

```bash
# 你需要手动做所有事情
docker run --rm -it \
  --read-only \
  --network none \
  --cap-drop ALL \
  -v $(pwd):/workspace \
  debian:bookworm-slim \
  python script.py

# 问题：
# 1. 每次都要输入一长串参数
# 2. 忘记某个安全参数可能导致漏洞
# 3. 容器用完就删除，无法复用
# 4. 没有策略管理
# 5. 没有自动清理
```

### OpenClaw Sandbox（自动管理）

```yaml
# 配置一次
sandbox:
  mode: "non-main"
  scope: "per-agent"
  docker:
    readOnlyRoot: true
    network: "none"
    # ... 所有安全参数

# 然后：
# 1. 自动应用所有安全参数
# 2. 自动创建和复用容器
# 3. 自动清理闲置容器
# 4. 自动处理工具策略
# 5. 自动管理工作区
# 6. 自动记录和追踪
```

---

## 🎭 Sandbox 的"双重身份"

### 身份 1：安全策略执行器

即使**不使用 Docker**，Sandbox 系统也在工作：

```yaml
sandbox:
  mode: "off"  # Docker 关闭！
  tools:
    deny:
      - "gateway"  # 但工具策略仍然生效！
```

**效果**：
- 不在 Docker 运行
- 但仍然检查工具策略
- 仍然记录执行日志
- 仍然应用资源限制（通过其他机制）

### 身份 2：Docker 容器编排器

当 `mode != "off"` 时，Sandbox 成为 Docker 的高级封装：

```yaml
sandbox:
  mode: "on"  # Docker 开启
```

**效果**：
- 在 Docker 容器中运行
- 应用所有 Docker 安全特性
- 加上自己的管理特性

---

## 📊 本质总结

### Sandbox ≠ Docker

```
Sandbox 是一个多层安全系统：

┌─────────────────────────────────────┐
│ 工具策略层（always active）          │  ← 不依赖 Docker
├─────────────────────────────────────┤
│ 执行决策层（always active）          │  ← 不依赖 Docker
├─────────────────────────────────────┤
│ 配置管理层（always active）          │  ← 不依赖 Docker
├─────────────────────────────────────┤
│ Docker 隔离层（when mode != "off"） │  ← 这才是 Docker
├─────────────────────────────────────┤
│ 生命周期管理（when mode != "off"）  │  ← 封装 Docker
├─────────────────────────────────────┤
│ 注册表和清理（when mode != "off"）  │  ← 扩展 Docker
└─────────────────────────────────────┘
```

### Docker 是 Sandbox 的一个**实现方式**

```
Sandbox 系统设计：

安全隔离需求
    ↓
可以有多种实现：
├─ Docker 容器（当前实现）
├─ VM 虚拟机（未来可能）
├─ 进程沙箱（如 seccomp、AppArmor）
└─ 操作系统沙箱（如 macOS Sandbox）

OpenClaw 选择了 Docker 因为：
✅ 轻量级
✅ 跨平台
✅ 易于配置
✅ 生态成熟
```

---

## 🔍 深入理解：代码在哪里执行？

### 场景分析

#### 场景 1：Sandbox OFF

```yaml
sandbox:
  mode: "off"
```

**执行位置**：
```
用户命令："python script.py"
  ↓
OpenClaw Gateway 进程
  ↓
child_process.spawn("python", ["script.py"])
  ↓
直接在你的操作系统上执行
  ↓
结果返回
```

**本质**：
- 就像你自己在终端输入命令
- 没有隔离
- 没有 Docker

---

#### 场景 2：Sandbox ON (非主会话)

```yaml
sandbox:
  mode: "non-main"
  scope: "per-agent"
```

**执行位置**：
```
用户命令（来自 Telegram）："python script.py"
  ↓
OpenClaw Gateway 进程（在你的电脑）
  ↓
检查：不是主会话 → 需要沙箱
  ↓
确保容器存在（per-agent: 复用容器 A）
  ↓
child_process.spawn("docker", [
  "exec", "-i", "container-A",
  "sh", "-lc", "python script.py"
])
  ↓
Docker 守护进程（在你的电脑）
  ↓
在容器 A 中执行 "python script.py"
  ↓
结果返回给 Gateway
  ↓
Gateway 返回给 Telegram
```

**本质**：
- Gateway 进程仍在你的电脑
- 通过 Docker CLI 与 Docker 守护进程通信
- **实际执行在容器内**
- 容器运行在 Docker 守护进程管理的隔离环境

---

## 🎯 最终答案

### Q: Sandbox 本质上就是在 Docker 里执行代码吗？

**A**:

**简化版**：是的，当沙箱开启时，代码在 Docker 容器中执行。

**完整版**：不完全是。Sandbox 是一个**完整的安全管理系统**，包含：
1. 策略管理（工具白名单/黑名单）
2. 执行决策（在哪里运行）
3. 容器编排（Docker 管理）
4. 生命周期管理（创建、复用、清理）
5. 配置系统（灵活的安全配置）
6. 工作区管理（文件共享和隔离）

Docker 是其中**最核心的隔离技术**，但 Sandbox 系统远不止于此。

**类比**：
```
Sandbox : Docker
    =
汽车   : 发动机

发动机是汽车的核心动力，
但汽车还包括：
- 方向盘（策略管理）
- 刹车系统（安全限制）
- 仪表盘（监控和日志）
- 座椅和空调（配置和便利性）
- ...

同样，Docker 是 Sandbox 的核心隔离技术，
但 Sandbox 还包括完整的管理和策略系统。
```

---

**关键理解点**：
1. ✅ 代码确实在 Docker 容器中执行（当 mode != "off"）
2. ✅ 但 Sandbox 管理了整个生命周期
3. ✅ 并且提供了策略、配置、监控等完整功能
4. ✅ 即使关闭 Docker，策略系统仍然工作
