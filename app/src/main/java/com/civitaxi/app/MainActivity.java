package com.civitaxi.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import org.json.JSONObject;

import java.util.concurrent.Executor;

public class MainActivity extends FragmentActivity {
  private static final int LOCATION_REQUEST = 1001;
  private static final int FILE_CHOOSER_REQUEST = 1002;
  private static final int NOTIFICATION_REQUEST = 1003;
  private static final String TRIP_CHANNEL_ID = "novataxi_trip_status";
  private WebView web;
  private ValueCallback<Uri[]> filePathCallback;

  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    requestLocationPermissionIfNeeded();
    createTripNotificationChannel();
    requestNotificationPermissionIfNeeded();

    web = new WebView(this);
    web.setBackgroundColor(0xFF05020A);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setGeolocationEnabled(true);
    settings.setLoadsImagesAutomatically(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setAllowFileAccessFromFileURLs(false);
    settings.setAllowUniversalAccessFromFileURLs(false);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      settings.setSafeBrowsingEnabled(true);
    }
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String url = uri == null ? "" : uri.toString();
        if (url.startsWith("file:///android_asset/")) return false;
        String scheme = uri == null ? "" : uri.getScheme();
        if (("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) && request.isForMainFrame()) {
          try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
          return true;
        }
        return false;
      }

      @Override public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        if (url != null && url.startsWith("file:///android_asset/")) {
          view.evaluateJavascript("(function(){if(document.getElementById('civi-patches-loader'))return;var s=document.createElement('script');s.id='civi-patches-loader';s.src='civi-patches.js?v=5';document.body.appendChild(s);})();", null);
        }
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        boolean granted = hasLocationPermission();
        callback.invoke(origin, granted, false);
      }

      @Override public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
        if (filePathCallback != null) filePathCallback.onReceiveValue(null);
        filePathCallback = callback;
        try {
          Intent intent = params.createIntent();
          intent.addCategory(Intent.CATEGORY_OPENABLE);
          startActivityForResult(Intent.createChooser(intent, "Seleccionar archivo Nova Taxi"), FILE_CHOOSER_REQUEST);
          return true;
        } catch (Exception e) {
          filePathCallback = null;
          return false;
        }
      }
    });
    web.addJavascriptInterface(new Bridge(), "Android");
    web.loadUrl(BuildConfig.APP_URL);
    setContentView(web);
  }

  @Override protected void onResume() {
    super.onResume();
    if (web != null) {
      web.post(() -> web.evaluateJavascript("window.onCiviResume && window.onCiviResume()", null));
    }
  }

  private boolean hasLocationPermission() {
    return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
      || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
  }

  private void requestLocationPermissionIfNeeded() {
    if (!hasLocationPermission()) {
      requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
    }
  }

  private void requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
      && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_REQUEST);
    }
  }

  private void createTripNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (manager == null) return;
    NotificationChannel channel = new NotificationChannel(TRIP_CHANNEL_ID, "Estado del viaje", NotificationManager.IMPORTANCE_HIGH);
    channel.setDescription("Avisos de viaje aceptado, chofer en camino y chofer en la puerta");
    channel.setSound(null, null);
    channel.enableVibration(false);
    manager.createNotificationChannel(channel);
  }

  private void showTripStatusNotification(String title, String message) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
        && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
      Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? new Notification.Builder(this, TRIP_CHANNEL_ID)
        : new Notification.Builder(this);
      builder.setSmallIcon(android.R.drawable.ic_dialog_info)
        .setContentTitle(title == null || title.trim().isEmpty() ? "Nova Taxi" : title)
        .setContentText(message == null ? "" : message)
        .setAutoCancel(true)
        .setPriority(Notification.PRIORITY_HIGH)
        .setSound(null);
      NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
      if (manager != null) manager.notify((int) (System.currentTimeMillis() % Integer.MAX_VALUE), builder.build());
    } catch (Exception ignored) { }
  }

  private Location bestLastLocation() {
    if (!hasLocationPermission()) return null;
    try {
      LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
      Location gps = null, net = null, passive = null;
      try { gps = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER); } catch (Exception ignored) { }
      try { net = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) { }
      try { passive = lm.getLastKnownLocation(LocationManager.PASSIVE_PROVIDER); } catch (Exception ignored) { }
      Location best = gps;
      if (best == null || (net != null && net.getTime() > best.getTime())) best = net;
      if (best == null || (passive != null && passive.getTime() > best.getTime())) best = passive;
      return best;
    } catch (Exception e) { return null; }
  }

  private void nativeLocationResult(boolean ok, Location loc, String message) {
    double lat = loc == null ? 0 : loc.getLatitude();
    double lng = loc == null ? 0 : loc.getLongitude();
    float accuracy = loc == null ? 0 : loc.getAccuracy();
    String safe = message == null ? "" : message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ");
    runOnUiThread(() -> web.evaluateJavascript("window.onNativeLocation && window.onNativeLocation(" + ok + "," + lat + "," + lng + "," + accuracy + ",'" + safe + "')", null));
  }

  private void requestNativeLocation() {
    runOnUiThread(() -> {
      if (!hasLocationPermission()) {
        requestLocationPermissionIfNeeded();
        nativeLocationResult(false, null, "Autoriza la ubicación de Nova Taxi y vuelve a intentarlo.");
        return;
      }
      LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
      Location cached = bestLastLocation();
      if (cached != null) nativeLocationResult(true, cached, "Ubicación obtenida");
      try {
        String provider = null;
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) provider = LocationManager.GPS_PROVIDER;
        else if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) provider = LocationManager.NETWORK_PROVIDER;
        if (provider == null) {
          if (cached == null) nativeLocationResult(false, null, "Activa la ubicación del teléfono.");
          return;
        }
        final String chosenProvider = provider;
        LocationListener listener = new LocationListener() {
          @Override public void onLocationChanged(Location location) { nativeLocationResult(true, location, "Ubicación actualizada"); }
          @Override public void onProviderDisabled(String provider) { }
          @Override public void onProviderEnabled(String provider) { }
          @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
        };
        lm.requestSingleUpdate(chosenProvider, listener, Looper.getMainLooper());
      } catch (SecurityException e) {
        nativeLocationResult(false, null, "No hay permiso de ubicación.");
      } catch (Exception e) {
        if (cached == null) nativeLocationResult(false, null, "No se pudo obtener la ubicación.");
      }
    });
  }

  private void biometricResult(boolean ok, String message) {
    final String safe = message == null ? "" : message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ");
    runOnUiThread(() -> web.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(" + ok + ", '" + safe + "')", null));
  }

  private void ringAndVibrate() {
    try {
      Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      Ringtone ringtone = RingtoneManager.getRingtone(MainActivity.this, sound);
      if (ringtone != null) ringtone.play();
    } catch (Exception ignored) { }
    try {
      Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
      if (vibrator != null && vibrator.hasVibrator()) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) vibrator.vibrate(VibrationEffect.createOneShot(500, VibrationEffect.DEFAULT_AMPLITUDE));
        else vibrator.vibrate(500);
      }
    } catch (Exception ignored) { }
  }

  private void playTripAlertNative(int times) {
    int count = Math.max(1, Math.min(4, times));
    runOnUiThread(() -> {
      Handler handler = new Handler(Looper.getMainLooper());
      for (int i = 0; i < count; i++) {
        handler.postDelayed(this::ringAndVibrate, i * 900L);
      }
    });
  }

  private void tripStatusAlertNative(String title, String message) {
    runOnUiThread(() -> {
      showTripStatusNotification(title, message);
      playTripAlertNative(2);
    });
  }

  @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    super.onActivityResult(requestCode, resultCode, data);
    if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
      Uri[] results = null;
      if (resultCode == RESULT_OK && data != null) {
        if (data.getClipData() != null) {
          int count = data.getClipData().getItemCount();
          results = new Uri[count];
          for (int i = 0; i < count; i++) results[i] = data.getClipData().getItemAt(i).getUri();
        } else if (data.getData() != null) results = new Uri[]{data.getData()};
      }
      filePathCallback.onReceiveValue(results);
      filePathCallback = null;
    }
  }

  @Override protected void onDestroy() {
    if (web != null) {
      web.removeJavascriptInterface("Android");
      web.destroy();
    }
    super.onDestroy();
  }

  public class Bridge {
    @JavascriptInterface public void share(String text) {
      runOnUiThread(() -> {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
        startActivity(Intent.createChooser(i, "Compartir Nova Taxi"));
      });
    }

    @JavascriptInterface public void tripAlert() { playTripAlertNative(1); }

    @JavascriptInterface public void tripStatusAlert(String title, String message) { tripStatusAlertNative(title, message); }

    @JavascriptInterface public String getLastLocation() {
      try {
        Location l = bestLastLocation();
        if (l == null) return "";
        JSONObject j = new JSONObject();
        j.put("lat", l.getLatitude());
        j.put("lng", l.getLongitude());
        j.put("accuracy", l.getAccuracy());
        return j.toString();
      } catch (Exception e) { return ""; }
    }

    @JavascriptInterface public void requestLocation() { requestNativeLocation(); }

    @JavascriptInterface public void openLocationSettings() {
      runOnUiThread(() -> { try { startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)); } catch (Exception ignored) { } });
    }

    @JavascriptInterface public void openSms(String phone, String text) {
      runOnUiThread(() -> {
        try {
          Intent i = new Intent(Intent.ACTION_SENDTO, Uri.parse("smsto:" + Uri.encode(phone == null ? "" : phone)));
          i.putExtra("sms_body", text == null ? "" : text);
          startActivity(i);
        } catch (Exception ignored) { }
      });
    }

    @JavascriptInterface public boolean biometricAvailable() {
      BiometricManager manager = BiometricManager.from(MainActivity.this);
      int result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK);
      return result == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @JavascriptInterface public void authenticateBiometric() {
      runOnUiThread(() -> {
        Executor executor = ContextCompat.getMainExecutor(MainActivity.this);
        BiometricPrompt prompt = new BiometricPrompt(MainActivity.this, executor,
          new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
              super.onAuthenticationSucceeded(result);
              biometricResult(true, "Identidad verificada");
            }
            @Override public void onAuthenticationError(int errorCode, CharSequence errString) {
              super.onAuthenticationError(errorCode, errString);
              biometricResult(false, errString == null ? "No se pudo verificar" : errString.toString());
            }
            @Override public void onAuthenticationFailed() {
              super.onAuthenticationFailed();
              biometricResult(false, "Huella o biometría no reconocida");
            }
          });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
          .setTitle("Nova Taxi Administrador")
          .setSubtitle("Verifica tu identidad para continuar")
          .setNegativeButtonText("Usar correo y contraseña")
          .build();
        prompt.authenticate(info);
      });
    }
  }
}
