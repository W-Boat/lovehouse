package com.wboat.lovehouse;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import org.json.JSONObject;

final class ResourceNotification {
    private static final String CHANNEL = "cottage-resource-updates";
    private static final int ID = 4821;
    private final Activity activity;
    private final NotificationManager manager;
    private long lastProgress;
    private boolean running;
    private boolean transferred;

    ResourceNotification(Activity activity) {
        this.activity = activity;
        manager = activity.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "小屋资源更新", NotificationManager.IMPORTANCE_LOW));
        }
    }

    void requestPermission() {
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            var prefs = activity.getPreferences(0);
            if (prefs.getBoolean("resourceNotificationRequested", false)) return;
            prefs.edit().putBoolean("resourceNotificationRequested", true).apply();
            activity.requestPermissions(new String[]{ Manifest.permission.POST_NOTIFICATIONS }, ID);
        }
    }

    void update(JSONObject state) {
        String phase = state.optString("phase");
        boolean progress = phase.equals("checking") || phase.equals("downloading");
        boolean complete = phase.equals("available") || phase.equals("installed");
        if (!progress && !running) return;
        if (!progress && !complete && !phase.equals("error") && !phase.equals("current") && !phase.equals("restored")) return;
        if (phase.equals("checking")) { running = true; transferred = false; }
        if (phase.equals("downloading")) {
            running = true;
            transferred = true;
            long now = SystemClock.elapsedRealtime();
            if (now - lastProgress < 500 && state.optInt("progress") < 100) return;
            lastProgress = now;
        }
        if (!progress) running = false;
        if (phase.equals("current") || phase.equals("restored") || (complete && !transferred)) {
            manager.cancel(ID);
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(activity, CHANNEL) : new Notification.Builder(activity);
        Intent open = new Intent(activity, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int percentage = state.optInt("progress");
        String message = state.optString("message");
        if (phase.equals("downloading")) {
            message += " · " + percentage + "%";
            long bytes = state.optLong("totalBytes", 0);
            if (bytes > 0) message += String.format(java.util.Locale.ROOT, " · %.1f / %.1f MiB",
                state.optLong("downloadedBytes") / 1048576.0, bytes / 1048576.0);
        }
        builder.setContentTitle(progress ? "小屋资源更新中" : complete ? "小屋资源已校验" : "小屋资源暂未更新")
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentText(message)
            .setContentIntent(PendingIntent.getActivity(activity, ID, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
            .setOnlyAlertOnce(true).setShowWhen(false).setOngoing(progress).setAutoCancel(!progress);
        if (progress) {
            builder.setProgress(100, state.optInt("progress"), phase.equals("checking"));
            if (Build.VERSION.SDK_INT >= 36) {
                Bundle extras = new Bundle();
                extras.putBoolean("android.requestPromotedOngoing", true);
                extras.putCharSequence("android.shortCriticalText", phase.equals("downloading") ? percentage + "%" : "检查中");
                builder.addExtras(extras);
            }
        } else if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(45000);
        try { manager.notify(ID, builder.build()); } catch (SecurityException ignored) { }
    }
}
