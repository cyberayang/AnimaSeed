import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import type { SoulCore } from '../src/index.ts';

export async function onboard(soul: SoulCore, ask: (prompt: string) => Promise<string>) {
  if (soul.lifecycle().phase !== 'awaiting-name') return soul.state();
  const name = (await ask('为她起一个名字（直接回车可稍后再起）：')).trim();
  if (!name) return soul.state();
  soul.name({ name, namedBy: '抚养者', sessionId: 'interactive-onboarding', messageId: crypto.randomUUID(), text: '给你起名：' + name });
  return soul.state();
}
export async function startOnboarding(soul: SoulCore): Promise<void> {
  if (soul.lifecycle().phase === 'legacy') {
    console.log('检测到旧身份，请先查看status，再用adopt-legacy明确接续。'); return;
  }
  if (soul.lifecycle().phase === 'living') {
    const state = soul.state();
    console.log(`${state.lifecycle.name}的人生档案已载入，${state.development.label}。`);
    if (state.development.bornDays !== null) console.log(`已诞生${state.development.bornDays}天，继续原来的人生。`);
    console.log('日常交流请在遵守工作区引导或SDK生命周期的智能体中继续。'); return;
  }
  console.log('一个尚未命名的人生档案，等待第一次命名。');
  if (!stdin.isTTY) throw new Error('交互命名需要终端；自动化请使用 name --name <名字> 明确确认');
  const terminal = createInterface({ input: stdin, output: stdout });
  try {
    const state = await onboard(soul, prompt => terminal.question(prompt));
    if (state.lifecycle.phase === 'living') {
      console.log(`${state.lifecycle.name}有了名字，今天刚刚诞生，处于${state.development.label}。`);
      console.log('这次命名已经保存在她的人生档案里。日常交流请在遵守工作区引导或SDK生命周期的智能体中继续。');
    } else console.log('名字可以稍后再想，下次打开会继续等待命名。');
  }
  finally { terminal.close(); }
}
