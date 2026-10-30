/** Chinese bigrams + Latin words; no remote embedding request in the reply path. */
export function tokens(text: string): string[] {
  const input = text.normalize('NFKC').toLowerCase();
  const result: string[] = Array.from(input.match(/[a-z0-9_]{2,}/g) ?? []);
  for (const run of input.match(/[\p{Script=Han}]+/gu) ?? []) {
    if (run.length === 1) result.push(run);
    else for (let i = 0; i < run.length - 1; i++) result.push(run.slice(i, i + 2));
  }
  return [...new Set(result)].slice(0, 4000);
}
export function matchQuery(input: string): string {
  return tokens(input).slice(0, 40).map(x => `"${x}"`).join(' OR ');
}
