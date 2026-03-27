/**
 * WordPressMadara Site Configurations
 *
 * Each entry is a config object that creates a full connector
 * via WPMadaraConnector. Sites only need to specify what differs
 * from the stock Madara theme defaults.
 *
 * Extracted from HakuNeko's WordPressMadara site definitions.
 * 88 total sites across multiple languages.
 */
import type { WPMadaraSiteConfig } from '../templates/types.js';

export const wpMadaraSites: WPMadaraSiteConfig[] = [
  // ═══════════════════════════════════════════════════════════════════
  //  English (en) sites
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'toonily',
    label: 'Toonily',
    url: 'https://toonily.com',
    language: 'en',
    // Custom: has queryTitleForURI override + cookie in HakuNeko
    queryTitleForURI: 'head meta[property="og:title"]',
  },
  {
    id: 'hiperdex',
    label: 'Hiperdex',
    url: 'https://hiperdex.com',
    language: 'en',
  },
  {
    id: 'manytoon',
    label: 'ManyToon (Porn)',
    url: 'https://manytoon.me',
    language: 'en',
  },
  {
    id: 's2manga',
    label: 'S2Manga',
    url: 'https://s2manga.com',
    language: 'en',
  },
  {
    id: 'isekaiscan',
    label: 'IsekaiScan.to',
    url: 'https://isekaiscan.to',
    language: 'en',
  },
  {
    id: 'allporncomic',
    label: 'AllPornComic',
    url: 'https://allporncomic.com',
    language: 'en',
  },
  {
    id: 'manhwahentaime',
    label: 'ManhwaHentai.me',
    url: 'https://manhwahentai.me',
    language: 'en',
  },
  {
    id: 'manhwafull',
    label: 'ManhwaFull',
    url: 'https://manhwafull.com',
    language: 'en',
  },
  {
    id: 'topmanhua',
    label: 'ManhuaTop',
    url: 'https://manhuatop.org',
    language: 'en',
  },
  {
    id: 'mangaclash',
    label: 'Manga Clash',
    url: 'https://mangaclash.com',
    language: 'en',
  },
  {
    id: 'heromanhua',
    label: 'HeroManhua/Leveler',
    url: 'https://levelerscans.xyz',
    language: 'en',
  },
  {
    id: 'mixedmanga',
    label: 'MixedManga',
    url: 'https://mixedmanga.com',
    language: 'en',
  },
  {
    id: 'lilymanga',
    label: 'Lily Manga',
    url: 'https://lilymanga.net',
    language: 'en',
  },
  {
    id: 'coffeemanga',
    label: 'Coffee Manga',
    url: 'https://coffeemanga.io',
    language: 'en',
  },
  {
    id: 'freemanga',
    label: 'Free Manga',
    url: 'https://freemanga.me',
    language: 'en',
  },
  {
    id: 'lordmanga',
    label: 'Lord Manga',
    url: 'https://lordmanga.com',
    language: 'en',
  },
  {
    id: 'zinmanga',
    label: 'Zin Manga',
    url: 'https://mangazin.org',
    language: 'en',
  },
  {
    id: 'instamanhwa',
    label: 'InstaManhwa',
    url: 'https://www.instamanhwa.com',
    language: 'en',
  },
  {
    id: 'immortalupdates',
    label: 'Immortal Updates',
    url: 'https://mortalsgroove.com',
    language: 'en',
  },
  {
    id: 'getmanhwa',
    label: 'GetManhwa',
    url: 'https://getmanhwa.co',
    language: 'en',
  },
  {
    id: 'coloredmanga',
    label: 'Colored Manga',
    url: 'https://coloredmanga.com',
    language: 'en',
  },
  {
    id: 'readmanhua',
    label: 'ReadManhua',
    url: 'https://readmanhua.net',
    language: 'en',
  },
  {
    id: 'manhwatop',
    label: 'MANHWATOP',
    url: 'https://manhwatop.com',
    language: 'en',
  },
  {
    id: 'manytooncom',
    label: 'ManyToon',
    url: 'https://manytoon.com',
    language: 'en',
  },
  {
    id: 'manhuafast',
    label: 'Manhuafast',
    url: 'https://manhuafast.com',
    language: 'en',
  },
  {
    id: 'mangafort',
    label: 'mangafort',
    url: 'https://mangafort.com',
    language: 'en',
  },
  {
    id: 'mangabob',
    label: 'MangaBob',
    url: 'https://mangabob.com',
    language: 'en',
  },
  {
    id: '1stkissmanhua',
    label: '1st Kiss Manhua',
    url: 'https://1stkissmanhua.com',
    language: 'en',
  },
  {
    id: 'toongod',
    label: 'ToonGod',
    url: 'https://www.toongod.com',
    language: 'en',
  },
  {
    id: 'toonilynet',
    label: 'Toonily.net',
    url: 'https://toonily.net',
    language: 'en',
  },
  {
    id: 'webtoonily',
    label: 'WebToonily',
    url: 'https://webtoonily.com',
    language: 'en',
  },
  {
    id: 'madaradex',
    label: 'MadaraDex',
    url: 'https://madaradex.org',
    language: 'en',
  },
  {
    id: 'skymanhwa',
    label: 'Skymanhwa',
    url: 'https://skymanhwa.com',
    language: 'en',
  },
  {
    id: 'manhwapool',
    label: 'ManhwaPool',
    url: 'https://manhwapool.com',
    language: 'en',
  },
  {
    id: 'manhwaworld',
    label: 'Manhwa World',
    url: 'https://manhwaworld.com',
    language: 'en',
  },
  {
    id: 'mangaread',
    label: 'MangaRead',
    url: 'https://www.mangaread.org',
    language: 'en',
  },
  {
    id: 'mangatx',
    label: 'Mangatx',
    url: 'https://mangatx.to',
    language: 'en',
  },
  {
    id: 'mangakio',
    label: 'Manga Kio',
    url: 'https://mangakio.com',
    language: 'en',
  },
  {
    id: 'fizmanga',
    label: 'FizManga',
    url: 'https://fizmanga.com',
    language: 'en',
  },
  {
    id: 'woopread',
    label: 'WoopRead',
    url: 'https://woopread.com',
    language: 'en',
  },
  {
    id: 'wordexcerpt',
    label: 'Word Excerpt',
    url: 'https://wordexcerpt.com',
    language: 'en',
  },
  {
    id: 'wordrain',
    label: 'Wordrain',
    url: 'https://wordrain69.com',
    language: 'en',
  },
  {
    id: 'manga68',
    label: 'Manga68',
    url: 'https://manga68.com',
    language: 'en',
  },
  {
    id: 'hmanhwa',
    label: 'HManhwa',
    url: 'https://hmanhwa.com',
    language: 'en',
  },
  {
    id: 'manhwaraw',
    label: 'Manhwa Raw',
    url: 'https://manhwaraw.com',
    language: 'en',
  },
  {
    id: 'manhwa68',
    label: 'Manhwa68',
    url: 'https://manhwa68.com',
    language: 'en',
  },
  {
    id: 'mangatoread',
    label: 'MangaToRead',
    url: 'https://mangatoread.com',
    language: 'en',
  },
  {
    id: 'mangakomi',
    label: 'Manga Komi',
    url: 'https://mangakomi.io',
    language: 'en',
  },
  {
    id: 'luxyscans',
    label: 'LuxyScans',
    url: 'https://luxyscans.com',
    language: 'en',
  },
  {
    id: 'mangachill',
    label: 'MangaChill',
    url: 'https://toonchill.com',
    language: 'en',
  },
  {
    id: 'mangarocky',
    label: 'Manga Rocky',
    url: 'https://mangarocky.com',
    language: 'en',
  },
  {
    id: 'mangazone',
    label: 'MangaZone',
    url: 'https://mangazone.cc',
    language: 'en',
  },
  {
    id: 'mangayuca',
    label: 'MangaYuca',
    url: 'https://mangayuca.com',
    language: 'en',
  },
  {
    id: 'mangagreat',
    label: 'MANGAGREAT',
    url: 'https://mangagreat.org',
    language: 'en',
  },
  {
    id: 'mangaowlio',
    label: 'MangaOwl.io',
    url: 'https://mangaowl.io',
    language: 'en',
  },
  {
    id: 'mangarawr',
    label: 'MangaRawr',
    url: 'https://mangarawr.com',
    language: 'en',
  },
  {
    id: 'mangasushi',
    label: 'Mangasushi',
    url: 'https://mangasushi.org',
    language: 'en',
  },
  {
    id: 'mangaturf',
    label: 'Manga Turf',
    url: 'https://mangaturf.com',
    language: 'en',
  },
  {
    id: 'mangawar',
    label: 'Manga War',
    url: 'https://mangawar.com',
    language: 'en',
  },
  {
    id: 'mangadods',
    label: 'MANGADODS',
    url: 'https://www.mangadods.com',
    language: 'en',
  },
  {
    id: 'aquamanga',
    label: 'AquaManga',
    url: 'https://aquamanga.com',
    language: 'en',
  },
  {
    id: 'skymanga',
    label: 'Sky Manga',
    url: 'https://skymanga.xyz',
    language: 'en',
  },
  {
    id: 'mangame',
    label: 'MangaMe',
    url: 'https://mangareading.org',
    language: 'en',
  },
  {
    id: 'mangacave',
    label: 'Manga Cave',
    url: 'https://mangacave.com',
    language: 'en',
  },
  {
    id: 'manhuaes',
    label: 'ManhuaES',
    url: 'https://manhuaes.com',
    language: 'en',
  },
  {
    id: 'manhuas',
    label: 'Manhuamix',
    url: 'https://manhuamix.com',
    language: 'en',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  Multi-language (multi) sites
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'manhwaclub',
    label: 'ManhwaClub',
    url: 'https://manhwaclub.net',
    language: 'multi',
  },
  {
    id: 'manhwa18cc',
    label: 'Manhwa 18 (.cc)',
    url: 'https://manhwa18.cc',
    language: 'multi',
    mangaPath: '/webtoons/',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  Turkish (tr) sites
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'goddessmanga',
    label: 'GoddessManga',
    url: 'https://goddessmanga.com',
    language: 'tr',
  },
  {
    id: 'glorymanga',
    label: 'GloryManga',
    url: 'https://glorymanga.com',
    language: 'tr',
  },
  {
    id: 'mangakitsu',
    label: 'Manga Kitsu',
    url: 'https://mangakitsu.com',
    language: 'tr',
  },
  {
    id: 'mangarose',
    label: 'MangaRose',
    url: 'https://mangarose.com',
    language: 'tr',
  },
  {
    id: 'mangawow',
    label: 'MangaWOW',
    url: 'https://mangawow.org',
    language: 'tr',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  Arabic (ar) sites
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'mangaaction',
    label: 'Manga Action',
    url: 'https://mangaaction.com',
    language: 'ar',
  },
  {
    id: 'mangastarz',
    label: 'Mangastarz',
    url: 'https://manga-starz.com',
    language: 'ar',
  },
  {
    id: 'mangaspark',
    label: 'MangaSpark',
    url: 'https://mangaspark.org',
    language: 'ar',
  },
  {
    id: 'mangalike',
    label: 'mangalike',
    url: 'https://mangalike.org',
    language: 'ar',
  },
  {
    id: 'mangalover',
    label: '3asq',
    url: 'https://3asq.org',
    language: 'ar',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  Spanish (es) sites
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'swordmanga',
    label: 'SwordManga',
    url: 'https://swordmanga.com',
    language: 'es',
  },
  {
    id: 'eromanhwas',
    label: 'Eromanhwas',
    url: 'https://eromanhwas.com',
    language: 'es',
  },
  {
    id: 'mangamonarca',
    label: 'Monarcamanga',
    url: 'https://monarcamanga.com',
    language: 'es',
  },
  {
    id: 'mangacrab',
    label: 'Manga Crab',
    url: 'https://mangacrab.com',
    language: 'es',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  Portuguese (pt) sites
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'mangaweebs',
    label: 'Manga Weebs',
    url: 'https://mangaweebs.in',
    language: 'pt',
  },
  {
    id: 'blmanhwaclub',
    label: 'BL Manhwa Club',
    url: 'https://blmanhwa.club',
    language: 'pt',
  },

  // ═══════════════════════════════════════════════════════════════════
  //  Indonesian (id) sites
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'manhwaid',
    label: 'Manhwaid',
    url: 'https://manhwaid.fun',
    language: 'id',
  },
  {
    id: 'mangareceh',
    label: 'MANGCEH',
    url: 'https://mangceh.me',
    language: 'id',
  },
  {
    id: 'komikgo',
    label: 'KomikGo',
    url: 'https://komikgo.com',
    language: 'id',
  },
];
