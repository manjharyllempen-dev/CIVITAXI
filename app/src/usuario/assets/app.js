function go(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));const e=document.getElementById(id);if(e)e.classList.add('active');scrollTo(0,0)}
function nativeShare(text){try{if(window.Android&&Android.share){Android.share(String(text||''));return}}catch(e){}if(navigator.share)navigator.share({text:String(text||'')}).catch(()=>{});else alert(text)}
function nativeTripAlert(times=1,gap=850){let n=0;const once=()=>{n++;try{if(window.Android&&Android.tripAlert){Android.tripAlert()}else{const A=window.AudioContext||window.webkitAudioContext;if(A){const c=new A(),g=c.createGain(),o=c.createOscillator();o.frequency.value=880;g.gain.value=.18;o.connect(g);g.connect(c.destination);o.start();setTimeout(()=>{o.stop();c.close()},550)}}}catch(e){}if(n<times)setTimeout(once,gap)};once()}
function money(v){return 'S/ '+Number(v||0).toFixed(2)}
function escapeHTML(v){return String(v==null?'':v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function starText(v){const n=Math.max(0,Math.min(5,Number(v||0)));return '⭐ '+n.toFixed(1)}
function fieldValue(id){const el=document.getElementById(id);return el?String(el.value==null?'':el.value):''}
function setFieldMessage(id,text){const el=document.getElementById(id);if(el)el.textContent=text||''}
function toPosition(lat,lng,accuracy=0){return{coords:{latitude:Number(lat),longitude:Number(lng),accuracy:Number(accuracy||0),heading:0,speed:0}}}
function validLatLng(lat,lng){return Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Math.abs(Number(lat))<=90&&Math.abs(Number(lng))<=180}
function nativeLastLocation(){try{if(window.Android&&Android.getLastLocation){const raw=Android.getLastLocation();if(raw){const j=JSON.parse(raw);if(j&&validLatLng(j.lat,j.lng))return toPosition(j.lat,j.lng,j.accuracy)}}}catch(e){}return null}
function nativeFreshLocation(timeout=12000){return new Promise((resolve,reject)=>{try{if(!(window.Android&&Android.requestLocation)){reject(new Error('Ubicación nativa no disponible'));return}let done=false;const old=window.onNativeLocation;const timer=setTimeout(()=>{if(done)return;done=true;window.onNativeLocation=old;reject(new Error('No se obtuvo ubicación a tiempo'))},timeout);window.onNativeLocation=(ok,lat,lng,accuracy,message)=>{if(done)return;done=true;clearTimeout(timer);window.onNativeLocation=old;if(ok&&validLatLng(lat,lng))resolve(toPosition(lat,lng,accuracy));else reject(new Error(message||'No se pudo obtener la ubicación'))};Android.requestLocation()}catch(e){reject(e)}})}
function webLocation(timeout=13000){return new Promise((resolve,reject)=>{if(!navigator.geolocation){reject(new Error('Tu dispositivo no permite obtener la ubicación.'));return}navigator.geolocation.getCurrentPosition(resolve,()=>reject(new Error('Activa la ubicación y el permiso de Nova Taxi para continuar.')),{enableHighAccuracy:true,maximumAge:5000,timeout})})}
async function currentPosition(){const last=nativeLastLocation();try{const fresh=await Promise.race([nativeFreshLocation(9000),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),9500))]);if(fresh)return fresh}catch(e){}try{return await webLocation(12000)}catch(e){if(last)return last;throw e}}
async function reverseGeocodePeru(lat,lng){try{const u='https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lng);const r=await fetch(u,{headers:{'Accept':'application/json','Accept-Language':'es-PE,es;q=0.9'}});if(r.ok){const j=await r.json();if(j&&j.display_name)return j.display_name}}catch(e){}return 'Ubicación actual'}
async function geocodeSuggestionsPeru(q,limit=7){const text=String(q||'').trim();if(text.length<3)return[];try{const url='https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=pe&limit='+limit+'&addressdetails=1&dedupe=1&q='+encodeURIComponent(text);const r=await fetch(url,{headers:{'Accept':'application/json','Accept-Language':'es-PE,es;q=0.9'}});if(!r.ok)return[];const rows=await r.json();return(rows||[]).map(x=>{const a=x.address||{};const parts=[a.road||a.pedestrian||a.neighbourhood||x.name,a.suburb||a.city_district||a.district,a.city||a.town||a.village,a.province||a.state_district,a.state,'Perú'].filter(Boolean);return{lat:Number(x.lat),lng:Number(x.lon),name:parts.join(', ')||x.display_name||text,display:x.display_name||parts.join(', ')}}).filter(x=>validLatLng(x.lat,x.lng))}catch(e){return[]}}
async function geocodePeru(q){const rows=await geocodeSuggestionsPeru(q,1);if(rows[0])return{lat:rows[0].lat,lng:rows[0].lng,name:rows[0].display||rows[0].name};throw new Error('No encontré esa dirección en Perú. Escribe calle, número, distrito, provincia y departamento.')}
async function routeEstimate(origin,destination){try{const url='https://router.project-osrm.org/route/v1/driving/'+Number(origin.lng)+','+Number(origin.lat)+';'+Number(destination.lng)+','+Number(destination.lat)+'?overview=false&steps=false';const r=await fetch(url);if(r.ok){const j=await r.json();const route=j.routes&&j.routes[0];if(route&&Number.isFinite(route.distance)&&Number.isFinite(route.duration))return{km:route.distance/1000,min:Math.max(1,route.duration/60)}}}catch(e){}const rad=v=>Number(v)*Math.PI/180,R=6371,a1=rad(origin.lat),a2=rad(destination.lat),dLat=rad(destination.lat-origin.lat),dLng=rad(destination.lng-origin.lng),h=Math.sin(dLat/2)**2+Math.cos(a1)*Math.cos(a2)*Math.sin(dLng/2)**2,straight=2*R*Math.asin(Math.min(1,Math.sqrt(h))),km=Math.max(.3,straight*1.3);return{km,min:Math.max(2,km/24*60)}}
function estimateFare(km,min){const fare=Math.max(5,3+(Number(km)||0)*1.6+(Number(min)||0)*0.12);return Math.ceil(fare*2)/2}
let civiGeoTimer=null,lastGeoSent=0;
function startTripLocation(tripId){if(!tripId)return;stopTripLocation();const send=async()=>{if(Date.now()-lastGeoSent<6500)return;try{const p=await currentPosition();lastGeoSent=Date.now();await Civi.addLocation(tripId,p.coords.latitude,p.coords.longitude,p.coords.heading||0,(p.coords.speed||0)*3.6)}catch(e){}};send();civiGeoTimer=setInterval(send,8000)}
function stopTripLocation(){if(civiGeoTimer){clearInterval(civiGeoTimer);civiGeoTimer=null}}
function setupAddressAutocomplete(inputId,boxId,onSelect){const input=document.getElementById(inputId),box=document.getElementById(boxId);if(!input||!box)return;let timer=0,seq=0;const hide=()=>{box.innerHTML='';box.style.display='none'};input.addEventListener('input',()=>{input.dataset.lat='';input.dataset.lng='';clearTimeout(timer);const q=input.value.trim();if(q.length<3){hide();return}const mine=++seq;timer=setTimeout(async()=>{box.innerHTML='<div class="suggest-loading">Buscando direcciones en Perú...</div>';box.style.display='block';const rows=await geocodeSuggestionsPeru(q,7);if(mine!==seq)return;if(!rows.length){box.innerHTML='<div class="suggest-loading">Sin coincidencias. Agrega distrito o provincia.</div>';return}box.innerHTML=rows.map((r,i)=>'<button type="button" class="suggest-item" data-i="'+i+'"><b>📍 '+escapeHTML(r.name)+'</b><small>'+escapeHTML(r.display)+'</small></button>').join('');box.querySelectorAll('.suggest-item').forEach(btn=>btn.onclick=()=>{const r=rows[Number(btn.dataset.i)];input.value=r.display||r.name;input.dataset.lat=String(r.lat);input.dataset.lng=String(r.lng);hide();if(onSelect)onSelect(r)})},350)});input.addEventListener('blur',()=>setTimeout(hide,250))}
function openSms(phone,text){try{if(window.Android&&Android.openSms){Android.openSms(String(phone||''),String(text||''));return}}catch(e){}location.href='sms:'+encodeURIComponent(phone||'')+'?body='+encodeURIComponent(text||'')}
function installPasswordVisibility(){document.querySelectorAll('input[type="password"]').forEach(input=>{if(input.dataset.civiPassword)return;input.dataset.civiPassword='1';const b=document.createElement('button');b.type='button';b.className='password-toggle';b.textContent='👁';input.insertAdjacentElement('afterend',b);b.onclick=()=>{input.type=input.type==='password'?'text':'password';b.textContent=input.type==='password'?'👁':'🙈'}})}
function installPassengerPhotoRegistration(){if(!/Nova Taxi Usuario/i.test(document.title))return;const section=document.getElementById('register');if(!section||document.getElementById('userPhoto'))return;const registerButton=[...section.querySelectorAll('button')].find(b=>/REGISTRARME/i.test(b.textContent||''));if(!registerButton)return;const label=document.createElement('label');label.style.cssText='display:block;padding:12px;border:1px dashed #ffc72c88;border-radius:14px;margin:9px 0;background:#ffffff08';label.innerHTML='📷 Foto de perfil del usuario<input id="userPhoto" type="file" accept="image/*" style="display:block;margin-top:7px;width:100%">';section.insertBefore(label,registerButton);const original=window.userRegister;if(typeof original==='function'){window.userRegister=async function(){const before=Civi.userId(),file=document.getElementById('userPhoto')?.files?.[0]||null;await original();const after=Civi.userId();if(file&&after&&after!==before){try{const u=await Civi.uploadFile('civitaxi-public',file,'perfil');await Civi.updateProfile({avatar_url:u.url})}catch(e){console.warn('Foto de usuario pendiente',e)}}}}}

const CIVI_MANUAL_ROUTE_KEY='civitaxi_usuario_direccion_manual_v1';
function civiPassenger(){return /Nova Taxi Usuario/i.test(document.title)}
function civiManualField(prefix,name){return document.getElementById(prefix+name)}
function civiManualValue(prefix,name){const el=civiManualField(prefix,name);return el?String(el.value||'').trim():''}
function civiSaveManualRoute(){
  if(!civiPassenger())return;
  const ids=['originName','originStreet','originNumber','originDistrict','originProvince','originDepartment','destinationName','destinationStreet','destinationNumber','destinationDistrict','destinationProvince','destinationDepartment'];
  const data={};ids.forEach(id=>{const e=document.getElementById(id);if(e)data[id]=e.value||''});
  try{localStorage.setItem(CIVI_MANUAL_ROUTE_KEY,JSON.stringify(data))}catch(e){}
}
function civiRestoreManualRoute(){
  try{
    const data=JSON.parse(localStorage.getItem(CIVI_MANUAL_ROUTE_KEY)||'{}');
    Object.keys(data||{}).forEach(id=>{const e=document.getElementById(id);if(e)e.value=data[id]||''});
  }catch(e){}
}
function civiManualAddress(prefix,label){
  const name=civiManualValue(prefix,'Name');
  const street=civiManualValue(prefix,'Street');
  const number=civiManualValue(prefix,'Number');
  const district=civiManualValue(prefix,'District');
  const province=civiManualValue(prefix,'Province');
  const department=civiManualValue(prefix,'Department');
  if(!street)throw new Error('Completa la calle o avenida del '+label+'.');
  if(!district)throw new Error('Completa el distrito del '+label+'.');
  if(!province)throw new Error('Completa la provincia del '+label+'.');
  if(!department)throw new Error('Completa el departamento del '+label+'.');
  const streetNumber=[street,number].filter(Boolean).join(' ');
  const query=[streetNumber,district,province,department,'Perú'].filter(Boolean).join(', ');
  const address=[streetNumber,district,province,department].filter(Boolean).join(', ');
  const display=name?name+' — '+address:address;
  return{name,street,number,district,province,department,query,display};
}
async function civiGeocodeManual(data){
  const attempts=[
    data.query,
    [data.street,data.district,data.province,data.department,'Perú'].filter(Boolean).join(', '),
    [data.district,data.province,data.department,'Perú'].filter(Boolean).join(', ')
  ];
  let last=null;
  for(const q of attempts){
    try{const r=await geocodePeru(q);if(r&&validLatLng(r.lat,r.lng))return r}catch(e){last=e}
  }
  throw last||new Error('No pude localizar esa dirección. Revisa calle, número, distrito, provincia y departamento.');
}
function civiManualAddressBlock(prefix,title,icon){
  const low=title.toLowerCase();
  return '<div class="civi-manual-address"><h3>'+icon+' '+title+'</h3>'+ 
    '<input id="'+prefix+'Name" class="input" autocomplete="off" placeholder="Nombre o referencia (ej. Casa, Trabajo)">'+
    '<div class="civi-address-row"><input id="'+prefix+'Street" class="input" autocomplete="street-address" placeholder="Calle / avenida / jirón"><input id="'+prefix+'Number" class="input civi-number" inputmode="text" placeholder="Número"></div>'+ 
    '<input id="'+prefix+'District" class="input" autocomplete="address-level3" placeholder="Distrito">'+
    '<input id="'+prefix+'Province" class="input" autocomplete="address-level2" placeholder="Provincia">'+
    '<input id="'+prefix+'Department" class="input" autocomplete="address-level1" placeholder="Departamento">'+
    '<p class="hint">Completa la dirección del '+low+'. El número puede quedar vacío si es S/N.</p></div>';
}
function installPassengerManualRouteShell(){
  if(!civiPassenger()||document.getElementById('originStreet'))return;
  const home=document.getElementById('home');if(!home)return;
  [...home.querySelectorAll('button')].forEach(b=>{if(/UBICACIÓN(?: ACTUAL)?/i.test(b.textContent||''))b.remove()});
  const origin=document.getElementById('origin'),destination=document.getElementById('destination');
  const originWrap=origin&&origin.closest('.field-wrap')||origin;
  const destWrap=destination&&destination.closest('.field-wrap')||destination;
  if(originWrap){
    const block=document.createElement('div');block.innerHTML=civiManualAddressBlock('origin','Origen','📍');
    originWrap.parentNode.insertBefore(block.firstElementChild,originWrap);
    originWrap.style.display='none';
  }
  if(destWrap){
    const block=document.createElement('div');block.innerHTML=civiManualAddressBlock('destination','Destino','🏁');
    destWrap.parentNode.insertBefore(block.firstElementChild,destWrap);
    destWrap.style.display='none';
  }
  const style=document.createElement('style');
  style.textContent='.civi-manual-address{margin:10px 0 16px;padding:12px;border:1px solid #ffffff24;border-radius:16px;background:#ffffff08}.civi-manual-address h3{margin:0 0 8px}.civi-address-row{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:8px}.civi-manual-address .input{margin:7px 0}.civi-number{min-width:0}@media(max-width:340px){.civi-address-row{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  civiRestoreManualRoute();
  home.querySelectorAll('.civi-manual-address input').forEach(e=>e.addEventListener('input',civiSaveManualRoute));
  const hint=[...home.querySelectorAll('.hint')].find(e=>/Escribe calle|dirección de origen/i.test(e.textContent||''));
  if(hint)hint.textContent='Origen y destino son manuales. Escribe calle, número, distrito, provincia y departamento; Nova Taxi los registrará en la solicitud.';
}
function installPassengerManualRouteLogic(){
  if(!civiPassenger())return;
  window.showHome=function(){go('home');setTimeout(()=>{try{CiviMap.ensure('mapHome')}catch(e){}},120)};
  window.useCurrentLocation=function(){};
  window.prepareTrip=async function(){
    if(!Civi.token()){go('login');return}
    const calc=[...document.querySelectorAll('#home button')].find(b=>/CALCULAR RUTA/i.test(b.textContent||''));
    try{
      const oData=civiManualAddress('origin','origen'),dData=civiManualAddress('destination','destino');
      civiSaveManualRoute();
      if(typeof msg==='function')msg('homeMsg','Buscando las direcciones y calculando la ruta...');
      if(calc){calc.disabled=true;calc.dataset.oldText=calc.textContent;calc.textContent='CALCULANDO...'}
      const [og,dg]=await Promise.all([civiGeocodeManual(oData),civiGeocodeManual(dData)]);
      const route=await routeEstimate(og,dg);
      if(!route||!Number.isFinite(route.km)||!Number.isFinite(route.min)||route.km<=0)throw new Error('No se pudo calcular una ruta válida.');
      const fare=typeof passengerFare==='function'?await passengerFare(route.km,route.min):estimateFare(route.km,route.min);
      const o={lat:Number(og.lat),lng:Number(og.lng),name:oData.display};
      const d={lat:Number(dg.lat),lng:Number(dg.lng),name:dData.display};
      const originHidden=document.getElementById('origin'),destHidden=document.getElementById('destination');
      if(originHidden){originHidden.value=o.name;originHidden.dataset.lat=String(o.lat);originHidden.dataset.lng=String(o.lng)}
      if(destHidden){destHidden.value=d.name;destHidden.dataset.lat=String(d.lat);destHidden.dataset.lng=String(d.lng)}
      draftTrip={origin_address:o.name,origin_lat:o.lat,origin_lng:o.lng,destination_address:d.name,destination_lat:d.lat,destination_lng:d.lng,estimated_distance_km:Number(route.km.toFixed(2)),estimated_duration_min:Math.max(1,Math.round(route.min)),estimated_fare:fare,payment_method:'efectivo'};
      const routeEl=document.getElementById('previewRoute'),distEl=document.getElementById('previewDistance'),timeEl=document.getElementById('previewTime'),fareEl=document.getElementById('previewFare');
      if(routeEl)routeEl.textContent='📍 '+o.name+' → 🏁 '+d.name;
      if(distEl)distEl.textContent=route.km.toFixed(1)+' km';
      if(timeEl)timeEl.textContent=Math.round(route.min)+' min';
      if(fareEl)fareEl.textContent=money(fare);
      if(typeof msg==='function')msg('homeMsg','');
      go('preview');
      setTimeout(()=>CiviMap.route('mapPreview',o,d,o.name,d.name),100);
    }catch(e){
      if(typeof msg==='function')msg('homeMsg',e&&e.message?e.message:'No se pudo calcular la ruta. Revisa las direcciones e inténtalo nuevamente.');
    }finally{
      if(calc){calc.disabled=false;calc.textContent=calc.dataset.oldText||'CALCULAR RUTA'}
    }
  };
  const statusCopy={
    aceptado:{title:'Nova Taxi · Viaje aceptado',body:'Tu chofer aceptó la solicitud de viaje.'},
    chofer_en_camino:{title:'Nova Taxi · Chofer en camino',body:'Tu chofer ya va camino a la dirección de origen.'},
    chofer_llego:{title:'Nova Taxi · Chofer llegó',body:'Tu chofer llegó al origen. Ya puedes salir a encontrarlo.'},
    en_viaje:{title:'Nova Taxi · Viaje iniciado',body:'El chofer inició tu viaje hacia el destino.'},
    completado:{title:'Nova Taxi · Llegaste al destino',body:'Tu viaje llegó al destino y fue finalizado.'}
  };
  window.alertForStatus=function(status){
    const copy=statusCopy[status];
    if(copy){
      try{
        if(window.Android&&Android.tripStatusAlert)Android.tripStatusAlert(copy.title,copy.body);
        else nativeTripAlert(2,900);
      }catch(e){nativeTripAlert(2,900)}
      try{if(typeof markTripStatus==='function')markTripStatus(status)}catch(e){}
      return;
    }
    if(status==='cancelado'){
      nativeTripAlert(2,900);
      try{if(typeof markTripStatus==='function')markTripStatus(status)}catch(e){}
    }
  };
}
function initSharedUi(){installPasswordVisibility();installPassengerPhotoRegistration();installPassengerManualRouteShell();installPassengerManualRouteLogic()}
if(civiPassenger())installPassengerManualRouteShell();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSharedUi);else initSharedUi();
