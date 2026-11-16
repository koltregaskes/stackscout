import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inspectPrivacyHosts,referencedHosts} from '../scripts/check-privacy-hosts.mjs';
import {backstopHosts} from '../scripts/privacy-backstop.mjs';
import {decodeDataDocument,DOCUMENT_DEPTH_LIMIT} from '../scripts/privacy-data-url.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const footer='<footer><a href="/privacy/">Privacy notice</a></footer>';
const attr=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;');
const data=(source,type='text/html',encoding='percent')=>'data:'+type+(encoding==='base64'?';base64,'+Buffer.from(source).toString('base64'):','+encodeURIComponent(source));
async function fixture(source,{mention=true}={}){
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ss-privacy-documents-'));
    await fs.mkdir(path.join(dir,'privacy'));
    await fs.writeFile(path.join(dir,'seo-config.json'),'{"base":"https://site.invalid/"}');
    await fs.writeFile(path.join(dir,'privacy/index.html'),'<code data-privacy-host="fonts.gstatic.com" data-privacy-role="load">fonts.gstatic.com</code><code data-privacy-host="github.com" data-privacy-role="navigation">github.com</code>'+footer);
    await fs.writeFile(path.join(dir,'page.html'),(mention?'<!-- https://evil.invalid/reference -->':'')+source+footer);
    if(mention)await fs.writeFile(path.join(dir,'privacy-non-request-mentions.json'),JSON.stringify({version:1,mentions:[{kind:'non-request mention',file:'page.html',host:'evil.invalid',reason:'Reviewed inert comment only.'}]}));
    return dir;
}
function cli(dir){return spawnSync(process.execPath,[path.join(root,'scripts/check-privacy-hosts.mjs'),dir],{encoding:'utf8',timeout:20000});}
async function rejected(source,match){
    const dir=await fixture(source),result=await inspectPrivacyHosts(dir);
    assert.ok(result.errors.length);
    if(match)assert.ok(result.errors.some(error=>error.includes(match)),JSON.stringify(result.errors));
    const command=cli(dir);assert.equal(command.status,1);
    assert.doesNotMatch(command.stdout+command.stderr,/https?:|\/\/|data:|@/i);
}
for(const [tag,attribute] of [['iframe','src'],['object','data'],['embed','src']])for(const type of ['text/html','image/svg+xml'])for(const encoding of ['percent','base64'])test(`${tag} inspects ${encoding} ${type} despite an inert exemption`,async()=>{
    const body=type==='text/html'?'<img src="https://evil.invalid/x">':'<svg><image xlink:href="https://evil.invalid/x"/></svg>';
    const source=`<${tag} ${attribute}="${attr(data(body,type,encoding))}"></${tag}>`;
    assert.ok(referencedHosts(source,{kind:'html',baseURL:'https://site.invalid/'}).has('evil.invalid'));
    await rejected(source,'unlisted external host evil.invalid');
});
test('nested percent/base64 documents and srcdoc are inspected',async()=>{
    const inner=data('<svg><image href="https://evil.invalid/x"/></svg>','image/svg+xml','base64');
    const middle=data(`<object data="${inner}"></object>`);
    await rejected(`<iframe srcdoc="${attr(`<embed src="${middle}">`)}"></iframe>`,'unlisted external host evil.invalid');
});
test('a navigation host in a data document cannot authorise a load',()=>rejected(`<iframe src="${data('<img src="https://github.com/x">','text/html','base64')}"></iframe>`,'resource load requires load disclosure for github.com'));
test('supported data documents using a load host pass',async()=>{
    const dir=await fixture(`<iframe src="${data('<img src="https://fonts.gstatic.com/x">')}"></iframe>`);
    assert.deepEqual((await inspectPrivacyHosts(dir)).errors,[]);assert.equal(cli(dir).status,0);
});
for(const value of ['data:text/html,%GG','data:text/html;base64,@@@','data:text/html;base64,/w==','data:text/html;charset=utf-16,%3Chtml%3E','data:image/svg+xml,%E0%A4','data:text/html','data:text/html;base64,A'])test('undecodable data document fails closed: '+value,()=>rejected(`<iframe src="${attr(value)}"></iframe>`,'cannot parse complete public references'));
test('document recursion is bounded in both inspection layers',async()=>{
    let source='<p>Local</p>';
    for(let i=0;i<DOCUMENT_DEPTH_LIMIT+2;i++)source=`<iframe src="${data(source,'text/html','base64')}"></iframe>`;
    assert.throws(()=>referencedHosts(source,{kind:'html',baseURL:'https://site.invalid/'}));
    assert.throws(()=>backstopHosts(source));
    await rejected(source,'cannot parse complete public references');
});
test('data decoding supports unpadded base64, literal plus and a byte cap',()=>{
    assert.equal(decodeDataDocument('data:text/html;base64,'+Buffer.from('<p>+</p>').toString('base64').replace(/=+$/,'')),'<p>+</p>');
    assert.equal(decodeDataDocument('data:text/html,%3Cp%3E+%3C%2Fp%3E'),'<p>+</p>');
    assert.throws(()=>decodeDataDocument('data:text/html,'+'x'.repeat(1024*1024+1)));
});
for(const prefix of ['%22','x_'])test('backstop sees a scheme following '+prefix,()=>assert.ok(backstopHosts(prefix+'https://evil.invalid/x').has('evil.invalid')));
for(const encoding of ['percent','base64'])test('backstop independently sweeps decoded '+encoding+' data text',async()=>{
    const encoded=data('<!-- x_https://evil.invalid/x -->','text/html',encoding);
    assert.ok(backstopHosts('<!-- '+encoded+' -->').has('evil.invalid'));
    const dir=await fixture('<!-- '+encoded+' -->',{mention:false});
    assert.ok((await inspectPrivacyHosts(dir)).errors.some(error=>error.includes('backstop found unlisted host evil.invalid')));
});
const loads=[['SVG href','<svg><image href="https://github.com/x"/></svg>'],['SVG xlink:href','<svg><image xlink:href="https://github.com/x"/></svg>'],['ping','<a href="/" ping="https://github.com/ping">Local</a>'],...['icon','apple-touch-icon','modulepreload','preload','prefetch','manifest','stylesheet','preconnect','dns-prefetch','alternate preload'].map(rel=>['link '+rel,`<link rel="${rel}" href="https://github.com/x">`])];
for(const [name,source] of loads)test('navigation disclosure cannot authorise '+name,()=>rejected(source,'resource load requires load disclosure for github.com'));
test('a declared navigation does not create a load capability',async()=>assert.deepEqual((await inspectPrivacyHosts(await fixture('<a href="https://github.com/x">Source</a>'))).errors,[]));
test('declared load hosts can supply the guarded resource forms',async()=>{
    for(const [,source] of loads)assert.deepEqual((await inspectPrivacyHosts(await fixture(source.replaceAll('github.com','fonts.gstatic.com')))).errors,[]);
});
