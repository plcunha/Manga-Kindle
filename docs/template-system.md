# Sistema de Templates - Arquitetura de Conectores

## Visao Geral

O Manga-Kindle usa um sistema de templates para suportar 134 fontes de manga com codigo minimo. Em vez de escrever um conector completo para cada site, identificamos padroes comuns entre CMS de manga e criamos 7 templates reutilizaveis.

```
BaseConnector (abstract)
├── Hand-written connectors (4)
│   ├── MangaDex       — API oficial v5, sem scraping
│   ├── WeebCentral    — HTMX POST search, Cheerio
│   ├── MangaKakalot   — HTML scraping, dual domain (mk:/mn:)
│   └── AsuraScans     — Extrai JSON embutido do Astro HTML
│
└── Template connectors (130)
    ├── WordPressMadara      (87 sites)
    ├── WordPressMangastream (7 sites)
    ├── FoolSlide            (9 sites)
    ├── MadTheme             (8 sites)
    ├── MangaReaderCMS       (6 sites)
    ├── FlatManga            (6 sites)
    └── Genkan               (7 sites)
```

## Como Funciona

### 1. BaseConnector

Classe abstrata que todas as fontes estendem. Fornece:

- `fetchText(url)` — HTTP GET com fallback automatico para FlareSolverr em 403/503
- `fetchJSON(url)` — Mesmo, mas parseia JSON
- Cache de cookies Cloudflare por dominio (15 min TTL)
- Headers padrao (User-Agent, Accept, etc.)
- Rate limiting configuravel

**Arquivo:** `packages/scraper/src/engine/base-connector.ts`

### 2. Templates

Cada template estende BaseConnector e implementa a logica de scraping para um tipo de CMS. Um template recebe uma **config de site** que define URLs, seletores CSS e comportamentos especificos.

**Arquivo base:** `packages/scraper/src/templates/<template>.ts`

### 3. Site Configs

Arrays de configuracao que definem cada site individual. Minimo necessario: `id`, `name`, `url`.

**Arquivo:** `packages/scraper/src/sites/<template>-sites.ts`

### 4. Registro

O `ScraperEngine` (singleton) registra todos os conectores na importacao:

```typescript
// packages/scraper/src/index.ts
// 4 hand-written
engine.register(new MangaDex());
engine.register(new WeebCentral());
// ...

// 130 template-based (loop por cada site config)
for (const site of wordpressMadaraSites) {
  engine.register(new WordPressMadara(site));
}
```

---

## Templates em Detalhe

### WordPress Madara (87 sites)

**O mais usado.** Suporta a maioria dos sites de manga/manhwa.

**Estrategia de chapter fetch (3 camadas):**
1. DOM scraping da pagina do manga (`?style=list`)
2. POST para `ajax/chapters/` (endpoint nativo do Madara)
3. POST para `wp-admin/admin-ajax.php` com action `manga_get_chapters` (fallback)

**Features:**
- Suporte a paginas com `?style=list` para lista completa de capitulos
- Deteccao de imagens WebP com `webpc-passthru`
- Stripping de CDN proxy URLs
- Suporte a multiplos idiomas (en, pt, es, tr, ar, id)

**Config interface:**
```typescript
interface WPMadaraSiteConfig extends BaseSiteConfig {
  path?: string;              // Path para lista de manga (default: '/manga/')
  chapterEndpoint?: string;   // 'ajax' | 'admin-ajax' | 'auto'
  useStyleList?: boolean;     // Adiciona ?style=list (default: true)
  mangaListSelector?: string; // Seletor CSS para items da lista
}
```

**Sites notaveis:** Toonily, Hiperdex, ManyToon, S2Manga, 1stKissManga

---

### WordPress Mangastream (7 sites)

**Para sites que usam o tema Flavor/flavor + ts_reader.**

**Estrategia:**
- Busca: scraping de pagina de search ou sitemap
- Capitulos: DOM scraping da pagina do manga
- Paginas: Extrai JSON de `ts_reader.run({...})` com fallback para DOM

**Features:**
- Extrai imagens do objeto JSON do ts_reader
- Filtra tracking pixels (histats.com)
- Stripping de CDN proxy URLs

**Sites:** Luminous Scans, ManhwaFreak, Night Scans, Realm Scans, MangaGalaxy, InfernalVoid, Drake Scans

---

### FoolSlide (9 sites)

**Para sites que usam o CMS FoolSlide (mais antigo).**

**Estrategia:**
- Busca: pesquisa HTML na pagina de search
- Capitulos: DOM scraping
- Paginas: Extrai de `var pages = [...]` no JavaScript ou `JSON.parse(atob("..."))`

**Features:**
- POST com `adult=true` para conteudo adulto
- Decodificacao base64 de dados de paginas
- Suporte a leitores embutidos

**Sites:** Sense Scans, Silent Sky, Death Toll Scanlations, etc.

---

### MadTheme (8 sites)

**Para sites que usam o tema MadTheme com API interna.**

**Estrategia:**
- Busca: HTTP GET na pagina de search
- Capitulos: API interna `/api/manga/{slug}/chapters`
- Paginas: Extrai de `window.chapImages` + `window.mainServer` no JavaScript

**Features:**
- API estruturada para capitulos (mais confiavel que DOM)
- Combinacao de server base + image paths no JS

**Sites:** MangaBuddy, MangaForest, MangaMirror, etc.

---

### MangaReaderCMS (6 sites)

**Para sites que usam o CMS MangaReader.**

**Estrategia:**
- Busca: AJAX via `/changeMangaList`
- Capitulos: DOM scraping
- Paginas: Decodificacao base64 de URLs com stripping de protocolo

**Features:**
- Listagem AJAX com filtros
- URLs de imagem codificadas em base64
- Suporte a NineManga em multiplos idiomas (EN, ES, PT)

**Sites:** MangaReader.net, ReadMng, NineManga (EN/ES/PT), etc.

---

### FlatManga (6 sites)

**Para sites tipo Manganelo/Manganato.**

**Estrategia:**
- Busca: pesquisa HTTP ou listagem A-Z
- Capitulos: DOM scraping
- Paginas: Decodificacao de atributos base64 (`data-aload`, `data-src`, etc.)

**Features:**
- Listagem alfabetica (A-Z) como alternativa a busca
- Multiplos atributos de dados para imagens (fallback chain)
- Blacklist de fragmentos de URL (ads, tracking)

**Sites:** MangaKakalots.com, Manganelo, Manganato, MangaBat, etc.

---

### Genkan (7 sites)

**Para sites que usam o CMS Genkan (grupos de scanlation).**

**Estrategia:**
- Busca: paginacao por `/comics?page=N`
- Capitulos: DOM scraping
- Paginas: Extrai de variavel JavaScript `chapterPages`

**Features:**
- Paginacao automatica da lista de comics
- Extracao de variavel JS para URLs de paginas

**Sites:** Leviatan Scans, Reaper Scans, Zero Scans, Method Scans, etc.

> **Aviso:** Muitos sites Genkan migraram ou fecharam. Verificar status antes de usar.

---

## Lista Completa de Sites por Template

### WordPress Madara (87 sites)

**English:**
Toonily, Hiperdex, ManyToon, S2Manga, 1stKissManga, Manga347, MangaHaus, TopManhua, MangaSY, Manga68, Manhwa18, Manhwa68, MangaTX, IsekaiScan, MangaOwl, AquaManga, MangaFox.fun, MangaChill, WebtoonXYZ, DisasterScans, ManhuaPlus, ManhuaScan, ComickFun, LoveHeaven, MangaBob, Manhwa18.cc, MangaKomi, LikeManga, MangaRolls, MangaBuddy, ResetScans, CoffeeManga, FlameScans, AsuraScans.gg, CosmicScans, NightComic, SuryaScans, LuminousScans.gg

**Multi-language:**
MangaGenki, ShojoSense

**Turkish:**
MangaTR, TurkceManga, WebtoonTR, MangaCim, SeriManga, ArenaManga, GolgeManga, MangaDenizi, WebtoonHatti, MangaVadisi

**Arabic:**
MangaArabTeam, TeamX, AzoraWorld, MangaSwat, MangaProtector, ArabsManga

**Spanish:**
InManga, TuMangaOnline, MundoManhwa, MangaES, HentaiLA, TempleScan

**Portuguese:**
MangaLivre.net, YaoiToshokan, GoldenMangas, SlimeRead, ReaperScansBR, ArgosComics, DemonSect

**Indonesian:**
KomikIndo, Kiryuu, SekteKomik, MangaIndo, Komikcast, MaidManga, WestManga, KomikAV

### WordPress Mangastream (7 sites)

Luminous Scans, ManhwaFreak, Night Scans, Realm Scans, MangaGalaxy, InfernalVoid Scans, Drake Scans

### FoolSlide (9 sites)

Sense Scans, Silent Sky Scans, Death Toll Scanlations, Kirei Cake, Phoenix Serenade, Helvetica Scans, Evil Flowers, Yuri-ism, AssortedScans

### MadTheme (8 sites)

MangaBuddy, MangaForest, MangaMirror, MangaPure, MangaRead, MangaWorm, ManhuaFast, ManhuaUS

### MangaReaderCMS (6 sites)

MangaReader.net, ReadMng, NineManga (EN), NineManga (ES), NineManga (PT), MangaHere

### FlatManga (6 sites)

MangaKakalots.com, Manganelo, Manganato, MangaBat, MangaIro, MangaNelo.me

### Genkan (7 sites)

Leviatan Scans, Reaper Scans, Zero Scans, Method Scans, SK Scans, Hunlight Scans, Night Scans (Genkan)

---

## Como Adicionar um Novo Site

### A um template existente (5 minutos)

1. Identifique qual CMS o site usa (inspecione o HTML)
2. Abra o arquivo de sites correspondente em `packages/scraper/src/sites/`
3. Adicione uma entrada de config:

```typescript
// Exemplo: adicionar site WordPress Madara
export const wordpressMadaraSites: WPMadaraSiteConfig[] = [
  // ... sites existentes ...
  {
    id: 'meusite',
    name: 'Meu Site',
    url: 'https://meusite.com',
    language: 'pt',
    // Overrides opcionais:
    path: '/manga/',           // se diferente do padrao
    useStyleList: true,        // se suporta ?style=list
    mangaListSelector: '.manga-item', // se seletor CSS diferente
  },
];
```

4. O site sera automaticamente registrado no ScraperEngine na proxima execucao.

### Criar um novo template

1. Crie a interface de config em `packages/scraper/src/templates/types.ts`:

```typescript
export interface MeuTemplateSiteConfig extends BaseSiteConfig {
  customField?: string;
}
```

2. Crie o template em `packages/scraper/src/templates/meu-template.ts`:

```typescript
import { BaseConnector } from '../engine/base-connector';
import { MeuTemplateSiteConfig } from './types';

export class MeuTemplate extends BaseConnector {
  constructor(private site: MeuTemplateSiteConfig) {
    super(site.id, site.name, site.url, site.language);
  }

  async search(query: string) { /* ... */ }
  async getMangaDetail(mangaId: string) { /* ... */ }
  async getChapterPages(chapterId: string) { /* ... */ }
}
```

3. Crie o arquivo de sites em `packages/scraper/src/sites/meu-template-sites.ts`

4. Registre no `packages/scraper/src/index.ts`:

```typescript
import { meuTemplateSites } from './sites/meu-template-sites';
import { MeuTemplate } from './templates/meu-template';

for (const site of meuTemplateSites) {
  engine.register(new MeuTemplate(site));
}
```

---

## Notas Importantes

### Sites Potencialmente Inativos

Muitos sites de scanlation mudam de dominio ou fecham frequentemente. Especialmente:

- **Genkan:** Varios grupos migraram para outros CMS ou fecharam
- **FoolSlide:** CMS antigo, varios sites descontinuados
- **WordPress Madara:** Com 87 sites, e normal que alguns estejam fora do ar

**Recomendacao:** Implementar um health check periodico para verificar quais sites estao ativos.

### Cloudflare

O `BaseConnector` detecta automaticamente respostas 403/503 e tenta o FlareSolverr. Nenhum template precisa se preocupar com Cloudflare — o fallback e transparente.

### Fragilidade de Scraping

Templates que dependem de estrutura HTML (todos exceto MangaDex) sao inerentemente frageis. Mudancas no HTML do site podem quebrar a extracao. Priorize:

1. APIs quando disponiveis (MangaDex, MadTheme chapters)
2. JSON embutido no JS (ts_reader, chapImages)
3. DOM scraping como ultimo recurso

---

**Ultima atualizacao:** Marco 2026
