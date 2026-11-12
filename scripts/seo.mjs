import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cfg=JSON.parse(read('seo-config.json'));
const check=process.argv.includes('--check');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function save(p,s){ if(check){if(read(p)!==s)throw Error(`${p} is stale; run node scripts/seo.mjs`);}else fs.writeFileSync(path.join(root,p),s); }
const pages=fs.readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.html')&&!p.split(/[\\/]/).some(s=>s.startsWith('.')||s==='node_modules')).sort();
const urls=[];
for(const p of pages){
 let html=read(p); const route=p.replaceAll('\\','/').replace(/index\.html$/,''); const url=new URL(route,cfg.base).href;
 if(p==='404.html')continue;
 urls.push(url);
 // Preserve existing site-specific graph and descriptions, normalise sharing URLs.
 html=html.replace(/\s*<link\b[^>]*rel="(?:canonical|alternate)"[^>]*>/g,'').replace(/\s*<meta\b[^>]*(?:property="og:(?:url|image(?:\:[^"]+)?)"|name="twitter:(?:card|image(?:\:[^"]+)?)")[^>]*>/g,'');
 html=html.replace(/\s*<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g,'');
 const jsonld=[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
 for(const m of jsonld) JSON.parse(m[1]);
 const schema=jsonld.length?'':`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'WebPage',name:html.match(/<title>(.*?)<\/title>/s)?.[1]||cfg.title,url,isPartOf:{'@type':'WebSite',name:cfg.title,url:cfg.base}}).replaceAll('<','\\u003c')}</script>`;
 const tags=`\n<link rel="canonical" href="${url}">\n<meta property="og:url" content="${url}">\n<meta property="og:image" content="${cfg.base}social-preview.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:alt" content="${esc(cfg.title)}">\n<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="${cfg.base}social-preview.png">\n<link rel="alternate" type="application/rss+xml" title="${esc(cfg.title)}" href="${cfg.base}rss.xml">\n${schema}\n`;
 html=html.replace(/\s*<\/head>/,tags+'</head>');
 save(p,html);
 if(!/name="viewport"/.test(html)||!/<html[^>]*lang=/.test(html)||!/<meta\s[^>]*name="description"/.test(html))throw Error(`Missing basic metadata: ${p}`);
}
if(cfg.kind!=='kol-tregaskes-photography')save('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u=>`  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`);
for(const u of [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]))if(!urls.includes(u))throw Error(`Invalid sitemap route ${u}`);
if(!read('robots.txt').includes(`Sitemap: ${cfg.base}sitemap.xml`))throw Error('Missing robots sitemap');
if(!read('llms.txt').includes(cfg.title))throw Error('Missing llms site title');
const png=fs.readFileSync(path.join(root,'social-preview.png'));
if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||png.readUInt32BE(16)!==1200||png.readUInt32BE(20)!==630)throw Error('Expected 1200x630 PNG card');
let items=[];
if(cfg.kind==='kol-tregaskes-photography')items=JSON.parse(read('news-digests/index.json')).files.slice(0,30).map(f=>({title:`Photography digest ${f.slice(7,17)}`,url:cfg.base+'news-digests/'+f,date:f.slice(7,17)}));
if(cfg.kind==='gametrackdaily')items=JSON.parse(read('data/games-news.json')).feeds.flatMap(f=>f.items).map(i=>({title:i.title,url:i.url,date:i.publishedAt}));
if(cfg.kind==='stackscout')items=JSON.parse(read('data/updates-manifest.json')).items.map(i=>({title:i.title,url:i.sourceUrl||i.href,date:i.publishedAtIso||i.publishedAt}));
items=items.filter(i=>i.title&&/^https:\/\//.test(i.url)&&Number.isFinite(Date.parse(i.date))).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
items=[...new Map(items.map(i=>[i.url,i])).values()].slice(0,30);
if(!items.length)throw Error('RSS has no dated items');
save('rss.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(cfg.title)}</title><link>${cfg.base}</link><description>Latest published updates from ${esc(cfg.title)}</description><language>en-gb</language><atom:link href="${cfg.base}rss.xml" rel="self" type="application/rss+xml"/>${items.map(i=>`\n<item><title>${esc(i.title)}</title><link>${esc(i.url)}</link><guid isPermaLink="true">${esc(i.url)}</guid><pubDate>${new Date(i.date).toUTCString()}</pubDate></item>`).join('')}\n</channel></rss>\n`);
console.log(`SEO ${check?'check':'generation'} passed: ${urls.length} pages, ${items.length} RSS items.`);
