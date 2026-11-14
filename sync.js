/* UKECareers – Supabase sync layer: auth, versioned saves, realtime, presence, mobile shell */
(function(){'use strict';
const C=window.UKEC_CONFIG||{},U=window.UKECSync={},COLS=['tasks','sponsors','log','avail','inits','profiles','gloss','links'];
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
/* ---- mobile shell: top app bar + off-canvas drawer (≤820px) ---- */
const MQ=window.matchMedia('(max-width: 820px)'),XI='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const navEl=()=>{const n=$('nav');if(n&&!n.id){n.id='side';n.setAttribute('aria-label','Main navigation')}return n};
const isOpen=()=>document.body.classList.contains('nav-open');
function setNav(open,noFocus){const n=navEl(),bg=$('#burger'),m=$('main');if(!n||!bg)return;open=!!open&&MQ.matches;const was=isOpen();
 document.body.classList.toggle('nav-open',open);bg.setAttribute('aria-expanded',String(open));bg.setAttribute('aria-label',open?'Close menu':'Open menu');
 n.inert=MQ.matches&&!open;if(m)m.inert=open;
 if(open&&!was){const a=n.querySelector('a.on')||n.querySelector('a');a&&a.focus({preventScroll:true})}
 else if(!open&&was&&n.contains(document.activeElement)){if(noFocus)document.activeElement.blur();else bg.focus({preventScroll:true})}}
function navX(){const n=navEl();if(!n||n.querySelector('.nav-x'))return;const x=document.createElement('button');x.type='button';x.className='g nav-x';x.setAttribute('aria-label','Close menu');x.innerHTML=XI;n.prepend(x)}
function title(){const t=$('#bar .bt'),a=$('nav a.on');if(!t)return;const s=a?[...a.childNodes].filter(c=>c.nodeType===3).map(c=>c.textContent).join('').trim():'';t.textContent=s||'UKECareers'}
function ensureBar(){if($('#bar'))return;const b=document.createElement('header');b.id='bar';
 b.innerHTML='<button id="burger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="side"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><b class="bt">UKECareers</b><span id="sync" class="sp warn" role="status"></span><span id="onl" class="onl"></span><button id="so" class="g" hidden>Sign out</button>';
 document.body.appendChild(b);const s=document.createElement('div');s.id='scrim';s.setAttribute('aria-hidden','true');document.body.appendChild(s);
 const close=()=>setNav(false);navEl();navX();title();setNav(false);
 $('#burger').onclick=()=>setNav(!isOpen());s.onclick=close;
 window.addEventListener('hashchange',()=>setNav(false,1));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){e.preventDefault();close()}});
 const n=navEl();if(n){
  // tapping any destination (even the current one) or the close button dismisses the drawer
  n.addEventListener('click',e=>{if(e.target.closest('.nav-x'))close();else if(e.target.closest('a[href]'))setNav(false,1)});
  // swipe the drawer left to dismiss
  let x0=null,y0=0;n.addEventListener('touchstart',e=>{const t=e.touches[0];x0=t.clientX;y0=t.clientY},{passive:true});
  n.addEventListener('touchend',e=>{if(x0===null)return;const t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;x0=null;if(dx<-60&&Math.abs(dx)>Math.abs(dy)*1.5)close()},{passive:true})}
 (MQ.addEventListener?MQ.addEventListener('change',close):MQ.addListener(close));
 $('#so').onclick=()=>sb&&sb.auth.signOut();
 window.addEventListener('online',()=>{st='connecting';ui();COLS.forEach(c=>cbs[c]&&pull(c))});window.addEventListener('offline',()=>{st='offline';ui()});ui()}
function card(h){const d=document.createElement('div');d.id='login';d.innerHTML='<div class="lc">'+h+'</div>';document.body.appendChild(d);return d}
function login(){return new Promise(res=>{const d=card('<h1>UKECareers workspace</h1><p class="mut">Sign in with your team email.</p><form><input id="lE" type="email" autocomplete="email" placeholder="you@email.com" required><input id="lP" type="password" autocomplete="current-password" placeholder="Password"><button class="p" id="lGo">Sign in</button></form><button type="button" class="g" id="lMl">Email me a sign-in link instead</button><div id="lM" class="sm mut"></div>');
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
 person='';
 sb.channel('records-live').on('postgres_changes',{event:'*',schema:'public',table:'records'},p=>{const r=p.new;if(!r||!cache[r.coll]||ver[r.coll+':'+r.id]===r.version)return;cache[r.coll][r.id]=r.data;ver[r.coll+':'+r.id]=r.version;lastSync=new Date();later(r.coll);ui()})
  .subscribe(s=>{if(s==='SUBSCRIBED'){const was=st;st='live';ui();if(was==='offline')COLS.forEach(c=>cbs[c]&&pull(c))}else if(s==='CHANNEL_ERROR'||s==='TIMED_OUT'||s==='CLOSED'){st='offline';ui()}});
 const pc=sb.channel('ukec-online',{config:{presence:{key:Math.random().toString(36).slice(2)}}});
 pc.on('presence',{event:'sync'},()=>{online=Object.values(pc.presenceState()).map(a=>a[0]&&a[0].name||'Guest');ui()}).subscribe(s=>{if(s==='SUBSCRIBED')pc.track({name:localStorage.getItem('ukec_me')||'Guest'})});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine)COLS.forEach(c=>cbs[c]&&pull(c))});
 return{person,collection:c=>({doc:id=>({set:o=>{write(c,id,o);return Promise.resolve()}}),onSnapshot:cb=>{cbs[c]=cb;pull(c)}})}};
/* ---- mobile: icon-only buttons, collapsible table rows, filter drawer (all hidden/inert above 820px via CSS) ---- */
const SV=p=>'<svg class="i ibi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
const IC={plus:'<path d="M12 5v14M5 12h14"/>',edit:'<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',logs:'<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',open:'<path d="M7 17L17 7M9 7h8v8"/>',chev:'<path d="M6 9l6 6 6-6"/>',filter:'<path d="M4 5h16l-6 7.5V19l-4-2v-4.5z"/>'};
const ICR=[[/^\+/,'plus'],[/^edit\b/i,'edit'],[/^(delete|remove)\b/i,'trash'],[/^view logs$/i,'logs'],[/^view details$/i,'open']];
function iconize(){document.querySelectorAll('main button:not(.ib):not(.rtg)').forEach(b=>{if(b.closest('.tfb'))return;const t=b.textContent.trim();if(!t)return;
 if(b.querySelector('svg')){[...b.childNodes].forEach(c=>{if(c.nodeType===3&&c.textContent.trim()){const s=document.createElement('span');s.className='bl';s.textContent=c.textContent.trim();c.replaceWith(s)}});b.classList.add('ib');if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',t);return}
 const r=ICR.find(([re])=>re.test(t));if(!r)return;b.classList.add('ib','ibx');if(r[1]==='plus')b.classList.add('p');if(!b.getAttribute('aria-label'))b.setAttribute('aria-label',t.replace(/^\+\s*/,''));b.innerHTML=SV(IC[r[1]])+'<span class="bl">'+esc(t)+'</span>'})}
// columns summarised on the collapsed row (in table order); everything else waits for expand
const META={'Assigned':1,'Owner(s)':1,'Responsible':1,'Type':1,'Dates':1,'Deadline':1,'University':1,'Priority':1,'Status':1,'QC status':1,'Availability':1},OPEN=new Set();
const rkey=r=>{const s=r.querySelector('[data-st],[data-qc]'),f=r.querySelector('td');return(location.hash.split('/')[0]||'#dash')+'|'+(s?(s.dataset.st||s.dataset.qc):(f?f.textContent.trim().slice(0,80):''))};
function sumOf(r){return[...r.children].filter(c=>c.tagName==='TD'&&META[c.dataset.l]).map(c=>{const sel=c.querySelector('select');
  if(sel){const o=sel.options[sel.selectedIndex],k=['ok','warn','bad'].find(x=>sel.classList.contains(x))||'';return o?'<span class="tag '+k+'">'+esc(o.text)+'</span>':''}
  const tg=c.querySelector('.tag');if(tg)return tg.outerHTML;const t=c.textContent.trim();return t?'<span'+(c.classList.contains('redt')?' class="redt"':'')+'>'+esc(t)+'</span>':''}).filter(Boolean).join('')}
function rowSet(r,open,fit){r.classList.toggle('open',open);const b=r.querySelector('.rtg');if(b){b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Hide details':'Show details')}
 open?OPEN.add(r.dataset.rk):OPEN.delete(r.dataset.rk);const w=fit&&r.closest('.tt');if(w&&window.ttFit)window.ttFit(w.parentElement)}
function rows(){document.querySelectorAll('main table').forEach(t=>{if(!t.querySelector('th'))return;t.querySelectorAll('tr').forEach(r=>{const f=r.querySelector('td');if(!f||r.dataset.rk!==undefined||r.classList.contains('tnone'))return;
  r.classList.add('rc');r.dataset.rk=rkey(r);
  const s=sumOf(r);if(s){const d=document.createElement('div');d.className='rsum';d.innerHTML=s;f.appendChild(d)}
  const b=document.createElement('button');b.type='button';b.className='g rtg';b.innerHTML=SV(IC.chev);f.prepend(b);
  // rows whose tap used to navigate keep that action as an explicit "Open" button
  const oc=r.getAttribute('onclick')||'',a=r.querySelector('td:last-child');
  if(/location\.hash|viewItem/.test(oc)&&a&&a!==f&&a.querySelector('button')){const o=document.createElement('button');o.type='button';o.className='ib ibx ropen';o.setAttribute('aria-label','Open');o.innerHTML=SV(IC.open)+'<span class="bl">Open</span>';o.onclick=e=>{e.stopPropagation();r.onclick&&r.onclick.call(r,e)};a.prepend(o)}
  rowSet(r,OPEN.has(r.dataset.rk),0)})})}
// on phones a tap on a row toggles it instead of firing the row's own onclick
document.addEventListener('click',e=>{if(!MQ.matches)return;const r=e.target.closest&&e.target.closest('main tr.rc');if(!r)return;
 if(!e.target.closest('.rtg')&&e.target.closest('a[href],button,select,input,textarea,label,summary'))return;
 e.stopPropagation();e.preventDefault();rowSet(r,!r.classList.contains('open'),1)},true);
function tfbEnh(){document.querySelectorAll('main .tfb:not([data-m])').forEach(b=>{b.dataset.m=1;const ctl=[...b.querySelectorAll(':scope > select.tf, :scope > .tf-od')];if(!ctl.length)return;
  const btn=document.createElement('button');btn.type='button';btn.className='g tfb-btn';btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-label','Filters');btn.innerHTML=SV(IC.filter)+'<span class="tfb-n" hidden></span>';
  const chips=document.createElement('div');chips.className='tfb-chips';
  const pop=document.createElement('div');pop.className='tfb-pop';ctl.forEach(c=>pop.appendChild(c));
  const ft=document.createElement('div');ft.className='tfb-ft';ft.innerHTML='<span class="tfb-c mut sm"></span><button type="button" class="g tfb-clr">Clear all</button><button type="button" class="p tfb-ok">Done</button>';pop.appendChild(ft);
  const tq=b.querySelector('.tq');if(tq)tq.after(btn,chips,pop);else b.prepend(btn,chips,pop);
  const on=c=>c.tagName==='SELECT'?!!c.value:c.querySelector('input').checked,lab=c=>c.tagName==='SELECT'?c.options[c.selectedIndex].text:c.textContent.trim();
  const fire=el=>el.dispatchEvent(new Event('change',{bubbles:true})),clr=c=>{if(c.tagName==='SELECT')c.value='';else c.querySelector('input').checked=false};
  const upd=()=>{const act=ctl.filter(on),n=btn.querySelector('.tfb-n');n.textContent=act.length;n.hidden=!act.length;
   chips.innerHTML=act.map(c=>'<button type="button" class="tfb-chip" data-i="'+ctl.indexOf(c)+'" aria-label="Remove filter: '+esc(lab(c))+'">'+esc(lab(c))+' <span aria-hidden="true">×</span></button>').join('');
   const tc=b.querySelector('.tcnt');ft.querySelector('.tfb-c').textContent=tc&&tc.textContent?'Showing '+tc.textContent:''};
  const show=o=>{b.classList.toggle('fopen',o);btn.setAttribute('aria-expanded',String(o))};
  btn.onclick=()=>show(!b.classList.contains('fopen'));ft.querySelector('.tfb-ok').onclick=()=>show(false);
  ft.querySelector('.tfb-clr').onclick=()=>{ctl.forEach(clr);fire(ctl[0])};
  chips.onclick=e=>{const x=e.target.closest('.tfb-chip');if(!x)return;const c=ctl[+x.dataset.i];clr(c);fire(c.tagName==='SELECT'?c:c.querySelector('input'))};
  b.addEventListener('change',()=>setTimeout(upd));b.addEventListener('input',()=>setTimeout(upd));upd()})}
U.enhance=function(){document.querySelectorAll('main table').forEach(t=>{const h=[...t.querySelectorAll('th')].slice(0,12).map(x=>x.textContent.trim());t.querySelectorAll('tr').forEach(r=>[...r.children].forEach((c,i)=>{if(c.tagName==='TD'){if(h[i])c.dataset.l=h[i];if(!c.children.length&&!c.textContent.trim())c.classList.add('emp')}}))});
 iconize();rows();tfbEnh();navX();title();
 if(window.ttFit)document.querySelectorAll('main .tt').forEach(w=>window.ttFit(w.parentElement))};
})();
