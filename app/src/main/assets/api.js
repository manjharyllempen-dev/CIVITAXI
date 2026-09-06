const SUPABASE_URL='https://rhdcbxvohnrwfogiwcte.supabase.co';
const SUPABASE_KEY='sb_publishable_ZYYjeiNtr-pcOe5rrCUCgg_zMAgnUko';
const Civi={
 token:()=>localStorage.getItem('sb_token'),
 refreshToken:()=>localStorage.getItem('sb_refresh'),
 headers(auth=true){const h={'Content-Type':'application/json','apikey':SUPABASE_KEY};if(auth&&this.token())h.Authorization='Bearer '+this.token();return h},
 saveSession(j){if(j&&j.access_token){localStorage.setItem('sb_token',j.access_token);if(j.refresh_token)localStorage.setItem('sb_refresh',j.refresh_token)}return j},
 async refreshSession(){const refresh_token=this.refreshToken();if(!refresh_token)throw new Error('Sesión expirada');const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:this.headers(false),body:JSON.stringify({refresh_token})});let j=null;try{j=await r.json()}catch(e){j=null}if(!r.ok||!j||!j.access_token){this.signOut();throw new Error((j&&(j.msg||j.message||j.error_description))||'Sesión expirada')}return this.saveSession(j)},
 async json(url,opts={},retry=true){let r=await fetch(url,opts);if(r.status===401&&retry&&this.refreshToken()&&!url.includes('/auth/v1/token')){await this.refreshSession();const h={...(opts.headers||{}),Authorization:'Bearer '+this.token(),apikey:SUPABASE_KEY};return this.json(url,{...opts,headers:h},false)}let j=null;try{j=await r.json()}catch(e){j=null}if(!r.ok)throw new Error((j&&(j.error||j.msg||j.message||j.error_description||j.hint))||('HTTP '+r.status));return j},
 async signUp(email,password,fullName,role='usuario'){
   try{
     await this.json(SUPABASE_URL+'/functions/v1/signup-auto-confirm',{method:'POST',headers:this.headers(false),body:JSON.stringify({email,password,full_name:fullName,role})});
   }catch(e){
     const text=String(e&&e.message||e||'');
     if(!/ya est[aá] registr|already|account_exists|contrase(?:ñ|n)a original/i.test(text))throw e;
   }
   try{return await this.signIn(email,password)}catch(e){
     const text=String(e&&e.message||e||'');
     if(/invalid login credentials|credenciales|password|contrase(?:ñ|n)a/i.test(text))throw new Error('Ese correo ya está registrado. Ingresa con la contraseña original o usa otro correo.');
     throw e;
   }
 },
 async signIn(email,password){const j=await this.json(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:this.headers(false),body:JSON.stringify({email,password})});return this.saveSession(j)},
 signOut(){localStorage.removeItem('sb_token');localStorage.removeItem('sb_refresh')},
 userId(){try{const p=(this.token()||'..').split('.')[1]||'';return JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))).sub||''}catch(e){return''}},
 async profile(){return this.json(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(this.userId())+'&select=*',{headers:this.headers()})},
 async profiles(query=''){return this.json(SUPABASE_URL+'/rest/v1/profiles?select=id,role,full_name,phone,email,avatar_url,rating,created_at&order=created_at.desc'+(query?'&'+query:''),{headers:this.headers()})},
 async updateProfile(data){return this.json(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(this.userId()),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify(data)})},
 async trips(query=''){return this.json(SUPABASE_URL+'/rest/v1/trips?select=*&order=requested_at.desc'+(query?'&'+query:''),{headers:this.headers()})},
 async activePassengerTrip(){return this.trips('passenger_id=eq.'+encodeURIComponent(this.userId())+'&status=in.(solicitado,aceptado,chofer_en_camino,chofer_llego,en_viaje)&limit=1')},
 async pendingPassengerRating(){return this.json(SUPABASE_URL+'/rest/v1/rpc/passenger_pending_rating',{method:'POST',headers:this.headers(),body:'{}'})},
 async activeDriverTrip(){return this.trips('driver_id=eq.'+encodeURIComponent(this.userId())+'&status=in.(aceptado,chofer_en_camino,chofer_llego,en_viaje)&limit=1')},
 async createTrip(data){return this.json(SUPABASE_URL+'/rest/v1/trips',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({...data,passenger_id:this.userId(),status:'solicitado'})})},
 async patchTrip(id,data,extra=''){return this.json(SUPABASE_URL+'/rest/v1/trips?id=eq.'+encodeURIComponent(id)+(extra?'&'+extra:''),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify(data)})},
 async ensureDriver(documentNumber,licenseNumber){return this.json(SUPABASE_URL+'/rest/v1/drivers',{method:'POST',headers:{...this.headers(),'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:this.userId(),document_number:documentNumber,license_number:licenseNumber})})},
 async available(v){return this.json(SUPABASE_URL+'/rest/v1/drivers?id=eq.'+encodeURIComponent(this.userId())+'&deleted_at=is.null',{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({is_available:v})})},
 async driverRecord(){return this.json(SUPABASE_URL+'/rest/v1/drivers?id=eq.'+encodeURIComponent(this.userId())+'&deleted_at=is.null&select=*',{headers:this.headers()})},
 async requestedTrips(){return this.trips('status=eq.solicitado&driver_id=is.null&limit=20')},
 async acceptTrip(id){return this.patchTrip(id,{driver_id:this.userId(),status:'aceptado',accepted_at:new Date().toISOString()},'status=eq.solicitado&driver_id=is.null')},
 async addLocation(tripId,lat,lng,heading=0,speedKmh=0){return this.json(SUPABASE_URL+'/rest/v1/trip_locations',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({trip_id:tripId,actor_id:this.userId(),lat,lng,heading,speed_kmh:speedKmh})})},
 async createShareToken(tripId){return this.json(SUPABASE_URL+'/rest/v1/rpc/create_trip_share_token',{method:'POST',headers:this.headers(),body:JSON.stringify({p_trip_id:tripId})})},
 async tripParty(tripId){return this.json(SUPABASE_URL+'/rest/v1/rpc/trip_party_public',{method:'POST',headers:this.headers(),body:JSON.stringify({p_trip_id:tripId})})},
 async rateTrip(tripId,stars,comment=''){return this.json(SUPABASE_URL+'/rest/v1/rpc/rate_trip',{method:'POST',headers:this.headers(),body:JSON.stringify({p_trip_id:tripId,p_stars:Number(stars),p_comment:comment})})},
 async drivers(query=''){return this.json(SUPABASE_URL+'/rest/v1/drivers?select=*&deleted_at=is.null&order=created_at.desc'+(query?'&'+query:''),{headers:this.headers()})},
 async incidents(query=''){return this.json(SUPABASE_URL+'/rest/v1/incidents?select=*&order=created_at.desc'+(query?'&'+query:''),{headers:this.headers()})},
 async fares(query=''){return this.json(SUPABASE_URL+'/rest/v1/fares?select=*&order=created_at.desc'+(query?'&'+query:''),{headers:this.headers()})},
 async createFare(data){return this.json(SUPABASE_URL+'/rest/v1/fares',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({name:data.name,base_fare:Number(data.base_fare||0),per_km:Number(data.per_km||0),per_minute:Number(data.per_minute||0),minimum_fare:Number(data.minimum_fare||0),platform_commission_percent:0,active:data.active!==false})})},
 async deleteFare(id){return this.json(SUPABASE_URL+'/rest/v1/fares?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:{...this.headers(),'Prefer':'return=representation'}})},
 async patchDriver(id,data){if(data&&data.status)return this.json(SUPABASE_URL+'/rest/v1/rpc/admin_set_driver_status',{method:'POST',headers:this.headers(),body:JSON.stringify({p_driver_id:id,p_status:data.status})});throw new Error('Operación de administrador no permitida')},
 async deleteDriver(id){return this.json(SUPABASE_URL+'/rest/v1/rpc/admin_delete_driver',{method:'POST',headers:this.headers(),body:JSON.stringify({p_driver_id:id})})},
 async driverVehicle(){return this.json(SUPABASE_URL+'/rest/v1/vehicles?driver_id=eq.'+encodeURIComponent(this.userId())+'&active=eq.true&select=*&order=created_at.desc&limit=1',{headers:this.headers()})},
 async ensureVehicle(plate,photoUrl='',brand='',color=''){const uid=this.userId();const rows=await this.json(SUPABASE_URL+'/rest/v1/vehicles?driver_id=eq.'+encodeURIComponent(uid)+'&select=*&order=created_at.desc&limit=1',{headers:this.headers()});const body={plate:String(plate||'').trim().toUpperCase(),brand:String(brand||'').trim(),color:String(color||'').trim(),active:true};if(photoUrl)body.photo_url=photoUrl;if(rows[0])return this.json(SUPABASE_URL+'/rest/v1/vehicles?id=eq.'+encodeURIComponent(rows[0].id),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify(body)});return this.json(SUPABASE_URL+'/rest/v1/vehicles',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({...body,driver_id:uid})})},
 async addDriverDocument(type,path){return this.json(SUPABASE_URL+'/rest/v1/driver_documents',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({driver_id:this.userId(),document_type:type,file_path:path,status:'pendiente'})})},
 async uploadFile(bucket,file,kind){if(!file)throw new Error('Selecciona un archivo');const name=String(file.name||'foto.jpg');const ext=(name.includes('.')?name.split('.').pop():'jpg').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()||'jpg';const safeKind=String(kind||'archivo').replace(/[^a-zA-Z0-9_-]/g,'-');const path=this.userId()+'/'+safeKind+'-'+Date.now()+'.'+ext;const headers={'apikey':SUPABASE_KEY,'Authorization':'Bearer '+this.token(),'Content-Type':file.type||'application/octet-stream','x-upsert':'true'};let r=await fetch(SUPABASE_URL+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',headers,body:file});if(r.status===401&&this.refreshToken()){await this.refreshSession();headers.Authorization='Bearer '+this.token();r=await fetch(SUPABASE_URL+'/storage/v1/object/'+bucket+'/'+path,{method:'POST',headers,body:file})}if(!r.ok){let j={};try{j=await r.json()}catch(e){}throw new Error(j.message||j.error||'No se pudo cargar el archivo')}return{path,url:bucket==='civitaxi-public'?SUPABASE_URL+'/storage/v1/object/public/'+bucket+'/'+path:''}},
 async driverNotifications(){return this.json(SUPABASE_URL+'/rest/v1/driver_notifications?driver_id=eq.'+encodeURIComponent(this.userId())+'&select=*&order=created_at.desc&limit=30',{headers:this.headers()})},
 async markNotificationRead(id){return this.json(SUPABASE_URL+'/rest/v1/driver_notifications?id=eq.'+encodeURIComponent(id)+'&driver_id=eq.'+encodeURIComponent(this.userId()),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({read_at:new Date().toISOString()})})},
 async adminSendDriverNotification(driverId,body){return this.json(SUPABASE_URL+'/rest/v1/rpc/admin_send_driver_notification',{method:'POST',headers:this.headers(),body:JSON.stringify({p_driver_id:driverId,p_body:body})})},
 async adminDriverDirectory(){return this.json(SUPABASE_URL+'/rest/v1/rpc/admin_driver_directory',{method:'POST',headers:this.headers(),body:'{}'})},
 async archivePreviousDays(){return this.json(SUPABASE_URL+'/rest/v1/rpc/archive_previous_days',{method:'POST',headers:this.headers(),body:'{}'})},
 async dailyArchives(){return this.json(SUPABASE_URL+'/rest/v1/daily_archives?select=archive_date,trips_count,completed_count,gross,archived_at&order=archive_date.desc&limit=60',{headers:this.headers()})}
};
