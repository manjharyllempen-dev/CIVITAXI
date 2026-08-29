function go(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));const e=document.getElementById(id);if(e)e.classList.add('active');scrollTo(0,0)}
function nativeShare(text){if(window.Android&&Android.share)Android.share(text);else if(navigator.share)navigator.share({text});else alert(text)}
function money(v){return 'S/ '+Number(v||0).toFixed(2)}
function escapeHTML(v){return String(v==null?'':v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fieldValue(id){const el=document.getElementById(id);return el?String(el.value==null?'':el.value):''}
function setFieldMessage(id,text){const el=document.getElementById(id);if(el)el.textContent=text||''}
async function login(emailId,passId,next){const email=fieldValue(emailId).trim(),pass=fieldValue(passId);const r=await Civi.signIn(email,pass);if(r.access_token)go(next);else alert(r.msg||r.error_description||'No se pudo iniciar sesión')}
function currentPosition(){return new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(new Error('Tu dispositivo no permite obtener la ubicación.'));return}navigator.geolocation.getCurrentPosition(resolve,()=>reject(new Error('Activa la ubicación del teléfono para solicitar el viaje.')),{enableHighAccuracy:true,maximumAge:10000,timeout:15000})})}
async function geocodePeru(q){const url='https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pe&limit=1&addressdetails=1&q='+encodeURIComponent(q);const r=await fetch(url,{headers:{'Accept':'application/json','Accept-Language':'es'}});if(!r.ok)throw new Error('No se pudo ubicar el destino.');const rows=await r.json();if(!rows[0])throw new Error('No encontré ese destino en Perú. Agrega distrito o ciudad.');return{lat:Number(rows[0].lat),lng:Number(rows[0].lon),name:rows[0].display_name||q}}
async function routeEstimate(origin,destination){const url='https://router.project-osrm.org/route/v1/driving/'+origin.lng+','+origin.lat+';'+destination.lng+','+destination.lat+'?overview=false&steps=false';const r=await fetch(url);if(!r.ok)throw new Error('No se pudo calcular la ruta.');const j=await r.json();const route=j.routes&&j.routes[0];if(!route)throw new Error('No encontré una ruta vehicular para ese destino.');return{km:route.distance/1000,min:route.duration/60}}
function estimateFare(km,min){const fare=Math.max(5,3+(Number(km)||0)*1.6+(Number(min)||0)*0.12);return Math.ceil(fare*2)/2}
let civiGeoWatch=null,lastGeoSent=0;
function startTripLocation(tripId){if(!navigator.geolocation||!tripId)return;stopTripLocation();civiGeoWatch=navigator.geolocation.watchPosition(async p=>{const now=Date.now();if(now-lastGeoSent<7000)return;lastGeoSent=now;try{await Civi.addLocation(tripId,p.coords.latitude,p.coords.longitude,p.coords.heading||0,(p.coords.speed||0)*3.6)}catch(e){}},()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:12000})}
function stopTripLocation(){if(civiGeoWatch!==null&&navigator.geolocation){navigator.geolocation.clearWatch(civiGeoWatch);civiGeoWatch=null}}
function civiRoleLabel(){const t=(document.title||'').toLowerCase();if(t.includes('chofer'))return'CHOFER';if(t.includes('administrador'))return'ADMINISTRADOR';return'USUARIO'}
function installLogoFix(){if(document.getElementById('civiLogoFix'))return;const style=document.createElement('style');style.id='civiLogoFix';style.textContent='.brand:before,.splash-logo{background-image:url("civitaxi-logo.svg")!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important;background-color:#ffc72c!important;border-color:#ffffffcc!important}.brand:before{width:96px!important;height:96px!important;box-shadow:0 0 0 3px #ffc72c66,0 12px 34px #000b!important}.splash-logo{box-shadow:0 0 0 3px #fff,0 0 48px #ffc72c66,0 30px 70px #000!important}';document.head.appendChild(style)}
function installCiviSplash(){if(document.getElementById('civiSplash'))return;const el=document.createElement('div');el.id='civiSplash';el.className='splash';el.innerHTML='<div class="splash-card"><div class="splash-logo" aria-hidden="true"></div><div class="splash-title">Civi<span>Taxi</span></div><div class="splash-kicker">'+civiRoleLabel()+' · LA SEGURIDAD EN LA RUTA</div></div>';document.body.appendChild(el);setTimeout(()=>{el.classList.add('hide');setTimeout(()=>el.remove(),420)},1650)}
function installPasswordVisibility(){document.querySelectorAll('input[type="password"]').forEach(input=>{if(input.dataset.civiPassword==='1')return;input.dataset.civiPassword='1';const wrap=document.createElement('div');wrap.className='password-wrap';input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);const btn=document.createElement('button');btn.type='button';btn.className='password-toggle';btn.textContent='👁';btn.setAttribute('aria-label','Mostrar contraseña');btn.setAttribute('title','Mostrar contraseña');btn.addEventListener('click',()=>{const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'🙈':'👁';btn.setAttribute('aria-label',show?'Ocultar contraseña':'Mostrar contraseña');btn.setAttribute('title',show?'Ocultar contraseña':'Mostrar contraseña')});wrap.appendChild(btn)})}
function applyCiviIdentity(){const brand=document.querySelector('.brand');if(!brand)return;const role=civiRoleLabel();brand.textContent=role==='USUARIO'?'CiviTaxi':'CiviTaxi · '+(role==='ADMINISTRADOR'?'Admin':'Chofer')}
function installSafeAuthHandlers(){const role=civiRoleLabel();if(role==='CHOFER'){
window.driverLogin=async function(){try{setFieldMessage('loginMsg','Ingresando...');const mail=fieldValue('email').trim();const password=fieldValue('pass');if(!mail||!password)throw new Error('Ingresa correo y contraseña.');await Civi.signIn(mail,password);setFieldMessage('loginMsg','');await initDriver();if(typeof resumeDriverTrip==='function'&&driver&&!(await resumeDriverTrip()))go('home')}catch(e){setFieldMessage('loginMsg',e.message)}};
window.driverRegister=async function(){try{const fullName=fieldValue('name').trim();const mail=fieldValue('regEmail').trim().toLowerCase();const password=fieldValue('regPass');const documentNumber=fieldValue('dni').trim();const licenseNumber=fieldValue('license').trim();if(!fullName)throw new Error('Ingresa tu nombre completo.');if(!/^\S+@\S+\.\S+$/.test(mail))throw new Error('Ingresa un correo válido.');if(password.length<8)throw new Error('La contraseña debe tener al menos 8 caracteres.');if(!documentNumber||!licenseNumber)throw new Error('Completa DNI y licencia.');localStorage.setItem('pending_driver_dni',documentNumber);localStorage.setItem('pending_driver_license',licenseNumber);setFieldMessage('regMsg','Creando y activando tu cuenta...');await Civi.signUp(mail,password,fullName,'chofer');await ensurePendingDriver();setFieldMessage('regMsg','Cuenta creada. Tu registro fue enviado para aprobación.');await initDriver();go('home')}catch(e){setFieldMessage('regMsg',e.message)}};
}else if(role==='ADMINISTRADOR'){
// El APK Administrador define sus propios manejadores de acceso y registro.
// No se sobrescriben aquí para mantener la regla segura del primer administrador.
}else{
window.userLogin=async function(){try{setFieldMessage('loginMsg','Ingresando...');const mail=fieldValue('email').trim();const password=fieldValue('pass');if(!mail||!password)throw new Error('Ingresa correo y contraseña.');await Civi.signIn(mail,password);setFieldMessage('loginMsg','');if(!(await resumePassengerTrip()))go('home')}catch(e){setFieldMessage('loginMsg',e.message)}};
window.userRegister=async function(){try{const fullName=fieldValue('name').trim();const mail=fieldValue('regEmail').trim().toLowerCase();const password=fieldValue('regPass');if(!fullName)throw new Error('Ingresa tu nombre completo.');if(!/^\S+@\S+\.\S+$/.test(mail))throw new Error('Ingresa un correo válido.');if(password.length<8)throw new Error('La contraseña debe tener al menos 8 caracteres.');setFieldMessage('regMsg','Creando y activando tu cuenta...');await Civi.signUp(mail,password,fullName,'usuario');setFieldMessage('regMsg','Cuenta creada y activada. Bienvenido a CiviTaxi.');if(!(await resumePassengerTrip()))go('home')}catch(e){setFieldMessage('regMsg',e.message)}};
}}
function initCiviUi(){installLogoFix();applyCiviIdentity();installPasswordVisibility();installSafeAuthHandlers();installCiviSplash()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCiviUi);else initCiviUi();

function installReferenceDesign(){
  if(document.getElementById('civiReferenceDesign'))return;
  const style=document.createElement('style');style.id='civiReferenceDesign';
  style.textContent=`
  body{background:radial-gradient(circle at 50% -10%,#3a1148 0,#170820 34%,#07030b 72%,#030105 100%)!important;background-attachment:fixed!important}
  body:after{content:'';position:fixed;inset:0;pointer-events:none;z-index:-1;background-image:url('civitaxi-logo.svg');background-repeat:no-repeat;background-position:center 72%;background-size:min(78vw,430px);opacity:.035;filter:saturate(1.2)}
  .app{max-width:520px!important;margin:0 auto!important;min-height:100vh!important;padding-bottom:24px!important}
  .brand{position:sticky!important;top:0!important;z-index:50!important;backdrop-filter:blur(18px)!important;background:linear-gradient(180deg,#08030df5,#08030dcc)!important;border-bottom:1px solid #ffc72c44!important;padding:14px 18px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;min-height:72px!important;box-sizing:border-box!important}
  .brand:before{content:''!important;display:block!important;width:54px!important;height:54px!important;flex:0 0 54px!important;border-radius:16px!important;background-image:url('civitaxi-logo.svg')!important;background-color:transparent!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important;border:1px solid #ffc72c88!important;box-shadow:0 0 0 2px #7b00ff33,0 8px 26px #0008!important}
  .screen{position:relative!important;padding-top:20px!important}
  .screen.active:before{content:'';display:block;width:64px;height:64px;margin:0 auto 14px;border-radius:18px;background:url('civitaxi-logo.svg') center/contain no-repeat;box-shadow:0 8px 30px #0008,0 0 0 1px #ffc72c44}
  .card{background:linear-gradient(160deg,#1b0c2df2,#100719f2)!important;border:1px solid #ffc72c42!important;box-shadow:0 18px 45px #0007!important}
  .btn{letter-spacing:.35px!important;box-shadow:0 10px 24px #0005!important}
  .btn:not(.secondary){background:linear-gradient(135deg,#ffc72c,#ff9f0a)!important;color:#08030d!important;border:0!important}
  .btn.secondary{background:linear-gradient(135deg,#7b00ff33,#c22cff22)!important;border:1px solid #ffc72c55!important;color:#fff!important}
  .btn-danger{background:linear-gradient(135deg,#7b1220,#b21f35)!important;color:#fff!important;border:1px solid #ff9b9b55!important}
  .input,.select,.search{background:#100719e8!important;border-color:#ffc72c55!important;color:#fff!important}
  .splash{background:radial-gradient(circle at 50% 35%,#421452,#120719 58%,#030105 100%)!important}
  .splash-logo{background-image:url('civitaxi-logo.svg')!important;background-color:transparent!important;background-size:contain!important;border-radius:28px!important}
  .splash-title span{color:#ffc72c!important}
  `;
  document.head.appendChild(style);
}

async function robustGeocodePeru(q){
  const text=String(q||'').trim();if(!text)throw new Error('Ingresa una dirección.');
  try{
    const url='https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pe&limit=1&addressdetails=1&q='+encodeURIComponent(text);
    const r=await fetch(url,{headers:{'Accept':'application/json','Accept-Language':'es-PE,es;q=0.9'}});
    if(r.ok){const rows=await r.json();if(rows&&rows[0])return{lat:Number(rows[0].lat),lng:Number(rows[0].lon),name:rows[0].display_name||text}}
  }catch(e){}
  try{
    const r=await fetch('https://photon.komoot.io/api/?limit=8&lang=es&q='+encodeURIComponent(text+', Perú'));
    if(r.ok){const j=await r.json();const f=(j.features||[]).find(x=>{const p=x.properties||{};return String(p.countrycode||p.country||'').toLowerCase().includes('pe')||String(p.country||'').toLowerCase().includes('per')})||(j.features||[])[0];if(f&&f.geometry&&Array.isArray(f.geometry.coordinates)){const p=f.properties||{};const c=f.geometry.coordinates;return{lat:Number(c[1]),lng:Number(c[0]),name:[p.name,p.street,p.district,p.city,p.state,'Perú'].filter(Boolean).join(', ')||text}}}
  }catch(e){}
  throw new Error('No encontré esa dirección. Escribe calle, distrito y ciudad.');
}

async function robustRouteEstimate(originPoint,destinationPoint){
  try{
    const url='https://router.project-osrm.org/route/v1/driving/'+Number(originPoint.lng)+','+Number(originPoint.lat)+';'+Number(destinationPoint.lng)+','+Number(destinationPoint.lat)+'?overview=false&steps=false&alternatives=false';
    const r=await fetch(url);if(r.ok){const j=await r.json();const route=j.routes&&j.routes[0];if(route&&Number.isFinite(route.distance)&&Number.isFinite(route.duration))return{km:route.distance/1000,min:Math.max(1,route.duration/60)}}
  }catch(e){}
  const rad=v=>Number(v)*Math.PI/180,R=6371;const a1=rad(originPoint.lat),a2=rad(destinationPoint.lat),dLat=rad(destinationPoint.lat-originPoint.lat),dLng=rad(destinationPoint.lng-originPoint.lng);const h=Math.sin(dLat/2)**2+Math.cos(a1)*Math.cos(a2)*Math.sin(dLng/2)**2;const straight=2*R*Math.asin(Math.min(1,Math.sqrt(h)));const km=Math.max(.4,straight*1.28);return{km,min:Math.max(2,km/24*60)};
}

function installPassengerRouteFix(){
  if(civiRoleLabel()!=='USUARIO')return;
  window.prepareTrip=async function(){
    if(!Civi.token()){go('login');return}
    const originEl=document.getElementById('origin'),destinationEl=document.getElementById('destination'),homeMsgEl=document.getElementById('homeMsg');
    if(!originEl||!destinationEl)return;
    const oText=String(originEl.value||'').trim(),dest=String(destinationEl.value||'').trim();
    if(!oText){if(homeMsgEl)homeMsgEl.textContent='Ingresa la dirección de origen o pulsa USAR MI UBICACIÓN.';return}
    if(!dest){if(homeMsgEl)homeMsgEl.textContent='Ingresa la dirección de destino.';return}
    try{
      if(homeMsgEl)homeMsgEl.textContent='Calculando la ruta...';
      let o,oName;
      if(originEl.dataset.lat&&originEl.dataset.lng){o={lat:Number(originEl.dataset.lat),lng:Number(originEl.dataset.lng)};oName=oText==='Mi ubicación actual'?oText:'Mi ubicación actual'}
      else{const og=await robustGeocodePeru(oText);o={lat:og.lat,lng:og.lng};oName=og.name}
      const d=await robustGeocodePeru(dest);const route=await robustRouteEstimate(o,d);const fare=typeof passengerFare==='function'?await passengerFare(route.km,route.min):estimateFare(route.km,route.min);
      draftTrip={origin_address:oName,origin_lat:o.lat,origin_lng:o.lng,destination_address:d.name,destination_lat:d.lat,destination_lng:d.lng,estimated_distance_km:Number(route.km.toFixed(2)),estimated_duration_min:Math.max(1,Math.round(route.min)),estimated_fare:fare,payment_method:'efectivo'};
      const routeEl=document.getElementById('previewRoute'),distanceEl=document.getElementById('previewDistance'),timeEl=document.getElementById('previewTime'),fareEl=document.getElementById('previewFare'),previewMsgEl=document.getElementById('previewMsg');
      if(routeEl)routeEl.textContent='📍 '+oName+' → 🏁 '+d.name;if(distanceEl)distanceEl.textContent=route.km.toFixed(1)+' km';if(timeEl)timeEl.textContent=Math.round(route.min)+' min';if(fareEl)fareEl.textContent=money(fare);if(homeMsgEl)homeMsgEl.textContent='';if(previewMsgEl)previewMsgEl.textContent='';go('preview');setTimeout(()=>{try{if(window.CiviMap)CiviMap.route('mapPreview',o,d,oName,d.name)}catch(e){}},120);
    }catch(e){if(homeMsgEl)homeMsgEl.textContent=e.message||'No se pudo calcular la ruta.'}
  };
}

function installAdminDriverDelete(){
  if(civiRoleLabel()!=='ADMINISTRADOR'||typeof window.renderDrivers!=='function')return;
  window.renderDrivers=function(){
    const status=document.getElementById('driverFilter')?.value||'',q=(document.getElementById('driverSearch')?.value||'').trim().toLowerCase();
    const rows=driverRows.filter(d=>(!status||d.status===status)&&(!q||String(d.document_number||'').toLowerCase().includes(q)||String(d.license_number||'').toLowerCase().includes(q)));
    const list=document.getElementById('driversList');if(!list)return;
    list.innerHTML=rows.map(d=>'<div class="card"><div class="pill">'+escapeHTML(d.status)+'</div><h3>'+escapeHTML(d.document_number||'Sin DNI')+'</h3><p>Licencia: '+escapeHTML(d.license_number||'—')+' · ⭐ '+Number(d.rating||0).toFixed(1)+'</p><p class="mini muted">'+(d.is_available?'Disponible':'No disponible')+'</p><div class="actions">'+(d.status!=='aprobado'?'<button class="btn" onclick="setDriverStatus(\''+d.id+'\',\'aprobado\')">APROBAR</button>':'')+(d.status!=='suspendido'?'<button class="btn secondary" onclick="setDriverStatus(\''+d.id+'\',\'suspendido\')">SUSPENDER</button>':'')+(d.status==='pendiente'?'<button class="btn secondary" onclick="setDriverStatus(\''+d.id+'\',\'rechazado\')">RECHAZAR</button>':'')+'<button class="btn btn-danger" onclick="deleteDriverAdmin(\''+d.id+'\')">ELIMINAR</button></div></div>').join('')||'<div class="card empty">No hay choferes.</div>';
  };
  window.deleteDriverAdmin=async function(id){
    if(!confirm('¿Eliminar este chofer de CiviTaxi? Esta acción lo desactiva y lo quita del listado.'))return;
    try{await Civi.deleteDriver(id);await loadDrivers();await refreshDashboard();alert('Chofer eliminado.')}catch(e){alert(e.message||'No se pudo eliminar el chofer.')}
  };
}

function initCivi2026Hotfixes(){installReferenceDesign();installPassengerRouteFix();installAdminDriverDelete()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initCivi2026Hotfixes);else initCivi2026Hotfixes();
