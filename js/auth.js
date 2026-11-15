/* ===== Авторизация: выбор автомойки, PIN-код, сохранение сессии ===== */
/* ===== Выбор автомойки и сохранение сессии без пароля ===== */
const LOC_ID_KEY='carwash_loc_id';
const LOC_NAME_KEY='carwash_loc_name';
const LOC_AUTHED_KEY='carwash_authed_loc';

let locationsCache={};
let pendingLocId=null;
let isNewLocation=false;

function renderLocationList(){
 const el=document.getElementById('locList');
 if(!el)return;
 const q=(document.getElementById('locSearch').value||'').trim().toLowerCase();
 const entries=Object.entries(locationsCache).filter(([id,l])=>l&&l.name&&l.name.toLowerCase().includes(q));
 entries.sort((a,b)=>a[1].name.localeCompare(b[1].name,'ru'));
 el.innerHTML=entries.length?entries.map(([id,l])=>`<button type="button" class="loc-item" onclick="selectLocation('${id}')">${esc(l.name)}</button>`).join(''):
   `<div class="empty" style="padding:18px">Автомоек пока нет — добавьте свою ниже</div>`;
}

function addNewLocation(){
 const input=document.getElementById('newLocName');
 const name=input.value.trim();
 if(!name){toast('Введите название автомойки');return}
 const dup=Object.entries(locationsCache).find(([id,l])=>l&&l.name&&l.name.toLowerCase()===name.toLowerCase());
 if(dup){input.value='';selectLocation(dup[0]);return}
 const ref=locationsRef.push();
 ref.set({
   name,
   passwordHash:null,
   role:'location',
   isSuperAdmin:false,
   createdAt:new Date().toISOString()
 }).then(()=>{
   input.value='';
   selectLocation(ref.key);
 }).catch(()=>toast('Не удалось добавить автомойку — проверьте подключение'));
}

function selectLocation(id){
 const loc=locationsCache[id];
 if(!loc)return;
 pendingLocId=id;
 isNewLocation=!(loc.passwordHash||loc.password);
 document.getElementById('authSelectStep').style.display='none';
 document.getElementById('authPinStep').style.display='block';
 document.getElementById('authLocName').textContent=loc.name;
 document.getElementById('authPinTitle').textContent=isNewLocation?'Придумайте пароль из 4 цифр для этой автомойки':'Введите пароль для входа';
 document.getElementById('pinConfirmWrap').style.display=isNewLocation?'block':'none';
 document.getElementById('pinInput').value='';
 document.getElementById('pinConfirmInput').value='';
 document.getElementById('pinError').textContent='';
 setTimeout(()=>document.getElementById('pinInput').focus(),50);
}

function backToLocationList(){
 pendingLocId=null;
 document.getElementById('authPinStep').style.display='none';
 document.getElementById('authSelectStep').style.display='block';
}

async function submitPin(){
 const pin=document.getElementById('pinInput').value.trim();
 const errEl=document.getElementById('pinError');
 if(!/^\d{4}$/.test(pin)){errEl.textContent='Пароль должен состоять из 4 цифр';return}
 const loc=locationsCache[pendingLocId];
 if(!loc)return;

 const enteredSaltedHash = await hashPin(pin, pendingLocId);
 const enteredLegacyHash = await sha256(pin);

 if(isNewLocation){
   const confirmPin=document.getElementById('pinConfirmInput').value.trim();
   if(confirmPin!==pin){errEl.textContent='Пароли не совпадают';return}
   locationsRef.child(pendingLocId).update({
     passwordHash: enteredSaltedHash,
     password: null,
     role: loc.role || 'location'
   }).then(()=>{
     verifyAndCompleteLogin(pendingLocId, loc.name);
   }).catch(()=>{errEl.textContent='Не удалось сохранить пароль, попробуйте снова';});
 }else{
   // Поддерживаем как новый соленый хеш, так и легаси не соленый или открытый пароль
   const valid = (loc.passwordHash && (loc.passwordHash === enteredSaltedHash || loc.passwordHash === enteredLegacyHash))
              || (loc.password && String(loc.password) === pin);
   if(!valid){errEl.textContent='Неверный пароль';return}

   // Бесшовный апгрейд до соленого хеша при первом успешном входе
   if(loc.passwordHash !== enteredSaltedHash || loc.password){
     locationsRef.child(pendingLocId).update({
       passwordHash: enteredSaltedHash,
       password: null
     }).catch(()=>{});
   }
   verifyAndCompleteLogin(pendingLocId, loc.name);
 }
}

function verifyAndCompleteLogin(id, name){
 const loc = (locationsCache && locationsCache[id]) || { name: name };
 const isSuper = checkIsSuperAdmin(loc, id);
 localStorage.setItem('is_super_admin', isSuper ? '1' : '0');
 localStorage.setItem(LOC_AUTHED_KEY, id);
 completeLogin(id, name);
}

function completeLogin(id,name){
 localStorage.setItem(LOC_ID_KEY,id);
 localStorage.setItem(LOC_NAME_KEY,name);
 document.getElementById('authScreen').classList.add('hide');
 document.getElementById('appRoot').style.display='';
 startApp(id,name);
}

function logoutLocation(){
 if(!confirm('Сменить автомойку? При следующем входе понадобится пароль.'))return;
 localStorage.removeItem(LOC_ID_KEY);
 localStorage.removeItem(LOC_NAME_KEY);
 localStorage.removeItem(LOC_AUTHED_KEY);
 localStorage.removeItem('is_super_admin');
 location.reload();
}

document.getElementById('pinInput').addEventListener('keydown',e=>{if(e.key==='Enter')submitPin()});
document.getElementById('pinConfirmInput').addEventListener('keydown',e=>{if(e.key==='Enter')submitPin()});

/* Первое обращение к базе выполняем только после того, как Firebase
   подтвердит анонимную сессию — иначе правила (auth != null) отклонят
   запрос. onAuthStateChanged может сработать повторно (например, при
   обновлении токена), поэтому инициализацию запускаем только один раз. */
let firebaseBootstrapped = false;
firebase.auth().onAuthStateChanged(function(user){
 if(!user || firebaseBootstrapped) return;
 firebaseBootstrapped = true;

 locationsRef.on('value',snap=>{
  locationsCache=snap.val()||{};
  if(document.getElementById('authSelectStep').style.display!=='none')renderLocationList();
  initSuperAdminView();
 });

 (function initAuth(){
  const savedId=localStorage.getItem(LOC_ID_KEY);
  const authedId=localStorage.getItem(LOC_AUTHED_KEY);
  if(!savedId)return;

  if(authedId && authedId === savedId){
    document.getElementById('authSelectStep').style.display='none';
    locationsRef.once('value').then(snap=>{
      locationsCache=snap.val()||{};
      const loc=locationsCache[savedId];
      if(loc){
        const isSuper = checkIsSuperAdmin(loc, savedId);
        localStorage.setItem('is_super_admin', isSuper ? '1' : '0');
        completeLogin(savedId, loc.name);
      }else{
        localStorage.removeItem(LOC_ID_KEY);
        localStorage.removeItem(LOC_NAME_KEY);
        localStorage.removeItem(LOC_AUTHED_KEY);
        document.getElementById('authSelectStep').style.display='block';
        renderLocationList();
      }
    }).catch(()=>{
      const savedName=localStorage.getItem(LOC_NAME_KEY)||'Автомойка';
      completeLogin(savedId, savedName);
    });
    return;
  }

  document.getElementById('authSelectStep').style.display='none';
  locationsRef.once('value').then(snap=>{
    locationsCache=snap.val()||{};
    const loc=locationsCache[savedId];
    if(loc){
      selectLocation(savedId);
    }else{
      localStorage.removeItem(LOC_ID_KEY);
      localStorage.removeItem(LOC_NAME_KEY);
      document.getElementById('authSelectStep').style.display='block';
      renderLocationList();
    }
  }).catch(()=>{
    document.getElementById('authSelectStep').style.display='block';
  });
 })();
});
