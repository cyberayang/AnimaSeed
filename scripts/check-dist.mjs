// 校验仓库提交的 dist/ 与源码构建结果一致，防止发布过期的编译产物。
// 前提：调用方已执行 `npm run build`。用 git 判断 dist 是否有未提交改动。
import { execFileSync } from 'node:child_process';

function git(args) {
  return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}
let tracked;
try {
  git(['rev-parse', '--is-inside-work-tree']);
  tracked = git(['ls-files', 'dist']).trim().length > 0;
} catch {
  console.log('dist 校验跳过：不在 git 工作区。');
  process.exit(0);
}
if (!tracked) {
  console.log('dist 校验跳过：dist/ 尚未纳入版本控制。');
  process.exit(0);
}
// 只看工作区相对索引（已暂存/已提交）的差异：构建若产生与版本库不同的产物，git diff 非空。
const dirty = git(['diff', '--', 'dist']).trim();
if (dirty) {
  console.error('dist/ 与源码构建结果不一致，请运行 npm run build 并提交 dist 改动：');
  console.error(dirty);
  process.exit(1);
}
console.log('dist 校验通过：提交的编译产物与源码一致。');
