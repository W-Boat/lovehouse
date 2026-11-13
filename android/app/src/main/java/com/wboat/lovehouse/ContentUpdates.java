package com.wboat.lovehouse;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceResponse;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.zip.*;
import javax.net.ssl.HttpsURLConnection;

final class ContentUpdates {
    private final Activity activity;
    private final File root;
    private final SharedPreferences preferences;
    private final Consumer<JSONObject> listener;
    private final Runnable reload;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final java.util.concurrent.ExecutorService worker = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean();
    private final long bundledVersion;
    private volatile JSONObject candidate;
    private volatile URL candidateUrl;
    private volatile JSONObject status;
    private volatile String servingVersion;

    ContentUpdates(Activity activity, Consumer<JSONObject> listener, Runnable reload) {
        this.activity = activity; this.listener = listener; this.reload = reload;
        root = new File(activity.getFilesDir(), "content-updates");
        preferences = activity.getSharedPreferences("content-updates", 0);
        long version = 0;
        try { version = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0).versionCode - 20000L; }
        catch (Exception ignored) { }
        bundledVersion = Math.max(0, version);
        if (preferences.getBoolean("trial", false)) restore();
        String active = preferences.getString("active", "");
        if (active.matches("[0-9]+") && !new File(new File(root, active), ".verified.json").isFile()) restore();
        if (activeVersion() <= bundledVersion) preferences.edit().remove("active").remove("previous").remove("trial").commit();
        servingVersion = preferences.getString("active", "");
        publish("idle", "可检查资源更新", 0);
    }

    private long activeVersion() {
        try { return Long.parseLong(preferences.getString("active", "0")); }
        catch (Exception ignored) { return 0; }
    }

    private void publish(String phase, String message, int progress) {
        JSONObject result = new JSONObject();
        try {
            result.put("phase", phase).put("message", message).put("progress", progress);
            result.put("version", Math.max(bundledVersion, activeVersion()));
            result.put("url", preferences.getString("url", ""));
            result.put("availableVersion", candidate == null ? 0 : candidate.optLong("version"));
        } catch (Exception ignored) { }
        status = result;
        main.post(() -> { if (!activity.isDestroyed()) listener.accept(result); });
    }

    void command(JSONObject message) {
        String action = message.optString("action");
        if ("status".equals(action)) { listener.accept(status); return; }
        if ("ready".equals(action)) {
            preferences.edit().putBoolean("trial", false).commit();
            worker.execute(() -> {
                String active = preferences.getString("active", ""), previous = preferences.getString("previous", "");
                File[] versions = root.listFiles();
                if (versions != null) for (File version : versions) {
                    if (version.getName().matches("[0-9]+") && !version.getName().equals(active) && !version.getName().equals(previous)) {
                        try { remove(version); } catch (Exception ignored) { }
                    }
                }
            });
            return;
        }
        if (!busy.compareAndSet(false, true)) return;
        worker.execute(() -> {
            try {
                if ("check".equals(action)) {
                    candidate = null;
                    URL url = secureUrl(message.optString("url"));
                    preferences.edit().putString("url", url.toString()).commit();
                    publish("checking", "正在检查资源版本", 0);
                    JSONObject envelope = new JSONObject(new String(fetch(url, 3_000_000), StandardCharsets.UTF_8));
                    byte[] payload = Base64.decode(envelope.getString("payload"), Base64.DEFAULT);
                    byte[] signature = Base64.decode(envelope.getString("signature"), Base64.DEFAULT);
                    byte[] certificate = activity.getPackageManager().getPackageInfo(activity.getPackageName(), PackageManager.GET_SIGNATURES).signatures[0].toByteArray();
                    X509Certificate cert = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(certificate));
                    Signature verifier = Signature.getInstance("SHA256withRSA");
                    verifier.initVerify(cert); verifier.update(payload);
                    if (!verifier.verify(signature)) throw new IOException("资源签名不匹配");
                    JSONObject manifest = new JSONObject(new String(payload, StandardCharsets.UTF_8));
                    if (manifest.getInt("format") != 1 || manifest.getInt("requiredNativeApi") != 1) throw new IOException("请先升级安卓客户端");
                    if (!hex(MessageDigest.getInstance("SHA-256").digest(certificate)).equals(manifest.getString("certificateSha256"))) throw new IOException("证书指纹不匹配");
                    if (!"index.html".equals(manifest.getString("entry")) || !"lovehouse-content.zip".equals(manifest.getString("archive"))) throw new IOException("资源入口格式不支持");
                    long version = manifest.getLong("version");
                    if (version < 1) throw new IOException("无效资源版本");
                    if (version <= Math.max(bundledVersion, activeVersion())) { publish("current", "当前已是最新资源", 100); return; }
                    if (version > Integer.MAX_VALUE) throw new IOException("无效资源版本");
                    JSONObject files = manifest.getJSONObject("files");
                    if (!files.has("index.html") || files.length() > 4096) throw new IOException("资源清单不完整");
                    candidateUrl = secureUrl(new URL(url, manifest.getString("archive")).toString());
                    candidate = manifest;
                    publish("available", "发现新资源，可下载并重启小屋", 0);
                } else if ("install".equals(action)) {
                    if (candidate == null) throw new IOException("请先检查更新");
                    install(candidate, candidateUrl);
                } else if ("rollback".equals(action)) {
                    restore(); publish("restored", "已恢复上一份离线资源", 100); main.post(this::reloadContent);
                } else throw new IOException("不支持的更新操作");
            } catch (Exception error) {
                publish("error", error.getMessage() == null ? "资源更新失败，请重试" : error.getMessage(), 0);
            } finally { busy.set(false); }
        });
    }

    private URL secureUrl(String value) throws Exception {
        URL url = new URL(value);
        if (!"https".equals(url.getProtocol()) || url.getHost().isEmpty() || url.getUserInfo() != null) throw new IOException("请输入 HTTPS 更新清单地址");
        return url;
    }

    private HttpsURLConnection connect(URL url) throws Exception {
        for (int redirects = 0; redirects < 5; redirects++) {
            HttpsURLConnection connection = (HttpsURLConnection) secureUrl(url.toString()).openConnection();
            connection.setConnectTimeout(15000); connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setInstanceFollowRedirects(false);
            int code = connection.getResponseCode();
            if (code >= 300 && code < 400) {
                String location = connection.getHeaderField("Location"); connection.disconnect();
                if (location == null) throw new IOException("无效更新地址");
                url = secureUrl(new URL(url, location).toString()); continue;
            }
            if (code != 200) { connection.disconnect(); throw new IOException("更新服务器返回 " + code); }
            return connection;
        }
        throw new IOException("更新地址重定向过多");
    }

    private byte[] fetch(URL url, int limit) throws Exception {
        HttpsURLConnection connection = connect(url);
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16384]; int read;
            while ((read = input.read(buffer)) != -1) {
                if (output.size() + read > limit) throw new IOException("更新清单过大");
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        } finally { connection.disconnect(); }
    }

    private void install(JSONObject manifest, URL url) throws Exception {
        root.mkdirs();
        File archive = new File(root, "download.zip"), staging = new File(root, "staging");
        remove(staging); staging.mkdirs();
        long expected = manifest.getLong("archiveBytes");
        if (expected < 1 || expected > 300_000_000) throw new IOException("资源包大小不支持");
        HttpsURLConnection connection = connect(url);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(archive)) {
                byte[] buffer = new byte[65536]; long total = 0; int read, prior = -1;
                while ((read = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("下载已取消");
                    total += read;
                    if (total > expected) throw new IOException("资源包大小与清单不符");
                    digest.update(buffer, 0, read); output.write(buffer, 0, read);
                    int progress = (int) (total * 100 / expected);
                    if (progress != prior) { publish("downloading", "正在下载资源", progress); prior = progress; }
                }
                if (total != expected || !hex(digest.digest()).equals(manifest.getString("archiveSha256"))) throw new IOException("资源包校验失败");
            }
            JSONObject files = manifest.getJSONObject("files");
            Set<String> found = new HashSet<>(); long expanded = 0;
            try (ZipInputStream zip = new ZipInputStream(new FileInputStream(archive))) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    String name = entry.getName();
                    File file = safeFile(staging, name);
                    if (entry.isDirectory()) { file.mkdirs(); continue; }
                    if (!files.has(name) || !found.add(name)) throw new IOException("资源文件与清单不符");
                    JSONObject metadata = files.getJSONObject(name);
                    long size = metadata.getLong("bytes"), written = 0;
                    if (size < 0 || size > 200_000_000) throw new IOException("资源文件过大");
                    file.getParentFile().mkdirs(); MessageDigest hash = MessageDigest.getInstance("SHA-256");
                    try (OutputStream output = new FileOutputStream(file)) {
                        byte[] buffer = new byte[65536]; int read;
                        while ((read = zip.read(buffer)) != -1) {
                            if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("解压已取消");
                            written += read; expanded += read;
                            if (written > size || expanded > 700_000_000) throw new IOException("解压资源大小不符");
                            hash.update(buffer, 0, read); output.write(buffer, 0, read);
                        }
                    }
                    if (written != size || !hex(hash.digest()).equals(metadata.getString("sha256"))) throw new IOException("资源文件校验失败");
                }
            }
            if (found.size() != files.length()) throw new IOException("资源文件缺失");
            try (OutputStream out = new FileOutputStream(new File(staging, ".verified.json"))) { out.write(manifest.toString().getBytes(StandardCharsets.UTF_8)); }
            File destination = new File(root, String.valueOf(manifest.getLong("version")));
            remove(destination);
            if (!staging.renameTo(destination)) throw new IOException("无法保存新资源");
            String previous = preferences.getString("active", "");
            if (!preferences.edit().putString("previous", previous).putString("active", destination.getName()).putBoolean("trial", true).commit()) throw new IOException("无法切换资源版本");
            publish("installed", "资源已校验，正在重新进入小屋", 100);
            main.post(() -> {
                reloadContent();
                main.postDelayed(() -> {
                    if (!activity.isFinishing() && !activity.isDestroyed() && preferences.getBoolean("trial", false)) {
                        restore(); publish("restored", "新资源启动未完成，已恢复离线资源", 100); reloadContent();
                    }
                }, 120000);
            });
        } finally { connection.disconnect(); archive.delete(); remove(staging); }
    }

    private File safeFile(File directory, String name) throws Exception {
        if (name.isEmpty() || name.contains("\\") || name.contains(":")) throw new IOException("无效资源路径");
        for (String segment : name.split("/")) if (segment.isEmpty() || segment.startsWith(".")) throw new IOException("无效资源路径");
        File file = new File(directory, name).getCanonicalFile();
        if (!file.getPath().startsWith(directory.getCanonicalPath() + File.separator)) throw new IOException("资源路径越界");
        return file;
    }

    private void remove(File file) throws Exception {
        if (!file.exists()) return;
        if (!file.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) throw new IOException("资源清理路径越界");
        File[] children = file.listFiles();
        if (children != null) for (File child : children) remove(child);
        if (!file.delete()) throw new IOException("无法清理旧资源");
    }

    private void restore() {
        String previous = preferences.getString("previous", "");
        preferences.edit().putString("active", previous).remove("previous").putBoolean("trial", false).commit();
    }

    private void reloadContent() {
        if (activity.isFinishing() || activity.isDestroyed()) return;
        servingVersion = preferences.getString("active", "");
        reload.run();
    }

    WebResourceResponse intercept(Uri url) {
        String active = servingVersion, path = url.getPath();
        if (!active.matches("[0-9]+") || path == null || !path.startsWith("/game/")) return null;
        try {
            File directory = new File(root, active);
            if (!new File(directory, ".verified.json").isFile()) return null;
            File file = safeFile(directory, path.substring(6));
            String extension = MimeTypeMap.getFileExtensionFromUrl(file.getName());
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if ("js".equals(extension)) mime = "text/javascript";
            if ("woff2".equals(extension)) mime = "font/woff2";
            return new WebResourceResponse(mime == null ? "application/octet-stream" : mime, null, new FileInputStream(file));
        } catch (Exception error) {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder output = new StringBuilder();
        for (byte value : bytes) output.append(String.format(Locale.ROOT, "%02x", value & 255));
        return output.toString();
    }

    void close() { worker.shutdownNow(); main.removeCallbacksAndMessages(null); }
}
