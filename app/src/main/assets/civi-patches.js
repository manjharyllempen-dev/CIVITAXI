(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const setMsg=(id,text)=>{const el=$(id);if(el)el.textContent=text||''};
  const emailOk=v=>/^\S+@\S+\.\S+$/.test(String(v||'').trim());
  const accountExists=e=>/ya est[aá] registr|already|account_exists|contrase(?:ñ|n)a original|otro correo/i.test(String(e&&e.message||e||''));
  const roleName=()=>/Chofer/i.test(document.title)?'Chofer':/Administrador/i.test(document.title)?'Administrador':'Usuario';

  function installBranding(){
    if($('#civi-brand-style'))return;
    const style=document.createElement('style');
    style.id='civi-brand-style';
    style.textContent=`
      .brand{display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important;min-height:64px!important;padding:7px 10px!important}
      .civi-brand-logo{width:52px;height:52px;object-fit:contain;border-radius:14px;box-shadow:0 5px 18px #0007}
      .civi-brand-copy{display:flex;flex-direction:column;line-height:1.02;text-align:left}
      .civi-brand-copy b{font-size:21px;letter-spacing:.2px}.civi-brand-copy small{font-size:11px;opacity:.82;margin-top:4px;text-transform:uppercase;letter-spacing:1px}
      .civi-splash{position:fixed;inset:0;z-index:99999;background:linear-gradient(145deg,#05020a,#170b22 58%,#2b0b36);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;transition:opacity .35s ease;pointer-events:none}
      .civi-splash img{width:min(58vw,220px);height:min(58vw,220px);object-fit:contain;border-radius:38px;box-shadow:0 22px 58px #000a}
      .civi-splash strong{font-size:30px;margin-top:18px;letter-spacing:.4px}.civi-splash span{margin-top:7px;color:#ffc72c;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;font-size:12px}
      .civi-busy{opacity:.7;pointer-events:none}
    `;
    document.head.appendChild(style);
    const brand=document.querySelector('.brand');
    if(brand)brand.innerHTML=`<img class="civi-brand-logo" src="civitaxi-logo.svg" alt="Logo CiviTaxi"><span class="civi-brand-copy"><b>CiviTaxi</b><small>${roleName()}</small></span>`;
    const splash=document.createElement('div');
    splash.className='civi-splash';
    splash.innerHTML=`<img src="civitaxi-logo.svg" alt="CiviTaxi"><strong>CiviTaxi</strong><span>${roleName()}</span>`;
    document.body.appendChild(splash);
    setTimeout(()=>{splash.style.opacity='0';setTimeout(()=>splash.remove(),380)},1150);
  }

  function busyButton(sectionId,pattern,busy){
    const section=$(sectionId);if(!section)return;
    const btn=[...section.querySelectorAll('button')].find(b=>pattern.test(b.textContent||''));
    if(btn){btn.disabled=!!busy;btn.classList.toggle('civi-busy',!!busy)}
  }

  function installPassengerRegistration(){
    if(!/CiviTaxi Usuario/i.test(document.title))return;
    window.userRegister=async function(){
      const full=String($('name')?.value||'').trim();
      const ph=String($('phone')?.value||'').trim();
      const doc=String($('dni')?.value||'').replace(/\D/g,'');
      const mail=String($('regEmail')?.value||'').trim().toLowerCase();
      const password=String($('regPass')?.value||'');
      try{
        if(!full)throw new Error('Ingresa tu nombre completo.');
        if(ph.replace(/\D/g,'').length<9)throw new Error('Ingresa un número de celular válido.');
        if(doc.length!==8)throw new Error('El DNI debe tener exactamente 8 dígitos.');
        if(!emailOk(mail))throw new Error('Ingresa un correo válido.');
        if(password.length<8)throw new Error('La contraseña debe tener al menos 8 caracteres.');
        busyButton('register',/REGISTRARME/i,true);
        setMsg('regMsg','Creando tu cuenta CiviTaxi...');
        await Civi.signUp(mail,password,full,'usuario');
        await Civi.updateProfile({phone:ph,dni:doc});
        const file=$('userPhoto')?.files?.[0]||null;
        if(file){
          setMsg('regMsg','Cuenta creada. Guardando tu foto...');
          try{const u=await Civi.uploadFile('civitaxi-public',file,'perfil-usuario');await Civi.updateProfile({avatar_url:u.url})}
          catch(photoError){console.warn('Foto de usuario pendiente',photoError);setMsg('regMsg','Tu cuenta ya quedó creada. La foto no pudo subirse; podrás agregarla después.')}
        }
        setMsg('regMsg','Cuenta creada correctamente.');
        if(typeof resumePassengerTrip==='function'){
          const resumed=await resumePassengerTrip();
          if(!resumed&&typeof showHome==='function')showHome();
        }else if(typeof showHome==='function')showHome();
      }catch(e){
        const text=String(e&&e.message||e||'No se pudo registrar.');
        setMsg('regMsg',text);
        if(accountExists(e)){
          if($('email'))$('email').value=mail;
          setTimeout(()=>{if(typeof go==='function')go('login');setMsg('loginMsg',text)},700);
        }
      }finally{busyButton('register',/REGISTRARME/i,false)}
    };
  }

  async function uploadDriverMediaFixed(prefix=''){
    const complete=prefix==='complete';
    const ids=complete
      ?{profile:'completeProfilePhoto',license:'completeLicensePhoto',vehicle:'completeVehiclePhoto',soat:'completeSoatPhoto'}
      :{profile:'profilePhoto',license:'licensePhoto',vehicle:'vehiclePhoto',soat:'soatPhoto'};
    const profile=$(ids.profile)?.files?.[0]||null;
    const lic=$(ids.license)?.files?.[0]||null;
    const veh=$(ids.vehicle)?.files?.[0]||null;
    const soat=$(ids.soat)?.files?.[0]||null;
    let vehicleUrl='';
    if(profile){const u=await Civi.uploadFile('civitaxi-public',profile,'perfil-chofer');await Civi.updateProfile({avatar_url:u.url})}
    if(veh){const u=await Civi.uploadFile('civitaxi-public',veh,'vehiculo');vehicleUrl=u.url}
    if(lic){const u=await Civi.uploadFile('civitaxi-private',lic,'licencia');await Civi.addDriverDocument('licencia',u.path)}
    if(soat){const u=await Civi.uploadFile('civitaxi-private',soat,'soat');await Civi.addDriverDocument('soat',u.path)}
    return vehicleUrl;
  }

  function prefillDriverComplete(){
    if($('completePhone'))$('completePhone').value=String($('driverPhone')?.value||'');
    if($('completeDni'))$('completeDni').value=String($('dni')?.value||'');
    if($('completeLicense'))$('completeLicense').value=String($('license')?.value||'');
    if($('completePlate'))$('completePlate').value=String($('plate')?.value||'');
  }

  function installDriverRegistration(){
    if(!/CiviTaxi Chofer/i.test(document.title))return;
    window.uploadDriverMedia=uploadDriverMediaFixed;
    window.driverRegister=async function(){
      const full=String($('name')?.value||'').trim();
      const ph=String($('driverPhone')?.value||'').trim();
      const mail=String($('regEmail')?.value||'').trim().toLowerCase();
      const password=String($('regPass')?.value||'');
      const doc=String($('dni')?.value||'').replace(/\D/g,'');
      const lic=String($('license')?.value||'').trim();
      const plateValue=String($('plate')?.value||'').trim().toUpperCase();
      const files=['profilePhoto','licensePhoto','vehiclePhoto','soatPhoto'].map(id=>$(id)?.files?.[0]||null);
      try{
        if(!full)throw new Error('Ingresa tu nombre completo.');
        if(ph.replace(/\D/g,'').length<9)throw new Error('Ingresa un número de celular válido.');
        if(doc.length!==8)throw new Error('El DNI debe tener exactamente 8 dígitos.');
        if(!lic||!plateValue)throw new Error('Completa licencia y placa.');
        if(!emailOk(mail))throw new Error('Ingresa un correo válido.');
        if(password.length<8)throw new Error('La contraseña debe tener al menos 8 caracteres.');
        if(files.some(f=>!f))throw new Error('Adjunta foto de tu cara, licencia, vehículo y SOAT antes de enviar.');
        if(files.some(f=>f&&f.size>20*1024*1024))throw new Error('Uno de los archivos supera 20 MB. Elige una foto o PDF más liviano.');
        busyButton('register',/ENVIAR REGISTRO/i,true);
        setMsg('regMsg','Creando cuenta de chofer...');
        await Civi.signUp(mail,password,full,'chofer');
        await Civi.updateProfile({phone:ph});
        await Civi.ensureDriver(doc,lic);
        try{
          setMsg('regMsg','Cuenta creada. Subiendo foto y documentos...');
          const vehicleUrl=await uploadDriverMediaFixed('');
          setMsg('regMsg','Documentos cargados. Guardando vehículo...');
          await Civi.ensureVehicle(plateValue,vehicleUrl);
        }catch(uploadError){
          prefillDriverComplete();
          if(typeof go==='function')go('complete');
          setMsg('completeMsg','Tu cuenta de chofer quedó creada y no se perdió. Vuelve a seleccionar los documentos y pulsa ENVIAR A REVISIÓN. Detalle: '+String(uploadError&&uploadError.message||uploadError));
          return;
        }
        setMsg('regMsg','Registro enviado correctamente. El administrador revisará tus documentos.');
        if(typeof initDriver==='function')await initDriver();
        if(typeof showDriverHome==='function')showDriverHome();
      }catch(e){
        const text=String(e&&e.message||e||'No se pudo registrar.');
        setMsg('regMsg',text);
        if(accountExists(e)){
          if($('email'))$('email').value=mail;
          setTimeout(()=>{if(typeof go==='function')go('login');setMsg('loginMsg',text)},700);
        }
      }finally{busyButton('register',/ENVIAR REGISTRO/i,false)}
    };
  }

  function installTripShare(){
    if(!/CiviTaxi Usuario/i.test(document.title))return;
    window.shareCurrentTrip=async function(){
      try{
        if(typeof currentTrip==='undefined'||!currentTrip)return;
        const s=await Civi.createShareToken(currentTrip.id);
        const token=s&&s.token||(Array.isArray(s)&&s[0]&&s[0].token);
        if(!token)throw new Error('No se pudo crear el enlace de seguimiento.');
        const liveUrl=SUPABASE_URL+'/functions/v1/share-trip?token='+token;
        let lat=Number(currentTrip.origin_lat),lng=Number(currentTrip.origin_lng);
        if(currentTrip.driver_id){
          try{
            const rows=await Civi.json(SUPABASE_URL+'/rest/v1/trip_locations?trip_id=eq.'+encodeURIComponent(currentTrip.id)+'&actor_id=eq.'+encodeURIComponent(currentTrip.driver_id)+'&select=lat,lng&order=created_at.desc&limit=1',{headers:Civi.headers()});
            if(rows&&rows[0]){lat=Number(rows[0].lat);lng=Number(rows[0].lng)}
          }catch(_e){}
        }
        const dlat=Number(currentTrip.destination_lat),dlng=Number(currentTrip.destination_lng);
        const mapsUrl=Number.isFinite(lat)&&Number.isFinite(lng)&&Number.isFinite(dlat)&&Number.isFinite(dlng)
          ?'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(lat+','+lng)+'&destination='+encodeURIComponent(dlat+','+dlng)+'&travelmode=driving'
          :'';
        const text='🚕 Sigue mi viaje en CiviTaxi\n\n📡 Seguimiento en vivo:\n'+liveUrl+(mapsUrl?'\n\n🗺️ Abrir ruta en Google Maps:\n'+mapsUrl:'')+'\n\nEl enlace de CiviTaxi se actualiza durante el viaje.';
        nativeShare(text);
      }catch(e){alert(String(e&&e.message||e))}
    };
  }

  function init(){installBranding();installPassengerRegistration();installDriverRegistration();installTripShare()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
