import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {referencedHosts,inspectPrivacyHosts} from '../scripts/check-privacy-hosts.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
async function fixture(file, source, declaredHost='fonts.gstatic.com') {
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ktp-privacy-'));
    await fs.writeFile(path.join(dir,'seo-config.json'),'{"base":"https://site.invalid/"}');
    await fs.mkdir(path.join(dir,'privacy'),{recursive:true});
    await fs.writeFile(path.join(dir,'privacy/index.html'),`<code data-privacy-host="${declaredHost}">${declaredHost}</code><footer><a href="/privacy/">Privacy notice</a></footer>`);
    await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true});
    await fs.writeFile(path.join(dir,file),source);
    return dir;
}
test('the real public files and every footer match the notice',async()=>assert.deepEqual((await inspectPrivacyHosts(root)).errors,[]));
for(const [file,source] of [
    ['page.html','<script src="https://surprise.invalid/code.js"></script><footer><a href="/privacy/">Privacy notice</a></footer>'],
    ['assets/site.css','@import "//surprise.invalid/fonts.css";'],
    ['assets/site.js','fetch("https:\\/\\/surprise.invalid/collect")'],
    ['assets/nested/site.css','a{background:url(https://surprise.invalid/a.png)}'],
])test('an undeclared host fails in '+file,async()=>assert.ok((await inspectPrivacyHosts(await fixture(file,source))).errors.some(e=>e.includes('surprise.invalid'))));
test('declared fonts and same-origin references pass',async()=>{
    assert.deepEqual((await inspectPrivacyHosts(await fixture('site.css','@import url(https://fonts.gstatic.com/font.css);a{background:url(https://site.invalid/local.png)}'))).errors,[]);
});
test('numeric HTML entities cannot conceal a new external host',()=>assert.ok(referencedHosts('<img src="https:&#47;&#47;surprise.invalid/a">',{kind:'html'}).has('surprise.invalid')));
test('a public HTML page missing its footer privacy link fails',async()=>assert.ok((await inspectPrivacyHosts(await fixture('page.html','<main>Missing link</main>'))).errors.some(e=>e.includes('footer'))));

const footer='<footer><a href="/privacy/">Privacy notice</a></footer>';
const contexts=[
    ['HTML attribute','page.html',url=>`<img src="${url}" alt="Scene">${footer}`],
    ['HTML srcset','page.html',url=>`<img src="/local.png" srcset="${url} 1x, /local.png 2x" alt="Scene">${footer}`],
    ['HTML inline CSS','page.html',url=>`<div style="background:url('${url}')"></div>${footer}`],
    ['CSS import','site.css',url=>`@import "${url}";`],
    ['CSS url()','site.css',url=>`a{background:url(${url})}`],
    ['JavaScript string','site.js',url=>`fetch("${url}")`],
];
const forms=[
    ['query without slash','https://surprise.invalid?image=1','surprise.invalid'],
    ['fragment without slash','https://surprise.invalid#image','surprise.invalid'],
    ['protocol relative','//surprise.invalid?image=1','surprise.invalid'],
    ['uppercase scheme','HTTPS://SURPRISE.INVALID?image=1','surprise.invalid'],
    ['userinfo','https://reader@surprise.invalid?image=1','surprise.invalid'],
    ['listed host used as userinfo','https://fonts.gstatic.com@surprise.invalid#image','surprise.invalid'],
    ['port','https://surprise.invalid:8443?image=1','surprise.invalid'],
    ['default port','https://surprise.invalid:443#image','surprise.invalid'],
    ['IDN','https://bücher.invalid?image=1','xn--bcher-kva.invalid'],
    ['punycode','https://xn--bcher-kva.invalid#image','xn--bcher-kva.invalid'],
    ['protocol-relative IDN with port','//bücher.invalid:8443#image','xn--bcher-kva.invalid'],
    ['combined authority','HTTPS://reader@BÜCHER.INVALID:8443?image=1#part','xn--bcher-kva.invalid'],
];
const checker=path.join(root,'scripts/check-privacy-hosts.mjs');
function cli(dir) {
    return spawnSync(process.execPath,[checker,dir],{encoding:'utf8',timeout:10000});
}
for (const [form,url,host] of forms) for (const [context,file,render] of contexts) {
    test(`${context} rejects undeclared ${form} through the API and CLI`,async()=>{
        const dir=await fixture(file,render(url));
        assert.ok(referencedHosts(render(url),{kind:path.extname(file).slice(1),baseURL:'https://site.invalid/'}).has(host));
        const result=await inspectPrivacyHosts(dir);
        assert.ok(result.errors.some(e=>e===`${file}: unlisted external host ${host}`));
        const processResult=cli(dir);
        assert.equal(processResult.status,1,processResult.stdout+processResult.stderr);
        assert.match(processResult.stderr,new RegExp('unlisted external host '+host.replaceAll('.','\\.')));
    });
}
for (const [label,suffix] of [
    ['path','/image'],['query','?image=1'],['fragment','#image'],['port',':8443/image'],
    ['space',' '],['tab','\t'],['newline','\n'],['double quote','"'],['single quote',"'"],
    ['backtick','`'],['closing parenthesis',')'],['comma',','],['less than','<'],
    ['greater than','>'],['backslash','\\'],['semicolon',';'],
])test(`a complete URL with ${label} uses WHATWG parsing without truncation`,()=>{
    const value='https://surprise.invalid'+suffix,baseURL='https://site.invalid/';
    let url;try{url=new URL(value,baseURL);}catch{assert.throws(()=>referencedHosts(value,{baseURL}));return;}
    assert.deepEqual([...referencedHosts(value,{baseURL})],[url.hostname]);
});
test('bare authorities and single-label hosts are parsed without an ASCII-domain assumption',()=>{
    for(const url of ['https://surprise.invalid','//surprise.invalid'])assert.deepEqual([...referencedHosts(url)],['surprise.invalid']);
    assert.deepEqual([...referencedHosts('https://reader@host:8443?image=1')],['host']);
});
test('declared hosts accept equivalent uppercase, userinfo, port and protocol-relative URLs',async()=>{
    for(const url of ['HTTPS://reader@FONTS.GSTATIC.COM:443?font=1','//fonts.gstatic.com#font'])for(const [,file,render] of contexts){
        const dir=await fixture(file,render(url));
        assert.deepEqual((await inspectPrivacyHosts(dir)).errors,[]);
        const result=cli(dir);assert.equal(result.status,0,result.stdout+result.stderr);
    }
});
test('an IDN reference matches the same declared punycode host',async()=>{
    for(const [,file,render] of contexts){
        const dir=await fixture(file,render('https://bücher.invalid?image=1'),'xn--bcher-kva.invalid');
        assert.deepEqual((await inspectPrivacyHosts(dir)).errors,[]);
        const result=cli(dir);assert.equal(result.status,0,result.stdout+result.stderr);
    }
});
test('an invalid port cannot silently make an external reference disappear',()=>assert.throws(()=>referencedHosts('https://surprise.invalid:invalid/image')));
