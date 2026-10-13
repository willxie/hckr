import test from 'node:test';
import assert from 'node:assert/strict';
import {createClient,resolveThread,childIds,itemId} from '../comments-api.mjs';
import {commentsUrl} from '../core.mjs';
import {safeLink} from '../comment-html.mjs';

const response=item=>({ok:true,json:async()=>item});
test('comment routes reject malformed IDs and work below a Pages subdirectory',()=>{
  assert.equal(commentsUrl(123),'comments.html?id=123');
  assert.equal(new URL(commentsUrl(123),'https://willxie.github.io/hrnw/').pathname,'/hrnw/comments.html');
  assert.equal(commentsUrl('123&x=1'),null);
  assert.equal(commentsUrl(0),null);
  for (const value of [null,0,-1,'abc','1.5',Number.MAX_SAFE_INTEGER+1]) assert.equal(itemId(value),null);
});
test('API kids retain ranked order and deleted parents retain their replies',()=>{
  assert.deepEqual(childIds({id:10,deleted:true,kids:[30,20,30,10,'bad',40]}),[30,20,40]);
  assert.deepEqual(childIds({kids:null}),[]);
});
test('a deep comment permalink resolves through deleted ancestors to its story',async()=>{
  const items={1:{id:1,type:'story'},2:{id:2,type:'comment',deleted:true,parent:1},3:{id:3,type:'comment',parent:2}};
  const result=await resolveThread({get:async id=>items[id]},3);
  assert.equal(result.story.id,1); assert.equal(result.target.id,3);
});
test('parent cycles and invalid parent chains fail instead of looping',async()=>{
  await assert.rejects(resolveThread({get:async id=>({id,type:'comment',parent:id===2 ? 3:2})},2),/could not be found/);
  await assert.rejects(resolveThread({get:async id=>({id,type:'comment'})},2),/could not be found/);
});
test('API requests are bounded, shared for duplicate IDs, and cached only on success',async()=>{
  let active=0,peak=0,calls=0;
  const client=createClient(async url=>{
    active++; peak=Math.max(peak,active); calls++;
    await new Promise(resolve=>setTimeout(resolve,5)); active--;
    return response({id:Number(url.match(/item\/(\d+)/)[1]),type:'comment'});
  },3);
  const result=await Promise.all([client.get(1),client.get(1),...Array.from({length:12},(_,i)=>client.get(i+2))]);
  assert.equal(result.length,14); assert.equal(calls,13); assert.equal(peak,3);
  await client.get(1); assert.equal(calls,13);
  let attempts=0;
  const flaky=createClient(async()=>++attempts===1 ? {ok:false} : response({id:1,type:'story'}));
  await assert.rejects(flaky.get(1)); assert.equal((await flaky.get(1)).id,1); assert.equal(attempts,2);
});
test('missing or mismatched API items fail and permit retry',async()=>{
  const client=createClient(async()=>response(null)); await assert.rejects(client.get(7),/unavailable/);
  const wrong=createClient(async()=>response({id:8})); await assert.rejects(wrong.get(7),/unavailable/);
});
test('comment links accept web links and reject active URL schemes',()=>{
  for (const value of ['javascript:alert(1)','data:text/html,test','vbscript:alert(1)','file:///tmp/x']) assert.equal(safeLink(value),null);
  assert.equal(safeLink('/user?id=pg'),'https://news.ycombinator.com/user?id=pg');
  assert.equal(safeLink('https://example.com/a'),'https://example.com/a');
});

import {canRememberDiscussion,initialReplyCount} from '../discussion-state.mjs';
test('initial failures and individual permalinks do not mark a discussion as read',()=>{
  const session={ready:false,story:{id:1},target:{id:1},failures:new Set()};
  assert.equal(canRememberDiscussion(session),false);
  session.ready=true; assert.equal(canRememberDiscussion(session),true);
  session.failures.add(3); assert.equal(canRememberDiscussion(session),false);
  session.failures.clear(); assert.equal(canRememberDiscussion(session),true);
  session.target={id:2}; assert.equal(canRememberDiscussion(session),false);
});
test('refresh retains previously loaded branches, even when deep or collapsed',()=>{
  const session={previousPlans:new Map([[2,23]]),budget:40,collapsed:new Set([2])};
  assert.equal(initialReplyCount(session,2,8,30),23);
  assert.equal(initialReplyCount(session,2,8,10),10);
  assert.equal(session.budget,40);
  assert.equal(initialReplyCount(session,3,0,10),3);
  assert.equal(session.budget,37);
  session.collapsed.add(4);
  assert.equal(initialReplyCount(session,4,0,10),0);
  assert.equal(initialReplyCount(session,5,2,10),0);
  session.budget=1; assert.equal(initialReplyCount(session,6,0,10),1);
  assert.equal(initialReplyCount(session,7,0,10),0);
});
