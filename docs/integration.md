# 宿主接入

[文档目录](README.md) / 宿主接入

AnimaSeed 管理身份与人生档案。宿主负责模型、会话、公开回复，以及具体界面和形象。

## 接入流程

每次新对话或上下文压缩后，重新读取当前记忆；用户原话提交后保存输入，完整回复实际展示后保存回复。值得延续的新认识由宿主模型提出，并附上真实来源。

| 时机 | 工作区命令 | SDK 方法 |
| --- | --- | --- |
| 安装首次引导 | `workspace-init` | `initializeWorkspace()` |
| 新对话或恢复上下文 | `workspace-open` | `workspace.open()` |
| 用户消息实际提交 | `workspace-receive` | `workspace.receive()` |
| 回忆与原文查看 | `workspace-recall`、`workspace-read` | `workspace.recall()`、`workspace.read()` |
| 完整回复实际公开 | `workspace-reply` | `workspace.reply()` |
| 保存有来源的认识 | `workspace-record` | `workspace.record()` |

只连接工具接口，并不能保证每次对话自动完成这些步骤。宿主需要接入对应事件，或遵守生成的工作区指南。

## 工作区命令

编译后，从项目根目录调用：

```sh
node dist/cli/main.js workspace-open --text "继续上次的话题"
```

返回的 `rules` 与 `context.text` 用于准备本轮模型上下文。宿主应替换上一份快照，避免重复累加。

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

## dsh 参考适配

验证基线：**dsh 0.2.1-rc.2**。

1. 在核心项目运行 `npm pack`。
2. 通过 dsh 插件管理安装生成的本地压缩包。
3. 将 [dsh.patch.yml](../examples/dsh.patch.yml) 合并到目标 profile 的 `cordis.patch.yml`。
4. 将 `dataDir` 改为自己人生档案的绝对路径，重启该 profile。

```sh
dsh plugin --profile <profile名称> add <压缩包的绝对路径>
```

插件入口为 `@animaseed/core/dsh`。普通对话提供四个接口：

| 工具 | 用途 |
| --- | --- |
| `soul_status` | 查看身份、阶段和当前关注 |
| `soul_recall` | 查找相关经历 |
| `soul_read` | 展开原件或人生条目 |
| `soul_record` | 保存有来源的理解、兴趣、选择或成长候选 |

`memoryOnly: true` 将根会话工具限制为这四个接口；附加到工作智能体时可设为 `false`。子智能体不接收根身份的私人档案。

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
