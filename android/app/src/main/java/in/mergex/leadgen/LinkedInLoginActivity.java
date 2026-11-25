package in.mergex.leadgen;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.InputType;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.os.Build;
import android.provider.Settings;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Full LinkedIn login flow in an in-app WebView.
 *
 * Auto-login: fills email + password via JS, then handles OTP if LinkedIn asks for one.
 * OTP: tries SMS user-consent (20 s window) then falls back to an AlertDialog.
 * Session cookies are AES-256-GCM encrypted via Android Keystore.
 * Credentials are used once in the WebView JS sandbox and cleared immediately after.
 */
public class LinkedInLoginActivity extends AppCompatActivity {

    // ── Intent extras ─────────────────────────────────────────────────────────
    public static final String EXTRA_AUTO_EMAIL    = "li_auto_email";
    public static final String EXTRA_AUTO_PASSWORD = "li_auto_password";

    // ── Shared prefs keys ─────────────────────────────────────────────────────
    static final String PREFS_NAME     = "leadgen_linkedin";
    static final String KEY_SESSION    = "li_session_enc";
    static final String KEY_CSRF       = "li_csrf_enc";
    static final String KEYSTORE_ALIAS = "leadgen_li_key_v2";

    // ── URL markers ───────────────────────────────────────────────────────────
    private static final String LOGIN_URL   = "https://www.linkedin.com/login";
    private static final String FEED_PREFIX = "https://www.linkedin.com/feed";

    private static final String TAG             = "LI_AUTO";
    private static final String OTP_CHANNEL_ID  = "leadgen_otp";
    private static final int    OTP_NOTIF_ID    = 9001;
    // Intent action used by the "Enter code" notification button
    static final String ACTION_SHOW_OTP_DIALOG  = "in.mergex.leadgen.SHOW_OTP_DIALOG";

    private WebView  webView;
    private ProgressBar progress;
    private String   autoEmail;
    private String   autoPassword;
    private boolean  captured       = false;
    private boolean  otpInProgress  = false;

    private Handler          otpTimeoutHandler = new Handler(Looper.getMainLooper());
    private ClipboardManager clipboardManager;
    private ClipboardManager.OnPrimaryClipChangedListener clipListener;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        autoEmail    = getIntent().getStringExtra(EXTRA_AUTO_EMAIL);
        autoPassword = getIntent().getStringExtra(EXTRA_AUTO_PASSWORD);

        clipboardManager = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        ensureOtpNotifChannel();

        // If launched from the OTP notification "Enter code" button, show dialog immediately
        if (ACTION_SHOW_OTP_DIALOG.equals(getIntent().getAction())) {
            cancelOtpNotification();
            new Handler(Looper.getMainLooper()).postDelayed(this::showOtpDialog, 400);
        }

        // Progress bar
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setIndeterminate(true);

        // WebView
        webView = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(true);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        // Desktop UA — same as the scraper's REALISTIC_USER_AGENT
        s.setUserAgentString(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
        );

        // Clear stale cookies so we always land on the login page
        CookieManager cm = CookieManager.getInstance();
        cm.removeAllCookies(null);
        cm.flush();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new JsBridge(), "LeadGenBridge");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView v, String url, Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                progress.setVisibility(View.GONE);
                if (url == null) return;

                Log.d(TAG, "onPageFinished: " + url);

                // Delayed DOM dump — 2 s after load so React has time to hydrate
                final String dumpUrl = url;
                new Handler(Looper.getMainLooper()).postDelayed(() -> dumpPageStructure(v, dumpUrl), 2000);

                // Success — capture cookies and close
                if (url.startsWith(FEED_PREFIX)) {
                    captureAndReturn();
                    return;
                }

                // Checkpoint / OTP page
                if (isOtpPage(url)) {
                    handleOtpPage(v, url);
                    return;
                }

                // Login page — inject auto-fill if credentials provided
                if (autoEmail != null && autoPassword != null
                        && (url.contains("/login") || url.contains("/uas/login"))) {
                    // Small delay so React SPA hydrates before we start polling
                    new Handler(Looper.getMainLooper()).postDelayed(
                        () -> injectAutoLogin(autoEmail, autoPassword),
                        800
                    );
                }
            }
        });

        // Layout
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.addView(progress, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));
        layout.addView(webView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(layout);

        webView.loadUrl(LOGIN_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (ACTION_SHOW_OTP_DIALOG.equals(intent.getAction())) {
            cancelOtpNotification();
            showOtpDialog();
        }
    }

    protected void onDestroy() {
        super.onDestroy();
        LeadGenNotificationService.clearOtpCallback();
        stopClipboardListener();
        cancelOtpNotification();
        otpTimeoutHandler.removeCallbacksAndMessages(null);
    }

    // ── OTP detection ─────────────────────────────────────────────────────────

    private boolean isOtpPage(String url) {
        return url.contains("/checkpoint/") || url.contains("/challenge/") ||
               url.contains("/security-verification") || url.contains("/uas/challenge");
    }

    // ── OTP handler ───────────────────────────────────────────────────────────

    private void handleOtpPage(WebView v, String url) {
        if (otpInProgress) return;
        otpInProgress = true;
        Log.d(TAG, "OTP page detected: " + url);

        // Start clipboard watcher regardless — zero permission, works always
        startClipboardListener();

        if (hasNotificationAccess()) {
            // Best path — notification listener reads email OTP automatically
            startNotificationOtpListener();
        } else {
            // No notification access: post a heads-up notification that brings the
            // OTP dialog to front when tapped, AND watch clipboard in parallel.
            postOtpPromptNotification();
            Toast.makeText(this,
                "Check your email for the LinkedIn code — copy it and it'll fill automatically.",
                Toast.LENGTH_LONG).show();
        }

        // 25 s safety fallback — show the in-app dialog if nothing auto-filled yet
        otpTimeoutHandler.postDelayed(this::showOtpDialog, 25_000);
    }

    // ── Track 1: NotificationListenerService ─────────────────────────────────

    private void startNotificationOtpListener() {
        Toast.makeText(this, "Waiting for LinkedIn verification code in your email…", Toast.LENGTH_LONG).show();
        LeadGenNotificationService.setOtpCallback(otp -> runOnUiThread(() -> {
            otpTimeoutHandler.removeCallbacksAndMessages(null);
            Log.d(TAG, "OTP received from notification: " + otp);
            onOtpResolved(otp);
        }));
    }

    // ── Track 2: Clipboard listener (zero permission) ─────────────────────────

    private void startClipboardListener() {
        stopClipboardListener(); // clear any stale one
        clipListener = () -> {
            if (clipboardManager == null) return;
            try {
                ClipData clip = clipboardManager.getPrimaryClip();
                if (clip == null || clip.getItemCount() == 0) return;
                String text = clip.getItemAt(0).coerceToText(this).toString().trim();
                // Accept only a bare 6-digit number (not embedded in longer text)
                if (text.matches("[0-9]{6}")) {
                    Log.d(TAG, "OTP from clipboard: " + text);
                    runOnUiThread(() -> onOtpResolved(text));
                }
            } catch (Exception e) {
                Log.e(TAG, "clipboard read error", e);
            }
        };
        clipboardManager.addPrimaryClipChangedListener(clipListener);
    }

    private void stopClipboardListener() {
        if (clipListener != null && clipboardManager != null) {
            clipboardManager.removePrimaryClipChangedListener(clipListener);
            clipListener = null;
        }
    }

    // ── Track 3: Heads-up notification (when no notification access) ──────────

    private void postOtpPromptNotification() {
        // Intent that brings this activity to the front and shows the OTP dialog
        Intent open = new Intent(this, LinkedInLoginActivity.class);
        open.setAction(ACTION_SHOW_OTP_DIALOG);
        open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);

        PendingIntent pi = PendingIntent.getActivity(this, OTP_NOTIF_ID, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notif = new NotificationCompat.Builder(this, OTP_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("LinkedIn verification code required")
            .setContentText("Open your email, copy the 6-digit code, and it fills automatically — or tap here to enter it.")
            .setStyle(new NotificationCompat.BigTextStyle()
                .bigText("LinkedIn sent a verification code to your email.\n\n• Copy the 6-digit code from the email notification — it fills automatically.\n• Or tap this notification to type it in."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .addAction(android.R.drawable.ic_menu_edit, "Enter code", pi)
            .build();

        try {
            NotificationManagerCompat.from(this).notify(OTP_NOTIF_ID, notif);
        } catch (SecurityException e) {
            Log.w(TAG, "POST_NOTIFICATIONS not granted — skipping OTP notification");
        }
    }

    private void cancelOtpNotification() {
        NotificationManagerCompat.from(this).cancel(OTP_NOTIF_ID);
    }

    private void ensureOtpNotifChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                OTP_CHANNEL_ID, "LinkedIn OTP prompts", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("Prompts you when a LinkedIn verification code is needed");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
    }

    // ── Shared resolution ─────────────────────────────────────────────────────

    /** Called by whichever track (notification / clipboard / dialog) wins first. */
    private void onOtpResolved(String otp) {
        otpTimeoutHandler.removeCallbacksAndMessages(null);
        LeadGenNotificationService.clearOtpCallback();
        stopClipboardListener();
        cancelOtpNotification();
        fillOtp(otp);
    }

    private boolean hasNotificationAccess() {
        try {
            return NotificationManagerCompat.getEnabledListenerPackages(this)
                .contains(getPackageName());
        } catch (Exception e) {
            return false;
        }
    }

    // ── Manual OTP dialog ─────────────────────────────────────────────────────

    private void showOtpDialog() {
        if (captured || isFinishing()) return;
        otpTimeoutHandler.removeCallbacksAndMessages(null);
        LeadGenNotificationService.clearOtpCallback();
        stopClipboardListener();
        cancelOtpNotification();

        // Pre-fill from clipboard if it already has a bare 6-digit code
        String clipPrefill = "";
        try {
            ClipData clip = clipboardManager != null ? clipboardManager.getPrimaryClip() : null;
            if (clip != null && clip.getItemCount() > 0) {
                String t = clip.getItemAt(0).coerceToText(this).toString().trim();
                if (t.matches("[0-9]{6}")) clipPrefill = t;
            }
        } catch (Exception ignored) {}

        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_NUMBER);
        input.setHint("6-digit code");
        if (!clipPrefill.isEmpty()) {
            input.setText(clipPrefill);
            input.selectAll();
        }
        int px = (int)(16 * getResources().getDisplayMetrics().density);
        FrameLayout container = new FrameLayout(this);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT);
        lp.leftMargin = lp.rightMargin = px;
        input.setLayoutParams(lp);
        container.addView(input);

        android.app.AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("LinkedIn verification code")
            .setMessage("Enter the 6-digit code LinkedIn sent to your email:\n(Or copy it — dialog fills automatically)")
            .setView(container)
            .setCancelable(false)
            .setPositiveButton("Submit", (d, w) -> {
                String code = input.getText().toString().trim();
                if (!code.isEmpty()) onOtpResolved(code);
            })
            .setNeutralButton("Paste from clipboard", null) // wired below to avoid auto-dismiss
            .setNegativeButton("Type in browser", (d, w) -> {
                otpInProgress = false; // let user type directly in WebView
            })
            .create();

        dialog.setOnShowListener(d -> {
            // Wire Paste button without dismissing the dialog
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
                try {
                    ClipData c = clipboardManager != null ? clipboardManager.getPrimaryClip() : null;
                    if (c != null && c.getItemCount() > 0) {
                        String t = c.getItemAt(0).coerceToText(this).toString().trim();
                        input.setText(t);
                        input.selectAll();
                    }
                } catch (Exception ignored) {}
            });

            // Watch clipboard while dialog is open — auto-submit if a 6-digit code arrives
            startClipboardListener();
            LeadGenNotificationService.setOtpCallback(otp -> runOnUiThread(() -> {
                input.setText(otp);
                dialog.dismiss();
                onOtpResolved(otp);
            }));
        });

        dialog.show();
    }

    // ── OTP fill via JS ───────────────────────────────────────────────────────

    private void fillOtp(String otp) {
        Log.d(TAG, "Filling OTP: " + otp.length() + " digits");
        // Cleanup already done by onOtpResolved; guard here for direct calls
        LeadGenNotificationService.clearOtpCallback();
        stopClipboardListener();
        cancelOtpNotification();
        otpTimeoutHandler.removeCallbacksAndMessages(null);

        String js =
            "(function(){\n" +
            "  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}\n" +
            "  function setVal(el,v){\n" +
            "    var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;\n" +
            "    setter.call(el,v);\n" +
            "    el.dispatchEvent(new Event('input',{bubbles:true}));\n" +
            "    el.dispatchEvent(new Event('change',{bubbles:true}));\n" +
            "  }\n" +
            "  async function run(){\n" +
            // LinkedIn OTP uses individual digit inputs OR a single field
            "    var singles=Array.from(document.querySelectorAll('input[type=\"number\"],input[inputmode=\"numeric\"],input[autocomplete=\"one-time-code\"],input[name=\"pin\"]'));\n" +
            "    var visible=singles.filter(e=>e.offsetParent!==null);\n" +
            "    if(visible.length>1){\n" +
            // Individual digit boxes
            "      var otp='" + otp + "';\n" +
            "      for(var i=0;i<visible.length&&i<otp.length;i++){\n" +
            "        setVal(visible[i],otp[i]);\n" +
            "        await sleep(80);\n" +
            "      }\n" +
            "    } else if(visible.length===1){\n" +
            "      setVal(visible[0],'" + otp + "');\n" +
            "    } else {\n" +
            // Fallback: any single visible text input
            "      var inp=document.querySelector('input[type=\"text\"]:not([type=\"search\"]),input:not([type])');\n" +
            "      if(inp && inp.offsetParent!==null) setVal(inp,'" + otp + "');\n" +
            "    }\n" +
            "    await sleep(300);\n" +
            // Click submit
            "    var btn=document.querySelector('button[type=\"submit\"]')||\n" +
            "             Array.from(document.querySelectorAll('button')).find(b=>/(submit|verify|confirm|continue)/i.test(b.innerText));\n" +
            "    if(btn)btn.click();\n" +
            "  }\n" +
            "  run();\n" +
            "})();";

        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    // ── Auto-fill login form ───────────────────────────────────────────────────

    /**
     * Injects the full login flow into the WebView.
     * Handles both single-page (email+password on same page) and
     * two-step (email → Continue → password) forms.
     * Calls LeadGenBridge.onError on failure.
     */
    private void dumpPageStructure(WebView v, String url) {
        String js =
            "(function(){\n" +
            "  function safe(s){return String(s||'').replace(/[\\r\\n]+/g,' ').substring(0,300);}\n" +
            "  window.LeadGenBridge.onDump('URL2', location.href);\n" +
            "  var inputs=Array.from(document.querySelectorAll('input'));\n" +
            "  window.LeadGenBridge.onDump('INPUTS2', inputs.map(function(el,i){\n" +
            "    return i+': id='+safe(el.id)+' name='+safe(el.name)+' type='+safe(el.type)\n" +
            "      +' placeholder='+safe(el.placeholder)+' visible='+(el.offsetParent!==null);\n" +
            "  }).join(' | ')||'(none)');\n" +
            "  var btns=Array.from(document.querySelectorAll('button,input[type=\"submit\"]'));\n" +
            "  window.LeadGenBridge.onDump('BUTTONS2', btns.map(function(el,i){\n" +
            "    return i+': type='+safe(el.type)+' text='+safe(el.innerText||el.value)\n" +
            "      +' visible='+(el.offsetParent!==null)+' disabled='+el.disabled;\n" +
            "  }).join(' | ')||'(none)');\n" +
            "})();";
        v.evaluateJavascript(js, null);
    }

    private void injectAutoLogin(String email, String password) {
        String safeEmail    = jsEscape(email);
        String safePassword = jsEscape(password);

        // Stealth flags matching the scraper's STEALTH_SCRIPT
        String stealth =
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined});" +
            "Object.defineProperty(navigator,'plugins',{get:()=>[1,2,3,4,5]});" +
            "Object.defineProperty(navigator,'languages',{get:()=>['en-US','en']});" +
            "window.chrome={runtime:{},loadTimes:function(){},csi:function(){}};" +
            "delete navigator.__proto__.webdriver;";

        String js =
            "(function(){\n" +
            stealth + "\n" +
            "function sleep(ms){return new Promise(r=>setTimeout(r,ms));}\n" +

            // React-aware value setter
            "function setVal(el,v){\n" +
            "  var s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;\n" +
            "  s.call(el,v);\n" +
            "  el.dispatchEvent(new Event('input',{bubbles:true}));\n" +
            "}\n" +

            // Human-like typing
            "async function typeInto(el,text){\n" +
            "  el.focus();\n" +
            "  await sleep(200+Math.random()*300);\n" +
            "  for(var i=0;i<text.length;i++){\n" +
            "    setVal(el,text.substring(0,i+1));\n" +
            "    el.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:text[i]}));\n" +
            "    el.dispatchEvent(new KeyboardEvent('keypress',{bubbles:true,key:text[i]}));\n" +
            "    el.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:text[i]}));\n" +
            "    await sleep(40+Math.random()*80);\n" +
            "  }\n" +
            "  el.dispatchEvent(new Event('change',{bubbles:true}));\n" +
            "  el.blur();\n" +
            "}\n" +

            // Find visible element from a list of selectors
            "function findVisible(selectors){\n" +
            "  for(var s of selectors){\n" +
            "    var els=Array.from(document.querySelectorAll(s));\n" +
            "    var vis=els.find(e=>e.offsetParent!==null&&!e.disabled);\n" +
            "    if(vis)return vis;\n" +
            "  }\n" +
            "  return null;\n" +
            "}\n" +

            // Poll until element appears (timeout ms)
            "async function waitFor(selectors,timeout){\n" +
            "  var end=Date.now()+timeout;\n" +
            "  while(Date.now()<end){\n" +
            "    var el=findVisible(selectors);\n" +
            "    if(el)return el;\n" +
            "    await sleep(500);\n" +
            "  }\n" +
            "  return null;\n" +
            "}\n" +

            // Click the primary submit button — explicitly skip SSO buttons like "Sign in with Microsoft"
            "function clickSubmitBtn(){\n" +
            // 1. button[type="submit"] — most reliable
            "  var btn=document.querySelector('button[type=\"submit\"]');\n" +
            "  if(btn&&btn.offsetParent!==null){btn.click();return true;}\n" +
            // 2. Exact text "Sign in" only — trim & lowercase, skip anything with "with" (SSO)
            "  var allBtns=Array.from(document.querySelectorAll('button,input[type=\"submit\"]'));\n" +
            "  btn=allBtns.find(function(b){\n" +
            "    if(b.offsetParent===null||b.disabled)return false;\n" +
            "    var t=(b.innerText||b.value||'').trim().toLowerCase();\n" +
            "    return (t==='sign in'||t==='submit')&&!/(with|google|microsoft|apple|facebook|linkedin)/i.test(t);\n" +
            "  });\n" +
            "  if(btn){btn.click();return true;}\n" +
            "  return false;\n" +
            "}\n" +

            "async function run(){\n" +

            // ── Step 1: email ──────────────────────────────────────────────
            "  var emailEl=await waitFor(['#username','input[name=\"session_key\"]','input[type=\"email\"]','input[autocomplete=\"username\"]'],30000);\n" +
            "  if(!emailEl){window.LeadGenBridge.onError('Email field not found');return;}\n" +
            "  await typeInto(emailEl,'" + safeEmail + "');\n" +
            "  await sleep(400+Math.random()*400);\n" +

            // ── Step 2: if password not yet visible, click Continue ────────
            "  var pwEl=findVisible(['#password','input[name=\"session_password\"]','input[type=\"password\"]','input[autocomplete=\"current-password\"]']);\n" +
            "  if(!pwEl){\n" +
            "    var clicked=(function(){\n" +
            "      var btns=Array.from(document.querySelectorAll('button,input[type=\"submit\"]'));\n" +
            "      var b=btns.find(function(el){if(el.offsetParent===null||el.disabled)return false;var t=(el.innerText||el.value||'').trim();return /^(continue|next)$/i.test(t);});\n" +
            "      if(b){b.click();return true;}return false;\n" +
            "    })();\n" +
            "    if(!clicked){\n" +
            // Try submitting without continue button (single-step form)
            "      var submitClicked=clickSubmitBtn();\n" +
            "      if(!submitClicked){\n" +
            "        emailEl.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',keyCode:13}));\n" +
            "      }\n" +
            "    }\n" +
            "    pwEl=await waitFor(['#password','input[name=\"session_password\"]','input[type=\"password\"]','input[autocomplete=\"current-password\"]'],15000);\n" +
            "  }\n" +
            "  if(!pwEl){window.LeadGenBridge.onError('Password field not found');return;}\n" +
            "  await sleep(300+Math.random()*300);\n" +
            "  await typeInto(pwEl,'" + safePassword + "');\n" +
            "  await sleep(400+Math.random()*400);\n" +

            // ── Step 3: submit ────────────────────────────────────────────
            "  var submitted=clickSubmitBtn();\n" +
            "  if(!submitted){\n" +
            "    var form=pwEl.closest('form');\n" +
            "    if(form){\n" +
            "      form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));\n" +
            "    } else {\n" +
            "      pwEl.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter',keyCode:13}));\n" +
            "    }\n" +
            "  }\n" +
            // Note: OTP page is handled by Java's onPageFinished/URL watcher
            "}\n" +
            "run();\n" +
            "})();";

        webView.evaluateJavascript(js, null);
    }

    // ── JS Bridge ─────────────────────────────────────────────────────────────

    private class JsBridge {
        @JavascriptInterface
        public void onError(String message) {
            Log.e(TAG, "JS error: " + message);
            new Handler(Looper.getMainLooper()).post(() -> {
                Intent r = new Intent();
                r.putExtra("error", message);
                setResult(Activity.RESULT_CANCELED, r);
                finish();
            });
        }

        @JavascriptInterface
        public void onDump(String tag, String content) {
            int chunk = 3000;
            for (int i = 0; i < content.length(); i += chunk) {
                Log.d("LI_DOM_" + tag, content.substring(i, Math.min(i + chunk, content.length())));
            }
        }
    }

    // ── Cookie capture ────────────────────────────────────────────────────────

    private synchronized void captureAndReturn() {
        if (captured) return;
        captured = true;

        otpTimeoutHandler.removeCallbacksAndMessages(null);
        LeadGenNotificationService.clearOtpCallback();

        CookieManager cm = CookieManager.getInstance();
        String allCookies = cm.getCookie("https://www.linkedin.com");
        if (allCookies == null) {
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }

        String jsessionid = extractCookie(allCookies, "JSESSIONID");
        String liAt       = extractCookie(allCookies, "li_at");

        if (liAt == null || liAt.isEmpty()) {
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }

        String csrf = jsessionid != null ? jsessionid.replaceAll("^\"|\"$", "") : "";

        try {
            getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                .putString(KEY_SESSION, encrypt(allCookies))
                .putString(KEY_CSRF,    encrypt(csrf))
                .apply();
        } catch (Exception e) {
            Log.e(TAG, "Encrypt failed", e);
        }

        // Wipe credentials from memory
        autoEmail    = null;
        autoPassword = null;

        Intent result = new Intent();
        result.putExtra("ok", true);
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String extractCookie(String all, String name) {
        for (String part : all.split(";")) {
            String t = part.trim();
            if (t.startsWith(name + "=")) return t.substring(name.length() + 1);
        }
        return null;
    }

    private static String jsEscape(String s) {
        return s.replace("\\", "\\\\").replace("'", "\\'")
                .replace("\n", "\\n").replace("\r", "\\r");
    }

    // ── AES-256-GCM via Android Keystore ─────────────────────────────────────

    private static SecretKey getOrCreateKey() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(KEYSTORE_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) ks.getEntry(KEYSTORE_ALIAS, null)).getSecretKey();
        }
        KeyGenerator kg = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return kg.generateKey();
    }

    static String encrypt(String plain) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
        byte[] iv  = c.getIV();
        byte[] enc = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
        byte[] out = new byte[iv.length + enc.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(enc, 0, out, iv.length, enc.length);
        return Base64.encodeToString(out, Base64.NO_WRAP);
    }

    static String decrypt(String b64) throws Exception {
        byte[] data = Base64.decode(b64, Base64.NO_WRAP);
        byte[] iv   = new byte[12];
        System.arraycopy(data, 0, iv, 0, 12);
        byte[] enc  = new byte[data.length - 12];
        System.arraycopy(data, 12, enc, 0, enc.length);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, getOrCreateKey(), new GCMParameterSpec(128, iv));
        return new String(c.doFinal(enc), StandardCharsets.UTF_8);
    }
}
