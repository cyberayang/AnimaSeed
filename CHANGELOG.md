# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。当前版本见 `package.json`。

## 未发布

### 新增

- 支持直接从仓库安装为 dsh 插件：`package.json` 增加 `prepare` 脚本，pnpm 从 git 拉取后自动构建 `dist/`，无需先手动 `npm pack`。
- 新增非 dsh 宿主接入示例 [`examples/host-bridge.ts`](examples/host-bridge.ts)（`npm run demo:bridge`），演示 open、receive、reply、record、recall 的一轮接续与跨进程身份保持。
- README 增加「作为 dsh 插件安装」路径，指向接入文档。

### 变更

- 重写 [`docs/integration.md`](docs/integration.md) 安装章节，按 dsh 形态区分桌面应用（图形插件管理 / Releases 压缩包）与 npm·命令行版（`dsh plugin add`）；补充桌面 `desktop` profile 为应用保留、命令行不可直接操作的限制；补充其他智能体共用同一档案所需的 `workspace-init` 补绑定步骤。
- [`docs/data-management.md`](docs/data-management.md) 增加档案目录说明，区分 `data/soul/`（日常）与 `data/default/`（旧版兼容入口）。
- 启动脚本与 `npm start` 通过 `--disable-warning=ExperimentalWarning` 关闭 Node 内置 SQLite 的实验特性提示，[`docs/getting-started.md`](docs/getting-started.md) 同步说明。
- `package.json` 的 `engines.dsh` 改为范围 `>=0.2.1-rc.2`，避免预发布版被精确钉死后误报不兼容。

### 验证

- `npm run check`：60 个模块、核心零第三方运行时依赖、无循环依赖、66 项测试通过。
- 在干净 clone 中端到端验证从 git 安装：`npm install` 自动触发 `tsc`，生成 `dist/`，`SoulCore` 实例化成功。
- 发布内容经 `npm pack --dry-run` 核对，仅含源码、文档与虚构示例；`data/`、`.soul/`、`*.tgz` 均被 `.gitignore` 排除。
