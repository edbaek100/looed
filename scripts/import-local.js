// Optional one-time migration. Does not delete source files or overwrite remote rooms.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createSupabaseStore } from '../store.js';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try{process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
const directory=path.resolve(process.argv[2]||path.join(root,'data'));
const store=createSupabaseStore({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
for(const name of await readdir(directory)){
 if(!/^[a-f0-9]{36}\.json$/.test(name))continue;
 const id=name.slice(0,-5), state=JSON.parse(await readFile(path.join(directory,name),'utf8'));
 if(!Number.isInteger(state.version)||!Array.isArray(state.history)||!Array.isArray(state.order)||!Array.isArray(state.approvals))throw new Error('Invalid local room file. Migration stopped.');
 let exists=false;
 try{await store.get(id);exists=true;}catch(e){if(e.status!==404)throw e;}
 if(exists){console.log('Skipped existing room:',id);continue;}
 await store.save(id,state);console.log('Imported room:',id);
}
