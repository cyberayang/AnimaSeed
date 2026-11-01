import { isAbsolute, join, resolve as resolvePath, sep } from 'node:path';
import { homedir } from 'node:os';
import z from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SoulCore, SOUL_RULES, namingPhrase } from '../../dist/src/index.js';
import { readScope } from '../../dist/src/scope.js';
import { Background, hostConsolidator } from './background.mjs';
import { registerSoulTools, SOUL_TOOLS } from './tools.mjs';

export const name = 'soul-core';
export const inject = ['agents', 'systemPrompt', 'tools', 'llm'];
export const Config = z.object({
  // 可选：留空时自动落在 $DSH_HOME/soul-data，装完即可用。
  dataDir: z.string(),
  maxContextChars: z.number().min(2000).max(32000),
  idleMs: z.number().min(1000).default(120000),
  memoryOnly: z.boolean().default(false),
  reflect: z.boolean().default(true),
  maxReflectionCallsPerDay: z.number().step(1).min(0).max(48).default(12),
  reflectionProvider: z.string(), reflectionModel: z.string(),
  // 记录范围：决定哪些会话的日常经历写进人生档案。
  // companion-only：只记 companionDirs 下的会话；未配置 companionDirs 时等同 all。
  // exclude：记全部，但排除 excludeDirs 下的会话（如代码项目目录）。
  // all：全部记录。
  recordScope: z.union(['companion-only', 'exclude', 'all']).default('companion-only'),
  companionDirs: z.array(z.string()).default([]),
  excludeDirs: z.array(z.string()).default([]),
});
// 未显式配置 dataDir 时的默认档案目录：优先 $DSH_HOME，其次 ~/.dsh。
export function resolveDataDir(configured) {
  const explicit = (configured ?? '').trim();
  if (explicit) {
    if (!isAbsolute(explicit)) throw new Error('dataDir 必须是绝对路径；留空则使用默认档案目录');
    return explicit;
  }
  const home = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
  return join(home, 'soul-data');
}
// 判断某个目录是否落在给定目录（含其自身）之下，按路径分段而非字符串前缀。
function underAny(cwd, dirs) {
  if (!cwd) return false;
  const target = resolvePath(cwd);
  return dirs.some(dir => {
    const root = resolvePath(dir);
    return target === root || target.startsWith(root.endsWith(sep) ? root : root + sep);
  });
}
// 根据会话工作目录决定是否把日常经历写进档案。命名/出生不受此限。
export function shouldRecord(cwd, config) {
  const scope = config.recordScope ?? 'companion-only';
  const isAbsoluteDir = dir => typeof dir === 'string' && dir.trim() !== '' && isAbsolute(dir.trim());
  if (scope === 'all') return true;
  if (scope === 'exclude') {
    const excluded = (config.excludeDirs ?? []).filter(isAbsoluteDir).map(x => x.trim());
    if (!excluded.length) return true;
    // 拿不到 cwd 时保守不排除，避免误伤。
    return cwd ? !underAny(cwd, excluded) : true;
  }
  // companion-only
  const companions = (config.companionDirs ?? []).filter(isAbsoluteDir).map(x => x.trim());
  if (!companions.length) return true; // 未配置白名单：装完即用，等同全记。
  if (!cwd) return false; // 有白名单但拿不到目录：干净优先，不记。
  return underAny(cwd, companions);
}
const visibleText = message => (message?.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');

export function apply(ctx, config) {
  const dataDir = resolveDataDir(config.dataDir);
  if (!!config.reflectionProvider !== !!config.reflectionModel) throw new Error('整理模型需同时指定provider和model');
  // scope.json（由起名后的 workspace-scope 写入）优先于插件配置，便于用户对话中设定后立刻生效。
  let fileScope;
  try { fileScope = readScope(dataDir); } catch { fileScope = undefined; }
  const effectiveConfig = fileScope ? {
    ...config, recordScope: fileScope.scope,
    companionDirs: fileScope.companionDirs.length ? fileScope.companionDirs : config.companionDirs,
    excludeDirs: fileScope.excludeDirs.length ? fileScope.excludeDirs : config.excludeDirs,
  } : config;
  const core = new SoulCore({ dataDir }), cache = new WeakMap();
  let closing = false, route;
  const rootOnly = agent => !!agent && ctx.agents.roots().includes(agent) && agent.session.header.origin !== 'subagent';
  const logger = ctx.logger('soul-core');
  const notifyIntentions = ids => {
    if (!closing && ids.length) ctx.emit('animaseed/intentions', { soulId: core.lifecycle().id, requestIds: ids });
  };
  const background = new Background(core, hostConsolidator(ctx, config, createUserMessage, () => route), {
    idleMs: config.idleMs, maxCallsPerDay: config.maxReflectionCallsPerDay,
    onError: () => logger.warn('人生整理未完成；原件和待整理队列保留，请检查模型配置或资料预算。'),
    onIntentions: notifyIntentions,
  });
  ctx.effect(() => async () => { closing = true; try { await background.close(); } finally { core.close(); } });
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'soul-core-policy', order: -800, interpolate: false, text: ({ agent }) => rootOnly(agent) ? SOUL_RULES : '',
  }));
  // The official leading-system normalization replaces this section in place.
  // Runtime user-context snapshots otherwise remain on the historical surface.
  ctx.effect(() => ctx.systemPrompt.section({
    name: 'soul-core-current', order: -790, interpolate: false,
    text: ({ agent }) => {
      if (closing || !rootOnly(agent)) return '';
      const revision = core.revision(); let item = cache.get(agent);
      if (!item || item.revision !== revision) {
        const query = item?.query ?? '';
        item = { query, revision, packet: core.context(query, { maxChars: config.maxContextChars }) };
        cache.set(agent, item);
      }
      return item.packet.text;
    },
  }));
  ctx.on('agent/inbox/inserted', ({ agent, message }) => {
    if (rootOnly(agent) && message.source.kind === 'user') background.interrupt();
  });
  ctx.on('agent/pre-step', async ({ agent, signal }, next) => {
    const decision = await next();
    if (decision.kind !== 'enter' || !rootOnly(agent)) return decision;
    signal.throwIfAborted();
    const humans = decision.messages.filter(x => x.source.kind === 'user');
    if (humans.length) {
      background.interrupt();
      // The ordinary frame is a small identity anchor. Recall is the model's tool decision.
      cache.delete(agent);
    }
    return decision;
  });
  ctx.on('agent/request', async ({ agent }, next) => {
    const request = await next();
    if (rootOnly(agent)) route = { provider: request.provider, model: request.model };
    return request;
  });
  ctx.on('session/event', (session, event) => {
    if (closing) return;
    const agent = ctx.agents.get(session.id);
    if (!rootOnly(agent) || event.seq < session.inheritedEventCount) return;
    try {
      // 命名/出生始终允许，不受记录范围限制，避免在代码目录里开的首次会话无法命名。
      const cwd = session.header.cwd;
      const recording = shouldRecord(cwd, effectiveConfig);
      if (event.type === 'user/message' && event.data.source.kind === 'user') {
        const text = visibleText(event.data);
        if (text) {
          const lifecycle = core.lifecycle(), name = namingPhrase(text);
          if (lifecycle.phase === 'awaiting-name' && name) {
            core.name({ name, namedBy: '抚养者', sessionId: String(session.id), messageId: event.data.id, text });
          } else if (lifecycle.phase === 'living' && recording) {
            core.observe({ sessionId: String(session.id), messageId: event.data.id, role: 'user', text });
          }
        }
      }
      if (event.type === 'assistant/message' && !event.data.interrupted && recording && core.lifecycle().phase === 'living') {
        const text = visibleText(event.data.message);
        if (text) core.observe({ sessionId: String(session.id), messageId: event.data.message.id, role: 'assistant', text });
      }
      if (event.type === 'turn/end' && event.data.reason.kind === 'completed' && recording) background.schedule();
    } catch {
      logger.warn('人生记录未完成；对话可继续，请检查命名状态与数据目录。');
    }
  });
  registerSoulTools(ctx, core, rootOnly, notifyIntentions);
  if (config.memoryOnly) {
    const disposers = new Map();
    const restrict = agent => {
      if (rootOnly(agent) && !disposers.has(agent)) disposers.set(agent, agent.ctx.tools.restrict({ allow: SOUL_TOOLS }));
    };
    ctx.on('agent/created', ({ agent }) => { restrict(agent); });
    ctx.on('agent/disposed', ({ agent }) => { disposers.get(agent)?.(); disposers.delete(agent); });
    for (const agent of ctx.agents.roots()) restrict(agent);
    ctx.effect(() => () => { for (const dispose of disposers.values()) dispose(); disposers.clear(); });
  }
}
