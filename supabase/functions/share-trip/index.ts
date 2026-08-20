import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string))

Deno.serve(async (req:Request)=>{
  const url=new URL(req.url)
  const token=url.searchParams.get('token')||''
  if(!/^[a-f0-9]{48}$/i.test(token)) return new Response('Enlace inválido',{status:400})
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const {data:share}=await supabase.from('trip_share_tokens').select('trip_id,expires_at,revoked_at').eq('token',token).maybeSingle()
  if(!share||share.revoked_at||new Date(share.expires_at)<=new Date()) return new Response('Este enlace de viaje expiró o fue revocado',{status:410})
  const {data:trip}=await supabase.from('trips').select('*').eq('id',share.trip_id).maybeSingle()
  if(!trip) return new Response('Viaje no encontrado',{status:404})
  let driver:any=null, vehicle:any=null, last:any=null
  if(trip.driver_id){
    const {data:p}=await supabase.from('profiles').select('full_name').eq('id',trip.driver_id).maybeSingle(); driver=p
    const {data:v}=await supabase.from('vehicles').select('plate,brand,model,color').eq('driver_id',trip.driver_id).eq('active',true).limit(1).maybeSingle(); vehicle=v
    const {data:l}=await supabase.from('trip_locations').select('lat,lng,created_at').eq('trip_id',trip.id).order('created_at',{ascending:false}).limit(1).maybeSingle(); last=l
  }
  const status=String(trip.status||'').replaceAll('_',' ').toUpperCase()
  const map=last?`<a class="btn" href="https://www.google.com/maps?q=${encodeURIComponent(last.lat+','+last.lng)}">Ver ubicación actual</a>`:'<p>Ubicación en vivo todavía no disponible.</p>'
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="12"><title>CiviTaxi · Viaje compartido</title><style>body{margin:0;font-family:system-ui;background:#E6007E;color:#fff}.wrap{max-width:520px;margin:auto;padding:24px}.card{background:#EF3B99;padding:20px;border-radius:18px;margin:16px 0}.btn{display:block;background:#B50063;color:#fff;text-decoration:none;text-align:center;padding:15px;border-radius:14px;font-weight:700}.muted{opacity:.85}h1{margin:0 0 8px}</style></head><body><div class="wrap"><h1>🚕 CiviTaxi</h1><div class="muted">Viaje compartido temporal · se actualiza cada 12 s</div><div class="card"><b>Estado</b><h2>${esc(status)}</h2><p>📍 ${esc(trip.origin_address)}</p><p>🏁 ${esc(trip.destination_address)}</p><p>Tarifa estimada: S/ ${Number(trip.estimated_fare||0).toFixed(2)}</p></div><div class="card"><b>Chofer</b><p>${esc(driver?.full_name||'Buscando chofer')}</p>${vehicle?`<p>${esc(vehicle.brand)} ${esc(vehicle.model)} · ${esc(vehicle.color)} · ${esc(vehicle.plate)}</p>`:''}${map}</div><p class="muted">Este enlace dejará de funcionar al expirar o ser revocado.</p></div></body></html>`
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}})
})
