# Part 3: MCP Execution for Adaptive Navigation

> **Duration:** 20 minutes
> **Focus:** AI-Native Web Execution for Unpredictable Environments

## Learning Objectives

By the end of this section, you will understand:

1. ✅ What MCP (Model Context Protocol) is and why it matters for AI
2. ✅ How to use Bright Data's Web MCP tools
3. ✅ How AI agents choose execution levels based on environment
4. ✅ Building multi-step workflows with environmental awareness
5. ✅ Cost calculation across execution levels
6. ✅ Environmental challenge reporting

## Key Concept

> **The web is a complex execution environment. AI agents need reliable tools to navigate it.**
> Bright Data's Web MCP provides AI-safe web execution that adapts to environmental complexity.

## What is MCP?

MCP (Model Context Protocol) is a standard for connecting AI models to external tools and data sources. It allows AI agents to:

- **Execute** web operations safely and reliably
- **Adapt** to environmental complexity automatically
- **Report** challenges and environmental changes
- **Chain** operations in intelligent workflows

## Bright Data Web MCP Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `web_search` | Search the web via SERP | Finding URLs, competitive research |
| `web_scrape` | Extract data from URLs | Getting structured data from known URLs |
| `web_navigate` | Navigate and interact | Complex flows requiring interaction |

## Files in This Section

| File | Description |
|------|-------------|
| `mcp-client.ts` | MCP client for connecting to Bright Data's Web MCP |
| `ai-agent.ts` | AI agent that uses MCP tools for web research |
| `workflow-executor.ts` | Multi-step workflow execution engine |
| `environment-adapter.ts` | Adapts execution based on environment |
| `demo.ts` | Complete working demonstration |

## Demo Scenario: AI Agent Competitive Research

**Agent Intent:**
> "Find top 5 competitors for [Company] in the e-commerce space, extract their pricing pages across US, UK, and DE markets, and analyze pricing strategy differences by geography"

### Agent Execution Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SEARCH PHASE                              │
│   Tool: web_search                                          │
│   Query: "[Company] competitors e-commerce"                 │
│   Environment: SERP (anti-bot protected)                    │
│   Output: List of competitor URLs                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   DISCOVERY PHASE                            │
│   Tool: web_scrape                                          │
│   Target: Each competitor's homepage                        │
│   Environment: Variable (auto-escalation)                   │
│   Output: Company info, pricing page URLs                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  GEOGRAPHIC PHASE                            │
│   Tool: web_scrape (multi-geo)                              │
│   Target: Pricing pages × 3 geos                           │
│   Environment: Multi-market (proper IPs)                    │
│   Output: Prices by region                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   ANALYSIS PHASE                             │
│   Tool: AI synthesis                                        │
│   Input: All extracted data + metadata                      │
│   Output: Pricing strategy analysis                         │
└─────────────────────────────────────────────────────────────┘
```

## Code Walkthrough

### Step 1: Initialize MCP Client

```typescript
import { MCPClient } from './mcp-client';

const mcp = new MCPClient({
  apiKey: process.env.BRIGHTDATA_API_KEY!,
  zone: 'mcp'
});
```

### Step 2: Web Search

```typescript
const searchResults = await mcp.webSearch({
  query: 'Shopify competitors e-commerce platforms',
  limit: 10
});

// Results include URLs with environmental metadata
searchResults.forEach(result => {
  console.log(`${result.title}: ${result.url}`);
  console.log(`  Environment: ${result.environmentHint}`);
});
```

### Step 3: Web Scrape with Auto-Escalation

```typescript
const scrapeResult = await mcp.webScrape({
  url: 'https://competitor.com/pricing',
  geo: 'us',
  // MCP automatically chooses HTTP or Browser based on environment
  autoEscalate: true
});

console.log(`Execution level: ${scrapeResult.executionLevel}`);
console.log(`Content: ${scrapeResult.content.length} chars`);
```

### Step 4: Multi-Geo Scraping

```typescript
const geoResults = await mcp.webScrapeMultiGeo({
  url: 'https://competitor.com/pricing',
  geos: ['us', 'uk', 'de']
});

for (const [geo, result] of geoResults) {
  console.log(`${geo.toUpperCase()}: ${result.extractedPrice}`);
}
```

### Step 5: Navigation for Complex Flows

```typescript
const navResult = await mcp.webNavigate({
  url: 'https://competitor.com',
  steps: [
    { action: 'click', selector: '.pricing-link' },
    { action: 'wait', condition: '.pricing-table' },
    { action: 'extract', selector: '.plan-price' }
  ]
});
```

## Running the Demo

```bash
# From repository root
npm run part3

# Or directly
npx ts-node src/part3-mcp-execution/demo.ts
```

## Expected Output

```
🤖 AI AGENT: COMPETITIVE RESEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Phase 1: Search
   🔍 Searching for competitors...
   Tool: web_search
   Query: "Shopify competitors e-commerce"
   Results: 8 competitor URLs found

Phase 2: Discovery
   📍 Analyzing competitor sites...
   • BigCommerce: HTTP execution (low complexity)
   • WooCommerce: HTTP execution (low complexity)
   • Magento: Browser execution (JavaScript required)
   • Squarespace: Browser execution (SPA detected)
   • Wix: Browser execution (heavy protection)

Phase 3: Geographic Pricing
   🌍 Extracting prices across regions...

   BigCommerce:
     US: $29.95/mo
     UK: £24.95/mo
     DE: €27.95/mo

   WooCommerce:
     US: Free (open source)
     UK: Free (open source)
     DE: Free (open source)

   [... more results ...]

Phase 4: Analysis
   📊 Generating insights...

   Key Findings:
   1. 60% of competitors have geographic price variance
   2. Average variance: 15% between US and UK
   3. DE prices typically 5-10% higher than US
   4. 2 competitors offer single global pricing

💰 Total Cost: $0.45
   Search: $0.05
   Discovery: $0.15
   Geographic: $0.25
```

## Exercises

### Exercise 3.1: Custom Research Agent
Build an agent that researches a specific topic and summarizes findings.

### Exercise 3.2: Price Monitor
Create a workflow that monitors prices daily and alerts on changes.

### Exercise 3.3: Content Aggregator
Build an agent that aggregates news from multiple sources.

## Key Takeaways

1. **AI-Native**: MCP provides tools designed for AI agent consumption
2. **Auto-Adaptation**: Execution level chosen based on environment
3. **Multi-Step Workflows**: Chain operations intelligently
4. **Environmental Awareness**: Agents know about and report challenges
5. **Cost Transparency**: Clear cost tracking across operations

## Next Section

Ready to ensure reliability? Continue to [Part 4: Environmental Resilience →](../part4-resilience/)
