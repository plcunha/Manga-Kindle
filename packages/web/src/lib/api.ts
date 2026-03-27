const API_BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `API error: ${res.status}`);
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────

export interface Source {
  id: string;
  name: string;
  url: string;
  language: string;
  nsfw: boolean;
}

export interface MangaInfo {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  authors?: string[];
  genres?: string[];
  status?: string;
  url?: string;
}

export interface ChapterInfo {
  id: string;
  title?: string;
  chapter?: string;
  volume?: string;
  language: string;
  pages: number;
  publishedAt?: string;
  url?: string;
}

export interface PageInfo {
  url: string;
  headers?: Record<string, string>;
}

export interface DownloadJob {
  id: string;
  mangaId: string;
  sourceId: string;
  status: string;
  progress: number;
  totalPages: number;
  downloadedPages: number;
  outputDir: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  manga?: {
    title: string;
    coverUrl: string | null;
  };
}

export interface ConversionJob {
  id: string;
  downloadJobId: string;
  status: string;
  progress: number;
  format: string;
  deviceProfile: string;
  outputPath: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  downloadJob?: DownloadJob;
}

export interface DeviceProfile {
  id: string;
  name: string;
  width: number;
  height: number;
}

// ── Sources ────────────────────────────────────────────

export function getSources(): Promise<Source[]> {
  return request<{ sources: Source[] }>("/sources").then((r) => r.sources);
}

export function getSource(id: string): Promise<Source> {
  return request<{ source: Source }>(`/sources/${id}`).then((r) => r.source);
}

// ── Manga ──────────────────────────────────────────────

export function searchManga(
  sourceId: string,
  query: string,
): Promise<MangaInfo[]> {
  return request<{ results: MangaInfo[] }>(
    `/manga/search?source=${encodeURIComponent(sourceId)}&q=${encodeURIComponent(query)}`,
  ).then((r) => r.results);
}

export function getMangaDetail(
  sourceId: string,
  mangaId: string,
): Promise<{ manga: MangaInfo; chapters: ChapterInfo[] }> {
  return request(`/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(mangaId)}`);
}

export function getChapterPages(
  sourceId: string,
  mangaId: string,
  chapterId: string,
): Promise<PageInfo[]> {
  return request<{ pages: PageInfo[] }>(
    `/manga/${encodeURIComponent(sourceId)}/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}/pages`,
  ).then((r) => r.pages);
}

// ── Downloads ──────────────────────────────────────────

export function getDownloads(): Promise<DownloadJob[]> {
  return request<{ jobs: DownloadJob[] }>("/downloads").then((r) => r.jobs);
}

export function getDownload(id: string): Promise<DownloadJob> {
  return request<{ job: DownloadJob }>(`/downloads/${id}`).then((r) => r.job);
}

export function startDownload(body: {
  sourceId: string;
  mangaId: string;
  mangaTitle: string;
  mangaCoverUrl?: string;
  chapterIds: string[];
}): Promise<DownloadJob> {
  return request<{ job: DownloadJob }>("/downloads", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.job);
}

export function cancelDownload(id: string): Promise<void> {
  return request(`/downloads/${id}`, { method: "DELETE" });
}

// ── Conversions ────────────────────────────────────────

export function getConversions(): Promise<ConversionJob[]> {
  return request<{ jobs: ConversionJob[] }>("/conversions").then((r) => r.jobs);
}

export function getConversion(id: string): Promise<ConversionJob> {
  return request<{ job: ConversionJob }>(`/conversions/${id}`).then((r) => r.job);
}

export function startConversion(body: {
  downloadJobId: string;
  format?: string;
  deviceProfile?: string;
  mangaMode?: boolean;
  title?: string;
}): Promise<ConversionJob> {
  return request<{ job: ConversionJob }>("/conversions", {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.job);
}

export function cancelConversion(id: string): Promise<void> {
  return request(`/conversions/${id}`, { method: "DELETE" });
}

export function getDeviceProfiles(): Promise<DeviceProfile[]> {
  return request<{ profiles: DeviceProfile[] }>("/conversions/profiles").then((r) => r.profiles);
}

export function downloadConvertedFile(id: string): void {
  // Trigger a browser download via a direct link (no fetch needed)
  window.open(`${API_BASE}/conversions/${encodeURIComponent(id)}/download`, "_blank");
}

// ── Settings ───────────────────────────────────────────

export function getSettings(): Promise<Record<string, string>> {
  return request<{ settings: Record<string, string> }>("/settings").then(
    (r) => r.settings,
  );
}

export function updateSettings(
  settings: Record<string, string>,
): Promise<Record<string, string>> {
  return request<{ settings: Record<string, string> }>("/settings", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  }).then((r) => r.settings);
}
