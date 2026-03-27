/**
 * Sync Check with HakuNeko Repository
 * 
 * Monitors the HakuNeko GitHub repository for connector changes
 * and alerts when connectors we use have been modified.
 * 
 * Usage: npm run sync-hakuneko
 */

const HAKUNEKO_REPO = 'manga-download/hakuneko';
const CONNECTORS_PATH = 'src/web/mjs/connectors';
const GITHUB_API = 'https://api.github.com';

// Our connectors and their HakuNeko equivalents
const CONNECTOR_MAP: Record<string, string> = {
  'mangadex': 'MangaDex',
  'mangasee': 'MangaLife', // MangaSee extends MangaLife
  'mangakakalot': 'MangaKakalot',
  'asurascans': 'AsuraScans',
  'luminousscans': 'LuminousScans',
  'toonily': 'Toonily',
  'mangareader': 'MangaReader',
  'manganelo': 'Manganelo',
  'manganato': 'Manganato',
};

interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  html_url: string;
  files?: Array<{
    filename: string;
    status: 'added' | 'removed' | 'modified' | 'renamed';
  }>;
}

interface ChangeAlert {
  connector: string;
  ourId: string;
  commitSha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  files: string[];
}

async function fetchJSON<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Manga-Kindle-Health-Check',
    },
  });
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  return response.json();
}

async function getRecentCommits(days = 7): Promise<GitHubCommit[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString();
  
  const url = `${GITHUB_API}/repos/${HAKUNEKO_REPO}/commits` +
    `?path=${CONNECTORS_PATH}&since=${sinceStr}&per_page=30`;
  
  return fetchJSON<GitHubCommit[]>(url);
}

async function checkConnectorChanges(): Promise<ChangeAlert[]> {
  console.log('🔍 Checking HakuNeko repository for connector changes...\n');
  console.log(`Repository: ${HAKUNEKO_REPO}`);
  console.log(`Path: ${CONNECTORS_PATH}`);
  console.log(`Looking back: 7 days\n`);
  
  const commits = await getRecentCommits(7);
  const alerts: ChangeAlert[] = [];
  
  for (const commit of commits) {
    // Check if any of our connectors are affected
    for (const [ourId, hakunekoName] of Object.entries(CONNECTOR_MAP)) {
      const affectedFiles = commit.files?.filter(f => 
        f.filename.includes(hakunekoName) || 
        f.filename.includes(CONNECTORS_PATH)
      ) || [];
      
      if (affectedFiles.length > 0) {
        alerts.push({
          connector: hakunekoName,
          ourId: ourId,
          commitSha: commit.sha.substring(0, 7),
          message: commit.commit.message.split('\n')[0],
          author: commit.commit.author.name,
          date: commit.commit.author.date,
          url: commit.html_url,
          files: affectedFiles.map(f => f.filename),
        });
      }
    }
  }
  
  return alerts;
}

async function checkConnectorStatus() {
  console.log('📡 HakuNeko Connector Sync Check');
  console.log('='.repeat(60));
  console.log();
  
  try {
    const alerts = await checkConnectorChanges();
    
    if (alerts.length === 0) {
      console.log('✅ No changes to our connectors in the last 7 days');
    } else {
      console.log(`⚠️  Found ${alerts.length} connector change(s):\n`);
      
      alerts.forEach((alert, i) => {
        console.log(`${i + 1}. ${alert.connector} (${alert.ourId})`);
        console.log(`   Message: ${alert.message}`);
        console.log(`   Author: ${alert.author}`);
        console.log(`   Date: ${new Date(alert.date).toLocaleString()}`);
        console.log(`   Commit: ${alert.commitSha}`);
        console.log(`   Files: ${alert.files.join(', ')}`);
        console.log(`   URL: ${alert.url}`);
        console.log();
      });
      
      console.log('📋 RECOMMENDED ACTIONS:');
      console.log('   1. Review the commit changes on GitHub');
      console.log('   2. Check if the connector still works locally');
      console.log('   3. Update our connector if needed');
      console.log('   4. Run health-check to verify functionality');
    }
    
    // Also check for new connectors
    console.log('\n📦 Checking for new connectors in HakuNeko...');
    const allConnectors = await fetchJSON<string[]>(
      `${GITHUB_API}/repos/${HAKUNEKO_REPO}/contents/${CONNECTORS_PATH}`
    );
    
    const ourConnectors = Object.values(CONNECTOR_MAP);
    const newConnectors = allConnectors
      .filter((f: any) => f.name.endsWith('.mjs'))
      .map((f: any) => f.name.replace('.mjs', ''))
      .filter((name: string) => !ourConnectors.includes(name))
      .slice(0, 10); // Show top 10
    
    if (newConnectors.length > 0) {
      console.log(`💡 ${newConnectors.length} new connectors available:`);
      newConnectors.forEach(name => console.log(`   - ${name}`));
    }
    
  } catch (err: any) {
    console.error('❌ Error checking HakuNeko:', err.message);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1]?.includes('sync-hakuneko')) {
  checkConnectorStatus().catch(console.error);
}

export { checkConnectorChanges, checkConnectorStatus, CONNECTOR_MAP };
