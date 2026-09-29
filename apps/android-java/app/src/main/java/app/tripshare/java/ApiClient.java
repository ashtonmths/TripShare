package app.tripshare.java;

import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class ApiClient {
    interface Callback { void complete(Object result, String error); }
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final SessionStore session;

    ApiClient(SessionStore session) { this.session = session; }

    void query(String route, JSONObject input, Callback callback) {
        String path = "/api/trpc/" + route;
        if (input != null) path += "?input=" + Uri.encode(json("json", input).toString());
        request("GET", path, null, callback);
    }

    void mutate(String route, JSONObject input, Callback callback) {
        request("POST", "/api/trpc/" + route, json("json", input), callback);
    }

    void auth(String route, JSONObject input, Callback callback) {
        request("POST", "/api/auth/" + route, input, callback);
    }

    void session(Callback callback) { request("GET", "/api/auth/get-session", null, callback); }

    void request(String method, String path, JSONObject body, Callback callback) {
        worker.execute(() -> {
            Object data = null;
            String error = null;
            try {
                HttpURLConnection connection = (HttpURLConnection) new URL(BuildConfig.API_BASE_URL + path).openConnection();
                connection.setRequestMethod(method);
                connection.setConnectTimeout(12000);
                connection.setReadTimeout(16000);
                connection.setRequestProperty("Accept", "application/json");
                connection.setRequestProperty("expo-origin", "tripsharejava://");
                connection.setRequestProperty("x-skip-oauth-proxy", "true");
                String cookie = session.read();
                if (!cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
                if (body != null) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json");
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }
                }
                int status = connection.getResponseCode();
                String response = read(status < 400 ? connection.getInputStream() : connection.getErrorStream());
                if (status >= 400) {
                    JSONObject failure = new JSONObject(response);
                    error = failure.optJSONObject("error") != null
                            ? failure.optJSONObject("error").optString("message", "Request failed")
                            : failure.optString("message", "Request failed (" + status + ")");
                } else if (!response.isEmpty()) {
                    Object parsed = response.startsWith("[") ? new JSONArray(response) : new JSONObject(response);
                    if (path.startsWith("/api/trpc/") && parsed instanceof JSONObject) {
                        JSONObject envelope = ((JSONObject) parsed).optJSONObject("result");
                        Object value = envelope == null ? null : envelope.opt("data");
                        if (value instanceof JSONObject && ((JSONObject) value).has("json")) value = ((JSONObject) value).opt("json");
                        data = value;
                    } else data = parsed;
                }
                connection.disconnect();
            } catch (Exception e) { error = e.getMessage() == null ? "Connection failed" : e.getMessage(); }
            Object result = data;
            String failure = error;
            main.post(() -> callback.complete(result, failure));
        });
    }

    static JSONObject json(Object... values) {
        JSONObject object = new JSONObject();
        try {
            for (int i = 0; i + 1 < values.length; i += 2) object.put(String.valueOf(values[i]), values[i + 1]);
        } catch (Exception ignored) { }
        return object;
    }

    private static String read(InputStream stream) throws Exception {
        if (stream == null) return "";
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
