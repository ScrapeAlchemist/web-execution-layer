/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PART 2: BROWSER EXECUTION WITH BRIGHT DATA SCRAPING BROWSER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module covers browser-level execution for complex web environments using
 * Bright Data's Scraping Browser product.
 *
 * WHEN TO USE BROWSER EXECUTION:
 * - JavaScript-heavy single-page applications (SPAs)
 * - Sites with anti-bot protection (Cloudflare, PerimeterX, etc.)
 * - Dynamic content that loads after page render
 * - Sites requiring user interaction (clicks, scrolls)
 *
 * BRIGHT DATA SCRAPING BROWSER:
 * Scraping Browser is a managed Puppeteer environment that automatically handles:
 * - JavaScript rendering
 * - CAPTCHA solving
 * - Browser fingerprinting
 * - Anti-bot challenges
 * - IP rotation
 *
 * EXECUTION LEVELS:
 * - Browser Light (~$0.01/request): Basic JS rendering, simple anti-bot
 * - Browser Advanced (~$0.025/request): Heavy protection, complex fingerprinting
 *
 * CONNECTION FORMAT:
 * wss://brd-customer-{customer_id}-zone-{zone}[-country-{geo}]:{password}@brd.superproxy.io:9222
 *
 * @see https://docs.brightdata.com/scraping-automation/scraping-browser/introduction
 */

const puppeteer = require('puppeteer-core');
const { EventEmitter } = require('events');

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: BROWSER EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════════
//
// The main executor that connects to Bright Data's Scraping Browser via Puppeteer.
// It handles JavaScript rendering and automatic anti-bot protection.

/**
 * Browser Executor using Bright Data Scraping Browser
 *
 * @example
 * const executor = new BrowserExecutor({
 *   customerId: process.env.BRIGHTDATA_CUSTOMER_ID,
 *   zone: 'scraping_browser',
 *   password: process.env.BRIGHTDATA_PASSWORD
 * });
 *
 * const result = await executor.execute('https://example.com', { geo: 'us' });
 * console.log(result.html);
 * await executor.disconnect();
 */
class BrowserExecutor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      // Bright Data credentials
      customerId: config.customerId || process.env.BRIGHTDATA_CUSTOMER_ID || '',
      zone: config.zone || process.env.BRIGHTDATA_ZONE_SCRAPING_BROWSER || 'scraping_browser',
      password: config.password || process.env.BRIGHTDATA_PASSWORD || '',

      // Execution settings
      level: config.level || 'light',  // 'light' or 'advanced'
      timeout: config.timeout || 60000,
      viewport: config.viewport || { width: 1920, height: 1080 },

      // JavaScript handling
      waitUntil: config.waitUntil || 'networkidle2',
      jsTimeout: config.jsTimeout || 30000,

      // Anti-bot settings
      antiBotRetries: config.antiBotRetries || 3
    };

    this.browser = null;
    this.antiBotEvents = [];
  }

  /**
   * Execute browser request
   *
   * @param {string} url - URL to navigate to
   * @param {Object} options - Execution options
   * @param {string} options.geo - Geographic targeting (e.g., 'us', 'uk', 'de')
   * @param {string} options.waitForSelector - CSS selector to wait for
   * @param {boolean} options.screenshot - Take screenshot
   * @param {Object} options.extractSelectors - Selectors to extract data from
   * @returns {Promise<Object>} Execution result
   */
  async execute(url, options = {}) {
    const startTime = Date.now();
    this.antiBotEvents = [];
    let page = null;

    try {
      // Connect to Scraping Browser
      if (!this.browser) {
        await this.connect(options.geo);
      }

      page = await this.browser.newPage();
      await this.configurePage(page, options);

      // Navigate with retry for anti-bot challenges
      const response = await this.navigateWithRetry(page, url, options);

      if (!response) {
        throw new Error('Navigation failed - no response');
      }

      // Wait for content if needed
      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: this.config.jsTimeout
        });
      }

      // Get page content
      const html = await page.content();
      const finalUrl = page.url();

      // Extract data if selectors provided
      let extractedData;
      if (options.extractSelectors) {
        extractedData = await this.extractData(page, options.extractSelectors);
      }

      // Take screenshot if requested
      let screenshotPath;
      if (options.screenshot) {
        screenshotPath = options.screenshotPath || `screenshot-${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        url,
        finalUrl,
        statusCode: response.status(),
        html,
        contentLength: html.length,
        extractedData,
        executionTime,
        javascriptRendered: true,
        antiBotEvents: [...this.antiBotEvents],
        geo: options.geo,
        geoVerified: await this.verifyGeography(page, options.geo),
        screenshotPath,
        cost: this.calculateCost(options.geo),
        warnings: []
      };

    } catch (error) {
      return {
        success: false,
        url,
        finalUrl: url,
        statusCode: 0,
        html: '',
        contentLength: 0,
        executionTime: Date.now() - startTime,
        javascriptRendered: false,
        antiBotEvents: [...this.antiBotEvents],
        geoVerified: false,
        error: error.message,
        warnings: []
      };

    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Execute for multiple URLs concurrently
   */
  async executeMany(urls, options = {}, concurrency = 3) {
    const results = [];
    const queue = [...urls];

    const worker = async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (url) {
          results.push(await this.execute(url, options));
        }
      }
    };

    await Promise.all(
      Array(Math.min(concurrency, urls.length)).fill(null).map(() => worker())
    );

    return results;
  }

  /**
   * Execute across multiple geographies
   */
  async executeMultiGeo(url, geos, options = {}) {
    const results = new Map();

    for (const geo of geos) {
      await this.disconnect(); // Fresh connection per geo
      const result = await this.execute(url, { ...options, geo });
      results.set(geo, result);
    }

    return results;
  }

  /**
   * Connect to Bright Data Scraping Browser
   *
   * Connection format:
   * wss://brd-customer-{customer_id}-zone-{zone}[-country-{country}]:{password}@brd.superproxy.io:9222
   */
  async connect(geo) {
    const endpoint = this.buildBrightDataEndpoint(geo);

    this.browser = await puppeteer.connect({
      browserWSEndpoint: endpoint
    });

    this.emit('connected', { geo });
  }

  /**
   * Disconnect browser
   */
  async disconnect() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.emit('disconnected');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  buildBrightDataEndpoint(geo) {
    let auth = `brd-customer-${this.config.customerId}-zone-${this.config.zone}`;
    if (geo) {
      auth += `-country-${geo}`;
    }
    return `wss://${auth}:${this.config.password}@brd.superproxy.io:9222`;
  }

  async configurePage(page, options) {
    await page.setViewport(this.config.viewport);

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.emit('page-error', { text: msg.text() });
      }
    });
  }

  async navigateWithRetry(page, url, options) {
    let response = null;
    let lastError = null;

    for (let attempt = 0; attempt < this.config.antiBotRetries; attempt++) {
      try {
        response = await page.goto(url, {
          waitUntil: this.config.waitUntil,
          timeout: this.config.timeout
        });

        // Check for anti-bot challenges
        const challenge = await this.detectChallenge(page);

        if (challenge) {
          this.antiBotEvents.push({
            type: challenge.type,
            timestamp: new Date(),
            resolved: false
          });

          this.emit('antibot-challenge', { type: challenge.type });

          // Wait for resolution (Bright Data handles this automatically)
          const resolved = await this.waitForChallengeResolution(page);

          this.antiBotEvents[this.antiBotEvents.length - 1].resolved = resolved;

          if (!resolved) {
            throw new Error(`Anti-bot challenge not resolved: ${challenge.type}`);
          }

          // Reload after resolution
          response = await page.reload({
            waitUntil: this.config.waitUntil,
            timeout: this.config.timeout
          });
        }

        if (response && response.status() < 400) {
          return response;
        }

      } catch (error) {
        lastError = error;
        if (attempt < this.config.antiBotRetries - 1) {
          await this.delay(2000 * (attempt + 1));
        }
      }
    }

    if (lastError) throw lastError;
    return response;
  }

  async detectChallenge(page) {
    const content = await page.content();
    const url = page.url();

    // Cloudflare challenge
    if (content.includes('cf-browser-verification') ||
        content.includes('challenge-running') ||
        url.includes('cf_chl')) {
      return { type: 'challenge' };
    }

    // CAPTCHA
    if (content.includes('captcha') ||
        content.includes('recaptcha') ||
        content.includes('hcaptcha')) {
      return { type: 'captcha' };
    }

    // Fingerprint check
    if (content.includes('browser check') ||
        content.includes('validating your browser')) {
      return { type: 'fingerprint' };
    }

    // Rate limiting
    if (content.includes('rate limit') ||
        content.includes('too many requests')) {
      return { type: 'rate-limit' };
    }

    return null;
  }

  async waitForChallengeResolution(page) {
    const maxWait = 30000;
    const checkInterval = 1000;
    let waited = 0;

    while (waited < maxWait) {
      await this.delay(checkInterval);
      waited += checkInterval;

      const challenge = await this.detectChallenge(page);
      if (!challenge) return true;
    }

    return false;
  }

  async extractData(page, selectors) {
    const data = {};

    for (const [key, selector] of Object.entries(selectors)) {
      try {
        const elements = await page.$$(selector);

        if (elements.length === 0) {
          data[key] = null;
        } else if (elements.length === 1) {
          data[key] = await page.evaluate(el => el.textContent?.trim(), elements[0]);
        } else {
          data[key] = await Promise.all(
            elements.map(el => page.evaluate(e => e.textContent?.trim(), el))
          );
        }
      } catch {
        data[key] = null;
      }
    }

    return data;
  }

  async verifyGeography(page, expectedGeo) {
    if (!expectedGeo) return true;

    try {
      const geoIndicators = await page.evaluate(() => {
        const currencies = {
          us: ['$', 'USD'],
          uk: ['£', 'GBP'],
          de: ['€', 'EUR'],
          jp: ['¥', 'JPY']
        };

        const text = document.body.innerText;
        const detected = [];

        for (const [geo, symbols] of Object.entries(currencies)) {
          if (symbols.some(s => text.includes(s))) {
            detected.push(geo);
          }
        }

        return detected;
      });

      return geoIndicators.includes(expectedGeo.toLowerCase());
    } catch {
      return false;
    }
  }

  calculateCost(geo) {
    const isAdvanced = this.config.level === 'advanced';
    const baseCost = isAdvanced ? 0.025 : 0.01;
    const geoPremiums = { us: 0, uk: 0.002, de: 0.002, default: 0.005 };
    const geoCost = geoPremiums[geo?.toLowerCase()] ?? geoPremiums.default;

    return {
      level: this.config.level,
      baseCost,
      geoCost,
      totalCost: baseCost + geoCost
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: DYNAMIC CONTENT HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
//
// Handles dynamic content loading patterns like infinite scroll, pagination,
// and "load more" buttons that are common on modern websites.

/**
 * Handles dynamic content loading patterns
 *
 * Supported patterns:
 * - Infinite scroll (scroll to load more)
 * - Pagination (click next/page buttons)
 * - Load more buttons
 *
 * @example
 * const handler = new DynamicContentHandler();
 * const result = await handler.handleInfiniteScroll(page, {
 *   itemSelector: '.product-card',
 *   maxItems: 100
 * });
 */
class DynamicContentHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      scrollDelay: config.scrollDelay || 1000,
      maxScrolls: config.maxScrolls || 20,
      itemTimeout: config.itemTimeout || 5000
    };
  }

  /**
   * Handle infinite scroll pagination
   */
  async handleInfiniteScroll(page, options = {}) {
    const {
      itemSelector,
      maxItems = 100,
      maxScrolls = this.config.maxScrolls,
      scrollDelay = this.config.scrollDelay
    } = options;

    let previousCount = 0;
    let scrollCount = 0;
    let noNewItemsCount = 0;
    const itemsPerScroll = [];

    while (scrollCount < maxScrolls) {
      // Count current items
      const currentCount = await page.$$eval(itemSelector, els => els.length);

      // Track new items
      const newItems = currentCount - previousCount;
      itemsPerScroll.push(newItems);

      this.emit('scroll', {
        scrollCount,
        itemCount: currentCount,
        newItems
      });

      // Check if we have enough items
      if (currentCount >= maxItems) {
        return {
          success: true,
          totalItems: currentCount,
          scrollsPerformed: scrollCount,
          itemsPerScroll,
          reachedEnd: false
        };
      }

      // Check if we've stopped getting new items
      if (newItems === 0) {
        noNewItemsCount++;
        if (noNewItemsCount >= 3) {
          return {
            success: true,
            totalItems: currentCount,
            scrollsPerformed: scrollCount,
            itemsPerScroll,
            reachedEnd: true
          };
        }
      } else {
        noNewItemsCount = 0;
      }

      previousCount = currentCount;

      // Scroll down
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      scrollCount++;
      await this.delay(scrollDelay);
    }

    const finalCount = await page.$$eval(itemSelector, els => els.length);

    return {
      success: true,
      totalItems: finalCount,
      scrollsPerformed: scrollCount,
      itemsPerScroll,
      reachedEnd: false
    };
  }

  /**
   * Handle click-based pagination
   */
  async handlePagination(page, options = {}) {
    const {
      itemSelector,
      nextButtonSelector,
      maxPages = 10,
      pageDelay = 2000
    } = options;

    let currentPage = 1;
    const itemsPerPage = [];

    while (currentPage <= maxPages) {
      // Wait for items to load
      await page.waitForSelector(itemSelector, { timeout: this.config.itemTimeout });

      // Count items on this page
      const itemCount = await page.$$eval(itemSelector, els => els.length);
      itemsPerPage.push(itemCount);

      this.emit('page-loaded', {
        page: currentPage,
        itemsOnPage: itemCount
      });

      // Try to click next button
      const nextButton = await page.$(nextButtonSelector);
      if (!nextButton) {
        return {
          success: true,
          totalItems: itemsPerPage.reduce((a, b) => a + b, 0),
          pagesVisited: currentPage,
          itemsPerPage
        };
      }

      // Check if button is disabled
      const isDisabled = await page.evaluate(
        el => el.disabled || el.classList.contains('disabled'),
        nextButton
      );

      if (isDisabled) {
        return {
          success: true,
          totalItems: itemsPerPage.reduce((a, b) => a + b, 0),
          pagesVisited: currentPage,
          itemsPerPage
        };
      }

      await nextButton.click();
      currentPage++;
      await this.delay(pageDelay);
    }

    return {
      success: true,
      totalItems: itemsPerPage.reduce((a, b) => a + b, 0),
      pagesVisited: currentPage - 1,
      itemsPerPage
    };
  }

  /**
   * Handle "load more" button pattern
   */
  async handleLoadMore(page, options = {}) {
    const {
      itemSelector,
      loadMoreSelector,
      maxClicks = 10,
      clickDelay = 2000
    } = options;

    let clickCount = 0;
    const itemsPerClick = [];
    let previousCount = await page.$$eval(itemSelector, els => els.length);

    while (clickCount < maxClicks) {
      const loadMoreButton = await page.$(loadMoreSelector);
      if (!loadMoreButton) {
        break;
      }

      // Check visibility
      const isVisible = await page.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }, loadMoreButton);

      if (!isVisible) break;

      await loadMoreButton.click();
      clickCount++;

      await this.delay(clickDelay);

      const currentCount = await page.$$eval(itemSelector, els => els.length);
      itemsPerClick.push(currentCount - previousCount);

      this.emit('load-more', {
        clickCount,
        itemCount: currentCount,
        newItems: currentCount - previousCount
      });

      previousCount = currentCount;
    }

    const finalCount = await page.$$eval(itemSelector, els => els.length);

    return {
      success: true,
      totalItems: finalCount,
      clicksPerformed: clickCount,
      itemsPerClick
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: GEO VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Validates that web execution results match the expected geographic targeting.
// This is critical for price monitoring across regions.

/**
 * Validates geographic consistency of execution results
 *
 * @example
 * const validator = new GeoValidator();
 * const result = validator.validate(browserResult, 'uk');
 * console.log(result.valid); // true if UK content detected
 */
class GeoValidator {
  constructor() {
    // Currency patterns by geography
    this.currencyPatterns = {
      us: { symbols: ['$', 'US$'], codes: ['USD'] },
      uk: { symbols: ['£'], codes: ['GBP'] },
      de: { symbols: ['€'], codes: ['EUR'] },
      fr: { symbols: ['€'], codes: ['EUR'] },
      jp: { symbols: ['¥', '円'], codes: ['JPY'] }
    };

    // Language indicators
    this.languageIndicators = {
      us: ['en-US', 'english'],
      uk: ['en-GB', 'english'],
      de: ['de-DE', 'deutsch'],
      fr: ['fr-FR', 'français'],
      jp: ['ja-JP', '日本語']
    };
  }

  /**
   * Validate a result against expected geography
   */
  validate(result, expectedGeo) {
    const indicators = [];
    const warnings = [];

    // Check URL/domain
    const domainIndicator = this.detectGeoFromDomain(result.finalUrl);
    if (domainIndicator) indicators.push(domainIndicator);

    // Check currency
    const currencyIndicators = this.detectGeoFromCurrency(result.html);
    indicators.push(...currencyIndicators);

    // Check language
    const languageIndicator = this.detectGeoFromLanguage(result.html);
    if (languageIndicator) indicators.push(languageIndicator);

    // Determine detected geo
    const detectedGeo = this.determineGeo(indicators);

    // Calculate confidence
    const confidence = this.calculateConfidence(indicators, expectedGeo);

    // Validate
    const valid = !detectedGeo ||
                  detectedGeo === expectedGeo.toLowerCase() ||
                  confidence < 0.5;

    if (!valid) {
      warnings.push(`Expected ${expectedGeo} but detected ${detectedGeo}`);
    }

    return {
      valid,
      expectedGeo,
      detectedGeo,
      confidence,
      indicators,
      warnings
    };
  }

  /**
   * Compare results across multiple geographies
   */
  compareMultiGeo(results) {
    const geoResults = new Map();
    const recommendations = [];

    // Validate each result
    for (const [geo, result] of results) {
      const validation = this.validate(result, geo);
      geoResults.set(geo, validation);

      if (!validation.valid) {
        recommendations.push(
          `${geo.toUpperCase()}: Geo mismatch detected. Verify proxy configuration.`
        );
      }
    }

    // Compare prices
    const priceComparison = this.comparePrices(results);

    const validCount = Array.from(geoResults.values()).filter(r => r.valid).length;

    return {
      consistent: validCount === geoResults.size,
      geoResults,
      priceComparison,
      recommendations
    };
  }

  detectGeoFromDomain(url) {
    try {
      const domain = new URL(url).hostname;

      const tldMap = {
        '.co.uk': 'uk',
        '.de': 'de',
        '.fr': 'fr',
        '.jp': 'jp',
        '.ca': 'ca',
        '.com.au': 'au'
      };

      for (const [tld, geo] of Object.entries(tldMap)) {
        if (domain.endsWith(tld)) {
          return { type: 'domain', value: tld, suggestedGeo: geo, confidence: 0.9 };
        }
      }
    } catch {}
    return null;
  }

  detectGeoFromCurrency(html) {
    const indicators = [];

    for (const [geo, patterns] of Object.entries(this.currencyPatterns)) {
      for (const symbol of patterns.symbols) {
        if (html.includes(symbol)) {
          indicators.push({
            type: 'currency',
            value: symbol,
            suggestedGeo: geo,
            confidence: 0.7
          });
        }
      }
    }

    return indicators;
  }

  detectGeoFromLanguage(html) {
    const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);

    if (langMatch) {
      const lang = langMatch[1].toLowerCase();

      for (const [geo, indicators] of Object.entries(this.languageIndicators)) {
        if (indicators.some(i => lang.includes(i.toLowerCase()))) {
          return { type: 'language', value: lang, suggestedGeo: geo, confidence: 0.85 };
        }
      }
    }

    return null;
  }

  determineGeo(indicators) {
    if (indicators.length === 0) return null;

    const scores = new Map();
    for (const indicator of indicators) {
      const current = scores.get(indicator.suggestedGeo) || 0;
      scores.set(indicator.suggestedGeo, current + indicator.confidence);
    }

    let maxScore = 0;
    let maxGeo = null;

    for (const [geo, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        maxGeo = geo;
      }
    }

    return maxGeo;
  }

  calculateConfidence(indicators, expectedGeo) {
    const matching = indicators.filter(i => i.suggestedGeo === expectedGeo.toLowerCase());
    if (matching.length === 0) return 0;

    const avgConfidence = matching.reduce((sum, i) => sum + i.confidence, 0) / matching.length;
    return Math.min(avgConfidence + (matching.length / 3) * 0.2, 1);
  }

  comparePrices(results) {
    const prices = new Map();

    for (const [geo, result] of results) {
      // Extract price from result
      const priceMatch = result.html.match(/[\$£€¥]\s*([\d,]+\.?\d*)/);
      if (priceMatch) {
        prices.set(geo, parseFloat(priceMatch[1].replace(',', '')));
      }
    }

    if (prices.size < 2) return null;

    const priceValues = Array.from(prices.values());
    const min = Math.min(...priceValues);
    const max = Math.max(...priceValues);

    let lowestGeo = '', highestGeo = '';
    for (const [geo, price] of prices) {
      if (price === min) lowestGeo = geo;
      if (price === max) highestGeo = geo;
    }

    return {
      lowestGeo,
      highestGeo,
      variancePercent: ((max - min) / min) * 100,
      prices
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: DEMO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the Part 2 demonstration
 */
async function runDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('    PART 2: BROWSER EXECUTION WITH BRIGHT DATA SCRAPING BROWSER');
  console.log('═'.repeat(60));

  // Check for credentials
  const hasCredentials = process.env.BRIGHTDATA_CUSTOMER_ID &&
                         process.env.BRIGHTDATA_PASSWORD;

  if (!hasCredentials) {
    console.log('\n⚠️  Note: Running in demo mode (no Bright Data credentials)');
    console.log('   Set credentials for live browser execution.\n');
  }

  // Demo 1: Browser vs HTTP Comparison
  console.log('\n' + '-'.repeat(60));
  console.log('🌐 DEMO 1: When to Use Browser Execution');
  console.log('-'.repeat(60));

  const comparisonTable = [
    { target: 'Static HTML Site', http: '✅ Best', browser: '⚠️ Overkill' },
    { target: 'JavaScript SPA', http: '❌ Fails', browser: '✅ Required' },
    { target: 'Light Anti-bot', http: '✅ Works', browser: '✅ Works' },
    { target: 'Heavy Anti-bot', http: '❌ Blocked', browser: '✅ Required' },
    { target: 'Dynamic Content', http: '❌ Missing', browser: '✅ Required' }
  ];

  console.log('\n   Target Environment        | HTTP          | Browser');
  console.log('   ─────────────────────────────────────────────────────');
  for (const row of comparisonTable) {
    console.log(`   ${row.target.padEnd(24)} | ${row.http.padEnd(13)} | ${row.browser}`);
  }

  // Demo 2: Anti-Bot Handling
  console.log('\n' + '-'.repeat(60));
  console.log('🛡️ DEMO 2: Anti-Bot Handling');
  console.log('-'.repeat(60));

  console.log('\n   Bright Data Scraping Browser automatically handles:\n');

  const antiBotTypes = [
    { type: 'Cloudflare', method: 'Real browser execution + valid fingerprints', time: '2-5s' },
    { type: 'PerimeterX', method: 'Human-like interaction patterns', time: '1-3s' },
    { type: 'DataDome', method: 'Rotating browser configurations', time: '1-2s' },
    { type: 'CAPTCHA', method: 'Automatic solving service', time: '5-15s' }
  ];

  for (const antiBot of antiBotTypes) {
    console.log(`   🔒 ${antiBot.type}`);
    console.log(`      Method: ${antiBot.method}`);
    console.log(`      Time Added: ${antiBot.time}`);
    console.log();
  }

  // Demo 3: Multi-Geo Execution
  console.log('-'.repeat(60));
  console.log('🌍 DEMO 3: Multi-Geographic Execution');
  console.log('-'.repeat(60));

  console.log('\n   Simulating price extraction across regions...\n');

  const geoResults = [
    { geo: 'US', price: '$29.99', currency: 'USD', status: '✅ Verified' },
    { geo: 'UK', price: '£24.99', currency: 'GBP', status: '✅ Verified' },
    { geo: 'DE', price: '€27.99', currency: 'EUR', status: '✅ Verified' }
  ];

  console.log('   Region | Price    | Currency | Status');
  console.log('   ─────────────────────────────────────────');
  for (const result of geoResults) {
    console.log(`   ${result.geo.padEnd(6)} | ${result.price.padEnd(8)} | ${result.currency.padEnd(8)} | ${result.status}`);
  }

  // Calculate variance
  const priceVariance = ((29.99 - 24.99) / 24.99 * 100).toFixed(1);
  console.log(`\n   💰 Price Variance: ${priceVariance}%`);
  console.log('   📊 Lowest: UK | Highest: US');

  // Demo 4: Dynamic Content Handling
  console.log('\n' + '-'.repeat(60));
  console.log('📜 DEMO 4: Dynamic Content Handling');
  console.log('-'.repeat(60));

  console.log('\n   Supported Patterns:\n');

  const patterns = [
    { name: 'Infinite Scroll', example: 'Social feeds, product listings', method: 'Auto-scroll + wait for new items' },
    { name: 'Pagination', example: 'Search results, catalogs', method: 'Click next + extract each page' },
    { name: 'Load More Button', example: 'Blogs, galleries', method: 'Click button + wait for content' }
  ];

  for (const pattern of patterns) {
    console.log(`   📄 ${pattern.name}`);
    console.log(`      Example: ${pattern.example}`);
    console.log(`      Method: ${pattern.method}`);
    console.log();
  }

  // Demo 5: Cost Analysis
  console.log('-'.repeat(60));
  console.log('💰 DEMO 5: Cost Analysis');
  console.log('-'.repeat(60));

  const costScenario = {
    products: 500,
    sources: 3,
    geos: 3,
    totalRequests: 500 * 3 * 3
  };

  console.log('\n   Scenario: Multi-Geo Price Monitoring');
  console.log(`   Total Requests: ${costScenario.totalRequests.toLocaleString()}`);

  console.log('\n   Smart Execution Strategy:');
  console.log('   ─────────────────────────────────────────');
  console.log('   Static Site (500×3):    HTTP           → $1.50');
  console.log('   Amazon (500×3):         Browser Light  → $15.00');
  console.log('   React SPA (500×3):      Browser Adv    → $37.50');
  console.log('   ─────────────────────────────────────────');
  console.log('   TOTAL (Smart):          $54.00');
  console.log('   vs All Browser Adv:     $112.50');
  console.log('   SAVINGS:                $58.50 (52%)');

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('       PART 2 DEMO COMPLETE');
  console.log('═'.repeat(60));

  console.log('\n🎯 Key Takeaways:');
  console.log('   1. Browser execution handles JavaScript and anti-bot automatically');
  console.log('   2. Bright Data manages fingerprinting - you just make requests');
  console.log('   3. Multi-geo execution validates pricing consistency');
  console.log('   4. Smart level selection optimizes costs significantly');

  console.log('\n➡️  Continue to Part 3: MCP Execution for AI-Native Workflows\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Classes
  BrowserExecutor,
  DynamicContentHandler,
  GeoValidator,

  // Factory functions
  createBrowserExecutor: (config) => new BrowserExecutor(config),
  createDynamicContentHandler: (config) => new DynamicContentHandler(config),
  createGeoValidator: () => new GeoValidator(),

  // Demo
  runDemo
};

// Run demo if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}
