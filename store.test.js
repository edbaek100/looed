import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from './store.js';

test('Supabase REST contract: shared records, atomic conflicts, history retained across clients',async()=>{
 const database=new Map();
 const fetchImpl=async(url,options)=>{
  assert.equal(url.origin,'https://example.supabase.co');
  assert.equal(url.pathname,'/rest/v1/approval_rooms');
  assert.equal(options.headers.apikey,'test-server-only-key');
  assert.equal(options.headers.Authorization,'Bearer test-server-only-key');
  assert.equal(options.headers.Prefer,'return=representation');
  const input=options.body?JSON.parse(options.body):undefined;
  if(options.method==='POST'){database.set(input.id,input);return Response.json([input],{status:201});}
  const id=url.searchParams.get('id').slice(3);
  const row=database.get(id);
  if(options.method==='GET')return Response.json(row?[{state:row.state}]:[]);
  assert.equal(options.method,'PATCH');
  const expected=Number(url.searchParams.get('version').slice(3));
  if(!row||row.version!==expected)return Response.json([]);
  database.set(id,{...row,...input});return Response.json([database.get(id)]);
 };
 const options={url:'https://example.supabase.co',key:'test-server-only-key',fetchImpl};
 const a=createSupabaseStore(options),b=createSupabaseStore(options),id='a'.repeat(36);
 const initial={title:'공유 문서',version:0,history:[]};await a.save(id,initial);
 assert.deepEqual(await b.get(id),initial);
 const state={...initial,version:1,history:[{text:'백은동 님이 승인했어요.'}]};
 const results=await Promise.allSettled([a.save(id,state,0),b.save(id,state,0)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
 assert.deepEqual(await createSupabaseStore(options).get(id),state);
 await assert.rejects(()=>a.get('b'.repeat(36)),{status:404});
 const failing=createSupabaseStore({...options,fetchImpl:async()=>Response.json({error:'private database error'},{status:403})});
 await assert.rejects(()=>failing.get(id),e=>e.status===503&&!e.message.includes('private'));
 const offline=createSupabaseStore({...options,fetchImpl:async()=>{throw new Error('offline');}});
 await assert.rejects(()=>offline.save(id,state,1),{status:503});
});
