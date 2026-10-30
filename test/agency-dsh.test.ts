import test from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { LlmAdapter, ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm';
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } from '@deepseek-ai/dsh-agent-loop-testkit';
import * as plugin from '../adapters/dsh/plugin.mjs';
import { SoulCore } from '../src/index.ts';
import { directory } from './helpers.ts';

declare module '@deepseek-ai/cordis' {
  interface Events { 'animaseed/intentions'(event: { soulId: string; requestIds: string[] }): void }
}
class ChoosingAdapter extends LlmAdapter {
  requests: GenerateOptions[] = [];
  readonly sourceId: string;
  constructor(sourceId: string) { super(); this.sourceId = sourceId; }
  async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.requests.push(options);
    const last = options.messages.at(-1), text = last?.content.filter(x => x.type === 'text').map(x => x.text).join('') ?? '';
    let name: string | undefined, args: unknown;
    if (last?.role !== 'tool' && text.includes('回忆')) { name = 'soul_recall'; args = { query: '旧约定' }; }
    if (last?.role !== 'tool' && text.includes('想休闲')) {
      name = 'soul_intend'; args = { text: '想看一段摄影视频', capability: 'host.video', purpose: '探索自己的兴趣', scope: '公开摄影视频', duration: '一次',
        citations: [{ type: 'memory', id: this.sourceId, quote: '我们聊过摄影和旧约定：敲三下窗户。' }] };
    }
    if (name) {
      const id = ToolCallId('fictional-' + this.requests.length);
      yield { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: JSON.stringify(args) };
      yield { type: 'finish', reason: { kind: 'tool-calls' } }; return;
    }
    yield { type: 'text-delta', index: 0, text: last?.role === 'tool' ? '已经收到资料或提出意愿，实际权限交给宿主处理。' : '你好，今天想聊什么？' };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}
test('正式AgentLoop中普通交流不查旧事，模型按需调用回忆，并将自由意愿交给宿主', async t => {
  const dataDir = directory(t), core = new SoulCore({ dataDir }), ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); core.close(); });
  core.name({ name: '小禾', namedBy: '测试者', sessionId: 'past', messageId: 'birth', text: '给你起名：小禾' });
  const source = core.observe({ sessionId: 'past', messageId: '1', role: 'user', text: '我们聊过摄影和旧约定：敲三下窗户。' });
  const adapter = new ChoosingAdapter(source.id), notifications: string[] = [];
  await mountAgentLoopTestDependencies(ctx); ctx.llm.registerAdapter(['choosing'], adapter);
  ctx.on('animaseed/intentions', event => { assert.equal(event.soulId, core.lifecycle().id); notifications.push(...event.requestIds); });
  await ctx.plugin(plugin, { dataDir, memoryOnly: true, reflect: false });
  const harness = await mountAgentLoopTestHarness(ctx);
  const agent = await harness.create(SessionId('choosing-chat'), { provider: 'choosing', model: 'fake' });
  const human = (text: string) => createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text }] });
  agent.followup(human('你好')); await agent.whenIdle();
  assert.equal(adapter.requests.length, 1); assert(!JSON.stringify(adapter.requests[0]).includes('敲三下窗户'));
  agent.followup(human('回忆一下旧约定')); await agent.whenIdle();
  assert.equal(adapter.requests.length, 3);
  assert(!JSON.stringify(adapter.requests[1]).includes('敲三下窗户'));
  assert(JSON.stringify(adapter.requests[2]).includes('敲三下窗户'));
  agent.followup(human('现在可以想休闲的事')); await agent.whenIdle();
  assert.equal(core.intentions()[0].intention.text, '想看一段摄影视频');
  assert.equal(core.intentions()[0].authorization, 'needed');
  assert.deepEqual(notifications, [core.intentions()[0].intention.id]);
  assert.equal(core.timeline().filter(x => x.kind === 'experience').length, 0);
  assert(!ctx.tools.schemas().some(x => /grant|host_permission|host_experience/u.test(x.name)));
});
