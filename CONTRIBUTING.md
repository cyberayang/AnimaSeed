# Contributing to AnimaSeed · 参与灵芽

欢迎通过Issue讨论问题、提供可复现案例，或通过Pull Request改进核心。中文和英文都可以。涉及产品边界的变化先说明具体使用场景。

## 本地验证

使用Node.js >=24.14.0：

```sh
npm ci --ignore-scripts
npm run check
npm run demo
```

check包括严格类型检查、生产编译、自有模块不超过300行、依赖无环、核心不依赖第三方运行时，以及行为与独立打包安装测试。新增行为应有能证明用户结果的测试；文案调整通常不需新增测试。

## 核心边界

- 核心只负责身份、人生档案、记忆、人格与情感状态、成长依据和工作区接续，不添加通用执行能力或内置模型。
- 智能体运行时、模型供应商、形象、语音和各平台接入由宿主解决。dsh适配是可选参考。
- 每个个体保留唯一身份；原话、解释和用户确认分开，有来源的理解变化保留沿革。
- 普通陪伴与独立隐私管理分开；清除过的资料不能经摘要或旧事件恢复。
- 不声称已产生意识、主观情感或完整复制人脑。阶段和情绪参数需要可解释、可测量。

## 提交与报告

使用虚构档案复现问题，不上传data、.soul、导出包、模型密钥或宿主原始对话。描述修改前后的行为、验证结果和实际限制。

不要在公开Issue粘贴私人记忆或凭据。如发现数据泄露问题，先提供不含私人正文的最小复现与受影响版本。

提交贡献表示你有权提供这些修改，并按仓库[MIT许可证](LICENSE)授权。

## English

Use Node.js >=24.14.0, install with `npm ci --ignore-scripts`, and run `npm run check`. Keep the core model-free, host-independent, and limited to memory, identity, evidence-backed development, and continuity. Host integrations and optional extensions should preserve provenance and privacy removal semantics.

Use fictional data for tests and bug reports. Describe the user-visible change, validation, and remaining limits. Do not upload personal archives, host conversations, or credentials. Contributions are made under the repository's MIT license.
