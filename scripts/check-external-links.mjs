import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export async function checkExternalUrl(url,{fetchImpl=fetch,retry=false,deadline=Date.now()+20000}={}) {
 for(let attempt=0;attempt<(retry?2:1);attempt++) {
  try {
   let current=url;const seen=new Set();let response;
   for(let hop=0;;hop++){let parsed;try{parsed=new URL(current)}catch{return {status:'unsafe',code:'invalid-url'}}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||seen.has(parsed.href)||hop>6)return {status:'unsafe',code:'redirect-policy'};seen.add(parsed.href);
    response=await fetchImpl(parsed.href,{signal:AbortSignal.timeout(Math.max(1,Math.min(6000,deadline-Date.now()))),redirect:'manual',headers:{'user-agent':'LaunchLinkCheck/1.0'}});
   await response.body?.cancel();
    if(![301,302,303,307,308].includes(response.status))break;
    const destination=response.headers.get('location');if(!destination)return {status:'unsafe',code:'missing-location'};try{current=new URL(destination,current).href}catch{return {status:'unsafe',code:'invalid-location'}}
   }
   if([404,410].includes(response.status))return {status:'broken',code:response.status};
   if(response.ok && !(new URL(url).protocol==='https:' && new URL(response.url||url).protocol!=='https:'))return {status:'ok',code:response.status};
   if(attempt===0&&retry&&[429,500,502,503,504].includes(response.status)&&Date.now()<deadline)continue;
   return {status:'unverified',code:response.status};
  } catch {if(attempt===0&&retry&&Date.now()<deadline)continue;return {status:'unverified',code:'network/redirect'}}
 }
}
async function walk(dir){return (await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?(e.name.startsWith('.')||['node_modules','test-results','tests','playwright-report'].includes(e.name)?[]:walk(path.join(dir,e.name))):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]))).flat()}
async function main(){
 const urls=new Set();
 for(const file of await walk('.'))for(const m of (await fs.readFile(file,'utf8')).matchAll(/<a\b[^>]*\bhref=["'](https?:\/\/[^"']+)["']/gi)){
  const url=new URL(m[1].replaceAll('&amp;','&'));url.hash='';urls.add(url.href);
 }
 const archive=[...urls].filter(u=>new URL(u).hostname==='web.archive.org');
 const other=[...urls].filter(u=>new URL(u).hostname!=='web.archive.org');
 const deadline=Date.now()+250000;let checked=0,failed=0,unknown=0;const hosts=new Map();
 function unverified(url,code){unknown++;const host=new URL(url).hostname;hosts.set(host,(hosts.get(host)||0)+1);console.log(`UNVERIFIED ${code} ${host}`)}
 async function workers(queue,count,retry){await Promise.all(Array.from({length:count},async()=>{while(queue.length){const url=queue.shift();if(Date.now()>=deadline){unverified(url,'deadline');continue}const result=await checkExternalUrl(url,{retry,deadline});checked++;
  if(['broken','unsafe'].includes(result.status)){failed++;console.log(`BROKEN ${result.code} ${new URL(url).origin}${new URL(url).pathname}`)}else if(result.status==='unverified')unverified(url,result.code);
 }}))}
 await Promise.all([workers(archive,2,true),workers(other,6,false)]);
 const report={checked,broken:failed,unverified:unknown,total:urls.size};console.log(JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,`## External link crawl\n\n${checked}/${urls.size} checked; ${failed} broken (404/410); ${unknown} unverified.\n\n${[...hosts].sort().map(([host,n])=>`- Warning: ${host}: ${n} unverified`).join('\n')}\n`);
 if(unknown)console.log('::warning::Some external hosts blocked or limited verification; see job summary.');
 if(failed)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
