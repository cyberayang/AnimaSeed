# 参与贡献

[中文首页](README.md) · [English](README.en.md)

欢迎通过 Issue 提交问题、使用反馈，或通过 Pull Request 改进 AnimaSeed。中文和英文都可以。

## 开始开发

使用 Node.js **24.14.0 或更新版本**：

```sh
npm ci --ignore-scripts
npm run check
```

检查项与测试覆盖见[开发与测试](docs/testing.md)。涉及产品范围的变化，先描述具体使用场景。

## 保持核心聚焦

- 核心负责身份、记忆、人格与情感状态、成长依据和跨对话接续。
- 模型、执行能力、界面和形象由宿主提供，dsh 适配作为可选参考。
- 原话、模型解释和用户确认分开保存，认识变化保留来源与沿革。
- 隐私清除传播至相关衍生内容，避免旧事件或摘要恢复已清除资料。
- 对发展阶段和情绪状态保持可解释、可验证的表述。

设计说明见[记忆与成长](docs/memory-and-growth.md)和[架构说明](docs/architecture.md)。

## 提交问题与修改

使用虚构资料提供最小复现，说明预期行为、实际结果和运行环境。不要在公开 Issue 中粘贴私人记忆、密钥或宿主原始对话。

提交修改时，说明用户可见的变化和验证结果。新增行为应有对应测试，文案调整无需为实现细节增加测试。

贡献应为你有权提供的内容，并按仓库的 [MIT 许可证](LICENSE)授权。

## For English-speaking contributors

Use Node.js 24.14.0 or newer, install with `npm ci --ignore-scripts`, and run `npm run check`.

Keep the core focused on memory, identity, and evidence-backed development. Host integrations supply models, capabilities, and interfaces. Use fictional data for reproductions, describe the user-visible change, and preserve provenance and privacy-removal behavior.

Contributions are licensed under [MIT](LICENSE).
