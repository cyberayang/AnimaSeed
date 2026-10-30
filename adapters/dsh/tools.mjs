const string = { type: 'string' };
export const SOUL_TOOLS = ['soul_status', 'soul_recall', 'soul_read', 'soul_record', 'soul_intend'];
function register(ctx, definition) {
  ctx.tools.register({ ...definition, output: { schema: string,
    render: (_args, value) => [{ type: 'text', text: value }] } });
}
const refSchema = { type: 'array', maxItems: 16, items: { type: 'object', properties: {
  type: { type: 'string', enum: ['memory', 'life'] }, id: string, quote: string,
}, required: ['type', 'id', 'quote'], additionalProperties: false } };
export function registerSoulTools(ctx, core, rootOnly, onIntentions = () => {}) {
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
        interests: short(state.interests), preferences: short(state.preferences), understandings: short(state.understandings), affect: state.affect,
        intentions: core.intentions(4).map(x => ({ id: x.intention.id, text: x.intention.text.slice(0, 240), authorization: x.authorization,
          lastOutcome: x.experience?.details.outcome ?? null })) });
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
    description: '自主保存有来源的认识、兴趣、近期生活continuity、实际选择或成长候选。不必每轮整理；认识变化保留revisesId。',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['record', 'growth-proposal'] },
      kind: { type: 'string', enum: ['understanding', 'choice', 'feedback', 'reflection', 'interest', 'preference', 'affect', 'autobiography', 'continuity'] },
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
      return JSON.stringify(args.action === 'growth-proposal' ? core.proposeGrowth(args) : core.record(args));
    },
  });
  register(ctx, {
    name: 'soul_intend', description: '自主提出休闲、探索或陪伴意愿及所需能力；可用revisesId修正，state:withdrawn撤回。宿主解决连接与用户授权，此接口不授权或执行。',
    parameters: { type: 'object', properties: { text: string, capability: string, purpose: string, scope: string, duration: string, citations: refSchema,
      revisesId: string, state: { type: 'string', enum: ['open', 'withdrawn'] } },
      required: ['text', 'capability', 'purpose', 'scope', 'duration', 'citations'], additionalProperties: false },
    async execute(args, exec) {
      check(exec); const intention = core.intend(args); onIntentions([intention.id]);
      return JSON.stringify({ intention, handoff: 'host', permissionGranted: false });
    },
  });
}
