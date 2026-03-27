# Manga-Kindle

Self-hosted manga downloader and Kindle converter. Search manga from multiple sources, download chapters, and convert them to Kindle-compatible formats using [KCC (Kindle Comic Converter)](https://github.com/ciromattia/kcc).

Built with a HakuNeko-style connector architecture — adding new manga sources is as simple as extending a base class.

## Features

- **Multi-source search** — MangaDex, MangaSee, MangaKakalot (more coming)
- **Batch chapter downloads** — Select individual chapters or ranges, downloads run in the background
- **Kindle conversion** — Convert downloaded manga to EPUB, MOBI, AZW3, CBZ, or PDF via KCC
- **Device profiles** — Optimize output for Kindle Paperwhite, Oasis, Scribe, Kobo, and more
- **Real-time progress** — WebSocket-powered live updates for downloads and conversions
- **File downloads** — Download converted files directly from the browser
- **Dark UI** — Clean dark theme with orange accents
- **Docker ready** — Single-container deployment with docker-compose

## Tech Stack

| Layer     | Technology                                     |
| --------- | ---------------------------------------------- |
| Frontend  | Next.js 14, React 18, Tailwind CSS             |
| Backend   | Express, Prisma (SQLite), WebSocket (ws)       |
| Scraper   | Custom connector engine, Cheerio, undici        |
| Converter | KCC (kcc-c2e) — Python CLI                      |
| Infra     | Docker, npm workspaces monorepo                |

## Prerequisites

- **Node.js** >= 18
- **Python 3** + pip (for KCC)
- **KCC** — `pip install kindle-comic-converter`

Or just use Docker (see below).

## Quick Start

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

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker

```bash
# Build and start
docker-compose up -d

# Or build manually
docker build -t manga-kindle .
docker run -p 3000:3000 -p 3001:3001 -v manga-data:/data manga-kindle
```

## Project Structure

```
manga-kindle/
├── packages/
│   ├── scraper/          # Connector engine + manga source connectors
│   │   └── src/
│   │       ├── engine/       # BaseConnector abstract class
│   │       ├── connectors/   # MangaDex, MangaSee, MangaKakalot
│   │       └── index.ts      # ScraperEngine singleton
│   ├── api/              # Express REST API + WebSocket server
│   │   ├── prisma/           # Schema + SQLite database
│   │   └── src/
│   │       ├── routes/       # sources, manga, downloads, conversions
│   │       ├── services/     # download-service, conversion-service, websocket
│   │       └── middleware/   # error handler
│   └── web/              # Next.js frontend
│       └── src/
│           ├── app/          # Pages: search, manga detail, downloads, conversions
│           ├── components/   # Sidebar, MangaCard, ChapterList, ProgressBar, StatusBadge
│           └── lib/          # API client, WebSocket hook
├── Dockerfile
├── docker-compose.yml
└── package.json          # Workspace root
```

## API Endpoints

| Method   | Endpoint                                  | Description                     |
| -------- | ----------------------------------------- | ------------------------------- |
| `GET`    | `/api/health`                             | Health check                    |
| `GET`    | `/api/sources`                            | List available manga sources    |
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
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001`     | API URL for frontend proxy          |

## Manga Sources

| Source       | Search | Detail | Pages | Notes                                    |
| ------------ | ------ | ------ | ----- | ---------------------------------------- |
| MangaDex     | Yes    | Yes    | Yes   | Official API, no scraping needed          |
| MangaSee     | Yes    | Yes    | Yes   | Client-side search via vm.Directory cache |
| MangaKakalot | Yes    | Yes    | Yes   | HTML scraping, supports two domains       |

### Adding a New Source

1. Create `packages/scraper/src/connectors/your-source.ts`
2. Extend `BaseConnector` and implement `search()`, `getMangaDetail()`, `getChapterPages()`
3. Register in `packages/scraper/src/index.ts`
4. (Optional) Add CDN hostnames to `packages/web/next.config.js` remote patterns

## Scripts

```bash
npm run dev           # Start API + Web in development
npm run build         # Build all packages
npm run typecheck     # Run TypeScript type checking
npm run db:push       # Push Prisma schema to database
npm run db:studio     # Open Prisma Studio (database GUI)
npm run clean         # Remove build artifacts and caches
```

## License

MIT
