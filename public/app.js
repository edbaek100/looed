const $=id=>document.getElementById(id);
let id=new URLSearchParams(location.hash.slice(1)).get('room'), room, busy=false, dirty=false, timer, authenticated=false, draftVersion=null;
const date=s=>new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
function toast(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,4200);}
function showLogin(){
 authenticated=false;room=null;dirty=false;draftVersion=null;
 $('app').hidden=true;$('member-actions').hidden=true;$('login').hidden=false;
 $('title').value='';$('body').value='';$('stamps').replaceChildren();$('history').replaceChildren();
}
function showApp(){authenticated=true;$('login').hidden=true;$('app').hidden=false;$('member-actions').hidden=false;$('welcome').hidden=Boolean(room);$('room').hidden=!room;}
async function api(url,data){
 const r=await fetch(url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
 const json=await r.json();
 if(!r.ok){if(r.status===401&&url!=='/api/login')showLogin();throw new Error(json.error);}
 return json;
}
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function render(){
 if(!authenticated||!room)return;
 $('welcome').hidden=true;$('room').hidden=false;$('status').textContent=room.approvals.length===4?'✓ 모두 승인 완료':`결재 진행 중 · ${room.approvals.length} / 4`;
 $('docnumber').textContent='DOC. '+id.slice(0,8).toUpperCase();
 if(!dirty){$('title').value=room.title;$('body').value=room.body;}
 $('stamps').replaceChildren();$('order').replaceChildren();
 room.order.forEach((name,i)=>{
  const cell=node('div',undefined,'stamp-cell');cell.append(node('div',name,'stamp-label'));const space=node('div',undefined,'stamp-space');const approval=room.approvals.find(a=>a.name===name);
  if(approval){const seal=node('div',undefined,'seal');seal.append(node('small','승 인'),node('span',name));space.append(seal,node('span',date(approval.at),'stamp-date'));}else space.append(node('span',i===room.approvals.length?'결재 대기':'—','waiting'));cell.append(space);$('stamps').append(cell);
  const row=node('div',undefined,'person');row.append(node('span',String(i+1).padStart(2,'0'),'avatar'),node('span',name+(approval?' ✓':''),'person-name'));const arrows=node('div',undefined,'arrows');
  [-1,1].forEach(delta=>{const b=node('button',delta<0?'↑':'↓');b.setAttribute('aria-label',name+(delta<0?' 순서 위로':' 순서 아래로'));b.disabled=busy||i+delta<0||i+delta>=4;b.onclick=()=>{if(room.approvals.length&&!confirm('순서를 바꾸면 기존 승인이 초기화돼요. 변경할까요?'))return;const order=[...room.order];[order[i],order[i+delta]]=[order[i+delta],order[i]];act({action:'order',order});};arrows.append(b);});row.append(arrows);$('order').append(row);
 });
 const next=room.order[room.approvals.length];$('next').textContent=next?`지금은 ${next} 님의 결재 차례예요.`:'모두 승인했어요. 오늘의 안건, 통과!';$('approve').disabled=busy||!next||$('identity').value!==next||dirty;$('approve').textContent=next?'승인 도장 찍기':'✓ 결재 완료';$('save').disabled=busy;$('reset').disabled=busy;
 $('history').replaceChildren();if(!room.history.length)$('history').append(node('li','첫 번째 도장을 기다리고 있어요.'));$('history-count').textContent=`전체 ${room.history.length}건 · 모든 기록을 보관해요` ;room.history.forEach(h=>{const li=node('li',h.text);li.append(node('time',date(h.at)));$('history').append(li);});
}
async function refresh(){if(!authenticated||!id||busy)return;try{const requestedId=id;const latest=await api('/api/rooms/'+requestedId);if(!authenticated||requestedId!==id)return;if(!room||latest.version>room.version){room=latest;render();}}catch(e){toast(e.message);}}
async function act(data){if(busy)return;busy=true;render();try{room=await api('/api/rooms/'+id,{...data,version:data.action==='edit'?draftVersion??room.version:room.version});if(data.action==='edit'){dirty=false;draftVersion=null;}toast(data.action==='approve'?'쾅! 승인 도장을 찍었어요.':'저장했어요.');}catch(e){toast(e.message);}finally{busy=false;render();await refresh();}}
async function create(){if(busy)return;if(dirty&&!confirm('저장하지 않은 내용을 두고 새 방을 만들까요?'))return;busy=true;try{const data=await api('/api/rooms',{});id=data.id;room=data;dirty=false;draftVersion=null;history.replaceState(null,'','#room='+id);render();toast('방을 만들었어요. 초대 링크를 친구에게 보내주세요!');}catch(e){toast(e.message);}finally{busy=false;if(room)render();}}
$('create').onclick=create;$('new').onclick=create;
$('identity').onchange=()=>{try{localStorage.setItem('approval-identity',$('identity').value);}catch{}if(room)render();};
try{const stored=localStorage.getItem('approval-identity');if([...$('identity').options].some(o=>o.value===stored))$('identity').value=stored;}catch{}
for(const field of ['title','body'])$(field).oninput=()=>{if(!dirty)draftVersion=room.version;dirty=true;$('approve').disabled=true;};
$('save').onclick=()=>{if(room.approvals.length&&!confirm('문서를 수정하면 기존 승인이 초기화돼요. 저장할까요?'))return;act({action:'edit',title:$('title').value,body:$('body').value});};
$('approve').onclick=()=>act({action:'approve',name:$('identity').value});$('reset').onclick=()=>{if(confirm('모든 승인 도장을 지우고 다시 시작할까요?'))act({action:'reset'});};
$('share').onclick=async()=>{if(!id){toast('먼저 결재방을 만들어주세요.');return;}try{await navigator.clipboard.writeText(location.href);toast('초대 링크를 복사했어요! 입장 비밀번호도 친구에게 따로 알려주세요.');}catch{prompt('이 링크를 복사해서 친구에게 보내주세요.',location.href);}};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});window.addEventListener('hashchange',()=>location.reload());
if(id&&!/^[a-f0-9]{36}$/.test(id)){toast('올바르지 않은 방 링크예요. 새 방을 만들어주세요.');id=null;}
boot();setInterval(()=>{if(!document.hidden)refresh();},10000);

$('login-form').onsubmit=async e=>{
 e.preventDefault();$('login-button').disabled=true;$('login-error').textContent='';
 try{await api('/api/login',{password:$('password').value});$('password').value='';showApp();await refresh();}
 catch(e){$('login-error').textContent=e.message;}
 finally{$('login-button').disabled=false;}
};
$('logout').onclick=async()=>{
 if(dirty&&!confirm('저장하지 않은 내용이 있어요. 나갈까요?'))return;
 try{await api('/api/logout',{});showLogin();}catch(e){toast(e.message);}
};
$('export').onclick=async()=>{
 try{
  const saved=await api('/api/rooms/'+id);
  const blob=new Blob([JSON.stringify({id,exportedAt:new Date().toISOString(),...saved},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`approval-${id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('현재 문서와 전체 승인 기록을 백업했어요.');
 }catch(e){toast(e.message);}
};
async function boot(){try{await api('/api/session');showApp();await refresh();}catch{showLogin();}}
