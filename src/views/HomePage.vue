<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="dark">
        <ion-title>
          <div class="header-brand">
            <svg
              xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"
              stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"
              class="brand-icon"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none"></path>
              <path d="M12 9.5m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"></path>
              <path d="M6.428 12.494l7.314 -9.252"></path>
              <path d="M10.002 7.935l-2.937 -2.545"></path>
              <path d="M17.693 6.593l-8.336 9.979"></path>
              <path d="M17.591 6.376c.472 .907 .715 1.914 .709 2.935a7.263 7.263 0 0 1 -.72 3.18a19.085 19.085 0 0 1 -2.089 3c-.784 .933 -1.49 1.93 -2.11 2.98c-.314 .62 -.568 1.27 -.757 1.938c-.121 .36 -.277 .591 -.622 .591c-.315 0 -.463 -.136 -.626 -.593a10.595 10.595 0 0 0 -.779 -1.978a18.18 18.18 0 0 0 -1.423 -2.091c-.877 -1.184 -2.179 -2.535 -2.853 -4.071a7.077 7.077 0 0 1 -.621 -2.967a6.226 6.226 0 0 1 1.476 -4.055a6.25 6.25 0 0 1 4.811 -2.245a6.462 6.462 0 0 1 1.918 .284a6.255 6.255 0 0 1 3.686 3.092z"></path>
            </svg>
            Globex Places Data
          </div>
        </ion-title>
        <ion-buttons slot="end" v-if="view === 'results'">
          <ion-button @click="newSearch" fill="clear" color="light">
            <ion-icon :icon="arrowBackOutline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Results toolbar -->
      <ion-toolbar v-if="view === 'results'" color="light">
        <ion-chip color="dark" outline>
          <ion-label>{{ row_datas.length }} results</ion-label>
        </ion-chip>
        <ion-buttons slot="end">
          <ion-button v-if="!downloadedUri" @click="downloadExcel" color="success" fill="solid" size="small">
            <ion-icon :icon="downloadOutline" slot="start"></ion-icon>
            Download
          </ion-button>
          <ion-button v-else @click="openDownloadedFile" color="success" fill="solid" size="small">
            <ion-icon :icon="openOutline" slot="start"></ion-icon>
            Open
          </ion-button>
          <ion-button v-if="showShare" @click="shareFile" color="tertiary" fill="solid" size="small">
            <ion-icon :icon="shareSocialOutline" slot="start"></ion-icon>
            Share
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">

      <!-- SEARCH VIEW -->
      <div v-if="view === 'search'" class="content-center">
        <div class="search-container" :class="{ shake: shaking }">
          <ion-searchbar
            v-model="input"
            placeholder="Enter business/place type & location"
            :debounce="0"
            @keyup.enter="doSearch"
            show-clear-button="focus"
          ></ion-searchbar>
          <div class="action-buttons">
            <ion-button :disabled="searching" @click="doSearch" :color="searching ? 'medium' : 'success'" expand="block">
              <ion-spinner v-if="searching" name="crescent" slot="start"></ion-spinner>
              {{ searching ? 'Searching...' : 'Search' }}
            </ion-button>
          </div>
        </div>
      </div>

      <!-- RESULTS VIEW -->
      <div v-if="view === 'results'" class="results-view">

        <!-- Sort & Filter bar -->
        <div class="filter-bar">
          <ion-searchbar
            v-model="filterText"
            placeholder="Filter results..."
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
                <ion-chip v-if="row.completePhoneNumber" color="primary" outline @click.stop="callPhone(row.completePhoneNumber)">
                  <ion-icon :icon="callOutline"></ion-icon>
                  <ion-label>{{ row.completePhoneNumber }}</ion-label>
                </ion-chip>
                <ion-chip v-if="row.url" color="secondary" outline @click.stop="openUrl(row.url)">
                  <ion-icon :icon="globeOutline"></ion-icon>
                  <ion-label>Website</ion-label>
                </ion-chip>
              </div>
            </ion-card-content>
          </ion-card>

          <div v-if="filteredData.length === 0" class="no-results">
            <p>No results match your filter.</p>
          </div>
        </div>
      </div>

      <!-- DETAIL MODAL -->
      <ion-modal :is-open="detailOpen" @didDismiss="detailOpen = false">
        <ion-header>
          <ion-toolbar>
            <ion-title>Details</ion-title>
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

    </ion-content>

    <ion-footer>
      <ion-toolbar class="footer-toolbar">
        <div class="social-links">
          <a href="https://github.com/devsanthoshmk" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <ion-icon :icon="logoGithub"></ion-icon>
          </a>
          <a href="https://www.linkedin.com/in/santhosh-m-k/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
            <ion-icon :icon="logoLinkedin"></ion-icon>
          </a>
          <a href="https://www.instagram.com/mksantho.sh/" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <ion-icon :icon="logoInstagram"></ion-icon>
          </a>
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
  logoGithub, logoLinkedin, logoInstagram, shareSocialOutline,
  downloadOutline, arrowBackOutline, starSharp, starOutline,
  callOutline, globeOutline, openOutline, navigateOutline,
  arrowUpOutline, arrowDownOutline,
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
      view: 'search', // 'search' | 'results'
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
      // icons
      logoGithub, logoLinkedin, logoInstagram, shareSocialOutline,
      downloadOutline, arrowBackOutline,
      starIcon: starSharp, starOutlineIcon: starOutline,
      callOutline, globeOutline, openOutline, navigateOutline,
      arrowUpOutline, arrowDownOutline,
    };
  },
  computed: {
    filteredData() {
      let data = [...this.row_datas];
      // filter
      if (this.filterText) {
        const q = this.filterText.toLowerCase();
        data = data.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q) ||
          r.completePhoneNumber.includes(q)
        );
      }
      // sort
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
      // Request notification permission
      const perm = await LocalNotifications.checkPermissions();
      console.log('[NOTIF] Current permission:', JSON.stringify(perm));
      if (perm.display !== 'granted') {
        const reqResult = await LocalNotifications.requestPermissions();
        console.log('[NOTIF] Permission request result:', JSON.stringify(reqResult));
      }

      // Create notification channel for Android 8+
      try {
        await LocalNotifications.createChannel({
          id: 'search-updates',
          name: 'Search Updates',
          description: 'Notifications when search completes',
          importance: 5,
          visibility: 1,
          vibration: true,
        });
        console.log('[NOTIF] Channel "search-updates" created');
      } catch (chErr) {
        console.error('[NOTIF] Channel creation failed:', chErr);
      }

      // Listen for notifications while app is in foreground
      LocalNotifications.addListener('localNotificationReceived', (notification) => {
        console.log('[NOTIF] Received in foreground:', JSON.stringify(notification));
      });

      if (Capacitor.getPlatform() === 'android') {
        try {
          const mod = await import('@capawesome-team/capacitor-android-foreground-service');
          ForegroundService = mod.ForegroundService;
        } catch (e) {
          console.warn('Foreground service not available:', e);
        }
      }

      // Handle hardware back button
      App.addListener('backButton', async () => {
        if (this.detailOpen) {
          this.detailOpen = false;
        } else if (this.view === 'results') {
          this.newSearch();
        } else {
          const alert = await alertController.create({
            header: 'Exit App',
            message: 'Are you sure you want to exit the app?',
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
    toggleSortDir() {
      this.sortAsc = !this.sortAsc;
    },
    async startForegroundService() {
      if (!ForegroundService) return;
      try {
        await ForegroundService.startForegroundService({
          id: 1001,
          title: 'GlobexData',
          body: 'Searching for places data...',
          smallIcon: 'ic_stat_icon_config_sample',
        });
      } catch (e) {
        console.warn('Could not start foreground service:', e);
      }
    },
    async stopForegroundService() {
      if (!ForegroundService) return;
      try { await ForegroundService.stopForegroundService(); } catch (e) { /* ignore */ }
    },
    newSearch() {
      this.view = 'search';
      this.row_datas = [];
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
      this.searching = true;
      this.showShare = false;
      this.downloadedUri = null;
      await this.startForegroundService();

      if (Capacitor.isNativePlatform()) {
        const toast = await toastController.create({
          message: 'Searching in background... You can close the app.',
          duration: 5000, position: 'bottom', color: 'dark',
        });
        await toast.present();
      }

      try {
        this.row_datas = await search(this.input);
        if (Capacitor.isNativePlatform()) {
          try {
            const notifId = Math.floor(Math.random() * 2147483646) + 1;
            console.log('[NOTIF] Scheduling search complete notification, id:', notifId);
            const result = await LocalNotifications.schedule({
              notifications: [{
                title: 'Search Complete',
                body: `Found ${this.row_datas.length} results for "${this.input}"`,
                id: notifId,
                channelId: 'search-updates',
                smallIcon: 'ic_notification',
                autoCancel: true,
              }],
            });
            console.log('[NOTIF] Schedule result:', JSON.stringify(result));
          } catch (notifErr) {
            console.error('[NOTIF] Failed to send notification:', notifErr);
          }
        }
        if (this.row_datas.length > 0) {
          this.view = 'results';
        } else {
          const toast = await toastController.create({
            message: 'No results found.', duration: 3000, position: 'bottom', color: 'warning',
          });
          await toast.present();
        }
      } catch (error) {
        console.error('Search error:', error);
        const toast = await toastController.create({
          message: 'Search failed. Please try again.', duration: 3000, position: 'bottom', color: 'danger',
        });
        await toast.present();
      }

      this.searching = false;
      await this.stopForegroundService();
    },
    async downloadExcel() {
      try {
        const result = await makeExcel(this.row_datas, this.input);
        this.lastFilename = result.filename;
        if (Capacitor.isNativePlatform()) {
          this.showShare = true;
          this.downloadedUri = result.uri;
        }
        const toast = await toastController.create({
          message: 'Saved in Downloads', duration: 3000, position: 'bottom', color: 'success',
        });
        await toast.present();
      } catch (error) {
        console.error('Download error:', error);
        const toast = await toastController.create({
          message: 'Download failed. Try again.', duration: 3000, position: 'bottom', color: 'danger',
        });
        await toast.present();
      }
    },
    async openDownloadedFile() {
      try {
        await SaveToDownloads.openFile({ uri: this.downloadedUri });
      } catch (error) {
        console.error('Open file error:', error);
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
.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.brand-icon {
  width: 24px;
  height: 24px;
}

/* Search view */
.content-center {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 16px;
}
.search-container {
  width: 100%;
  max-width: 600px;
}
.action-buttons {
  margin-top: 12px;
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
  background: var(--ion-color-light);
  position: sticky;
  top: 0;
  z-index: 10;
}
.filter-search {
  flex: 1;
  --background: var(--ion-background-color);
  padding: 0 !important;
}
.sort-select {
  max-width: 120px;
  font-size: 14px;
}

.cards-container {
  padding: 8px;
}
.data-card {
  margin-bottom: 8px;
  cursor: pointer;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
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
  color: var(--ion-color-medium);
  font-size: 13px;
}
.card-address {
  color: var(--ion-color-medium);
  font-size: 13px;
  margin: 4px 0 8px;
}
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.no-results {
  text-align: center;
  padding: 40px 16px;
  color: var(--ion-color-medium);
}

.link-text {
  word-break: break-all;
}

/* Footer */
.social-links {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 8px 0;
}
.social-links a {
  color: var(--ion-color-medium);
  font-size: 24px;
  transition: opacity 0.2s;
}
.social-links a:hover {
  opacity: 0.7;
}
.footer-toolbar {
  --background: transparent;
}

.shake {
  animation: shake-animation 0.5s;
}
@keyframes shake-animation {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}
</style>
