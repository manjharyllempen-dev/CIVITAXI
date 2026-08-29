package com.civitaxi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;

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

public class DriverAlertService extends Service {
  private static final String CHANNEL_ACTIVE="nova_driver_active";
  private static final String CHANNEL_REQUEST="nova_driver_request";
  private static final String API="https://rhdcbxvohnrwfogiwcte.supabase.co";
  private static final String KEY="sb_publishable_ZYYjeiNtr-pcOe5rrCUCgg_zMAgnUko";
  private final Handler handler=new Handler(Looper.getMainLooper());
  private final ExecutorService executor=Executors.newSingleThreadExecutor();
  private String lastTripId="";
  private boolean running=false;
  private final Runnable poll=new Runnable(){@Override public void run(){if(!running)return;executor.execute(()->{checkRequests();handler.postDelayed(this,12000);});}};

  @Override public void onCreate(){super.onCreate();createChannels();}

  @Override public int onStartCommand(Intent intent,int flags,int startId){running=true;startForeground(4101,activeNotification());handler.removeCallbacks(poll);handler.post(poll);return START_STICKY;}

  private SharedPreferences prefs(){return getSharedPreferences("nova_driver_alert",MODE_PRIVATE);}

  private Notification activeNotification(){
    Intent open=new Intent(this,MainActivity.class);PendingIntent pi=PendingIntent.getActivity(this,1,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_ACTIVE):new Notification.Builder(this);
    return b.setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("Nova Taxi Conductor conectado").setContentText("Las alertas de viaje seguirán activas con la pantalla apagada.").setOngoing(true).setContentIntent(pi).build();
  }

  private void createChannels(){if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O){NotificationManager nm=getSystemService(NotificationManager.class);NotificationChannel active=new NotificationChannel(CHANNEL_ACTIVE,"Conductor conectado",NotificationManager.IMPORTANCE_LOW);active.setSound(null,null);nm.createNotificationChannel(active);NotificationChannel request=new NotificationChannel(CHANNEL_REQUEST,"Nuevas solicitudes de viaje",NotificationManager.IMPORTANCE_HIGH);request.enableVibration(true);request.setVibrationPattern(new long[]{0,700,250,700,250,700});Uri sound=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);request.setSound(sound,null);nm.createNotificationChannel(request);}}

  private void checkRequests(){try{String token=prefs().getString("access_token","");if(token.isEmpty())return;String path="/rest/v1/trips?select=id,payment_method&status=eq.solicitado&driver_id=is.null&order=requested_at.desc&limit=1";HttpURLConnection c=open(path,token,"GET");int code=c.getResponseCode();if(code==401&&refreshToken()){token=prefs().getString("access_token","");c=open(path,token,"GET");code=c.getResponseCode();}if(code<200||code>=300)return;JSONArray rows=new JSONArray(read(c));if(rows.length()==0){lastTripId="";return;}JSONObject trip=rows.getJSONObject(0);String id=trip.optString("id","");String payment=trip.optString("payment_method","efectivo");if(!id.isEmpty()&&!id.equals(lastTripId)){lastTripId=id;showRequestAlert(payment);}}catch(Exception ignored){}}

  private HttpURLConnection open(String path,String token,String method)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(API+path).openConnection();c.setRequestMethod(method);c.setConnectTimeout(9000);c.setReadTimeout(9000);c.setRequestProperty("apikey",KEY);c.setRequestProperty("Authorization","Bearer "+token);c.setRequestProperty("Content-Type","application/json");return c;}

  private boolean refreshToken(){try{String refresh=prefs().getString("refresh_token","");if(refresh.isEmpty())return false;HttpURLConnection c=open("/auth/v1/token?grant_type=refresh_token","","POST");c.setRequestProperty("Authorization","Bearer "+KEY);c.setDoOutput(true);byte[] body=("{\"refresh_token\":\""+refresh.replace("\"","\\\"")+"\"}").getBytes(StandardCharsets.UTF_8);try(OutputStream out=c.getOutputStream()){out.write(body);}if(c.getResponseCode()<200||c.getResponseCode()>=300)return false;JSONObject j=new JSONObject(read(c));String access=j.optString("access_token","");String nextRefresh=j.optString("refresh_token",refresh);if(access.isEmpty())return false;prefs().edit().putString("access_token",access).putString("refresh_token",nextRefresh).apply();return true;}catch(Exception e){return false;}}

  private String read(HttpURLConnection c)throws Exception{BufferedReader br=new BufferedReader(new InputStreamReader(c.getInputStream(),StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String line;while((line=br.readLine())!=null)b.append(line);br.close();return b.toString();}

  private void showRequestAlert(String payment){Intent open=new Intent(this,MainActivity.class);open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);PendingIntent pi=PendingIntent.getActivity(this,2,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);boolean yape="yape".equalsIgnoreCase(payment);String method=yape?"PAGO CON YAPE":"PAGO EN EFECTIVO";Notification.Builder b=Build.VERSION.SDK_INT>=26?new Notification.Builder(this,CHANNEL_REQUEST):new Notification.Builder(this);Notification n=b.setSmallIcon(android.R.drawable.ic_dialog_map).setContentTitle("Nueva solicitud - "+method).setContentText("El pasajero informó: "+method+". Abre Nova Taxi para aceptar.").setStyle(new Notification.BigTextStyle().bigText("Nueva solicitud de viaje. El pasajero informó que pagará "+(yape?"con Yape.":"en efectivo.")+" Abre Nova Taxi Conductor para ver el servicio.")).setAutoCancel(true).setContentIntent(pi).setPriority(Notification.PRIORITY_MAX).build();getSystemService(NotificationManager.class).notify(4102,n);try{Uri uri=RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);Ringtone tone=RingtoneManager.getRingtone(this,uri);tone.play();handler.postDelayed(tone::stop,5000);}catch(Exception ignored){}try{Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);if(Build.VERSION.SDK_INT>=26)v.vibrate(VibrationEffect.createWaveform(new long[]{0,700,250,700,250,700},-1));else v.vibrate(new long[]{0,700,250,700,250,700},-1);}catch(Exception ignored){}}

  @Override public void onDestroy(){running=false;handler.removeCallbacks(poll);executor.shutdownNow();super.onDestroy();}
  @Override public IBinder onBind(Intent intent){return null;}
}
