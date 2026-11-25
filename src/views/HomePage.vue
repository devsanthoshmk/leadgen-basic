<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>
          <div class="header-brand">
            <span class="brand-logo">M</span>
            <span class="brand-name">Mergex <span class="brand-accent">LeadGen</span></span>
          </div>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="view === 'results'" @click="goBack()" fill="clear">
            <ion-icon :icon="arrowBackOutline" slot="icon-only"></ion-icon>
          </ion-button>
          <ion-button @click="infoOpen = true" fill="clear">
            <ion-icon :icon="informationCircleOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Results toolbar -->
      <ion-toolbar v-if="view === 'results'" class="results-toolbar">
        <ion-chip class="results-chip">
          <ion-icon v-if="resultSource === 'cache'" :icon="timeOutline" style="margin-right:4px"></ion-icon>
          <ion-label>{{ row_datas.length }} leads found{{ resultSource === 'cache' ? ' (Cached)' : '' }}{{ resumeState ? ' (paused)' : '' }}</ion-label>
        </ion-chip>
        <ion-buttons slot="end">
          <ion-button v-if="!downloadedUri" @click="downloadExcel" fill="solid" size="small" class="action-btn">
            <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
            Export
          </ion-button>
          <ion-button v-else @click="openDownloadedFile" fill="solid" size="small" class="action-btn">
            <ion-icon :icon="openOutline" slot="start"></ion-icon>
            Open
          </ion-button>
          <ion-button v-if="showShare" @click="shareFile" fill="solid" size="small" class="share-btn">
            <ion-icon :icon="shareSocialOutline" slot="start"></ion-icon>
            Share
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">

      <!-- SEARCH VIEW -->
      <div v-if="view === 'search'" class="content-center">
        <div class="search-hero">
          <div class="hero-badge">SALES INTELLIGENCE</div>
          <h1 class="hero-title">Find Your Next<br/><span class="accent">Qualified Lead</span></h1>
          <p class="hero-sub">Search businesses by type and location. Export available phone numbers, addresses, and websites.</p>
        </div>

        <div class="search-container" :class="{ shake: shaking }">
          <ion-searchbar
            v-model="input"
            placeholder="e.g. Software in Chennai"
            :debounce="0"
            @keyup.enter="doSearch"
            show-clear-button="focus"
            class="leadgen-search"
          ></ion-searchbar>

          <!-- Search Mode Selector -->
          <div class="mode-selector">
            <div class="mode-label">
              <span class="mode-label-text">Search Mode</span>
              <button class="mode-info-trigger" @click.stop="modeInfoOpen = true" aria-label="Learn about search modes">
                <ion-icon :icon="helpCircleOutline"></ion-icon>
              </button>
            </div>
            <div class="mode-options">
              <button
                v-for="m in modes"
                :key="m.id"
                :disabled="searching"
                class="mode-option"
                :class="{ active: searchMode === m.id }"
                @click="selectMode(m.id)"
              >
                <div class="mode-option-icon">
                  <ion-icon :icon="m.icon"></ion-icon>
                </div>
                <div class="mode-option-body">
                  <span class="mode-option-name">{{ m.name }}</span>
                  <span class="mode-option-desc">{{ m.id === 'fast' ? 'Google Maps only' : ({ combined: m.id === 'long' ? 'Both sources, more detail' : 'Google Maps + LinkedIn', linkedin: m.id === 'long' ? 'Up to 5 LinkedIn pages' : 'Up to 3 LinkedIn pages', maps: m.shortDesc })[searchProvider] }}</span>
                </div>
                <div v-if="searchMode === m.id" class="mode-check">
                  <ion-icon :icon="checkmarkCircle"></ion-icon>
                </div>
              </button>
            </div>
            <!-- Long mode warning -->
            <transition name="fade">
              <div v-if="searchMode === 'long' && searchProvider === 'maps'" class="mode-warning">
                <ion-icon :icon="timeOutline"></ion-icon>
                <span>Deep checks individual places that are missing a phone number. Best for small, targeted searches.</span>
              </div>
            </transition>
          </div>

          <!-- Action buttons: Generate / Loading+Pause -->
          <div class="action-buttons">
            <ion-button v-if="!searching" @click="doSearch" expand="block" class="search-btn">
              Generate Leads
            </ion-button>
            <template v-else>
              <!-- Progress indicator with spinner -->
              <ion-button expand="block" class="search-btn" disabled>
                <ion-spinner name="crescent" slot="start"></ion-spinner>
                {{ progressText || 'Finding leads...' }}
              </ion-button>
              <!-- Separate pause button below the progress -->
              <ion-button v-if="effectiveProvider === 'maps'" expand="block" class="pause-btn" @click="pauseSearch">
                <ion-icon :icon="pauseOutline" slot="start"></ion-icon>
                Pause Search
              </ion-button>
            </template>
          </div>
        </div>

  
        <div v-if="effectiveProvider === 'maps'" class="search-tags">
          <span class="tags-label">Try searching</span>
          <div class="tags-row">
            <span class="tag" @click="input = 'Restaurants in Bangalore'; doSearch()">Restaurants in Bangalore</span>
            <span class="tag" @click="input = 'Cafes in Mumbai'; doSearch()">Cafes in Mumbai</span>
            <span class="tag" @click="input = 'Gyms in Hyderabad'; doSearch()">Gyms in Hyderabad</span>
          </div>
        </div>
      </div>

      <!-- RESULTS VIEW -->
      <div v-if="view === 'results'" class="results-view">

        <!-- Sort & Filter bar -->
        <div class="filter-bar">
          <ion-searchbar
            v-model="filterText"
            placeholder="Filter leads..."
            :debounce="250"
            show-clear-button="focus"
            class="filter-search"
          ></ion-searchbar>
          <ion-select v-model="sortBy" interface="popover" placeholder="Sort by" class="sort-select">
            <ion-select-option value="title">Name</ion-select-option>
            <ion-select-option value="stars">Stars</ion-select-option>
            <ion-select-option value="reviews">Reviews</ion-select-option>
            <ion-select-option value="category">Category</ion-select-option>
          </ion-select>
          <ion-button fill="clear" size="small" @click="toggleSortDir">
            <ion-icon :icon="sortAsc ? arrowUpOutline : arrowDownOutline"></ion-icon>
          </ion-button>
          <div class="source-filters" role="group" aria-label="Filter by source">
            <button v-for="option in sourceOptions" :key="option.value" type="button"
              :aria-pressed="sourceFilter === option.value" @click="sourceFilter = option.value">
              {{ option.label }}
            </button>
          </div>
        </div>

        <!-- Data cards -->
        <div class="cards-container">
          <ion-card v-for="(row, i) in filteredData" :key="i" class="data-card" @click="openDetail(row)">
            <ion-card-header class="lead-card-header">
              <ion-card-title class="card-title">{{ row.title }}</ion-card-title>
              <ion-card-subtitle v-if="row.category">{{ row.category }}</ion-card-subtitle>
              <span class="source-mark" :title="leadSourceLabel(row)" role="img" :aria-label="leadSourceLabel(row)">
                <ion-icon v-if="row.source !== 'linkedin'" :icon="locationOutline" aria-hidden="true" />
                <ion-icon v-if="row.source === 'linkedin' || row.source === 'combined'" :icon="logoLinkedin" aria-hidden="true" />
              </span>
            </ion-card-header>
            <ion-card-content>
              <div class="card-meta">
                <span v-if="row.stars" class="stars">
                  <ion-icon :icon="starIcon" color="warning"></ion-icon>
                  {{ row.stars }}
                </span>
                <span v-if="row.reviews" class="reviews">
                  ({{ row.reviews }} reviews)
                </span>
                <span v-if="row.followers">{{ row.followers }}</span>
                <span v-if="row.badge">{{ row.badge }}</span>
              </div>
              <p v-if="row.address" class="card-address">{{ row.address }}</p>
              <div class="card-actions">
                <ion-chip v-if="row.linkedinUrl" outline @click.stop="openUrl(row.linkedinUrl)">LinkedIn profile</ion-chip>
                <ion-chip v-if="row.completePhoneNumber" outline @click.stop="callPhone(row.completePhoneNumber)" class="lead-chip phone-chip">
                  <ion-icon :icon="callOutline"></ion-icon>
                  <ion-label>{{ row.completePhoneNumber }}</ion-label>
                </ion-chip>
                <ion-chip v-if="row.url" outline @click.stop="openUrl(row.url)" class="lead-chip web-chip">
                  <ion-icon :icon="globeOutline"></ion-icon>
                  <ion-label>Website</ion-label>
                </ion-chip>
              </div>
            </ion-card-content>
          </ion-card>

          <div v-if="filteredData.length === 0" class="no-results">
            <p>No leads match your filter.</p>
          </div>
        </div>
      </div>

      <!-- DETAIL MODAL -->
      <ion-modal :is-open="detailOpen" @didDismiss="detailOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Lead Details</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="detailOpen = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding" v-if="detailRow">
          <h2>{{ detailRow.title }}</h2>
          <ion-chip outline>{{ leadSourceLabel(detailRow) }}</ion-chip>
          <p v-if="detailRow.description">{{ detailRow.description }}</p>
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Category</h3>
                <p>{{ detailRow.category || 'N/A' }}</p>
              </ion-label>
            </ion-item>
            <ion-item v-if="detailRow.source !== 'linkedin'">
              <ion-label>
                <h3>Rating</h3>
                <p>
                  <span v-for="n in 5" :key="n">
                    <ion-icon :icon="n <= Math.round(detailRow.stars) ? starIcon : starOutlineIcon" color="warning"></ion-icon>
                  </span>
                  {{ detailRow.stars }} ({{ detailRow.reviews }} reviews)
                </p>
              </ion-label>
            </ion-item>
            <ion-item v-if="detailRow.completePhoneNumber">
              <ion-label>
                <h3>Phone</h3>
                <p>{{ detailRow.completePhoneNumber }}</p>
              </ion-label>
              <ion-button slot="end" fill="clear" @click="callPhone(detailRow.completePhoneNumber)">
                <ion-icon :icon="callOutline"></ion-icon>
              </ion-button>
            </ion-item>
            <ion-item v-if="detailRow.address">
              <ion-label class="ion-text-wrap">
                <h3>Address</h3>
                <p>{{ detailRow.address }}</p>
              </ion-label>
              <ion-button slot="end" fill="clear" @click="openMap(detailRow)">
                <ion-icon :icon="navigateOutline"></ion-icon>
              </ion-button>
            </ion-item>
            <ion-item v-if="detailRow.url">
              <ion-label>
                <h3>Website</h3>
                <p class="link-text">{{ detailRow.url }}</p>
              </ion-label>
              <ion-button slot="end" fill="clear" @click="openUrl(detailRow.url)">
                <ion-icon :icon="openOutline"></ion-icon>
              </ion-button>
            </ion-item>
          </ion-list>
        </ion-content>
      </ion-modal>

      <!-- MODE INFO MODAL -->
      <ion-modal :is-open="modeInfoOpen" @didDismiss="modeInfoOpen = false" :breakpoints="[0, 0.65, 1]" :initialBreakpoint="0.65" class="mode-info-modal">
        <ion-header>
          <ion-toolbar>
            <ion-title>Search Modes</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="modeInfoOpen = false">Done</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding mode-info-content">
          <p class="mode-info-intro">Fast searches Google Maps only. Auto and Deep default to Combined; you can also choose Google Maps or LinkedIn on its own.</p>

          <div v-for="m in modes" :key="m.id" class="mode-info-card" :class="{ recommended: m.id === 'normal' }">
            <div class="mode-info-card-header">
              <div class="mode-info-card-icon" :class="'mode-icon-' + m.id">
                <ion-icon :icon="m.icon"></ion-icon>
              </div>
              <div>
                <h3>{{ m.name }}</h3>
                <span v-if="m.id === 'normal'" class="mode-recommended-badge">Recommended</span>
              </div>
            </div>
            <p class="mode-info-card-desc">{{ m.longDesc }}</p>
            <p v-if="m.id !== 'fast'" class="mode-info-card-desc">{{ m.id === 'long' ? 'Combined also searches up to five LinkedIn pages.' : 'Combined also searches up to three LinkedIn pages.' }}</p>
            <div class="mode-info-stats">
              <div class="mode-stat">
                <span class="mode-stat-label">Speed</span>
                <div class="mode-stat-bar">
                  <div class="mode-stat-fill" :style="{ width: m.speed + '%' }"></div>
                </div>
              </div>
              <div class="mode-stat">
                <span class="mode-stat-label">Data</span>
                <div class="mode-stat-bar">
                  <div class="mode-stat-fill" :style="{ width: m.data + '%' }"></div>
                </div>
              </div>
            </div>
            <div class="mode-info-details">
              <span class="mode-detail-item" v-for="(detail, j) in m.details" :key="j">
                <ion-icon :icon="detail.yes ? checkmarkCircle : closeCircle" :class="detail.yes ? 'detail-yes' : 'detail-no'"></ion-icon>
                {{ detail.text }}
              </span>
            </div>
          </div>

          <div class="mode-info-tip">
            <ion-icon :icon="bulbOutline"></ion-icon>
            <p><strong>Combined:</strong> A unique company name match gets both source icons. Unmatched listings stay separate. If one source fails, results from the other are still shown. LinkedIn requires the USB bridge in this build.</p>
          </div>
        </ion-content>
      </ion-modal>

      <!-- HISTORY VIEW -->
      <div v-if="view === 'history'" class="history-view">
        <div class="view-header">
          <div class="view-header-row">
            <h2>History</h2>
            <button class="header-info-btn" @click="showHistoryInfo" aria-label="About history">
              <ion-icon :icon="helpCircleOutline"></ion-icon>
            </button>
          </div>
          <ion-searchbar v-model="historyFilter" placeholder="Filter history..." :debounce="200" class="filter-search" show-clear-button="focus"></ion-searchbar>
        </div>

        <ion-refresher slot="fixed" @ionRefresh="refreshHistory($event)">
          <ion-refresher-content></ion-refresher-content>
        </ion-refresher>

        <div v-if="filteredHistory.length === 0" class="empty-state">
          <ion-icon :icon="timeOutline" class="empty-icon"></ion-icon>
          <h3>No search history</h3>
          <p>Your past searches will appear here.</p>
        </div>

        <div v-else class="history-list">
          <div v-for="item in filteredHistory" :key="item.id || item.timestamp"
            class="history-item" :class="{ 'history-item--paused': item.status === 'paused' }"
            @click="item.status === 'paused' ? viewPausedResults(item) : loadHistoryItem(item)">
            <div class="history-item-left">
              <div class="history-item-status-dot" :class="item.status === 'paused' ? 'dot-amber' : 'dot-green'"></div>
            </div>
            <div class="history-item-body">
              <div class="history-item-query">{{ item.query }}</div>
              <div class="history-item-meta">
                <span class="history-tag" :class="'history-tag--' + (item.mode || 'normal')">{{ item.mode === 'normal' || !item.mode ? 'auto' : item.mode }}</span>
                <span v-if="item.status === 'paused'" class="history-tag history-tag--partial">partial</span>
                <span class="history-meta-sep">&middot;</span>
                <span>{{ item.result_count || item.resultCount || 0 }} leads</span>
                <span class="history-meta-sep">&middot;</span>
                <span>{{ timeAgo(item.created_at || item.timestamp) }}</span>
              </div>
            </div>
            <div class="history-item-actions">
              <button v-if="item.status === 'paused'" class="history-action-btn history-action-btn--resume" @click.stop="resumeFromHistory(item)" aria-label="Resume search">
                <ion-icon :icon="playCircleOutline"></ion-icon>
              </button>
              <button class="history-action-btn history-action-btn--delete" @click.stop="deleteHistoryItem(item)" aria-label="Delete">
                <ion-icon :icon="trashOutline"></ion-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- SETTINGS VIEW -->
      <div v-if="view === 'settings'" class="settings-view">
        <div class="view-header">
          <h2>Settings</h2>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">LinkedIn Account</h3>

          <!-- Connected state -->
          <div v-if="linkedInConnected" class="settings-item">
            <div class="settings-item-info">
              <span class="settings-item-label">✅ Connected</span>
              <span class="settings-item-desc">Session saved on this device. LinkedIn and Combined search are active.</span>
            </div>
            <ion-button size="small" fill="outline" color="danger" @click="doLinkedInLogout">Sign out</ion-button>
          </div>

          <!-- Auto sign-in form -->
          <div v-if="!linkedInConnected" class="li-signin-form">
            <!-- Notification access tip — hidden when already granted -->
            <div v-if="!notifAccessGranted" class="li-notif-tip">
              <span class="li-notif-icon">🔔</span>
              <div>
                <strong>Enable notification access</strong> so LeadGen can read the LinkedIn verification code from your email notification automatically.
                <br><ion-button size="small" fill="outline" style="margin-top:6px" @click="openNotifSettings">Open Notification Settings</ion-button>
              </div>
            </div>
            <p class="li-signin-notice">
              🔒 Your email and password are used <strong>only to log in</strong> inside a private in-app browser.
              They are <strong>never stored or sent</strong> anywhere — only the resulting session token is saved,
              encrypted with Android's hardware security chip (Keystore AES-256-GCM) and readable only by this app on this device.
            </p>
            <div class="li-field">
              <label class="li-label">LinkedIn Email</label>
              <input class="li-input" type="email" autocomplete="email" inputmode="email"
                     v-model="liEmail" placeholder="you@example.com" :disabled="liSigning" />
            </div>
            <div class="li-field">
              <label class="li-label">Password</label>
              <div class="li-pw-row">
                <input class="li-input" :type="liShowPw ? 'text' : 'password'" autocomplete="current-password"
                       v-model="liPassword" placeholder="••••••••" :disabled="liSigning" />
                <button class="li-pw-toggle" @click="liShowPw = !liShowPw" :aria-label="liShowPw ? 'Hide' : 'Show'">
                  {{ liShowPw ? '🙈' : '👁' }}
                </button>
              </div>
            </div>
            <div class="li-actions">
              <ion-button expand="block" :disabled="liSigning || !liEmail || !liPassword" @click="doAutoLogin">
                <span v-if="!liSigning">Sign in automatically</span>
                <span v-else>{{ liSigningStatus }}</span>
              </ion-button>
              <ion-button expand="block" fill="outline" :disabled="liSigning" @click="doLinkedInLogin">
                Sign in manually (browser)
              </ion-button>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Data</h3>
          <div class="settings-item" @click="clearLocalCache">
            <div class="settings-item-info">
              <span class="settings-item-label">Clear Local Cache</span>
              <span class="settings-item-desc">{{ cacheCount }} cached searches</span>
            </div>
            <ion-icon :icon="trashOutline" color="danger"></ion-icon>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">Notifications</h3>
          <div class="settings-item">
            <div class="settings-item-info">
              <span class="settings-item-label">Push Notifications</span>
              <span class="settings-item-desc">{{ notificationsGranted ? 'Enabled' : 'Disabled' }}</span>
            </div>
            <ion-button v-if="!notificationsGranted" size="small" fill="outline" @click="requestNotificationPermission">Enable</ion-button>
            <ion-icon v-else :icon="checkmarkCircle" color="success"></ion-icon>
          </div>
        </div>

        <div class="settings-section">
          <h3 class="settings-section-title">About</h3>
          <div class="settings-item">
            <div class="settings-item-info">
              <span class="settings-item-label">Mergex LeadGen</span>
              <span class="settings-item-desc">v2.0.0</span>
            </div>
          </div>
        </div>
      </div>

      <!-- INFO MODAL -->
      <ion-modal :is-open="infoOpen" @didDismiss="infoOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>About Mergex</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="infoOpen = false">Close</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding info-content">
          <div class="info-hero">
            <span class="info-logo">M</span>
            <h2>Mergex</h2>
            <p class="info-tagline">One System. Zero Friction.</p>
          </div>

          <div class="info-section">
            <h3>About</h3>
            <p>Mergex engineers the systems behind modern businesses — unifying strategy, software, AI, and growth into one scalable foundation. We replace fragmented tools with a single integrated platform.</p>
          </div>

          <div class="info-section">
            <h3>Our Divisions</h3>
            <div class="info-card">
              <strong>Mergex Systems</strong>
              <p>Business infrastructure, software platforms, workflow automation, and AI integrations.</p>
            </div>
            <div class="info-card">
              <strong>Mergex Labs</strong>
              <p>High-end production — AI-powered creative work, advertisements, visual assets, and video content.</p>
            </div>
          </div>

          <div class="info-section">
            <h3>Contact</h3>
            <ion-list class="info-links">
              <ion-item button @click="openUrl('https://mergex.in')">
                <ion-icon :icon="globeOutline" slot="start"></ion-icon>
                <ion-label>mergex.in</ion-label>
              </ion-item>
              <ion-item button @click="openUrl('mailto:hello@mergex.in')">
                <ion-icon :icon="mailOutline" slot="start"></ion-icon>
                <ion-label>hello@mergex.in</ion-label>
              </ion-item>
              <ion-item button @click="openUrl('https://wa.me/919042172025')">
                <ion-icon :icon="callOutline" slot="start"></ion-icon>
                <ion-label>+91 9042172025</ion-label>
              </ion-item>
            </ion-list>
          </div>

          <div class="info-section">
            <h3>Follow Us</h3>
            <div class="info-socials">
              <a href="https://www.linkedin.com/company/mergex" target="_blank" rel="noopener noreferrer">
                <ion-icon :icon="logoLinkedin"></ion-icon>
              </a>
              <a href="https://twitter.com/mergex" target="_blank" rel="noopener noreferrer">
                <ion-icon :icon="logoTwitter"></ion-icon>
              </a>
              <a href="https://www.instagram.com/mergex" target="_blank" rel="noopener noreferrer">
                <ion-icon :icon="logoInstagram"></ion-icon>
              </a>
            </div>
          </div>

          <div class="info-section">
            <h3>Built On</h3>
            <div class="info-card">
              <strong>GlobexData — Places Data App</strong>
              <p>This app is built on top of the open-source GlobexData project.</p>
            </div>
            <ion-list class="info-links">
              <ion-item button @click="openUrl('https://github.com/devsanthoshmk/places-data-app')">
                <ion-icon :icon="logoGithub" slot="start"></ion-icon>
                <ion-label>Source — places-data-app</ion-label>
              </ion-item>
            </ion-list>
          </div>

          <div class="info-section">
            <h3>Developer</h3>
            <ion-list class="info-links">
              <ion-item button @click="openUrl('https://github.com/devsanthoshmk')">
                <ion-icon :icon="logoGithub" slot="start"></ion-icon>
                <ion-label>GitHub — devsanthoshmk</ion-label>
              </ion-item>
              <ion-item button @click="openUrl('https://www.linkedin.com/in/santhosh-m-k/')">
                <ion-icon :icon="logoLinkedin" slot="start"></ion-icon>
                <ion-label>LinkedIn — Santhosh M K</ion-label>
              </ion-item>
              <ion-item button @click="openUrl('https://www.instagram.com/mksantho.sh/')">
                <ion-icon :icon="logoInstagram" slot="start"></ion-icon>
                <ion-label>Instagram — @mksantho.sh</ion-label>
              </ion-item>
            </ion-list>
          </div>
        </ion-content>
      </ion-modal>

    </ion-content>

    <ion-footer>
      <div class="bottom-nav">
        <button class="bottom-nav-item" :class="{ active: view === 'search' || view === 'results' }" @click="tabNavigate('search')">
          <ion-icon :icon="searchOutline"></ion-icon>
          <span>Search</span>
        </button>
        <button class="bottom-nav-item" :class="{ active: view === 'history' }" @click="tabNavigate('history')">
          <ion-icon :icon="timeOutline"></ion-icon>
          <span>History</span>
        </button>
        <button class="bottom-nav-item" :class="{ active: view === 'settings' }" @click="tabNavigate('settings')">
          <ion-icon :icon="settingsOutline"></ion-icon>
          <span>Settings</span>
        </button>
      </div>
    </ion-footer>
  </ion-page>
</template>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
  IonSearchbar, IonButton, IonButtons, IonSpinner, IonIcon,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonChip, IonLabel, IonSelect, IonSelectOption,
  IonModal, IonList, IonItem,
  IonRefresher, IonRefresherContent,
  toastController,
  alertController,
} from '@ionic/vue';
import {
  logoGithub, logoLinkedin, logoInstagram, logoTwitter, shareSocialOutline,
  downloadOutline, arrowBackOutline, starSharp, starOutline,
  callOutline, globeOutline, openOutline, navigateOutline, locationOutline,
  arrowUpOutline, arrowDownOutline, informationCircleOutline, mailOutline,
  flashOutline, syncOutline, layersOutline, pauseOutline,
  helpCircleOutline, checkmarkCircle, closeCircle, timeOutline, bulbOutline,
  searchOutline, settingsOutline,
  playCircleOutline, trashOutline, phonePortraitOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { search } from '../services/scraper.js';
import { searchLinkedIn, hasLinkedInSession, linkedInLogin, clearLinkedInSession, hasNotificationAccess, openNotificationSettings } from '../services/linkedin.js';
import { mergeLeadSources } from '../services/combined.js';
import { leadSourceLabel, matchesLeadSource } from '../services/leadSource.js';
import { makeExcel, shareLastFile, SaveToDownloads } from '../services/excel.js';

// ─── Local Cache helpers ────────────────────────────────────────────────────
const CACHE_PREFIX = 'mergex_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h
const CACHE_MAX = 20;

function cacheKey(query, mode) {
  // Simple hash — no need for real md5
  let h = 0;
  const s = (query + '|' + mode).toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return CACHE_PREFIX + Math.abs(h).toString(36);
}

function getCachedSearch(query, mode) {
  try {
    const key = cacheKey(query, mode);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch { return null; }
}

function setCachedSearch(query, mode, results) {
  try {
    const key = cacheKey(query, mode);
    localStorage.setItem(key, JSON.stringify({ results, timestamp: Date.now(), query, mode }));
    // LRU eviction
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(CACHE_PREFIX)) {
        try {
          const e = JSON.parse(localStorage.getItem(k));
          keys.push({ key: k, ts: e.timestamp || 0 });
        } catch { keys.push({ key: k, ts: 0 }); }
      }
    }
    if (keys.length > CACHE_MAX) {
      keys.sort((a, b) => a.ts - b.ts);
      for (let i = 0; i < keys.length - CACHE_MAX; i++) {
        localStorage.removeItem(keys[i].key);
      }
    }
  } catch { /* ignore */ }
}

function getCacheCount() {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).startsWith(CACHE_PREFIX)) count++;
  }
  return count;
}

function clearAllCache() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(CACHE_PREFIX)) toRemove.push(k);
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

let ForegroundService = null;

export default {
  name: 'HomePage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
    IonSearchbar, IonButton, IonButtons, IonSpinner, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonChip, IonLabel, IonSelect, IonSelectOption,
    IonModal, IonList, IonItem,
    IonRefresher, IonRefresherContent,
  },
  data() {
    return {
      input: '',
      view: 'search',
      viewStack: [],  // navigation history for back button
      searching: false,
      shaking: false,
      row_datas: [],
      showShare: false,
      lastFilename: '',
      downloadedUri: null,
      filterText: '',
      sourceFilter: 'all',
      sourceOptions: [
        { value: 'all', label: 'All sources' },
        { value: 'linkedin', label: 'LinkedIn' },
        { value: 'google-maps', label: 'Google Maps' },
      ],
      locationOutline,
      sortBy: 'title',
      sortAsc: true,
      detailOpen: false,
      detailRow: null,
      infoOpen: false,
      modeInfoOpen: false,
      notificationsGranted: false,
      searchCancelled: false,
      resumeState: null,
      progressText: '',
      searchMode: 'normal',
      searchProvider: 'combined',
      linkedInConnected: false,
      notifAccessGranted: true,
      liEmail: '',
      liPassword: '',
      liShowPw: false,
      liSigning: false,
      liSigningStatus: 'Opening LinkedIn…',
      modes: [
        {
          id: 'fast',
          name: 'Fast',
          icon: flashOutline,
          shortDesc: 'Quick scan, basic info',
          longDesc: 'Scrapes search result pages only. Gets you names, addresses, ratings, and websites in seconds. Phone numbers may be incomplete since it skips the detail lookup step.',
          speed: 100,
          data: 40,
          details: [
            { text: 'Business names & addresses', yes: true },
            { text: 'Ratings & reviews', yes: true },
            { text: 'Websites', yes: true },
            { text: 'All phone numbers', yes: false },
            { text: 'Full address details', yes: false },
          ],
        },
        {
          id: 'normal',
          name: 'Auto',
          icon: syncOutline,
          shortDesc: 'Checks details only if no phones are found',
          longDesc: 'Default mode. If the main search finds even one phone number, Auto skips all individual lookups. Otherwise it checks each place with a listing ID for a phone number and website.',
          speed: 65,
          data: 75,
          details: [
            { text: 'Business names & addresses', yes: true },
            { text: 'Ratings & reviews', yes: true },
            { text: 'Websites', yes: true },
            { text: 'Phone lookup if the main search finds none', yes: true },
            { text: 'Full address details', yes: false },
          ],
        },
        {
          id: 'long',
          name: 'Deep',
          icon: layersOutline,
          shortDesc: 'Checks places missing a phone',
          longDesc: 'Checks each place that has a listing ID but no phone number. Also fills missing addresses and websites when available, without replacing values from the main search.',
          speed: 25,
          data: 65,
          details: [
            { text: 'Business names & addresses', yes: true },
            { text: 'Ratings & reviews', yes: true },
            { text: 'Websites', yes: true },
            { text: 'More accurate full addresses', yes: true },
            { text: 'Higher phone number coverage', yes: true },
          ],
        },
      ],
      resultSource: null, // null | 'cache'
      // History
      historyItems: [],
      historyFilter: '',
      // Settings
      cacheCount: getCacheCount(),
      // icons
      logoGithub, logoLinkedin, logoInstagram, logoTwitter, shareSocialOutline,
      downloadOutline, arrowBackOutline,
      starIcon: starSharp, starOutlineIcon: starOutline,
      callOutline, globeOutline, openOutline, navigateOutline,
      arrowUpOutline, arrowDownOutline, informationCircleOutline, mailOutline,
      helpCircleOutline, checkmarkCircle, closeCircle, timeOutline, bulbOutline,
      pauseOutline, searchOutline, settingsOutline,
      playCircleOutline, trashOutline, phonePortraitOutline,
    };
  },
  computed: {
    effectiveProvider() {
      if (this.searchMode === 'fast') return 'maps';
      if (!this.linkedInConnected && this.searchProvider !== 'maps') return 'maps';
      return this.searchProvider;
    },
    filteredHistory() {
      if (!this.historyFilter) return this.historyItems;
      const q = this.historyFilter.toLowerCase();
      return this.historyItems.filter(h => h.query.toLowerCase().includes(q));
    },
    filteredData() {
      let data = this.row_datas.filter(row => matchesLeadSource(row, this.sourceFilter));
      if (this.filterText) {
        const q = this.filterText.toLowerCase();
        data = data.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q) ||
          r.completePhoneNumber.includes(q)
        );
      }
      const key = this.sortBy;
      data.sort((a, b) => {
        const av = a[key] ?? '';
        const bv = b[key] ?? '';
        if (typeof av === 'number' && typeof bv === 'number') {
          return this.sortAsc ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv));
        return this.sortAsc ? cmp : -cmp;
      });
      return data;
    },
  },
  async mounted() {
    if (Capacitor.isNativePlatform()) {
      await this.syncNotificationStatus();
      this.linkedInConnected = await hasLinkedInSession();
      this.notifAccessGranted = await hasNotificationAccess();

      if (!this.notificationsGranted) {
        const lastAsked = localStorage.getItem('notif_prompt_last');
        const now = Date.now();
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
        if (!lastAsked || (now - Number(lastAsked)) > THREE_DAYS) {
          localStorage.setItem('notif_prompt_last', String(now));
          await this.showNotificationPrePrompt();
        }
      }

      try {
        await LocalNotifications.createChannel({
          id: 'search-updates',
          name: 'Lead Search Updates',
          description: 'Notifications when lead search completes',
          importance: 5,
          visibility: 1,
          vibration: true,
        });
      } catch (chErr) {
        console.error('[NOTIF] Channel creation failed:', chErr);
      }

      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        console.log('[NOTIF] Received:', JSON.stringify(notification));
      });

      if (Capacitor.getPlatform() === 'android') {
        try {
          const mod = await import('@capawesome-team/capacitor-android-foreground-service');
          ForegroundService = mod.ForegroundService;
        } catch (e) {
          console.warn('Foreground service not available:', e);
        }
      }

      App.addListener('backButton', async () => {
        const result = this.goBack();
        if (result === 'exit') {
          const alert = await alertController.create({
            header: 'Exit Mergex LeadGen',
            message: 'Are you sure you want to exit?',
            buttons: [
              { text: 'Cancel', role: 'cancel' },
              { text: 'Exit', handler: () => App.exitApp() },
            ],
          });
          await alert.present();
        }
      });
    }
  },
  beforeUnmount() {
    App.removeAllListeners();
  },
  watch: {
    view(next, previous) {
      if (previous === 'results' && next !== 'results') this.sourceFilter = 'all';
    },
  },
  methods: {
    leadSourceLabel,
    selectMode(mode) {
      this.searchMode = mode;
      // fast always uses maps; auto and deep default to combined
      this.searchProvider = mode === 'fast' ? 'maps' : 'combined';
    },
    async syncNotificationStatus() {
      try {
        const perm = await LocalNotifications.checkPermissions();
        this.notificationsGranted = perm.display === 'granted';
      } catch {
        this.notificationsGranted = false;
      }
    },
    async requestNotificationPermission() {
      try {
        const result = await LocalNotifications.requestPermissions();
        this.notificationsGranted = result.display === 'granted';
      } catch {
        this.notificationsGranted = false;
      }
      return this.notificationsGranted;
    },
    async showNotificationPrePrompt() {
      const alert = await alertController.create({
        header: 'Stay Updated',
        message: 'Get notified when your lead search completes and files are downloaded — even if the app is in the background.',
        buttons: [
          { text: 'Not Now', role: 'cancel' },
          {
            text: 'Allow',
            handler: () => {
              this.requestNotificationPermission();
            },
          },
        ],
      });
      await alert.present();
    },
    async showNotificationNudgeToast() {
      const toast = await toastController.create({
        message: 'Enable notifications to know when downloads finish.',
        duration: 5000,
        position: 'bottom',
        color: 'dark',
        buttons: [
          {
            text: 'Allow',
            handler: () => {
              this.requestNotificationPermission();
            },
          },
          { text: 'Dismiss', role: 'cancel' },
        ],
      });
      await toast.present();
    },
    toggleSortDir() {
      this.sortAsc = !this.sortAsc;
    },
    async startForegroundService() {
      if (!ForegroundService) return;
      try {
        await ForegroundService.startForegroundService({
          id: 1001,
          title: 'Mergex LeadGen',
          body: 'Starting lead search...',
          smallIcon: 'ic_stat_icon_config_sample',
          buttons: [{ title: 'Cancel', id: 1 }],
        });
        await ForegroundService.addListener('buttonClicked', (event) => {
          if (event.buttonId === 1) {
            this.searchCancelled = true;
          }
        });
      } catch (e) {
        console.warn('Could not start foreground service:', e);
      }
    },
    async updateForegroundNotification(body) {
      if (!ForegroundService) return;
      try {
        await ForegroundService.updateForegroundService({
          id: 1001,
          title: 'Mergex LeadGen',
          body,
          smallIcon: 'ic_stat_icon_config_sample',
        });
      } catch (e) { /* ignore */ }
    },
    async stopForegroundService() {
      if (!ForegroundService) return;
      try {
        await ForegroundService.removeAllListeners();
        await ForegroundService.stopForegroundService();
      } catch (e) { /* ignore */ }
    },
    async showBatteryOptimizationHint() {
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return;
      if (localStorage.getItem('battery_hint_shown')) return;
      localStorage.setItem('battery_hint_shown', '1');
      const alert = await alertController.create({
        header: 'Keep App Running',
        message: 'Some devices may stop background tasks to save battery. If scraping stops unexpectedly, go to Settings > Battery > Mergex LeadGen and disable battery optimization.',
        buttons: [
          { text: 'Got it', role: 'cancel' },
          {
            text: 'Open Settings',
            handler: () => {
              try { App.openUrl({ url: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' }); } catch (e) { /* ignore */ }
            },
          },
        ],
      });
      await alert.present();
    },
    /**
     * Pauses the running search. The scraper's onProgress callback checks
     * `this.searchCancelled` and returns `false`, which makes `search()` stop
     * and return `{ results, resumeState }`. The resumeState is stored in
     * `this.resumeState` (see doSearch) and partial results go into `this.row_datas`.
     *
     * ## How resume works (backend — already implemented)
     *
     * `search()` in scraper.js accepts a 4th arg `resumeState`. When provided:
     *   - Phase 1 (search pages): starts from `resumeState.pagination` offset
     *     instead of page 0, and seeds results with `resumeState.partialResults`.
     *   - Phase 2 (enrich): if paused mid-enrichment, resumes from
     *     `resumeState.enrichIndex` so already-enriched items aren't re-fetched.
     *   - If `resumeState.phase === 'enrich'`, Phase 1 is skipped entirely.
     *
     * `doSearch()` already passes `this.resumeState` to `search()`, so calling
     * `doSearch()` again after a pause will automatically resume.
     *
     * ## How to add resume UI (not yet implemented)
     *
     * 1. **Template** — In the results view, add a resume banner when paused:
     *    ```html
     *    <div v-if="resumeState" class="resume-banner">
     *      <ion-chip color="warning">
     *        <ion-label>Search paused</ion-label>
     *      </ion-chip>
     *      <ion-button size="small" @click="resumeSearch" class="action-btn">
     *        <ion-icon :icon="playOutline" slot="start"></ion-icon>
     *        Resume Search
     *      </ion-button>
     *    </div>
     *    ```
     *    Place this inside `.results-view`, above the filter bar.
     *
     * 2. **Import** — Add `playOutline` to the ionicons import and data().
     *
     * 3. **Method** — Add `resumeSearch`:
     *    ```js
     *    async resumeSearch() {
     *      // doSearch already reads this.resumeState and passes it to search().
     *      // Just reset the cancelled flag and re-trigger.
     *      this.searchCancelled = false;
     *      await this.doSearch();
     *    }
     *    ```
     *    That's it — doSearch passes `this.resumeState` to `search()`, which
     *    picks up where it left off. When search completes normally,
     *    `resumeState` is set to `null` and the banner disappears.
     *
     * 4. **Style** — Add resume banner styling:
     *    ```css
     *    .resume-banner {
     *      display: flex;
     *      align-items: center;
     *      justify-content: space-between;
     *      padding: 8px 12px;
     *      background: rgba(255, 170, 0, 0.08);
     *      border-bottom: 1px solid rgba(255, 170, 0, 0.2);
     *    }
     *    ```
     *
     * 5. **Edge cases to handle**:
     *    - `newSearch()` already clears `this.resumeState = null`.
     *    - If user edits the query and hits Generate Leads, clear resumeState
     *      so it doesn't try to resume a different query's pagination.
     *    - The results toolbar chip could show "X leads (paused)" when
     *      `resumeState` is non-null.
     */
    pauseSearch() {
      this.searchCancelled = true;
    },
    navigateTo(target, { pushStack = true } = {}) {
      const prev = this.view;
      if (target === prev) return;

      if (pushStack && prev) {
        this.viewStack.push(prev);
      }

      if (target === 'search') {
        if (prev === 'results') {
          this.row_datas = [];
          this.resumeState = null;
          this.resultSource = null;
          this.showShare = false;
          this.downloadedUri = null;
          this.filterText = '';
        }
        this.view = 'search';
      } else if (target === 'history') {
        this.view = 'history';
        this.loadHistory();
      } else if (target === 'settings') {
        this.view = 'settings';
        this.cacheCount = getCacheCount();
      }
    },
    goBack() {
      // Close any open modals first
      if (this.modeInfoOpen) { this.modeInfoOpen = false; return; }
      if (this.infoOpen) { this.infoOpen = false; return; }
      if (this.detailOpen) { this.detailOpen = false; return; }

      // Clean up results state when leaving results
      if (this.view === 'results') {
        this.row_datas = [];
        this.resumeState = null;
        this.resultSource = null;
        this.showShare = false;
        this.downloadedUri = null;
        this.filterText = '';
      }

      // Pop from view stack
      if (this.viewStack.length > 0) {
        const prev = this.viewStack.pop();
        this.view = prev;
        if (prev === 'history') this.loadHistory();
        return;
      }

      // Already at root (search) — nothing in stack
      if (this.view === 'search') return 'exit';

      // Fallback — go to search
      this.view = 'search';
    },
    tabNavigate(target) {
      // Tab bar taps reset the stack — direct navigation, not push
      this.viewStack = [];
      if (target === this.view) return;
      this.navigateTo(target, { pushStack: false });
    },
    newSearch() {
      this.view = 'search';
      this.row_datas = [];
      this.resumeState = null;
      this.resultSource = null;
      this.showShare = false;
      this.downloadedUri = null;
      this.filterText = '';
    },
    timeAgo(dateStr) {
      if (!dateStr) return '';
      const d = typeof dateStr === 'number' ? dateStr : new Date(dateStr).getTime();
      const diff = Date.now() - d;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      return `${days}d ago`;
    },
    // ─── History ─────────────────────────────────────────────────────────
    async loadHistory() {
      const items = [];
      // Load local resume state
      const localResume = localStorage.getItem('mergex_resume_state');
      if (localResume) {
        try {
          const parsed = JSON.parse(localResume);
          items.push({
            id: 'local_resume',
            query: parsed.query,
            mode: parsed.mode,
            result_count: parsed.resultCount || 0,
            created_at: parsed.timestamp,
            source: 'local',
            status: 'paused',
            _resumeState: parsed.resumeState,
            _partialResults: parsed.partialResults || [],
          });
        } catch { /* ignore */ }
      }
      // Load cached searches from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          try {
            const entry = JSON.parse(localStorage.getItem(k));
            if (entry && entry.query) {
              items.push({
                id: k,
                cacheKey: k,
                query: entry.query,
                mode: entry.mode,
                result_count: (entry.results || []).length,
                created_at: entry.timestamp,
                source: 'local',
                status: 'completed',
              });
            }
          } catch { /* ignore */ }
        }
      }
      // Sort by most recent first
      items.sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      this.historyItems = items;
    },
    async refreshHistory(event) {
      await this.loadHistory();
      event?.target?.complete();
    },
    loadHistoryItem(item) {
      if (item.status === 'paused') {
        this.viewPausedResults(item);
        return;
      }
      const cached = getCachedSearch(item.query, item.mode || 'normal');
      if (cached) {
        this.row_datas = cached.results;
        this.input = item.query;
        this.resultSource = 'cache';
        this.viewStack.push(this.view);
        this.view = 'results';
      }
    },
    async showHistoryInfo() {
      const alert = await alertController.create({
        header: 'Search History',
        message: 'Your searches are saved here for quick access.\n\nCompleted searches (green dot) have all results collected and ready to export.\n\nPartial searches (amber dot) were stopped before finishing. You can tap them to preview what was found, or hit the green play icon to pick up right where it left off — no data is lost.',
        buttons: ['Got it'],
      });
      await alert.present();
    },
    viewPausedResults(item) {
      this.row_datas = (item._partialResults || []).map(r => ({
        ...r,
        title: r.title || '',
        cid: r.cid || '',
        stars: r.stars || 0,
        reviews: r.reviews || 0,
        category: r.category || '',
        address: r.address || '',
        completePhoneNumber: r.complete_phone_number || r.completePhoneNumber || '',
        url: r.url || '',
      }));
      this.input = item.query;
      this.searchMode = item.mode || 'normal';
      this.resultSource = 'cache';
      this.viewStack.push(this.view);
      this.view = 'results';
    },
    async resumeFromHistory(item) {
      this.searchProvider = 'maps';
      this.input = item.query;
      this.searchMode = item.mode || 'normal';
      this.resumeState = item._resumeState;
      if (item._partialResults?.length) {
        this.row_datas = item._partialResults;
      }
      localStorage.removeItem('mergex_resume_state');
      this.historyItems = this.historyItems.filter(h => h !== item);
      this.searchCancelled = false;
      await this.doSearch();
    },
    async deleteHistoryItem(item) {
      const alert = await alertController.create({
        header: 'Delete Search',
        message: `Delete "${item.query}" from history?`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Delete',
            handler: () => {
              if (item.status === 'paused' || item.id === 'local_resume') {
                localStorage.removeItem('mergex_resume_state');
              }
              if (item.cacheKey) {
                localStorage.removeItem(item.cacheKey);
              } else {
                const k = cacheKey(item.query, item.mode || 'normal');
                localStorage.removeItem(k);
              }
              this.cacheCount = getCacheCount();
              this.historyItems = this.historyItems.filter(h => h !== item);
            },
          },
        ],
      });
      await alert.present();
    },
    // ─── Settings actions ────────────────────────────────────────────────
    async doAutoLogin() {
      if (!this.liEmail || !this.liPassword) return;
      this.liSigning = true;
      this.liSigningStatus = 'Opening LinkedIn…';
      try {
        // Brief delay so the status text renders before the Activity opens
        await new Promise(r => setTimeout(r, 120));
        this.liSigningStatus = 'Signing in…';
        await linkedInLogin({ email: this.liEmail.trim(), password: this.liPassword });
        this.liEmail    = '';
        this.liPassword = '';
        this.liShowPw   = false;
        this.linkedInConnected = true;
        const toast = await toastController.create({ message: '✅ LinkedIn connected. Combined and LinkedIn search are ready.', duration: 3500, color: 'success' });
        await toast.present();
      } catch (err) {
        const msg = err?.message || String(err);
        const toast = await toastController.create({
          message: msg.includes('challenge') || msg.includes('checkpoint')
            ? 'LinkedIn asked for a verification code. Use "Sign in manually" to complete it.'
            : `LinkedIn sign-in failed: ${msg}`,
          duration: 5000, color: 'warning',
        });
        await toast.present();
      } finally {
        this.liSigning = false;
        this.liSigningStatus = 'Opening LinkedIn…';
      }
    },
    async doLinkedInLogin() {
      this.liSigning = true;
      try {
        await linkedInLogin({});
        this.linkedInConnected = true;
        const toast = await toastController.create({ message: '✅ LinkedIn connected.', duration: 3000, color: 'success' });
        await toast.present();
      } catch {
        const toast = await toastController.create({ message: 'Sign-in cancelled.', duration: 2000, color: 'medium' });
        await toast.present();
      } finally {
        this.liSigning = false;
      }
    },
    async doLinkedInLogout() {
      await clearLinkedInSession();
      this.linkedInConnected = false;
      const toast = await toastController.create({ message: 'LinkedIn session removed.', duration: 2000, color: 'medium' });
      await toast.present();
    },
    async openNotifSettings() {
      await openNotificationSettings();
      // Re-check after returning from settings
      setTimeout(async () => {
        this.notifAccessGranted = await hasNotificationAccess();
      }, 1000);
    },
    async clearLocalCache() {
      const alert = await alertController.create({
        header: 'Clear Cache',
        message: `Delete ${this.cacheCount} cached searches?`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Clear',
            handler: () => {
              clearAllCache();
              this.cacheCount = 0;
              toastController.create({ message: 'Cache cleared', duration: 2000, position: 'bottom', color: 'success' }).then(t => t.present());
            },
          },
        ],
      });
      await alert.present();
    },
    // ─── Resume (handled in history tab) ───────────────────────────────
    async doSearch() {
      if (this.searching) return;
      if (!this.input.trim()) {
        this.shaking = true;
        setTimeout(() => { this.shaking = false; }, 500);
        return;
      }

      const provider = this.effectiveProvider;
      if (provider !== 'maps') {
        this.searching = true;
        try {
          const query = this.input.trim();
          const [, keywords, city] = query.match(/^(.+)\s+in\s+(.+)$/i) ?? ['', query, ''];
          this.progressText = provider === 'combined' ? 'Searching Google Maps and LinkedIn…' : 'Searching LinkedIn…';
          const [maps, linkedin] = await Promise.allSettled([
            provider === 'combined' ? search(query, this.searchMode).then(result => result.results) : [],
            searchLinkedIn(keywords, city, this.searchMode),
          ]);
          const errors = [maps, linkedin].flatMap((result, i) => result.status === 'rejected'
            ? [`${i === 0 ? 'Google Maps' : 'LinkedIn'}: ${result.reason.message}`] : []);
          const rows = mergeLeadSources(maps.value ?? [], linkedin.value ?? []);
          if (!rows.length) throw new Error(errors.join(' ') || 'No leads found for this search.');
          if (this.view !== 'search') return;
          this.viewStack.push('search');
          this.row_datas = rows;
          this.resumeState = null;
          this.resultSource = null;
          this.showShare = false;
          this.downloadedUri = null;
          this.view = 'results';
          if (errors.length) {
            const toast = await toastController.create({ message: errors.join(' '), duration: 5500, color: 'warning' });
            await toast.present();
          }
        } catch (error) {
          const toast = await toastController.create({ message: error.message, duration: 4500, color: 'warning' });
          await toast.present();
        } finally {
          this.searching = false;
          this.progressText = '';
        }
        return;
      }

      // If input changed from a previous resume, clear resume state
      if (this.resumeState && this.resumeState._query && this.resumeState._query !== this.input.trim()) {
        this.resumeState = null;
      }

      // Track navigation so back button returns correctly
      if (this.view !== 'results') {
        this.viewStack.push(this.view);
      }

      this.resultSource = null;

      // ── Check local cache first ──
      if (!this.resumeState) {
        const cached = getCachedSearch(this.input, this.searchMode);
        if (cached) {
          this.row_datas = cached.results;
          this.resultSource = 'cache';
          this.view = 'results';
          const toast = await toastController.create({
            message: `Loaded ${cached.results.length} cached leads`, duration: 2000, position: 'bottom', color: 'dark',
          });
          await toast.present();
          return;
        }
      }

      // ── Scraping flow ──
      // Show long mode confirmation
      if (this.searchMode === 'long' && !this.resumeState) {
        const confirmed = await new Promise(resolve => {
          alertController.create({
            header: 'Deep Search',
            message: 'Deep looks up places that are missing a phone number. It may also fill in missing addresses and websites. Continue?',
            buttons: [
              { text: 'Cancel', role: 'cancel', handler: () => resolve(false) },
              { text: 'Continue', handler: () => resolve(true) },
            ],
          }).then(alert => alert.present());
        });
        if (!confirmed) return;
      }

      this.searching = true;
      this.searchCancelled = false;
      this.progressText = 'Starting search...';
      this.showShare = false;
      this.downloadedUri = null;

      await this.showBatteryOptimizationHint();
      await this.startForegroundService();

      if (Capacitor.isNativePlatform()) {
        const toast = await toastController.create({
          message: 'Finding leads in background... You can close the app.',
          duration: 5000, position: 'bottom', color: 'dark',
        });
        await toast.present();
      }

      try {
        const onProgress = (info) => {
          this.progressText = info.message;
          this.updateForegroundNotification(info.message);
          if (this.searchCancelled) return false;
        };

        const searchResult = await search(this.input, this.searchMode, onProgress, this.resumeState);
        this.row_datas = searchResult.results;
        this.resumeState = searchResult.resumeState;

        if (this.searchCancelled) {
          const resumeData = {
            query: this.input,
            mode: this.searchMode,
            resumeState: this.resumeState,
            partialResults: this.row_datas,
            resultCount: this.row_datas.length,
            timestamp: Date.now(),
          };
          localStorage.setItem('mergex_resume_state', JSON.stringify(resumeData));

          const toast = await toastController.create({
            message: `Search paused. Found ${this.row_datas.length} leads so far. Resume anytime.`,
            duration: 4000, position: 'bottom', color: 'warning',
          });
          await toast.present();
          if (this.row_datas.length > 0) this.view = 'results';
        } else {
          // Search completed — clear resume state
          this.resumeState = null;
          localStorage.removeItem('mergex_resume_state');

          // Save to local cache
          if (this.row_datas.length > 0) {
            setCachedSearch(this.input, this.searchMode, this.row_datas);
          }

          if (Capacitor.isNativePlatform() && this.notificationsGranted) {
            try {
              const notifId = Math.floor(Math.random() * 2147483646) + 1;
              await LocalNotifications.schedule({
                notifications: [{
                  title: 'Leads Ready',
                  body: `Found ${this.row_datas.length} leads for "${this.input}"`,
                  id: notifId,
                  channelId: 'search-updates',
                  smallIcon: 'ic_notification',
                  autoCancel: true,
                }],
              });
            } catch (notifErr) {
              console.error('[NOTIF] Failed:', notifErr);
            }
          }

          if (this.row_datas.length > 0) {
            this.view = 'results';
          } else {
            const toast = await toastController.create({
              message: 'No leads found. Try a different search.', duration: 3000, position: 'bottom', color: 'warning',
            });
            await toast.present();
          }
        }
      } catch (error) {
        console.error('Search error:', error);
        const toast = await toastController.create({
          message: 'Lead search failed. Please try again.', duration: 3000, position: 'bottom', color: 'danger',
        });
        await toast.present();
      } finally {
        this.searching = false;
        this.progressText = '';
        await this.stopForegroundService();
      }
    },
    async downloadExcel() {
      try {
        const result = await makeExcel(this.row_datas, this.input);
        this.lastFilename = result.filename;
        if (Capacitor.isNativePlatform()) {
          this.showShare = true;
          this.downloadedUri = result.uri;
          await this.syncNotificationStatus();
          if (!this.notificationsGranted) {
            await this.showNotificationNudgeToast();
            return;
          }
        }
        const toast = await toastController.create({
          message: 'Leads exported to Downloads', duration: 3000, position: 'bottom', color: 'success',
        });
        await toast.present();
      } catch (error) {
        console.error('Export error:', error);
        const toast = await toastController.create({
          message: 'Export failed. Try again.', duration: 3000, position: 'bottom', color: 'danger',
        });
        await toast.present();
      }
    },
    async openDownloadedFile() {
      try {
        await SaveToDownloads.openFile({ uri: this.downloadedUri });
      } catch (error) {
        const toast = await toastController.create({
          message: 'No app found to open .xlsx files', duration: 3000, position: 'bottom', color: 'warning',
        });
        await toast.present();
      }
    },
    async shareFile() {
      await shareLastFile(this.lastFilename);
    },
    openDetail(row) {
      this.detailRow = row;
      this.detailOpen = true;
    },
    callPhone(number) {
      window.open(`tel:${number}`, '_system');
    },
    openUrl(url) {
      window.open(url, '_blank');
    },
    openMap(row) {
      const q = encodeURIComponent(row.title + ' ' + row.address);
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
    },
  },
};
</script>

<style scoped>
/* Header */
.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #E8FF00;
  color: #0F0F0F;
  font-weight: 900;
  font-size: 16px;
  border-radius: 6px;
}
.brand-name {
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.3px;
}
.brand-accent {
  color: #E8FF00;
  font-weight: 400;
}

/* Search hero */
.content-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 24px 16px;
}
.search-hero {
  text-align: center;
  margin-bottom: 32px;
}
.hero-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid rgba(232, 255, 0, 0.3);
  color: #E8FF00;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  margin-bottom: 16px;
}
.hero-title {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}
.accent {
  color: #E8FF00;
}
.hero-sub {
  color: #888;
  font-size: 14px;
  line-height: 1.5;
  max-width: 360px;
  margin: 0 auto;
}
.search-container {
  width: 100%;
  max-width: 600px;
}
.leadgen-search {
  --background: #1A1A1A;
  --border-radius: 12px;
  --box-shadow: none;
  --color: #f0f0f0;
  --placeholder-color: #666;
}

/* Mode Selector */
.mode-selector {
  margin-top: 16px;
  padding: 0 4px;
}
.mode-label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.mode-label-text {
  font-size: 12px;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.8px;
}
.mode-info-trigger {
  background: none;
  border: none;
  padding: 0;
  color: #666;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}
.mode-info-trigger:hover {
  color: #E8FF00;
}
.mode-options {
  display: flex;
  gap: 8px;
}
.mode-option {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #1A1A1A;
  border: 1.5px solid #252525;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  color: #888;
  position: relative;
  overflow: hidden;
}
.mode-option:hover {
  border-color: #333;
  background: #1f1f1f;
}
.mode-option.active {
  border-color: #E8FF00;
  background: rgba(232, 255, 0, 0.05);
  color: #f0f0f0;
}
.mode-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #252525;
  font-size: 16px;
  flex-shrink: 0;
  transition: all 0.2s;
}
.mode-option.active .mode-option-icon {
  background: rgba(232, 255, 0, 0.15);
  color: #E8FF00;
}
.mode-option-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.mode-option-name {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
}
.mode-option-desc {
  font-size: 10px;
  color: #666;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mode-option.active .mode-option-desc {
  color: #888;
}
.mode-dev-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 6px;
  background: rgba(255, 140, 0, 0.15);
  color: #ff8c00;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  vertical-align: middle;
  margin-left: 4px;
}
.mode-check {
  position: absolute;
  top: 6px;
  right: 6px;
  color: #E8FF00;
  font-size: 14px;
  display: flex;
}

/* Long mode warning */
.mode-warning {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(255, 170, 0, 0.08);
  border: 1px solid rgba(255, 170, 0, 0.2);
  border-radius: 8px;
  color: #ffaa00;
  font-size: 12px;
  line-height: 1.4;
}
.mode-warning ion-icon {
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
}
.fade-enter-active, .fade-leave-active {
  transition: all 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.action-buttons {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.search-btn {
  --background: #E8FF00;
  --color: #0F0F0F;
  --border-radius: 12px;
  font-weight: 700;
  font-size: 15px;
  height: 48px;
}
.search-btn:hover {
  --background: #d4eb00;
}
.pause-btn {
  --background: transparent;
  --color: #E8FF00;
  --border-color: #E8FF00;
  --border-style: solid;
  --border-width: 1.5px;
  --border-radius: 12px;
  font-weight: 600;
  font-size: 13px;
  height: 48px;
}
.search-tags {
  margin-top: 28px;
  text-align: center;
}
.tags-label {
  display: block;
  font-size: 11px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 10px;
}
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}
.tag {
  padding: 6px 14px;
  border-radius: 20px;
  background: #1A1A1A;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}
.tag:hover {
  background: #252525;
  color: #E8FF00;
  border-color: rgba(232, 255, 0, 0.2);
}

/* Results toolbar */
.results-toolbar {
  --background: #1A1A1A;
}
.results-chip {
  --background: rgba(232, 255, 0, 0.15);
  --color: #E8FF00;
  font-weight: 600;
  font-size: 12px;
}
.action-btn {
  --background: #E8FF00;
  --color: #0F0F0F;
  --border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
}
.share-btn {
  --background: #333;
  --color: #f0f0f0;
  --border-radius: 8px;
  font-weight: 600;
  font-size: 13px;
}

/* Results view */
.results-view {
  padding-bottom: 60px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 4px 8px;
  gap: 4px;
  background: #1A1A1A;
  position: sticky;
  top: 0;
  z-index: 10;
  margin-bottom: 12px;
}
.filter-search {
  flex: 1;
  min-width: 0;
  --background: #252525;
  --border-radius: 8px;
  --color: #f0f0f0;
  --placeholder-color: #666;
  padding: 0 !important;
}
.sort-select {
  max-width: 120px;
  font-size: 14px;
  color: #ccc;
}
.source-filters {
  flex: 0 0 100%;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0;
}
.source-filters button {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #454545;
  border-radius: 8px;
  background: transparent;
  color: #ddd;
  font: inherit;
  font-size: 13px;
}
.source-filters button[aria-pressed='true'] {
  background: #e8ff00;
  border-color: #e8ff00;
  color: #141414;
}
.source-filters button:focus-visible {
  outline: 2px solid #e8ff00;
  outline-offset: 2px;
}

.cards-container {
  padding: 8px;
}
.data-card {
  margin-bottom: 8px;
  cursor: pointer;
  --background: #1A1A1A;
  border-radius: 12px;
  border: 1px solid #252525;
  transition: border-color 0.2s;
}
.data-card:hover {
  border-color: #E8FF00;
}
.lead-card-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  column-gap: 8px;
}
.lead-card-header ion-card-subtitle {
  grid-column: 1;
  grid-row: 2;
}
.source-mark {
  grid-column: 2;
  grid-row: 1;
  display: inline-flex;
  gap: 4px;
  padding: 5px;
  align-self: start;
  color: #e8ff00;
  background: #282b17;
  border-radius: 6px;
  font-size: 16px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #f0f0f0;
}
.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.stars {
  display: flex;
  align-items: center;
  gap: 2px;
  font-weight: 600;
}
.reviews {
  color: #888;
  font-size: 13px;
}
.card-address {
  color: #888;
  font-size: 13px;
  margin: 4px 0 8px;
}
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.lead-chip {
  --background: transparent;
  font-size: 12px;
}
.phone-chip {
  --color: #E8FF00;
  border-color: rgba(232, 255, 0, 0.3);
}
.web-chip {
  --color: #888;
  border-color: #333;
}

.no-results {
  text-align: center;
  padding: 40px 16px;
  color: #666;
}

.link-text {
  word-break: break-all;
}

/* Mode Info Modal */
.mode-info-content {
  --background: #0F0F0F;
}
.mode-info-intro {
  color: #888;
  font-size: 14px;
  line-height: 1.5;
  margin-bottom: 20px;
}
.mode-info-card {
  background: #1A1A1A;
  border: 1px solid #252525;
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 12px;
  transition: border-color 0.2s;
}
.mode-info-card.recommended {
  border-color: rgba(232, 255, 0, 0.3);
}
.mode-info-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.mode-info-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  font-size: 20px;
  flex-shrink: 0;
}
.mode-icon-fast {
  background: rgba(0, 200, 255, 0.12);
  color: #00c8ff;
}
.mode-icon-normal {
  background: rgba(232, 255, 0, 0.12);
  color: #E8FF00;
}
.mode-icon-long {
  background: rgba(255, 140, 0, 0.12);
  color: #ff8c00;
}
.mode-info-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #f0f0f0;
}
.mode-recommended-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(232, 255, 0, 0.15);
  color: #E8FF00;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.mode-indev-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255, 140, 0, 0.15);
  color: #ff8c00;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
.mode-info-card-desc {
  color: #aaa;
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
}
.mode-info-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.mode-stat {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mode-stat-label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: 40px;
  flex-shrink: 0;
}
.mode-stat-bar {
  flex: 1;
  height: 6px;
  background: #252525;
  border-radius: 3px;
  overflow: hidden;
}
.mode-stat-fill {
  height: 100%;
  background: #E8FF00;
  border-radius: 3px;
  transition: width 0.4s ease;
}
.mode-info-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.mode-detail-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #aaa;
}
.detail-yes {
  color: #4ade80;
  font-size: 14px;
}
.detail-no {
  color: #555;
  font-size: 14px;
}
.mode-info-tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 16px;
  padding: 14px;
  background: rgba(232, 255, 0, 0.05);
  border: 1px solid rgba(232, 255, 0, 0.15);
  border-radius: 12px;
}
.mode-info-tip ion-icon {
  color: #E8FF00;
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}
.mode-info-tip p {
  margin: 0;
  color: #aaa;
  font-size: 13px;
  line-height: 1.5;
}
.mode-info-tip strong {
  color: #f0f0f0;
}

/* Bottom Navigation */
.bottom-nav {
  display: flex;
  justify-content: space-around;
  background: #0F0F0F;
  border-top: 1px solid #1A1A1A;
  padding: 6px 0 env(safe-area-inset-bottom, 6px);
}
.bottom-nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 16px;
  background: none;
  border: none;
  color: #666;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s;
}
.bottom-nav-item ion-icon {
  font-size: 22px;
}
.bottom-nav-item.active {
  color: #E8FF00;
}

/* History View */
.history-view, .settings-view {
  padding: 16px;
  padding-bottom: 80px;
}
.view-header {
  margin-bottom: 4px;
}
.view-header-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.view-header h2 {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.3px;
}
.header-info-btn {
  background: none;
  border: none;
  color: #555;
  font-size: 18px;
  padding: 4px;
  display: flex;
  align-items: center;
  cursor: pointer;
  transition: color 0.15s;
}
.header-info-btn:active {
  color: #aaa;
}
.empty-state {
  text-align: center;
  padding: 60px 16px;
  color: #666;
}
.empty-icon {
  font-size: 48px;
  color: #333;
  margin-bottom: 12px;
}
.empty-state h3 {
  font-size: 16px;
  color: #888;
  margin: 0 0 6px;
}
.empty-state p {
  font-size: 13px;
  margin: 0;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: #1A1A1A;
  border-radius: 10px;
  border: 1px solid #222;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  -webkit-tap-highlight-color: transparent;
  gap: 10px;
}
.history-item:active {
  background: #222;
}
.history-item--paused {
  border-color: rgba(255, 170, 0, 0.25);
}
.history-item-left {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.history-item-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.history-item-status-dot.dot-green {
  background: #4ade80;
}
.history-item-status-dot.dot-amber {
  background: #f59e0b;
}
.history-item-body {
  min-width: 0;
  flex: 1;
}
.history-item-query {
  font-size: 14px;
  font-weight: 600;
  color: #eee;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
  line-height: 1.3;
}
.history-item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  font-size: 11px;
  color: #777;
  line-height: 1.4;
}
.history-meta-sep {
  color: #444;
}
.history-tag {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  padding: 1px 6px;
  border-radius: 3px;
  background: #252525;
  color: #777;
}
.history-tag--fast { color: #22d3ee; background: rgba(34, 211, 238, 0.1); }
.history-tag--normal { color: #a3e635; background: rgba(163, 230, 53, 0.1); }
.history-tag--long { color: #fb923c; background: rgba(251, 146, 60, 0.1); }
.history-tag--partial { color: #fbbf24; background: rgba(251, 191, 36, 0.1); }
.history-item-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.history-action-btn {
  background: none;
  border: none;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 20px;
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.history-action-btn:active {
  background: rgba(255, 255, 255, 0.06);
}
.history-action-btn--resume {
  color: #4ade80;
}
.history-action-btn--delete {
  color: #666;
}
.history-action-btn--delete:active {
  color: #ef4444;
}

/* Settings View */
.settings-section {
  margin-bottom: 24px;
}
.settings-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #E8FF00;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0 0 10px;
}
.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #1A1A1A;
  border-radius: 12px;
  border: 1px solid #252525;
  margin-bottom: 6px;
  cursor: pointer;
}
.settings-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.settings-item-label {
  font-size: 14px;
  font-weight: 600;
  color: #f0f0f0;
}
.settings-item-desc {
  font-size: 12px;
  color: #888;
}

/* LinkedIn credential form */
.li-notif-tip {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: rgba(10, 102, 194, 0.08);
  border: 1px solid rgba(10, 102, 194, 0.25);
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  color: #9a9a9a;
  line-height: 1.6;
}
.li-notif-icon { font-size: 20px; flex-shrink: 0; }
.li-notif-tip strong { color: #c8e6fa; }

.li-signin-form {
  background: #1A1A1A;
  border: 1px solid #252525;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.li-signin-notice {
  font-size: 12px;
  color: #9a9a9a;
  line-height: 1.6;
  margin: 0;
  padding: 10px 12px;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  border-left: 3px solid #0a66c2;
}
.li-signin-notice strong { color: #c8e6fa; }
.li-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.li-label {
  font-size: 12px;
  font-weight: 600;
  color: #aaa;
  letter-spacing: 0.03em;
}
.li-input {
  width: 100%;
  background: #111;
  border: 1px solid #333;
  border-radius: 8px;
  color: #f0f0f0;
  font-size: 15px;
  padding: 10px 12px;
  outline: none;
  box-sizing: border-box;
  -webkit-appearance: none;
}
.li-input:focus { border-color: #0a66c2; }
.li-input:disabled { opacity: 0.5; }
.li-pw-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.li-pw-toggle {
  background: none;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 8px 10px;
  color: #888;
  cursor: pointer;
  font-size: 16px;
  flex-shrink: 0;
}
.li-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

/* Info Modal */
.info-content {
  --background: #0F0F0F;
}
.info-hero {
  text-align: center;
  padding: 24px 0 16px;
}
.info-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #E8FF00;
  color: #0F0F0F;
  font-weight: 900;
  font-size: 24px;
  border-radius: 12px;
  margin-bottom: 12px;
}
.info-hero h2 {
  font-size: 24px;
  font-weight: 800;
  margin: 0;
}
.info-tagline {
  color: #888;
  font-size: 14px;
  margin: 4px 0 0;
}
.info-section {
  margin-bottom: 24px;
}
.info-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #E8FF00;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 12px;
}
.info-section p {
  color: #aaa;
  font-size: 14px;
  line-height: 1.6;
}
.info-card {
  background: #1A1A1A;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 8px;
}
.info-card strong {
  color: #f0f0f0;
  font-size: 15px;
}
.info-card p {
  margin: 4px 0 0;
  font-size: 13px;
}
.info-links {
  background: transparent;
}
.info-links ion-item {
  --background: #1A1A1A;
  --color: #ccc;
  --border-radius: 10px;
  margin-bottom: 6px;
  --border-color: transparent;
  font-size: 14px;
}
.info-socials {
  display: flex;
  gap: 20px;
  justify-content: center;
}
.info-socials a {
  color: #888;
  font-size: 28px;
  transition: color 0.2s;
}
.info-socials a:hover {
  color: #E8FF00;
}

.shake {
  animation: shake-animation 0.5s;
}
@keyframes shake-animation {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

/* Responsive - small screens stack mode options vertically */
@media (max-width: 420px) {
  .mode-options {
    flex-direction: column;
  }
  .mode-option {
    padding: 10px 14px;
  }
  .mode-option-desc {
    white-space: normal;
  }
}

/* Desktop/web - wider layout */
@media (min-width: 768px) {
  .content-center {
    padding: 40px 24px;
  }
  .hero-title {
    font-size: 36px;
  }
  .hero-sub {
    font-size: 16px;
    max-width: 480px;
  }
  .search-container {
    max-width: 640px;
  }
  .mode-option {
    padding: 12px 16px;
  }
  .mode-option-desc {
    font-size: 11px;
  }
  .cards-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 8px;
    padding: 12px;
  }
  .data-card {
    margin-bottom: 0;
  }
}

@media (min-width: 1024px) {
  .hero-title {
    font-size: 42px;
  }
  .cards-container {
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 12px;
    padding: 16px;
  }
}
</style>
