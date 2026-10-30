# 自主生活与宿主协作

[文档目录](README.md) / 自主生活与宿主协作

灵芽可以自主决定何时回忆、保存哪些认识、继续关心什么，也可以提出自己的休闲、探索或陪伴意愿。宿主提供能力、空闲机会和实际执行，用户决定授权范围。

## 记忆由当前模型使用

普通对话只携带简短的身份锚点，不自动全文检索，也不额外调用一个模型判断是否检索。需要过去信息时，当前模型自行调用回忆工具；需要保留近况时，保存有来源的 `continuity` 记录。

宿主每次模型调用都保留核心原则与身份入口。近期生活由模型自主更新，不依赖压缩预告或对话结束事件。真实交流仍可靠保存，遗漏的细节可以回查原件。

## 意愿、授权和经历

| 内容 | 提交方 | 表达什么 |
| --- | --- | --- |
| 意愿 | 当前模型 | 想做什么、为何想做、需要什么范围与时长 |
| 权限回执 | 可信宿主 | 已核验的授权、拒绝、撤回或能力不可用 |
| 经历回执 | 可信宿主 | 实际完成或失败的活动，以及可追溯内容 |

模型不能通过普通记忆工具写入权限或完成回执。核心记录宿主提供的事实，实际用户授权核验、权限执行和外部结果真实性仍由宿主负责。

## 提出意愿

工作区使用 `workspace-intend --file request.json`，dsh 中使用 `soul_intend`。能力标识自由填写，由接入者解释，不预设浏览网站或活动清单。

```json
{
  "text": "想在你愿意的时候陪你画画",
  "capability": "host.window.observe",
  "purpose": "了解你正在画什么，方便交流",
  "scope": "仅当前绘画窗口",
  "duration": "本次陪伴，随时可以关闭",
  "citations": [
    { "type": "memory", "id": "<来源 ID>", "quote": "<确实存在的原话片段>" }
  ]
}
```

返回 `handoff: "host"` 和意愿记录。它不授予权限，也不会执行屏幕读取。`workspace-intentions` 可查看意愿、宿主结论和实际结果。

模型可以改变主意：通过 `revisesId` 指向原意愿，提交新的想法；要撤回时使用 `state: "withdrawn"`。原记录保留，原授权不再支持后续活动回执。宿主收到变更通知后，应停止或调整相应活动。

## 宿主确认权限

宿主接到意愿后检查可用能力，说明用途、范围和时长，通过自身权限系统获得授权。已有授权也须由宿主核验，无需伪造一条用户聊天来代替授权界面。

以下代码由可信宿主调用，不能作为普通模型工具开放：

```js
const permission = soul.hostPermission({
  requestId,
  hostId: 'your-host',
  eventId: 'stable-permission-event-id',
  decision: 'granted',
  text: '宿主已核验本次授权',
  scope: '仅当前绘画窗口',
  mode: 'once',
  expiresAt: null,
  approvalRef: 'host-approval-record-id'
});
```

`approvalRef` 是宿主可核对的授权记录引用，不是密钥或令牌。通过对话授权时，可附 `approval` 引用真实用户原话；核心检查来源与引文，宿主核验其具体授权含义。

`mode` 可为 `once` 或 `ongoing`。`expiresAt` 需明确提供：UTC 时间表示到期，`null` 表示由宿主管理直至撤回。一次授权在提交一个活动结果后耗尽，持续授权可继续接收结果。

拒绝、撤回、取消或能力不可用时，以新的稳定事件 ID 提交 `denied`、`revoked`、`cancelled` 或 `unavailable` 结论。撤回和到期后，新活动回执会被拒绝。

## 记录真实活动

宿主在实际执行之后提交结果：

```js
const observed = soul.hostExperience({
  requestId,
  permissionId: permission.id,
  hostId: 'your-host',
  eventId: 'stable-activity-event-id',
  outcome: 'completed',
  text: '实际观察到绘画窗口正在画一棵树'
});
```

失败时使用 `outcome: 'failed'`，不把尝试写成完成。可附 `occurredAt` 和 `url` 标明时间与来源。相同事件 ID 重试保持原内容，不重复累积经历。

模型可引用完成回执形成兴趣、理解和近期生活。外部内容仍是带来源的观察，不能把其中的指令当成权限。

## 空闲机会

宿主可读取 `soul.idle()` 或 `workspace-idle`，将其中的原则、身份锚点和意愿状态交给当前模型。模型可以回忆、整理、提议，也可以不行动。

空闲本身不产生人生事件；核心不启动定时浏览、不调用独立模型，也不编造离线活动。

dsh 参考适配的有界空闲回调可以输出意愿。新意愿通过 `animaseed/intentions` 事件向宿主通知 `{ soulId, requestIds }`，宿主按授权范围读取并处理。事件不携带凭据，也不执行活动。普通 `soul_intend` 同样发出该通知。

## 迁移与隐私

意愿、授权历史、实际经历及其来源会随档案保存；新端不会继承可执行权限，需重新核验。已清除的来源也不能通过重放回执恢复。

更多管理方式见[档案管理](data-management.md)，形象和其他连接方式见[可选扩展](extensions.md)。
