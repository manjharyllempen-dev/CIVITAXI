package com.civitaxi.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import java.util.concurrent.Executor;

public class MainActivity extends FragmentActivity {
  private static final int LOCATION_REQUEST = 1001;
  private WebView web;

  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
    }

    web = new WebView(this);
    web.setBackgroundColor(0xFF05020A);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setGeolocationEnabled(true);
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        String url = uri == null ? "" : uri.toString();
        if (url.startsWith("file:///android_asset/")) return false;
        String scheme = uri == null ? "" : uri.getScheme();
        if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) {
          try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
          } catch (Exception ignored) { }
        }
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
        boolean granted = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
          || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        callback.invoke(origin, granted, false);
      }
    });
    web.addJavascriptInterface(new Bridge(), "Android");
    web.loadUrl("file:///android_asset/index.html");
    setContentView(web);
  }

  private void biometricResult(boolean ok, String message) {
    final String safe = message == null ? "" : message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", " ");
    runOnUiThread(() -> web.evaluateJavascript("window.onBiometricResult && window.onBiometricResult(" + ok + ", '" + safe + "')", null));
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
        startActivity(Intent.createChooser(i, "Compartir viaje CiviTaxi"));
      });
    }

    @JavascriptInterface public boolean biometricAvailable() {
      BiometricManager manager = BiometricManager.from(MainActivity.this);
      int result = manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK);
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
          .setTitle("CiviTaxi Administrador")
          .setSubtitle("Verifica tu identidad para continuar")
          .setNegativeButtonText("Usar correo y contraseña")
          .build();
        prompt.authenticate(info);
      });
    }
  }
}
