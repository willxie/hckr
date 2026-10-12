import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,utcDay,selectStories,scoreThreshold,discussionUrl,articleUrl,mergeStories,newCommentCount,decodeTitle} from '../core.mjs';
const start=Date.UTC(2026,9,11)/1000;
const prefs={filter:'half',showDead:true};
const story=(id,score,hour=0,extra={})=>({id,title:`Story ${id}`,time:start+hour*3600,score,descendants:10,...extra});

test('top 10 scales to partial UTC days and includes score ties',()=>{
  const list=Array.from({length:20},(_,i)=>story(i+1,i<6 ? 100:10,i*12/19));
  assert.equal(scoreThreshold(list,'10'),100);
  assert.equal(selectStories(list,{...prefs,filter:'10'}).length,6);
});
test('half uses floor, elapsed-day scaling, and tied thresholds',()=>{
  const list=[story(1,100),story(2,90,6),story(3,90,12),story(4,20,18),story(5,10,23)];
  assert.equal(scoreThreshold(list,'half'),90);
  assert.deepEqual(selectStories(list,prefs).map(s=>s.id),[3,2,1]);
});
test('rankings belong to UTC buckets independently of local midnight',()=>{
  assert.equal(utcDay(start+2*3600),'2026-10-11');
  const list=[story(1,100),story(2,90,23),story(3,100,24),story(4,90,47)];
  assert.deepEqual(selectStories(list,prefs).map(s=>s.id),[3,1]);
});
test('show dead is applied after ranking; homepage is exact membership',()=>{
  const list=[story(1,100,0,{dead:true}),story(2,80,23,{homepage:true})];
  assert.deepEqual(selectStories(list,{filter:'all',showDead:false}).map(s=>s.id),[2]);
  assert.deepEqual(selectStories(list,{filter:'homepage',showDead:true}).map(s=>s.id),[2]);
  assert.equal(selectStories(list,{filter:'half',showDead:false}).length,0);
});
test('dead records and legacy job IDs survive normalization',()=>{
  const list=normalize([story(1,0,0,{title:'undefined',dead:true,descendants:null}),story('a'.repeat(40),0,1,{type:'job'}),story('not-an-id',1)]);
  assert.equal(list.length,2); assert.equal(list[0].title,'Removed story'); assert.equal(list[0].descendants,null);
  assert.equal(discussionUrl(list[1].id),null);
});
test('HackerWeb preference changes discussions and HN titles, retaining article URLs',()=>{
  assert.equal(discussionUrl(42),'https://hackerweb.app/#/item/42');
  assert.equal(discussionUrl(42,false),'https://news.ycombinator.com/item?id=42');
  assert.equal(articleUrl('https://news.ycombinator.com/item?id=42',42),'https://hackerweb.app/#/item/42');
  assert.equal(articleUrl('https://example.com/post',42),'https://example.com/post');
  assert.equal(articleUrl('javascript:alert(1)',42),'https://hackerweb.app/#/item/42');
});
test('fresh records win over archives and retain chronological order',()=>{
  assert.deepEqual(mergeStories([story(1,10,2)],[story(1,20,2),story(2,30,4)]).map(s=>[s.id,s.score]),[[2,30],[1,20]]);
});
test('unread counts require a discussion visit and never become negative',()=>{
  const item=story(1,10,0,{descendants:14});
  assert.equal(newCommentCount(item,{'1':{comments:10}}),4);
  assert.equal(newCommentCount(item,{'1':{articleRead:true}}),0);
  assert.equal(newCommentCount(item,{'1':{comments:20}}),0);
});
test('encoded titles display as text without injecting markup',()=>{
  assert.equal(decodeTitle('A &amp; B &quot;C&quot; &#x1f600;'),'A & B "C" 😀');
  assert.equal(decodeTitle('&lt;script&gt;'),'\x3cscript>');
});

test('all five filters match the original browser on a captured feed',async()=>{
  const {readFile}=await import('node:fs/promises');
  const original=JSON.parse(await readFile(new URL('./fixtures/original-filters.json',import.meta.url),'utf8'));
  for (const sample of original.cases) {
    const actual=selectStories(original.stories,{filter:sample.filter,showDead:true}).map(s=>String(s.id)).sort();
    assert.deepEqual(actual,sample.ids.map(String).sort(),sample.filter);
  }
});
