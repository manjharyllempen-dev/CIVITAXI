package com.civitaxi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PassengerAlertService extends Service {
  private static final String CHANNEL_ACTIVE="nova_passenger_active";
  private static final String CHANNEL_STATUS="nova_passenger_status";
  private static final String API="https://rhdcbxvohnrwfogiwcte.supabase.co";
  private static final String KEY="sb_publishable_ZYYjeiNtr-pcOe5rrCUCgg_zMAgnUko";
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ExecutorService executor=Executors.newSingleThreadExecutor();
  private boolean running=false;
  private final Runnable poll=new Runnable(){@Override public void run(){if(!running)return;executor.execute(()->{checkTrip();handler.postDelayed(this,5000);});}};

  @Override public void onCreate(){super.onCreate();createChannels();}
  @Override public int onStartCommand(Intent intent,int flags,int startId){running=true;startForeground(4201,activeNotification());handler.removeCallbacks(poll);handler.post(poll);return START_STICKY;}
  private SharedPreferences prefs(){return getSharedPreferences("nova_passenger_alert",MODE_PRIVATE);}

  private Notification activeNotification(){
    Intent open=new Intent(this,MainActivity.class);
    PendingIntent pi=PendingIntent.getActivity(this,11,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_ACTIVE):new Notification.Builder(this);
    return b.setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("Nova Taxi · Viaje activo").setContentText("Recibirás alertas cuando cambie el estado del viaje.").setOngoing(true).setContentIntent(pi).build();
  }

  private void createChannels(){
    if(Build.VERSION.SDK_INT<26)return;
    NotificationManager nm=getSystemService(NotificationManager.class);
    NotificationChannel active=new NotificationChannel(CHANNEL_ACTIVE,"Seguimiento del viaje",NotificationManager.IMPORTANCE_LOW);
    active.setSound(null,null);nm.createNotificationChannel(active);
    NotificationChannel status=new NotificationChannel(CHANNEL_STATUS,"Alertas del pasajero",NotificationManager.IMPORTANCE_HIGH);
    status.enableVibration(true);status.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),null);nm.createNotificationChannel(status);
  }

  private void checkTrip(){
    try{
      String tripId=prefs().getString("trip_id",""),token=prefs().getString("access_token","");
      if(tripId.isEmpty()||token.isEmpty())return;
      String path="/rest/v1/trips?select=id,status&id=eq."+tripId+"&limit=1";
      HttpURLConnection c=open(path,token,"GET");int code=c.getResponseCode();
      if(code==401&&refreshToken()){token=prefs().getString("access_token","");c=open(path,token,"GET");code=c.getResponseCode();}
      if(code<200||code>=300)return;
      JSONArray rows=new JSONArray(read(c));if(rows.length()==0)return;
      String status=rows.getJSONObject(0).optString("status","");
      String previous=prefs().getString("last_status","solicitado");
      if(!status.isEmpty()&&!status.equals(previous)){
        prefs().edit().putString("last_status",status).apply();
        showStatus(status);
        if("completado".equals(status)||"cancelado".equals(status)){running=false;handler.removeCallbacks(poll);stopSelf();}
      }
    }catch(Exception ignored){}
  }

  private void showStatus(String status){
    String title="Nova Taxi",body="El estado de tu viaje cambió.";
    if("aceptado".equals(status)){title="Viaje aceptado";body="Un conductor aceptó tu solicitud.";}
    else if("chofer_en_camino".equals(status)){title="Conductor en camino";body="Tu conductor se dirige al punto de origen.";}
    else if("chofer_llego".equals(status)){title="El conductor llegó";body="Tu conductor ya está en el punto de recogida.";}
    else if("en_viaje".equals(status)){title="Viaje iniciado";body="Tu viaje hacia el destino comenzó.";}
    else if("completado".equals(status)){title="Viaje terminado";body="Abre Nova Taxi para calificar al conductor.";}
    Intent open=new Intent(this,MainActivity.class);open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
    PendingIntent pi=PendingIntent.getActivity(this,12,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_STATUS):new Notification.Builder(this);
    b.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi).setPriority(Notification.PRIORITY_MAX).setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
    getSystemService(NotificationManager.class).notify(4202,b.build());
  }

  private HttpURLConnection open(String path,String token,String method)throws Exception{
    HttpURLConnection c=(HttpURLConnection)new URL(API+path).openConnection();c.setRequestMethod(method);c.setConnectTimeout(9000);c.setReadTimeout(9000);c.setRequestProperty("apikey",KEY);c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Content-Type","application/json");return c;
  }
  private boolean refreshToken(){
    try{
      String refresh=prefs().getString("refresh_token","");if(refresh.isEmpty())return false;
      HttpURLConnection c=open("/auth/v1/token?grant_type=refresh_token",KEY,"POST");c.setDoOutput(true);
      byte[] body=("{\"refresh_token\":\""+refresh.replace("\"","\\\"")+"\"}").getBytes(StandardCharsets.UTF_8);
      try(OutputStream out=c.getOutputStream()){out.write(body);}if(c.getResponseCode()<200||c.getResponseCode()>=300)return false;
      JSONObject j=new JSONObject(read(c));String access=j.optString("access_token",""),next=j.optString("refresh_token",refresh);if(access.isEmpty())return false;
      prefs().edit().putString("access_token",access).putString("refresh_token",next).apply();return true;
    }catch(Exception e){return false;}
  }
  private String read(HttpURLConnection c)throws Exception{BufferedReader br=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String line;while((line=br.readLine())!=null)b.append(line);br.close();return b.toString();}
  @Override public void onDestroy(){running=false;handler.removeCallbacks(poll);executor.shutdownNow();super.onDestroy();}
  @Override public IBinder onBind(Intent intent){return null;}
}
