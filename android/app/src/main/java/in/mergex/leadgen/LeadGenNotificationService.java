package in.mergex.leadgen;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Listens to all posted notifications and extracts LinkedIn OTP codes
 * from email app notifications (Gmail, Outlook, etc.).
 *
 * When a 6-digit code is found in a notification whose text mentions LinkedIn
 * or "verification", it fires the registered callback so LinkedInLoginActivity
 * can auto-fill the OTP field.
 *
 * The service is always running when notification access is granted.
 * It only acts when a callback is registered (i.e. during active OTP wait).
 */
public class LeadGenNotificationService extends NotificationListenerService {

    private static final String TAG = "LI_NOTIF";

    // 6-digit OTP pattern
    private static final Pattern OTP_PATTERN = Pattern.compile("\\b([0-9]{6})\\b");

    // Keywords that signal a LinkedIn verification notification
    private static final String[] LINKEDIN_KEYWORDS = {
        "linkedin", "verification", "verify", "otp", "one-time", "sign-in code",
        "login code", "security code", "access code"
    };

    // Email packages we pay attention to (others are ignored to reduce noise)
    private static final String[] EMAIL_PACKAGES = {
        "com.google.android.gm",          // Gmail
        "com.microsoft.office.outlook",   // Outlook
        "com.yahoo.mobile.client.android.mail",
        "com.zoho.mail",
        "com.apple.mobilemail",           // shouldn't appear on Android but just in case
        "com.samsung.android.email.provider",
        "com.android.email",
        "me.proton.android.mail",         // ProtonMail
        "com.tutanota",
    };

    // Static callback — set by LinkedInLoginActivity when it starts waiting for OTP
    private static volatile OtpCallback sCallback = null;

    public interface OtpCallback {
        void onOtpReceived(String otp);
    }

    public static void setOtpCallback(OtpCallback cb) {
        sCallback = cb;
    }

    public static void clearOtpCallback() {
        sCallback = null;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        OtpCallback cb = sCallback;
        if (cb == null) return; // nobody waiting

        String pkg = sbn.getPackageName();
        if (!isEmailPackage(pkg)) return;

        Notification notif = sbn.getNotification();
        if (notif == null) return;

        // Pull all text out of the notification extras
        Bundle extras = notif.extras;
        String title   = stringify(extras.getCharSequence(Notification.EXTRA_TITLE));
        String text    = stringify(extras.getCharSequence(Notification.EXTRA_TEXT));
        String bigText = stringify(extras.getCharSequence(Notification.EXTRA_BIG_TEXT));

        String combined = (title + " " + text + " " + bigText).toLowerCase();
        Log.d(TAG, "Email notif from " + pkg + ": " + combined.substring(0, Math.min(combined.length(), 120)));

        if (!containsLinkedInKeyword(combined)) return;

        // Extract the first 6-digit number
        Matcher m = OTP_PATTERN.matcher(title + " " + text + " " + bigText);
        if (!m.find()) return;

        String otp = m.group(1);
        Log.d(TAG, "OTP extracted: " + otp);

        // Fire once and clear so we don't fire again
        sCallback = null;
        cb.onOtpReceived(otp);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static boolean isEmailPackage(String pkg) {
        for (String ep : EMAIL_PACKAGES) {
            if (ep.equals(pkg)) return true;
        }
        return false;
    }

    private static boolean containsLinkedInKeyword(String text) {
        for (String kw : LINKEDIN_KEYWORDS) {
            if (text.contains(kw)) return true;
        }
        return false;
    }

    private static String stringify(CharSequence cs) {
        return cs != null ? cs.toString() : "";
    }
}
