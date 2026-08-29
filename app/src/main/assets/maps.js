const CiviMap=(()=>{
  const maps=new Map();
  const routeLayers=new Map();
  const liveLayers=new Map();
  const lima=[-12.0464,-77.0428];

  function ensure(id,center=lima,zoom=13){
    const el=document.getElementById(id);if(!el)return null;
    if(!window.L){el.innerHTML='<div style="padding:24px;text-align:center;color:#222">No se pudo cargar el mapa. Verifica tu conexión a Internet.</div>';return null}
    let map=maps.get(id);
    if(!map){
      map=L.map(id,{zoomControl:true,attributionControl:true}).setView(center,zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
      maps.set(id,map);
    }
    setTimeout(()=>map.invalidateSize(),80);
    return map;
  }

  function clearRoute(id){
    const map=maps.get(id),group=routeLayers.get(id);
    if(map&&group){map.removeLayer(group);routeLayers.delete(id)}
  }

  function clearLive(id){
    const map=maps.get(id),layer=liveLayers.get(id);
    if(map&&layer){map.removeLayer(layer);liveLayers.delete(id)}
  }

  function clear(id){clearRoute(id);clearLive(id)}

  function group(id,map){
    clearRoute(id);
    const g=L.layerGroup().addTo(map);
    routeLayers.set(id,g);
    return g;
  }

  function valid(p){return p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lng))}
  function label(text){return String(text||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function point(id,p,text='Ubicación',zoom=16){
    if(!valid(p))return null;
    const pos=[Number(p.lat),Number(p.lng)],map=ensure(id,pos,zoom);if(!map)return null;
    clear(id);
    const g=L.layerGroup().addTo(map);routeLayers.set(id,g);
    L.marker(pos).addTo(g).bindPopup(label(text));map.setView(pos,zoom);return map;
  }

  async function route(id,origin,destination,originLabel='Origen',destinationLabel='Destino'){
    if(!valid(origin)||!valid(destination))return null;
    const o=[Number(origin.lat),Number(origin.lng)],d=[Number(destination.lat),Number(destination.lng)],map=ensure(id,o,13);if(!map)return null;
    const g=group(id,map);
    L.marker(o).addTo(g).bindPopup(label(originLabel));
    L.marker(d).addTo(g).bindPopup(label(destinationLabel));
    try{
      const url='https://router.project-osrm.org/route/v1/driving/'+origin.lng+','+origin.lat+';'+destination.lng+','+destination.lat+'?overview=full&geometries=geojson';
      const r=await fetch(url);if(!r.ok)throw new Error('route');
      const j=await r.json();const geometry=j.routes&&j.routes[0]&&j.routes[0].geometry;
      if(geometry){const line=L.geoJSON(geometry).addTo(g);map.fitBounds(line.getBounds(),{padding:[28,28]})}
      else map.fitBounds(L.latLngBounds([o,d]),{padding:[28,28]});
    }catch(e){map.fitBounds(L.latLngBounds([o,d]),{padding:[28,28]})}
    setTimeout(()=>map.invalidateSize(),100);return map;
  }

  function livePoint(id,p,text='Chofer en vivo',follow=false){
    if(!valid(p))return null;
    const pos=[Number(p.lat),Number(p.lng)],map=ensure(id,pos,15);if(!map)return null;
    let marker=liveLayers.get(id);
    if(!marker){
      const icon=L.divIcon({className:'civi-live-marker',html:'<div style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#E6007E;color:#fff;border:3px solid #fff;box-shadow:0 3px 12px #0008;font-size:20px">🚕</div>',iconSize:[38,38],iconAnchor:[19,19]});
      marker=L.marker(pos,{icon,zIndexOffset:1000}).addTo(map).bindPopup(label(text));
      liveLayers.set(id,marker);
    }else{
      marker.setLatLng(pos);
      marker.setPopupContent(label(text));
    }
    if(follow)map.panTo(pos,{animate:true});
    return marker;
  }

  async function device(id,labelText='Tu ubicación'){
    try{const p=await currentPosition();return point(id,{lat:p.coords.latitude,lng:p.coords.longitude},labelText,16)}catch(e){ensure(id);return null}
  }

  return{ensure,point,route,livePoint,device,clear,clearLive};
})();
window.CiviMap=CiviMap;
