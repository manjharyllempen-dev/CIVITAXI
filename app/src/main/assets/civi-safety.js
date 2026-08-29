(()=>{
  'use strict';
  const isPassenger=/Nova Taxi Usuario/i.test(document.title);
  const isDriver=/Nova Taxi Chofer/i.test(document.title);
  if(!isPassenger&&!isDriver)return;

  const $=id=>document.getElementById(id);
  const activeSafetyTrip=()=>{
    try{
      if(isPassenger&&typeof currentTrip!=='undefined'&&currentTrip)return currentTrip;
      if(isDriver&&typeof activeTrip!=='undefined'&&activeTrip)return activeTrip;
    }catch(_e){}
    return null;
  };
  const roleLabel=()=>isDriver?'Chofer':'Usuario';

  function ensureStyle(){
    if($('civi-safety-style'))return;
    const style=document.createElement('style');
    style.id='civi-safety-style';
    style.textContent=`
      .civi-sos{background:#b00020!important;border:1px solid #ff5a73!important;color:#fff!important;font-weight:950!important;box-shadow:0 8px 22px #0008!important}
      .civi-safety-backdrop{position:fixed;inset:0;z-index:100000;background:#000d;display:none;align-items:flex-end;justify-content:center;padding:18px}
      .civi-safety-backdrop.open{display:flex}
      .civi-safety-card{width:min(100%,520px);background:#12091d;border:1px solid #ff5a7388;border-radius:22px;padding:16px;color:#fff;box-shadow:0 24px 60px #000c}
      .civi-safety-card h2{margin:0 0 8px}.civi-safety-card p{line-height:1.45;opacity:.92}.civi-safety-note{font-size:12px;opacity:.78;margin-top:10px}
    `;
    document.head.appendChild(style);
  }

  function ensureModal(){
    let modal=$('civiSafetyModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='civiSafetyModal';
    modal.className='civi-safety-backdrop';
    modal.innerHTML=`<div class="civi-safety-card">
      <h2>🆘 Seguridad Nova Taxi</h2>
      <p>Si ocurre una situación de riesgo durante el viaje, puedes registrar el incidente y compartir tu ubicación actual con una persona de confianza.</p>
      <button class="btn civi-sos" id="civiReportEmergency">REGISTRAR INCIDENTE URGENTE</button>
      <button class="btn" id="civiShareEmergency">📤 COMPARTIR UBICACIÓN Y VIAJE</button>
      <button class="btn secondary" id="civiCloseEmergency">CERRAR</button>
      <div id="civiSafetyMsg" class="civi-safety-note"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeSafetyModal()});
    $('civiCloseEmergency').onclick=closeSafetyModal;
    $('civiReportEmergency').onclick=reportEmergency;
    $('civiShareEmergency').onclick=shareEmergency;
    return modal;
  }

  function safetyMessage(text){const el=$('civiSafetyMsg');if(el)el.textContent=text||''}
  function openSafetyModal(){ensureStyle();ensureModal().classList.add('open');safetyMessage('')}
  function closeSafetyModal(){const modal=$('civiSafetyModal');if(modal)modal.classList.remove('open')}

  async function emergencyLocation(){
    try{
      if(typeof currentPosition==='function'){
        const p=await currentPosition();
        const lat=Number(p.coords.latitude),lng=Number(p.coords.longitude);
        if(Number.isFinite(lat)&&Number.isFinite(lng))return{lat,lng,url:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(lat+','+lng)};
      }
    }catch(_e){}
    return null;
  }

  async function reportEmergency(){
    const trip=activeSafetyTrip();
    if(!trip){safetyMessage('No hay un viaje activo para asociar al incidente.');return}
    const detail=prompt('Describe brevemente lo ocurrido. El administrador recibirá este reporte:','Situación de emergencia durante el viaje');
    if(detail===null)return;
    const button=$('civiReportEmergency');
    try{
      if(button)button.disabled=true;
      safetyMessage('Registrando incidente y ubicación...');
      const loc=await emergencyLocation();
      const description=[
        String(detail||'Situación de emergencia durante el viaje').trim(),
        'Reportado desde APK: '+roleLabel(),
        'Origen: '+String(trip.origin_address||'—'),
        'Destino: '+String(trip.destination_address||'—'),
        loc?'Ubicación al reportar: '+loc.lat.toFixed(6)+','+loc.lng.toFixed(6):'Ubicación al reportar: no disponible'
      ].join('\n');
      await Civi.json(SUPABASE_URL+'/rest/v1/incidents',{
        method:'POST',
        headers:{...Civi.headers(),'Prefer':'return=representation'},
        body:JSON.stringify({trip_id:trip.id,reporter_id:Civi.userId(),category:'emergencia',description,status:'abierto',priority:'alta'})
      });
      safetyMessage('✅ Incidente registrado. El administrador podrá verlo en Nova Taxi Administrador.');
      try{if(window.Android&&Android.tripAlert)Android.tripAlert()}catch(_e){}
    }catch(e){
      safetyMessage('No se pudo registrar el incidente: '+String(e&&e.message||e));
    }finally{if(button)button.disabled=false}
  }

  async function shareEmergency(){
    const trip=activeSafetyTrip();
    if(!trip){safetyMessage('No hay un viaje activo para compartir.');return}
    const button=$('civiShareEmergency');
    try{
      if(button)button.disabled=true;
      safetyMessage('Preparando ubicación y enlace de seguridad...');
      const loc=await emergencyLocation();
      let live='';
      try{
        const s=await Civi.createShareToken(trip.id);
        const token=s&&s.token||(Array.isArray(s)&&s[0]&&s[0].token);
        if(token)live=SUPABASE_URL+'/functions/v1/share-trip?token='+token;
      }catch(_e){}
      const lines=[
        '🆘 Nova Taxi · Mensaje de seguridad',
        'Estoy en un viaje de Nova Taxi y comparto estos datos por seguridad.',
        '📍 Origen: '+String(trip.origin_address||'—'),
        '🏁 Destino: '+String(trip.destination_address||'—')
      ];
      if(loc)lines.push('📌 Mi ubicación actual: '+loc.url);
      if(live)lines.push('📡 Seguimiento del viaje: '+live);
      lines.push('Enviado desde Nova Taxi '+roleLabel()+'.');
      nativeShare(lines.join('\n\n'));
      safetyMessage('Abriendo las opciones para compartir. Puedes elegir WhatsApp.');
    }catch(e){
      safetyMessage('No se pudo preparar el mensaje: '+String(e&&e.message||e));
    }finally{if(button)button.disabled=false}
  }

  function addSafetyButton(screenId){
    const section=$(screenId);if(!section||section.querySelector('.civi-sos'))return;
    const card=section.querySelector('.card')||section;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn civi-sos';
    btn.textContent='🆘 EMERGENCIA / SEGURIDAD';
    btn.onclick=openSafetyModal;
    card.appendChild(btn);
  }

  function init(){
    ensureStyle();
    ensureModal();
    if(isPassenger)addSafetyButton('search');
    if(isDriver){addSafetyButton('pickup');addSafetyButton('trip')}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
