import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const home = read('index.html');
const market = read('live.html');
const scripts = [['home-market.js',home],['live.js',market]];
for (const [name,page] of scripts) {
 const source = read(name);
 new Script(source, { filename:name });
 assert(page.includes(name + '?v='), `Missing script ${name}`);
 const ids = new Set([...page.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
 const used = new Set([...source.matchAll(/\$\('#([^']+)'\)/g)].map(m=>m[1]));
 for(const id of used) assert(ids.has(id), `Missing ${name} DOM element #${id}`);
}
assert(!home.includes('./app.js'), 'Homepage must not load demo localStorage marketplace');
for (const term of ['نسخه نمایشی','درخواست نمونه','پیشنهاد آزمایشی']) assert(!home.includes(term), `Misleading homepage language: ${term}`);
for (const path of ['terms.html','privacy.html','robots.txt','sitemap.xml','CNAME']) assert(read(path).length>15, `Missing launch asset ${path}`);
assert(read('CNAME').trim()==='gheimatyar.famgroupofficial.com','Unexpected Pages domain');
assert(read('robots.txt').includes('sitemap.xml'),'Sitemap not declared');
for (const id of ['myAwardsList','adminSupportList','supportForm','notificationsList']) assert(market.includes('id="'+id+'"'), `Missing marketplace section ${id}`);
console.log('Gheimatyar: JS parses, UI nodes, policies and SEO files pass static checks.');
