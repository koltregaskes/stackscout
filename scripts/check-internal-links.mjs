import fs from 'node:fs';
import path from 'node:path';
const base=new URL('https://koltregaskes.github.io/stackscout/');
const root=process.cwd();
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name.startsWith('.')||['node_modules','tests','test-results','playwright-report'].includes(e.name)?[]:walk(path.join(d,e.name))):e.name.endsWith('.html')?[path.join(d,e.name)]:[]);
let count=0;
for(const file of walk(root)){const html=fs.readFileSync(file,'utf8'),page=new URL(path.relative(root,file).replaceAll('\\','/'),base);for(const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){const url=new URL(m[1].replaceAll('&amp;','&'),page);if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))continue;let target=path.resolve(root,decodeURIComponent(url.pathname.slice(base.pathname.length)));if(target!==root&&!target.startsWith(root+path.sep))throw Error('Invalid local target');if(!fs.existsSync(target))throw Error('Broken internal link: '+path.relative(root,file)+' -> '+url.pathname);if(fs.statSync(target).isDirectory()&&!fs.existsSync(path.join(target,'index.html')))throw Error('Missing directory index: '+url.pathname);count++;}}
console.log('Internal links passed: '+count+' targets');
