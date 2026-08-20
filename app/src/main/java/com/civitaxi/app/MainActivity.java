package com.civitaxi.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
  @Override public void onCreate(Bundle b) {
    super.onCreate(b);
    WebView web = new WebView(this);
    web.setBackgroundColor(0xFFE6007E);
    web.getSettings().setJavaScriptEnabled(true);
    web.getSettings().setDomStorageEnabled(true);
    web.getSettings().setGeolocationEnabled(true);
    web.setWebViewClient(new WebViewClient());
    web.setWebChromeClient(new WebChromeClient());
    web.addJavascriptInterface(new Bridge(), "Android");
    web.loadUrl("file:///android_asset/index.html");
    setContentView(web);
  }

  public class Bridge {
    @JavascriptInterface public void share(String text) {
      Intent i = new Intent(Intent.ACTION_SEND);
      i.setType("text/plain");
      i.putExtra(Intent.EXTRA_TEXT, text);
      startActivity(Intent.createChooser(i, "Compartir viaje CiviTaxi"));
    }
  }
}
