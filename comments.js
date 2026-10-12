import {commentsUrl,discussionUrl,articleUrl,decodeTitle} from './core.mjs?v=4';
import {store,preferences} from './theme.mjs?v=4';
import {createClient,resolveThread,childIds,itemId} from './comments-api.mjs?v=4';
import {commentHtml} from './comment-html.mjs?v=4';

const $=selector=>document.querySelector(selector);
const id=itemId(new URLSearchParams(location.search).get('id'));
let current=null;
function element(tag,className,text) {
  const node=document.createElement(tag); if (className) node.className=className;
  if (text!==undefined) node.textContent=text;
  return node;
}
function link(href,text,className) {
  const node=element('a',className,text); node.href=href;
  if (/^https?:/.test(href) && preferences.newTab) { node.target='_blank'; node.rel='noopener noreferrer'; }
  return node;
}
function dateLabel(time) {
  if (!Number.isFinite(time)) return 'unknown time';
  const seconds=Math.max(0,Date.now()/1000-time);
  for (const [size,name] of [[31536000,'year'],[2592000,'month'],[86400,'day'],[3600,'hour'],[60,'minute']]) {
    if (seconds>=size) { const count=Math.floor(seconds/size); return `${count} ${name}${count===1 ? '':'s'} ago`; }
  }
  return 'just now';
}
function timestamp(item) {
  const time=element('time',null,dateLabel(item.time));
  if (Number.isFinite(item.time)) { time.dateTime=new Date(item.time*1000).toISOString(); time.title=new Date(item.time*1000).toLocaleString(); }
  return time;
}
function body(html) {
  const node=element('div','comment-text'); node.append(commentHtml(html,document));
  return node;
}
function errorRow(session,id,depth) {
  const row=element('article','comment comment-error');
  row.append(element('span',null,'Comment could not load. '));
  const retry=element('button',null,'retry'); retry.type='button';
  retry.addEventListener('click',async()=>{
    retry.disabled=true;
    try { const item=await session.client.get(id); if (current===session) row.replaceWith(renderComment(session,item,depth)); }
    catch { retry.disabled=false; }
  });
  row.append(retry); return row;
}
function renderComment(session,item,depth) {
  const row=element('article','comment'); row.id=`comment-${item.id}`;
  const meta=element('div','comment-meta'), content=element('div','comment-content');
  const toggle=element('button','comment-toggle','[−]'); toggle.type='button';
  const author=item.by || (item.deleted ? 'deleted':'unknown');
  toggle.setAttribute('aria-label',`Collapse comment by ${author}`);
  toggle.setAttribute('aria-expanded','true'); toggle.setAttribute('aria-controls',`content-${item.id}`);
  content.id=`content-${item.id}`;
  toggle.addEventListener('click',()=>{
    content.hidden=!content.hidden; toggle.textContent=content.hidden ? '[+]':'[−]';
    toggle.setAttribute('aria-expanded',String(!content.hidden));
    toggle.setAttribute('aria-label',`${content.hidden ? 'Expand':'Collapse'} comment by ${author}`);
  });
  meta.append(toggle);
  if (item.by) meta.append(link(`https://news.ycombinator.com/user?id=${encodeURIComponent(item.by)}`,item.by,'comment-author'));
  else meta.append(element('span','comment-author',author));
  meta.append(document.createTextNode(' · '),timestamp(item),document.createTextNode(' · '),link(commentsUrl(item.id),'link'));
  if (item.parent && item.parent!==session.story.id) meta.append(document.createTextNode(' · '),link(commentsUrl(item.parent),'parent'));
  content.append(item.deleted || item.dead ? element('p','comment-removed',item.deleted ? '[deleted]':'[dead]') : body(item.text));
  const kids=childIds(item).filter(child=>!session.rendered.has(child));
  row.append(meta,content);
  if (kids.length) {
    const replies=element('div',`comment-replies${depth>=6 ? ' deep-replies':''}`); content.append(replies);
    const list=createList(session,replies,kids,depth+1);
    if (depth<2 && session.budget>0) {
      const count=Math.min(3,kids.length,session.budget); session.budget-=count;
      session.initial.push(list.load(count));
    }
  }
  return row;
}
function createList(session,host,ids,depth) {
  let offset=0,loading=false;
  const button=element('button','load-comments'); button.type='button';
  function update() {
    const left=ids.length-offset;
    button.hidden=!left;
    button.textContent=depth===0 ? `load ${Math.min(20,left)} more comments (${left} remaining)` : `${offset ? 'load more':'show'} replies (${left})`;
  }
  host.append(button); update();
  async function load(count=20) {
    if (loading || current!==session) return;
    loading=true; button.disabled=true; button.textContent='loading…';
    const batch=ids.slice(offset,offset+count);
    const results=await Promise.allSettled(batch.map(id=>session.client.get(id)));
    if (current!==session) return;
    for (let i=0;i<results.length;i++) {
      const id=batch[i], result=results[i];
      if (session.rendered.has(id)) continue;
      session.rendered.add(id);
      host.insertBefore(result.status==='fulfilled' ? renderComment(session,result.value,depth) : errorRow(session,id,depth),button);
    }
    offset+=batch.length; loading=false; button.disabled=false; update();
  }
  button.addEventListener('click',()=>load());
  return {load};
}
function rememberDiscussion(story) {
  const saved=store.get('hckr-read',{});
  const read=saved && typeof saved==='object' && !Array.isArray(saved) ? saved : {};
  read[story.id]={...read[story.id],articleRead:true,visitedAt:Date.now(),...(Number.isFinite(story.descendants) ? {comments:story.descendants}:{})};
  store.set('hckr-read',read);
}
function renderStory(session) {
  const story=session.story, summary=$('#discussion-story');
  const title=decodeTitle(story.title || (story.deleted ? 'Deleted story':'Removed story'));
  document.title=`${title} · hrnw`;
  const heading=element('h2','discussion-title');
  const external=articleUrl(story.url,story.id,preferences.hackerWeb);
  const discussion=discussionUrl(story.id,preferences.hackerWeb);
  heading.append(external && external!==discussion ? link(external,title) : element('span',null,title));
  const meta=element('p','discussion-meta',`${story.score ?? 0} points · ${story.descendants ?? 0} comments`);
  if (story.by) meta.append(document.createTextNode(' · by '),link(`https://news.ycombinator.com/user?id=${encodeURIComponent(story.by)}`,story.by));
  meta.append(document.createTextNode(' · '),timestamp(story));
  const externalLinks=element('p','discussion-external');
  externalLinks.append(link(discussion,preferences.hackerWeb ? 'open in HackerWeb':'open on Hacker News'),document.createTextNode(' · '),link(discussionUrl(story.id,false),'reply on Hacker News'));
  summary.replaceChildren(heading,meta,externalLinks);
  if (story.deleted || story.dead) summary.append(element('p','comment-removed',story.deleted ? '[deleted]':'[dead]'));
  else if (story.text) summary.append(body(story.text));
  summary.hidden=false;
}
async function loadDiscussion() {
  if (!id) {
    $('#discussion-status').textContent='Choose a story’s comments link from the news list.';
    $('#discussion-comments').setAttribute('aria-busy','false'); return;
  }
  const session={client:createClient(),rendered:new Set(),initial:[],budget:40}; current=session;
  $('#refresh-discussion').disabled=true; $('#retry-discussion').hidden=true;
  $('#discussion-status').textContent='Loading discussion…';
  $('#discussion-comments').setAttribute('aria-busy','true');
  try {
    const {story,target}=await resolveThread(session.client,id);
    if (current!==session) return;
    session.story=story; renderStory(session);
    const host=$('#discussion-comments'); host.replaceChildren();
    const context=$('#discussion-context'); context.replaceChildren(); context.hidden=target.id===story.id;
    if (target.id!==story.id) {
      context.append(document.createTextNode('Individual comment · '),link(commentsUrl(story.id),'view full discussion'));
      session.rendered.add(target.id); host.append(renderComment(session,target,0));
    } else {
      const roots=childIds(story);
      if (roots.length) await createList(session,host,roots,0).load();
      else host.append(element('p','no-comments','There are no comments yet.'));
    }
    // Await the small initial thread preview; deeper and larger branches load on request.
    for (let i=0;i<session.initial.length;i++) await session.initial[i];
    if (current!==session) return;
    if (target.id===story.id) rememberDiscussion(story);
    $('#discussion-status').textContent=''; $('#refresh-discussion').hidden=false;
  } catch (error) {
    if (current!==session) return;
    $('#discussion-status').textContent=`${error.message} Please try again.`;
    $('#retry-discussion').hidden=false;
  } finally {
    if (current===session) {
      $('#discussion-comments').setAttribute('aria-busy','false'); $('#refresh-discussion').disabled=false;
    }
  }
}
$('#refresh-discussion').addEventListener('click',loadDiscussion);
$('#retry-discussion').addEventListener('click',loadDiscussion);
loadDiscussion();
