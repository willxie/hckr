import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>readFileSync(resolve(root,name),'utf8');
const workflow=read('.github/workflows/pages.yml');
const assets=workflow.match(/cp (.+?) _site\//)[1].split(' ');

test('every deployed page and module resolves its local dependencies',()=>{
  for (const asset of assets) {
    assert.ok(existsSync(resolve(root,asset)),`${asset} exists`);
    const source=read(asset);
    const references=asset.endsWith('.html')
      ? [...source.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1])
      : /\.(mjs|js)$/.test(asset) ? [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match=>match[1]) : [];
    for (const ref of references) {
      if (/^https?:|^#/.test(ref) || ref==='./' || ref.startsWith('./#')) continue;
      const filename=ref.split(/[?#]/)[0].replace(/^\.\//,'');
      assert.ok(assets.includes(filename),`${asset} dependency ${filename} is deployed`);
    }
  }
});
test('all pages credit the original site and state personal use in the subheading',()=>{
  for (const filename of ['index.html','about.html','comments.html']) {
    const logo=read(filename).match(/<div class="logo">([\s\S]*?)<\/div>/)[1];
    assert.match(logo,/for personal use/);
    assert.match(logo,/<a href="https:\/\/hckrnews.com\/">hckrnews.com<\/a>/);
    assert.match(logo,/<h1><a href="\.\/">hrnw<\/a><\/h1>/);
  }
});
function luminance(hex) {
  if (hex.length===4) hex='#'+[...hex.slice(1)].map(char=>char+char).join('');
  const rgb=hex.match(/[\da-f]{2}/gi).map(value=>parseInt(value,16)/255).map(value=>value<=.04045 ? value/12.92 : ((value+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a,b) {
  const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
}
test('small text, orange links, and selected filters retain readable contrast in both themes',()=>{
  const css=read('styles.css');
  const rules=[...css.matchAll(/:root(?:\[data-theme=light\])?\s*\{([^}]+)\}/g)].map(match=>Object.fromEntries([...match[1].matchAll(/--([\w-]+):\s*(#[\da-f]+)/gi)].map(value=>[value[1],value[2]])));
  const dark=rules[0],light={...dark,...rules[1]};
  for (const [name,palette] of [['dark',dark],['light',light]]) {
    for (const key of ['text','muted','faint','accent','visited']) assert.ok(contrast(palette[key],palette.bg)>=4.5,`${name} ${key} on background`);
    assert.ok(contrast(palette['pill-text'],palette['pill-bg'])>=4.5,`${name} selected filter`);
  }
});
