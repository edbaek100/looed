import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(os.tmpdir(),'approval-test-'));
const {createApp,names}=await import('./server.js');
const {createFileStore}=await import('./store.js');
const {createAuth}=await import('./auth.js');
const password='test-only-friends-password';
const secret='test-only-session-secret-at-least-32-characters';
const server=createApp({store:createFileStore(dir),auth:createAuth({password,secret})});
let cookie='';
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
async function call(url,data){const r=await fetch(base+url,data?{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(data)}:{headers:{Cookie:cookie}});return {status:r.status,body:await r.json()};}
test('shared approval workflow, conflict handling and persisted data',async()=>{
 try{
  const page=await fetch(base);assert.match(await page.text(),/우리끼리 결재실/);
  assert.equal((await call('/api/rooms',{})).status,401);
  assert.equal((await call('/api/rooms/'+'a'.repeat(36))).status,401);
  assert.equal((await call('/api/login',{password:'wrong-password'})).status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
  assert.equal(login.status,200);cookie=login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
  const cross=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie,Origin:'https://outsider.example'},body:'{}'});assert.equal(cross.status,403);
  const nullBody=await fetch(base+'/api/rooms/'+ 'a'.repeat(36),{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:'null'});assert.equal(nullBody.status,400);
  const created=await call('/api/rooms',{});assert.equal(created.status,201);const id=created.body.id;const url='/api/rooms/'+id;
  let room=created.body;
  assert.equal((await call(url,{action:'approve',name:names[1],version:0})).status,409);
  const simultaneous=await Promise.all([call(url,{action:'approve',name:names[0],version:0}),call(url,{action:'approve',name:names[0],version:0})]);
  assert.deepEqual(simultaneous.map(x=>x.status).sort(),[200,409]);
  room=(await call(url)).body;assert.equal(room.approvals.length,1);
  for(const name of names.slice(1)){const next=await call(url,{action:'approve',name,version:room.version});assert.equal(next.status,200);room=next.body;}
  assert.equal(room.approvals.length,4);
  room=(await call(url,{action:'order',order:[...names].reverse(),version:room.version})).body;assert.equal(room.approvals.length,0);assert.equal(room.order[0],names[3]);
  assert.equal((await call(url,{action:'order',order:[names[0],names[0],names[2],names[3]],version:room.version})).status,400);
  room=(await call(url,{action:'approve',name:names[3],version:room.version})).body;
  room=(await call(url,{action:'edit',title:'주말 소풍',body:'함께 놀아요',version:room.version})).body;assert.equal(room.title,'주말 소풍');assert.equal(room.approvals.length,0);
  const {readFile}=await import('node:fs/promises');assert.deepEqual(JSON.parse(await readFile(path.join(dir,id+'.json'),'utf8')),room);
  assert.equal((await call('/api/rooms/'+'a'.repeat(36))).status,404);
  assert.equal((await call(url,{action:'reset',version:room.version-1})).status,409);
  for(let i=0;i<55;i++) room=(await call(url,{action:'reset',version:room.version})).body;
  assert.equal(room.history.length,62); // 4 approvals, reorder, approval, edit, 55 resets.
  const second=createApp({store:createFileStore(dir),auth:createAuth({password,secret})});
  await new Promise(resolve=>second.listen(0,'127.0.0.1',resolve));
  try {
   const restored=await fetch(`http://127.0.0.1:${second.address().port}`+url,{headers:{Cookie:cookie}});
   assert.equal(restored.status,200);assert.deepEqual(await restored.json(),room);
  }finally{await new Promise(resolve=>second.close(resolve));}
  const logout=await fetch(base+'/api/logout',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:'{}'});assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  cookie='';assert.equal((await call(url)).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});
