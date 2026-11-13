package com.derrellwilliams.wavelane;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.webkit.WebView;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Saves films to the tablet through Android's DownloadManager, so a transfer carries on when the
 * app is closed and resumes after a Wi-Fi drop. Files go into the app's own folder (no storage
 * permission; uninstalling deletes them). The token is passed as a request header only and is
 * never logged or put in the URL or the file name.
 */
@CapacitorPlugin(name = "WavelaneDownloads")
public class WavelaneDownloads extends Plugin {
    private static final Pattern LETTERBOXD_PATH = Pattern.compile("^/[A-Za-z0-9_/]{1,80}$");
    private static final Pattern LETTERBOXD_REDIRECT = Pattern.compile("^(?:https://letterboxd\\.com(/[^\\s]*)|(/[^\\s]*))$");
    private static final Pattern NAME = Pattern.compile("^[A-Za-z0-9._-]{1,100}$");

    private DownloadManager manager() {
        return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
    }

    private File directory() {
        return getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES);
    }

    @PluginMethod
    public void info(PluginCall call) {
        File dir = directory();
        if (dir == null) {
            call.reject("Storage is not available");
            return;
        }
        StatFs fs = new StatFs(dir.getAbsolutePath());
        String webView = "unknown";
        android.content.pm.PackageInfo pkg = WebView.getCurrentWebViewPackage();
        if (pkg != null) webView = pkg.packageName + " " + pkg.versionName;
        JSObject result = new JSObject();
        result.put("directory", dir.getAbsolutePath());
        result.put("freeBytes", fs.getAvailableBytes());
        result.put("totalBytes", fs.getTotalBytes());
        result.put("webView", webView);
        result.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(result);
    }

    @PluginMethod
    public void enqueue(PluginCall call) {
        String url = call.getString("url");
        String authorization = call.getString("authorization");
        String name = call.getString("name");
        if (url == null || authorization == null || name == null || !NAME.matcher(name).matches()) {
            call.reject("Bad request");
            return;
        }
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            call.reject("Only http and https addresses can be downloaded");
            return;
        }
        File dir = directory();
        if (dir == null) {
            call.reject("Storage is not available");
            return;
        }
        // DownloadManager refuses to overwrite, so clear an old copy (and its entry) first.
        removeEarlier(name);
        File existing = new File(dir, name);
        if (existing.exists() && !existing.delete()) {
            call.reject("Could not replace the old file");
            return;
        }
        DownloadManager.Request request = new DownloadManager.Request(uri);
        request.addRequestHeader("Authorization", authorization);
        request.setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_MOVIES, name);
        request.setTitle("Wavelane");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);
        request.setAllowedOverRoaming(false);
        try {
            long id = manager().enqueue(request);
            JSObject result = new JSObject();
            result.put("id", id);
            call.resolve(result);
        } catch (RuntimeException e) {
            call.reject("Could not start the download");
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        Long id = idOf(call);
        if (id == null) {
            call.reject("Bad request");
            return;
        }
        try (Cursor cursor = manager().query(new DownloadManager.Query().setFilterById(id))) {
            JSObject result = new JSObject();
            if (cursor == null || !cursor.moveToFirst()) {
                result.put("state", "unknown");
                result.put("bytes", 0);
                result.put("total", 0);
                result.put("reason", 0);
            } else {
                int state = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                result.put("state", stateName(state));
                result.put("bytes", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
                result.put("total", cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)));
                result.put("reason", cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)));
            }
            call.resolve(result);
        }
    }

    /** Keeps the screen on while a film plays (the player turns it off again when it pauses or closes). */
    @PluginMethod
    public void keepAwake(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on"));
        getActivity().runOnUiThread(() -> {
            android.view.Window window = getActivity().getWindow();
            if (on) window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    /**
     * One GET to letterboxd.com, for the average rating and the public feed (the page has no CORS
     * access, so the web view can't). Only that host: the caller gives a path, never a URL, and a
     * redirect is followed only when it stays on the host. Replies over 3 MB are refused.
     */
    @PluginMethod
    public void letterboxd(PluginCall call) {
        String path = call.getString("path");
        if (path == null || !LETTERBOXD_PATH.matcher(path).matches()) {
            call.reject("Bad request");
            return;
        }
        try {
            for (int hop = 0; hop <= 4; hop++) {
                HttpURLConnection connection = (HttpURLConnection) new URL("https://letterboxd.com" + path).openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(12000);
                connection.setRequestProperty("User-Agent", "Wavelane/0.1 (Android tablet app)");
                connection.setRequestProperty("Accept", "text/html,application/rss+xml");
                int status = connection.getResponseCode();
                String location = connection.getHeaderField("Location");
                if (status >= 300 && status < 400 && location != null) {
                    connection.disconnect();
                    java.util.regex.Matcher next = LETTERBOXD_REDIRECT.matcher(location);
                    if (!next.matches()) {
                        call.reject("Redirect left letterboxd.com");
                        return;
                    }
                    path = next.group(1) != null ? next.group(1) : next.group(2);
                    continue;
                }
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                ByteArrayOutputStream body = new ByteArrayOutputStream();
                if (stream != null) {
                    byte[] buffer = new byte[16384];
                    int read;
                    while ((read = stream.read(buffer)) != -1) {
                        body.write(buffer, 0, read);
                        if (body.size() > 3 * 1024 * 1024) {
                            connection.disconnect();
                            call.reject("Response too large");
                            return;
                        }
                    }
                    stream.close();
                }
                connection.disconnect();
                JSObject result = new JSObject();
                result.put("status", status);
                result.put("path", path);
                result.put("body", new String(body.toByteArray(), StandardCharsets.UTF_8));
                call.resolve(result);
                return;
            }
            call.reject("Too many redirects");
        } catch (Exception e) {
            call.reject("Couldn't reach letterboxd.com");
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        Long id = idOf(call);
        if (id == null) {
            call.reject("Bad request");
            return;
        }
        manager().remove(id); // also deletes the file
        call.resolve();
    }

    /**
     * The download id from the call. Capacitor's getLong only accepts a Java Long, but a small
     * number from JavaScript arrives as an Integer, so read it as a number of any kind.
     */
    private static Long idOf(PluginCall call) {
        long id = call.getData().optLong("id", -1);
        return id >= 0 ? Long.valueOf(id) : null;
    }

    /** Removes earlier downloads (and their files) that were saved under this name. */
    private void removeEarlier(String name) {
        try (Cursor cursor = manager().query(new DownloadManager.Query())) {
            if (cursor == null) return;
            int idColumn = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_ID);
            int uriColumn = cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI);
            while (cursor.moveToNext()) {
                String uri = cursor.getString(uriColumn);
                if (uri != null && uri.endsWith("/" + name)) manager().remove(cursor.getLong(idColumn));
            }
        }
    }

    private static String stateName(int state) {
        switch (state) {
            case DownloadManager.STATUS_PENDING:
                return "pending";
            case DownloadManager.STATUS_RUNNING:
                return "running";
            case DownloadManager.STATUS_PAUSED:
                return "paused";
            case DownloadManager.STATUS_SUCCESSFUL:
                return "successful";
            case DownloadManager.STATUS_FAILED:
                return "failed";
            default:
                return "unknown";
        }
    }
}
