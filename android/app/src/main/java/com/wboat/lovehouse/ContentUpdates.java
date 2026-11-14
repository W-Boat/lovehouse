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
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.LongConsumer;
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
    private volatile URL candidateBlobs;
    private volatile JSONObject status;
    private volatile String servingVersion;
    private boolean checkedAutomatically;

    ContentUpdates(Activity activity, Consumer<JSONObject> listener, Runnable reload) {
        this.activity = activity; this.listener = listener; this.reload = reload;
        root = new File(activity.getFilesDir(), "content-updates");
        preferences = activity.getSharedPreferences("content-updates", 0);
        bundledVersion = BuildConfig.BUNDLED_RESOURCE_VERSION;
        if (preferences.getBoolean("trial", false)) rejectTrial();
        String active = preferences.getString("active", "");
        if (active.matches("[0-9]+") && !new File(new File(root, active), ".verified.json").isFile()) restore();
        if (activeVersion() <= bundledVersion) preferences.edit().remove("active").remove("previous").remove("trial").commit();
        String pending = preferences.getString("pending", "");
        if (!pending.isEmpty()) {
            SharedPreferences.Editor change = preferences.edit().remove("pending");
            if (pending.matches("[0-9]+") && Long.parseLong(pending) > Math.max(bundledVersion, activeVersion())
                    && new File(new File(root, pending), ".verified.json").isFile()) {
                change.putString("previous", preferences.getString("active", ""))
                    .putString("active", pending).putBoolean("trial", true);
            }
            change.commit();
        }
        servingVersion = preferences.getString("active", "");
        publish("idle", "可检查资源更新", 0);
        if (preferences.getBoolean("trial", false)) scheduleTrialTimeout();
    }

    private long activeVersion() {
        try { return Long.parseLong(preferences.getString("active", "0")); }
        catch (Exception ignored) { return 0; }
    }

    private long pendingVersion() {
        try { return Long.parseLong(preferences.getString("pending", "0")); }
        catch (NumberFormatException ignored) { return 0; }
    }

    private void publish(String phase, String message, int progress) {
        publish(phase, message, progress, -1, -1);
    }

    private void publish(String phase, String message, int progress, long downloaded, long total) {
        JSONObject result = new JSONObject();
        try {
            result.put("phase", phase).put("message", message).put("progress", progress);
            if (total >= 0) result.put("downloadedBytes", downloaded).put("totalBytes", total);
            result.put("version", Math.max(bundledVersion, activeVersion()));
            result.put("nativeBase", BuildConfig.BASE_PACKAGE).put("nativeRevision", BuildConfig.NATIVE_REVISION)
                .put("autoUpdate", preferences.getBoolean("autoUpdate", true));
            result.put("url", preferences.getString("url", ""));
            result.put("availableVersion", Math.max(candidate == null ? 0 : candidate.optLong("version"), pendingVersion()));
            result.put("canRetry", "error".equals(phase) && candidate != null
                && candidate.optLong("version") > Math.max(bundledVersion, activeVersion()));
        } catch (Exception ignored) { }
        status = result;
        main.post(() -> { if (!activity.isDestroyed()) listener.accept(result); });
    }

    void checkAutomatically() {
        if (checkedAutomatically || preferences.getBoolean("trial", false)) return;
        checkedAutomatically = true;
        JSONObject request = new JSONObject();
        try {
            request.put("action", preferences.getBoolean("autoUpdate", true) ? "auto" : "check").put("url",
                "https://server.080726.xyz/lovehouse/android-update/update.json");
        } catch (Exception ignored) { return; }
        command(request);
    }

    void command(JSONObject message) {
        String action = message.optString("action");
        if ("set-auto".equals(action) && !BuildConfig.BASE_PACKAGE.isEmpty()) {
            preferences.edit().putBoolean("autoUpdate", message.optBoolean("enabled", true)).apply();
            try { status.put("autoUpdate", preferences.getBoolean("autoUpdate", true)); }
            catch (Exception ignored) { }
            listener.accept(status);
            return;
        }
        if ("status".equals(action)) { listener.accept(status); return; }
        if ("ready".equals(action)) {
            String confirmed = servingVersion;
            worker.execute(() -> {
                String current = preferences.getString("active", "");
                if (!current.equals(confirmed)) return;
                preferences.edit().putBoolean("trial", false).commit();
                String previous = BuildConfig.BASE_PACKAGE.isEmpty() ? preferences.getString("previous", "") : "";
                if (previous.isEmpty()) preferences.edit().remove("previous").commit();
                File[] versions = root.listFiles();
                if (versions != null) for (File version : versions) {
                    if (version.getName().matches("[0-9]+") && !version.getName().equals(current) && !version.getName().equals(previous) && !version.getName().equals(preferences.getString("pending", ""))) {
                        try { remove(version); } catch (Exception ignored) { }
                    }
                }
                if (!BuildConfig.BASE_PACKAGE.isEmpty()) checkAutomatically();
            });
            return;
        }
        boolean automatic = "auto".equals(action);
        if (automatic && (preferences.getBoolean("trial", false) || !preferences.getString("pending", "").isEmpty())) return;
        if (!busy.compareAndSet(false, true)) return;
        worker.execute(() -> {
            try {
                if ("check".equals(action) || automatic) {
                    candidate = null;
                    URL url = secureUrl(message.optString("url"));
                    if (!automatic) preferences.edit().putString("url", url.toString()).commit();
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
                    if (automatic && !message.optBoolean("retry") && version == preferences.getLong("failedAutoVersion", -1)) { publish("restored", "正在使用已验证的资源", 100); return; }
                    if (version > Integer.MAX_VALUE) throw new IOException("无效资源版本");
                    JSONObject files = manifest.getJSONObject("files");
                    if (!files.has("index.html") || files.length() > 4096) throw new IOException("资源清单不完整");
                    candidateUrl = secureUrl(new URL(url, manifest.getString("archive")).toString());
                    candidateBlobs = "blobs/".equals(manifest.optString("blobDirectory"))
                        ? secureUrl(new URL(url, "blobs/").toString()) : null;
                    candidate = manifest;
                    if (automatic && preferences.getBoolean("autoUpdate", true)) {
                        if (candidateBlobs != null) install(candidate, candidateUrl, candidateBlobs, true);
                        candidate = null;
                    } else publish("available", "发现新资源，可下载并重启小屋", 0);
                } else if ("install".equals(action)) {
                    if (candidate == null) throw new IOException("请先检查更新");
                    if (candidate.optLong("version") <= Math.max(bundledVersion, activeVersion()))
                        throw new IOException("当前已是最新资源");
                    install(candidate, candidateUrl, candidateBlobs, false);
                } else if ("rollback".equals(action)) {
                    candidate = null;
                    preferences.edit().remove("pending").commit();
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

    private static final class Blob {
        final String hash;
        final long size;
        final ArrayList<File> destinations = new ArrayList<>();
        Blob(String hash, long size) { this.hash = hash; this.size = size; }
    }

    private final class TransferProgress {
        private final long total;
        private long downloaded;
        private long lastUpdate = -1000;
        TransferProgress(long total) { this.total = total; }
        synchronized void report(long change, boolean force) {
            downloaded += change;
            long now = android.os.SystemClock.elapsedRealtime();
            if (force || now - lastUpdate >= 200) {
                lastUpdate = now;
                int ratio = total == 0 ? 100 : (int) (downloaded * 100 / total);
                publish("downloading", total == 0 ? "正在准备本地资源" : "正在下载和校验资源", ratio, downloaded, total);
            }
        }
    }

    private void stageDelta(JSONObject files, File staging, URL blobs) throws Exception {
        String active = preferences.getString("active", "");
        File base = active.matches("[0-9]+") ? new File(root, active) : null;
        byte[] buffer = new byte[65536];
        long expanded = 0, missingBytes = 0;
        Map<String, Blob> grouped = new HashMap<>();
        Map<File, String> namesByDestination = new HashMap<>();
        for (Iterator<String> names = files.keys(); names.hasNext();) {
            String name = names.next();
            File destination = safeFile(staging, name);
            JSONObject metadata = files.getJSONObject(name);
            long size = metadata.getLong("bytes");
            String hash = metadata.getString("sha256");
            if (size < 0 || size > 200_000_000 || !hash.matches("[a-f0-9]{64}") || (expanded += size) > 700_000_000
                    || namesByDestination.put(destination, name) != null) throw new IOException("增量资源清单无效");
            Blob entry = grouped.computeIfAbsent(hash, key -> new Blob(key, size));
            if (entry.size != size) throw new IOException("增量资源大小冲突");
            entry.destinations.add(destination);
        }

        publish("checking", "正在核对本机已有资源", 0);
        List<Blob> missing = new ArrayList<>();
        for (Blob blob : grouped.values()) {
            File destination = blob.destinations.get(0);
            destination.getParentFile().mkdirs();
            boolean reused = false;
            for (File path : blob.destinations) {
                String name = namesByDestination.get(path);
                if (base != null) {
                    File cached = safeFile(base, name);
                    if (cached.isFile() && cached.length() == blob.size) {
                        try (InputStream input = new FileInputStream(cached)) {
                            reused = copyVerified(input, destination, blob.size, blob.hash, buffer);
                        }
                    }
                }
                if (!reused) {
                    InputStream bundled = null;
                    try { bundled = activity.getAssets().open(name); } catch (FileNotFoundException ignored) { }
                    if (bundled != null) try (InputStream input = bundled) {
                        reused = copyVerified(input, destination, blob.size, blob.hash, buffer);
                    }
                }
                if (reused) break;
            }
            if (reused) copyAliases(blob, buffer);
            else { missing.add(blob); missingBytes += blob.size; }
        }

        TransferProgress progress = new TransferProgress(missingBytes);
        progress.report(0, true);
        if (missing.isEmpty()) return;
        missing.sort(Comparator.comparingLong((Blob blob) -> blob.size).reversed());
        ExecutorService downloads = Executors.newFixedThreadPool(Math.min(6, missing.size()));
        CompletionService<Void> completion = new ExecutorCompletionService<>(downloads);
        try {
            for (Blob blob : missing) completion.submit(() -> {
                downloadBlob(blobs, blob, progress);
                return null;
            });
            for (int remaining = missing.size(); remaining > 0; remaining--) completion.take().get();
            progress.report(0, true);
        } catch (ExecutionException failed) {
            if (failed.getCause() instanceof Exception) throw (Exception) failed.getCause();
            throw failed;
        } finally {
            downloads.shutdownNow();
            // No worker may write to staging after install() starts cleaning it.
            boolean interrupted = false;
            while (!downloads.isTerminated()) {
                try { downloads.awaitTermination(1, TimeUnit.SECONDS); }
                catch (InterruptedException ignored) { interrupted = true; }
            }
            if (interrupted) Thread.currentThread().interrupt();
        }
    }

    private void downloadBlob(URL blobs, Blob blob, TransferProgress progress) throws Exception {
        byte[] buffer = new byte[65536];
        for (int attempt = 0; ; attempt++) {
            long[] read = {0};
            HttpsURLConnection connection = null;
            try {
                connection = connect(new URL(blobs, blob.hash));
                try (InputStream input = connection.getInputStream()) {
                    if (!copyVerified(input, blob.destinations.get(0), blob.size, blob.hash, buffer, bytes -> {
                        read[0] += bytes;
                        progress.report(bytes, false);
                    })) throw new IOException("增量资源校验失败");
                }
                break;
            } catch (IOException error) {
                progress.report(-read[0], false);
                if (attempt >= 2 || Thread.currentThread().isInterrupted() || error instanceof InterruptedIOException && !(error instanceof SocketTimeoutException)) throw error;
                Thread.sleep(350L * (attempt + 1));
            } finally { if (connection != null) connection.disconnect(); }
        }
        copyAliases(blob, buffer);
    }

    private void copyAliases(Blob blob, byte[] buffer) throws Exception {
        for (int i = 1; i < blob.destinations.size(); i++) {
            File target = blob.destinations.get(i);
            target.getParentFile().mkdirs();
            try (InputStream input = new FileInputStream(blob.destinations.get(0))) {
                if (!copyVerified(input, target, blob.size, blob.hash, buffer)) throw new IOException("本地资源校验失败");
            }
        }
    }

    private boolean copyVerified(InputStream input, File file, long size, String hash, byte[] buffer) throws Exception {
        return copyVerified(input, file, size, hash, buffer, bytes -> {});
    }

    private boolean copyVerified(InputStream input, File file, long size, String hash, byte[] buffer, LongConsumer progress) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (OutputStream output = new FileOutputStream(file)) {
            long total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("更新已取消");
                total += read;
                if (total > size) return false;
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
                progress.accept(read);
            }
            return total == size && hash.equals(hex(digest.digest()));
        }
    }

    private void install(JSONObject manifest, URL url, URL blobs, boolean automatic) throws Exception {
        root.mkdirs();
        File archive = new File(root, "download.zip"), staging = new File(root, "staging");
        remove(staging); staging.mkdirs();
        long expected = manifest.getLong("archiveBytes");
        if (expected < 1 || expected > 300_000_000) throw new IOException("资源包大小不支持");
        HttpsURLConnection connection = null;
        try {
            JSONObject files = manifest.getJSONObject("files");
            if (blobs != null) {
                stageDelta(files, staging, blobs);
            } else {
                connection = connect(url);
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(archive)) {
                    byte[] buffer = new byte[65536]; long total = 0; int read, prior = -1;
                    while ((read = input.read(buffer)) != -1) {
                        if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException("下载已取消");
                        total += read;
                        if (total > expected) throw new IOException("资源包大小与清单不符");
                        digest.update(buffer, 0, read); output.write(buffer, 0, read);
                        int progress = (int) (total * 100 / expected);
                        if (progress != prior) { publish("downloading", "正在下载资源", progress, total, expected); prior = progress; }
                    }
                    if (total != expected || !hex(digest.digest()).equals(manifest.getString("archiveSha256"))) throw new IOException("资源包校验失败");
                }
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
            }
            publish("downloading", "正在保存已校验的资源", 100);
            try (OutputStream out = new FileOutputStream(new File(staging, ".verified.json"))) { out.write(manifest.toString().getBytes(StandardCharsets.UTF_8)); }
            File destination = new File(root, String.valueOf(manifest.getLong("version")));
            remove(destination);
            if (!staging.renameTo(destination)) throw new IOException("无法保存新资源");
            if (automatic && !servingVersion.isEmpty()) {
                if (!preferences.edit().putString("pending", destination.getName()).commit())
                    throw new IOException("无法安排资源更新");
                publish("available", "资源已校验，重新打开小屋即可启用", 100);
                return;
            }
            String previous = preferences.getString("active", "");
            if (!preferences.edit().putString("previous", previous).putString("active", destination.getName()).putBoolean("trial", true).remove("pending").commit()) throw new IOException("无法切换资源版本");
            candidate = null;
            publish("installed", "资源已校验，正在重新进入小屋", 100);
            main.post(() -> {
                reloadContent();
                scheduleTrialTimeout();
            });
        } finally { if (connection != null) connection.disconnect(); archive.delete(); remove(staging); }
    }

    private void scheduleTrialTimeout() {
        main.postDelayed(() -> {
            if (!activity.isFinishing() && !activity.isDestroyed() && preferences.getBoolean("trial", false)) {
                rejectTrial();
                publish("restored", "新资源启动未完成，已恢复离线资源", 100);
                reloadContent();
            }
        }, 120000);
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

    private void rejectTrial() {
        preferences.edit().putLong("failedAutoVersion", activeVersion()).commit();
        restore();
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
