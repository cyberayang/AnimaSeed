# AnimaSeed · 灵芽

**From a first name, growing into a self.**

A portable core for lifelong memory, evolving personality, and identity across conversations.

[中文](README.md) · [Product vision](docs/灵魂核心产品定义.md) · [Workspace protocol](docs/工作区闭环使用.md) · [Optional extensions](docs/工作区连续性与跨工作区绑定.md) · [Contributing](CONTRIBUTING.md)

AnimaSeed stores one continuous life independently of a chat window. It starts with explicit naming, preserves actual interactions and how interpretations change, and prepares a bounded memory snapshot for the next conversation. The host agent supplies the language model, interface, and execution permissions.

This is an experimental memory and state-learning system. It does not train model weights or establish consciousness, subjective feelings, or a complete simulation of a human brain.

## Quick start

Requires Node.js **24.14.0 or newer**. The optional dsh adapter is tested against **0.2.1-rc.2**. The core runtime uses only Node.js built-ins, including SQLite.

```sh
git clone https://github.com/cyberayang/AnimaSeed.git
cd AnimaSeed
npm ci --ignore-scripts
npm run build
node dist/cli/main.js workspace-init
```

Initialization preserves existing `AGENTS.md` instructions and adds a daily-conversation guide. The private binding and host protocol live in `.soul/`; the authoritative archive lives in `data/soul`. No personal archive is included in the repository.

Open a daily conversation with an agent that can read the workspace and follow its guide. Confirm the first name with `给你起名：YourName`. Ordinary greetings do not create a birth event. You can also run `npm start` for terminal naming and status; it is not a standalone chatbot.

Development, debugging, and configuration discussions are not automatically recorded as the individual's life.

## The conversation loop

| Step | CLI command | Host responsibility |
| --- | --- | --- |
| Open or resume | `workspace-open` | Replace the previous memory snapshot with `rules` and `context.text` |
| User message committed | `workspace-receive --file request.json` | Send actual text with stable session/message IDs; explicit naming uses this entry too |
| Recall | `workspace-recall --text topic` / `workspace-read --type memory --id ID` | Retrieve relevant history and inspect original sources |
| Public reply completed | `workspace-reply --file reply.json` | Send only the actual public reply, with the received `sourceId` as `inReplyTo` |
| New interpretation | `workspace-record --file entry.json` | Preserve an evidence-backed understanding or unfinished topic |

Append `--workspace PATH` when operating outside the target workspace. JSON requests can also use `--file -` and standard input. The generated `.soul/GUIDE.md` contains exact payloads and the local executable entry.

Reopening a chat loads the same identity. A missing archive or mismatched identity produces an error instead of silently creating a new individual. Retries with stable message IDs do not duplicate experiences; a changed body under the same ID is rejected.

The host must connect these lifecycle steps. A workspace guide cannot automatically install hooks in an arbitrary closed platform. The current guide and interaction rules use Chinese; internationalized onboarding is not yet implemented.

## What the core provides

- Explicit naming, a single birth identity, and an append-only history of actual interactions.
- Evidence-backed interpretations, interests, choices, feedback, preferences, and autobiographical entries.
- Understanding revisions that preserve what was believed before and what is understood now.
- Simulated affect with bounded updates and decay; growth candidates with cross-day evidence and delayed review.
- Development stages constrained by elapsed time, distributed interaction days, and supported learning. These are engineering parameters, not validated measures of human development.
- Local full-text retrieval, source links, and bounded snapshots: normally 6,000 characters, or 12,000 for complex recall, configurable up to 32,000. Characters are not tokens.
- Encrypted full-archive migration and separate administrative privacy removal that propagates through derived records.

Offline time does not create invented experiences or suffering. A daily conversation cannot forcibly overwrite personality, reset age, or delete memories. Users retain administrative control over their own data and can stop the software.

## SDK and optional dsh adapter

```js
import { SoulCore, SOUL_RULES } from '@animaseed/core';

const soul = new SoulCore({ dataDir: '/absolute/private/soul' });
// Confirm the initial name with soul.name(...).
// Connect actual committed messages to soul.observe(...).
// Supply SOUL_RULES and soul.context(query).text to the host model.
// Record completed public replies and evidence-backed interpretations.
soul.close();
```

`SoulWorkspace` and `initializeWorkspace` expose the workspace flow as SDK APIs. The dsh reference adapter is exported at `@animaseed/core/dsh`; see [the example patch](examples/dsh.patch.yml). Set its `dataDir` to your own absolute archive path.

The adapter can reuse the host model for bounded idle reflection, which may incur provider costs. Its default is at most 12 reflection calls per day, after 120 seconds idle; `reflect: false` disables those calls. Local context preparation does not call a model. Other hosts can implement reflection through the SDK callback or record interpretations directly.

To build an installable local package:

```sh
npm run check
npm pack
```

The package is **not published to npm**. Install the generated local tarball in your host. Update imports and dsh patches from the earlier local name `@memory-core/core` to `@animaseed/core`; archive IDs and schema remain unchanged. The `animaseed` CLI also retains the `soul-core` and `memory-core` aliases.

## Privacy and migration

`data/`, `.soul/`, `.qa/`, database files, archives, credentials, and local build artifacts are ignored by Git. A fresh clone creates its own independent identity.

Encrypted export/import uses scrypt and AES-256-GCM. Passwords are read from an environment variable; provider credentials and host configuration are never part of the archive. Import requires an empty target and does not merge divergent lives. Stop the old writer before moving between machines.

Administrative privacy removal clears related local sources, indexes, and derived state while keeping empty deduplication tombstones. Host chat logs and previous backups must be managed separately. See [the Chinese management commands](README.md).

Cross-workspace binding, offline multi-device synchronization, semantic embeddings, voice, and avatar bridges remain [optional extension plans](docs/工作区连续性与跨工作区绑定.md), selected and implemented by each adopter.

## Validation

```sh
npm run check
npm run demo
```

The local Windows baseline passes 55 tests, strict TypeScript compilation, production build, and a 300-line module limit / acyclic dependency check. Tests use fictional archives and local fake models, including official dsh AgentLoop integration and isolated npm-package installation. GitHub Actions runs the same check on Windows and Linux; remote results are shown in the repository Actions tab.

Long-term interpretation quality, semantic recall across different wording, cross-model expression, and years of real use remain unvalidated. The current retrieval is full-text and source-based, not vector search.

## License

[MIT](LICENSE). The license applies to the software; this repository does not distribute personal life archives.
