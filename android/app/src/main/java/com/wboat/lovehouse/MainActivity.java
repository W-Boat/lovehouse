package com.wboat.lovehouse;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.JavascriptInterface;
import android.util.Base64;
import org.json.JSONObject;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int CHOOSE_FILE = 1;
    private static final int SAVE_DOCUMENT = 2;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingSave;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/game/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        webView = new WebView(this);
        webView.setBackgroundColor(0xff211e21);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(true);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "CottageSave",
                Collections.singleton("https://" + HOST), (view, message, origin, isMainFrame, reply) -> {
                    if (isMainFrame) exportDocument(message.getData());
                });
        }
        else {
            webView.addJavascriptInterface(new Object() {
                @JavascriptInterface public void postMessage(String data) {
                    runOnUiThread(() -> {
                        Uri current = Uri.parse(webView.getUrl() == null ? "" : webView.getUrl());
                        if ("https".equals(current.getScheme()) && HOST.equals(current.getHost())) exportDocument(data);
                    });
                }
            }, "CottageSave");
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!HOST.equals(url.getHost())) return null;
                WebResourceResponse bundled = loader.shouldInterceptRequest(url);
                if (bundled != null) return bundled;
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                    java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(url.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (ActivityNotFoundException ignored) { }
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams parameters) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try { startActivityForResult(parameters.createIntent(), CHOOSE_FILE); }
                catch (ActivityNotFoundException error) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                }
                return true;
            }
        });
        setContentView(webView);
        enterImmersiveMode();
        webView.loadUrl("https://" + HOST + "/game/index.html");
    }

    private void exportResult(String result) {
        webView.evaluateJavascript("document.dispatchEvent(new CustomEvent('cottage-export-result',{detail:"
            + JSONObject.quote(result) + "}))", null);
    }

    private void exportDocument(String data) {
        try {
            if (data != null && data.length() < 200) {
                JSONObject command = new JSONObject(data);
                if ("orientation".equals(command.optString("kind"))) {
                    String orientation = command.optString("value");
                    if ("portrait".equals(orientation)) setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
                    if ("landscape".equals(orientation)) setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
                    return;
                }
            }
        } catch (Exception ignored) { }
        if (pendingSave != null) { exportResult("busy"); return; }
        if (data == null || data.length() > 24_000_000) { exportResult("error"); return; }
        String mime = "application/json", filename = "生日小屋存档.json";
        try {
            JSONObject payload = new JSONObject(data);
            if ("image".equals(payload.optString("kind"))) {
                String image = payload.getString("data");
                String prefix = "data:image/png;base64,";
                if (!image.startsWith(prefix)) throw new IllegalArgumentException("PNG required");
                pendingSave = Base64.decode(image.substring(prefix.length()), Base64.DEFAULT);
                byte[] signature = {(byte)137,80,78,71,13,10,26,10};
                if (pendingSave.length < signature.length) throw new IllegalArgumentException("Invalid PNG");
                for (int i=0;i<signature.length;i++) if (pendingSave[i]!=signature[i]) throw new IllegalArgumentException("Invalid PNG");
                mime = "image/png"; filename = "生日小屋合影.png";
            } else {
                if (data.length() > 2_000_000 || !payload.has("version")) throw new IllegalArgumentException("Invalid save");
                pendingSave = data.getBytes(StandardCharsets.UTF_8);
            }
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
                .putExtra(Intent.EXTRA_TITLE, filename);
            startActivityForResult(intent, SAVE_DOCUMENT);
        } catch (Exception error) {
            pendingSave = null; exportResult("error");
            android.widget.Toast.makeText(this, "未能打开导出，请重试", android.widget.Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SAVE_DOCUMENT) {
            byte[] save = pendingSave;
            pendingSave = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && save != null) {
                try (OutputStream output = getContentResolver().openOutputStream(data.getData())) {
                    if (output == null) throw new IOException("No output stream");
                    output.write(save);
                    exportResult("saved");
                } catch (IOException | SecurityException error) {
                    exportResult("error");
                    android.widget.Toast.makeText(this, "未能写入文件", android.widget.Toast.LENGTH_LONG).show();
                }
            } else { exportResult("cancelled"); }
            return;
        }
        if (requestCode != CHOOSE_FILE || fileCallback == null) return;
        ValueCallback<Uri[]> callback = fileCallback;
        fileCallback = null;
        callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
    }

    @Override public void onWindowFocusChanged(boolean focused) {
        super.onWindowFocusChanged(focused);
        if (focused) enterImmersiveMode();
    }

    private void enterImmersiveMode() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override public void onBackPressed() {
        webView.evaluateJavascript(
            "(() => { const control = document.querySelector('#taoyuan-portal > button')"
            + " || document.querySelector('#modal-backdrop:not(.hidden) #close-modal:not(.hidden)')"
            + " || document.querySelector('#dialogue:not(.hidden) #dialogue-close');"
            + " if (!control) return false; control.click(); return true; })()",
            handled -> { if ("false".equals(handled)) finish(); });
    }

    @Override protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }
}
