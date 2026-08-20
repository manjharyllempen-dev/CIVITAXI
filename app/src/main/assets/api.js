const SUPABASE_URL='https://rhdcbxvohnrwfogiwcte.supabase.co';
const SUPABASE_KEY='sb_publishable_ZYYjeiNtr-pcOe5rrCUCgg_zMAgnUko';
const Civi={
 token:()=>localStorage.getItem('sb_token'),
 headers(auth=true){const h={'Content-Type':'application/json','apikey':SUPABASE_KEY};if(auth&&this.token())h.Authorization='Bearer '+this.token();return h},
 async signUp(email,password,fullName,role='passenger'){const r=await fetch(SUPABASE_URL+'/auth/v1/signup',{method:'POST',headers:this.headers(false),body:JSON.stringify({email,password,data:{full_name:fullName,role}})});return r.json()},
 async signIn(email,password){const r=await fetch(SUPABASE_URL+'/auth/v1/token?grant_type=password',{method:'POST',headers:this.headers(false),body:JSON.stringify({email,password})});const j=await r.json();if(j.access_token)localStorage.setItem('sb_token',j.access_token);return j},
 signOut(){localStorage.removeItem('sb_token')},
 async trips(){const r=await fetch(SUPABASE_URL+'/rest/v1/trips?select=*&order=requested_at.desc',{headers:this.headers()});return r.json()},
 async createTrip(data){const r=await fetch(SUPABASE_URL+'/rest/v1/trips',{method:'POST',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify(data)});return r.json()},
 async patchTrip(id,data){const r=await fetch(SUPABASE_URL+'/rest/v1/trips?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify(data)});return r.json()},
 async available(v){const r=await fetch(SUPABASE_URL+'/rest/v1/drivers?id=eq.'+this.userId(),{method:'PATCH',headers:{...this.headers(),'Prefer':'return=representation'},body:JSON.stringify({is_available:v})});return r.json()},
 userId(){try{return JSON.parse(atob((this.token()||'..').split('.')[1])).sub||''}catch(e){return''}}
};
