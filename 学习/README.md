# OpenClaw 项目学习文档

这个目录包含了对 OpenClaw 项目的系统学习和梳理。

## 📚 文档导航

### 基础文档
- [项目架构.md](./项目架构.md) - OpenClaw 项目的整体架构和技术栈
- [核心模块.md](./核心模块.md) - 核心模块的详细说明和功能分析
- [代码阅读笔记.md](./代码阅读笔记.md) - 代码阅读过程中的关键发现和理解

### 核心机制专题
- [上下文组装与对话循环机制.md](./上下文组装与对话循环机制.md) - 上下文组装、工具调用循环、Skill 懒加载
- [多轮对话系统实现.md](./多轮对话系统实现.md) - 会话管理、上下文压缩、历史存储
- [Compact压缩机制详解.md](./Compact压缩机制详解.md) - 滑动窗口、历史摘要、JSONL 写入机制
- [前端控制界面分析.md](./前端控制界面分析.md) - Control UI 技术栈、架构设计、Gateway 通信

### Sandbox 沙箱专题
- [Sandbox沙箱系统分析.md](./Sandbox沙箱系统分析.md) - 沙箱基础概念（小白友好）
- [Sandbox本质深度解析.md](./Sandbox本质深度解析.md) - 沙箱技术本质剖析
- [AI与Sandbox交互流程详解.md](./AI与Sandbox交互流程详解.md) - AI 如何使用沙箱执行任务
- [多会话隔离策略分析.md](./多会话隔离策略分析.md) - 多会话场景下的隔离策略
- [容器间数据共享和记录.md](./容器间数据共享和记录.md) - 数据共享和持久化方案
- [多会话文件系统隔离问题分析.md](./多会话文件系统隔离问题分析.md) - 文件系统冲突和解决方案

### 多用户平台专题
- [多用户平台架构适配分析.md](./多用户平台架构适配分析.md) - OpenClaw 多用户改造分析
- [Docker嵌套运行分析.md](./Docker嵌套运行分析.md) - DooD vs DinD vs Sysbox
- [Kubernetes多用户AI平台方案.md](./Kubernetes多用户AI平台方案.md) - K8s 生产级部署方案
- [权限控制机制分析.md](./权限控制机制分析.md) - ExecSecurity、Owner-Only Tools、多用户适配

## 🎯 项目概述

**OpenClaw** 是一个个人 AI 助手平台，设计目标是在你自己的设备上运行。它可以集成多种消息渠道（WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、Microsoft Teams、WebChat 等），并支持语音交互和 Canvas UI 渲染。

### 核心特点

- **个人化**：单用户助手，完全由你控制
- **本地优先**：响应快速，感觉像本地应用
- **多渠道**：支持 10+ 种主流消息平台
- **可扩展**：30+ 扩展插件 + 50+ 技能模块
- **跨平台**：macOS、iOS、Android、Linux、Windows（WSL2）

### 技术亮点

- 基于 Node.js 22+ 和 TypeScript 5.9+
- 使用 Claude (Anthropic) 作为主要推荐模型
- Monorepo 架构（pnpm workspace）
- 严格的代码质量控制（70% 测试覆盖率）
- 现代化工具链（Vitest、Oxlint、tsdown）

## 📊 项目规模

- **总文件数**：2000+ 文件
- **代码库结构**：
  - CLI 核心系统
  - Gateway 服务器（控制平面）
  - Agent 编排系统
  - 30+ 扩展插件
  - 50+ 技能模块
  - 原生应用（macOS/iOS/Android）

## 🏗️ 主要组成部分

### 1. CLI 核心
命令行界面，提供 agent、gateway、message、config 等命令

### 2. Gateway 服务器
HTTP/WebSocket 控制平面，管理所有通信

### 3. Agent 系统
AI 代理编排和工具管理

### 4. 渠道集成
多平台消息渠道支持（Telegram、Discord、WhatsApp 等）

### 5. 扩展生态
插件系统，支持自定义渠道、提供商和工具

### 6. 技能生态
可选的外部服务集成（GitHub、Spotify、Notion 等）

## 🚀 快速开始

### 项目版本
- 当前版本：2.026.2.3（格式：YYYY.M.D）
- Node.js 要求：≥22.12.0
- 包管理器：pnpm 10.23.0

### 构建和测试
```bash
# 构建项目
pnpm build

# 运行测试
pnpm test

# 开发模式
pnpm dev

# 代码检查
pnpm check
```

## 📖 学习路径建议

### 路径 A：理解 OpenClaw 基础
1. [项目架构.md](./项目架构.md) - 整体架构
2. [核心模块.md](./核心模块.md) - 模块详解
3. [上下文组装与对话循环机制.md](./上下文组装与对话循环机制.md) - 核心工作原理
4. [多轮对话系统实现.md](./多轮对话系统实现.md) - 会话机制
5. [Compact压缩机制详解.md](./Compact压缩机制详解.md) - 压缩机制
6. [前端控制界面分析.md](./前端控制界面分析.md) - 前端 UI
7. [代码阅读笔记.md](./代码阅读笔记.md) - 源码阅读

### 路径 B：深入 Sandbox 沙箱
1. [Sandbox沙箱系统分析.md](./Sandbox沙箱系统分析.md) - 基础概念
2. [Sandbox本质深度解析.md](./Sandbox本质深度解析.md) - 技术原理
3. [多会话隔离策略分析.md](./多会话隔离策略分析.md) - 隔离策略
4. [容器间数据共享和记录.md](./容器间数据共享和记录.md) - 数据共享
5. [多会话文件系统隔离问题分析.md](./多会话文件系统隔离问题分析.md) - 冲突处理

### 路径 C：构建多用户 AI 平台
1. [多用户平台架构适配分析.md](./多用户平台架构适配分析.md) - 需求分析
2. [Docker嵌套运行分析.md](./Docker嵌套运行分析.md) - Docker 方案
3. [Kubernetes多用户AI平台方案.md](./Kubernetes多用户AI平台方案.md) - K8s 方案
4. [权限控制机制分析.md](./权限控制机制分析.md) - 安全与权限

## 🔗 相关资源

- [官方文档](../docs/) - Mintlify 文档站点
- [CLAUDE.md](../CLAUDE.md) - 项目开发指南
- [AGENTS.md](../AGENTS.md) - Agent 开发指南
- [CONTRIBUTING.md](../CONTRIBUTING.md) - 贡献指南

## 📝 更新日志

- 2026-02-07：新增前端控制界面分析（Control UI、Vite+Lit、Gateway 通信）
- 2026-02-06：新增权限控制机制分析（ExecSecurity、Owner-Only Tools、多用户适配）
- 2026-02-06：新增 Compact 压缩机制详解
- 2026-02-06：新增上下文组装与对话循环机制分析
- 2026-02-06：新增多轮对话系统实现分析
- 2026-02-06：新增 AI 与 Sandbox 交互流程详解
- 2026-02-06：新增多会话文件系统隔离问题分析
- 2026-02-06：新增 Kubernetes 多用户 AI 平台方案
- 2026-02-06：新增 Docker 嵌套运行分析（DooD/DinD/Sysbox）
- 2026-02-06：新增多用户平台架构适配分析
- 2026-02-06：新增 Sandbox 系列深度分析文档（5篇）
- 2026-02-05：创建学习文档目录，完成项目初步研究

---

**开始探索 OpenClaw 的精彩世界吧！** 🚀
