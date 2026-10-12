const allowed=new Set(['P','BR','A','I','EM','B','STRONG','CODE','PRE','BLOCKQUOTE','S','DEL','U']);
const dropped=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE','FORM','INPUT','BUTTON','IMG','VIDEO','AUDIO']);
export function safeLink(value) {
  try {
    const url=new URL(value,'https://news.ycombinator.com/');
    return ['http:','https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
// Rebuild an allowlisted tree. No API-supplied attributes or active elements survive.
export function commentHtml(html, document) {
  const template=document.createElement('template');
  template.innerHTML=String(html || '');
  const fragment=document.createDocumentFragment();
  function copy(source,parent) {
    if (source.nodeType===3) { parent.append(document.createTextNode(source.textContent)); return; }
    if (source.nodeType!==1 || dropped.has(source.tagName)) return;
    let destination=parent;
    if (allowed.has(source.tagName)) {
      destination=document.createElement(source.tagName.toLowerCase());
      if (source.tagName==='A') {
        const href=safeLink(source.getAttribute('href') || '');
        if (href) { destination.href=href; destination.rel='noopener noreferrer'; }
      }
      parent.append(destination);
    }
    for (const child of source.childNodes) copy(child,destination);
  }
  for (const child of template.content.childNodes) copy(child,fragment);
  return fragment;
}
