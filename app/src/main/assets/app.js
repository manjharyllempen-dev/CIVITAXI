function go(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));const e=document.getElementById(id);if(e)e.classList.add('active');scrollTo(0,0)}
function nativeShare(text){if(window.Android&&Android.share)Android.share(text);else if(navigator.share)navigator.share({text});else alert(text)}
function money(v){return 'S/ '+Number(v||0).toFixed(2)}
function togglePassword(id,checked){const el=document.getElementById(id);if(el)el.type=checked?'text':'password'}
async function login(emailId,passId,next){const email=document.getElementById(emailId).value,pass=document.getElementById(passId).value;const r=await Civi.signIn(email,pass);if(r.access_token)go(next);else alert(r.msg||r.error_description||'No se pudo iniciar sesión')}
let civiGeoWatch=null,lastGeoSent=0;
function startTripLocation(tripId){if(!navigator.geolocation||!tripId)return;stopTripLocation();civiGeoWatch=navigator.geolocation.watchPosition(async p=>{const now=Date.now();if(now-lastGeoSent<7000)return;lastGeoSent=now;try{await Civi.addLocation(tripId,p.coords.latitude,p.coords.longitude,p.coords.heading||0,(p.coords.speed||0)*3.6)}catch(e){}},()=>{}, {enableHighAccuracy:true,maximumAge:5000,timeout:12000})}
function stopTripLocation(){if(civiGeoWatch!==null&&navigator.geolocation){navigator.geolocation.clearWatch(civiGeoWatch);civiGeoWatch=null}}
window.addEventListener('load',()=>{setTimeout(()=>{const s=document.getElementById('splash');if(s){s.classList.add('hide');setTimeout(()=>s.remove(),400)}},950)});
