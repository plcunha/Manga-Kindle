# Manga-Kindle

Self-hosted manga downloader and Kindle converter. Search manga from **134 sources**, download chapters, and convert them to Kindle-compatible formats using [KCC (Kindle Comic Converter)](https://github.com/ciromattia/kcc).

Built with a template-based connector architecture inspired by HakuNeko — 7 reusable templates cover 130 sites, plus 4 hand-written connectors for major sources.

## Features

- **134 manga sources** — MangaDex, AsuraScans, WeebCentral, MangaKakalot, plus 130 template-based sites (WordPress Madara, Mangastream, FoolSlide, MadTheme, MangaReaderCMS, FlatManga, Genkan)
- **Multi-language** — English, Portuguese, Spanish, Turkish, Arabic, Indonesian, and more
- **Batch chapter downloads** — Select individual chapters or ranges, downloads run in the background
- **Kindle conversion** — Convert downloaded manga to EPUB, MOBI, AZW3, CBZ, or PDF via KCC
- **10 device profiles** — Kindle Paperwhite 5, Oasis 2/3, Scribe, Kobo Libra/Clara/Sage, and more
- **Real-time progress** — WebSocket-powered live updates for downloads and conversions
- **Cloudflare bypass** — Automatic FlareSolverr fallback with per-domain cookie caching (15 min TTL)
- **File downloads** — Download converted files directly from the browser
- **Dark UI** — Clean dark theme with orange accents
- **Docker ready** — Single-container deployment with FlareSolverr sidecar

## Connector Architecture

| Category | Template | Sites | Notes |
|----------|----------|-------|-------|
| **Hand-written** | — | 4 | MangaDex (API), WeebCentral (HTMX), MangaKakalot (HTML), AsuraScans (Astro JSON) |
| **WordPress Madara** | `wordpress-madara.ts` | 87 | 3-tier chapter fetch (DOM, ajax/chapters, admin-ajax.php) |
| **WordPress Mangastream** | `wordpress-mangastream.ts` | 7 | ts_reader JSON extraction with DOM fallback |
| **FoolSlide** | `foolslide.ts` | 9 | POST adult=true, pages from `var pages=[]` or base64 |
| **MadTheme** | `madtheme.ts` | 8 | API-based chapters, JS variable page extraction |
| **MangaReaderCMS** | `mangareadercms.ts` | 6 | AJAX listing, base64 URL decoding |
| **FlatManga** | `flatmanga.ts` | 6 | AZ listing, base64 data-attribute decoding |
| **Genkan** | `genkan.ts` | 7 | Paginated /comics, JS variable extraction |
| | | **134** | |

See [docs/template-system.md](docs/template-system.md) for the full architecture and site list.

## Tech Stack

| Layer     | Technology                                     |
| --------- | ---------------------------------------------- |
| Frontend  | Next.js 14, React 18, Tailwind CSS             |
| Backend   | Express, Prisma (SQLite), WebSocket (ws)       |
| Scraper   | Template engine + BaseConnector, Cheerio, undici |
| CF Bypass | FlareSolverr (optional, auto-detected)         |
| Converter | KCC (kcc-c2e) — Python CLI                      |
| Infra     | Docker, npm workspaces monorepo                |

## Prerequisites

- **Node.js** >= 18
- **Python 3** + pip (for KCC)
- **KCC** — `pip install kindle-comic-converter`
- **FlareSolverr** (optional) — for Cloudflare-protected sites

Or just use Docker (see below).

## Quick Start

### Docker (Recommended)

```bash
# Clone
git clone https://github.com/your-username/Manga-Kindle.git
cd Manga-Kindle

# Copy environment config
cp .env.example .env

# Build and start (includes FlareSolverr)
docker-compose up -d

# Check health
curl http://localhost:3001/api/health
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Local Development

```bash
# Clone
git clone https://github.com/your-username/Manga-Kindle.git
cd Manga-Kindle

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Push database schema (creates SQLite DB)
npm run db:push

# Start dev servers (API on :3001, Web on :3000)
npm run dev
```

#### Optional: FlareSolverr for Cloudflare-protected sites

```bash
docker run -d --name flaresolverr -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest

# Set env var
export FLARESOLVERR_URL=http://localhost:8191/v1
```

See [docs/flaresolverr-setup.md](docs/flaresolverr-setup.md) for detailed setup.

## Project Structure

```
manga-kindle/
├── packages/
│   ├── scraper/          # Connector engine + 134 manga source connectors
│   │   └── src/
│   │       ├── engine/       # BaseConnector (fetchText/fetchJSON + CF fallback)
│   │       ├── connectors/   # 4 hand-written: MangaDex, WeebCentral, MangaKakalot, AsuraScans
│   │       ├── templates/    # 7 reusable templates (WP Madara, Mangastream, etc.)
│   │       ├── sites/        # 130 site configs (one file per template type)
│   │       └── index.ts      # ScraperEngine singleton (registers all 134 sources)
│   ├── api/              # Express REST API + WebSocket server
│   │   ├── prisma/           # Schema + SQLite database
│   │   └── src/
│   │       ├── routes/       # sources, manga, downloads, conversions, settings, image-proxy
│   │       ├── services/     # download-service, conversion-service, websocket
│   │       └── middleware/   # error handler
│   └── web/              # Next.js frontend
│       └── src/
│           ├── app/          # Pages: search, manga detail, downloads, conversions, settings
│           ├── components/   # Sidebar, MangaCard, ChapterList, ProgressBar, StatusBadge
│           └── lib/          # API client, WebSocket hook
├── docs/                 # Architecture docs, setup guides
├── Dockerfile            # Multi-stage build (node:18-alpine + KCC)
├── docker-compose.yml    # App + FlareSolverr sidecar
└── package.json          # Workspace root
```

## API Endpoints

| Method   | Endpoint                                  | Description                     |
| -------- | ----------------------------------------- | ------------------------------- |
| `GET`    | `/api/health`                             | Health check                    |
| `GET`    | `/api/sources`                            | List all 134 manga sources      |
| `GET`    | `/api/sources?language=en`                | Filter sources by language       |
| `GET`    | `/api/sources/:id`                        | Get source details              |
| `GET`    | `/api/manga/search?source=&q=`            | Search manga by source          |
| `GET`    | `/api/manga/:sourceId/:mangaId`           | Get manga detail + chapters     |
| `GET`    | `/api/manga/:sourceId/:mangaId/:chId/pages` | Get chapter page URLs         |
| `GET`    | `/api/downloads`                          | List download jobs              |
| `POST`   | `/api/downloads`                          | Start a new download            |
| `DELETE` | `/api/downloads/:id`                      | Cancel a download               |
| `GET`    | `/api/conversions`                        | List conversion jobs            |
| `POST`   | `/api/conversions`                        | Start a new conversion          |
| `GET`    | `/api/conversions/profiles`               | List KCC device profiles        |
| `GET`    | `/api/conversions/:id/download`           | Download converted file         |
| `DELETE` | `/api/conversions/:id`                    | Cancel a conversion             |

## Device Profiles

| Profile | Device | Resolution |
|---------|--------|------------|
| `KPW5` | Kindle Paperwhite 5 | 1236x1648 |
| `KO` | Kindle Oasis 2/3 | 1264x1680 |
| `KS` | Kindle Scribe | 1860x2480 |
| `KV` | Kindle Voyage | 1072x1448 |
| `K11` | Kindle 11th Gen | 1072x1448 |
| `KoL` | Kobo Libra H2O | 1264x1680 |
| `KoC` | Kobo Clara HD | 1072x1448 |
| `KoS` | Kobo Sage | 1440x1920 |
| `KoF` | Kobo Forma | 1440x1920 |
| `OTHER` | Generic (custom) | — |

## Output Formats

| Format | Extension | Notes |
|--------|-----------|-------|
| EPUB | `.epub` | Universal e-reader format |
| MOBI | `.mobi` | Legacy Kindle format |
| AZW3 | `.azw3` | Modern Kindle format (recommended) |
| CBZ | `.cbz` | Comic book archive |
| PDF | `.pdf` | Fixed layout |

## Environment Variables

| Variable              | Default                     | Description                         |
| --------------------- | --------------------------- | ----------------------------------- |
| `PORT`                | `3001`                      | API server port                     |
| `NODE_ENV`            | `development`               | Environment mode                    |
| `DATABASE_URL`        | `file:./manga-kindle.db`   | SQLite database path (Prisma)       |
| `DOWNLOAD_DIR`        | `./downloads`               | Chapter image download directory    |
| `CONVERTED_DIR`       | `./converted`               | KCC output directory                |
| `TEMP_DIR`            | `./temp`                    | Temporary files directory           |
| `KCC_PATH`            | `/usr/local/bin/kcc-c2e`    | Path to KCC CLI binary              |
| `KCC_DEVICE_PROFILE`  | `KPW5`                      | Default Kindle device profile       |
| `RATE_LIMIT_MS`       | `1000`                      | Delay between requests per source   |
| `FLARESOLVERR_URL`    | —                           | FlareSolverr endpoint (e.g. `http://localhost:8191/v1`) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`     | API URL for frontend proxy          |

## Adding New Sources

### Option 1: Add a site to an existing template (5 min)

If the site uses WordPress Madara, Mangastream, FoolSlide, etc., just add a config entry:

```typescript
// packages/scraper/src/sites/wordpress-madara-sites.ts
{
  id: 'mysite',
  name: 'My Site',
  url: 'https://mysite.com',
  language: 'en',
  // Optional overrides for selectors, paths, etc.
}
```

### Option 2: Create a new hand-written connector

1. Create `packages/scraper/src/connectors/your-source.ts`
2. Extend `BaseConnector` and implement `search()`, `getMangaDetail()`, `getChapterPages()`
3. Register in `packages/scraper/src/index.ts`
4. (Optional) Add CDN hostnames to `packages/web/next.config.js` remote patterns

### Option 3: Create a new template

See [docs/template-system.md](docs/template-system.md) for the full guide.

## Scripts

```bash
npm run dev           # Start API + Web in development
npm run build         # Build all packages
npm run typecheck     # Run TypeScript type checking
npm run db:push       # Push Prisma schema to database
npm run db:studio     # Open Prisma Studio (database GUI)
npm run clean         # Remove build artifacts and caches
```

## Documentation

| Doc | Description |
|-----|-------------|
| [Template System](docs/template-system.md) | Architecture, template types, site configs, how to add sites |
| [Connector Strategy](docs/connector-strategy.md) | Sustainability plan, health checks, emergency procedures |
| [FlareSolverr Setup](docs/flaresolverr-setup.md) | Cloudflare bypass configuration and troubleshooting |
| [Puppeteer vs FlareSolverr](docs/puppeteer-vs-flaresolverr.md) | Decision rationale for choosing FlareSolverr |

## License

MIT
