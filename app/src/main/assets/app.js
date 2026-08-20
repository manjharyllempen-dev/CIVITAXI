function go(id){document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));const e=document.getElementById(id);if(e)e.classList.add('active');scrollTo(0,0)}
function nativeShare(text){if(window.Android&&Android.share)Android.share(text);else if(navigator.share)navigator.share({text});else alert(text)}
function money(v){return 'S/ '+Number(v||0).toFixed(2)}
async function login(emailId,passId,next){const email=document.getElementById(emailId).value,pass=document.getElementById(passId).value;const r=await Civi.signIn(email,pass);if(r.access_token)go(next);else alert(r.msg||r.error_description||'No se pudo iniciar sesión')}
