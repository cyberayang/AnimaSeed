const string = { type: 'string' };
export const SOUL_TOOLS = ['soul_status', 'soul_recall', 'soul_read', 'soul_record'];
function register(ctx, definition) {
  ctx.tools.register({ ...definition, output: { schema: string,
    render: (_args, value) => [{ type: 'text', text: value }] } });
}
const refSchema = { type: 'array', maxItems: 16, items: { type: 'object', properties: {
  type: { type: 'string', enum: ['memory', 'life'] }, id: string, quote: string,
}, required: ['type', 'id', 'quote'], additionalProperties: false } };
export function registerSoulTools(ctx, core, latestUser, rootOnly) {
  const check = exec => {
    exec.signal.throwIfAborted();
    if (!rootOnly(exec.agent)) throw new Error('子智能体不能访问此身份的私人人生档案');
  };
  register(ctx, {
    name: 'soul_status', description: '查看持续身份、命名状态、发展阶段和当前关注；不设置年龄或人格。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    async execute(_args, exec) {
      check(exec); const state = core.state();
      const short = rows => rows.slice(0, 4).map(x => ({ id: x.id, topic: x.topic, text: x.text.slice(0, 240) }));
      return JSON.stringify({ lifecycle: state.lifecycle, development: state.development,
        interests: short(state.interests), preferences: short(state.preferences), understandings: short(state.understandings), affect: state.affect });
    },
  });
  register(ctx, {
    name: 'soul_recall', description: '查找真实人生经历、公开表达和有来源的理解；无结果就承认不知道。',
    parameters: { type: 'object', properties: { query: string }, required: ['query'], additionalProperties: false },
    async execute(args, exec) { check(exec); return JSON.stringify(core.recall(args.query, 8)); },
  });
  register(ctx, {
    name: 'soul_read', description: '按ID展开人生记录或原始消息。旧理解可作为历史读取，已清除内容不可恢复。',
    parameters: { type: 'object', properties: { id: string, type: { type: 'string', enum: ['memory', 'life'] } },
      required: ['type', 'id'], additionalProperties: false },
    async execute(args, exec) {
      check(exec);
      const row = args.type === 'life' ? core.life(args.id) : core.memory(args.id);
      return JSON.stringify(row && row.status !== 'redacted' && row.status !== 'forgotten' ? row : { id: args.id, unavailable: true });
    },
  });
  register(ctx, {
    name: 'soul_record',
    description: '保存有来源的当前理解、兴趣、已公开选择、反馈或成长候选。认识变化保留revisesId；不删除记忆，不覆盖人格，不自评晋升。',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['record', 'growth-proposal'] },
      kind: { type: 'string', enum: ['understanding', 'choice', 'feedback', 'reflection', 'interest', 'preference', 'affect', 'autobiography'] },
      text: string, topic: string, citations: refSchema, revisesId: string,
      confidence: { type: 'number', minimum: 0, maximum: 0.95 },
      outcome: { type: 'string', enum: ['supported', 'uncertain', 'contradicted'] },
      interestState: { type: 'string', enum: ['open', 'resolved'] },
      affect: { type: 'object', properties: { valence: { type: 'number', minimum: -0.2, maximum: 0.2 },
        arousal: { type: 'number', minimum: 0, maximum: 0.2 }, trust: { type: 'number', minimum: -0.01, maximum: 0.01 } },
        required: ['valence', 'arousal', 'trust'], additionalProperties: false },
      domain: { type: 'string', enum: ['expression', 'memory', 'understanding', 'self', 'relationship', 'regulation'] },
      baselineId: string, learningId: string, applicationId: string, feedbackId: string, context: string,
    }, required: ['action'], additionalProperties: false },
    async execute(args, exec) {
      check(exec);
      if (!latestUser(exec.agent)) throw new Error('缺少本轮真实用户输入，不提交模型独白');
      return JSON.stringify(args.action === 'growth-proposal' ? core.proposeGrowth(args) : core.record(args));
    },
  });
}
