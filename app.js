'use strict';
const $ = (selector) => document.querySelector(selector);
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
};
const API = 'https://hacker-news.firebaseio.com/v0/';
const preferences = store.get('hckr-preferences', { autoRefresh: false, newTab: false, filter: 'half', defaultsVersion: 2 });
// Apply the requested defaults once to browsers that used the first release.
if (preferences.defaultsVersion !== 2) {
  preferences.filter = 'half';
  preferences.defaultsVersion = 2;
  try { localStorage.setItem('hckr-theme', 'system'); } catch {}
}
if (!['all', '10', '20', 'half', 'homepage'].includes(preferences.filter)) preferences.filter = 'half';
let stories = [], visibleDays = 3, updatedAt = null, busy = false, timer = null;
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
function updateThemeControls() {
  const theme = document.documentElement.dataset.theme;
  const dark = theme === 'dark' || (theme === 'system' && systemTheme.matches);
  $('#theme-select').value = theme;
  $('#theme-label').textContent = dark ? 'light mode' : 'dark mode';
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${dark ? 'light' : 'dark'} mode`);
  $('#theme-toggle').title = `Switch to ${dark ? 'light' : 'dark'} mode`;
  $('#theme-icon').innerHTML = dark
    ? '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>'
    : '<path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/>';
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('hckr-theme', theme); } catch {}
  updateThemeControls();
}
$('#theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme;
  setTheme(theme === 'dark' || (theme === 'system' && systemTheme.matches) ? 'light' : 'dark');
});
$('#theme-select').addEventListener('change', (e) => setTheme(e.target.value));
systemTheme.addEventListener('change', updateThemeControls);
updateThemeControls();
for (const name of ['settings', 'about']) {
  $(`#${name}-toggle`).addEventListener('click', () => {
    const opening = $(`#${name}`).hidden;
    for (const panel of ['settings', 'about']) {
      $(`#${panel}`).hidden = panel !== name || !opening;
      $(`#${panel}-toggle`).setAttribute('aria-expanded', String(panel === name && opening));
    }
  });
}
function savePreferences() { store.set('hckr-preferences', preferences); }
function setAutoRefresh(enabled) {
  preferences.autoRefresh = enabled;
  savePreferences();
  $('#auto-refresh').checked = enabled;
  $('#refresh-toggle').textContent = `auto-refresh ${enabled ? 'enabled' : 'disabled'}`;
  clearInterval(timer);
  if (enabled) timer = setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60 * 1000);
}
$('#refresh-toggle').addEventListener('click', () => setAutoRefresh(!preferences.autoRefresh));
$('#auto-refresh').addEventListener('change', (e) => setAutoRefresh(e.target.checked));
$('#new-tab').checked = Boolean(preferences.newTab);
$('#new-tab').addEventListener('change', (e) => { preferences.newTab = e.target.checked; savePreferences(); render(); });
setAutoRefresh(Boolean(preferences.autoRefresh));
function dayKey(timestamp) {
  const d = new Date(timestamp * 1000);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function safeUrl(value, fallback) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return fallback;
    if (url.hostname === 'news.ycombinator.com' && url.pathname === '/item') {
      const id = url.searchParams.get('id');
      if (/^\d+$/.test(id)) return `https://hackerweb.app/#/item/${id}`;
    }
    return url.href;
  } catch {}
  return fallback;
}
function link(href, className) {
  const a = document.createElement('a'); a.href = href; a.className = className;
  if (preferences.newTab) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}
function normalize(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(s => s && Number.isInteger(s.id) && s.id > 0 && typeof s.title === 'string' && s.title.trim() && Number.isFinite(s.time) && s.time > 0 && !s.dead && !s.deleted)
    .map(s => ({...s, score: Math.max(0, Number(s.score) || 0), descendants: Math.max(0, Number(s.descendants) || 0)}));
}
function render() {
  document.querySelectorAll('[data-filter]').forEach(button => {
    const active = button.dataset.filter === preferences.filter;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  const groups = new Map();
  for (const story of [...stories].sort((a,b) => b.time-a.time || b.id-a.id)) {
    const key = dayKey(story.time);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(story);
  }
  const fragment = document.createDocumentFragment();
  let days = 0, shown = 0;
  for (const [key, dayStories] of groups) {
    if (days++ >= visibleDays) break;
    let selected = dayStories;
    if (preferences.filter === 'homepage') selected = selected.filter(s => s.homepage);
    else if (preferences.filter !== 'all') {
      const count = preferences.filter === 'half' ? Math.ceil(dayStories.length/2) : Number(preferences.filter);
      const ids = new Set([...dayStories].sort((a,b) => b.score-a.score || b.time-a.time).slice(0,count).map(s => s.id));
      selected = dayStories.filter(s => ids.has(s.id));
    }
    if (!selected.length) continue;
    if (key !== dayKey(Date.now()/1000)) {
      const divider = document.createElement('div'); divider.className = 'day-divider';
      const h2 = document.createElement('h2');
      h2.textContent = new Date(selected[0].time * 1000).toLocaleDateString('en-US', {weekday:'short',month:'short',day:'numeric'});
      divider.append(h2); fragment.append(divider);
    }
    const section = document.createElement('section'); section.setAttribute('aria-label', key);
    let previousBlock = null;
    for (const s of selected) {
      const date = new Date(s.time * 1000);
      const block = Math.floor(date.getHours()/6)*6;
      if (previousBlock !== null && previousBlock !== block && block !== 0) {
        const marker = document.createElement('div'); marker.className='hour-marker';
        const text = document.createElement('span'); text.textContent = `${block === 12 ? 12 : block % 12}${block < 12 ? 'am' : 'pm'}`;
        marker.append(text); section.append(marker);
      }
      previousBlock = block;
      const row = document.createElement('article'); row.className = 'story';
      const discussion = `https://hackerweb.app/#/item/${s.id}`;
      const metrics = link(discussion, 'metrics');
      metrics.setAttribute('aria-label', `${s.descendants} comments, ${s.score} points: ${s.title}`);
      const comments = document.createElement('span'); comments.textContent = s.descendants;
      const points = document.createElement('span'); points.textContent = s.score; points.className = `points${s.homepage ? ' homepage' : ''}`;
      metrics.append(comments, points);
      const article = link(safeUrl(s.url, discussion), 'story-link');
      if (s.type === 'job') { const badge = document.createElement('span'); badge.className='job'; badge.textContent='JOB'; article.append(badge); }
      article.append(document.createTextNode(s.title));
      if (article.href !== discussion) {
        const source = document.createElement('span'); source.className='source';
        source.textContent = ` (${new URL(article.href).hostname.replace(/^www\./,'')})`; article.append(source);
      }
      row.append(metrics, article); section.append(row); shown++;
    }
    fragment.append(section);
  }
  $('#entries').replaceChildren(fragment);
  $('#load-more').hidden = groups.size <= visibleDays;
  if (!shown && !busy) $('#status').textContent = 'No stories match this filter.';
  if (updatedAt) {
    const date = new Date(updatedAt);
    $('#updated').textContent = `updated ${date.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
    $('#updated').title = `Last update: ${date.toLocaleString()}`;
  }
}
for (const button of document.querySelectorAll('[data-filter]')) {
  button.addEventListener('click', () => { preferences.filter = button.dataset.filter; savePreferences(); $('#status').textContent=''; render(); });
}
$('#load-more').addEventListener('click', () => { visibleDays += 3; $('#status').textContent=''; render(); });
async function getJson(url) {
  const response = await fetch(url, {cache:'no-cache', signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function loadSnapshot() {
  const data = await getJson('./data/news.json');
  const received = normalize(data.stories);
  if (!received.length) throw new Error('Empty feed');
  stories = received; updatedAt = data.updatedAt;
  store.set('hckr-feed', {stories, updatedAt});
}
async function refresh() {
  if (busy) return;
  busy = true; $('#refresh').disabled = true; $('#refresh').textContent='refreshing…';
  $('#status').textContent = ''; $('#entries').setAttribute('aria-busy','true');
  try {
    // A new deployed snapshot includes the durable chronological archive.
    try { await loadSnapshot(); } catch { if (!stories.length) throw new Error('No feed'); }
    const ids = await getJson(`${API}topstories.json`);
    if (!Array.isArray(ids) || !ids.length) throw new Error('No homepage');
    const homepage = new Set(ids.slice(0,30));
    const records = new Map(stories.map(s => [s.id, {...s, homepage:homepage.has(s.id)}]));
    const targets = [...new Set([...ids.slice(0,30), ...stories.slice(0,150).map(s=>s.id)])];
    let index = 0, successful = 0;
    await Promise.all(Array.from({length:8}, async () => {
      while (index < targets.length) {
        const id = targets[index++];
        try {
          const item = await getJson(`${API}item/${id}.json`);
          if (!item || item.deleted || item.dead) { records.delete(id); continue; }
          successful++;
          const old = records.get(id);
          if (old || homepage.has(id)) records.set(id, {...item, time:old?.time || Math.floor(Date.now()/1000), homepage:homepage.has(id)});
        } catch { /* Keep the saved record when an individual request fails. */ }
      }
    }));
    if (!successful) throw new Error('Counts unavailable');
    stories = normalize([...records.values()]); updatedAt = new Date().toISOString();
    store.set('hckr-feed', {stories, updatedAt});
  } catch {
    $('#status').textContent = stories.length ? 'Live refresh unavailable. Showing the saved feed; try refresh again.' : 'Unable to load stories. Check your connection and try refresh.';
  } finally {
    busy=false; $('#refresh').disabled=false; $('#refresh').textContent='refresh';
    $('#entries').setAttribute('aria-busy','false'); render();
  }
}
$('#refresh').addEventListener('click', refresh);
(async () => {
  busy = true;
  try { await loadSnapshot(); $('#status').textContent=''; }
  catch {
    const cached = store.get('hckr-feed', {}); stories = normalize(cached.stories); updatedAt=cached.updatedAt;
    $('#status').textContent = stories.length ? 'Offline. Showing the feed saved in this browser.' : 'Unable to load stories. Check your connection and try refresh.';
  }
  busy=false; $('#entries').setAttribute('aria-busy','false'); render();
})();
