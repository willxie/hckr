import {DEFAULTS} from './core.mjs?v=5';
export const store={
  get(key,fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch {} }
};
const saved=store.get('hckr-preferences',{});
export const preferences={...DEFAULTS,...(saved && typeof saved==='object' && !Array.isArray(saved) ? saved : {})};
if (saved?.defaultsVersion!==2) {
  preferences.filter='half'; preferences.defaultsVersion=2;
  document.documentElement.dataset.theme='system';
  try { localStorage.setItem('hckr-theme','system'); } catch {}
}
if (!['all','10','20','half','homepage'].includes(preferences.filter)) preferences.filter='half';
export const savePreferences=()=>store.set('hckr-preferences',preferences);
savePreferences();
const systemTheme=window.matchMedia('(prefers-color-scheme: dark)');
const $=selector=>document.querySelector(selector);
function updateControls() {
  const theme=document.documentElement.dataset.theme;
  const dark=theme==='dark' || (theme==='system' && systemTheme.matches);
  if ($('#theme-select')) $('#theme-select').value=theme;
  if ($('#theme-label')) $('#theme-label').textContent=dark ? 'light mode' : 'dark mode';
  if ($('#theme-toggle')) {
    $('#theme-toggle').setAttribute('aria-label',`Switch to ${dark ? 'light':'dark'} mode`);
    $('#theme-toggle').title=`Switch to ${dark ? 'light':'dark'} mode`;
  }
  if ($('#theme-icon')) $('#theme-icon').innerHTML=dark
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
    : '<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>';
}
function setTheme(theme) {
  document.documentElement.dataset.theme=theme;
  try { localStorage.setItem('hckr-theme',theme); } catch {}
  updateControls();
}
function restoreTheme() {
  try {
    const theme=localStorage.getItem('hckr-theme');
    document.documentElement.dataset.theme=['system','light','dark'].includes(theme) ? theme : 'system';
    updateControls();
  } catch { /* Keep the current appearance if storage is unavailable. */ }
}
window.addEventListener('pageshow',event=>{ if (event.persisted) restoreTheme(); });
window.addEventListener('storage',event=>{ if (event.key==='hckr-theme') restoreTheme(); });
$('#theme-toggle')?.addEventListener('click',()=>{
  const theme=document.documentElement.dataset.theme;
  setTheme(theme==='dark' || (theme==='system' && systemTheme.matches) ? 'light':'dark');
});
$('#theme-select')?.addEventListener('change',e=>setTheme(e.target.value));
systemTheme.addEventListener('change',updateControls);
updateControls();
