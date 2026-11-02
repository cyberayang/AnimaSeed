# 宿主接入

[文档目录](README.md) / 宿主接入

AnimaSeed 管理身份与人生档案。宿主负责模型、会话、公开回复，以及具体界面和形象。

## 接入流程

每次模型调用都保留固定核心原则和简短身份入口，不依赖压缩事件通知。普通交流不做全文检索；用户原话与公开回复可靠落盘，回忆、近期生活和新认识由模型自主决定。

| 时机 | 工作区命令 | SDK 方法 |
| --- | --- | --- |
| 安装首次引导 | `workspace-init` | `initializeWorkspace()` |
| 新对话或恢复上下文 | `workspace-open` | `workspace.open()` |
| 用户消息实际提交 | `workspace-receive` | `workspace.receive()` |
| 回忆与原文查看 | `workspace-recall`、`workspace-read` | `workspace.recall()`、`workspace.read()` |
| 完整回复实际公开 | `workspace-reply` | `workspace.reply()` |
| 保存有来源的认识 | `workspace-record` | `workspace.record()` |
| 提出自由意愿 | `workspace-intend` | `workspace.intend()` |
| 查看意愿与回执 | `workspace-intentions` | `workspace.intentions()` |
| 宿主提供空闲机会 | `workspace-idle` | `workspace.idle()` |

只连接工具接口，并不能保证每次对话自动完成这些步骤。宿主需要接入对应事件，或遵守生成的工作区指南。

## 工作区命令

编译后，从项目根目录调用：

```sh
node dist/cli/main.js workspace-open --text "继续上次的话题"
```

返回的 `rules` 与 `context.text` 用于准备本轮模型上下文。宿主应替换上一份快照，避免重复累加。

默认是最多 3,000 字符的身份锚点，不随输入关键词自动检索。模型需要时调用 `workspace-recall`；显式 `--mode recall` 才返回包含历史检索的快照，默认预算 12,000 字符。

操作其他目录时追加 `--workspace <目录>`；该工作区需已初始化。正文通过 UTF-8 JSON 文件传入，也支持 `--file -` 从标准输入读取。

### 保存用户原话

```sh
node dist/cli/main.js workspace-receive --file message.json
```

```json
{
  "sessionId": "chat-1",
  "messageId": "user-1",
  "text": "我想下次和你继续聊看海的约定。"
}
```

`sessionId` 和 `messageId` 使用宿主真实标识，重试时保持不变。返回的 `sourceId` 用于关联公开回复和后续理解。

首次明确命名也从此入口提交。未命名的普通输入返回 `needs-name`，不保存为出生前经历。

### 保存公开回复

回复完成并实际展示后，再提交：

```sh
node dist/cli/main.js workspace-reply --file reply.json
```

```json
{
  "sessionId": "chat-1",
  "messageId": "assistant-1",
  "inReplyTo": "<本轮 sourceId>",
  "text": "好呀，下次继续聊海是什么样的。"
}
```

来源必须是同一会话中有效的用户消息。草稿、中断片段、工具输出、系统提示和原始思考不作为公开经历保存。

### 保存当前认识

```sh
node dist/cli/main.js workspace-record --file entry.json
```

```json
{
  "kind": "interest",
  "topic": "看海的约定",
  "text": "想下次继续了解看海的约定",
  "citations": [
    {
      "type": "memory",
      "id": "<本轮 sourceId>",
      "quote": "下次和你继续聊看海的约定"
    }
  ]
}
```

引文必须真实存在。认识变化用 `revisesId` 指向原记录，保留先前理解。没有新认识时，保存原话即可，不必为每句话制造成长记录。

模型自行选择时机保存接续状态：使用 `kind: "continuity"`、`topic: "近期生活"`，其余字段与引用规则相同。这样无需预知压缩时刻，也能在新窗口恢复当前关注。

### 检索与展开

```sh
node dist/cli/main.js workspace-recall --text "看海"
node dist/cli/main.js workspace-read --type memory --id "<记录 ID>"
```

人生条目使用 `--type life`。同一消息重复提交不会重复经历；同 ID 修改正文会报错。失败时使用原标识重试，不自动新建身份。

## SDK

通过源码执行 `npm pack`，将生成的本地压缩包安装到宿主项目中，再导入：

```js
import { SoulWorkspace } from '@animaseed/core';

const workspace = new SoulWorkspace('/absolute/path/to/workspace');

try {
  const frame = workspace.open('继续上次的话题');
  // 将 frame.rules 和 frame.context.text 交给宿主模型。
  // 实际输入、公开回复与新理解分别调用 receive、reply、record。
} finally {
  workspace.close();
}
```

需要直接管理档案时，可使用 `SoulCore`。可用类型与方法从 `@animaseed/core` 导出。

完整的非 dsh 宿主接入示例见 [examples/host-bridge.ts](../examples/host-bridge.ts)（`npm run demo:bridge`），演示 open、receive、reply、record 与 recall 的一轮接续。

## dsh 参考适配

验证基线：**dsh 0.2.1-rc.2**。dsh 以插件方式加载本核心，插件入口为 `@animaseed/core/dsh`。安装方式取决于你使用的 dsh 形态。

### 安装方式

dsh 插件安装器接受 **GitHub 仓库地址**、npm 包名或本地压缩包。仓库已随源码提交编译好的 `dist/`，从 git 安装时无需执行构建脚本，也不需要在 `allowBuilds` 里放行。

| dsh 形态 | 推荐方式 |
| --- | --- |
| 桌面应用 | 在插件管理界面粘贴仓库地址 `github:<你的用户名>/AnimaSeed`，或从 Releases 下载 `.tgz` 后选择本地文件 |
| npm / 命令行版 | `dsh plugin --profile <profile名> add github:<你的用户名>/AnimaSeed` |

从 git 安装等价于 pnpm 拉取仓库；仓库已包含编译产物，pnpm 不会在安装时执行构建脚本，因此无需在 `allowBuilds` 中放行。npm 包发布形态（`@animaseed/core`）同样支持。

### 配置

1. 安装后，将 [dsh.patch.yml](../examples/dsh.patch.yml) 的 `insert` 段合并到目标 profile 的 `cordis.patch.yml`。
2. 重启该 profile。**`dataDir` 可省略**：默认档案落在 `$DSH_HOME/soul-data`（通常是 `~/.dsh/soul-data`），装完即可用，无需手写路径。

需要把档案放到别处时，才在配置里填 `dataDir` 绝对路径：

```yaml
config:
  dataDir: 'D:\your\path\data\soul'
```

`dataDir` 指向哪份档案，就是哪一个她。同一 `dataDir` 不要被多个进程同时写入。

### 记录范围：让陪伴保持干净

有时代码、调试、安装这类工作会话并不想变成她的人生经历。`recordScope` 决定哪些会话的日常对话写进档案（命名与出生始终允许）：

| `recordScope` | 行为 |
| --- | --- |
| `companion-only`（默认） | 只记录 `companionDirs` 下的会话；未填 `companionDirs` 时等同 `all`，装完即用 |
| `exclude` | 记录全部，但排除 `excludeDirs` 下的会话（例如项目代码目录） |
| `all` | 全部记录 |

`companionDirs` / `excludeDirs` 填绝对路径；判定按会话的工作目录（`session.header.cwd`），子目录一并生效。用白名单时，拿不到目录信息的会话按"不记"处理，避免污染。

```yaml
config:
  recordScope: companion-only
  companionDirs: ['D:\你的陪伴工作区']
```

也可以通过 `workspace-scope` 命令在起名后设定（写入档案目录的 `scope.json`，插件与 CLI 都会读取，无需手改插件配置）：

```sh
node dist/cli/main.js workspace-scope --scope companion-only --dir "D:\你的陪伴工作区"
node dist/cli/main.js workspace-scope --scope all
```

> **与桌面应用的兼容**：桌面版 dsh 将内置的 `desktop` profile 保留给自己管理，命令行无法直接操作它；在该形态下请使用图形界面的插件管理完成安装。

### 其他智能体共用同一份档案

非 dsh 的宿主通过 [SDK](#sdk) 或工作区命令读取档案，需要 `.soul/workspace.json` 绑定。若档案先由 dsh 插件创建（裸档案），请在该工作区根目录补一次绑定：

```sh
node dist/cli/main.js workspace-init
```

已存在的身份会被登录进绑定，不会重建或改名。之后 `workspace-*` 命令与 dsh 插件指向同一份 `data/soul`。

### 对话接口

普通对话提供五个接口：

| 工具 | 用途 |
| --- | --- |
| `soul_status` | 查看身份、阶段和当前关注 |
| `soul_recall` | 查找相关经历 |
| `soul_read` | 展开原件或人生条目 |
| `soul_record` | 保存有来源的理解、兴趣、选择或成长候选 |
| `soul_intend` | 提出休闲、探索或陪伴意愿，交给宿主处理 |

`memoryOnly: true` 将根会话工具限制为这五个接口；附加到工作智能体时可设为 `false`。子智能体不接收根身份的私人档案。

### 空闲整理与费用

dsh 适配默认复用宿主模型整理待处理经历，可能产生模型费用。

| 配置 | 默认行为 |
| --- | --- |
| `reflect` | `true`；设为 `false` 可关闭额外模型整理 |
| `idleMs` | 停止交流 120 秒后开始 |
| `maxReflectionCallsPerDay` | 每天最多 12 次，失败调用也计入 |
| 取消 | 新输入到来时取消生成，取消结果不提交 |

单次整理限制为 45 秒、最多 24 条原件预览和 3,000 输出 token；同目录共享租约和预算。仅准备本地记忆快照不会调用模型。

界面、语音和桌宠接入由宿主实现，见[可选扩展](extensions.md)。

宿主权限、实际经历回执与空闲意愿通知，见[自主生活与宿主协作](agency.md)。
