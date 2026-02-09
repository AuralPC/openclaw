# Kubernetes 多用户 AI 平台方案

## 🎯 方案概述

使用 Kubernetes 原生能力替代 Docker in Docker，实现安全、可扩展的多用户 AI 平台。

### 核心思路

```
传统方案（Docker in Docker）：
  OpenClaw 容器 → docker create → Sandbox 容器（嵌套）

K8s 方案（Pod 即 Sandbox）：
  OpenClaw Pod → K8s API → Sandbox Pod（平级，由 K8s 管理）

┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes 集群                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 你的后端服务                         │   │
│  │  - 用户认证                                         │   │
│  │  - 任务调度                                         │   │
│  │  - 调用 K8s API 管理用户资源                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│          ┌───────────────┼───────────────┐                  │
│          ↓               ↓               ↓                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │ OpenClaw    │ │ OpenClaw    │ │ OpenClaw    │           │
│  │ Pod (Alice) │ │ Pod (Bob)   │ │ Pod (Carol) │           │
│  │             │ │             │ │             │           │
│  │ PVC: alice  │ │ PVC: bob    │ │ PVC: carol  │           │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │
│         │               │               │                   │
│         ↓               ↓               ↓                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │Sandbox Pod │  │Sandbox Pod │  │Sandbox Pod │            │
│  │(会话1)     │  │(会话1)     │  │(会话1)     │            │
│  │PVC: alice  │  │PVC: bob    │  │PVC: carol  │            │
│  └────────────┘  └────────────┘  └────────────┘            │
│         │                                                   │
│  ┌────────────┐                                            │
│  │Sandbox Pod │  ← Alice 的另一个会话，共享同一个 PVC       │
│  │(会话2)     │                                            │
│  │PVC: alice  │                                            │
│  └────────────┘                                            │
│                                                             │
│  ✅ 不需要 Docker in Docker                                 │
│  ✅ 原生 K8s 隔离                                           │
│  ✅ PVC 天然支持 workspace 共享                             │
│  ✅ 资源配额、调度、监控都由 K8s 管理                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ 整体架构

### 层次结构

```
┌─────────────────────────────────────────────────────────────┐
│                      应用层                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  你的 Web 前端                                      │   │
│  │  - 用户界面                                         │   │
│  │  - 任务管理                                         │   │
│  │  - Team 协作                                        │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      服务层                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  后端 API 服务                                      │   │
│  │  - 用户认证 (JWT/OAuth)                             │   │
│  │  - 任务调度                                         │   │
│  │  - K8s 资源管理                                     │   │
│  │  - Team 和权限管理                                  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      执行层                                 │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐   │
│  │ OpenClaw Pod  │  │ OpenClaw Pod  │  │ OpenClaw Pod  │   │
│  │ (per user)    │  │ (per user)    │  │ (per user)    │   │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘   │
│          │                  │                  │            │
│          ↓                  ↓                  ↓            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Sandbox Pods (per session)               │ │
│  └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      存储层                                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  PersistentVolumeClaim (per user)                    │ │
│  │  - workspace 文件                                    │ │
│  │  - Memory 数据库                                     │ │
│  │  - 用户配置                                          │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 核心 K8s 资源

| 资源类型 | 用途 | 生命周期 |
|----------|------|----------|
| **Namespace** | 用户隔离（可选） | 与用户绑定 |
| **Deployment** | OpenClaw 服务 | 长期运行 |
| **Pod** | Sandbox 执行 | 任务级，执行完销毁 |
| **PVC** | 用户 workspace | 与用户绑定 |
| **ConfigMap** | 配置信息 | 按需更新 |
| **Secret** | 敏感信息（API Key） | 与用户绑定 |
| **ServiceAccount** | Pod 权限控制 | 按角色 |
| **ResourceQuota** | 用户资源限制 | 与用户绑定 |
| **NetworkPolicy** | 网络隔离 | 按 Namespace |

---

## 📦 核心组件详解

### 1. 用户 Namespace（推荐）

为每个用户创建独立的 Namespace，实现资源隔离。

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: user-alice
  labels:
    app: openclaw-platform
    user: alice
    type: user-namespace
```

**优点**：
- 天然的资源隔离
- 简化 RBAC 权限管理
- 资源配额按 Namespace 设置
- 网络策略按 Namespace 生效

### 2. 用户 Workspace (PVC)

```yaml
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: workspace
  namespace: user-alice
spec:
  accessModes:
    - ReadWriteMany  # 多 Pod 共享！
  storageClassName: standard  # 或 nfs, cephfs 等支持 RWX 的存储
  resources:
    requests:
      storage: 10Gi
```

**关键点**：
- `ReadWriteMany` (RWX)：允许多个 Pod 同时读写
- 所有该用户的 Pod（OpenClaw + Sandbox）都挂载同一个 PVC
- 实现 workspace 共享

**支持 RWX 的存储方案**：
| 存储类型 | 云平台 | 说明 |
|----------|--------|------|
| NFS | 自建 | 最简单 |
| AWS EFS | AWS | 托管 NFS |
| Azure Files | Azure | SMB/NFS |
| GCP Filestore | GCP | 托管 NFS |
| CephFS | 自建 | 分布式 |
| Longhorn | 自建 | K8s 原生 |

### 3. OpenClaw Deployment

```yaml
# openclaw-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openclaw
  namespace: user-alice
spec:
  replicas: 1
  selector:
    matchLabels:
      app: openclaw
      user: alice
  template:
    metadata:
      labels:
        app: openclaw
        user: alice
    spec:
      serviceAccountName: openclaw-sa  # 需要创建 Sandbox Pod 的权限

      containers:
        - name: openclaw
          image: openclaw:latest

          ports:
            - containerPort: 3000
              name: http

          env:
            - name: USER_ID
              value: "alice"
            - name: NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            # AI 模型 API Key
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: api-keys
                  key: anthropic

          volumeMounts:
            - name: workspace
              mountPath: /workspace
            - name: config
              mountPath: /app/config
              readOnly: true

          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"

      volumes:
        - name: workspace
          persistentVolumeClaim:
            claimName: workspace
        - name: config
          configMap:
            name: openclaw-config
```

### 4. Sandbox Pod 模板

Sandbox 不是预先创建的，而是由 OpenClaw 动态创建。

```yaml
# sandbox-pod-template.yaml (OpenClaw 用这个模板创建)
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-${SESSION_ID}
  namespace: ${NAMESPACE}
  labels:
    app: sandbox
    user: ${USER_ID}
    session: ${SESSION_ID}
  annotations:
    openclaw.io/created-by: openclaw
    openclaw.io/session-id: ${SESSION_ID}
spec:
  restartPolicy: Never  # 执行完不重启

  # 安全上下文
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000

  containers:
    - name: sandbox
      image: openclaw-sandbox:latest

      # 安全限制
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities:
          drop:
            - ALL

      volumeMounts:
        - name: workspace
          mountPath: /workspace
        - name: tmp
          mountPath: /tmp

      resources:
        requests:
          memory: "128Mi"
          cpu: "100m"
        limits:
          memory: "256Mi"
          cpu: "500m"

      # 保持运行，等待命令
      command: ["sleep", "infinity"]

  volumes:
    - name: workspace
      persistentVolumeClaim:
        claimName: workspace  # 同一个 PVC！
    - name: tmp
      emptyDir:
        sizeLimit: 100Mi

  # 自动清理
  activeDeadlineSeconds: 3600  # 1小时后自动终止
```

### 5. ServiceAccount 和 RBAC

OpenClaw 需要权限来创建 Sandbox Pod。

```yaml
# serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: openclaw-sa
  namespace: user-alice

---
# role.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: sandbox-manager
  namespace: user-alice
rules:
  # 可以管理 Pod（创建 Sandbox）
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["create", "delete", "get", "list", "watch"]

  # 可以执行命令（exec into Pod）
  - apiGroups: [""]
    resources: ["pods/exec"]
    verbs: ["create"]

  # 可以查看日志
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]

---
# rolebinding.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: openclaw-sandbox-manager
  namespace: user-alice
subjects:
  - kind: ServiceAccount
    name: openclaw-sa
    namespace: user-alice
roleRef:
  kind: Role
  name: sandbox-manager
  apiGroup: rbac.authorization.k8s.io
```

### 6. 资源配额（限制用户资源）

```yaml
# resourcequota.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: user-quota
  namespace: user-alice
spec:
  hard:
    # Pod 数量限制
    pods: "10"

    # CPU 限制
    requests.cpu: "2"
    limits.cpu: "4"

    # 内存限制
    requests.memory: "2Gi"
    limits.memory: "4Gi"

    # 存储限制
    requests.storage: "20Gi"
    persistentvolumeclaims: "5"
```

### 7. 网络策略（可选但推荐）

```yaml
# networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: sandbox-isolation
  namespace: user-alice
spec:
  podSelector:
    matchLabels:
      app: sandbox
  policyTypes:
    - Ingress
    - Egress

  # Sandbox 默认禁止所有网络
  ingress: []
  egress: []

  # 如果需要允许特定访问，可以添加规则
  # egress:
  #   - to:
  #       - ipBlock:
  #           cidr: 10.0.0.0/8  # 允许访问内部服务

---
# OpenClaw 可以访问 Sandbox
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: openclaw-access
  namespace: user-alice
spec:
  podSelector:
    matchLabels:
      app: sandbox
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: openclaw
```

---

## 🔧 OpenClaw 改造方案

### 需要改造的核心逻辑

原来的 Sandbox 创建逻辑：
```typescript
// 原来：使用 Docker API
import Docker from 'dockerode';
const docker = new Docker();
await docker.createContainer({ ... });
```

改造后：
```typescript
// 改造后：使用 K8s API
import * as k8s from '@kubernetes/client-node';
const kc = new k8s.KubeConfig();
kc.loadFromCluster();  // 在集群内运行时自动加载
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
await k8sApi.createNamespacedPod(namespace, podSpec);
```

### 完整的 K8s Sandbox 管理器

```typescript
// src/sandbox/k8s-sandbox.ts

import * as k8s from '@kubernetes/client-node';
import { v4 as uuidv4 } from 'uuid';

interface SandboxConfig {
  userId: string;
  sessionId: string;
  namespace: string;
  image: string;
  memoryLimit: string;
  cpuLimit: string;
  workspacePvc: string;
  timeout: number;
}

export class K8sSandboxManager {
  private k8sApi: k8s.CoreV1Api;
  private exec: k8s.Exec;
  private namespace: string;
  private userId: string;

  constructor() {
    const kc = new k8s.KubeConfig();

    // 在 K8s 集群内运行时，自动加载 ServiceAccount 凭证
    kc.loadFromCluster();

    this.k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    this.exec = new k8s.Exec(kc);

    // 从环境变量获取
    this.namespace = process.env.NAMESPACE || 'default';
    this.userId = process.env.USER_ID || 'unknown';
  }

  /**
   * 创建 Sandbox Pod
   */
  async createSandbox(sessionId: string): Promise<string> {
    const podName = `sandbox-${sessionId}`;

    const pod: k8s.V1Pod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        namespace: this.namespace,
        labels: {
          app: 'sandbox',
          user: this.userId,
          session: sessionId,
        },
        annotations: {
          'openclaw.io/created-at': new Date().toISOString(),
          'openclaw.io/session-id': sessionId,
        },
      },
      spec: {
        restartPolicy: 'Never',

        // 安全上下文
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 1000,
          runAsGroup: 1000,
          fsGroup: 1000,
        },

        containers: [{
          name: 'sandbox',
          image: process.env.SANDBOX_IMAGE || 'openclaw-sandbox:latest',

          securityContext: {
            allowPrivilegeEscalation: false,
            readOnlyRootFilesystem: true,
            capabilities: {
              drop: ['ALL'],
            },
          },

          command: ['sleep', 'infinity'],

          volumeMounts: [
            {
              name: 'workspace',
              mountPath: '/workspace',
            },
            {
              name: 'tmp',
              mountPath: '/tmp',
            },
          ],

          resources: {
            requests: {
              memory: process.env.SANDBOX_MEMORY_REQUEST || '128Mi',
              cpu: process.env.SANDBOX_CPU_REQUEST || '100m',
            },
            limits: {
              memory: process.env.SANDBOX_MEMORY_LIMIT || '256Mi',
              cpu: process.env.SANDBOX_CPU_LIMIT || '500m',
            },
          },
        }],

        volumes: [
          {
            name: 'workspace',
            persistentVolumeClaim: {
              claimName: process.env.WORKSPACE_PVC || 'workspace',
            },
          },
          {
            name: 'tmp',
            emptyDir: {
              sizeLimit: '100Mi',
            },
          },
        ],

        // 1小时后自动终止
        activeDeadlineSeconds: parseInt(process.env.SANDBOX_TIMEOUT || '3600'),
      },
    };

    try {
      await this.k8sApi.createNamespacedPod(this.namespace, pod);

      // 等待 Pod 就绪
      await this.waitForPodReady(podName);

      console.log(`Sandbox Pod created: ${podName}`);
      return podName;
    } catch (error) {
      console.error('Failed to create sandbox pod:', error);
      throw error;
    }
  }

  /**
   * 等待 Pod 就绪
   */
  private async waitForPodReady(podName: string, timeout = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const response = await this.k8sApi.readNamespacedPodStatus(
          podName,
          this.namespace
        );

        const phase = response.body.status?.phase;

        if (phase === 'Running') {
          // 检查容器是否就绪
          const containerStatuses = response.body.status?.containerStatuses || [];
          const allReady = containerStatuses.every(cs => cs.ready);

          if (allReady) {
            return;
          }
        } else if (phase === 'Failed' || phase === 'Unknown') {
          throw new Error(`Pod entered ${phase} state`);
        }

        // 等待 1 秒后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        if (error.response?.statusCode === 404) {
          // Pod 还没创建完成，继续等待
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          throw error;
        }
      }
    }

    throw new Error(`Timeout waiting for pod ${podName} to be ready`);
  }

  /**
   * 在 Sandbox 中执行命令
   */
  async executeCommand(
    podName: string,
    command: string,
    options: {
      workingDir?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      // 构建完整命令
      let fullCommand = command;
      if (options.workingDir) {
        fullCommand = `cd ${options.workingDir} && ${command}`;
      }

      // 添加环境变量
      if (options.env) {
        const envStr = Object.entries(options.env)
          .map(([k, v]) => `export ${k}="${v}"`)
          .join(' && ');
        fullCommand = `${envStr} && ${fullCommand}`;
      }

      const cmdArray = ['sh', '-c', fullCommand];

      // 设置超时
      const timeout = options.timeout || 120000;
      const timer = setTimeout(() => {
        reject(new Error(`Command execution timeout after ${timeout}ms`));
      }, timeout);

      this.exec.exec(
        this.namespace,
        podName,
        'sandbox',
        cmdArray,
        // stdout 回调
        {
          write: (data: string) => {
            stdout += data;
          },
        } as any,
        // stderr 回调
        {
          write: (data: string) => {
            stderr += data;
          },
        } as any,
        // stdin（不需要）
        null,
        // tty
        false,
        // 状态回调
        (status: k8s.V1Status) => {
          clearTimeout(timer);

          // 解析退出码
          let exitCode = 0;
          if (status.status === 'Failure') {
            // 尝试从 message 中提取退出码
            const match = status.message?.match(/exit code (\d+)/);
            exitCode = match ? parseInt(match[1]) : 1;
          }

          resolve({ stdout, stderr, exitCode });
        }
      ).catch(error => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * 删除 Sandbox Pod
   */
  async deleteSandbox(podName: string): Promise<void> {
    try {
      await this.k8sApi.deleteNamespacedPod(
        podName,
        this.namespace,
        undefined,
        undefined,
        0,  // gracePeriodSeconds
        undefined,
        'Background'  // propagationPolicy
      );
      console.log(`Sandbox Pod deleted: ${podName}`);
    } catch (error: any) {
      if (error.response?.statusCode !== 404) {
        throw error;
      }
      // Pod 已经不存在，忽略
    }
  }

  /**
   * 清理用户的所有 Sandbox Pod
   */
  async cleanupUserSandboxes(): Promise<void> {
    try {
      const response = await this.k8sApi.listNamespacedPod(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `app=sandbox,user=${this.userId}`
      );

      const pods = response.body.items;

      for (const pod of pods) {
        if (pod.metadata?.name) {
          await this.deleteSandbox(pod.metadata.name);
        }
      }

      console.log(`Cleaned up ${pods.length} sandbox pods for user ${this.userId}`);
    } catch (error) {
      console.error('Failed to cleanup sandboxes:', error);
      throw error;
    }
  }

  /**
   * 获取 Sandbox 列表
   */
  async listSandboxes(): Promise<Array<{
    name: string;
    sessionId: string;
    status: string;
    createdAt: string;
  }>> {
    const response = await this.k8sApi.listNamespacedPod(
      this.namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      `app=sandbox,user=${this.userId}`
    );

    return response.body.items.map(pod => ({
      name: pod.metadata?.name || '',
      sessionId: pod.metadata?.labels?.session || '',
      status: pod.status?.phase || 'Unknown',
      createdAt: pod.metadata?.annotations?.['openclaw.io/created-at'] || '',
    }));
  }
}
```

### 替换原有的 Docker Sandbox

```typescript
// src/agents/sandbox/index.ts

// 原来的导出
// export { DockerSandbox } from './docker';

// 改为
export { K8sSandboxManager as Sandbox } from './k8s-sandbox';

// 或者根据环境变量选择
export function createSandbox() {
  if (process.env.SANDBOX_RUNTIME === 'kubernetes') {
    const { K8sSandboxManager } = require('./k8s-sandbox');
    return new K8sSandboxManager();
  } else {
    const { DockerSandbox } = require('./docker');
    return new DockerSandbox();
  }
}
```

---

## 🔄 完整工作流程

### 1. 用户注册流程

```
用户注册
    ↓
后端 API 服务
    ↓
┌──────────────────────────────────────────────┐
│ 创建用户资源：                                │
│ 1. 创建 Namespace: user-{userId}             │
│ 2. 创建 PVC: workspace                       │
│ 3. 创建 Secret: api-keys                     │
│ 4. 创建 ConfigMap: openclaw-config           │
│ 5. 创建 ResourceQuota: user-quota            │
│ 6. 创建 ServiceAccount: openclaw-sa          │
│ 7. 创建 Role + RoleBinding                   │
│ 8. 创建 Deployment: openclaw                 │
│ 9. 创建 Service: openclaw-svc               │
└──────────────────────────────────────────────┘
    ↓
用户的 OpenClaw 实例启动完成
```

### 2. 用户创建任务流程

```
用户发起任务（"分析这个文件"）
    ↓
你的后端服务
    ↓
路由到用户的 OpenClaw 服务
    http://openclaw-svc.user-alice.svc.cluster.local:3000
    ↓
OpenClaw 接收任务
    ↓
OpenClaw 判断需要 Sandbox 执行
    ↓
┌──────────────────────────────────────────────┐
│ OpenClaw 调用 K8s API：                       │
│ 1. 创建 Sandbox Pod                          │
│ 2. 等待 Pod Ready                            │
│ 3. kubectl exec 执行命令                     │
│ 4. 获取执行结果                              │
│ 5. 删除 Sandbox Pod（可选，或等待超时自动删除）│
└──────────────────────────────────────────────┘
    ↓
返回执行结果
    ↓
用户收到响应
```

### 3. 多会话共享 Workspace 流程

```
用户 Alice 的多个会话：

会话 1（Sandbox Pod 1）：
    echo "hello" > /workspace/greeting.txt
    ↓
    写入到 PVC: user-alice-workspace
    ↓

会话 2（Sandbox Pod 2）：
    cat /workspace/greeting.txt
    ↓
    从 PVC: user-alice-workspace 读取
    ↓
    输出: "hello"

✅ 不同会话的 Pod 共享同一个 PVC！
```

---

## 🔒 安全性设计

### 1. 多层隔离

```
┌─────────────────────────────────────────────────────────────┐
│ 第一层：Namespace 隔离                                       │
│ - 每个用户独立 Namespace                                    │
│ - 资源天然隔离                                              │
├─────────────────────────────────────────────────────────────┤
│ 第二层：RBAC 权限控制                                        │
│ - ServiceAccount 只能操作自己 Namespace 的资源               │
│ - 最小权限原则                                              │
├─────────────────────────────────────────────────────────────┤
│ 第三层：Pod 安全上下文                                       │
│ - runAsNonRoot: true                                        │
│ - readOnlyRootFilesystem: true                              │
│ - capabilities.drop: ALL                                    │
│ - allowPrivilegeEscalation: false                           │
├─────────────────────────────────────────────────────────────┤
│ 第四层：资源配额                                             │
│ - 限制 CPU、内存、Pod 数量                                   │
│ - 防止资源滥用                                              │
├─────────────────────────────────────────────────────────────┤
│ 第五层：网络策略                                             │
│ - Sandbox 默认无网络                                        │
│ - 需要时显式开放                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. Pod 安全策略（PSP/PSA）

```yaml
# K8s 1.25+ 使用 Pod Security Admission
apiVersion: v1
kind: Namespace
metadata:
  name: user-alice
  labels:
    # 强制执行受限策略
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 3. Sandbox 镜像安全

```dockerfile
# Dockerfile.sandbox
FROM debian:bookworm-slim

# 创建非 root 用户
RUN groupadd -g 1000 sandbox && \
    useradd -u 1000 -g sandbox -m sandbox

# 安装必要工具
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    python3 \
    python3-pip \
    git \
    curl \
    jq \
    ripgrep \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /workspace

# 切换到非 root 用户
USER 1000:1000

# 默认命令
CMD ["sleep", "infinity"]
```

---

## 📈 扩展性和高可用

### 1. OpenClaw 自动伸缩

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: openclaw-hpa
  namespace: user-alice
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: openclaw
  minReplicas: 1
  maxReplicas: 3
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 2. Sandbox Pod 调度优化

```yaml
# 使用 Pod 亲和性，尽量分散到不同节点
spec:
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchLabels:
                app: sandbox
            topologyKey: kubernetes.io/hostname
```

### 3. 节点池设计

```yaml
# 专门的 Sandbox 节点池
# 使用 Node Selector 或 Taints/Tolerations

# Sandbox Pod 调度到专门的节点
spec:
  nodeSelector:
    node-pool: sandbox

  tolerations:
    - key: "sandbox"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
```

---

## 📊 监控和运维

### 1. Prometheus 监控

```yaml
# servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: openclaw-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: openclaw
  namespaceSelector:
    matchNames:
      - user-alice
      - user-bob
      # 或使用 any: true 监控所有 namespace
  endpoints:
    - port: http
      path: /metrics
```

### 2. 日志收集

```yaml
# OpenClaw Pod 日志自动收集
# 使用 Fluentd/Fluent Bit DaemonSet

# 或者使用 Loki + Promtail
apiVersion: v1
kind: ConfigMap
metadata:
  name: promtail-config
data:
  promtail.yaml: |
    positions:
      filename: /tmp/positions.yaml
    clients:
      - url: http://loki:3100/loki/api/v1/push
    scrape_configs:
      - job_name: openclaw
        kubernetes_sd_configs:
          - role: pod
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            regex: openclaw|sandbox
            action: keep
```

### 3. 自动清理 CronJob

```yaml
# cleanup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sandbox-cleanup
  namespace: openclaw-system
spec:
  schedule: "*/30 * * * *"  # 每 30 分钟
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: cleanup-sa
          containers:
            - name: cleanup
              image: bitnami/kubectl:latest
              command:
                - /bin/sh
                - -c
                - |
                  # 删除超过 1 小时的 Sandbox Pod
                  kubectl get pods -A -l app=sandbox \
                    -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name} {.metadata.creationTimestamp}{"\n"}{end}' | \
                  while read line; do
                    ns_name=$(echo $line | cut -d' ' -f1)
                    created=$(echo $line | cut -d' ' -f2)
                    age=$(( $(date +%s) - $(date -d "$created" +%s) ))
                    if [ $age -gt 3600 ]; then
                      kubectl delete pod -n ${ns_name%/*} ${ns_name#*/}
                    fi
                  done
          restartPolicy: OnFailure
```

---

## 🚀 部署步骤

### 第一步：准备集群

```bash
# 1. 确保集群支持 RWX 存储
# 如果使用 AWS，安装 EFS CSI Driver
kubectl apply -k "github.com/kubernetes-sigs/aws-efs-csi-driver/deploy/kubernetes/overlays/stable/?ref=master"

# 2. 创建 StorageClass
kubectl apply -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: efs-sc
provisioner: efs.csi.aws.com
parameters:
  provisioningMode: efs-ap
  fileSystemId: fs-xxxxx
  directoryPerms: "700"
EOF
```

### 第二步：部署系统组件

```bash
# 1. 创建系统 Namespace
kubectl create namespace openclaw-system

# 2. 部署后端 API 服务
kubectl apply -f backend-deployment.yaml

# 3. 部署监控组件（可选）
kubectl apply -f monitoring/
```

### 第三步：用户 Onboarding 自动化

```typescript
// 后端 API: 创建用户资源
async function onboardUser(userId: string) {
  const namespace = `user-${userId}`;

  // 1. 创建 Namespace
  await k8sApi.createNamespace({
    metadata: { name: namespace, labels: { user: userId } }
  });

  // 2. 创建 PVC
  await k8sApi.createNamespacedPersistentVolumeClaim(namespace, {
    metadata: { name: 'workspace' },
    spec: {
      accessModes: ['ReadWriteMany'],
      storageClassName: 'efs-sc',
      resources: { requests: { storage: '10Gi' } }
    }
  });

  // 3. 创建其他资源...
  await applyYaml(namespace, 'templates/serviceaccount.yaml');
  await applyYaml(namespace, 'templates/role.yaml');
  await applyYaml(namespace, 'templates/rolebinding.yaml');
  await applyYaml(namespace, 'templates/resourcequota.yaml');
  await applyYaml(namespace, 'templates/configmap.yaml');
  await applyYaml(namespace, 'templates/deployment.yaml');
  await applyYaml(namespace, 'templates/service.yaml');

  console.log(`User ${userId} onboarded successfully`);
}
```

---

## 📊 方案对比总结

| 维度 | Docker DooD | Docker DinD | Sysbox | **K8s Pod** |
|------|-------------|-------------|--------|-------------|
| **安全性** | ⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **隔离性** | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **扩展性** | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **运维成本** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **云平台支持** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Workspace共享** | ⭐⭐（需配置） | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **实现复杂度** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **生产就绪** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 最终建议

对于你的多用户 AI 平台：

```
推荐路径：

1️⃣ MVP 阶段
   └── 用 DinD 快速验证核心功能
   └── 不要过度设计

2️⃣ 小规模上线（< 100 用户）
   └── 继续 DinD
   └── 开始准备 K8s 迁移

3️⃣ 正式生产（> 100 用户）
   └── 迁移到 K8s Pod 方案
   └── 享受 K8s 生态的所有好处：
       - 自动伸缩
       - 资源调度
       - 监控告警
       - 高可用
       - 多云部署
```

**K8s 方案的核心优势**：
- ✅ 不需要 Docker in Docker
- ✅ 原生多租户隔离
- ✅ PVC 天然支持 workspace 共享
- ✅ 资源配额和限制
- ✅ 自动伸缩
- ✅ 云平台完美支持
- ✅ 成熟的监控和运维生态

需要我进一步详细说明某个具体部分吗？比如：
1. 如何处理 Team 共享空间？
2. 如何实现用户间的权限控制？
3. 如何优化 Sandbox Pod 的启动速度？
