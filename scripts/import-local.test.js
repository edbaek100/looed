import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
test('local migration imports new rooms and preserves existing remote rooms and source files',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'approval-import-'));
 const state={version:0,history:[],order:[],approvals:[]};
 const file=path.join(dir,'a'.repeat(36)+'.json');
 try{
  await writeFile(file,JSON.stringify(state));await writeFile(path.join(dir,'b'.repeat(36)+'.json'),JSON.stringify(state));
  const bootstrap=`
   import assert from 'node:assert/strict';
   process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_SERVICE_ROLE_KEY='test-key';
   process.argv=['node','import-local.js',${JSON.stringify(dir)}];
   let inserts=0;
   globalThis.fetch=async(url,options)=>{
    if(options.method==='GET')return Response.json(url.searchParams.get('id').slice(3).startsWith('b')?[{state:{version:10}}]:[]);
    assert.equal(options.method,'POST');const row=JSON.parse(options.body);assert.equal(row.id,'a'.repeat(36));inserts++;return Response.json([row]);
   };
   await import(${JSON.stringify(new URL('./import-local.js',import.meta.url).href)});
   assert.equal(inserts,1);
  `;
  const result=spawnSync(process.execPath,['--input-type=module','-e',bootstrap],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Imported room/);assert.match(result.stdout,/Skipped existing room/);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')),state);
 }finally{await rm(dir,{recursive:true,force:true});}
});
