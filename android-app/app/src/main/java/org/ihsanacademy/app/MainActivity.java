package org.ihsanacademy.app;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.view.View;
import android.content.Intent;
import android.net.Uri;

public final class MainActivity extends Activity {
    private static final String HOME = "https://ihsan-academy.pages.dev/";
    private static final String OFFLINE_HTML =
        "<!doctype html><html lang='ar' dir='rtl'><meta charset='utf-8'>" +
        "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
        "<meta name='theme-color' content='#245b49'><body style='font-family:Arial,Tahoma;background:#f6f7f5;color:#24352f;padding:28px;line-height:1.9'>" +
        "<h2 style='color:#245b49'>أكاديمية الإحسان</h2>" +
        "<p>لا يوجد اتصال بالإنترنت حاليًا.</p>" +
        "<p>إذا فتحت الأكاديمية سابقًا مع الاتصال، فقد تتمكن من استخدام الصفحات والموارد التي حُفظت على هذا الجهاز.</p>" +
        "<button onclick='location.reload()' style='background:#245b49;color:white;border:0;border-radius:10px;padding:12px 18px'>إعادة المحاولة</button></body></html>";

    private WebView webView;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(36, 91, 73));
        getWindow().setNavigationBarColor(Color.rgb(246, 247, 245));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(246, 247, 245));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setSupportZoom(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if (host != null && (host.equals("ihsan-academy.pages.dev") || host.endsWith(".ihsan-academy.pages.dev"))) return false;
                if ("https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                    return true;
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !isOnline()) {
                    view.loadDataWithBaseURL(HOME, OFFLINE_HTML, "text/html", "UTF-8", null);
                }
            }
        });
        setContentView(webView);
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
            if (webView.getUrl() == null) webView.loadUrl(HOME);
        } else {
            webView.loadUrl(HOME);
        }
    }

    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            Network network = cm.getActiveNetwork();
            NetworkCapabilities caps = network == null ? null : cm.getNetworkCapabilities(network);
            return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
        } catch (Exception ignored) { return false; }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
