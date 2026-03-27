/**
 * Configuration types for template-based connectors.
 * Each template defines a SiteConfig shape, and sites are
 * registered as simple config objects instead of full classes.
 */

/**
 * Base config shared by all template-based sites.
 */
export interface BaseSiteConfig {
  /** Unique site identifier (e.g. 'asurascans') */
  id: string;
  /** Human-readable label (e.g. 'Asura Scans') */
  label: string;
  /** Site base URL (e.g. 'https://asuratoon.com') */
  url: string;
  /** Language tag (default: 'en') */
  language?: string;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Config for WordPressMangastream-based sites.
 *
 * Mirrors HakuNeko's template: sites override selectors in constructor.
 * Defaults are provided for all selectors matching the Themesia
 * MangaStream WordPress theme.
 */
export interface WPMangastreamSiteConfig extends BaseSiteConfig {
  /** Path to the manga list page (default: '/manga/list-mode/') */
  path?: string;

  // --- Selectors (all have sensible defaults) ---

  /** CSS selector for manga links on the list page */
  queryMangas?: string;
  /** CSS selector for chapter links on the manga page */
  queryChapters?: string;
  /** CSS selector for chapter title within each chapter link */
  queryChaptersTitle?: string;
  /** CSS selector for image elements on the reader page */
  queryPages?: string;
  /** CSS selector for the manga title on its page (used for search-by-URL) */
  queryMangaTitle?: string;

  // --- Search ---

  /** Search URL path (default: '/' with ?s= query param) */
  searchPath?: string;
  /** CSS selector for search result links */
  querySearchResults?: string;
  /** CSS selector for cover image on search results */
  querySearchCover?: string;

  // --- Manga detail page selectors ---

  /** CSS selector for cover image on manga detail page */
  queryCover?: string;
  /** CSS selector for synopsis on manga detail page */
  querySynopsis?: string;

  // --- Custom page extraction ---

  /**
   * Regex patterns to filter out non-content images (ads, banners).
   * Images matching any of these patterns are excluded.
   */
  pageExcludes?: RegExp[];

  /**
   * Custom headers to send with requests.
   */
  headers?: Record<string, string>;
}

/**
 * Config for WordPressMadara-based sites.
 *
 * Mirrors HakuNeko's Madara template: pagination via admin-ajax.php,
 * 3-tier chapter fetching (DOM → new AJAX → old AJAX), page extraction
 * with ?style=list, CDN stripping, and webpc-passthru handling.
 */
export interface WPMadaraSiteConfig extends BaseSiteConfig {
  /**
   * Manga list path override. If set, the connector fetches the flat
   * list at this URL instead of using paginated admin-ajax.php.
   * (default: undefined → uses paginated POST)
   */
  path?: string;

  /**
   * Subpath appended after the manga slug for the web reader.
   * Some sites use '/manga/' others use '/webtoons/', etc.
   * (default: '/manga/')
   */
  mangaPath?: string;

  // --- Selectors (all have sensible defaults) ---

  /** CSS selector for manga links on the paginated list */
  queryMangas?: string;

  /** CSS selector for chapter links on the manga page */
  queryChapters?: string;

  /** CSS selector for bloat elements inside chapter title to remove */
  queryChaptersTitleBloat?: string;

  /**
   * CSS selector to detect the AJAX chapters placeholder.
   * If this element exists, chapters must be fetched via AJAX.
   * (default: '[id^="manga-chapters-holder"][data-id]')
   */
  queryPlaceholder?: string;

  /** CSS selector for page images on the reader page */
  queryPages?: string;

  /** CSS selector for the manga title (via og:title meta tag) */
  queryTitleForURI?: string;

  // --- Search ---

  /** Search URL path (default: '/' with ?s= query param and post_type=wp-manga) */
  searchPath?: string;
  /** CSS selector for search result links */
  querySearchResults?: string;
  /** CSS selector for cover image on search results */
  querySearchCover?: string;

  // --- Manga detail page selectors ---

  /** CSS selector for cover image on manga detail page */
  queryCover?: string;
  /** CSS selector for synopsis on manga detail page */
  querySynopsis?: string;

  // --- Custom page extraction ---

  /**
   * Regex patterns to filter out non-content images (ads, banners).
   */
  pageExcludes?: RegExp[];

  /**
   * Custom headers to send with requests (e.g., cookies).
   */
  headers?: Record<string, string>;

  /**
   * Posts per page for paginated manga list fetch.
   * (default: 250)
   */
  postsPerPage?: number;
}
