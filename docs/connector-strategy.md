# Estrategia para Conectores de Manga - Sustentabilidade

## Visao Geral

O Manga-Kindle possui **134 conectores** organizados em:
- **4 conectores escritos a mao** (MangaDex, WeebCentral, MangaKakalot, AsuraScans)
- **7 templates reutilizaveis** que cobrem 130 sites

O desafio principal e manter esses conectores funcionando, dado que sites de manga mudam constantemente.

## Por Que Sites Quebram

1. **Mudanca de dominio** — ex: MangaSee migrou para WeebCentral em Fev/2025
2. **Mudanca de estrutura HTML/CSS** — seletores de scraping ficam invalidos
3. **Protecao Cloudflare** — sites adicionam ou mudam protecao anti-bot
4. **APIs modificadas** — endpoints ou formatos de resposta mudam
5. **Sites fecham** — grupos de scanlation encerram atividades

## Status Atual dos Conectores

### Conectores Escritos a Mao

| Fonte | Status | Notas |
|-------|--------|-------|
| MangaDex | OK | API oficial v5, mais estavel |
| WeebCentral (ex-MangaSee) | OK | Reescrito para novo dominio |
| MangaKakalot | Cloudflare | Requer FlareSolverr |
| AsuraScans | Fragil | JSON embutido em HTML Astro, pode quebrar com mudancas de layout |

### Templates (130 sites)

| Template | Sites | Risco | Notas |
|----------|-------|-------|-------|
| WordPress Madara | 87 | Medio | CMS mais popular, mas muitos sites pequenos podem fechar |
| WordPress Mangastream | 7 | Medio | Depende de ts_reader JSON |
| FoolSlide | 9 | Alto | CMS antigo, varios sites provavelmente inativos |
| MadTheme | 8 | Baixo | Usa API interna, mais estavel |
| MangaReaderCMS | 6 | Medio | NineManga usa Cloudflare |
| FlatManga | 6 | Medio | Variantes do Manganelo |
| Genkan | 7 | Alto | Muitos grupos Genkan migraram ou fecharam |

## Protecoes Implementadas

### 1. Fallback Automatico para FlareSolverr

O `BaseConnector` ja implementa deteccao automatica de Cloudflare:

```
HTTP Request → 403/503? → Sim → FlareSolverr → Cache cookies (15 min)
                          Nao → Retorna resposta normal
```

**Como funciona:**
- `fetchText()` e `fetchJSON()` detectam status 403/503
- Chamam FlareSolverr automaticamente se `FLARESOLVERR_URL` estiver configurado
- Cookies resolvidos sao cacheados por dominio (15 min TTL)
- Requisicoes subsequentes usam cookies cacheados sem chamar FlareSolverr

**Arquivo:** `packages/scraper/src/engine/base-connector.ts`

### 2. Template System

Reduz codigo duplicado e facilita manutencao:
- Corrigir um bug no template WordPress Madara corrige 87 sites de uma vez
- Adicionar um novo site requer apenas uma entrada de config
- Ver [docs/template-system.md](template-system.md) para detalhes

### 3. Multiplas Estrategias de Fetch

Templates robustos implementam fallbacks:
- **WordPress Madara:** DOM → ajax/chapters → admin-ajax.php (3 camadas)
- **WordPress Mangastream:** ts_reader JSON → DOM fallback
- **FoolSlide:** var pages → JSON.parse(atob(...))

---

## Acoes Recomendadas

### Curto Prazo

- [ ] **Health check script** — Testar `search("test")` em cada conector, reportar falhas
- [ ] **Remover sites mortos** — Verificar quais dos 134 sites estao realmente ativos
- [ ] **Testar FlareSolverr** — Confirmar quais sites precisam de bypass CF

### Medio Prazo

- [ ] **Dashboard de status** — Pagina no frontend mostrando status de cada fonte
- [ ] **Retry com backoff** — Adicionar retry exponencial no BaseConnector
- [ ] **Rotacao de User-Agent** — Pool de UAs para reduzir deteccao

### Longo Prazo

- [ ] **CI health check** — GitHub Actions rodando verificacao diaria
- [ ] **Community reporting** — Botao "Source broken?" no frontend
- [ ] **Auto-disable** — Desabilitar fontes que falham consistentemente

---

## Quando um Conector Quebra

### Diagnostico (5 min)

```bash
# 1. Verificar se o site esta acessivel no navegador
# 2. Verificar status code
curl -I https://site.com

# 403 = Cloudflare → Configurar FlareSolverr
# 404 = URL mudou → Verificar novo dominio
# 500 = Site com problema → Aguardar
# Timeout = Site fora do ar
```

### Acoes Imediatas (15 min)

| Erro | Acao |
|------|------|
| 403/503 | Configurar FlareSolverr |
| 404 | Pesquisar novo dominio (Google: "sitename new domain") |
| HTML mudou | Atualizar seletores no template ou config |
| Site fechou | Remover da lista de sites |

### Correcao (30-60 min)

1. Atualizar URLs/seletores na config do site
2. Se template inteiro quebrou, atualizar o template
3. Testar: search, getMangaDetail, getChapterPages
4. Se site migrou de CMS, mover para template correto

---

## Licoes do HakuNeko

O HakuNeko gerencia ~1000 conectores atraves de:
1. **Comunidade ativa** que reporta issues rapidamente
2. **Releases frequentes** com fixes
3. **Issue templates padronizados** para reportes
4. **Monitoramento de mudancas** nos sites

### O Que Adotamos

- Template system (semelhante ao pattern do HakuNeko)
- FlareSolverr como bypass CF (HakuNeko usa browser embutido)
- Issue templates para reporte de fontes quebradas (`.github/ISSUE_TEMPLATE/connector-broken.md`)

---

## Ferramentas Sugeridas

| Ferramenta | Uso |
|------------|-----|
| GitHub Actions | Health check diario |
| FlareSolverr | Bypass Cloudflare automatico |
| Discord/Telegram webhook | Alertas de falhas |
| GitHub Issues | Tracking de conectores quebrados |

---

## Conclusao

Com 134 conectores, e **inevitavel** que alguns quebrem. A estrategia e:

1. **Detectar rapido** — Health checks automatizados
2. **Corrigir facil** — Template system permite fixes em massa
3. **Bypass automatico** — FlareSolverr transparente no BaseConnector
4. **Comunicar** — Issues e dashboard de status para usuarios

A arquitetura de templates reduz drasticamente o custo de manutencao: corrigir 1 template = corrigir N sites.

---

**Ultima atualizacao:** Marco 2026
