import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from './auth.js';
import { configuredApp } from './server.js';
const password='test-only-entrance-password';
const secret='test-only-signing-secret-at-least-32-characters';
const request=cookie=>({headers:{cookie:cookie.split(';')[0]}});
test('secure cookies, tampering, expiry, rotation and restart',()=>{
 let clock=1700000000000;
 const auth=createAuth({password,secret,secure:true,now:()=>clock});
 const {cookie}=auth.login(password);
 assert.match(cookie,/^__Host-approval_session=/);assert.match(cookie,/; Secure/);
 assert.equal(auth.authenticated(request(cookie)),true);
 assert.equal(auth.authenticated(request(cookie.replace('=', '=x'))),false);
 assert.equal(createAuth({password,secret,secure:true,now:()=>clock}).authenticated(request(cookie)),true);
 assert.equal(createAuth({password:password+'changed',secret,secure:true,now:()=>clock}).authenticated(request(cookie)),false);
 assert.equal(createAuth({password,secret:secret+'changed',secure:true,now:()=>clock}).authenticated(request(cookie)),false);
 clock+=7*24*60*60*1000+1;assert.equal(auth.authenticated(request(cookie)),false);
});
test('global failed-password rate limit and recovery',()=>{
 let clock=1700000000000;const auth=createAuth({password,secret,now:()=>clock});
 for(let i=0;i<10;i++)assert.equal(auth.login('incorrect').status,401);
 assert.equal(auth.login(password).status,429);
 clock+=15*60*1000+1;assert.equal(auth.login(password).status,200);
});
test('production fails closed with missing credentials or local-only storage',()=>{
 assert.throws(()=>configuredApp({}),/APP_PASSWORD/);
 assert.throws(()=>configuredApp({APP_PASSWORD:password}),/SESSION_SECRET/);
 assert.throws(()=>configuredApp({NODE_ENV:'production',APP_PASSWORD:password,SESSION_SECRET:secret}),/Production requires Supabase/);
 assert.throws(()=>configuredApp({NODE_ENV:'production',APP_PASSWORD:password,SESSION_SECRET:secret,SUPABASE_URL:'http://example.com',SUPABASE_SERVICE_ROLE_KEY:'test'}),/SUPABASE_URL/);
});
