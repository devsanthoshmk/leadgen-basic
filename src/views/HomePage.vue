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
          <ion-button v-if="view === 'results'" @click="newSearch" fill="clear">
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
          <ion-label>{{ row_datas.length }} leads found</ion-label>
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
          <p class="hero-sub">Search businesses by type and location. Export leads with phone, email, and address data for your sales pipeline.</p>
        </div>

        <div class="search-container" :class="{ shake: shaking }">
          <ion-searchbar
            v-model="input"
            placeholder="e.g. Restaurants in Chennai"
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
                class="mode-option"
                :class="{ active: searchMode === m.id }"
                @click="selectMode(m.id)"
              >
                <div class="mode-option-icon">
                  <ion-icon :icon="m.icon"></ion-icon>
                </div>
                <div class="mode-option-body">
                  <span class="mode-option-name">{{ m.name }} <span v-if="m.inDevelopment" class="mode-dev-badge">In Dev</span></span>
                  <span class="mode-option-desc">{{ m.shortDesc }}</span>
                </div>
                <div v-if="searchMode === m.id" class="mode-check">
                  <ion-icon :icon="checkmarkCircle"></ion-icon>
                </div>
              </button>
            </div>
            <!-- Long mode warning -->
            <transition name="fade">
              <div v-if="searchMode === 'long'" class="mode-warning">
                <ion-icon :icon="timeOutline"></ion-icon>
                <span>Deep mode takes longer and is still in development. It improves address accuracy and slightly increases phone number coverage. Best for small, targeted searches.</span>
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
              <ion-button expand="block" class="pause-btn" @click="pauseSearch">
                <ion-icon :icon="pauseOutline" slot="start"></ion-icon>
                Pause Search
              </ion-button>
            </template>
          </div>
        </div>

        <!-- Search History Suggestions (placeholder for future implementation)
             TODO: Implement search history feature
             - Store recent searches in localStorage with timestamp
             - Show last 5-8 searches below the search bar when input is focused
             - Each suggestion should show: query text, result count, time ago
             - Clicking a suggestion populates the search bar and triggers search
             - Add a "Clear History" option at the bottom
             - Data shape: { query: string, resultCount: number, timestamp: number, mode: string }
             - Storage key: 'mergex_search_history'
        -->

        <div class="search-tags">
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
        </div>

        <!-- Data cards -->
        <div class="cards-container">
          <ion-card v-for="(row, i) in filteredData" :key="i" class="data-card" @click="openDetail(row)">
            <ion-card-header>
              <ion-card-title class="card-title">{{ row.title }}</ion-card-title>
              <ion-card-subtitle v-if="row.category">{{ row.category }}</ion-card-subtitle>
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
              </div>
              <p v-if="row.address" class="card-address">{{ row.address }}</p>
              <div class="card-actions">
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
          <ion-list>
            <ion-item>
              <ion-label>
                <h3>Category</h3>
                <p>{{ detailRow.category || 'N/A' }}</p>
              </ion-label>
            </ion-item>
            <ion-item>
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
          <p class="mode-info-intro">Choose how thorough your lead search should be. Each mode balances speed against the amount of data you get back.</p>

          <div v-for="m in modes" :key="m.id" class="mode-info-card" :class="{ recommended: m.id === 'normal' }">
            <div class="mode-info-card-header">
              <div class="mode-info-card-icon" :class="'mode-icon-' + m.id">
                <ion-icon :icon="m.icon"></ion-icon>
              </div>
              <div>
                <h3>{{ m.name }}</h3>
                <span v-if="m.id === 'normal'" class="mode-recommended-badge">Recommended</span>
                <span v-if="m.inDevelopment" class="mode-indev-badge">In Development</span>
              </div>
            </div>
            <p class="mode-info-card-desc">{{ m.longDesc }}</p>
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
            <p><strong>Pro Tip:</strong> Start with <strong>Normal</strong> mode for everyday prospecting. Switch to <strong>Fast</strong> when you just need names and addresses quickly. Try <strong>Deep</strong> for small targeted searches where address accuracy and phone coverage matter — more features coming soon.</p>
          </div>
        </ion-content>
      </ion-modal>

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
      <ion-toolbar class="footer-toolbar">
        <div class="footer-content">
          <span class="footer-brand">Mergex</span>
          <span class="footer-dot">&middot;</span>
          <span class="footer-text">Scale Is Not Luck. It's Structure.</span>
        </div>
      </ion-toolbar>
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
  toastController,
  alertController,
} from '@ionic/vue';
import {
  logoGithub, logoLinkedin, logoInstagram, logoTwitter, shareSocialOutline,
  downloadOutline, arrowBackOutline, starSharp, starOutline,
  callOutline, globeOutline, openOutline, navigateOutline,
  arrowUpOutline, arrowDownOutline, informationCircleOutline, mailOutline,
  flashOutline, syncOutline, layersOutline, pauseOutline,
  helpCircleOutline, checkmarkCircle, closeCircle, timeOutline, bulbOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { search } from '../services/scraper.js';
import { makeExcel, shareLastFile, SaveToDownloads } from '../services/excel.js';

let ForegroundService = null;

export default {
  name: 'HomePage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonFooter,
    IonSearchbar, IonButton, IonButtons, IonSpinner, IonIcon,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonChip, IonLabel, IonSelect, IonSelectOption,
    IonModal, IonList, IonItem,
  },
  data() {
    return {
      input: '',
      view: 'search',
      searching: false,
      shaking: false,
      row_datas: [],
      showShare: false,
      lastFilename: '',
      downloadedUri: null,
      filterText: '',
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
          shortDesc: 'Automatically balances speed & data',
          longDesc: 'Default mode. Automatically finds the right balance between speed and completeness — runs the search first, then fills in missing phone numbers only when needed. Smart and efficient for everyday prospecting.',
          speed: 65,
          data: 75,
          details: [
            { text: 'Business names & addresses', yes: true },
            { text: 'Ratings & reviews', yes: true },
            { text: 'Websites', yes: true },
            { text: 'Missing phone numbers filled', yes: true },
            { text: 'Full address details', yes: false },
          ],
        },
        {
          id: 'long',
          name: 'Deep',
          icon: layersOutline,
          shortDesc: 'Better accuracy, in development',
          longDesc: 'Looks up each result individually to get more accurate full addresses and improves the chance of finding phone numbers. More features coming soon as this mode is still being developed.',
          speed: 25,
          data: 65,
          inDevelopment: true,
          details: [
            { text: 'Business names & addresses', yes: true },
            { text: 'Ratings & reviews', yes: true },
            { text: 'Websites', yes: true },
            { text: 'More accurate full addresses', yes: true },
            { text: 'Higher phone number coverage', yes: true },
          ],
        },
      ],
      // Search history placeholder
      // TODO: searchHistory: JSON.parse(localStorage.getItem('mergex_search_history') || '[]'),
      // icons
      logoGithub, logoLinkedin, logoInstagram, logoTwitter, shareSocialOutline,
      downloadOutline, arrowBackOutline,
      starIcon: starSharp, starOutlineIcon: starOutline,
      callOutline, globeOutline, openOutline, navigateOutline,
      arrowUpOutline, arrowDownOutline, informationCircleOutline, mailOutline,
      helpCircleOutline, checkmarkCircle, closeCircle, timeOutline, bulbOutline,
      pauseOutline,
    };
  },
  computed: {
    filteredData() {
      let data = [...this.row_datas];
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
        if (this.modeInfoOpen) {
          this.modeInfoOpen = false;
        } else if (this.infoOpen) {
          this.infoOpen = false;
        } else if (this.detailOpen) {
          this.detailOpen = false;
        } else if (this.view === 'results') {
          this.newSearch();
        } else {
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
  methods: {
    selectMode(mode) {
      this.searchMode = mode;
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
    pauseSearch() {
      this.searchCancelled = true;
    },
    newSearch() {
      this.view = 'search';
      this.row_datas = [];
      this.resumeState = null;
      this.showShare = false;
      this.downloadedUri = null;
      this.filterText = '';
    },
    async doSearch() {
      if (!this.input.trim()) {
        this.shaking = true;
        setTimeout(() => { this.shaking = false; }, 500);
        return;
      }

      // Show long mode confirmation
      if (this.searchMode === 'long') {
        const confirmed = await new Promise(resolve => {
          alertController.create({
            header: 'Deep Search (In Development)',
            message: 'Deep mode looks up each result individually for better addresses and phone numbers. It takes longer and is still being improved. Best for small, targeted queries. Continue?',
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

        // TODO: Save to search history
        // const history = JSON.parse(localStorage.getItem('mergex_search_history') || '[]');
        // history.unshift({ query: this.input, resultCount: this.row_datas.length, timestamp: Date.now(), mode: this.searchMode });
        // localStorage.setItem('mergex_search_history', JSON.stringify(history.slice(0, 8)));

        if (this.searchCancelled) {
          const toast = await toastController.create({
            message: `Search paused. Found ${this.row_datas.length} leads so far.`, duration: 3000, position: 'bottom', color: 'warning',
          });
          await toast.present();
          if (this.row_datas.length > 0) this.view = 'results';
        } else if (Capacitor.isNativePlatform() && this.notificationsGranted) {
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

        if (!this.searchCancelled) {
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
  align-items: center;
  padding: 4px 8px;
  gap: 4px;
  background: #1A1A1A;
  position: sticky;
  top: 0;
  z-index: 10;
}
.filter-search {
  flex: 1;
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

/* Footer */
.footer-toolbar {
  --background: #0F0F0F;
  --border-color: #1A1A1A;
}
.footer-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 12px;
}
.footer-brand {
  font-weight: 700;
  color: #E8FF00;
}
.footer-dot {
  color: #444;
}
.footer-text {
  color: #666;
  font-style: italic;
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
