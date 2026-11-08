// Upload versi terbaru app ke GitHub Pages.
// Pakai: `npm run deploy`
// 1) cek kode + build dengan alamat /duitku/
// 2) isi folder dist dikirim ke branch "gh-pages" di GitHub (ditimpa tiap deploy)
// Login memakai akun GitHub CLI (`gh`), jadi tidak perlu password.
import { execSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const run = (cmd, cwd = process.cwd()) => execSync(cmd, { stdio: 'inherit', cwd });
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const remote = out('git remote get-url origin');
const auth = '-c credential.helper= -c "credential.helper=!gh auth git-credential"';

run('npx tsc --noEmit');
run('npx vite build --mode pages');

const dist = join(process.cwd(), 'dist');
writeFileSync(join(dist, '.nojekyll'), ''); // supaya GitHub tidak memproses file
rmSync(join(dist, '.git'), { recursive: true, force: true });

const name = out('git config user.name');
const email = out('git config user.email');
run('git init -q -b gh-pages', dist);
run('git add -A', dist);
run(`git -c user.name="${name}" -c user.email="${email}" commit -q -m "Deploy ${new Date().toISOString()}"`, dist);
run(`git ${auth} push -q -f ${remote} gh-pages`, dist);
rmSync(join(dist, '.git'), { recursive: true, force: true });

console.log('\nBeres! Tunggu ±1 menit lalu buka app-nya. Di iPhone, tutup-buka app untuk dapat versi baru.');
