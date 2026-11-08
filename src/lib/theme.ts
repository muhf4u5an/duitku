export type ThemePref = 'system' | 'light' | 'dark';

let current: ThemePref = 'system';
const mq = window.matchMedia('(prefers-color-scheme: dark)');

function apply() {
  const dark = current === 'dark' || (current === 'system' && mq.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0F0F17' : '#F4F5FA');
}

mq.addEventListener('change', apply);

export function applyTheme(pref: ThemePref) {
  current = pref;
  apply();
}
