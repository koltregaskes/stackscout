export const DOCUMENT_DEPTH_LIMIT = 16;
const MAX_DOCUMENT_BYTES = 1024 * 1024;

// Data documents are inspected as source, never loaded or executed. Restrict
// supported text encodings so malformed/ambiguous documents cannot disappear.
export function decodeDataDocument(value, {required=false}={}) {
    if(!/^data:/i.test(value))return null;
    const comma=value.indexOf(',');
    if(comma<0)throw Error('Malformed data document');
    const parts=value.slice(5,comma).split(';');
    const type=parts.shift().toLowerCase();
    if(!['text/html','image/svg+xml'].includes(type)){
        if(required)throw Error('Unsupported data document type');
        return null;
    }
    let base64=false;
    for(const part of parts){
        if(/^base64$/i.test(part)&&!base64)base64=true;
        else if(!/^charset=(?:utf-8|us-ascii)$/i.test(part))throw Error('Unsupported data document encoding');
    }
    const payload=value.slice(comma+1);
    if(payload.length>MAX_DOCUMENT_BYTES*4)throw Error('Data document exceeds inspection limit');
    let decoded;
    try {decoded=decodeURIComponent(payload);}catch{throw Error('Cannot decode data document');}
    if(base64){
        const encoded=decoded.replace(/[\t\n\f\r ]/g,'');
        if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4===1
            || encoded.includes('=')&&encoded.length%4!==0)throw Error('Invalid data document base64');
        const bytes=Buffer.from(encoded,'base64');
        if(bytes.toString('base64').replace(/=+$/,'')!==encoded.replace(/=+$/,''))throw Error('Invalid data document base64');
        if(bytes.length>MAX_DOCUMENT_BYTES)throw Error('Data document exceeds inspection limit');
        try {decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('Cannot decode data document text');}
    }
    if(Buffer.byteLength(decoded,'utf8')>MAX_DOCUMENT_BYTES)throw Error('Data document exceeds inspection limit');
    return decoded;
}
