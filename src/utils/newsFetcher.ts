import axios from 'axios';
import { NewsItem, NewsSource, NewsCategory } from '../types';
import { parseWebsite } from './parsers';
import { NewsError } from './errors';

const PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://cors-anywhere.herokuapp.com/',
  'https://cors.bridged.cc/'
];

const SEARCH_ENGINES = {
  google: 'https://www.google.com/search?q=artificial+intelligence+news',
  bing: 'https://www.bing.com/search?q=artificial+intelligence+news',
  duckduckgo: 'https://duckduckgo.com/?q=artificial+intelligence+news'
};

const FETCH_TIMEOUT = 30000;
const MAX_RETRIES = 5;
const RETRY_DELAY = 1000;
const BATCH_SIZE = 3;

async function fetchWithRetry(url: string, retries = 0): Promise<string> {
  const proxyUrl = `${PROXIES[retries % PROXIES.length]}${encodeURIComponent(url)}`;
  
  try {
    const response = await axios.get(proxyUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': 'https://www.google.com'
      },
      timeout: FETCH_TIMEOUT,
      validateStatus: status => status === 200,
      maxRedirects: 5
    });
    
    if (typeof response.data !== 'string' || response.data.length < 500) {
      throw new Error('Invalid response data');
    }
    
    return response.data;
  } catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(1.5, retries)));
      return fetchWithRetry(url, retries + 1);
    }
    throw error;
  }
}

export async function fetchAllNews(sources: NewsSource[]): Promise<NewsItem[]> {
  if (!sources || sources.length === 0) return [];

  const activeSources = sources.filter(source => source.active);
  const allNews: NewsItem[] = [];

  // Fetch in batches to avoid overwhelming the proxies
  for (let i = 0; i < activeSources.length; i += BATCH_SIZE) {
    const batch = activeSources.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(source => 
      fetchNewsFromSource(source).catch(error => {
        console.error(`Error fetching from ${source.name}:`, error instanceof NewsError ? error : new NewsError(
          `Failed to fetch news from ${source.name}`,
          error instanceof Error ? error.message : 'Unknown error'
        ));
        return [];
      })
    );
    
    const batchResults = await Promise.all(batchPromises);
    allNews.push(...batchResults.flat());

    if (i + BATCH_SIZE < activeSources.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between batches
    }
  }

  return allNews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

async function fetchNewsFromSource(source: NewsSource): Promise<NewsItem[]> {
  try {
    const data = await fetchWithRetry(source.url);
    if (!data) {
      throw new Error('Empty response');
    }
    
    const items = parseWebsite(data, source);
    if (items.length === 0) {
      throw new Error('No items parsed');
    }

    return items.map(item => ({
      ...item,
      source: source.name,
      category: source.category,
      isGlobalImpact: detectGlobalImpact(item.title, item.description)
    }));
  } catch (error) {
    if (error instanceof Error) {
      throw new NewsError(
        `Failed to fetch news from ${source.name}`,
        error.message
      );
    }
    throw error;
  }
}

function detectGlobalImpact(title: string, description: string): boolean {
  const impactTerms = [
    'worldwide', 'global', 'breakthrough', 'revolutionary', 'milestone',
    'major advancement', 'groundbreaking', 'first-ever', 'unprecedented',
    'transformation', 'paradigm shift', 'game-changing'
  ];
  
  const content = `${title} ${description}`.toLowerCase();
  return impactTerms.some(term => content.includes(term.toLowerCase()));
}

export async function discoverNewsSources(): Promise<NewsSource[]> {
  const newSources: NewsSource[] = [];
  const processedUrls = new Set<string>();

  for (const [engine, url] of Object.entries(SEARCH_ENGINES)) {
    try {
      const data = await fetchWithRetry(url);
      const sources = extractSourcesFromSearch(data);
      
      for (const source of sources) {
        if (!processedUrls.has(source.url)) {
          processedUrls.add(source.url);
          newSources.push(source);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between search engines
    } catch (error) {
      console.error(`Error discovering sources from ${engine}:`, error);
    }
  }

  return newSources;
}

function extractSourcesFromSearch(html: string): NewsSource[] {
  const sources: NewsSource[] = [];
  const $ = require('cheerio').load(html);
  
  $('a').each((i: number, el: any) => {
    const url = $(el).attr('href');
    if (!url || !isValidNewsUrl(url)) return;

    const name = extractSourceName(url);
    if (!name) return;

    sources.push({
      id: `source-${Date.now()}-${i}`,
      name,
      url,
      type: detectSourceType(url),
      category: categorizeSource(url, name),
      active: true,
      selectors: {
        title: 'article h1, article h2, .article-title, .entry-title',
        description: 'article p, .article-content, .entry-content',
        date: 'time, .date, .published, .post-date',
        image: 'article img, .featured-image, .post-thumbnail'
      }
    });
  });

  return sources;
}

function isValidNewsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const validDomains = ['.com', '.org', '.net', '.edu', '.gov', '.io'];
    const blacklistedDomains = ['google', 'bing', 'duckduckgo', 'facebook', 'twitter'];
    
    return (
      validDomains.some(domain => parsed.hostname.endsWith(domain)) &&
      !blacklistedDomains.some(domain => parsed.hostname.includes(domain))
    );
  } catch {
    return false;
  }
}

function extractSourceName(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname
      .replace(/^www\./, '')
      .split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return null;
  }
}

function detectSourceType(url: string): 'rss' | 'website' {
  return url.includes('/feed') || url.includes('/rss') || url.endsWith('.xml') ? 'rss' : 'website';
}

function categorizeSource(url: string, name: string): NewsCategory {
  const content = `${url} ${name}`.toLowerCase();
  
  if (content.includes('research') || content.includes('science') || content.includes('study')) {
    return 'Research';
  }
  if (content.includes('ethics') || content.includes('policy')) {
    return 'Ethics';
  }
  if (content.includes('application') || content.includes('implementation')) {
    return 'Applications';
  }
  return 'Industry';
}