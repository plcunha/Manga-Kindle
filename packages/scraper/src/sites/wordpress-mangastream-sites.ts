/**
 * WordPressMangastream Site Configurations
 *
 * Each entry is a config object that creates a full connector
 * via WPMangastreamConnector. Sites only need to specify what
 * differs from the Themesia MangaStream theme defaults.
 *
 * To add a new site: add an entry to this array with at minimum
 * { id, label, url }. All selectors default to the stock theme.
 */
import type { WPMangastreamSiteConfig } from '../templates/types.js';

export const wpMangastreamSites: WPMangastreamSiteConfig[] = [
  // ─── Asura Scans ─────────────────────────────────────────────────
  // One of the largest English webtoon scan groups.
  // Changes domains frequently — update url as needed.
  {
    id: 'asurascans',
    label: 'Asura Scans',
    url: 'https://asurascanscomic.net',
    path: '/manga/list-mode/',
    queryPages: 'div#readerarea p img, div#readerarea img[src]:not([src=""])',
    pageExcludes: [
      /panda_gif_large/i,
      /ENDING-PAGE/i,
      /EndDesignPSD/i,
    ],
    headers: {
      'x-user-agent':
        'Mozilla/5.0 (Linux; Android 9; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4026.0 Mobile Safari/537.36',
    },
  },

  // ─── Luminous Scans ──────────────────────────────────────────────
  {
    id: 'luminousscans',
    label: 'Luminous Scans',
    url: 'https://luminousscans.gg',
    path: '/series/list-mode/',
    queryChapters: 'div#chapterlist ul li a',
    pageExcludes: [/\/NovelBanner[^.]+\.(png|jpeg|jpg|gif)$/i],
  },

  // ─── Manhwa Freak ────────────────────────────────────────────────
  {
    id: 'manhwafreak',
    label: 'ManhwaFreak',
    url: 'https://manhwa-freak.org',
    path: '/manga/',
    queryMangas: 'div.lastest-serie > a',
    queryChapters: 'div.chapter-li > a',
    queryChaptersTitle: 'div.chapter-info > p',
    pageExcludes: [/ajax-loader/, /\/100\.5\.gif$/],
  },

  // ─── Night Scans ─────────────────────────────────────────────────
  {
    id: 'nightscans',
    label: 'Night Scans',
    url: 'https://nightscans.org',
    path: '/manga/list-mode/',
  },

  // ─── Realm Scans ─────────────────────────────────────────────────
  {
    id: 'realmscans',
    label: 'Realm Scans',
    url: 'https://realmscans.to',
    path: '/manga/list-mode/',
  },

  // ─── Manga Galaxy ────────────────────────────────────────────────
  {
    id: 'mangagalaxy',
    label: 'Manga Galaxy',
    url: 'https://mangagalaxy.me',
    path: '/manga/list-mode/',
  },

  // ─── Infernal Void Scans ─────────────────────────────────────────
  {
    id: 'infernalvoidscans',
    label: 'Infernal Void Scans',
    url: 'https://infernalvoidscans.com',
    path: '/manga/list-mode/',
  },

  // ─── Drake Scans ─────────────────────────────────────────────────
  {
    id: 'drakescans',
    label: 'Drake Scans',
    url: 'https://drakescans.com',
    path: '/manga/list-mode/',
  },
];
