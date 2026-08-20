const SUPABASE_URL='https://rhdcbxvohnrwfogiwcte.supabase.co';
const SUPABASE_KEY='sb_publishable_ZYYjeiNtr-pcOe5rrCUCgg_zMAgnUko';
const Civi={
 token:()=>localStorage.getItem('sb_token'),
 headers(auth=true){const h={'Content-Type':'application/json','apikey':SUPABASE_KEY};if(auth&&this.token())h.Authorization='Bearer '+this.token();return h},
 async json(url,opts={}){const r=await fetch(url,opts);let j=null;try{j=await r.json()}catch(e){j=null}if(!r.ok)throw new Error((j&&(j.msg||j.message||j.error_description||j.hint))||('HTTP '+r.status));return j},
 async signUp(email,password,fullName,role='usuario'){return this.json(SUPABASE_URL+'/auth/v1/signup',{method:'POST',headers:this.headers(false),body:JSON.stringify({email,password,data:{full_name:fullName,role}})})},
 async signIn(email,password){const j=await this.json(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:this.headers(false),body:JSON.stringify({email,password})});if(j.access_token){localStorage.setItem('sb_token',j.access_token);if(j.refresh_token)localStorage.setItem('sb_refresh',j.refresh_token)}return j},
 signOut(){localStorage.removeItem('sb_token');localStorage.removeItem('sb_refresh')},
 userId(){try{return JSON.parse(atob((this.token()||'..').split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub||''}catch(e){return''}},
 async profile(){return this.json(SUPABASE_URL+'/rest/v1/profiles?id=eq.'+encodeURIComponent(this.userId())+'&select=*',{headers:this.headers()})},
 async trips(query=''){return this.json(SUPABASE_URL+'/rest/v1/trips?select=*&order=requested_at.desc'+(query?'&'+query:''),{headers:this.headers()})},
 async createTrip(data){return this.json(SUPABASE_URL+'/rest/v1/trips',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({...data,passenger_id:this.userId(),status:'solicitado'})})},
 async patchTrip(id,data,extra=''){return this.json(SUPABASE_URL+'/rest/v1/trips?id=eq.'+encodeURIComponent(id)+(extra?'&'+extra:''),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify(data)})},
 async ensureDriver(documentNumber,licenseNumber){return this.json(SUPABASE_URL+'/rest/v1/drivers',{method:'POST',headers:{...this.headers(),'Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id:this.userId(),document_number:documentNumber,license_number:licenseNumber,status:'pendiente',is_available:false})})},
 async available(v){return this.json(SUPABASE_URL+'/rest/v1/drivers?id=eq.'+encodeURIComponent(this.userId()),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({is_available:v})})},
 async driverRecord(){return this.json(SUPABASE_URL+'/rest/v1/drivers?id=eq.'+encodeURIComponent(this.userId())+'&select=*',{headers:this.headers()})},
 async requestedTrips(){return this.trips('status=eq.solicitado&driver_id=is.null&limit=20')},
 async acceptTrip(id){return this.patchTrip(id,{driver_id:this.userId(),status:'aceptado',accepted_at:new Date().toISOString()},'status=eq.solicitado&driver_id=is.null')},
 async addLocation(tripId,lat,lng,heading=0,speedKmh=0){return this.json(SUPABASE_URL+'/rest/v1/trip_locations',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({trip_id:tripId,actor_id:this.userId(),lat,lng,heading,speed_kmh:speedKmh})})},
 async createShareToken(tripId){return this.json(SUPABASE_URL+'/rest/v1/rpc/create_trip_share_token',{method:'POST',headers:this.headers(),body:JSON.stringify({p_trip_id:tripId})})},
 async drivers(query=''){return this.json(SUPABASE_URL+'/rest/v1/drivers?select=*&order=created_at.desc'+(query?'&'+query:''),{headers:this.headers()})},
 async patchDriver(id,data){if(data&&data.status)return this.json(SUPABASE_URL+'/rest/v1/rpc/admin_set_driver_status',{method:'POST',headers:this.headers(),body:JSON.stringify({p_driver_id:id,p_status:data.status})});throw new Error('Operación de administrador no permitida')}
};
