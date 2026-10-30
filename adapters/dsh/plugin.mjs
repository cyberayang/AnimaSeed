import { isAbsolute } from 'node:path';
import z from '@deepseek-ai/schemastery';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SoulCore, SOUL_RULES, namingPhrase } from '../../dist/src/index.js';
import { Background, hostConsolidator } from './background.mjs';
import { registerSoulTools, SOUL_TOOLS } from './tools.mjs';

export const name = 'soul-core';
export const inject = ['agents', 'systemPrompt', 'tools', 'llm'];
export const Config = z.object({
  dataDir: z.string().required(),
  maxContextChars: z.number().min(2000).max(32000),
  idleMs: z.number().min(1000).default(120000),
  memoryOnly: z.boolean().default(false),
  reflect: z.boolean().default(true),
  maxReflectionCallsPerDay: z.number().step(1).min(0).max(48).default(12),
  reflectionProvider: z.string(), reflectionModel: z.string(),
});
const visibleText = message => (message?.content ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');

export function apply(ctx, config) {
  if (!isAbsolute(config.dataDir)) throw new Error('dataDir必须是独立的绝对路径');
  if (!!config.reflectionProvider !== !!config.reflectionModel) throw new Error('整理模型需同时指定provider和model');
  const core = new SoulCore({ dataDir: config.dataDir }), cache = new WeakMap();
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
      if (event.type === 'user/message' && event.data.source.kind === 'user') {
        const text = visibleText(event.data);
        if (text) {
          const lifecycle = core.lifecycle(), name = namingPhrase(text);
          if (lifecycle.phase === 'awaiting-name' && name) {
            core.name({ name, namedBy: '抚养者', sessionId: String(session.id), messageId: event.data.id, text });
          } else if (lifecycle.phase === 'living') {
            core.observe({ sessionId: String(session.id), messageId: event.data.id, role: 'user', text });
          }
        }
      }
      if (event.type === 'assistant/message' && !event.data.interrupted && core.lifecycle().phase === 'living') {
        const text = visibleText(event.data.message);
        if (text) core.observe({ sessionId: String(session.id), messageId: event.data.message.id, role: 'assistant', text });
      }
      if (event.type === 'turn/end' && event.data.reason.kind === 'completed') background.schedule();
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
