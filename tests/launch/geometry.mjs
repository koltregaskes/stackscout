export function geometryFindings() {
 const findings=[];const tolerance=1;
 const skip=n=>['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(n.tagName)||!n.getClientRects().length||getComputedStyle(n).visibility==='hidden'||(n.getBoundingClientRect().width<=1&&n.getBoundingClientRect().height<=1);
 for(const el of document.querySelectorAll('body *')){
  if(skip(el))continue;
  const rect=el.getBoundingClientRect();
  if(rect.width&&rect.height&&(rect.left < -tolerance||rect.right>innerWidth+tolerance)) findings.push({kind:'viewport',tag:el.tagName,cls:el.className,left:rect.left,right:rect.right});
  for(let parent=el.parentElement;parent;parent=parent.parentElement){
   const cs=getComputedStyle(parent),r=parent.getBoundingClientRect();
   if(['hidden','clip'].includes(cs.overflowY)&&(rect.top<r.top-tolerance||rect.bottom>r.bottom+tolerance)) findings.push({kind:'clip-y',tag:el.tagName,cls:el.className,parent:parent.tagName});
   if(['hidden','clip','auto','scroll'].includes(cs.overflowX)&& (rect.left<r.left-tolerance||rect.right>r.right+tolerance)) findings.push({kind:'clip-x',tag:el.tagName,cls:el.className,parent:parent.tagName});
  }
  if(el.children.length===0&&el.textContent.trim()&&el.clientWidth>1&&el.scrollWidth>el.clientWidth+tolerance&&['hidden','clip'].includes(getComputedStyle(el).overflowX))findings.push({kind:'clipped-text',tag:el.tagName,cls:el.className});
 }
 return findings.slice(0,30);
}
