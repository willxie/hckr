import {commentsUrl,discussionUrl,articleUrl,decodeTitle} from './core.mjs?v=5';
import {store,preferences} from './theme.mjs?v=5';
import {createClient,resolveThread,childIds,itemId} from './comments-api.mjs?v=5';
import {commentHtml} from './comment-html.mjs?v=5';
import {canRememberDiscussion,initialReplyCount} from './discussion-state.mjs?v=5';

const $=selector=>document.querySelector(selector);
const id=itemId(new URLSearchParams(location.search).get('id'));
let current=null, loadingDiscussion=false;
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
function updateLoadStatus(session) {
  if (current!==session || !session.ready) return;
  $('#discussion-status').textContent=session.failures.size
    ? 'Some comments could not load. Use their retry links to try again.' : '';
  if (canRememberDiscussion(session)) rememberDiscussion(session.story);
}
function captureReadingPosition() {
  const meta=[...document.querySelectorAll('.comment-meta')].find(node=>node.getBoundingClientRect().bottom>0);
  return meta ? {id:meta.closest('.comment').id,top:meta.getBoundingClientRect().top} : null;
}
function restoreReadingPosition(anchor) {
  const meta=anchor && document.getElementById(anchor.id)?.querySelector('.comment-meta');
  if (meta) window.scrollBy(0,meta.getBoundingClientRect().top-anchor.top);
}
function errorRow(session,id,depth) {
  const row=element('article','comment comment-error');
  row.append(element('span',null,'Comment could not load. '));
  const retry=element('button',null,'retry'); retry.type='button';
  retry.addEventListener('click',async()=>{
    retry.disabled=true; retry.textContent='retrying…';
    try {
      const item=await session.client.get(id);
      if (!session.active) return;
      row.replaceWith(renderComment(session,item,depth));
      session.failures.delete(id); updateLoadStatus(session);
    } catch {
      retry.disabled=false; retry.textContent='retry';
      row.querySelector('span').textContent='Comment still unavailable. ';
    }
  });
  row.append(retry); return row;
}
function renderComment(session,item,depth) {
  const row=element('article','comment'); row.id=`comment-${item.id}`;
  const meta=element('div','comment-meta'), content=element('div','comment-content');
  const toggle=element('button','comment-toggle','[−]'); toggle.type='button';
  const author=item.by || (item.deleted ? 'deleted':'unknown');
  content.hidden=session.collapsed.has(item.id);
  toggle.textContent=content.hidden ? '[+]':'[−]';
  toggle.setAttribute('aria-label',`${content.hidden ? 'Expand':'Collapse'} comment by ${author}`);
  toggle.setAttribute('aria-expanded',String(!content.hidden)); toggle.setAttribute('aria-controls',`content-${item.id}`);
  content.id=`content-${item.id}`;
  toggle.addEventListener('click',()=>{
    content.hidden=!content.hidden; toggle.textContent=content.hidden ? '[+]':'[−]';
    if (content.hidden) session.collapsed.add(item.id); else session.collapsed.delete(item.id);
    toggle.setAttribute('aria-expanded',String(!content.hidden));
    toggle.setAttribute('aria-label',`${content.hidden ? 'Expand':'Collapse'} comment by ${author}`);
  });
  meta.append(toggle);
  if (item.by) meta.append(link(`https://news.ycombinator.com/user?id=${encodeURIComponent(item.by)}`,item.by,'comment-author'));
  else meta.append(element('span','comment-author',author));
  const permalink=link(commentsUrl(item.id),'link');
  permalink.setAttribute('aria-label',`Permalink to comment by ${author}`);
  meta.append(document.createTextNode(' · '),timestamp(item),document.createTextNode(' · '),permalink);
  if (item.parent && item.parent!==session.story.id) meta.append(document.createTextNode(' · '),link(commentsUrl(item.parent),'parent'));
  content.append(item.deleted || item.dead ? element('p','comment-removed',item.deleted ? '[deleted]':'[dead]') : body(item.text));
  const kids=childIds(item).filter(child=>!session.rendered.has(child));
  row.append(meta,content);
  if (kids.length) {
    const replies=element('div',`comment-replies${depth>=6 ? ' deep-replies':''}`); content.append(replies);
    const list=createList(session,replies,kids,depth+1,item.id);
    const count=initialReplyCount(session,item.id,depth,kids.length);
    if (count) session.initial.push(list.load(count));
  }
  return row;
}
function createList(session,host,ids,depth,parentId) {
  let offset=0,loading=false;
  const button=element('button','load-comments'); button.type='button';
  function update() {
    const left=ids.length-offset;
    button.hidden=!left;
    button.textContent=depth===0 ? `load ${Math.min(20,left)} more comments (${left} remaining)` : `${offset ? 'load more':'show'} replies (${left})`;
  }
  host.append(button); update();
  async function load(count=20) {
    if (loading || !session.active) return;
    loading=true; button.disabled=true; button.textContent='loading…';
    const batch=ids.slice(offset,offset+count);
    const results=await Promise.allSettled(batch.map(id=>session.client.get(id)));
    if (!session.active) return;
    for (let i=0;i<results.length;i++) {
      const id=batch[i], result=results[i];
      if (session.rendered.has(id)) continue;
      session.rendered.add(id);
      if (result.status==='rejected') session.failures.add(id);
      host.insertBefore(result.status==='fulfilled' ? renderComment(session,result.value,depth) : errorRow(session,id,depth),button);
    }
    offset+=batch.length; session.plans.set(parentId,offset);
    loading=false; button.disabled=false; update(); updateLoadStatus(session);
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
    $('#discussion-status').textContent=location.search
      ? 'This discussion link is invalid. Choose a comments link from the news list.'
      : 'Choose a story’s comments link from the news list.';
    $('#discussion-comments').setAttribute('aria-busy','false'); return;
  }
  if (loadingDiscussion) return;
  loadingDiscussion=true;
  const previous=current, anchor=captureReadingPosition();
  const session={client:createClient(),rendered:new Set(),initial:[],budget:40,active:true,ready:false,
    failures:new Set(),plans:new Map(),previousPlans:new Map(previous?.plans),collapsed:new Set(previous?.collapsed)};
  $('#refresh-discussion').disabled=true; $('#retry-discussion').hidden=true;
  $('#discussion-status').textContent=previous ? 'Refreshing discussion…':'Loading discussion…';
  $('#discussion-comments').setAttribute('aria-busy','true');
  try {
    const {story,target}=await resolveThread(session.client,id);
    session.story=story; session.target=target;
    // Build offscreen so failures keep the current thread and its controls intact.
    const host=element('div','root-comments');
    if (target.id!==story.id) {
      session.rendered.add(target.id); host.append(renderComment(session,target,0));
    } else {
      const roots=childIds(story);
      if (roots.length) await createList(session,host,roots,0,story.id).load(session.previousPlans.get(story.id) || 20);
      else host.append(element('p','no-comments','There are no comments yet.'));
    }
    for (let i=0;i<session.initial.length;i++) await session.initial[i];
    // If every initial request fails, keep an existing readable discussion.
    if (previous && session.rendered.size && session.failures.size===session.rendered.size) {
      throw new Error('Comments could not be refreshed.');
    }
    if (previous) previous.active=false;
    current=session; session.ready=true;
    renderStory(session);
    $('#discussion-comments').replaceChildren(host);
    const context=$('#discussion-context'); context.replaceChildren(); context.hidden=target.id===story.id;
    if (target.id!==story.id) context.append(document.createTextNode('Individual comment · '),link(commentsUrl(story.id),'view full discussion'));
    updateLoadStatus(session); $('#refresh-discussion').hidden=false;
    restoreReadingPosition(anchor);
  } catch (error) {
    session.active=false;
    $('#discussion-status').textContent=previous
      ? 'Refresh unavailable. Your current discussion is still available; try again.'
      : `${error.message} Please try again.`;
    $('#retry-discussion').hidden=false;
  } finally {
    loadingDiscussion=false;
    $('#discussion-comments').setAttribute('aria-busy','false'); $('#refresh-discussion').disabled=false;
  }
}
$('#refresh-discussion').addEventListener('click',loadDiscussion);
$('#retry-discussion').addEventListener('click',loadDiscussion);
loadDiscussion();
