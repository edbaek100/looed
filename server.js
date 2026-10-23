import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createAuth } from './auth.js';
import { createFileStore, createSupabaseStore } from './store.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const names = ['백은동','전하영','맹가은','김경민'];
const root = path.dirname(fileURLToPath(import.meta.url));

function fail(message, status=400) { throw Object.assign(new Error(message), {status}); }
export function update(room, input) {
 if (input.version !== room.version) fail('다른 친구가 먼저 수정했어요. 최신 내용을 확인하고 다시 해주세요.',409);
 if(input.action==='order') {
  if(!Array.isArray(input.order)||input.order.length!==4||new Set(input.order).size!==4||!input.order.every(n=>names.includes(n))) fail('결재자를 확인해주세요.');
  room.order=input.order;
  room.approvals=[];
  room.history.unshift({text:'결재 순서를 변경하고 승인을 초기화했어요.',at:new Date().toISOString()});
 } else if(input.action==='edit') {
  if(typeof input.title!=='string'||!input.title.trim()||input.title.length>100||typeof input.body!=='string'||input.body.length>5000) fail('제목(100자)과 내용(5,000자)을 확인해주세요.');
  room.title=input.title.trim(); room.body=input.body; room.approvals=[];
  room.history.unshift({text:'문서를 수정하고 승인을 초기화했어요.',at:new Date().toISOString()});
 } else if(input.action==='approve') {
  if(room.order[room.approvals.length]!==input.name) fail('현재 차례인 결재자만 승인할 수 있어요.',409);
  const at=new Date().toISOString(); room.approvals.push({name:input.name,at});
  room.history.unshift({text:input.name+' 님이 승인했어요.',at});
 } else if(input.action==='reset') {
  room.approvals=[]; room.history.unshift({text:'새 결재를 시작했어요.',at:new Date().toISOString()});
 } else fail('알 수 없는 요청이에요.');
 room.version++; return room;
}
async function body(req) {
 const chunks=[];let size=0;
 for await (const chunk of req) {size+=chunk.length;if(size>24000)fail('요청이 너무 커요.',413);chunks.push(chunk);}
 let input;
 try { input=JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('잘못된 요청이에요.'); }
 if(!input||typeof input!=='object'||Array.isArray(input)) fail('잘못된 요청이에요.');
 return input;
}
export function createApp({ store, auth, secure = false }) {
const locks=new Map();
return http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 res.setHeader('Cache-Control','no-store');
 if(secure) res.setHeader('Strict-Transport-Security','max-age=31536000');
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try {
  const url=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&url.pathname==='/health') return send(200,{ok:true});
  if(req.method==='POST') {
   if(req.headers['content-type']?.split(';')[0].trim()!=='application/json') fail('JSON 요청만 사용할 수 있어요.',415);
   const origin=req.headers.origin;
   if(req.headers['sec-fetch-site']==='cross-site'||(origin&&origin!==`${secure?'https':'http'}://${req.headers.host}`)) fail('다른 사이트에서 보낸 요청은 허용하지 않아요.',403);
  }
  if(req.method==='POST'&&url.pathname==='/api/login') {
   const result=auth.login((await body(req)).password);
   if(result.cookie) res.setHeader('Set-Cookie',result.cookie);
   if(result.status===429) res.setHeader('Retry-After','900');
   return send(result.status,result.error?{error:result.error}:{ok:true});
  }
  if(req.method==='POST'&&url.pathname==='/api/logout') { res.setHeader('Set-Cookie',auth.logoutCookie()); return send(200,{ok:true}); }
  if(url.pathname.startsWith('/api/')&&!auth.authenticated(req)) fail('입장 비밀번호를 입력해주세요.',401);
  if(req.method==='GET'&&url.pathname==='/api/session') return send(200,{ok:true});
  if(req.method==='POST'&&url.pathname==='/api/rooms') {
   const id=randomBytes(18).toString('hex');
   const room={title:'오늘 저녁 치킨 먹기 품의서',body:'오늘도 수고한 우리를 위해 치킨 회식을 신청합니다.\n\n• 메뉴: 반반치킨 + 콜라\n• 장소: 우리의 아지트\n• 요청사항: 맛있게 먹고 행복하기\n\n검토 후 너그러운 승인 부탁드립니다. 🍗',order:[...names],approvals:[],history:[],version:0};
   await store.save(id,room); return send(201,{id,...room});
  }
  const match=url.pathname.match(/^\/api\/rooms\/([a-f0-9]{36})$/);
  if(match) {
   const id=match[1];
   if(req.method==='GET') return send(200,await store.get(id));
   if(req.method==='POST') {
    const input=await body(req);
    const job=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(async()=>{const current=await store.get(id);const next=update(structuredClone(current),input);await store.save(id,next,current.version);return next;});
    locks.set(id,job); try { return send(200,await job); } finally {if(locks.get(id)===job) locks.delete(id);}
   }
  }
  if(req.method!=='GET') return send(404,{error:'찾을 수 없어요.'});
  const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css','/robots.txt':'robots.txt'};
  const file=files[url.pathname]; if(!file) return send(404,{error:'찾을 수 없어요.'});
  const types={html:'text/html',js:'text/javascript',css:'text/css',txt:'text/plain'};
  res.writeHead(200,{'Content-Type':types[file.split('.').pop()]+'; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(await readFile(path.join(root,'public',file)));
 } catch(e) {send(e.status||500,{error:e.status?e.message:'저장에 실패했어요. 잠시 후 다시 시도해주세요.'});}
});
}
export function configuredApp(env = process.env) {
 const secure = env.NODE_ENV === 'production';
 const auth = createAuth({ password: env.APP_PASSWORD, secret: env.SESSION_SECRET, secure });
 const remote = Boolean(env.SUPABASE_URL || env.SUPABASE_SERVICE_ROLE_KEY);
 if(secure && !remote) throw new Error('Production requires Supabase; local files cannot preserve data on Render Free.');
 const store = remote
  ? createSupabaseStore({url:env.SUPABASE_URL,key:env.SUPABASE_SERVICE_ROLE_KEY})
  : createFileStore(env.DATA_DIR || path.join(root,'data'));
 return createApp({store,auth,secure});
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 try { process.loadEnvFile(path.join(root,'.env')); } catch(e) { if(e.code!=='ENOENT') throw e; }
 configuredApp().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Approval server started'));
}
