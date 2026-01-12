# Part 4: Environmental Resilience & Observability

> **Duration:** 10 minutes
> **Focus:** Monitoring, detection, and alerting for web execution pipelines

## Key Message

> **The web is a dynamic execution environment. What works today may break tomorrow.**
> You need continuous environmental monitoring and adaptive strategies.

## Learning Objectives

By the end of this section, you will understand:

1. ✅ How to monitor environments over time
2. ✅ How to detect structural drift
3. ✅ How to validate geographic consistency
4. ✅ How to analyze temporal patterns
5. ✅ How to set up automated alerting

## Files in This Section

| File | Description |
|------|-------------|
| `environment-monitor.ts` | Continuous monitoring of target environments |
| `structural-drift-detector.ts` | Detects changes in page structure |
| `temporal-analyzer.ts` | Analyzes patterns over time |
| `alerting.ts` | Automated alerting system |
| `demo.ts` | Complete working demonstration |

## Why Resilience Matters

Web environments change constantly:

- **Site Redesigns**: HTML structure changes
- **Anti-Bot Updates**: New protection measures
- **Geographic Changes**: Different content by region
- **Temporal Patterns**: Prices change at specific times
- **Availability**: Sites go down or rate limit

Without monitoring, your pipeline will fail silently.

## Code Walkthrough

### Step 1: Environment Monitoring

```typescript
import { EnvironmentMonitor } from './environment-monitor';

const monitor = new EnvironmentMonitor({
  targets: [
    'https://competitor-a.com/pricing',
    'https://competitor-b.com/pricing'
  ],
  checkInterval: 3600000, // 1 hour
  geos: ['us', 'uk', 'de']
});

monitor.on('environment-change', (event) => {
  console.log(`Environment changed: ${event.url}`);
  console.log(`Type: ${event.changeType}`);
  console.log(`Severity: ${event.severity}`);
});

monitor.start();
```

### Step 2: Structural Drift Detection

```typescript
import { StructuralDriftDetector } from './structural-drift-detector';

const detector = new StructuralDriftDetector();

// Store baseline
detector.recordBaseline('competitor-a.com', html);

// Later, check for drift
const drift = detector.detect('competitor-a.com', newHtml);

if (drift.detected) {
  console.log(`Drift detected: ${drift.severity}`);
  console.log(`Changed selectors: ${drift.changedSelectors.join(', ')}`);
}
```

### Step 3: Temporal Analysis

```typescript
import { TemporalAnalyzer } from './temporal-analyzer';

const analyzer = new TemporalAnalyzer();

// Record observations over time
analyzer.record('competitor-a.com', { price: 29.99, timestamp: new Date() });

// Analyze patterns
const patterns = analyzer.analyze('competitor-a.com');

console.log(`Price changes: ${patterns.changeFrequency}`);
console.log(`Best scrape time: ${patterns.optimalScrapeTime}`);
```

### Step 4: Alerting

```typescript
import { AlertingSystem } from './alerting';

const alerting = new AlertingSystem({
  channels: {
    slack: { webhook: process.env.SLACK_WEBHOOK },
    email: { to: 'team@company.com' }
  },
  rules: [
    {
      name: 'Structure Change',
      condition: (event) => event.type === 'structural-drift',
      severity: 'warning',
      channels: ['slack']
    },
    {
      name: 'Complete Failure',
      condition: (event) => event.type === 'execution-failure',
      severity: 'critical',
      channels: ['slack', 'email']
    }
  ]
});

monitor.pipe(alerting);
```

## Running the Demo

```bash
# From repository root
npm run part4

# Or directly
npx ts-node src/part4-resilience/demo.ts
```

## Expected Output

```
📊 ENVIRONMENT MONITORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Target: competitor-a.com
   Status: ✅ Healthy
   Last Check: 2 minutes ago
   Response Time: 1,250ms
   Execution Level: browser-light
   Geo Consistency: ✅ All 3 regions consistent

Target: competitor-b.com
   Status: ⚠️ Warning
   Last Check: 5 minutes ago
   Response Time: 8,500ms (slow)
   Execution Level: browser-advanced
   Geo Consistency: ⚠️ UK returning different structure

🔍 STRUCTURAL DRIFT DETECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

competitor-a.com:
   Baseline: 2024-01-15
   Current Match: 95%
   Status: ✅ Stable

competitor-b.com:
   Baseline: 2024-01-15
   Current Match: 72%
   Status: ⚠️ Drift Detected
   Changes:
     - .price-box → .pricing-container
     - .product-title → h1.title
     - .add-to-cart removed

📈 TEMPORAL PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

competitor-a.com:
   Price Changes: Weekly (Mondays)
   Optimal Scrape Time: Tuesday 6am UTC
   Availability: 99.8%

competitor-b.com:
   Price Changes: Daily
   Optimal Scrape Time: 3am UTC (lowest load)
   Availability: 97.2%

🚨 ALERTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[WARNING] competitor-b.com structure drift detected
   Action: Review selectors, update extraction
   Sent to: Slack

[INFO] Weekly price change detected on competitor-a.com
   Action: Scheduled re-scrape triggered
   Sent to: Slack
```

## Best Practices

### 1. Monitor Proactively
Don't wait for failures. Check environments continuously.

### 2. Version Your Selectors
Keep historical selector configurations to enable rollback.

### 3. Gradual Rollout
When structure changes, update selectors and test before full deployment.

### 4. Alert Appropriately
- **Critical**: Pipeline completely broken
- **Warning**: Degraded performance or partial failure
- **Info**: Expected changes (like price updates)

### 5. Document Patterns
Track what you learn about each target's behavior.

## Exercises

### Exercise 4.1: Custom Alert Rules
Create alert rules for your specific use case.

### Exercise 4.2: Historical Analysis
Build a dashboard showing environment health over time.

### Exercise 4.3: Auto-Remediation
Implement automatic selector updates when drift is detected.

## Key Takeaways

1. **Monitor Continuously**: Environments change without warning
2. **Detect Early**: Catch issues before they impact data quality
3. **Adapt Quickly**: Have processes to respond to changes
4. **Learn Patterns**: Use history to predict and prevent issues
5. **Alert Intelligently**: Right message, right channel, right time

## Workshop Complete!

Congratulations! You've learned:

1. **Part 1**: HTTP execution for simple environments
2. **Part 2**: Browser execution for complex environments
3. **Part 3**: MCP execution for AI-native workflows
4. **Part 4**: Resilience and observability

You're now ready to build production web execution pipelines!
