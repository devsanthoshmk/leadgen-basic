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
          <div class="action-buttons">
            <ion-button :disabled="searching" @click="doSearch" expand="block" class="search-btn">
              <ion-spinner v-if="searching" name="crescent" slot="start"></ion-spinner>
              {{ searching ? 'Finding leads...' : 'Generate Leads' }}
            </ion-button>
          </div>
        </div>
        <div class="search-tags">
          <span class="tag" @click="input = 'Hotels in Bangalore'; doSearch()">Hotels in Bangalore</span>
          <span class="tag" @click="input = 'Cafes in Mumbai'; doSearch()">Cafes in Mumbai</span>
          <span class="tag" @click="input = 'Gyms in Hyderabad'; doSearch()">Gyms in Hyderabad</span>
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
      // icons
      logoGithub, logoLinkedin, logoInstagram, logoTwitter, shareSocialOutline,
      downloadOutline, arrowBackOutline,
      starIcon: starSharp, starOutlineIcon: starOutline,
      callOutline, globeOutline, openOutline, navigateOutline,
      arrowUpOutline, arrowDownOutline, informationCircleOutline, mailOutline,
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
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
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
        if (this.infoOpen) {
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
    toggleSortDir() {
      this.sortAsc = !this.sortAsc;
    },
    async startForegroundService() {
      if (!ForegroundService) return;
      try {
        await ForegroundService.startForegroundService({
          id: 1001,
          title: 'Mergex LeadGen',
          body: 'Finding leads for your sales pipeline...',
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
          message: 'Finding leads in background... You can close the app.',
          duration: 5000, position: 'bottom', color: 'dark',
        });
        await toast.present();
      }

      try {
        this.row_datas = await search(this.input);
        if (Capacitor.isNativePlatform()) {
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
      } catch (error) {
        console.error('Search error:', error);
        const toast = await toastController.create({
          message: 'Lead search failed. Please try again.', duration: 3000, position: 'bottom', color: 'danger',
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
.action-buttons {
  margin-top: 12px;
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
.search-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
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
}
.tag:hover {
  background: #252525;
  color: #E8FF00;
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
</style>
