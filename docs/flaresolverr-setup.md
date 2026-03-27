# Guia de Configuracao do FlareSolverr

## Problema: Erros HTTP 403/503 (Cloudflare)

Se voce esta vendo erros como:

```
[ERROR] Error: HTTP 403/503 fetching https://mangakakalot.com/...
Site appears to be Cloudflare-protected.
Set FLARESOLVERR_URL env var to enable automatic bypass.
```

Isso significa que o site usa **protecao Cloudflare** e requer um navegador real para resolver o desafio JavaScript.

---

## Como Funciona no Manga-Kindle

O sistema de bypass e **completamente automatico**:

```
Scraper faz request HTTP
    ↓
Recebe 403 ou 503?
    ├── Nao → Retorna resposta normalmente
    └── Sim → Tem cookies CF cacheados para esse dominio?
                ├── Sim → Refaz request com cookies cacheados
                └── Nao → FlareSolverr configurado?
                            ├── Sim → Resolve via FlareSolverr → Cache cookies (15 min) → Retorna HTML
                            └── Nao → Lanca erro com instrucoes de setup
```

**Todos os 134 conectores** herdam esse comportamento automaticamente via `BaseConnector`. Nenhum conector precisa implementar logica de Cloudflare.

### Codigo Relevante

- **Deteccao e fallback:** `packages/scraper/src/engine/base-connector.ts`
  - `fetchText()` — detecta 403/503, injeta cookies cacheados, chama FlareSolverr
  - `fetchJSON()` — mesmo comportamento para respostas JSON
  - Cookie cache estatico por dominio com TTL de 15 minutos

- **Cliente FlareSolverr:** `packages/scraper/src/engine/flaresolverr.ts`
  - `solveCloudflarePage(url)` — POST para FlareSolverr, retorna HTML + cookies + userAgent
  - `isFlareSolverrAvailable()` — verifica se URL esta configurada

---

## Instalacao

### Opcao 1: Docker Compose (Recomendado)

Ja configurado no `docker-compose.yml`:

```yaml
services:
  flaresolverr:
    image: ghcr.io/flaresolverr/flaresolverr:latest
    container_name: flaresolverr
    ports:
      - "8191:8191"
    environment:
      - LOG_LEVEL=info
      - TZ=America/Sao_Paulo
    restart: unless-stopped
```

```bash
# Iniciar tudo (App + FlareSolverr)
docker compose up -d

# Ou apenas FlareSolverr
docker compose up -d flaresolverr
```

### Opcao 2: Docker CLI

```bash
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  -e TZ=America/Sao_Paulo \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest
```

### Verificar Instalacao

```bash
curl http://localhost:8191/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "message": "FlareSolverr is ready!",
  "version": "3.3.21"
}
```

---

## Configuracao

### Docker (automatico)

Dentro do Docker Compose, o scraper usa `http://flaresolverr:8191/v1` automaticamente.

### Desenvolvimento Local

Defina a variavel de ambiente:

```bash
# .env na raiz do projeto
FLARESOLVERR_URL=http://localhost:8191/v1
```

Ou diretamente no shell:

```bash
# Linux/Mac
export FLARESOLVERR_URL=http://localhost:8191/v1

# Windows (PowerShell)
$env:FLARESOLVERR_URL="http://localhost:8191/v1"

# Windows (CMD)
set FLARESOLVERR_URL=http://localhost:8191/v1
```

---

## Sites que Podem Precisar de FlareSolverr

> **Nota:** O status de Cloudflare muda frequentemente. A tabela abaixo e uma referencia, nao uma verdade absoluta. O sistema detecta e tenta bypass automaticamente.

| Categoria | Sites | Cloudflare? |
|-----------|-------|-------------|
| **Hand-written** | MangaDex | Nao (API oficial) |
| | WeebCentral | Nao |
| | MangaKakalot | Sim |
| | AsuraScans | Variavel |
| **MangaReaderCMS** | NineManga (PT/ES/EN) | Sim |
| **WordPress Madara** | Toonily, Hiperdex | Variavel |
| | Outros (87 sites) | Muitos usam CF |
| **FlatManga** | Manganelo, Manganato | Variavel |
| **Outros templates** | Depende do site | Verificar individualmente |

**Na duvida:** Configure o FlareSolverr. Se o site nao precisa, ele nunca sera chamado (zero overhead).

---

## Troubleshooting

### "Cannot connect to FlareSolverr"

**Causa:** FlareSolverr nao esta rodando ou URL errada.

```bash
# Verificar se container esta rodando
docker ps | grep flaresolverr

# Ver logs
docker logs flaresolverr

# Reiniciar
docker restart flaresolverr
```

### "Cloudflare challenge timeout"

**Causa:** Cloudflare demorou mais que 60s para resolver.

Solucoes:
1. Reiniciar FlareSolverr: `docker restart flaresolverr`
2. Verificar se IP nao esta bloqueado
3. Atualizar FlareSolverr: `docker pull ghcr.io/flaresolverr/flaresolverr:latest`

### FlareSolverr nao resolve

**Causa:** Cloudflare atualizou protecao.

Solucoes:
1. Atualizar FlareSolverr para versao mais recente
2. Verificar issues: https://github.com/FlareSolverr/FlareSolverr/issues
3. Reiniciar container (limpa sessoes antigas)

### Site retorna HTML mas scraper falha

**Causa:** Site mudou estrutura HTML, nao e problema de Cloudflare.

Solucao: Verificar seletores CSS no template correspondente.

---

## Performance

| Metrica | Valor |
|---------|-------|
| RAM por request | ~200-500MB (Chrome headless) |
| Tempo de resolucao | 2-10s por desafio |
| Cache de cookies | 15 minutos por dominio |
| Overhead quando nao precisa | Zero (so chamado em 403/503) |

### Boas Praticas

- **Nao faca muitas requests simultaneas** ao FlareSolverr
- O download service ja limita concorrencia (4 paginas simultaneas)
- Cookies cacheados evitam chamadas repetidas ao FlareSolverr
- Rate limiting configuravel via `RATE_LIMIT_MS`

---

## Referencias

- **FlareSolverr GitHub:** https://github.com/FlareSolverr/FlareSolverr
- **Decisao tecnica (Puppeteer vs FlareSolverr):** [docs/puppeteer-vs-flaresolverr.md](puppeteer-vs-flaresolverr.md)
- **Estrategia de conectores:** [docs/connector-strategy.md](connector-strategy.md)

---

**Ultima atualizacao:** Marco 2026
**Versao FlareSolverr:** 3.3.x
**Testado em:** Windows 11, Ubuntu 22.04, Docker 24.x
