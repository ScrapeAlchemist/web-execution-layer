/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PART 1: HTTP EXECUTION WITH BRIGHT DATA WEB UNLOCKER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module covers HTTP-level web execution for simple environments using
 * Bright Data's Web Unlocker product.
 *
 * WHEN TO USE HTTP EXECUTION:
 * - Static HTML pages with server-rendered content
 * - APIs that return JSON data
 * - Sites with minimal or no anti-bot protection
 * - When you need maximum speed and lowest cost
 *
 * BRIGHT DATA WEB UNLOCKER:
 * Web Unlocker automatically handles common challenges:
 * - CAPTCHA solving
 * - IP rotation
 * - Header management
 * - Basic fingerprint management
 *
 * COST: ~$0.001 per request (cheapest execution level)
 *
 * @see https://docs.brightdata.com/scraping-automation/web-unlocker/introduction
 */

const axios = require('axios');
const { EventEmitter } = require('events');

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: ENVIRONMENT ANALYZER
// ═══════════════════════════════════════════════════════════════════════════════
//
// Before making a request, we analyze the target URL to determine if HTTP
// execution is appropriate, or if we should escalate to browser execution.

/**
 * Analyzes web environments to determine the best execution strategy.
 *
 * The analyzer checks for:
 * - JavaScript framework indicators (React, Vue, Angular, etc.)
 * - Anti-bot protection (Cloudflare, PerimeterX, DataDome, etc.)
 * - Dynamic content patterns (infinite scroll, lazy loading)
 *
 * @example
 * const analyzer = new EnvironmentAnalyzer();
 * const analysis = await analyzer.analyze('https://example.com');
 *
 * if (analysis.recommendedExecution === 'http') {
 *   // Safe to use HTTP execution
 * } else {
 *   // Should escalate to browser execution
 * }
 */
class EnvironmentAnalyzer {
  constructor() {
    // Patterns that indicate JavaScript is required
    this.jsFrameworkPatterns = [
      'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt',
      '__NEXT_DATA__', '__NUXT__', 'ng-app', 'data-reactroot'
    ];

    // Patterns that indicate anti-bot protection
    this.antiBotPatterns = [
      'cloudflare', 'incapsula', 'perimeterx', 'datadome',
      'kasada', 'akamai', 'cf-browser-verification',
      'challenge-platform', '_cf_chl'
    ];

    // Patterns that indicate dynamic content
    this.dynamicContentPatterns = [
      'infinite-scroll', 'load-more', 'lazy-load',
      'data-src', 'data-lazy', 'intersection-observer'
    ];
  }

  /**
   * Analyze a URL to determine execution requirements
   */
  async analyze(url) {
    const startTime = Date.now();
    const signals = {
      requiresJavaScript: false,
      hasAntiBot: false,
      hasDynamicContent: false,
      confidence: 0
    };

    try {
      // Make a lightweight request to analyze the response
      const response = await axios.get(url, {
        timeout: 15000,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Analyze response headers for protection indicators
      this.analyzeHeaders(response.headers, signals);

      // Analyze HTML content for framework and protection patterns
      if (typeof response.data === 'string') {
        this.analyzeContent(response.data, signals);
      }

      // Determine complexity and recommended execution level
      const complexity = this.calculateComplexity(signals);

      return {
        url,
        analyzedAt: new Date(),
        duration: Date.now() - startTime,
        signals,
        complexity,
        recommendedExecution: this.getRecommendedExecution(complexity, signals),
        confidence: Math.min(signals.confidence, 1),
        details: this.generateDetails(signals)
      };

    } catch (error) {
      // If analysis fails, recommend browser execution to be safe
      return {
        url,
        analyzedAt: new Date(),
        duration: Date.now() - startTime,
        signals,
        complexity: 'high',
        recommendedExecution: 'browser-advanced',
        confidence: 0.3,
        error: error.message,
        details: ['Analysis failed - recommending browser execution for safety']
      };
    }
  }

  analyzeHeaders(headers, signals) {
    // Check for Cloudflare
    if (headers['cf-ray'] || headers['cf-cache-status']) {
      signals.hasAntiBot = true;
      signals.confidence += 0.2;
    }

    // Check for other protection services
    const headerString = JSON.stringify(headers).toLowerCase();
    if (headerString.includes('incapsula') ||
        headerString.includes('perimeterx') ||
        headerString.includes('datadome')) {
      signals.hasAntiBot = true;
      signals.confidence += 0.3;
    }
  }

  analyzeContent(html, signals) {
    const lowerHtml = html.toLowerCase();

    // Check for JavaScript frameworks
    for (const pattern of this.jsFrameworkPatterns) {
      if (lowerHtml.includes(pattern.toLowerCase())) {
        signals.requiresJavaScript = true;
        signals.confidence += 0.15;
        break;
      }
    }

    // Check for anti-bot patterns
    for (const pattern of this.antiBotPatterns) {
      if (lowerHtml.includes(pattern.toLowerCase())) {
        signals.hasAntiBot = true;
        signals.confidence += 0.2;
        break;
      }
    }

    // Check for dynamic content
    for (const pattern of this.dynamicContentPatterns) {
      if (lowerHtml.includes(pattern.toLowerCase())) {
        signals.hasDynamicContent = true;
        signals.confidence += 0.1;
        break;
      }
    }

    // Check for minimal content (likely SPA)
    if (html.length < 5000) {
      const textContent = html.replace(/<[^>]*>/g, '').trim();
      if (textContent.length < 500) {
        signals.requiresJavaScript = true;
        signals.confidence += 0.3;
      }
    }
  }

  calculateComplexity(signals) {
    if (signals.hasAntiBot) return 'high';
    if (signals.requiresJavaScript || signals.hasDynamicContent) return 'medium';
    return 'low';
  }

  getRecommendedExecution(complexity, signals) {
    if (complexity === 'high') return 'browser-advanced';
    if (complexity === 'medium') return signals.hasAntiBot ? 'browser-advanced' : 'browser-light';
    return 'http';
  }

  generateDetails(signals) {
    const details = [];
    if (signals.requiresJavaScript) details.push('JavaScript rendering required');
    if (signals.hasAntiBot) details.push('Anti-bot protection detected');
    if (signals.hasDynamicContent) details.push('Dynamic content loading detected');
    if (details.length === 0) details.push('Simple static page detected');
    return details;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: COST TRACKER
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tracking costs is essential for optimizing your web execution pipeline.
// Different execution levels have different costs, and geographic targeting
// adds additional premiums.

/**
 * Tracks execution costs across different levels.
 *
 * Cost hierarchy (per request):
 * - HTTP (Web Unlocker): ~$0.001
 * - Browser Light: ~$0.01
 * - Browser Advanced: ~$0.025
 *
 * Geographic premiums add $0.001-$0.005 per request.
 *
 * @example
 * const tracker = new CostTracker();
 * tracker.record('http', { url: 'https://example.com', geo: 'us' });
 * console.log(tracker.getSummary());
 */
class CostTracker {
  constructor() {
    this.records = [];

    // Cost rates per execution level
    this.rates = {
      'http': { base: 0.001, perKB: 0.00001 },
      'browser-light': { base: 0.01, perKB: 0.00005 },
      'browser-advanced': { base: 0.025, perKB: 0.0001 }
    };

    // Geographic premium costs
    this.geoPremiums = {
      us: 0,
      uk: 0.002,
      de: 0.002,
      jp: 0.005,
      default: 0.005
    };
  }

  /**
   * Record a cost for an execution
   */
  record(level, details = {}) {
    const cost = this.calculateCost(level, details);
    const record = {
      level,
      cost,
      timestamp: new Date(),
      details
    };
    this.records.push(record);
    return cost;
  }

  /**
   * Calculate cost for an execution
   */
  calculateCost(level, details = {}) {
    const rates = this.rates[level] || this.rates['http'];

    // Base cost
    const baseCost = rates.base;

    // Data transfer cost
    const bytes = details.bytesTransferred || 0;
    const dataCost = (bytes / 1024) * rates.perKB;

    // Geographic premium
    const geo = (details.geo || 'us').toLowerCase();
    const geoPremium = this.geoPremiums[geo] ?? this.geoPremiums.default;

    return {
      baseCost,
      dataCost,
      geoPremium,
      totalCost: baseCost + dataCost + geoPremium
    };
  }

  /**
   * Get cost summary
   */
  getSummary() {
    const byLevel = {};
    let total = 0;

    for (const record of this.records) {
      const levelCost = record.cost.totalCost;
      byLevel[record.level] = (byLevel[record.level] || 0) + levelCost;
      total += levelCost;
    }

    return {
      total,
      byLevel,
      recordCount: this.records.length,
      averageCost: this.records.length > 0 ? total / this.records.length : 0
    };
  }

  reset() {
    this.records = [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: HTTP EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════════
//
// The main executor that makes HTTP requests through Bright Data's Web Unlocker.
// Web Unlocker handles common challenges automatically.

/**
 * HTTP Executor using Bright Data Web Unlocker
 *
 * Web Unlocker proxy format:
 * http://brd-customer-{customer_id}-zone-{zone}[-country-{country}]:{password}@brd.superproxy.io:22225
 *
 * @example
 * const executor = new HttpExecutor({
 *   customerId: process.env.BRIGHTDATA_CUSTOMER_ID,
 *   zone: 'web_unlocker',
 *   password: process.env.BRIGHTDATA_PASSWORD
 * });
 *
 * const result = await executor.fetch('https://example.com', { geo: 'us' });
 * console.log(result.body);
 */
class HttpExecutor {
  constructor(config = {}) {
    this.config = {
      // Bright Data credentials
      customerId: config.customerId || process.env.BRIGHTDATA_CUSTOMER_ID || '',
      zone: config.zone || process.env.BRIGHTDATA_ZONE_WEB_UNLOCKER || 'web_unlocker',
      password: config.password || process.env.BRIGHTDATA_PASSWORD || '',

      // Web Unlocker endpoint
      proxyHost: config.proxyHost || 'brd.superproxy.io',
      proxyPort: config.proxyPort || 22225,

      // Request settings
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelay: config.retryDelay || 1000,
      userAgent: config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    this.costTracker = new CostTracker();
    this.analyzer = new EnvironmentAnalyzer();
  }

  /**
   * Execute HTTP request via Bright Data Web Unlocker
   *
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {string} options.geo - Geographic targeting (e.g., 'us', 'uk', 'de')
   * @param {string} options.method - HTTP method (default: 'GET')
   * @param {Object} options.headers - Additional headers
   * @returns {Promise<Object>} Execution result
   */
  async fetch(url, options = {}) {
    const startTime = Date.now();
    let lastError = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const result = await this.executeRequest(url, options, startTime, retryCount);
        return result;
      } catch (error) {
        lastError = error;
        retryCount++;

        if (attempt < this.config.retries) {
          // Check if we should escalate instead of retry
          if (this.shouldEscalate(error)) {
            return this.buildEscalationResult(url, startTime, retryCount, error);
          }

          // Wait before retry with exponential backoff
          await this.delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    return this.buildFailureResult(url, startTime, retryCount, lastError);
  }

  /**
   * Fetch with pre-flight environmental analysis
   */
  async fetchWithAnalysis(url, options = {}) {
    const analysis = await this.analyzer.analyze(url);

    // Skip if environment is too complex for HTTP
    if (analysis.recommendedExecution !== 'http' && analysis.confidence > 0.7) {
      return {
        analysis,
        result: null,
        skipped: true,
        skipReason: `Environment too complex for HTTP. Recommended: ${analysis.recommendedExecution}`
      };
    }

    const result = await this.fetch(url, options);
    return { analysis, result, skipped: false };
  }

  /**
   * Fetch multiple URLs concurrently
   */
  async fetchMany(urls, options = {}, concurrency = 5) {
    const results = [];
    const queue = [...urls];

    const worker = async () => {
      while (queue.length > 0) {
        const url = queue.shift();
        if (url) {
          results.push(await this.fetch(url, options));
        }
      }
    };

    await Promise.all(
      Array(Math.min(concurrency, urls.length)).fill(null).map(() => worker())
    );

    return results;
  }

  async executeRequest(url, options, startTime, retryCount) {
    const axiosConfig = this.buildAxiosConfig(url, options);
    const response = await axios(axiosConfig);
    const executionTime = Date.now() - startTime;

    // Check if result indicates we should escalate
    const escalationCheck = this.checkForEscalationSignals(response);

    // Track cost
    const cost = this.costTracker.record('http', {
      url,
      bytesTransferred: response.data?.length || 0,
      geo: options.geo
    });

    return {
      success: true,
      url,
      statusCode: response.status,
      headers: response.headers,
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
      contentLength: response.data?.length || 0,
      executionTime,
      retryCount,
      proxyUsed: this.isProxyConfigured(),
      cost,
      escalationNeeded: escalationCheck.needed,
      escalationReason: escalationCheck.reason
    };
  }

  /**
   * Build Axios config with Bright Data Web Unlocker proxy
   */
  buildAxiosConfig(url, options) {
    const config = {
      url,
      method: options.method || 'GET',
      timeout: this.config.timeout,
      headers: {
        'User-Agent': this.config.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers
      },
      validateStatus: (status) => status < 500
    };

    // Add Bright Data Web Unlocker proxy if configured
    if (this.isProxyConfigured()) {
      // Build proxy username: brd-customer-{id}-zone-{zone}[-country-{geo}]
      let proxyUsername = `brd-customer-${this.config.customerId}-zone-${this.config.zone}`;
      if (options.geo) {
        proxyUsername += `-country-${options.geo}`;
      }

      config.proxy = {
        host: this.config.proxyHost,
        port: this.config.proxyPort,
        auth: {
          username: proxyUsername,
          password: this.config.password
        }
      };
    }

    return config;
  }

  isProxyConfigured() {
    return !!(this.config.customerId && this.config.password);
  }

  checkForEscalationSignals(response) {
    const body = typeof response.data === 'string' ? response.data : '';

    // Check for JavaScript-required indicators
    if (body.includes('Please enable JavaScript') ||
        body.includes('JavaScript is required')) {
      return { needed: true, reason: 'JavaScript required' };
    }

    // Check for unresolved challenges
    if ((response.status === 403 || response.status === 503) &&
        (body.includes('challenge') || body.includes('captcha'))) {
      return { needed: true, reason: 'Challenge not resolved' };
    }

    // Check for minimal content (likely SPA)
    if (body.length < 1000) {
      const textContent = body.replace(/<[^>]*>/g, '').trim();
      if (textContent.length < 100) {
        return { needed: true, reason: 'Minimal content - likely SPA' };
      }
    }

    return { needed: false };
  }

  shouldEscalate(error) {
    const message = error.message.toLowerCase();
    return message.includes('403') ||
           message.includes('forbidden') ||
           message.includes('blocked') ||
           message.includes('challenge');
  }

  buildEscalationResult(url, startTime, retryCount, error) {
    return {
      success: false,
      url,
      statusCode: 0,
      body: '',
      executionTime: Date.now() - startTime,
      retryCount,
      escalationNeeded: true,
      escalationReason: `Web Unlocker could not handle - ${error.message}`,
      error: error.message
    };
  }

  buildFailureResult(url, startTime, retryCount, error) {
    return {
      success: false,
      url,
      statusCode: 0,
      body: '',
      executionTime: Date.now() - startTime,
      retryCount,
      escalationNeeded: false,
      error: error.message
    };
  }

  getCostSummary() {
    return this.costTracker.getSummary();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: ESCALATION HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
//
// When HTTP execution fails or returns insufficient results, the escalation
// handler automatically escalates to browser execution.

/**
 * Handles automatic escalation between execution levels
 *
 * Escalation triggers:
 * - JavaScript-required pages
 * - Anti-bot challenges not resolved
 * - Empty/minimal content (SPA)
 * - 403/503 responses
 *
 * @example
 * const handler = new EscalationHandler();
 * const result = await handler.executeWithEscalation(url, {
 *   http: httpExecutor,
 *   'browser-light': browserExecutor
 * });
 */
class EscalationHandler extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      levels: ['http', 'browser-light', 'browser-advanced'],
      autoEscalate: config.autoEscalate !== false,
      escalationDelay: config.escalationDelay || 1000
    };
    this.escalationHistory = [];
  }

  /**
   * Execute with automatic escalation
   */
  async executeWithEscalation(url, executors, options = {}) {
    let currentLevel = options.startLevel || 'http';
    let escalationCount = 0;

    while (escalationCount < this.config.levels.length) {
      const executor = executors[currentLevel];
      if (!executor) break;

      this.emit('execution-start', { url, level: currentLevel });

      try {
        const result = await this.executeAtLevel(executor, url, options);

        // Check if escalation is needed
        if (result.escalationNeeded && this.config.autoEscalate) {
          const nextLevel = this.getNextLevel(currentLevel);
          if (nextLevel) {
            this.emit('escalation', {
              url,
              fromLevel: currentLevel,
              toLevel: nextLevel,
              reason: result.escalationReason
            });

            this.escalationHistory.push({
              url,
              fromLevel: currentLevel,
              reason: result.escalationReason,
              timestamp: new Date()
            });

            currentLevel = nextLevel;
            escalationCount++;
            await this.delay(this.config.escalationDelay);
            continue;
          }
        }

        return {
          ...result,
          executionLevel: currentLevel,
          escalationCount
        };

      } catch (error) {
        const nextLevel = this.getNextLevel(currentLevel);
        if (nextLevel && this.config.autoEscalate) {
          currentLevel = nextLevel;
          escalationCount++;
          continue;
        }
        throw error;
      }
    }
  }

  async executeAtLevel(executor, url, options) {
    if (typeof executor === 'function') return executor(url, options);
    if (executor.fetch) return executor.fetch(url, options);
    if (executor.execute) return executor.execute(url, options);
    throw new Error('Invalid executor');
  }

  getNextLevel(current) {
    const idx = this.config.levels.indexOf(current);
    return idx < this.config.levels.length - 1 ? this.config.levels[idx + 1] : null;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: DEMO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the Part 1 demonstration
 */
async function runDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('    PART 1: HTTP EXECUTION WITH BRIGHT DATA WEB UNLOCKER');
  console.log('═'.repeat(60));

  // Check for credentials
  const hasCredentials = process.env.BRIGHTDATA_CUSTOMER_ID &&
                         process.env.BRIGHTDATA_PASSWORD;

  if (!hasCredentials) {
    console.log('\n⚠️  Note: Running in demo mode (no Bright Data credentials)');
    console.log('   Set BRIGHTDATA_CUSTOMER_ID and BRIGHTDATA_PASSWORD for live execution.\n');
  }

  // Demo 1: Environment Analysis
  console.log('\n' + '-'.repeat(60));
  console.log('📊 DEMO 1: Environment Analysis');
  console.log('-'.repeat(60));

  const analyzer = new EnvironmentAnalyzer();
  const testUrls = [
    { url: 'https://books.toscrape.com/', expected: 'http', reason: 'Static HTML site' },
    { url: 'https://www.amazon.com/', expected: 'browser-light', reason: 'JavaScript-heavy' },
    { url: 'https://www.squarespace.com/', expected: 'browser-advanced', reason: 'Heavy protection' }
  ];

  console.log('\n   Analyzing target environments...\n');

  for (const test of testUrls) {
    console.log(`   📍 ${test.url}`);
    console.log(`      Expected: ${test.expected} (${test.reason})`);

    // Simulated analysis (in workshop, this would do real analysis)
    const mockAnalysis = {
      recommendedExecution: test.expected,
      confidence: 0.85,
      details: [test.reason]
    };

    console.log(`      Recommended: ${mockAnalysis.recommendedExecution}`);
    console.log(`      Confidence: ${(mockAnalysis.confidence * 100).toFixed(0)}%`);
    console.log();
  }

  // Demo 2: Cost Comparison
  console.log('-'.repeat(60));
  console.log('💰 DEMO 2: Cost Comparison');
  console.log('-'.repeat(60));

  const scenario = {
    products: 500,
    sources: 3,
    geos: 3,
    totalRequests: 500 * 3 * 3
  };

  console.log('\n   Workshop Scenario:');
  console.log(`   Products:       ${scenario.products}`);
  console.log(`   Sources:        ${scenario.sources}`);
  console.log(`   Geographies:    ${scenario.geos}`);
  console.log(`   Total Requests: ${scenario.totalRequests.toLocaleString()}`);

  console.log('\n   Cost by Execution Level:');
  console.log('   ─────────────────────────────────────────────────');

  const costs = {
    http: { perRequest: 0.001, total: scenario.totalRequests * 0.001 },
    'browser-light': { perRequest: 0.01, total: scenario.totalRequests * 0.01 },
    'browser-advanced': { perRequest: 0.025, total: scenario.totalRequests * 0.025 }
  };

  for (const [level, cost] of Object.entries(costs)) {
    console.log(`\n   ${level.toUpperCase()}`);
    console.log(`     Per Request: $${cost.perRequest.toFixed(4)}`);
    console.log(`     Total Cost:  $${cost.total.toFixed(2)}`);
  }

  // Demo 3: HTTP Execution Flow
  console.log('\n' + '-'.repeat(60));
  console.log('🌐 DEMO 3: HTTP Execution Flow');
  console.log('-'.repeat(60));

  console.log('\n   Simulating HTTP execution with Web Unlocker...\n');

  const mockResults = [
    { url: 'https://competitor-b.com/pricing', status: 200, time: 850, level: 'http' },
    { url: 'https://competitor-b.com/products', status: 200, time: 920, level: 'http' },
    { url: 'https://competitor-b.com/features', status: 200, time: 780, level: 'http' }
  ];

  for (const result of mockResults) {
    console.log(`   ✅ ${result.url}`);
    console.log(`      Status: ${result.status}`);
    console.log(`      Time: ${result.time}ms`);
    console.log(`      Level: ${result.level}`);
    console.log();
  }

  // Demo 4: Escalation Triggers
  console.log('-'.repeat(60));
  console.log('⬆️  DEMO 4: Escalation Triggers');
  console.log('-'.repeat(60));

  console.log('\n   When HTTP execution detects these signals, it escalates:\n');

  const triggers = [
    { signal: 'JavaScript Required', example: '"Please enable JavaScript"' },
    { signal: 'Anti-bot Challenge', example: 'Cloudflare verification page' },
    { signal: 'Minimal Content', example: '<div id="root"></div> (SPA)' },
    { signal: 'Blocked Response', example: '403 Forbidden status' }
  ];

  for (const trigger of triggers) {
    console.log(`   🔄 ${trigger.signal}`);
    console.log(`      Example: ${trigger.example}`);
    console.log();
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('       PART 1 DEMO COMPLETE');
  console.log('═'.repeat(60));

  console.log('\n🎯 Key Takeaways:');
  console.log('   1. HTTP execution is fastest and cheapest');
  console.log('   2. Web Unlocker handles basic CAPTCHA and IP rotation');
  console.log('   3. Environment analysis helps choose the right level');
  console.log('   4. Automatic escalation handles complex sites');

  console.log('\n➡️  Continue to Part 2: Browser Execution for Complex Environments\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Classes
  EnvironmentAnalyzer,
  CostTracker,
  HttpExecutor,
  EscalationHandler,

  // Factory functions
  createEnvironmentAnalyzer: () => new EnvironmentAnalyzer(),
  createCostTracker: () => new CostTracker(),
  createHttpExecutor: (config) => new HttpExecutor(config),
  createEscalationHandler: (config) => new EscalationHandler(config),

  // Demo
  runDemo
};

// Run demo if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}
