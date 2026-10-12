import {normalize, utcDay, localDay, chronologic, selectStories, discussionUrl, articleUrl, mergeStories, newCommentCount, decodeTitle} from './core.mjs?v=3';
import {store, preferences, savePreferences} from './theme.mjs?v=3';

const $=selector=>document.querySelector(selector);
const API='https://hacker-news.firebaseio.com/v0/';
const baseTitle=document.title;
let stories=[], updatedAt=null, busy=true, historyLoading=false, historyFailed=false, archiveDays=[], archiveReady=false;
let pending=new Set(), loadedArchives=new Set(), viewDate=null, timer=null, observer=null;
let visitBoundary=Number(store.get('hckr-last-visit',0)) || 0, visitRecorded=visitBoundary, markerDismissed=false;
const savedRead=store.get('hckr-read',{});
const read=savedRead && typeof savedRead==='object' && !Array.isArray(savedRead) ? savedRead : {};
const filterNames={all:'all','10':'top 10','20':'top 20',half:'top 50%',homepage:'homepage'};
function status(message='') { $('#status').textContent=message; }
function historyStatus(message='') { $('#history-status').textContent=message; }
function rememberVisit() { visitRecorded=Math.floor(Date.now()/1000); store.set('hckr-last-visit',visitRecorded); }
function rememberRead(s, comments) {
  const id=String(s.id); read[id]={...read[id],articleRead:true,visitedAt:Date.now()};
  if (comments && Number.isFinite(s.descendants)) read[id].comments=s.descendants;
  store.set('hckr-read',read);
  document.querySelectorAll(`[data-story-id="${id}"]`).forEach(row=>row.classList.add('is-read'));
  if (comments) document.querySelector(`[data-story-id="${id}"] .unread`)?.remove();
}
function makeLink(href,className) {
  const a=document.createElement(href ? 'a':'span'); a.className=className;
  if (href) {
    a.href=href;
    if (preferences.newTab) { a.target='_blank'; a.rel='noopener noreferrer'; }
  }
  return a;
}
function captureAnchor() {
  const row=Array.from(document.querySelectorAll('.story')).find(el=>el.getBoundingClientRect().bottom>0);
  return row ? {id:row.dataset.storyId,top:row.getBoundingClientRect().top} : null;
}
function restoreAnchor(anchor) {
  if (!anchor) return;
  const row=document.querySelector(`[data-story-id="${anchor.id}"]`);
  if (row) window.scrollBy(0,row.getBoundingClientRect().top-anchor.top);
}
function nextArchiveDay() {
  if (!stories.length) return null;
  const oldest=utcDay(stories.reduce((min,s)=>Math.min(min,s.time),Infinity));
  return archiveDays.find(day=>day<=oldest && !loadedArchives.has(day)) || null;
}
function updateHistoryControls() {
  const canLoad=preferences.filter!=='homepage' && (nextArchiveDay() || !archiveReady);
  $('#load-more').hidden=!canLoad;
  $('#load-more').disabled=busy || historyLoading;
  $('#load-more').textContent=historyLoading ? 'loading previous day…' : historyFailed ? 'retry previous day' : 'load previous days';
  $('#history-jump').hidden=!archiveDays.length;
  $('#history-date').min=archiveDays.at(-1) || '';
  $('#history-date').max=new Date().toISOString().slice(0,10);
  $('#history-date').value ||= nextArchiveDay() || archiveDays[0] || '';
  $('#view-date').disabled=historyLoading || busy;
  $('#back-current').hidden=!viewDate;
  $('#archive-note').textContent=viewDate ? `Viewing ${viewDate}` : archiveDays.length ? `Archive: ${archiveDays.at(-1)} onward` : '';
  $('#history-end').textContent=!canLoad && preferences.filter!=='homepage' && archiveReady ? 'You’ve reached the beginning of the available archive.' : '';
}
function updateNewEntries() {
  $('#show-new').hidden=!pending.size;
  $('#show-new').textContent=`${pending.size} new ${pending.size===1 ? 'entry':'entries'}`;
  document.title=pending.size ? `(${pending.size}) ${baseTitle}` : baseTitle;
}
function render({preserveScroll=false}={}) {
  const anchor=preserveScroll ? captureAnchor() : null;
  document.querySelectorAll('[data-filter]').forEach(button=>{
    const active=button.dataset.filter===preferences.filter;
    button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
  });
  $('#mobile-filter-label').textContent=filterNames[preferences.filter];
  const visible=stories.filter(s=>!pending.has(String(s.id)));
  const selected=selectStories(visible,preferences);
  const fragment=document.createDocumentFragment();
  let previousDate=null, previousBlock=null, section=null, seenNew=false, insertedVisit=false;
  const showMarkers=['half','all'].includes(preferences.filter);
  for (const s of selected) {
    const date=localDay(s.time), d=new Date(s.time*1000), block=Math.floor(d.getHours()/6)*6;
    if (date!==previousDate) {
      if (date!==localDay(Date.now()/1000)) {
        const divider=document.createElement('div'); divider.className='day-divider';
        const h2=document.createElement('h2'); h2.textContent=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
        divider.append(h2); fragment.append(divider);
      }
      section=document.createElement('section'); section.setAttribute('aria-label',date); fragment.append(section);
      previousBlock=null; previousDate=date;
    } else if (showMarkers && previousBlock!==null && block!==previousBlock) {
      const marker=document.createElement('div'); marker.className='hour-marker';
      const text=document.createElement('span'); text.textContent=`${previousBlock===12 ? 12:previousBlock%12 || 12}${previousBlock<12 ? 'am':'pm'}`;
      marker.append(text); section.append(marker);
    }
    previousBlock=block;
    if (visitBoundary && s.time>visitBoundary) seenNew=true;
    if (showMarkers && !viewDate && !markerDismissed && !insertedVisit && seenNew && s.time<=visitBoundary) {
      const marker=document.createElement('div'); marker.className='last-visit';
      const button=document.createElement('button'); button.type='button'; button.textContent='Last Visit'; button.title='Dismiss last visit marker';
      button.addEventListener('click',()=>{ markerDismissed=true; marker.remove(); });
      marker.append(button); section.append(marker); insertedVisit=true;
    }
    const row=document.createElement('article'); row.className=`story${s.dead ? ' dead':''}${read[String(s.id)]?.articleRead ? ' is-read':''}`;
    row.dataset.storyId=s.id; row.dataset.time=s.time; row.dataset.utcDay=utcDay(s.time);
    const discussion=discussionUrl(s.id,preferences.hackerWeb);
    const metrics=makeLink(discussion,'metrics');
    if (s.type!=='job') {
      const comments=document.createElement('span'); comments.className='comments';
      const unread=preferences.newComments ? newCommentCount(s,read):0;
      if (unread>0) { const newCount=document.createElement('span'); newCount.className='unread'; newCount.textContent=`${unread} / `; comments.append(newCount); }
      comments.append(document.createTextNode(s.descendants ?? ''));
      comments.dataset.total=s.descendants ?? '';
      const points=document.createElement('span'); points.className=`points${s.homepage ? ' homepage':''}`; points.textContent=s.score || '-';
      metrics.append(comments,points);
      metrics.setAttribute('aria-label',`${s.descendants ?? 0} comments${unread ? `, ${unread} new`:''}, ${s.score} points: ${s.title}`);
      if (discussion) metrics.addEventListener('click',()=>rememberRead(s,true));
    }
    const url=articleUrl(s.url,s.id,preferences.hackerWeb);
    const article=makeLink(url,'story-link');
    article.title=new Date(s.time*1000).toLocaleString();
    if (s.dead || s.type==='job') {
      const badge=document.createElement('span'); badge.className=s.dead ? 'dead-badge':'job'; badge.textContent=s.dead ? 'DEAD':'JOB'; article.append(badge);
    }
    article.append(document.createTextNode(decodeTitle(s.title)));
    if (url && url!==discussion) {
      const source=document.createElement('span'); source.className='source'; source.textContent=` (${new URL(url).hostname})`; article.append(source);
    }
    if (url) article.addEventListener('click',()=>rememberRead(s,url===discussion));
    row.append(metrics,article); section.append(row);
  }
  $('#entries').replaceChildren(fragment);
  $('#entries').setAttribute('aria-busy',String(busy || historyLoading));
  $('#empty').hidden=selected.length>0 || busy || historyLoading;
  $('#empty').textContent=preferences.filter==='homepage' ? 'No stories currently on the homepage.' : 'No stories match these settings.';
  if (updatedAt) {
    const date=new Date(updatedAt);
    $('#updated').textContent=`updated ${date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
    $('#updated').title=`Last update: ${date.toLocaleString()}`;
  }
  updateNewEntries(); updateHistoryControls(); restoreAnchor(anchor);
}
function showNew() {
  if (!pending.size) return;
  visitBoundary=visitRecorded; markerDismissed=false; pending.clear(); rememberVisit();
  render(); window.scrollTo({top:0,behavior:'instant'});
}
$('#show-new').addEventListener('click',showNew);
$('#settings-toggle').addEventListener('click',()=>{
  const open=$('#settings').hidden; $('#settings').hidden=!open; $('#settings-toggle').setAttribute('aria-expanded',String(open));
});
$('#settings-done').addEventListener('click',()=>{ $('#settings').hidden=true; $('#settings-toggle').setAttribute('aria-expanded','false'); });
for (const [id,key] of [['new-tab','newTab'],['hackerweb','hackerWeb'],['show-dead','showDead'],['new-comments','newComments']]) {
  $(`#${id}`).checked=Boolean(preferences[key]);
  $(`#${id}`).addEventListener('change',e=>{ preferences[key]=e.target.checked; savePreferences(); render({preserveScroll:true}); });
}
function setAutoRefresh(enabled) {
  preferences.autoRefresh=enabled; savePreferences(); $('#auto-refresh').checked=enabled;
  $('#refresh-toggle').textContent=`auto-refresh ${enabled ? 'enabled':'disabled'}`;
  clearInterval(timer);
  if (enabled) timer=setInterval(()=>{ if (!document.hidden && !viewDate) refresh({automatic:true}); },5*60*1000);
}
$('#refresh-toggle').addEventListener('click',()=>setAutoRefresh(!preferences.autoRefresh));
$('#auto-refresh').addEventListener('change',e=>setAutoRefresh(e.target.checked));
setAutoRefresh(Boolean(preferences.autoRefresh));
$('#mobile-filter-toggle').addEventListener('click',()=>{
  const expanded=$('#mobile-filter-toggle').getAttribute('aria-expanded')!=='true';
  $('#mobile-filter-toggle').setAttribute('aria-expanded',String(expanded)); $('#filter-options').classList.toggle('expanded',expanded);
});
for (const button of document.querySelectorAll('[data-filter]')) button.addEventListener('click',()=>{
  preferences.filter=button.dataset.filter; savePreferences();
  $('#mobile-filter-toggle').setAttribute('aria-expanded','false'); $('#filter-options').classList.remove('expanded');
  render(); watchHistory();
});
async function getJson(url) {
  const response=await fetch(url,{cache:'no-cache',signal:AbortSignal.timeout(20000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function loadArchiveIndex() {
  const index=await getJson('./data/archive-index.json');
  if (!Array.isArray(index.days)) throw new Error('Invalid archive index');
  archiveDays=index.days.filter(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)).sort().reverse(); archiveReady=true;
}
function cacheCurrent() { store.set('hckr-feed',{stories:stories.slice(0,350),updatedAt}); }
async function snapshot() {
  const data=await getJson('./data/news.json'); const received=normalize(data.stories);
  if (!received.length) throw new Error('Empty feed');
  updatedAt=data.updatedAt; return received;
}
function watchHistory() {
  if (!observer) return;
  observer.disconnect();
  if (nextArchiveDay() && !busy && !historyFailed && !document.activeElement?.closest('#history-jump') && preferences.filter!=='homepage') observer.observe($('#history-sentinel'));
}
async function loadPreviousDay() {
  if (busy || historyLoading) return;
  historyLoading=true; historyFailed=false; updateHistoryControls();
  try {
    if (!archiveReady) await loadArchiveIndex();
    const day=nextArchiveDay(); if (!day) return;
    const received=normalize(await getJson(`./data/archive/${day}.json`));
    loadedArchives.add(day);
    // An archive may complete the earliest day of the active feed. Its final
    // records must not overwrite fresher homepage flags or current counts.
    stories=mergeStories(received,stories); historyStatus(); render({preserveScroll:true});
  } catch { historyFailed=true; historyStatus('Unable to load the previous day. Use retry to try again.'); }
  finally { historyLoading=false; render({preserveScroll:true}); watchHistory(); }
}
$('#load-more').addEventListener('click',loadPreviousDay);
async function goToDate(day) {
  if (busy || historyLoading || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  historyLoading=true; updateHistoryControls();
  try {
    if (!archiveReady) await loadArchiveIndex();
    let received;
    if (archiveDays.includes(day)) received=normalize(await getJson(`./data/archive/${day}.json`));
    else received=normalize(await snapshot()).filter(s=>utcDay(s.time)===day);
    if (!received.length) { historyStatus('No archived stories are available for that date.'); return; }
    stories=received; pending.clear(); loadedArchives=new Set(archiveDays.includes(day) ? [day]:[]); viewDate=day; historyFailed=false;
    const url=new URL(location.href); url.searchParams.set('date',day); history.replaceState(null,'',url); status(); historyStatus();
    window.scrollTo({top:0,behavior:'instant'});
  } catch { historyStatus('Unable to open that date. Try again.'); }
  finally { historyLoading=false; render(); watchHistory(); }
}
$('#history-jump').addEventListener('focusin',()=>observer?.disconnect());
$('#history-jump').addEventListener('focusout',()=>queueMicrotask(watchHistory));
$('#history-jump').addEventListener('submit',e=>{ e.preventDefault(); goToDate($('#history-date').value); });
$('#back-current').addEventListener('click',()=>refresh());
function acceptFeed(next, automatic, before) {
  stories=normalize(next).sort(chronologic);
  if (automatic) {
    for (const s of stories) if (!before.has(String(s.id))) pending.add(String(s.id));
  } else {
    if (viewDate) {
      loadedArchives.clear(); viewDate=null;
      const url=new URL(location.href); url.searchParams.delete('date'); history.replaceState(null,'',url);
    }
    visitBoundary=visitRecorded; markerDismissed=false; pending.clear(); rememberVisit();
  }
  cacheCurrent();
}
async function refresh({automatic=false}={}) {
  if (busy || historyLoading) return;
  busy=true; $('#refresh').disabled=true; $('#refresh').textContent='refreshing…'; status();
  const before=new Set(stories.map(s=>String(s.id)));
  const anchor=captureAnchor();
  let fallbackFeed=null;
  try {
    let received;
    try { received=await snapshot(); } catch { if (!stories.length) throw new Error('No feed'); received=stories; }
    const base=automatic || !viewDate ? mergeStories(stories,received) : received;
    fallbackFeed=base;
    const ids=await getJson(`${API}topstories.json`);
    if (!Array.isArray(ids) || !ids.length) throw new Error('No homepage');
    const homepage=new Set(ids.slice(0,30).map(String));
    const records=new Map(base.map(s=>[String(s.id),{...s,homepage:homepage.has(String(s.id))}]));
    const targets=[...new Set([...ids.slice(0,30),...received.slice(0,180).filter(s=>/^\d+$/.test(String(s.id))).map(s=>s.id)])];
    let index=0, successful=0;
    await Promise.all(Array.from({length:8},async()=>{
      while (index<targets.length) {
        const id=targets[index++];
        try {
          const item=await getJson(`${API}item/${id}.json`); if (!item) continue;
          successful++; const old=records.get(String(id));
          if (item.deleted || item.dead) {
            if (old) records.set(String(id),{...old,dead:true,homepage:false,score:item.score ?? old.score,descendants:item.descendants ?? old.descendants});
          } else if (old || homepage.has(String(id))) records.set(String(id),{...item,title:decodeTitle(item.title || old?.title || 'Untitled story'),time:old?.time || Math.floor(Date.now()/1000),homepage:homepage.has(String(id))});
        } catch { /* Retain this item's last known values on a partial failure. */ }
      }
    }));
    if (!successful) throw new Error('Counts unavailable');
    updatedAt=new Date().toISOString();
    acceptFeed([...records.values()],automatic,before);
  } catch {
    if (fallbackFeed) acceptFeed(fallbackFeed,automatic,before);
    status(stories.length ? 'Live refresh unavailable. Showing the saved feed; try refresh again.' : 'Unable to load stories. Check your connection and try refresh.');
  }
  finally {
    busy=false; $('#refresh').disabled=false; $('#refresh').textContent='refresh'; render();
    if (automatic) restoreAnchor(anchor); watchHistory();
  }
}
$('#refresh').addEventListener('click',()=>refresh());
if ('IntersectionObserver' in window) observer=new IntersectionObserver(entries=>{
  if (entries.some(e=>e.isIntersecting) && !busy && !historyLoading && !historyFailed && preferences.filter!=='homepage') loadPreviousDay();
},{rootMargin:'100px'});
(async()=>{
  const results=await Promise.allSettled([snapshot(),loadArchiveIndex()]);
  if (results[0].status==='fulfilled') { stories=results[0].value; cacheCurrent(); status(); rememberVisit(); }
  else {
    const cached=store.get('hckr-feed',{}); stories=normalize(cached.stories); updatedAt=cached.updatedAt;
    status(stories.length ? 'Offline. Showing the feed saved in this browser.' : 'Unable to load stories. Check your connection and try refresh.');
  }
  busy=false; render();
  if (location.hash==='#settings') { $('#settings').hidden=false; $('#settings-toggle').setAttribute('aria-expanded','true'); }
  const date=new URL(location.href).searchParams.get('date');
  if (date) await goToDate(date);
  watchHistory();
})();
