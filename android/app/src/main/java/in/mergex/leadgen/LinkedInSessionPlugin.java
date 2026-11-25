package in.mergex.leadgen;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LinkedInSession")
public class LinkedInSessionPlugin extends Plugin {

    private static final String PREFS_NAME  = LinkedInLoginActivity.PREFS_NAME;
    private static final String KEY_SESSION = LinkedInLoginActivity.KEY_SESSION;
    private static final String KEY_CSRF    = LinkedInLoginActivity.KEY_CSRF;

    // ── Manual login — opens WebView, user types credentials themselves ────────
    @PluginMethod
    public void login(PluginCall call) {
        Intent intent = new Intent(getActivity(), LinkedInLoginActivity.class);
        startActivityForResult(call, intent, "loginResult");
    }

    // ── Auto login — app fills email/password in the WebView form ─────────────
    // Credentials are passed into the Activity, used ONCE to fill the form via JS,
    // then cleared from memory. They are NEVER written to disk or sent anywhere.
    @PluginMethod
    public void autoLogin(PluginCall call) {
        String email    = call.getString("email", "").trim();
        String password = call.getString("password", "");
        if (email.isEmpty() || password.isEmpty()) {
            call.reject("Email and password are required.");
            return;
        }
        Intent intent = new Intent(getActivity(), LinkedInLoginActivity.class);
        intent.putExtra(LinkedInLoginActivity.EXTRA_AUTO_EMAIL,    email);
        intent.putExtra(LinkedInLoginActivity.EXTRA_AUTO_PASSWORD, password);
        startActivityForResult(call, intent, "loginResult");
    }

    @ActivityCallback
    private void loginResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } else {
            android.content.Intent data = result.getData();
            String error = data != null ? data.getStringExtra("error") : null;
            call.reject(error != null ? error : "Login cancelled.");
        }
    }

    // ── Session read ──────────────────────────────────────────────────────────
    @PluginMethod
    public void getSession(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String encCookie = prefs.getString(KEY_SESSION, null);
        String encCsrf   = prefs.getString(KEY_CSRF,    null);
        if (encCookie == null) {
            call.reject("No LinkedIn session. Please sign in first.");
            return;
        }
        try {
            JSObject ret = new JSObject();
            ret.put("cookie", LinkedInLoginActivity.decrypt(encCookie));
            ret.put("csrf",   encCsrf != null ? LinkedInLoginActivity.decrypt(encCsrf) : "");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not read session: " + e.getMessage());
        }
    }

    // ── Session probe ─────────────────────────────────────────────────────────
    @PluginMethod
    public void hasSession(PluginCall call) {
        boolean has = getContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .contains(KEY_SESSION);
        JSObject ret = new JSObject();
        ret.put("value", has);
        call.resolve(ret);
    }

    // ── Session clear ─────────────────────────────────────────────────────────
    @PluginMethod
    public void clearSession(PluginCall call) {
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().clear().apply();
        call.resolve(new JSObject());
    }

    /** Returns true if the app has notification listener access. */
    @PluginMethod
    public void hasNotificationAccess(PluginCall call) {
        boolean granted = androidx.core.app.NotificationManagerCompat
            .getEnabledListenerPackages(getContext())
            .contains(getContext().getPackageName());
        JSObject ret = new JSObject();
        ret.put("value", granted);
        call.resolve(ret);
    }

    /** Opens Android's notification listener settings screen. */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        android.content.Intent intent = new android.content.Intent(
            android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve(new JSObject());
    }
}
