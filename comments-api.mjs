export const API='https://hacker-news.firebaseio.com/v0/';
export function itemId(value) {
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value) : null;
}
export function childIds(item) {
  return [...new Set((Array.isArray(item?.kids) ? item.kids : []).map(itemId).filter(id=>id && id!==item.id))];
}
export function createClient(fetcher=globalThis.fetch, concurrency=6) {
  const cache=new Map(), waiting=[];
  let active=0;
  async function acquire() {
    if (active<concurrency) { active++; return; }
    await new Promise(resolve=>waiting.push(resolve));
  }
  function release() { const next=waiting.shift(); if (next) next(); else active--; }
  function get(value) {
    const id=itemId(value);
    if (!id) return Promise.reject(new Error('Invalid item ID.'));
    if (cache.has(id)) return cache.get(id);
    const result=(async()=>{
      await acquire();
      try {
        const response=await fetcher(`${API}item/${id}.json`,{signal:AbortSignal.timeout(20000),cache:'no-cache'});
        if (!response.ok) throw new Error('Hacker News is unavailable.');
        const item=await response.json();
        if (!item || item.id!==id) throw new Error('This item is unavailable.');
        return item;
      } finally { release(); }
    })();
    cache.set(id,result);
    result.catch(()=>cache.delete(id));
    return result;
  }
  return {get};
}
export async function resolveThread(client,value) {
  const target=await client.get(value), seen=new Set();
  let story=target;
  while (story.type==='comment') {
    if (seen.has(story.id) || seen.size>=64 || !itemId(story.parent)) throw new Error('The discussion could not be found.');
    seen.add(story.id); story=await client.get(story.parent);
  }
  if (!['story','poll','job'].includes(story.type)) throw new Error('This item is not a discussion.');
  return {story,target};
}
