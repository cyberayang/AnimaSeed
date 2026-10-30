import { SoulRepository } from './soul-repository.ts';
import type { SoulSnapshot } from './soul-types.ts';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
/** Engineering state projection, not a claim of subjective feelings. */
export function affectState(repo: SoulRepository, now: string): SoulSnapshot['affect'] {
  let valence = 0, arousal = 0, trust = 0.5;
  for (const row of repo.list('affect', 10000)) {
    const hours = Math.max(0, (Date.parse(now) - Date.parse(row.at)) / 3600000);
    valence += Number(row.details.valence) * Math.pow(0.5, hours / 6);
    arousal += Number(row.details.arousal) * Math.pow(0.5, hours / 3);
    trust += Number(row.details.trust) * Math.pow(0.5, hours / (90 * 24));
  }
  return { valence: clamp(valence, -1, 1), arousal: clamp(arousal, 0, 1), trust: clamp(trust, 0.2, 0.8), kind: 'simulated-state' };
}
