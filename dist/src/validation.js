import { KINDS, TRAITS } from './types.js';
export function object(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('预期 JSON 对象');
    return value;
}
export function text(value, label, max = 16000) {
    if (typeof value !== 'string' || !value.trim() || value.length > max)
        throw new Error(`${label}为空或超过${max}字符`);
    return value;
}
export function number(value, min, max, label = '数值') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
        throw new Error(`${label}应在${min}至${max}之间`);
    return value;
}
export function date(value) {
    const result = text(value, '时间', 40);
    if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result)
        throw new Error('时间必须是 UTC ISO 格式');
    return result;
}
export function list(value, max = 32) {
    if (!Array.isArray(value) || value.length > max)
        throw new Error('数组格式或大小不正确');
    return value;
}
export function citations(value) {
    const result = list(value, 16).map(item => {
        const row = object(item);
        return { id: text(row.id, '来源ID', 200), quote: text(row.quote, '证据原文', 2000) };
    });
    if (!result.length || new Set(result.map(x => x.id)).size !== result.length)
        throw new Error('需要不重复的证据来源');
    return result;
}
export function derived(value) {
    const row = object(value);
    if (!KINDS.includes(row.kind) || row.kind === 'episode')
        throw new Error('整理不能制造原始经历');
    return {
        kind: row.kind, text: text(row.text, '记忆内容', 4000),
        citations: citations(row.citations), key: row.key === undefined ? undefined : text(row.key, '语义键', 160),
        importance: number(row.importance ?? 0.6, 0, 1), confidence: number(row.confidence ?? 0.7, 0, 1),
        entities: list(row.entities ?? [], 12).map(x => text(x, '关联实体', 80)),
        expiresAt: row.expiresAt === undefined ? undefined : date(row.expiresAt),
        pinned: row.pinned === true,
    };
}
export function trait(value) {
    if (!TRAITS.includes(value))
        throw new Error('未知人格维度');
    return value;
}
export function identity(value) {
    const row = object(value), baseline = object(row.baseline);
    return {
        id: text(row.id, '身份ID', 100), name: text(row.name, '名字', 80), createdAt: date(row.createdAt),
        principles: list(row.principles, 12).map(x => text(x, '原则', 500)),
        baseline: Object.fromEntries(TRAITS.map(key => [key, number(baseline[key], 0, 1)])),
    };
}
export function memory(value) {
    const row = object(value);
    if (!KINDS.includes(row.kind))
        throw new Error('未知记忆类别');
    if (!['active', 'superseded', 'forgotten', 'expired'].includes(String(row.status)))
        throw new Error('未知记忆状态');
    if (!['user', 'assistant', 'derived'].includes(String(row.role)))
        throw new Error('未知记录角色');
    const result = {
        id: text(row.id, '记忆ID', 100), kind: row.kind, status: row.status,
        text: row.status === 'forgotten' ? '' : text(row.text, '记忆内容'), at: date(row.at), role: row.role,
        sessionId: row.sessionId === null ? null : text(row.sessionId, '会话ID', 200),
        externalKey: row.externalKey === null ? null : text(row.externalKey, '外部去重键', 500),
        key: row.key === null ? null : text(row.key, '语义键', 160),
        citations: row.status === 'forgotten' || row.kind === 'episode' ? [] : citations(row.citations),
        importance: number(row.importance, 0, 1), confidence: number(row.confidence, 0, 1),
        entities: list(row.entities, 12).map(x => text(x, '关联实体', 80)),
        expiresAt: row.expiresAt === null ? null : date(row.expiresAt), pinned: row.pinned === true,
    };
    if (result.kind === 'episode' ? result.role === 'derived' : result.role !== 'derived')
        throw new Error('来源角色与记忆类别冲突');
    if (result.status === 'forgotten') {
        result.entities = [];
        result.key = null;
        result.importance = 0;
        result.confidence = 0;
    }
    return result;
}
