/* UKECareers – Supabase sync layer: auth, versioned saves, realtime, presence, mobile shell */
(function(){'use strict';
const C=window.UKEC_CONFIG||{},U=window.UKECSync={},COLS=['tasks','sponsors','log','avail','inits','profiles','gloss'];
let sb=null,ver={},cache={},cbs={},tm={},st='local',saving=0,saved=0,lastSync=null,online=[],errMsg='',person='';
COLS.forEach(c=>cache[c]={});
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const hm=d=>d?d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}):'';
function ui(){const el=$('#sync');if(!el)return;let k='ok',t='Live';
 if(st==='local'){k='warn';t='Not connected'}else if(!navigator.onLine||st==='offline'){k='bad';t='Offline – reconnecting…'}else if(st==='connecting'){k='warn';t='Connecting…'}
 if(errMsg){k='bad';t=errMsg}else if(saving>0){k='warn';t='Saving…'}else if(saved){k='ok';t='Saved'}
 el.className='sp '+k;el.innerHTML='<i></i><span>'+esc(t)+'</span>'+(lastSync&&st==='live'&&!errMsg?'<small>Updated '+hm(lastSync)+'</small>':'');
 const o=$('#onl');if(o){o.textContent=online.length?online.length+' online':'';o.title=online.join(', ')}}
function fail(m){errMsg=m;ui();window.say&&window.say(m);clearTimeout(U._e);U._e=setTimeout(()=>{errMsg='';ui()},6000)}
function ensureBar(){if($('#bar'))return;const b=document.createElement('div');b.id='bar';
 b.innerHTML='<button id="burger" aria-label="Menu"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><b class="bt">UKECareers</b><span id="sync" class="sp warn"></span><span id="onl" class="onl"></span><button id="so" class="g" hidden>Sign out</button>';
 document.body.appendChild(b);const s=document.createElement('div');s.id='scrim';document.body.appendChild(s);
 const close=()=>document.body.classList.remove('nav-open');$('#burger').onclick=()=>document.body.classList.toggle('nav-open');s.onclick=close;
 window.addEventListener('hashchange',close);$('#so').onclick=()=>sb&&sb.auth.signOut();
 window.addEventListener('online',()=>{st='connecting';ui();COLS.forEach(c=>cbs[c]&&pull(c))});window.addEventListener('offline',()=>{st='offline';ui()});ui()}
function card(h){const d=document.createElement('div');d.id='login';d.innerHTML='<div class="lc">'+h+'</div>';document.body.appendChild(d);return d}
function login(){return new Promise(res=>{const d=card('<h1>UKECareers <em>workspace</em></h1><p class="mut">Sign in with your team email.</p><form><input id="lE" type="email" autocomplete="email" placeholder="you@email.com" required><input id="lP" type="password" autocomplete="current-password" placeholder="Password"><button class="p" id="lGo">Sign in</button></form><button type="button" class="g" id="lMl">Email me a sign-in link instead</button><div id="lM" class="sm mut"></div>');
 const m=t=>$('#lM').textContent=t;
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();m('Signing in…');const{error}=await sb.auth.signInWithPassword({email:$('#lE').value.trim(),password:$('#lP').value});if(error)m(error.message)};
 $('#lMl').onclick=async()=>{const email=$('#lE').value.trim();if(!email)return m('Enter your email first.');const{error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}});m(error?error.message:'Check your inbox for the sign-in link.')};
 sb.auth.onAuthStateChange((e,s)=>{if(s){d.remove();res(s)}})})}
async function pull(c){const{data,error}=await sb.from('records').select('id,data,version').eq('coll',c);if(error){fail('Could not load '+c+': '+error.message);return}
 cache[c]={};data.forEach(r=>{cache[c][r.id]=r.data;ver[c+':'+r.id]=r.version});lastSync=new Date();if(st!=='offline')st='live';emit(c);ui()}
function emit(c){const f=cbs[c];if(!f)return;const ds=Object.values(cache[c]);f({empty:!ds.length,metadata:{fromCache:false},docs:ds.map(d=>({data:()=>d}))})}
function later(c){clearTimeout(tm[c]);tm[c]=setTimeout(()=>emit(c),200)}
async function write(c,id,o){if(!navigator.onLine){fail('You are offline – this change was not saved');return}
 saving++;saved=0;ui();
 try{const k=c+':'+id,{data,error}=await sb.rpc('save_record',{p_coll:c,p_id:id,p_data:o,p_expected:ver[k]??null});if(error)throw error;ver[k]=data.version;
  if(data.conflict){cache[c][id]=data.data;later(c);fail('Someone else changed this first – showing their version. Please re-apply your edit.')}
  else{cache[c][id]=o;lastSync=new Date();saved=1;clearTimeout(U._s);U._s=setTimeout(()=>{saved=0;ui()},2500)}
 }catch(e){fail('Could not save: '+(e.message||e))}finally{saving--;ui()}}
U.connect=async function(){ensureBar();
 if(!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY||!window.supabase){st='local';ui();return null}
 st='connecting';ui();sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 let{data:{session}}=await sb.auth.getSession();if(!session)session=await login();
 sb.auth.onAuthStateChange(e=>{if(e==='SIGNED_OUT')location.reload()});$('#so').hidden=false;
 const{data:m}=await sb.from('members').select('person').ilike('email',session.user.email).maybeSingle();
 if(!m){card('<h1>Access <em>pending</em></h1><p class="mut">'+esc(session.user.email)+' is not on the UKECareers team list yet. Ask the admin to add it.</p><button class="g" onclick="location.reload()">Reload</button>');await sb.auth.signOut();return new Promise(()=>{})}
 person=m.person||'';
 sb.channel('records-live').on('postgres_changes',{event:'*',schema:'public',table:'records'},p=>{const r=p.new;if(!r||!cache[r.coll]||ver[r.coll+':'+r.id]===r.version)return;cache[r.coll][r.id]=r.data;ver[r.coll+':'+r.id]=r.version;lastSync=new Date();later(r.coll);ui()})
  .subscribe(s=>{if(s==='SUBSCRIBED'){const was=st;st='live';ui();if(was==='offline')COLS.forEach(c=>cbs[c]&&pull(c))}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'||s==='CLOSED'){st='offline';ui()}});
 const pc=sb.channel('ukec-online',{config:{presence:{key:person||session.user.email}}});
 pc.on('presence',{event:'sync'},()=>{online=Object.keys(pc.presenceState());ui()}).subscribe(s=>{if(s==='SUBSCRIBED')pc.track({at:Date.now()})});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)COLS.forEach(c=>cbs[c]&&pull(c))});
 return{person,collection:c=>({doc:id=>({set:o=>{write(c,id,o);return Promise.resolve()}}),onSnapshot:cb=>{cbs[c]=cb;pull(c)}})}};
U.enhance=function(){document.querySelectorAll('main table').forEach(t=>{const h=[...t.querySelectorAll('th')].slice(0,12).map(x=>x.textContent.trim());t.querySelectorAll('tr').forEach(r=>[...r.children].forEach((c,i)=>{if(c.tagName==='TD'&&h[i])c.dataset.l=h[i]}))})};
})();
