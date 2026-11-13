import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const cfg=JSON.parse(await fs.readFile('launch-config.json','utf8'));
const root = path.resolve(cfg.root);
const base=cfg.base;
const origin = new URL(base).origin;
const prefix = new URL(base).pathname;
const localPath = url => { if(!url.pathname.startsWith(prefix)) throw Error(`Outside published project: ${url.href}`); return path.resolve(root,'.'+decodeURIComponent(url.pathname.slice(prefix.length-1))); };
async function pages(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? (e.name.startsWith('.') || ['node_modules','test-results','tests','playwright-report'].includes(e.name) ? [] : pages(path.join(dir,e.name))) : e.name.endsWith('.html') ? [path.join(dir,e.name)] : []))).flat();
}
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.xml':'application/xml'};
for (const file of await pages(root)) {
 const relative = path.relative(root,file).replaceAll('\\','/');
 const html = await fs.readFile(file,'utf8');
 for (const width of [320,1280]) test(`${relative} at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('**/*', async route => {
   const url = new URL(route.request().url());
   if(url.origin !== origin) return route.abort();
   const target = localPath(url);
   if(!target.startsWith(root+path.sep) && target !== root) return route.abort();
   let resolved = target;
   try { if((await fs.stat(resolved)).isDirectory()) resolved=path.join(resolved,'index.html');
    await route.fulfill({body:await fs.readFile(resolved),contentType:types[path.extname(resolved)] || 'application/octet-stream'});
   } catch { await route.fulfill({status:404,body:'Not found'}); }
  });
  await page.goto(new URL(relative,base).href);
  const redirect = html.match(/http-equiv=["']refresh["'][^>]*content=["']0;\s*url=([^"']+)/i);
  if (redirect) await page.waitForURL(new URL(redirect[1], new URL(relative,base)).href);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).toBeVisible();
  const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => ({tag:e.tagName,classes:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})).slice(0,10));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBe(true);
  await expect.poll(() => page.evaluate(()=>({reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,motion:document.body.classList.contains('has-motion'),unrevealed:[...document.querySelectorAll('[data-reveal]')].filter(n=>!n.classList.contains('is-visible')).map(n=>n.className)}))).toEqual({reduce:true,motion:true,unrevealed:[]});
  await page.waitForFunction(() => [...document.querySelectorAll('link[rel=stylesheet]')].filter(link=>new URL(link.href).origin===location.origin).every(link=>link.sheet));
  await page.evaluate(async () => {
   await document.fonts.ready;
   await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations !== Infinity).map(a=>a.finished.catch(()=>{})));
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
  const result = await new AxeBuilder({page}).analyze();
  expect(result.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  const links = await page.locator('[href], [src]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')||n.getAttribute('src')).filter(Boolean).map(value=>new URL(value,document.baseURI).href));
  for(const link of links) {
   const url=new URL(link,page.url());
   if(url.origin!==origin || !url.pathname.startsWith(prefix) || !['https:','http:'].includes(url.protocol)) continue;
   const target=localPath(url);
   expect(target===root || target.startsWith(root+path.sep)).toBe(true);
   let stat; try {stat=await fs.stat(target)} catch {throw new Error(`Broken internal target: ${relative} -> ${url.pathname}`)}
   if(stat.isDirectory()) await fs.access(path.join(target,'index.html'));
  }
 });
}


for (const width of [320,1280]) test('deep missing path at '+width+'px has no application console errors', async ({page}) => {
 const missing=new URL('missing/deep/page',base).href;
 const errors=[];
 page.on('console',message=>{
  // A real 404 navigation reports its HTTP status in Chromium; exclude only that expected transport message.
  if(message.type()==='error' && !(message.location().url===missing && /Failed to load resource:.*404/.test(message.text()))) errors.push({text:message.text(),url:message.location().url});
 });
 page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize({width,height:900});
 // Routing blocks native workers in this suite. Model registration's script fetch to check its URL and scope,
 // without allowing an actual worker or any request to the live site.
 await page.addInitScript(()=>{
  window.workerRegistrations=[];
  navigator.serviceWorker.register=async (script,options)=>{
   const url=new URL(script,location.href).href;
   const scope=new URL(options.scope,location.href).href;
   window.workerRegistrations.push({url,scope});
   const response=await fetch(url);
   if(!response.ok)throw new Error('Worker script HTTP '+response.status);
   return {scope};
  };
 });
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  // Fonts are outside this offline application regression; fulfil their CSS without network access.
  if(url.origin==='https://fonts.googleapis.com')return route.fulfill({body:'',contentType:'text/css'});
  if(url.origin!==origin)return route.abort();
  if(url.href===missing)return route.fulfill({status:404,body:await fs.readFile(path.join(root,'404.html')),contentType:'text/html'});
  const target=localPath(url);
  if(!target.startsWith(root+path.sep))return route.abort();
  try{await route.fulfill({body:await fs.readFile(target),contentType:types[path.extname(target)]||'application/octet-stream'});}
  catch{await route.fulfill({status:404,body:'Not found'});}
 });
 await page.goto(missing);
 await page.waitForLoadState('networkidle');
 await expect(page.locator('h1')).toHaveText('That page is not on the desk.');
 expect(await page.locator('body').getAttribute('data-site-root')).toBe(prefix);
 expect(await page.evaluate(()=>window.workerRegistrations)).toEqual([{url:new URL('service-worker.js',base).href,scope:base}]);
 expect(errors).toEqual([]);
});
