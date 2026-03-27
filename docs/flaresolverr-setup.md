# 🛡️ Guia de Configuração do FlareSolverr

## Problema: Erros HTTP 403/503 (Cloudflare)

Se você está vendo erros como:

```
[ERROR] Error: HTTP 403/503 fetching https://pt.ninemanga.com/...
Site appears to be Cloudflare-protected. 
Set FLARESOLVERR_URL env var to enable automatic bypass.
```

Isso significa que o site usa **proteção Cloudflare DDoS-GUARD** e requer um navegador real para resolver o desafio JavaScript.

---

## O Que é Cloudflare?

Cloudflare é um serviço de proteção DDoS que:
1. **Desafia requisições suspeitas** (bots, scripts, servidores)
2. **Executa JavaScript** no navegador do cliente
3. **Valida cookies** antes de permitir acesso
4. **Retorna 403/503** se o desafio falhar

### Por Que Nosso Scraper Falha?

Nosso scraper usa `undici` (fetch HTTP) que:
- ❌ Não executa JavaScript
- ❌ Não tem navegador real
- ❌ Não resolve desafios Cloudflare

### Como o HakuNeko Resolve?

O HakuNeko usa **navegador embutido** (Electron/Chrome) que:
- ✅ Executa JavaScript normalmente
- ✅ Resolve desafios automaticamente
- ✅ Mantém cookies válidos

---

## Solução: FlareSolverr

**FlareSolverr** é um proxy que:
1. Inicia um navegador Chrome headless
2. Abre a URL protegida
3. Espera o desafio Cloudflare ser resolvido
4. Retorna HTML + cookies válidos

### Arquitetura

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Manga-Kindle   │ ───► │  FlareSolverr    │ ───► │  Site (CF)      │
│  Scraper        │      │  (Chrome)        │      │  ninemanga.com  │
└─────────────────┘      └──────────────────┘      └─────────────────┘
     HTTP Request            Cloudflare                  Protected
     (undici)                Bypass                      Site
```

---

## Instalação (Recomendado: Docker)

### 1. Instalar Docker

**Windows:**
```powershell
# Baixe Docker Desktop
https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe
```

**Linux (Debian/Ubuntu):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. Rodar FlareSolverr

**Docker Compose (Recomendado):**

Já configurado no `docker-compose.yml`:

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

**Iniciar:**
```bash
docker compose up -d flaresolverr
```

**Docker CLI:**
```bash
docker run -d \
  --name=flaresolverr \
  -p 8191:8191 \
  -e LOG_LEVEL=info \
  -e TZ=America/Sao_Paulo \
  --restart unless-stopped \
  ghcr.io/flaresolverr/flaresolverr:latest
```

### 3. Verificar Instalação

```bash
curl http://localhost:8191/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "message": "FlareSolverr is ready!",
  "version": "3.3.21"
}
```

---

## Configuração no Manga-Kindle

### Opção 1: Docker (Recomendado)

O `docker-compose.yml` já inclui FlareSolverr:

```bash
# Iniciar tudo (API + Web + FlareSolverr)
docker compose up -d

# Verificar status
docker compose ps
```

O scraper automaticamente usará `http://flaresolverr:8191/v1`.

### Opção 2: Variável de Ambiente

Se rodar fora do Docker, defina:

**Linux/Mac:**
```bash
export FLARESOLVERR_URL=http://localhost:8191/v1
```

**Windows (PowerShell):**
```powershell
$env:FLARESOLVERR_URL="http://localhost:8191/v1"
```

**Windows (CMD):**
```cmd
set FLARESOLVERR_URL=http://localhost:8191/v1
```

**.env (Recomendado para desenvolvimento):**
```env
# .env na raiz do projeto
FLARESOLVERR_URL=http://localhost:8191/v1
```

---

## Como Funciona no Código

### BaseConnector com Fallback Automático

```typescript
// packages/scraper/src/engine/base-connector.ts

protected async fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: this.defaultHeaders });

  // Se receber 403/503 (Cloudflare), tenta FlareSolverr
  if (CF_STATUS_CODES.has(response.status)) {
    return this.fetchTextViaCF(url);
  }

  return response.text();
}

private async fetchTextViaCF(url: string): Promise<string> {
  if (!getFlareSolverrUrl()) {
    throw new Error(
      `HTTP 403/503 fetching ${url}. Site appears to be Cloudflare-protected. ` +
      `Set FLARESOLVERR_URL env var to enable automatic bypass.`
    );
  }

  // Chama FlareSolverr API
  const result = await solveCloudflarePage(url);

  // Cache cookies para próximas requisições
  this.cacheCFCookies(url, result.cookies, result.userAgent);

  return result.html;
}
```

### Cache de Cookies

Após resolver Cloudflare uma vez, os cookies são cacheados:

```typescript
// Cookie cache por domínio
private static cfCookieCache = new Map<
  string, 
  { cookies: string; userAgent: string; expires: number }
>();
```

**Vantagem:** Requisições subsequentes usam cookies cacheados sem chamar FlareSolverr novamente.

---

## Sites que Precisam FlareSolverr

| Site | Status | Notas |
|------|--------|-------|
| NineManga (PT) | ❌ 403 | Precisa FlareSolverr |
| MangaKakalot | ❌ 403 | Precisa FlareSolverr |
| Toonily | ❌ 403 | Precisa FlareSolverr |
| Hiperdex | ⚠️ Instável | Às vezes precisa |
| Luminous Scans | ⚠️ Timeout | Pode precisar |
| MangaDex | ✅ OK | Sem Cloudflare |
| AsuraScans | ✅ OK | Sem Cloudflare |
| WeebCentral | ✅ OK | Sem Cloudflare |

---

## Troubleshooting

### Erro: "Cannot connect to FlareSolverr"

**Causa:** FlareSolverr não está rodando ou URL errada.

**Solução:**
```bash
# Verificar se container está rodando
docker ps | grep flaresolverr

# Ver logs
docker logs flaresolverr

# Reiniciar
docker restart flaresolverr
```

### Erro: "Cloudflare challenge timeout"

**Causa:** Cloudflare demorou mais que 60s para resolver.

**Solução:**
1. Aumente timeout no `flaresolverr.ts`:
```typescript
const timeout = 90000; // 90s ao invés de 60s
```

2. Verifique se site não está bloqueando seu IP

### Erro: "Infinite loop" no Cloudflare

**Causa:** Site detectou comportamento de bot.

**Solução:**
1. Limpe cookies do FlareSolverr:
```bash
docker restart flaresolverr
```

2. Troque IP (VPN ou aguarde)

3. Site pode ter bloqueio permanente

### FlareSolverr não resolve

**Causa:** Cloudflare atualizou proteção.

**Solução:**
1. Atualize FlareSolverr:
```bash
docker pull ghcr.io/flaresolverr/flaresolverr:latest
docker restart flaresolverr
```

2. Verifique issues: https://github.com/FlareSolverr/FlareSolverr/issues

---

## Performance e Recursos

### Consumo de Memória

Cada requisição ao FlareSolverr:
- **~200-500MB RAM** por instância Chrome
- **2-10s** para resolver desafio
- **Concorrência limitada** (não faça 100 requests de uma vez)

### Otimizações

1. **Cache de cookies** já implementado
2. **Timeout de 60s** evita espera infinita
3. **Fallback automático** só quando necessário

### Boas Práticas

```typescript
// ❌ RUIM: Muitas requests simultâneas
await Promise.all(
  chapters.map(ch => connector.getPages(ch.id)) // 100 requests!
);

// ✅ BOM: Processamento em lote
for (const chapter of chapters) {
  const pages = await connector.getPages(chapter.id);
  await delay(1000); // 1s entre requests
}
```

---

## Alternativas ao FlareSolverr

### 1. HaruNeko (Recomendado pelo HakuNeko)

Sucessor do HakuNeko com melhor suporte a Cloudflare:
- https://github.com/harunko/HaruNeko

### 2. Browser Automation

Usar Puppeteer/Playwright diretamente:
```typescript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://site.com');
const html = await page.content();
```

**Desvantagens:**
- Mais complexo
- Mais pesado
- Requer manutenção

### 3. API Alternativa

Alguns sites têm APIs não protegidas:
```typescript
// Exemplo: MangaDex API
const api = 'https://api.mangadex.org/manga';
```

---

## Monitoramento

### Health Check Automático

Script incluído detecta sites com Cloudflare:

```bash
npm run health-check --workspace=packages/scraper
```

**Saída:**
```
🚫 CLOUDFLARE: MangaKakalot, NineManga, Toonily
⚠️  SLOW: Luminous Scans
✅ OK: MangaDex, AsuraScans, WeebCentral
```

### Logs do FlareSolverr

```bash
# Ver em tempo real
docker logs -f flaresolverr

# Últimas 100 linhas
docker logs --tail 100 flaresolverr
```

---

## Referências

- **FlareSolverr GitHub:** https://github.com/FlareSolverr/FlareSolverr
- **HakuNeko Issues:** https://github.com/manga-download/hakuneko/issues
- **Cloudflare Challenge:** https://www.cloudflare.com/ddos/

---

## Resumo Rápido

```bash
# 1. Instalar Docker
# 2. Rodar FlareSolverr
docker compose up -d flaresolverr

# 3. Verificar
curl http://localhost:8191/health

# 4. Usar scraper
npm run dev

# Sites com 403 agora funcionam automaticamente! ✅
```

---

**Última atualização:** Março 2026  
**Versão FlareSolverr:** 3.3.x  
**Testado em:** Windows 11, Ubuntu 22.04, Docker 24.x
