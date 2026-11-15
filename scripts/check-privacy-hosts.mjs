import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {sourceReferences} from './privacy-source-references.mjs';
import {backstopHosts,validateMentions} from './privacy-backstop.mjs';

export function referencedHosts(source, {kind='url',baseURL='https://koltregaskes.github.io/stackscout/'}={}) {
    const references=sourceReferences(source,kind);
    return structuredReferenceHosts(references,{baseURL});
}

function structuredReferenceHosts(references,{baseURL},depth=0) {
    if(depth>32)throw Error('Nested HTML exceeds the inspection limit');
    let base;
    try {base=new URL(references.base ?? baseURL,baseURL);} catch {throw Error('Cannot parse the page base reference');}
    const hosts = new Set();
    for (const value of references.values) {
        // WHATWG URL handles internal ASCII tabs/newlines, C0/space trimming,
        // backslashes, userinfo, ports, IDNs and relative references as a unit.
        const clean=value.replace(/[\t\n\r]/g,'').replace(/^[\x00-\x20]+|[\x00-\x20]+$/g,'');
        try {
            const url=new URL(value,base);
            if(!url.hostname&&/^(?:https?:|[\\/]{2})/i.test(clean))throw Error('Missing hostname');
            if(url.hostname)hosts.add(url.hostname);
        } catch {
            throw Error('Cannot parse an external URL reference in public source');
        }
    }
    for(const document of references.documents||[]){
        for(const host of structuredReferenceHosts(sourceReferences(document,'html'),{baseURL:base.href},depth+1))hosts.add(host);
    }
    return hosts;
}

export async function inspectPrivacyHosts(root) {
    const privacy = await fs.readFile(path.join(root, 'privacy/index.html'), 'utf8');
    const allowed = new Set([...privacy.matchAll(/<code\b[^>]*data-privacy-host="([a-z0-9.-]+)"[^>]*>\s*\1\s*<\/code>/g)].map(m => m[1]));
    if (!allowed.size) throw Error('Privacy notice must visibly list its external hosts');
    const siteBase = new URL(JSON.parse(await fs.readFile(path.join(root, 'seo-config.json'), 'utf8')).base);
    const own = siteBase.hostname;
    const files = [], errors = [];
    let mentions=[];
    try {mentions=validateMentions(JSON.parse(await fs.readFile(path.join(root,'privacy-non-request-mentions.json'),'utf8')));}catch(error){if(error.code!=='ENOENT')throw Error('Cannot validate non-request mention allowlist');}
    const usedMentions=new Set();
    async function walk(dir) {
        for (const item of await fs.readdir(dir, {withFileTypes:true})) {
            if (item.name.startsWith('.') || ['node_modules','scripts','tests','content','data'].includes(item.name)) continue;
            const file = path.join(dir, item.name);
            if (item.isSymbolicLink()) throw Error('Unexpected symlink in public output');
            if (item.isDirectory()) await walk(file);
            else if (/\.(html|css|js|svg)$/i.test(item.name) || item.name === 'manifest.json') files.push(file);
        }
    }
    await walk(root);
    for (const file of files) {
        const source = await fs.readFile(file, 'utf8');
        try {
            let kind=path.extname(file).slice(1).toLowerCase();
            if(kind==='svg')kind='html';
            if(kind==='json'){JSON.parse(source);kind='js';}
            const baseURL=new URL(path.relative(root,file).split(path.sep).map(encodeURIComponent).join('/'),siteBase).href;
            const extracted=sourceReferences(source,kind);
            const structured=structuredReferenceHosts(extracted,{baseURL});
            for (const host of structured) {
                if (host !== own && !allowed.has(host)) errors.push(path.relative(root,file)+': unlisted external host '+host);
            }
            for(const host of backstopHosts(source,{baseURL,decodedText:extracted.decodedText})){
                if(host===own||allowed.has(host))continue;
                const relative=path.relative(root,file).split(path.sep).join('/');
                const mention=mentions.find(entry=>entry.file===relative&&entry.host===host);
                if(mention&&!structured.has(host))usedMentions.add(mention);
                else if(!structured.has(host))errors.push(relative+': backstop found unlisted host '+host);
            }
        } catch {errors.push(path.relative(root,file)+': cannot parse complete public references');}
        if (file.endsWith('.html')) {
            const footer=source.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] || '';
            const baseURL=new URL(path.relative(root,file).split(path.sep).join('/'),siteBase);
            const privacyURL=new URL('privacy/',siteBase).href;
            const links=[...footer.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>Privacy notice<\/a>/gi)];
            if(!links.some(match=>new URL(match[1],baseURL).href===privacyURL)) errors.push(path.relative(root,file)+': missing privacy footer link');
        }
    }
    for(const mention of mentions)if(!usedMentions.has(mention))errors.push(mention.file+': unused or active non-request mention entry');
    return {files:files.length, hosts:allowed.size, errors};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
        const result = await inspectPrivacyHosts(root);
        console.log('Privacy host check: '+result.files+' public HTML/CSS/JS files, '+result.hosts+' listed hosts, '+result.errors.length+' failures');
        if (result.errors.length) {console.error(result.errors.join('\n'));process.exitCode=1;}
    } catch {
        console.error('Privacy host check failed: cannot inspect public references');
        process.exitCode=1;
    }
}
