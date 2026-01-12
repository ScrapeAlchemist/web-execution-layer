/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PART 4: ENVIRONMENTAL RESILIENCE & OBSERVABILITY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * This module covers monitoring, drift detection, and alerting for
 * web execution pipelines. The web is dynamic - sites change constantly.
 *
 * WHY RESILIENCE MATTERS:
 * - Websites redesign and selectors break
 * - Anti-bot protection changes
 * - Response times vary
 * - Geographic variations emerge
 *
 * KEY CONCEPTS:
 * - Environment Monitoring: Continuous health checks
 * - Structural Drift: Detecting when page structure changes
 * - Temporal Analysis: Understanding patterns over time
 * - Automated Alerting: Getting notified when things break
 *
 * BEST PRACTICES:
 * 1. Monitor proactively - don't wait for failures
 * 2. Version your selectors
 * 3. Implement graceful degradation
 * 4. Alert appropriately (right message, right channel)
 * 5. Document patterns for each target
 */

const { EventEmitter } = require('events');

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: ENVIRONMENT MONITOR
// ═══════════════════════════════════════════════════════════════════════════════
//
// Continuous monitoring of target web environments.
// Detects changes, measures health, and triggers alerts.

/**
 * Monitors web environments for changes and health
 *
 * @example
 * const monitor = new EnvironmentMonitor({
 *   targets: [
 *     { url: 'https://competitor-a.com/pricing', selectors: ['.price'], maxResponseTime: 3000 }
 *   ],
 *   geos: ['us', 'uk', 'de']
 * });
 *
 * monitor.on('health-check', (check) => console.log(check.status));
 * monitor.on('environment-change', (change) => console.log(change));
 *
 * monitor.start();
 */
class EnvironmentMonitor extends EventEmitter {
  constructor(config) {
    super();

    this.config = {
      targets: config.targets || [],
      checkInterval: config.checkInterval || 3600000,  // 1 hour
      geos: config.geos || ['us'],
      retentionDays: config.retentionDays || 7
    };

    this.checkHistory = new Map();
    this.baselines = new Map();
    this.intervalId = null;
    this.isRunning = false;
  }

  /**
   * Start continuous monitoring
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('started');

    // Run initial check
    this.runChecks();

    // Schedule recurring checks
    this.intervalId = setInterval(() => {
      this.runChecks();
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * Run health checks for all targets
   */
  async runChecks() {
    const results = [];

    for (const target of this.config.targets) {
      const check = await this.checkTarget(target);
      results.push(check);

      // Store in history
      this.addToHistory(target.url, check);

      // Compare with baseline
      const changes = this.detectChanges(target.url, check);
      for (const change of changes) {
        this.emit('environment-change', change);
      }

      // Emit health status
      this.emit('health-check', check);
    }

    return results;
  }

  /**
   * Check a single target
   */
  async checkTarget(target) {
    const startTime = Date.now();
    const issues = [];
    const selectorMatches = {};

    try {
      // Simulate execution (in production, use actual executor)
      const result = await this.simulateExecution(target);
      const responseTime = Date.now() - startTime;

      // Check response time
      const maxTime = target.maxResponseTime || 5000;
      if (responseTime > maxTime) {
        issues.push({
          type: 'slow_response',
          severity: responseTime > maxTime * 2 ? 'critical' : 'warning',
          message: `Response time ${responseTime}ms exceeds threshold ${maxTime}ms`
        });
      }

      // Check selectors
      if (target.selectors) {
        for (const selector of target.selectors) {
          const matches = this.countSelectorMatches(result.html, selector);
          selectorMatches[selector] = matches;

          if (matches === 0) {
            issues.push({
              type: 'missing_selector',
              severity: 'warning',
              message: `Selector "${selector}" not found`
            });
          }
        }
      }

      // Check geo consistency
      let geoResults;
      if (this.config.geos.length > 1) {
        geoResults = await this.checkGeoConsistency(target);
        const mismatches = Object.entries(geoResults).filter(([_, r]) => r.status === 'mismatch');
        if (mismatches.length > 0) {
          issues.push({
            type: 'geo_mismatch',
            severity: 'warning',
            message: `Geographic mismatch in: ${mismatches.map(([g]) => g).join(', ')}`
          });
        }
      }

      const status = this.determineStatus(issues);

      return {
        url: target.url,
        timestamp: new Date(),
        status,
        responseTime,
        executionLevel: result.executionLevel,
        contentLength: result.contentLength,
        selectorMatches,
        geoResults,
        issues
      };

    } catch (error) {
      issues.push({
        type: 'error',
        severity: 'critical',
        message: error.message
      });

      return {
        url: target.url,
        timestamp: new Date(),
        status: 'critical',
        responseTime: Date.now() - startTime,
        executionLevel: 'http',
        contentLength: 0,
        selectorMatches,
        issues
      };
    }
  }

  /**
   * Get health status for a target
   */
  getStatus(url) {
    const history = this.checkHistory.get(url);
    return history?.[history.length - 1];
  }

  /**
   * Get statistics for a target
   */
  getStats(url) {
    const history = this.checkHistory.get(url);
    if (!history || history.length === 0) return null;

    const successful = history.filter(h => h.status !== 'critical').length;
    const totalResponseTime = history.reduce((sum, h) => sum + h.responseTime, 0);

    return {
      totalChecks: history.length,
      successRate: successful / history.length,
      averageResponseTime: totalResponseTime / history.length,
      lastCheck: history[history.length - 1].timestamp
    };
  }

  /**
   * Set baseline for a target
   */
  setBaseline(url) {
    const currentCheck = this.getStatus(url);
    if (currentCheck) {
      this.baselines.set(url, currentCheck);
      this.emit('baseline-set', { url, check: currentCheck });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  async simulateExecution(target) {
    await this.delay(500 + Math.random() * 1000);

    const isComplex = target.url.includes('squarespace') ||
                      target.url.includes('wix');

    return {
      html: this.generateMockHtml(target),
      executionLevel: isComplex ? 'browser-advanced' : 'http',
      contentLength: 50000 + Math.random() * 100000
    };
  }

  generateMockHtml(target) {
    const selectors = target.selectors || ['.product', '.price'];
    let html = '<html><body>';
    for (const selector of selectors) {
      const className = selector.replace('.', '').replace('#', '');
      html += `<div class="${className}">Content for ${selector}</div>`;
    }
    html += '</body></html>';
    return html;
  }

  countSelectorMatches(html, selector) {
    const pattern = selector.replace('.', 'class="').replace('#', 'id="');
    const matches = html.match(new RegExp(pattern, 'g'));
    return matches ? matches.length : 0;
  }

  async checkGeoConsistency(target) {
    const results = {};

    for (const geo of this.config.geos) {
      await this.delay(200);

      results[geo] = {
        status: Math.random() > 0.1 ? 'ok' : 'mismatch',
        responseTime: 1000 + Math.random() * 2000,
        contentLength: 50000 + Math.random() * 10000,
        priceDetected: geo === 'us' ? '$29.99' : geo === 'uk' ? '£24.99' : '€27.99'
      };
    }

    return results;
  }

  detectChanges(url, current) {
    const changes = [];
    const baseline = this.baselines.get(url);

    if (!baseline) {
      this.baselines.set(url, current);
      return changes;
    }

    // Check structural changes
    for (const [selector, count] of Object.entries(current.selectorMatches)) {
      const baselineCount = baseline.selectorMatches[selector] || 0;

      if (count === 0 && baselineCount > 0) {
        changes.push({
          url,
          timestamp: new Date(),
          changeType: 'structure',
          severity: 'warning',
          description: `Selector "${selector}" no longer found`,
          before: baselineCount,
          after: count
        });
      }
    }

    // Check performance changes
    if (current.responseTime > baseline.responseTime * 2) {
      changes.push({
        url,
        timestamp: new Date(),
        changeType: 'performance',
        severity: 'warning',
        description: 'Response time doubled',
        before: baseline.responseTime,
        after: current.responseTime
      });
    }

    return changes;
  }

  determineStatus(issues) {
    if (issues.some(i => i.severity === 'critical')) return 'critical';
    if (issues.some(i => i.severity === 'warning')) return 'warning';
    return 'healthy';
  }

  addToHistory(url, check) {
    let history = this.checkHistory.get(url);
    if (!history) {
      history = [];
      this.checkHistory.set(url, history);
    }
    history.push(check);

    // Prune old entries
    const cutoff = Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000);
    this.checkHistory.set(url, history.filter(h => h.timestamp.getTime() > cutoff));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: ALERTING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════
//
// Automated alerting for environment changes and health issues.
// Supports multiple channels and configurable rules.

/**
 * Alerting system for web execution pipeline monitoring
 *
 * Channels:
 * - console: Log to console (always available)
 * - slack: Send to Slack webhook
 * - email: Send via SMTP
 * - webhook: Send to custom webhook
 *
 * @example
 * const alerting = new AlertingSystem({
 *   channels: {
 *     console: { enabled: true },
 *     slack: { webhook: 'https://hooks.slack.com/...' }
 *   },
 *   rules: defaultAlertRules
 * });
 *
 * alerting.pipe(monitor);  // Connect to monitor
 */
class AlertingSystem extends EventEmitter {
  constructor(config) {
    super();

    this.config = {
      channels: config.channels || {},
      rules: config.rules || [],
      throttleMinutes: config.throttleMinutes || 5
    };

    this.alertHistory = [];
    this.lastAlerts = new Map();
    this.alertCounter = 0;
  }

  /**
   * Process an event through the alerting rules
   */
  async processEvent(event) {
    const alerts = [];

    for (const rule of this.config.rules) {
      // Check if rule matches
      if (!rule.condition(event)) continue;

      // Check throttling
      if (this.isThrottled(rule)) continue;

      // Create and send alert
      const alert = await this.createAndSendAlert(rule, event);
      alerts.push(alert);

      // Update throttle timestamp
      this.lastAlerts.set(rule.name, new Date());
    }

    return alerts;
  }

  /**
   * Pipe events from a monitor to this alerting system
   */
  pipe(source) {
    source.on('health-check', (check) => {
      this.processEvent({
        type: 'health-check',
        source: check.url,
        timestamp: check.timestamp,
        data: check
      });
    });

    source.on('environment-change', (change) => {
      this.processEvent({
        type: 'environment-change',
        source: change.url,
        timestamp: change.timestamp,
        data: change
      });
    });
  }

  /**
   * Send a custom alert
   */
  async sendAlert(message, severity = 'info', channels = ['console']) {
    const alert = {
      id: `alert_${++this.alertCounter}_${Date.now()}`,
      rule: 'custom',
      severity,
      timestamp: new Date(),
      message,
      channels,
      event: { type: 'custom', source: 'manual', timestamp: new Date(), data: { message } },
      delivered: false,
      deliveryResults: {}
    };

    await this.deliverAlert(alert, channels);
    this.alertHistory.push(alert);
    this.emit('alert', alert);

    return alert;
  }

  /**
   * Get alert history
   */
  getHistory(limit) {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════════════════════════════════════

  isThrottled(rule) {
    const lastAlert = this.lastAlerts.get(rule.name);
    if (!lastAlert) return false;

    const throttleMinutes = rule.throttle || this.config.throttleMinutes;
    const throttleMs = throttleMinutes * 60 * 1000;

    return Date.now() - lastAlert.getTime() < throttleMs;
  }

  async createAndSendAlert(rule, event) {
    const message = rule.message
      ? rule.message(event)
      : this.generateDefaultMessage(rule, event);

    const alert = {
      id: `alert_${++this.alertCounter}_${Date.now()}`,
      rule: rule.name,
      severity: rule.severity,
      timestamp: new Date(),
      message,
      channels: rule.channels,
      event,
      delivered: false,
      deliveryResults: {}
    };

    await this.deliverAlert(alert, rule.channels);
    this.alertHistory.push(alert);
    this.emit('alert', alert);

    return alert;
  }

  async deliverAlert(alert, channels) {
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'console':
            this.deliverToConsole(alert);
            alert.deliveryResults[channel] = true;
            break;
          case 'slack':
            await this.deliverToSlack(alert);
            alert.deliveryResults[channel] = true;
            break;
          case 'email':
            await this.deliverToEmail(alert);
            alert.deliveryResults[channel] = true;
            break;
          case 'webhook':
            await this.deliverToWebhook(alert);
            alert.deliveryResults[channel] = true;
            break;
        }
      } catch (error) {
        alert.deliveryResults[channel] = false;
        this.emit('delivery-error', { alert, channel, error });
      }
    }

    alert.delivered = Object.values(alert.deliveryResults).some(v => v);
  }

  deliverToConsole(alert) {
    const icons = { info: 'ℹ️', warning: '⚠️', critical: '🚨' };
    console.log(`\n${icons[alert.severity]} [${alert.severity.toUpperCase()}] ${alert.rule}`);
    console.log(`   ${alert.message}`);
    console.log(`   Source: ${alert.event.source}`);
    console.log(`   Time: ${alert.timestamp.toISOString()}`);
  }

  async deliverToSlack(alert) {
    const config = this.config.channels.slack;
    if (!config?.webhook) return;
    console.log(`   → Slack notification queued`);
  }

  async deliverToEmail(alert) {
    const config = this.config.channels.email;
    if (!config?.to) return;
    const recipients = Array.isArray(config.to) ? config.to : [config.to];
    console.log(`   → Email queued to: ${recipients.join(', ')}`);
  }

  async deliverToWebhook(alert) {
    const config = this.config.channels.webhook;
    if (!config?.url) return;
    console.log(`   → Webhook notification queued`);
  }

  generateDefaultMessage(rule, event) {
    if (event.type === 'health-check') {
      const check = event.data;
      return `Health check ${check.status} for ${check.url}. Response time: ${check.responseTime}ms. Issues: ${check.issues.length}`;
    }
    if (event.type === 'environment-change') {
      const change = event.data;
      return `${change.changeType} change detected on ${change.url}: ${change.description}`;
    }
    return `Alert triggered: ${rule.name}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: DEFAULT ALERT RULES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pre-built alert rules for common scenarios
 */
const defaultAlertRules = [
  {
    name: 'Critical Health',
    condition: (event) =>
      event.type === 'health-check' &&
      event.data.status === 'critical',
    severity: 'critical',
    channels: ['console', 'slack'],
    message: (event) => {
      const check = event.data;
      return `Critical health status for ${check.url}. Issues: ${check.issues.map(i => i.message).join('; ')}`;
    }
  },
  {
    name: 'Structure Change',
    condition: (event) =>
      event.type === 'environment-change' &&
      event.data.changeType === 'structure',
    severity: 'warning',
    channels: ['console', 'slack'],
    message: (event) => {
      const change = event.data;
      return `Structure change on ${change.url}: ${change.description}`;
    }
  },
  {
    name: 'Performance Degradation',
    condition: (event) => {
      if (event.type !== 'health-check') return false;
      return event.data.responseTime > 10000;
    },
    severity: 'warning',
    channels: ['console'],
    throttle: 30,
    message: (event) => {
      return `Slow response from ${event.data.url}: ${event.data.responseTime}ms`;
    }
  },
  {
    name: 'Geo Mismatch',
    condition: (event) => {
      if (event.type !== 'health-check') return false;
      return event.data.geoResults &&
        Object.values(event.data.geoResults).some(r => r.status === 'mismatch');
    },
    severity: 'warning',
    channels: ['console'],
    message: (event) => {
      const mismatches = Object.entries(event.data.geoResults || {})
        .filter(([_, r]) => r.status === 'mismatch')
        .map(([geo]) => geo);
      return `Geographic mismatch on ${event.data.url} for regions: ${mismatches.join(', ')}`;
    }
  }
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: DEMO
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the Part 4 demonstration
 */
async function runDemo() {
  console.log('\n' + '═'.repeat(60));
  console.log('    PART 4: ENVIRONMENTAL RESILIENCE & OBSERVABILITY');
  console.log('═'.repeat(60));

  // Demo 1: Environment Monitoring
  console.log('\n' + '-'.repeat(60));
  console.log('📊 DEMO 1: Environment Monitoring');
  console.log('-'.repeat(60));

  const monitor = new EnvironmentMonitor({
    targets: [
      { url: 'https://competitor-a.com/pricing', selectors: ['.price-box'], maxResponseTime: 3000 },
      { url: 'https://competitor-b.com/pricing', selectors: ['.pricing-container'], maxResponseTime: 5000 }
    ],
    geos: ['us', 'uk', 'de']
  });

  monitor.on('health-check', (check) => {
    const statusIcon = check.status === 'healthy' ? '✅' :
                       check.status === 'warning' ? '⚠️' : '❌';
    console.log(`   ${statusIcon} ${check.url}`);
    console.log(`      Status: ${check.status}`);
    console.log(`      Response Time: ${check.responseTime}ms`);
    if (check.issues.length > 0) {
      check.issues.forEach(issue => console.log(`      Issue: ${issue.message}`));
    }
  });

  console.log('\n   Running health checks...\n');
  await monitor.runChecks();

  // Demo 2: Structural Drift
  console.log('\n' + '-'.repeat(60));
  console.log('🔍 DEMO 2: Structural Drift Detection');
  console.log('-'.repeat(60));

  console.log('\n   Comparing current structure to baseline...\n');

  const driftScenarios = [
    { target: 'competitor-a.com', match: 100, status: 'stable', changes: [] },
    { target: 'competitor-b.com', match: 65, status: 'drift-detected',
      changes: ['.price-box → .pricing-container (renamed)', '.add-to-cart removed'] },
    { target: 'competitor-c.com', match: 92, status: 'minor-variance', changes: [] }
  ];

  for (const scenario of driftScenarios) {
    const statusIcon = scenario.status === 'stable' ? '✅' :
                       scenario.status === 'drift-detected' ? '⚠️' : 'ℹ️';
    console.log(`   ${statusIcon} ${scenario.target}`);
    console.log(`      Structure Match: ${scenario.match}%`);
    console.log(`      Status: ${scenario.status.replace('-', ' ').toUpperCase()}`);
    if (scenario.changes.length > 0) {
      console.log(`      Changes:`);
      scenario.changes.forEach(c => console.log(`        • ${c}`));
    }
    console.log();
  }

  // Demo 3: Temporal Patterns
  console.log('-'.repeat(60));
  console.log('📈 DEMO 3: Temporal Pattern Analysis');
  console.log('-'.repeat(60));

  console.log('\n   Understanding when things change...\n');

  const patterns = [
    { target: 'competitor-a.com', priceChanges: 'Weekly (Monday AM)', optimalScrape: 'Tuesday 6 AM UTC' },
    { target: 'competitor-b.com', priceChanges: 'Daily (variable)', optimalScrape: '3 AM UTC (low traffic)' },
    { target: 'competitor-c.com', priceChanges: 'Monthly (1st)', optimalScrape: '5th of each month' }
  ];

  for (const pattern of patterns) {
    console.log(`   📍 ${pattern.target}`);
    console.log(`      Price Changes: ${pattern.priceChanges}`);
    console.log(`      Optimal Scrape: ${pattern.optimalScrape}`);
    console.log();
  }

  // Demo 4: Alerting
  console.log('-'.repeat(60));
  console.log('🚨 DEMO 4: Automated Alerting');
  console.log('-'.repeat(60));

  const alerting = new AlertingSystem({
    channels: {
      console: { enabled: true },
      slack: { webhook: 'https://hooks.slack.com/...' }
    },
    rules: defaultAlertRules
  });

  console.log('\n   Simulating alert scenarios...');

  // Critical health check
  console.log('\n   Scenario 1: Critical Health Check');
  await alerting.processEvent({
    type: 'health-check',
    source: 'competitor-b.com',
    timestamp: new Date(),
    data: {
      url: 'competitor-b.com',
      status: 'critical',
      responseTime: 15000,
      issues: [{ type: 'error', severity: 'critical', message: 'Connection timeout' }]
    }
  });

  // Structure change
  console.log('\n   Scenario 2: Structure Change');
  await alerting.processEvent({
    type: 'environment-change',
    source: 'competitor-b.com',
    timestamp: new Date(),
    data: {
      url: 'competitor-b.com',
      changeType: 'structure',
      severity: 'warning',
      description: 'Selector .price-box no longer found'
    }
  });

  // Demo 5: Best Practices
  console.log('\n' + '-'.repeat(60));
  console.log('📋 DEMO 5: Best Practices Summary');
  console.log('-'.repeat(60));

  const practices = [
    { title: 'Monitor Proactively', desc: 'Schedule hourly health checks minimum' },
    { title: 'Version Selectors', desc: 'Keep config in version control with dates' },
    { title: 'Graceful Degradation', desc: 'Have backup selectors for critical data' },
    { title: 'Alert Appropriately', desc: 'Critical → PagerDuty, Warning → Slack' },
    { title: 'Document Patterns', desc: 'Track maintenance windows and behaviors' }
  ];

  console.log('\n');
  for (const practice of practices) {
    console.log(`   ✓ ${practice.title}`);
    console.log(`     ${practice.desc}`);
    console.log();
  }

  // Workshop Complete Summary
  console.log('═'.repeat(60));
  console.log('       WORKSHOP COMPLETE! 🎉');
  console.log('═'.repeat(60));

  console.log('\n   You have learned:');
  console.log('   ─────────────────────────────────────────────────');
  console.log('   ✅ Part 1: HTTP execution for simple environments');
  console.log('   ✅ Part 2: Browser execution for complex environments');
  console.log('   ✅ Part 3: MCP execution for AI-native workflows');
  console.log('   ✅ Part 4: Resilience and observability');

  console.log('\n   Key Takeaways:');
  console.log('   ─────────────────────────────────────────────────');
  console.log('   1. Choose execution level based on environment complexity');
  console.log('   2. Let Bright Data handle anti-bot and fingerprinting');
  console.log('   3. Use MCP for AI agent web execution');
  console.log('   4. Monitor continuously and alert intelligently');
  console.log('   5. Build for change - the web is dynamic');

  console.log('\n   Next Steps:');
  console.log('   ─────────────────────────────────────────────────');
  console.log('   • Sign up for Bright Data: brightdata.com');
  console.log('   • Explore the MCP documentation');
  console.log('   • Build your first multi-level execution pipeline');
  console.log('   • Set up monitoring for your targets');

  console.log('\n   Thank you for attending! 🙏\n');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Classes
  EnvironmentMonitor,
  AlertingSystem,

  // Alert rules
  defaultAlertRules,

  // Factory functions
  createEnvironmentMonitor: (config) => new EnvironmentMonitor(config),
  createAlertingSystem: (config) => new AlertingSystem(config),

  // Demo
  runDemo
};

// Run demo if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}
