# Estratégia para Conectores de Manga - Sustentabilidade

## Problema Identificado

O HakuNeko possui **~1000 conectores** que mudam constantemente porque:
1. Sites de manga mudam de domínio (ex: MangaSee → WeebCentral)
2. Estrutura HTML/CSS muda
3. Proteção anti-bot (Cloudflare) é adicionada
4. APIs são modificadas

### Status Atual dos Nossos Conectores

| Fonte | Status | Problema | Solução |
|-------|--------|----------|---------|
| MangaDex | ✅ OK | - | - |
| MangaSee | ✅ OK (WeebCentral) | Migrou em Fev/2025 | Reescrito para WeebCentral |
| MangaKakalot | ⚠️ Cloudflare | 403/503 errors | Precisa FlareSolverr |
| AsuraScans | ✅ OK | - | - |
| Luminous Scans | ⚠️ Instável | Timeout | Monitorar |
| Toonily | ⚠️ Cloudflare | 403/503 errors | Precisa FlareSolverr |

---

## Soluções Propostas

### 1. **Monitoramento Automático de Health Check** (RECOMENDADO)

Criar script que testa todos os conectores periodicamente:

```bash
# Script: packages/scraper/scripts/health-check.ts
- Testa search() de cada connector com query "test"
- Reporta falhas via Discord/Email
- Abre issues automáticas no GitHub
```

**Vantagens:**
- Detecta problemas antes dos usuários
- Histórico de uptime por fonte
- Alerta precoce para mudanças de site

### 2. **Template de Connector com Retry + Fallback**

```typescript
abstract class ResilientConnector extends BaseConnector {
  async search(query: string, retries = 3): Promise<MangaInfo[]> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this._searchImpl(query);
      } catch (err) {
        if (i === retries - 1) throw err;
        await this.delay(1000 * (i + 1));
      }
    }
  }
  
  // Fallback para mirror domains
  protected readonly mirrorDomains: string[] = [];
}
```

### 3. **Lista de Domínios Espelho**

Manter lista de domínios alternativos por fonte:

```typescript
const MIRRORS: Record<string, string[]> = {
  'mangasee': ['https://weebcentral.com', 'https://mangasee123.com'],
  'mangakakalot': ['https://mangakakalot.gg', 'https://mangakakalot.com'],
};
```

### 4. **Sincronização com HakuNeko** (RECOMENDADO)

Script que monitora mudanças no repositório do HakuNeko:

```bash
# Script: scripts/sync-hakuneko.ts
- Poll GitHub API a cada 24h
- Detecta commits em /src/web/mjs/connectors/
- Compara com nossos conectores
- Gera diff e alerta se houver mudanças
```

**Implementação:**
```typescript
// Verifica se connector foi atualizado
async function checkConnectorChanges() {
  const commits = await fetch(
    'https://api.github.com/repos/manga-download/hakuneko/commits' +
    '?path=src/web/mjs/connectors&per_page=30'
  );
  
  for (const commit of await commits.json()) {
    if (commit.commit.message.includes('MangaSee')) {
      console.warn('⚠️ MangaSee changed in HakuNeko!');
      console.log('Commit:', commit.commit.message);
      console.log('URL:', commit.html_url);
    }
  }
}
```

### 5. **Documentação de Emergency Procedures**

Criar playbook para quando um connector quebrar:

```markdown
## Quando um Connector Quebra

1. **Diagnóstico** (5 min)
   - Rodar: `npm run test:connector <id>`
   - Verificar status code (403 = Cloudflare, 404 = URL mudou)
   
2. **Ações Imediatas** (15 min)
   - 403: Habilitar FlareSolverr
   - 404: Verificar se site migrou (Google: "<site> new domain")
   - Check HakuNeko issues: https://github.com/manga-download/hakuneko/issues
   
3. **Fix** (30-60 min)
   - Atualizar URLs
   - Re-escrever scrapers se necessário
   - Testar search, getManga, getChapters, getPages
   
4. **Prevenção**
   - Adicionar ao health check
   - Documentar no README
```

---

## Plano de Ação Imediato

### Esta Semana
- [ ] Implementar health check script
- [ ] Configurar FlareSolverr para Cloudflare
- [ ] Criar GitHub Issue template para reporte de connectors

### Próxima Semana
- [ ] Script de sync com HakuNeko
- [ ] Adicionar retry logic nos connectors
- [ ] Documentar procedures

### Long-term
- [ ] Dashboard de status das fontes
- [ ] Sistema de fallback automático
- [ ] Community reporting via Discord

---

## Lições do HakuNeko

O HakuNeko lida com isso através de:
1. **Comunidade ativa** - users reportam issues rapidamente
2. **Release频繁** - Nightly builds com fixes
3. **Issue templates** - Padronização de reports
4. **GitHub notifications** - Watch no repo para mudanças

### O Que Adotar

1. ✅ Issue templates para reporte de fontes quebradas
2. ✅ Health check automatizado
3. ✅ Monitorar changes no HakuNeko
4. ✅ Manter changelog de mudanças de connectors

---

## Ferramentas Sugeridas

| Ferramenta | Uso |
|------------|-----|
| GitHub Actions | Health check diário |
| UptimeRobot | Monitoramento de URLs |
| Discord webhook | Alertas de falhas |
| GitHub Issues | Tracking de problemas |
| RSS do HakuNeko | Sync de mudanças |

---

## Conclusão

**Não é possível prevenir todas as quebras**, mas podemos:
1. **Detectar rápido** (health checks)
2. **Responder rápido** (procedures documentados)
3. **Aprender com a comunidade** (HakuNeko sync)
4. **Minimizar impacto** (retry, fallbacks, mirrors)

A estratégia ideal é **defesa em profundidade**: múltiplas camadas de proteção e monitoramento.
