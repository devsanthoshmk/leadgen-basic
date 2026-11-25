# Android On-Device LinkedIn Integration & Chrome DevTools MCP Research

## Executive Summary

This research report evaluates the technical feasibility, architectural paradigms, security boundaries, and protocol constraints of integrating LinkedIn capabilities into an Android on-device application. It investigates three interconnected areas:
1. **Official LinkedIn on-device integration** via primary documentation (LinkedIn OpenID Connect / REST APIs vs. native Android presentation layers).
2. **Static architectural inspection of sibling project `../linkedin-scraper.js`**, contrasting its desktop-centric browser automation with mobile execution.
3. **Chrome DevTools Model Context Protocol (MCP)** capabilities, specifically evaluating whether MCP supports inspecting controlled Android WebViews or desktop browsers, and formally distinguishing **debugging/development instrumentation** from **production runtime architectures**.

### Core Verdicts
- **Official Authentication:** LinkedIn authentication on Android MUST follow **RFC 8252 (OAuth 2.0 for Native Apps)** using **Android Custom Tabs** or **Auth Tab** (`androidx.browser:browser`) pointing to LinkedIn's OpenID Connect (OIDC) endpoints. Embedded `WebView` usage for OAuth is explicitly deprecated and actively restricted by modern identity providers.
- **API Availability:** Self-serve LinkedIn APIs are restricted to Open Permissions: Sign In with OpenID Connect (`openid`, `profile`, `email`) and Share on LinkedIn (`w_member_social`). Deep search, company directory lookups, and lead data retrieval are closed enterprise APIs requiring formal LinkedIn Partner Program approval (e.g., Marketing Developer Platform, Community Management API).
- **Sibling Architecture Analysis:** The sibling project (`../linkedin-scraper.js`) relies on desktop Playwright automation to extract private web session cookies (`li_at`, `JSESSIONID`) and execute raw HTTP requests against private internal Voyager endpoints (`/voyager/api/...`). This approach is technically incompatible with Android on-device execution, violates platform security sandboxes, and breaches LinkedIn's User Agreement.
- **Chrome DevTools MCP & Android WebView:** The `chrome-devtools-mcp` server connects to Chromium-based targets exposing the Chrome DevTools Protocol (CDP). While it can connect to a controlled Android WebView via ADB forward (`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`) with `WebView.setWebContentsDebuggingEnabled(true)`, this is strictly a **development-time debugging facility**. It cannot operate as a self-contained runtime engine on an un-tethered Android production device.

---

## 1. LinkedIn Official Authentication & API Access

### 1.1 Sign In with LinkedIn using OpenID Connect (OIDC)
LinkedIn has fully transitioned its consumer authentication model to OpenID Connect (OIDC), deprecating its legacy v1 OAuth member data endpoints (`r_liteprofile` and `r_emailaddress`) as of August 1, 2023. Modern implementations must use the OIDC v2 flow.

#### OIDC Specifications & Discovery
LinkedIn publishes its standard OpenID configuration at:
```text
https://www.linkedin.com/oauth/.well-known/openid-configuration
```

Key configuration endpoints:
- **Authorization Endpoint:** `https://www.linkedin.com/oauth/v2/authorization`
- **Token Endpoint:** `https://www.linkedin.com/oauth/v2/accessToken`
- **UserInfo Endpoint:** `https://api.linkedin.com/v2/userinfo`
- **JWKS URI:** `https://www.linkedin.com/oauth/openid/jwks`
- **Supported Signing Algorithms:** `RS256`
- **Supported Response Types:** `code` (Authorization Code Grant)

#### Scopes & Claims
LinkedIn provides three self-serve (Open Permission) scopes under the OIDC product:
| Scope | Description | Associated Claims / Attributes |
| :--- | :--- | :--- |
| `openid` | Mandatory scope signaling an OIDC authentication request. | Generates JWT ID token with issuer (`iss`), subject (`sub`), audience (`aud`), issue time (`iat`), expiration (`exp`). |
| `profile` | Requests member's lite public profile. | `name`, `given_name`, `family_name`, `picture`, `locale`. |
| `email` | Requests member's primary registered email address. | `email`, `email_verified` (Boolean). |

#### Authorization Code Flow with PKCE (for Native Android)
Native mobile applications are public clients that cannot securely store a `client_secret`. Per RFC 8252, Android integrations must utilize the Authorization Code Grant with **Proof Key for Code Exchange (PKCE, RFC 7636)**:
1. The Android client generates a cryptographically secure random `code_verifier` (43–128 characters) and derives a `code_challenge` using SHA-256 (`code_challenge_method=S256`).
2. The client opens an external browser tab to LinkedIn's authorization endpoint:
   ```text
   GET https://www.linkedin.com/oauth/v2/authorization?
       response_type=code&
       client_id={CLIENT_ID}&
       redirect_uri={ENCODED_REDIRECT_URI}&
       state={CRYPTOGRAPHIC_STATE}&
       scope=openid%20profile%20email&
       code_challenge={CODE_CHALLENGE}&
       code_challenge_method=S256
   ```
3. LinkedIn authenticates the user (or uses existing session cookies in the browser) and prompts for consent.
4. The browser redirects back to the native app's registered redirect URI (using Android App Links or a Custom URI Scheme).
5. The Android client captures the `authorization_code` from the redirect and exchanges it at the token endpoint, presenting the original `code_verifier`.
6. LinkedIn returns an `access_token` and a signed JWT `id_token`.

### 1.2 LinkedIn API Access Tiers & Partner Restrictions
LinkedIn organizes its API ecosystem into rigid accessibility tiers:

1. **Open Permissions (Self-Serve):**
   - *Sign In with LinkedIn using OpenID Connect:* Profile identification (`openid`, `profile`, `email`).
   - *Share on LinkedIn:* Publishing posts and basic member social sharing (`w_member_social`).
2. **Enterprise & Partner Programs (Requires Explicit Approval):**
   - *Community Management API:* Managing company pages, posts, analytics, and comments on behalf of organizations.
   - *Marketing Developer Platform (MDP):* Ad campaign management, lead gen forms API, conversion tracking.
   - *Talent & Recruiter Solutions:* Job postings, candidate ingestion, recruiter search (highly controlled).
   - *Sales Navigator Integration:* Enterprise CRM data sync and contact intelligence.
3. **Company / People Search Availability:**
   - There are **no public, self-serve REST APIs** for unstructured company search, people search, or B2B directory scraping.
   - LinkedIn explicitly restricts search APIs to contracted enterprise partners under strict data-retention SLAs.
   - Section 8.2 of the **LinkedIn User Agreement** strictly prohibits scraping, spidering, crawling, or accessing services through unauthorized programmatic interfaces without express written authorization.

---

## 2. Android In-App Authentication: Custom Tabs vs. WebView

When integrating web-based identity flows into an Android application, developers must choose between system-level browser tabs and embedded WebViews. Primary standards and security guidance dictate this architectural decision.

### 2.1 RFC 8252 (OAuth 2.0 for Native Apps)
RFC 8252 is the IETF Best Current Practice (BCP 212) governing OAuth 2.0 in native apps. Section 4 and Section 8.12 provide unambiguous rules:
- **Mandate for External User-Agents:** Native applications **MUST** use an external user-agent (the system browser or in-app browser tab) for authorization requests.
- **Prohibition of Embedded User-Agents:** Native applications **MUST NOT** use embedded user-agents (such as `android.webkit.WebView`).
- **Security Justification:**
  - *Credential Protection:* An embedded `WebView` operates inside the host application's memory space. A malicious or compromised app can inspect every keystroke (password theft), alter DOM elements, inject arbitrary JavaScript, and steal session authentication cookies.
  - *Phishing & Trust Ambiguity:* WebViews lack an immutable, system-rendered address bar and TLS lock indicator. Users cannot verify whether they are submitting credentials to `linkedin.com` or a lookalike harvesting portal.
  - *Violation of Least Privilege:* Accessing raw login credentials exceeds the scope of the delegated authorization requested via OAuth.
- **Single Sign-On (SSO) & Usability:** An external user-agent shares the persistent cookie jar and authentication state of the system browser. If the user is already authenticated on LinkedIn in Chrome, they can complete the flow with a single click without re-entering credentials.

### 2.2 Android Custom Tabs & Auth Tab Architecture
To preserve seamless in-app navigation while honoring RFC 8252, Android provides the **Custom Tabs** framework (`androidx.browser:browser`).

#### Mechanism & Features
- **Process Isolation:** Custom Tabs execute in the separate process of the default browser (e.g., Google Chrome), not the host application process. The host app has zero visibility into the DOM, JavaScript context, or cookie store.
- **Visual Consistency:** Custom Tabs allow the app to customize toolbar colors, entrance/exit animations, and action buttons, keeping the user visually immersed in the application.
- **Performance Optimization:** Through `CustomTabsClient.warmup()` and `CustomTabsSession.mayLaunchUrl()`, the browser pre-allocates resources and pre-resolves DNS, eliminating page transition delays.

#### Evolution: Auth Tab (Chrome 137+ / AndroidX Browser 1.9.0+)
Google introduced **Auth Tab** specifically for OAuth and passkey workflows:
- Strips general-purpose browser chrome (share menus, bookmark buttons, "Open in Chrome" menus) that distract users during authentication.
- Automatically falls back to standard Custom Tabs or the system browser on devices running earlier Chrome versions or alternative browsers.
- Returns authentication redirect results cleanly via `ActivityResultCallback` when supported, or falls back to `AndroidManifest.xml` intent filters.

### 2.3 Android WebView (`android.webkit.WebView`)
`WebView` embeds a Chromium-derived rendering engine directly into the application's view hierarchy.

#### Severe Constraints for LinkedIn Integration
1. **Isolated Cookie Jar:** `WebView` maintains an isolated cookie storage via `android.webkit.CookieManager`. It cannot access the user's active session in Chrome or other mobile browsers, requiring users to log in manually every time.
2. **Provider Rejection & Detection:** Modern identity providers (including Google, Microsoft, and LinkedIn) inspect client HTTP headers, user-agent tokens (`Version/4.0 Chrome/... Mobile`), JavaScript properties, and bot telemetry. LinkedIn frequently serves anti-bot verification challenges (e.g., Arkose Labs CAPTCHA) or outright blocks embedded WebViews with `disallowed_useragent` errors.
3. **Credential Security Risk:** Utilizing `WebView` to intercept login pages or capture session cookies violates Google Play Developer Policies regarding sensitive data handling and user deception.

### 2.4 Comparison Matrix

| Architectural Dimension | Android Custom Tabs / Auth Tab | Android Embedded WebView |
| :--- | :--- | :--- |
| **RFC 8252 Compliance** | Fully Compliant (Recommended BCP) | Non-Compliant (Explicitly Forbidden) |
| **Process Execution** | Separate Browser Process (Sandboxed) | Host Application Process |
| **DOM / Cookie Isolation** | Complete (App cannot read/inject) | None (Host app controls DOM & Cookies) |
| **Single Sign-On (SSO)** | Full (Shares Chrome session cookies/passkeys) | Zero (Isolated `CookieManager`; forces re-login) |
| **Provider Compatibility** | Supported by LinkedIn, Google, Apple, Microsoft | Frequently blocked (`403 disallowed_useragent` / CAPTCHA) |
| **UX & Theming** | Branded toolbar, animated transitions | Fully customizable, but high friction on auth |
| **Passkey / FIDO2 Support**| Native browser-level passkey support | Fragmented / requires complex WebAuthn bridge |

---

## 3. Static Architectural Inspection of `linkedin-scraper.js`

A static review of the sibling project (`../linkedin-scraper.js`) was conducted without reading live session credentials or executing authenticated calls.

### 3.1 Architectural Decomposition
The sibling project is organized into an orchestration layer, low-level HTTP clients, session lifecycle handlers, and fixture-backed tests:
- `scraper.js`: CLI entry point managing argument parsing, mode switching (search vs. session test), pagination loops, result deduplication, and file storage.
- `module/session-extractor.js`: Browser automation layer using **Playwright** (`playwright`) to automate desktop login flows. It captures authenticated cookies (`li_at`, `JSESSIONID`) and CSRF tokens (`ajax:...`), persisting them into a local `.env` file.
- `module/linkedin-search.js`: Direct HTTP consumer. Instead of official APIs, it issues HTTP requests to LinkedIn's internal **Voyager Web API**:
  - Entity search: `https://www.linkedin.com/voyager/api/graphql` or `/search/dash/clusters`
  - Geo resolution: `voyagerSearchDashReusableTypeahead` GraphQL query
  - Anti-bot header emulation: Constructs desktop browser headers including `x-li-page-instance`, `x-li-track` (spoofing screen resolution, timezone offsets, client version `1.13.43510`, `deviceFormFactor: DESKTOP`), `x-restli-protocol-version: 2.0.0`, and browser `User-Agent`.
- `module/paths.js`: Centralized file path resolution for `.env`, `output/results/`, and `output/session/`.
- `tests/`: Automated unit and fixture-based tests (`mock-search-response.json`, `mock-geo-response.json`) enabling deterministic verification without network calls.

### 3.2 Non-Portability & Impediments to Android On-Device Execution
Attempting to replicate or port this architecture to an on-device Android application encounters critical structural barriers:
1. **Runtime Dependency Mismatch:** Playwright requires a full desktop browser engine binary (Chromium, Firefox, or WebKit) and Node.js. Android has no native Node.js runtime, and embedding full headless Chromium binaries into an APK creates prohibitive binary bloat (>150MB) and violates Android app sandboxing models.
2. **Session Hijacking & Token Replay Fragility:** The scraper relies on capturing raw session cookies (`li_at`) and replaying them in separate HTTP fetch calls. Modern mobile defense mechanisms (TLS JA3/JA4 fingerprinting, HTTP/2 frame inspection, device attestation via Google Play Integrity API) instantly flag requests where a mobile IP executes Voyager desktop web queries.
3. **Anti-Bot Telemetry:** In `linkedin-search.js`, `makeTrackPayload()` explicitly claims `deviceFormFactor: DESKTOP` with desktop viewport dimensions (1920x1080). Executing this from an Android device will trigger security alarms due to discrepancies between the network stack, user-agent, screen metrics, and IP routing.
4. **Legal & Security Liability:** Replaying private authentication cookies bypasses user consent, contradicts RFC 8252, and constitutes a direct breach of LinkedIn's Terms of Service and Google Play App Defense standards.

---

## 4. Chrome DevTools MCP & Android WebView Capabilities

The Model Context Protocol (MCP) server for Chrome DevTools (`chrome-devtools-mcp`), developed by the Chrome team, allows LLMs and coding agents to interact with live browser instances.

### 4.1 MCP Connection Architecture
`chrome-devtools-mcp` connects to Chromium targets using the Chrome DevTools Protocol (CDP). It supports three operational connection modes:
1. **Managed Desktop Subprocess (Default):** Spawns a dedicated Google Chrome or Chrome for Testing instance via Puppeteer.
2. **Auto-Connect (`--autoConnect`, Chrome 144+):** Connects to a running desktop Chrome instance where the user has enabled remote debugging via `chrome://inspect/#remote-debugging`.
3. **Manual Port / URL Connection (`--browserUrl` or `--wsEndpoint`):**
   - `--browserUrl=http://127.0.0.1:9222`: Attaches to an existing Chromium process exposing CDP via HTTP discovery (`/json`, `/json/version`).
   - `--wsEndpoint=ws://127.0.0.1:9222/devtools/browser/<id>`: Attaches directly to a CDP WebSocket server.

### 4.2 Inspecting a Controlled Android WebView
Can `chrome-devtools-mcp` inspect a controlled Android `WebView`? **Yes, conditionally, via ADB port forwarding during development.**

#### Technical Connection Chain
To enable inspection of an Android WebView by Chrome DevTools MCP:
1. **Target App Configuration:** The Android application code must explicitly enable WebView debugging:
   ```kotlin
   // Kotlin: Enable only in debug builds
   if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
       WebView.setWebContentsDebuggingEnabled(true)
   }
   ```
2. **Device Connection:** The Android device (or emulator) is connected via USB or Wi-Fi with **USB Debugging** enabled under Developer Options.
3. **Socket Forwarding via ADB:**
   Android runs the debug-enabled WebView CDP server over an abstract Linux Unix domain socket named `@webview_devtools_remote_<PID>`. Using Android Debug Bridge (ADB), this domain socket is forwarded to a local TCP port on the developer's workstation:
   ```bash
   # Identify the app PID and forward the socket
   PID=$(adb shell pidof com.example.leadgen)
   adb forward tcp:9222 localabstract:webview_devtools_remote_$PID
   ```
4. **Verifying CDP Availability:**
   Querying the forwarded port confirms the WebView is speaking CDP:
   ```bash
   curl -s http://127.0.0.1:9222/json/version
   ```
5. **Configuring Chrome DevTools MCP:**
   The MCP configuration is pointed to the forwarded port:
   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "npx",
         "args": [
           "-y",
           "chrome-devtools-mcp@latest",
           "--browserUrl=http://127.0.0.1:9222"
         ]
       }
     }
   }
   ```
Through this pipeline, `chrome-devtools-mcp` can read DOM trees, capture network payloads, evaluate JavaScript, and inspect console logs within the Android app's WebView.

---

### 4.3 Distinguishing Debugging Instrumentation from Runtime Architecture

A critical conceptual error in mobile system design is conflating **development debugging hooks** with **application runtime architecture**.

```text
+---------------------------------------------------------------------------------------+
|                               DEVELOPMENT / DEBUGGING HARNESS                         |
|                                                                                       |
|   +-----------------------+      USB/ADB        +---------------------------------+   |
|   | Host Workstation      |   Port Forward      | Android Device (Debug Build)    |   |
|   |  - LLM / Agent        |<===================>|  - android:debuggable="true"    |   |
|   |  - Chrome DevTools MCP|   tcp:9222 <-> unix |  - setWebContentsDebugging(true)|   |
|   |  - Puppeteer Client   |                     |  - Exposed Unix Domain Socket   |   |
|   +-----------------------+                     +---------------------------------+   |
+---------------------------------------------------------------------------------------+

                                          VS

+---------------------------------------------------------------------------------------+
|                               PRODUCTION RUNTIME ARCHITECTURE                         |
|                                                                                       |
|   +-------------------------------------------------------------------------------+   |
|   | Untethered Android Device (Production Release Build)                          |   |
|   |                                                                               |   |
|   |   +--------------------------------+       +------------------------------+   |   |
|   |   | Native App Core (Kotlin/Java)  |       | System Browser Sandbox       |   |   |
|   |   |  - AppAuth / androidx.browser  |<=====>|  - Android Custom Tabs       |   |   |
|   |   |  - Scoped Access Tokens        |  OIDC |  - Isolated Cookie Jar       |   |   |
|   |   |  - No CDP / No Debugging Port  |  PKCE |  - No Host Inspection        |   |   |
|   |   +--------------------------------+       +------------------------------+   |   |
|   +-------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------+
```

#### Detailed Breakdown: Debugging vs. Runtime

| Characteristic | Debugging Instrumentation (DevTools MCP) | Production Runtime Execution |
| :--- | :--- | :--- |
| **Primary Purpose** | Diagnostic evaluation, accessibility audits, performance tracing, test automation during development. | User authentication, reliable transactional operations, background sync on mobile devices. |
| **Execution Environment** | Tethered environment requiring a workstation running Node.js, ADB, and the MCP client. | Autonomous, untethered mobile device running an Android APK via Android OS / ART runtime. |
| **Security State** | Requires `setWebContentsDebuggingEnabled(true)` and active USB/ADB transport. | `setWebContentsDebuggingEnabled(false)` is mandatory. No open debugging sockets permitted. |
| **Protocol** | Chrome DevTools Protocol (CDP) over WebSockets / HTTP JSON endpoints. | Standard HTTPS REST/JSON, OpenID Connect JWT tokens, Android Intents. |
| **Device Sandboxing** | Bypasses DOM sandboxing to inspect internal memory, evaluate scripts, and dump network buffers. | Sandboxed by Android SELinux policies and OS-enforced process boundaries. |
| **Store & Compliance** | Prohibited in Google Play release builds; flagged by security scanners (OWASP MSTG-CODE-2). | Compliant with Google Play Store Policies and platform safety guidelines. |

#### Why CDP/MCP Cannot Function as an On-Device Runtime
1. **Physical Tethering & Infrastructure:** `chrome-devtools-mcp` is a Node.js process requiring an external ADB bridge to map the Android Unix socket. It cannot be bundled into an Android client to drive autonomous scraping or background extraction on end-user phones.
2. **Severe Production Vulnerability:** Leaving `WebView.setWebContentsDebuggingEnabled(true)` enabled in production exposes the entire application to local privilege escalation. Any local application with debugging permissions or physical cable access can connect to `@webview_devtools_remote_<PID>`, inject arbitrary JavaScript, extract session cookies, and hijack the user account.
3. **Android Platform Protections:** In release APKs (`android:debuggable="false"`), Android prevents unauthorized access to application private sockets. Without an external ADB developer authorization prompt, external processes cannot read or forward WebView remote sockets.

---

## 5. Architectural Recommendations for Android Integration

Based on the synthesis of primary documentation, security standards, and platform capabilities, the following architectures represent compliant, robust paths:

### 5.1 Consumer & Identity Integration (Recommended)
- **Authentication:** Implement **AppAuth-Android** or native `androidx.browser:browser` utilizing **Auth Tab / Custom Tabs**.
- **Protocol:** OpenID Connect (OIDC) Authorization Code Flow with PKCE (`code_challenge_method=S256`), requesting `openid`, `profile`, and `email`.
- **Redirect Mechanism:** Claimed **Android App Links** (with verified `assetlinks.json` on the app's domain) to prevent authorization code hijacking by third-party apps on the device.
- **Token Management:** Store received OAuth access tokens and OIDC ID tokens within Android's hardware-backed **EncryptedSharedPreferences** or Android KeyStore.

### 5.2 Enterprise B2B Data & Company Insights
- For applications requiring company directories, analytics, or enterprise lead management, integration must occur through **official LinkedIn Partner Programs**:
  - Apply for access to the **Community Management API** or **Marketing Developer Platform**.
  - Route data requests through a secure enterprise backend that manages OAuth 2.0 3-legged or 2-legged tokens.
  - Never attempt on-device session cookie extraction or private Voyager endpoint emulation on mobile hardware.

---

## 6. Citations & Primary Sources

1. **Internet Engineering Task Force (IETF):**
   - RFC 8252: *OAuth 2.0 for Native Apps* (BCP 212), W. Denniss & J. Bradley, October 2017. URL: [https://www.rfc-editor.org/info/rfc8252](https://www.rfc-editor.org/info/rfc8252)
   - RFC 7636: *Proof Key for Code Exchange by OAuth Public Clients (PKCE)*, N. Sakimura, J. Bradley, N. Agarwal, September 2015. URL: [https://www.rfc-editor.org/info/rfc7636](https://www.rfc-editor.org/info/rfc7636)
2. **LinkedIn Developer Platform Documentation (Microsoft Learn):**
   - *Sign In with LinkedIn using OpenID Connect (v2)*, Microsoft Learn. URL: [https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
   - *Getting Access to LinkedIn APIs & Partner Programs*, Microsoft Learn. URL: [https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
   - *LinkedIn OpenID Connect Discovery Document*, LinkedIn Corporation. URL: [https://www.linkedin.com/oauth/.well-known/openid-configuration](https://www.linkedin.com/oauth/.well-known/openid-configuration)
   - *LinkedIn User Agreement (Section 8: Dos and Don'ts)*, LinkedIn Corporation. URL: [https://www.linkedin.com/legal/user-agreement](https://www.linkedin.com/legal/user-agreement)
3. **Android Developer Documentation (Google Developers):**
   - *Debug using Chrome DevTools (Remote debugging WebViews)*, Android Developers Guide. URL: [https://developer.android.com/develop/ui/views/layout/webapps/debug-chrome-devtools](https://developer.android.com/develop/ui/views/layout/webapps/debug-chrome-devtools)
   - *Choose the right passkey implementation / Auth Tab architecture*, Android Developers Guide. URL: [https://developer.android.com/identity/passkeys/architecture](https://developer.android.com/identity/passkeys/architecture)
   - *AndroidX Browser Library Documentation (`androidx.browser.customtabs`)*, Android Jetpack. URL: [https://developer.android.com/reference/androidx/browser/customtabs/package-summary](https://developer.android.com/reference/androidx/browser/customtabs/package-summary)
4. **Chrome DevTools & Model Context Protocol Documentation:**
   - *Chrome DevTools for agents (`chrome-devtools-mcp`)*, Chrome DevTools Team, Google. URL: [https://developer.chrome.com/docs/devtools/agents](https://developer.chrome.com/docs/devtools/agents)
   - *Chrome DevTools MCP GitHub Repository & Configuration Specifications*, GitHub. URL: [https://github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp)
   - *Remote debugging Android devices and WebViews*, Chrome Developer Documentation. URL: [https://developer.chrome.com/docs/devtools/remote-debugging/webviews](https://developer.chrome.com/docs/devtools/remote-debugging/webviews)
