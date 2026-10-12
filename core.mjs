export const DEFAULTS = {autoRefresh:false, newTab:false, hackerWeb:true, showDead:true, newComments:true, filter:'half', defaultsVersion:2};
export function validId(id) { return /^\d+$/.test(String(id)) || /^[a-f0-9]{40}$/.test(String(id)); }
export function normalize(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(s=>s && validId(s.id) && typeof s.title==='string' && Number.isFinite(s.time) && s.time>0)
    .map(s=>({...s, title:s.title.trim() && s.title!=='undefined' ? s.title.trim() : 'Removed story',
      score:Math.max(0,Number(s.score)||0), descendants:s.descendants==null ? null : Math.max(0,Number(s.descendants)||0),
      dead:Boolean(s.dead || s.deleted), type:s.type || 'story'}));
}
export const utcDay = timestamp => new Date(timestamp*1000).toISOString().slice(0,10);
export const localDay = timestamp => {
  const d=new Date(timestamp*1000);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const chronologic = (a,b) => b.time-a.time;
export function scoreThreshold(stories, filter) {
  if (!stories.length) return 1;
  const times=stories.map(s=>s.time);
  // Match hckr news: scale the daily target to the rounded time span and
  // include all ties at the cutoff, including on a partially elapsed day.
  const first=Math.min(...times), last=Math.max(...times);
  const offset=(new Date(last*1000).getTimezoneOffset()-new Date(first*1000).getTimezoneOffset())*60;
  const hours=Math.round((last-first-offset)/3600);
  const target=filter==='half' ? Math.floor(stories.length/2) : Number(filter);
  const count=Math.ceil(hours/24*target);
  const ranked=[...stories].sort((a,b)=>b.score-a.score);
  return (count>=ranked.length ? ranked.at(-1)?.score : ranked[count-1]?.score) || 1;
}
export function selectStories(stories, preferences) {
  const groups=new Map();
  for (const s of stories) {
    const key=utcDay(s.time);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(s);
  }
  const selected=[];
  for (const group of groups.values()) {
    const threshold=scoreThreshold(group,preferences.filter);
    selected.push(...group.filter(s=>(preferences.showDead || !s.dead) && (
      preferences.filter==='all' || (preferences.filter==='homepage' ? s.homepage : s.score>=threshold))));
  }
  return selected.sort(chronologic);
}
export function discussionUrl(id, hackerWeb=true) {
  if (!/^\d+$/.test(String(id))) return null;
  return hackerWeb ? `https://hackerweb.app/#/item/${id}` : `https://news.ycombinator.com/item?id=${id}`;
}
export function articleUrl(value, id, hackerWeb=true) {
  const fallback=discussionUrl(id,hackerWeb);
  try {
    const url=new URL(value);
    if (!['http:','https:'].includes(url.protocol)) return fallback;
    if (url.hostname==='news.ycombinator.com' && url.pathname==='/item') return discussionUrl(url.searchParams.get('id') || id,hackerWeb);
    return url.href;
  } catch { return fallback; }
}
export function mergeStories(old, fresh) {
  const merged=new Map(old.map(s=>[String(s.id),s]));
  for (const s of fresh) merged.set(String(s.id),s);
  return [...merged.values()].sort(chronologic);
}
export function newCommentCount(story, read) {
  const previous=read[String(story.id)];
  return previous && Number.isFinite(previous.comments) && Number.isFinite(story.descendants) ? Math.max(0,story.descendants-previous.comments) : 0;
}
export function decodeTitle(title) {
  return title.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi,(match,entity)=>{
    const entities={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
    if (entity[0]!=='#') return entities[entity.toLowerCase()] || match;
    const code=entity[1].toLowerCase()==='x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return code>0 && code<=0x10ffff ? String.fromCodePoint(code) : match;
  });
}
