/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PART 3: MCP EXECUTION FOR AI-NATIVE WORKFLOWS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module covers AI-native web execution using the Model Context Protocol (MCP)
 * with Bright Data's MCP Server for autonomous agent workflows.
 *
 * WHAT IS MCP?
 * Model Context Protocol (MCP) is a standard for connecting AI models to external
 * tools and data sources. Bright Data's MCP Server provides AI agents with
 * native web execution capabilities.
 *
 * WHEN TO USE MCP EXECUTION:
 * - Building AI agents that need to search and browse the web
 * - Autonomous research tasks with unpredictable navigation paths
 * - When the AI needs to make decisions about what to scrape next
 * - Complex multi-step workflows that adapt based on findings
 *
 * BRIGHT DATA MCP SERVER TOOLS:
 * - search_engine: Search Google and get structured results
 * - scrape_as_markdown: Scrape a URL and return markdown content
 * - scrape_as_html: Scrape a URL and return HTML content
 * - session_start/navigate/click/type/screenshot/end: Browser session management
 *
 * The MCP Server automatically selects the appropriate execution level
 * (HTTP, Browser Light, Browser Advanced) based on the target environment.
 *
 * @see https://github.com/luminati-io/brightdata-mcp
 * @see https://docs.brightdata.com/scraping-automation/mcp/introduction
 */

const { EventEmitter } = require('events');
const axios = require('axios');

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: MCP CLIENT
// ═══════════════════════════════════════════════════════════════════════════════
//
// Client for interacting with Bright Data's MCP Server.
// Provides high-level methods for web search, scraping, and navigation.

/**
 * MCP Client for Bright Data Web MCP
 *
 * In production, this connects to the actual Bright Data MCP Server.
 * For the workshop demo, it simulates responses to show the flow.
 *
 * MCP Tools Available:
 * - web_search: Search the web using SERP API
 * - web_scrape: Scrape a URL with automatic level selection
 * - web_navigate: Execute multi-step browser navigation
 *
 * @example
 * const mcp = new MCPClient({
 *   apiToken: process.env.BRIGHTDATA_API_TOKEN
 * });
 *
 * // Search for competitors
 * const results = await mcp.webSearch({ query: 'shopify alternatives' });
 *
 * // Scrape a specific URL
 * const data = await mcp.webScrape({ url: 'https://example.com/pricing', geo: 'us' });
 */
class MCPClient extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      apiToken: config.apiToken || process.env.BRIGHTDATA_API_TOKEN || '',
      zone: config.zone || 'mcp',
      baseUrl: config.baseUrl || 'https://api.brightdata.com/mcp',
      timeout: config.timeout || 60000,
      autoEscalate: config.autoEscalate !== false
    };

    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
        'Content-Type': 'application/json'
      }
    });

    this.callHistory = [];
    this.totalCost = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Core MCP Tools
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * web_search - Search the web using Bright Data's SERP API
   *
   * Returns structured search results with URLs and snippets.
   * Also includes environment hints to help choose execution level.
   *
   * @param {Object} options - Search options
   * @param {string} options.query - Search query
   * @param {number} options.limit - Max results (default: 10)
   * @param {string} options.country - Target country
   * @returns {Promise<Object[]>} Search results
   */
  async webSearch(options) {
    const startTime = Date.now();
    this.emit('tool-start', { tool: 'web_search', input: options });

    try {
      // In production, this calls the actual MCP endpoint
      const results = await this.executeSearch(options);

      const duration = Date.now() - startTime;
      const cost = this.calculateSearchCost(options.limit || 10);

      this.recordCall({
        tool: 'web_search',
        input: options,
        output: results,
        duration,
        cost
      });

      this.emit('tool-complete', { tool: 'web_search', results: results.length, duration, cost });

      return results;

    } catch (error) {
      this.emit('tool-error', { tool: 'web_search', error });
      throw error;
    }
  }

  /**
   * web_scrape - Scrape a URL with automatic execution level selection
   *
   * The MCP Server automatically determines the best execution level:
   * - Simple static pages → HTTP
   * - JavaScript required → Browser Light
   * - Anti-bot protected → Browser Advanced
   *
   * @param {Object} options - Scrape options
   * @param {string} options.url - URL to scrape
   * @param {string} options.geo - Geographic targeting
   * @param {boolean} options.autoEscalate - Allow automatic escalation
   * @param {string} options.forceLevel - Force specific execution level
   * @returns {Promise<Object>} Scrape result
   */
  async webScrape(options) {
    const startTime = Date.now();
    this.emit('tool-start', { tool: 'web_scrape', input: options });

    try {
      // Determine execution level based on URL analysis
      const executionLevel = options.forceLevel ||
        (this.config.autoEscalate
          ? await this.determineExecutionLevel(options.url)
          : 'http');

      // Execute scrape
      const result = await this.executeScrape(options, executionLevel);

      const duration = Date.now() - startTime;
      const cost = this.calculateScrapeCost(executionLevel, options.geo);

      const finalResult = {
        ...result,
        executionLevel,
        cost,
        duration
      };

      this.recordCall({
        tool: 'web_scrape',
        input: options,
        output: finalResult,
        duration,
        cost
      });

      this.emit('tool-complete', { tool: 'web_scrape', executionLevel, duration, cost });

      return finalResult;

    } catch (error) {
      this.emit('tool-error', { tool: 'web_scrape', error });
      throw error;
    }
  }

  /**
   * web_scrape_multi_geo - Scrape a URL from multiple geographies
   *
   * Useful for price comparison across regions.
   *
   * @param {Object} options - Scrape options
   * @param {string} options.url - URL to scrape
   * @param {string[]} options.geos - List of geographies
   * @returns {Promise<Map>} Map of geo -> result
   */
  async webScrapeMultiGeo(options) {
    const results = new Map();

    for (const geo of options.geos) {
      const result = await this.webScrape({
        url: options.url,
        geo,
        selectors: options.selectors
      });
      results.set(geo, result);
    }

    return results;
  }

  /**
   * web_navigate - Execute multi-step navigation
   *
   * For complex workflows that require clicking, typing, scrolling, etc.
   *
   * @param {Object} options - Navigation options
   * @param {string} options.url - Starting URL
   * @param {Object[]} options.steps - Navigation steps
   * @returns {Promise<Object>} Navigation result
   */
  async webNavigate(options) {
    const startTime = Date.now();
    this.emit('tool-start', { tool: 'web_navigate', input: options });

    try {
      const result = await this.executeNavigation(options);

      const duration = Date.now() - startTime;
      const cost = this.calculateNavigationCost(options.steps.length, options.geo);

      const finalResult = {
        ...result,
        cost,
        duration
      };

      this.recordCall({
        tool: 'web_navigate',
        input: options,
        output: finalResult,
        duration,
        cost
      });

      this.emit('tool-complete', { tool: 'web_navigate', steps: options.steps.length, duration, cost });

      return finalResult;

    } catch (error) {
      this.emit('tool-error', { tool: 'web_navigate', error });
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Utility Methods
  // ═══════════════════════════════════════════════════════════════════════════

  getCallHistory() {
    return [...this.callHistory];
  }

  getTotalCost() {
    return this.totalCost;
  }

  getCostBreakdown() {
    const breakdown = {};
    for (const call of this.callHistory) {
      breakdown[call.tool] = (breakdown[call.tool] || 0) + call.cost;
    }
    return breakdown;
  }

  reset() {
    this.callHistory = [];
    this.totalCost = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods (Simulation for Demo)
  // ═══════════════════════════════════════════════════════════════════════════

  async executeSearch(options) {
    // Simulate network delay
    await this.delay(500 + Math.random() * 500);

    // Generate mock results based on query
    const competitors = [
      { title: 'BigCommerce', url: 'https://www.bigcommerce.com', hint: 'simple' },
      { title: 'WooCommerce', url: 'https://woocommerce.com', hint: 'simple' },
      { title: 'Magento', url: 'https://business.adobe.com/products/magento', hint: 'moderate' },
      { title: 'Squarespace', url: 'https://www.squarespace.com', hint: 'complex' },
      { title: 'Wix', url: 'https://www.wix.com', hint: 'complex' },
      { title: 'PrestaShop', url: 'https://www.prestashop.com', hint: 'simple' }
    ];

    const limit = options.limit || 10;
    return competitors.slice(0, limit).map((c, i) => ({
      title: c.title,
      url: c.url,
      snippet: `${c.title} is a leading e-commerce platform...`,
      position: i + 1,
      environmentHint: c.hint
    }));
  }

  async executeScrape(options, level) {
    // Simulate delay based on execution level
    const delays = { 'http': 500, 'browser-light': 2000, 'browser-advanced': 4000 };
    await this.delay(delays[level] + Math.random() * 1000);

    // Simulate extracted data based on geo
    const mockPrices = {
      us: { price: '$29.99/mo', currency: 'USD' },
      uk: { price: '£24.99/mo', currency: 'GBP' },
      de: { price: '€27.99/mo', currency: 'EUR' }
    };

    const geo = options.geo || 'us';
    const priceData = mockPrices[geo] || mockPrices.us;

    return {
      success: true,
      url: options.url,
      content: `<html><body><div class="pricing">${priceData.price}</div></body></html>`,
      extractedData: priceData,
      executionLevel: level,
      environmentAnalysis: {
        complexity: level === 'http' ? 'low' : level === 'browser-light' ? 'medium' : 'high',
        javascriptRequired: level !== 'http',
        antiBotDetected: level === 'browser-advanced'
      }
    };
  }

  async executeNavigation(options) {
    const stepResults = [];

    for (let i = 0; i < options.steps.length; i++) {
      const step = options.steps[i];
      await this.delay(500 + Math.random() * 500);

      stepResults.push({
        step: i + 1,
        action: step.action,
        success: true,
        duration: 500 + Math.random() * 500,
        data: step.action === 'extract' ? { value: 'extracted content' } : undefined
      });

      this.emit('navigation-step', { step: i + 1, action: step.action });
    }

    return {
      success: true,
      steps: stepResults,
      finalUrl: options.url,
      extractedData: stepResults.filter(s => s.data).map(s => s.data)
    };
  }

  async determineExecutionLevel(url) {
    const urlLower = url.toLowerCase();

    const complexPatterns = ['squarespace', 'wix', 'shopify'];
    const moderatePatterns = ['magento', 'adobe', 'salesforce'];

    if (complexPatterns.some(p => urlLower.includes(p))) return 'browser-advanced';
    if (moderatePatterns.some(p => urlLower.includes(p))) return 'browser-light';
    return 'http';
  }

  calculateSearchCost(resultCount) {
    return 0.005 * Math.ceil(resultCount / 10);
  }

  calculateScrapeCost(level, geo) {
    const baseCosts = { 'http': 0.001, 'browser-light': 0.01, 'browser-advanced': 0.025 };
    const geoPremium = geo && geo !== 'us' ? 0.002 : 0;
    return baseCosts[level] + geoPremium;
  }

  calculateNavigationCost(stepCount, geo) {
    const baseCost = 0.025;
    const perStepCost = 0.005;
    const geoPremium = geo && geo !== 'us' ? 0.005 : 0;
    return baseCost + (perStepCost * stepCount) + geoPremium;
  }

  recordCall(call) {
    this.callHistory.push({ ...call, timestamp: new Date() });
    this.totalCost += call.cost;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: AI AGENT
// ═══════════════════════════════════════════════════════════════════════════════
//
// Example AI agent that uses MCP tools for autonomous web research.
// This demonstrates how AI agents can use web execution tools.

/**
 * AI Agent that uses MCP tools for web research
 *
 * Task Types:
 * - competitive-research: Find and analyze competitors
 * - price-monitoring: Monitor prices across URLs/geos
 * - content-aggregation: Aggregate content from multiple sources
 *
 * @example
 * const agent = new AIAgent({ mcpClient: mcp });
 *
 * const result = await agent.executeResearch({
 *   type: 'competitive-research',
 *   target: 'Shopify',
 *   parameters: { geos: ['us', 'uk', 'de'], limit: 5 }
 * });
 */
class AIAgent extends EventEmitter {
  constructor(config) {
    super();
    this.mcp = config.mcpClient;
    this.config = {
      maxSteps: config.maxSteps || 50,
      verbose: config.verbose !== false
    };
  }

  /**
   * Execute a research task
   */
  async executeResearch(task) {
    const startTime = Date.now();
    const phases = [];

    this.emit('task-start', { task });

    try {
      switch (task.type) {
        case 'competitive-research':
          return await this.executeCompetitiveResearch(task, phases);
        case 'price-monitoring':
          return await this.executePriceMonitoring(task, phases);
        case 'content-aggregation':
          return await this.executeContentAggregation(task, phases);
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      return {
        success: false,
        task,
        phases,
        findings: { error: error.message },
        totalCost: this.mcp.getTotalCost(),
        totalDuration: Date.now() - startTime
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Competitive Research Flow
  // ═══════════════════════════════════════════════════════════════════════════

  async executeCompetitiveResearch(task, phases) {
    const startTime = Date.now();
    const { target, parameters } = task;
    const geos = parameters.geos || ['us'];
    const limit = parameters.limit || 5;

    // Phase 1: Search for competitors
    this.log(`🔍 Searching for competitors of ${target}...`);
    const searchResults = await this.mcp.webSearch({
      query: `${target} competitors alternatives`,
      limit
    });

    phases.push({
      name: 'search',
      success: true,
      duration: Date.now() - startTime,
      cost: 0.005,
      output: searchResults
    });

    this.emit('phase-complete', { phase: 'search', result: phases[0] });
    this.log(`   Found ${searchResults.length} potential competitors`);

    // Phase 2: Analyze competitor sites
    this.log(`\n📍 Analyzing competitor sites...`);
    const competitorData = [];

    for (const competitor of searchResults.slice(0, limit)) {
      this.log(`   • ${competitor.title} (${competitor.environmentHint} complexity)`);

      const result = await this.mcp.webScrape({
        url: competitor.url,
        autoEscalate: true
      });

      this.log(`     Execution: ${result.executionLevel}`);

      competitorData.push({
        name: competitor.title,
        url: competitor.url,
        pricingUrl: competitor.url + '/pricing',
        complexity: competitor.environmentHint,
        executionLevel: result.executionLevel
      });
    }

    phases.push({
      name: 'discovery',
      success: true,
      duration: Date.now() - startTime,
      cost: competitorData.length * 0.01,
      output: competitorData
    });

    this.emit('phase-complete', { phase: 'discovery', result: phases[1] });

    // Phase 3: Multi-geo pricing
    this.log(`\n🌍 Extracting prices across ${geos.length} regions...`);
    const geoData = {};

    for (const competitor of competitorData.slice(0, 3)) {
      geoData[competitor.name] = {};

      for (const geo of geos) {
        const result = await this.mcp.webScrape({
          url: competitor.pricingUrl,
          geo
        });

        geoData[competitor.name][geo] = result.extractedData;
      }

      this.log(`\n   ${competitor.name}:`);
      for (const geo of geos) {
        const price = geoData[competitor.name][geo]?.price || 'N/A';
        this.log(`     ${geo.toUpperCase()}: ${price}`);
      }
    }

    phases.push({
      name: 'geographic',
      success: true,
      duration: Date.now() - startTime,
      cost: Object.keys(geoData).length * geos.length * 0.01,
      output: geoData
    });

    this.emit('phase-complete', { phase: 'geographic', result: phases[2] });

    // Phase 4: Analysis
    this.log(`\n📊 Analyzing findings...`);
    const findings = this.analyzeFindings(competitorData, geoData);

    phases.push({
      name: 'analysis',
      success: true,
      duration: Date.now() - startTime,
      cost: 0,
      output: findings
    });

    this.log(`\n   Key Insights:`);
    findings.insights.forEach((insight, i) => {
      this.log(`   ${i + 1}. ${insight}`);
    });

    return this.buildResult(task, phases, startTime, findings);
  }

  async executePriceMonitoring(task, phases) {
    const startTime = Date.now();
    const { parameters } = task;
    const urls = parameters.urls || [];
    const geos = parameters.geos || ['us'];

    this.log(`💰 Monitoring prices for ${urls.length} URLs...`);

    const prices = {};
    for (const url of urls) {
      prices[url] = {};
      for (const geo of geos) {
        const result = await this.mcp.webScrape({ url, geo });
        prices[url][geo] = result.extractedData;
        this.log(`   ${url} [${geo}]: ${result.extractedData?.price || 'N/A'}`);
      }
    }

    phases.push({
      name: 'price-monitoring',
      success: true,
      duration: Date.now() - startTime,
      cost: urls.length * geos.length * 0.01,
      output: prices
    });

    return this.buildResult(task, phases, startTime, prices);
  }

  async executeContentAggregation(task, phases) {
    const startTime = Date.now();
    const { target, parameters } = task;
    const limit = parameters.limit || 10;

    this.log(`📰 Aggregating content about "${target}"...`);

    const searchResults = await this.mcp.webSearch({ query: target, limit });
    const content = [];

    for (const result of searchResults.slice(0, 5)) {
      const scrapeResult = await this.mcp.webScrape({ url: result.url });
      content.push({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        content: scrapeResult.content.substring(0, 500)
      });
      this.log(`   • ${result.title}`);
    }

    phases.push({
      name: 'aggregation',
      success: true,
      duration: Date.now() - startTime,
      cost: this.mcp.getTotalCost(),
      output: content
    });

    return this.buildResult(task, phases, startTime, { articles: content });
  }

  analyzeFindings(competitors, geoData) {
    const insights = [];

    // Analyze execution complexity
    const advancedCount = competitors.filter(c => c.executionLevel === 'browser-advanced').length;
    if (advancedCount > 2) {
      insights.push('Multiple competitors use heavy anti-bot protection');
    } else {
      insights.push('Most competitors have accessible pricing pages');
    }

    // Analyze price variance (simplified)
    insights.push('Consider regional pricing strategy to remain competitive');
    insights.push('Monitor pricing weekly to detect changes');

    return {
      competitorCount: competitors.length,
      geoVarianceDetected: true,
      insights
    };
  }

  buildResult(task, phases, startTime, findings) {
    return {
      success: phases.every(p => p.success),
      task,
      phases,
      findings,
      totalCost: phases.reduce((sum, p) => sum + p.cost, 0),
      totalDuration: Date.now() - startTime
    };
  }

  log(message) {
    if (this.config.verbose) console.log(message);
    this.emit('log', { message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: DEMO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the Part 3 demonstration
 */
async function runDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('    PART 3: MCP EXECUTION FOR AI-NATIVE WORKFLOWS');
  console.log('═'.repeat(60));

  // Demo 1: MCP Tools Overview
  console.log('\n' + '-'.repeat(60));
  console.log('🔧 DEMO 1: MCP Tools Overview');
  console.log('-'.repeat(60));

  console.log('\n   Bright Data MCP Server provides these tools:\n');

  const tools = [
    { name: 'search_engine', desc: 'Search Google/Bing and get structured results', cost: '$0.005' },
    { name: 'scrape_as_markdown', desc: 'Scrape URL and return markdown content', cost: '$0.001-0.025' },
    { name: 'scrape_as_html', desc: 'Scrape URL and return raw HTML', cost: '$0.001-0.025' },
    { name: 'session_start', desc: 'Start a persistent browser session', cost: '$0.025' },
    { name: 'session_navigate', desc: 'Navigate to a URL in session', cost: '$0.005' },
    { name: 'session_click', desc: 'Click an element in session', cost: '$0.005' },
    { name: 'session_type', desc: 'Type text in session', cost: '$0.005' },
    { name: 'session_screenshot', desc: 'Take screenshot in session', cost: '$0.005' },
    { name: 'session_end', desc: 'End browser session', cost: '$0.000' }
  ];

  for (const tool of tools) {
    console.log(`   📦 ${tool.name}`);
    console.log(`      ${tool.desc}`);
    console.log(`      Cost: ${tool.cost}`);
    console.log();
  }

  // Demo 2: Auto-Adaptive Execution
  console.log('-'.repeat(60));
  console.log('🔄 DEMO 2: Auto-Adaptive Execution');
  console.log('-'.repeat(60));

  console.log('\n   MCP automatically selects execution level based on target:\n');

  const adaptiveExamples = [
    { url: 'books.toscrape.com', level: 'HTTP', reason: 'Static HTML, no protection' },
    { url: 'bigcommerce.com', level: 'Browser Light', reason: 'JavaScript rendering needed' },
    { url: 'squarespace.com', level: 'Browser Advanced', reason: 'Heavy protection, SPA' }
  ];

  for (const ex of adaptiveExamples) {
    console.log(`   📍 ${ex.url}`);
    console.log(`      Selected: ${ex.level}`);
    console.log(`      Reason: ${ex.reason}`);
    console.log();
  }

  // Demo 3: AI Agent Workflow
  console.log('-'.repeat(60));
  console.log('🤖 DEMO 3: AI Agent Workflow');
  console.log('-'.repeat(60));

  console.log('\n   Simulating competitive research agent...\n');

  const mcp = new MCPClient({ apiToken: 'demo-token' });
  const agent = new AIAgent({ mcpClient: mcp, verbose: true });

  // Run the agent
  const result = await agent.executeResearch({
    type: 'competitive-research',
    target: 'Shopify',
    parameters: {
      geos: ['us', 'uk', 'de'],
      limit: 3
    }
  });

  console.log('\n' + '-'.repeat(60));
  console.log('📊 Agent Results');
  console.log('-'.repeat(60));

  console.log(`\n   Task: ${result.success ? '✅ Successful' : '❌ Failed'}`);
  console.log(`   Duration: ${(result.totalDuration / 1000).toFixed(1)}s`);
  console.log(`   Total Cost: $${result.totalCost.toFixed(4)}`);

  console.log('\n   Phases:');
  result.phases.forEach(phase => {
    console.log(`   • ${phase.name}: ✅ ($${phase.cost.toFixed(4)})`);
  });

  // Demo 4: Cost Optimization
  console.log('\n' + '-'.repeat(60));
  console.log('💰 DEMO 4: Cost Optimization with MCP');
  console.log('-'.repeat(60));

  console.log('\n   MCP optimizes costs by selecting cheapest viable level:\n');

  const costComparison = {
    searches: 10,
    httpScrapes: 20,
    browserLightScrapes: 20,
    browserAdvancedScrapes: 10,
    navigations: 5
  };

  const smartCost =
    (costComparison.searches * 0.005) +
    (costComparison.httpScrapes * 0.001) +
    (costComparison.browserLightScrapes * 0.01) +
    (costComparison.browserAdvancedScrapes * 0.025) +
    (costComparison.navigations * 0.05);

  const allAdvancedCost =
    (costComparison.searches * 0.005) +
    (50 * 0.025) +  // All scrapes as browser-advanced
    (costComparison.navigations * 0.05);

  console.log('   Scenario: 50 scrapes + 10 searches + 5 navigations');
  console.log('   ─────────────────────────────────────────────────');
  console.log(`   Smart (adaptive):    $${smartCost.toFixed(2)}`);
  console.log(`   All Browser Adv:     $${allAdvancedCost.toFixed(2)}`);
  console.log(`   Savings:             $${(allAdvancedCost - smartCost).toFixed(2)} (${((1 - smartCost/allAdvancedCost) * 100).toFixed(0)}%)`);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('       PART 3 DEMO COMPLETE');
  console.log('═'.repeat(60));

  console.log('\n🎯 Key Takeaways:');
  console.log('   1. MCP provides AI-native tools for web execution');
  console.log('   2. Agents can autonomously navigate complex environments');
  console.log('   3. Auto-adaptation optimizes cost and reliability');
  console.log('   4. Session management enables multi-step workflows');

  console.log('\n➡️  Continue to Part 4: Environmental Resilience & Observability\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Classes
  MCPClient,
  AIAgent,

  // Factory functions
  createMCPClient: (config) => new MCPClient(config),
  createAIAgent: (config) => new AIAgent(config),

  // Demo
  runDemo
};

// Run demo if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}
