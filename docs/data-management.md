# 档案管理

[文档目录](README.md) / 档案管理

## 本地保存

默认人生档案位于 `data/soul/`，工作区绑定位于 `.soul/`。两者均已排除在 Git 提交之外。

数据库保存原话、来源、认识变化和成长记录。本地数据库本身未加密；加密保护用于导出档案。请妥善管理设备访问权限与备份。

以下命令从项目根目录执行。

## 查看记录

```sh
node dist/cli/main.js status
node dist/cli/main.js recall --text "要查找的经历"
node dist/cli/main.js read --type memory --id "<来源 ID>"
```

人生条目用 `--type life`。指定其他档案时，追加 `--data <目录>`。

## 加密导出

先通过你选择的方式设置环境变量 `LIFE_PASSWORD`，密码至少 12 个字符。

```sh
node dist/cli/main.js export --file ./life.memory.enc --password-env LIFE_PASSWORD
```

导出保留身份、出生记录、人生原件、认识沿革、兴趣、偏好、情绪与成长状态，以及隐私清除标记和待整理队列。

档案采用 scrypt 和 AES-256-GCM 加密。宿主模型配置、密钥与执行权限不随人生迁移。输出文件已存在时，命令会拒绝覆盖；可换一个文件名保留多份备份。

## 换电脑或换宿主

先停止旧端写入，将加密档案带到新设备，并设置相同的密码环境变量。

```sh
node dist/cli/main.js import --data ./new-workspace/data/soul --file ./life.memory.enc --password-env LIFE_PASSWORD
node dist/cli/main.js workspace-init --workspace ./new-workspace
```

目标需为尚未存有人生记录的目录。导入会校验身份、来源链与成长约束，再由工作区初始化绑定原身份。

导入不覆盖已有的人生，也不合并不同副本。不要让多台设备通过网盘同时覆盖正在使用的数据库；多端同步方案见[可选扩展](extensions.md)。

## 隐私清除

隐私管理与普通陪伴分开。先查看记录及身份 ID，确认清除范围，再运行：

```sh
node dist/cli/main.js privacy-forget --type memory --id "<来源 ID>" --confirm "<身份 ID>"
```

清除人生条目时使用 `--type life`。命令会保守清理相关来源链与衍生内容，可能影响由同一原件支持的其他认识。

同一私人词组若还独立出现在其他经历中，可明确添加匹配范围：

```sh
node dist/cli/main.js privacy-forget --type memory --id "<来源 ID>" --match "明确的私人词组" --confirm "<身份 ID>"
```

清除会处理本地正文、相关索引与衍生状态，保留不含正文的去重标记，防止同一消息再次写入。宿主聊天记录、已导出的档案和旧备份需要分别管理。

## 档案无法打开

| 提示 | 建议 |
| --- | --- |
| 档案缺失 | 找回或恢复原档案，再继续使用 |
| 身份不符 | 核对工作区绑定和档案身份，避免加载错误个体 |
| 导入失败 | 检查密码、文件完整性和目标目录是否为空 |
| 相同消息 ID 内容不同 | 检查宿主消息标识，使用原 ID 重试原内容 |

处理故障时保留原文件；工作区入口会拒绝自动重建一个替代身份。
