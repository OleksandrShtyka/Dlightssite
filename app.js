import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import config from './config.js';

const key = 'svitlo.web.v1';
const starter = { activeId: 'local-home', profiles: [{ id: 'local-home', name: 'Мій дім', city: '', street: '', house: '', group: '', schedule: Array(24).fill('unknown') }], preferences: { outage: 30, powerOn: 10, notifications: true } };
let data = readLocal();
let supabase = null, user = null, isSignup = false, dayOffset = 0, editingProfileId = null;
let toastTimer;
function readLocal() { try { return { ...starter, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return structuredClone(starter); } }
function persistLocal() { localStorage.setItem(key, JSON.stringify(data)); }
function cloudPayload() {
  return { activeProfileId:data.activeId, profiles:data.profiles.map(p=>({id:p.id,name:p.name||'',address:{city:p.city||'',street:p.street||'',house:p.house||''},group:p.group||'',slots:(p.schedule||[]).map((state,hour)=>({hour,state:String(state).toUpperCase()})),updatedAt:data.updatedAt||0,addressVerified:false})), notifications:{enabled:data.preferences?.notifications??true,beforeOutageMinutes:data.preferences?.outage??30,beforePowerOnMinutes:data.preferences?.powerOn??10} };
}
function applyCloud(payload) {
  const profiles=(payload.profiles||[]).map(p=>({id:p.id,name:p.name||'',city:p.address?.city||'',street:p.address?.street||'',house:p.address?.house||'',group:p.group||'',updatedAt:p.updatedAt||0,schedule:(p.slots||[]).slice().sort((a,b)=>a.hour-b.hour).map(s=>String(s.state||'UNKNOWN').toLowerCase())}));
  const merged=[...profiles];
  (data.profiles||[]).filter(p=>addressOf(p)||p.group).forEach(local=>{if(!merged.some(cloud=>cloud.id===local.id||(cloud.city===local.city&&cloud.street===local.street&&cloud.house===local.house&&cloud.group===local.group)))merged.push(local);});
  const active=merged.find(p=>p.id===payload.activeProfileId)||merged.find(p=>p.id===data.activeId)||merged[0];
  return {activeId:active?.id||'local-home',profiles:merged.length?merged:structuredClone(starter.profiles),updatedAt:active?.updatedAt||Date.now(),preferences:{notifications:payload.notifications?.enabled??data.preferences?.notifications??true,outage:payload.notifications?.beforeOutageMinutes??data.preferences?.outage??30,powerOn:payload.notifications?.beforePowerOnMinutes??data.preferences?.powerOn??10}};
}
function activeProfile() { return data.profiles.find(p => p.id === data.activeId) || data.profiles[0]; }
function addressOf(p) { return [p.city, p.street, p.house].filter(Boolean).join(', '); }
function notify(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 2600); }
function setSync(label, online=false) { const el = document.querySelector('#sync-state'); el.querySelector('span').textContent = label; el.classList.toggle('online', online); }
function refreshAuthUI() { const form=document.querySelector('#auth-form'), switcher=document.querySelector('#auth-switch'), logout=document.querySelector('#auth-logout'); form.hidden=!!user; switcher.hidden=!!user; logout.hidden=!user; document.querySelector('#auth-title').textContent=user?'Ваш акаунт':'Увійдіть у Світло'; document.querySelector('#account-button').innerHTML=user?'Мій акаунт <span>↗</span>':'Увійти <span>↗</span>'; if(user)document.querySelector('#auth-message').textContent=`Ви увійшли як ${user.email}. Профілі синхронізуються між пристроями.`; }
function render() {
  refreshAuthUI();
  const profile = activeProfile(); if (!profile) return;
  const address = addressOf(profile);
  document.querySelector('#hero-address').textContent = address || 'Додайте адресу або групу';
  document.querySelector('#address-line').textContent = address || 'Адресу ще не додано · можна обрати групу вручну';
  document.querySelector('#preview-group').textContent = profile.group || '—';
  const state = dayOffset === 0 ? (profile.schedule?.[new Date().getHours()] || 'unknown') : 'unknown';
  const labels = { on: 'Є світло', off: 'Немає світла', maybe: 'Можливе вимкнення', unknown: 'Графік невідомий' };
  document.querySelector('#preview-status').textContent = labels[state]; document.querySelector('#large-status').textContent = labels[state];
  const blocks = dayOffset === 0 && profile.schedule?.length === 24 ? profile.schedule : Array(24).fill('unknown');
  document.querySelector('#timeline').innerHTML = blocks.map((s,i)=>`<div class="hour-block ${s==='off'?'off':s==='maybe'?'maybe':s==='unknown'?'unknown':''}" title="${String(i).padStart(2,'0')}:00 · ${labels[s]||labels.unknown}"></div>`).join('');
  document.querySelector('#mini-bars').innerHTML = blocks.map(s=>`<i class="mini-bar ${s==='off'?'off':s==='maybe'?'maybe':s==='unknown'?'unknown':''}"></i>`).join('');
  document.querySelector('#hour-labels').innerHTML = [0,6,12,18,24].map(h=>`<span>${String(h).padStart(2,'0')}:00</span>`).join('');
  document.querySelector('#time-now').style.setProperty('--hour-position', `${(new Date().getHours()+new Date().getMinutes()/60)/24*100}%`);
  document.querySelector('#today-label').textContent = dayOffset===0?'Сьогодні':dayOffset===-1?'Вчора':dayOffset===1?'Завтра':new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'short'}).format(new Date(Date.now()+dayOffset*86400000));
  document.querySelector('#updated-at').textContent = dayOffset !== 0 ? 'Для цієї дати графік ще не завантажено' : data.updatedAt ? `Оновлено ${new Date(data.updatedAt).toLocaleString('uk-UA',{hour:'2-digit',minute:'2-digit'})}` : 'Дані графіка ще не завантажено';
  const list = document.querySelector('#group-list');
  list.innerHTML = data.profiles.map(p=>`<button class="group-item ${p.id===profile.id?'active':''}" data-profile="${escapeAttr(p.id)}"><span class="group-number">${escapeHtml(p.group||'—')}</span><span class="group-info"><strong>${escapeHtml(p.name||addressOf(p)||'Профіль')}</strong><small>${escapeHtml(addressOf(p)||'Групу вибрано вручну')}</small></span><span>${p.id===profile.id?'✓':'↗'}</span></button>`).join('');
  list.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>{ data.activeId=b.dataset.profile; persistLocal(); render(); syncSave(); });
}
function escapeHtml(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s='') { return escapeHtml(s).replace(/`/g,''); }
function openProfile(add=false) { const p=activeProfile(); editingProfileId=add?null:(p?.id||null); document.querySelector('#profile-title').textContent=add?'Додати профіль':'Змінити профіль'; document.querySelector('#city').value=p?.city||''; document.querySelector('#street').value=p?.street||''; document.querySelector('#house').value=p?.house||''; const select=document.querySelector('#group-select'); const used=new Set(data.profiles.filter(x=>x.city===p?.city&&x.street===p?.street&&x.house===p?.house).map(x=>x.group)); select.value=add?Array.from({length:12},(_,i)=>`${Math.floor(i/2)+1}.${i%2+1}`).find(g=>!used.has(g))||'1.1':(p?.group||'1.1'); document.querySelector('#profile-modal').showModal(); }
async function syncSave() { persistLocal(); if(!supabase||!user)return; const {error}=await supabase.from('account_settings').upsert({user_id:user.id,payload:cloudPayload(),updated_at:new Date().toISOString()},{onConflict:'user_id'}); if(error){setSync('Збережено локально');notify('Не вдалося синхронізувати. Зміни залишилися на цьому пристрої.');}else setSync('Синхронізовано',true); }
async function loadCloud() { if(!supabase||!user)return; const {data:row,error}=await supabase.from('account_settings').select('payload').eq('user_id',user.id).maybeSingle(); if(error){notify('Не вдалося завантажити дані акаунта.');return;} if(row?.payload){data={...starter,...applyCloud(row.payload)};persistLocal();render();notify('Налаштування акаунта завантажено.');}else await syncSave(); }
function openAuth() { refreshAuthUI(); if(!user)document.querySelector('#auth-message').textContent=''; document.querySelector('#auth-modal').showModal(); }
function setAuthMode(signup) { isSignup=signup; document.querySelector('#auth-title').textContent=signup?'Створіть акаунт':'Увійдіть у Світло'; document.querySelector('#auth-submit').innerHTML=(signup?'Створити акаунт':'Увійти')+' <span>↗</span>'; document.querySelector('#auth-switch').textContent=signup?'Вже є акаунт? Увійти':'Ще немає акаунта? Створити'; document.querySelector('#auth-password').autocomplete=signup?'new-password':'current-password'; }
async function start() {
  const configured = config.url && config.anonKey && !config.url.includes('YOUR_');
  if(configured){
    supabase=createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data:sessionData}=await supabase.auth.getSession(); user=sessionData.session?.user||null;
    supabase.auth.onAuthStateChange((_event,session)=>{ user=session?.user||null; refreshAuthUI(); if(user){setSync('Синхронізація увімкнена',true);loadCloud();}else setSync('Локальний режим'); });
    if(user){setSync('Синхронізація увімкнена',true);await loadCloud();}
  }else setSync('Локальний режим');
  render();
}
document.querySelectorAll('#account-button,#hero-account,#promo-account').forEach(e=>e.addEventListener('click',openAuth));
document.querySelectorAll('#edit-address,#edit-address-2').forEach(e=>e.addEventListener('click',()=>openProfile(false)));
document.querySelectorAll('#add-group,#add-group-link').forEach(e=>e.addEventListener('click',()=>openProfile(true)));
document.querySelector('#view-full').onclick=()=>document.querySelector('#schedule').scrollIntoView({behavior:'smooth'});
document.querySelector('#refresh-button').onclick=async()=>{if(supabase&&user){await loadCloud();notify('Дані акаунта оновлено.');}else{render();notify('Показано локальний кеш. Увійдіть, щоб отримати синхронізовані дані.');}};
document.querySelector('#prev-day').onclick=()=>{dayOffset--;render();};document.querySelector('#next-day').onclick=()=>{dayOffset++;render();};
document.querySelector('#profile-form').addEventListener('submit',async e=>{e.preventDefault();const old=data.profiles.find(x=>x.id===editingProfileId);const group=document.querySelector('#group-select').value;const p={id:old?.id||crypto.randomUUID(),name:document.querySelector('#city').value.trim()||'Мій профіль',city:document.querySelector('#city').value.trim(),street:document.querySelector('#street').value.trim(),house:document.querySelector('#house').value.trim(),group,schedule:old?.group===group?(old.schedule||Array(24).fill('unknown')):Array(24).fill('unknown')};if(old){data.profiles[data.profiles.indexOf(old)]=p;}else{const starterProfile=activeProfile();if(starterProfile&&!addressOf(starterProfile)&&!starterProfile.group&&data.profiles.length===1){p.id=starterProfile.id;data.profiles[0]=p;}else data.profiles.push(p);}data.activeId=p.id;data.updatedAt=Date.now();document.querySelector('#profile-modal').close();render();await syncSave();notify('Профіль збережено.');});
document.querySelector('#auth-switch').onclick=()=>setAuthMode(!isSignup);
document.querySelector('#auth-logout').onclick=async()=>{await supabase?.auth.signOut();user=null;setSync('Локальний режим');refreshAuthUI();document.querySelector('#auth-modal').close();};
document.querySelector('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const message=document.querySelector('#auth-message');if(!supabase){message.textContent='Сервіс акаунтів ще налаштовується. Поки дані зберігаються лише на цьому пристрої.';return;}const email=document.querySelector('#auth-email').value.trim(),password=document.querySelector('#auth-password').value;document.querySelector('#auth-submit').disabled=true;message.textContent=isSignup?'Створюємо акаунт…':'Виконуємо вхід…';const result=isSignup?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});document.querySelector('#auth-submit').disabled=false;if(result.error){message.textContent=result.error.message;return;}if(isSignup&&!result.data.session){message.textContent='Перевірте пошту й підтвердьте адресу email, щоб завершити реєстрацію.';return;}user=result.data.user;message.textContent='Ви увійшли. Завантажуємо ваші налаштування…';await loadCloud();setSync('Синхронізовано',true);setTimeout(()=>document.querySelector('#auth-modal').close(),650);});
document.querySelector('#menu-button').onclick=()=>document.querySelector('.nav').classList.toggle('open');
for(let g=1;g<=6;g++)for(let n=1;n<=2;n++){const o=document.createElement('option');o.value=`${g}.${n}`;o.textContent=`${g}.${n}`;document.querySelector('#group-select').append(o);}
setAuthMode(false);start();setInterval(()=>{if(dayOffset===0)render();},60000);

