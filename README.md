# Web Execution Layer Workshop

> **Session 4: Hands-On Building Web Execution Pipelines**
> Format: Guided Implementation with Live Support

## Workshop Overview

Learn to build intelligent web execution pipelines using **Bright Data's** infrastructure. This hands-on workshop covers the full spectrum from HTTP requests to AI-native browser automation using Bright Data's products:

- **[Web Unlocker](https://brightdata.com/products/web-unlocker)** - Automatic unblocking for HTTP requests
- **[Scraping Browser](https://brightdata.com/products/scraping-browser)** - Managed browser automation with built-in unblocking
- **[SERP API](https://brightdata.com/products/serp-api)** - Search engine results extraction
- **[Web Scraper MCP](https://github.com/luminati-io/brightdata-mcp)** - AI-native web execution tools

### The Scenario: Market Intelligence Across Varied Web Environments

**Business Intent:**
> "Monitor competitor pricing across multiple markets, refresh weekly, detect significant changes, feed into BI dashboard"

### Target Environments

| Target | Structure | Protection | Complexity | Bright Data Solution |
|--------|-----------|------------|------------|---------------------|
| **Competitor Site B** | Static HTML | Minimal | Low | Web Unlocker (HTTP) |
| **Amazon** | Semi-structured JSON in HTML | Moderate anti-bot | Medium | Scraping Browser |
| **Competitor Site A** | React SPA, dynamic loading | Heavy fingerprinting | High | Scraping Browser (Advanced) |

### Execution Requirements

- **Frequency:** Weekly batch + on-demand
- **Volume:** 500 products × 3 sources × 3 geos = 4,500 data points
- **Latency:** Batch acceptable (not real-time)
- **Failure handling:** Retry with escalation
- **Output:** Structured JSON to Snowflake/Databricks

---

## Repository Structure

```
Web-Execution-Layer/
├── src/
│   ├── part1-http-execution/      # Web Unlocker for basic environments
│   ├── part2-browser-execution/   # Scraping Browser for complex sites
│   ├── part3-mcp-execution/       # Bright Data MCP for AI agents
│   ├── part4-resilience/          # Monitoring and observability
│   └── shared/                    # Utilities, types, and helpers
├── examples/                      # Complete working examples
└── docs/                          # Additional documentation
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Bright Data account ([Sign up free](https://brightdata.com/cp/start))
- API credentials configured

### Installation

```bash
# Clone the repository
git clone https://github.com/ScrapeAlchemist/web-execution-layer.git
cd web-execution-layer

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Add your Bright Data credentials to .env
```

### Getting Bright Data Credentials

1. Sign up at [Bright Data](https://brightdata.com/cp/start)
2. Go to [Web Unlocker](https://brightdata.com/cp/web_access/unlocker) → Get Web Unlocker credentials
3. Go to [Scraping Browser](https://brightdata.com/cp/web_access) → Create Scraping Browser zone
4. Go to [SERP API](https://brightdata.com/cp/web_access/serp) → Get SERP credentials
5. Go to [Zones](https://brightdata.com/cp/zones) → Create proxy zone (if needed)
6. Copy your credentials to `.env`

### Running the Examples

```bash
# Part 1: HTTP Execution with Web Unlocker
npm run part1

# Part 2: Browser Execution with Scraping Browser
npm run part2

# Part 3: MCP Execution with Bright Data MCP
npm run part3

# Part 4: Resilience Demo
npm run part4

# Run complete pipeline
npm run full-demo
```

---

## Workshop Parts

### Part 1: HTTP Execution with Web Unlocker (15 min)
**Target:** Competitor Site B (minimal protection, static HTML)

**Bright Data Products Used:**
- [Web Unlocker API](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction) - Automatic unblocking

Learn to:
- Use Web Unlocker for automatic CAPTCHA solving
- Handle geo-targeting with Bright Data proxies
- Implement automatic escalation triggers
- Track costs per execution level

📁 [Go to Part 1 →](./src/part1-http-execution/)

---

### Part 2: Browser Execution with Scraping Browser (20 min)
**Target:** Amazon & Competitor Site A (JavaScript, anti-bot, dynamic content)

**Bright Data Products Used:**
- [Scraping Browser](https://docs.brightdata.com/scraping-automation/scraping-browser/introduction) - Managed Puppeteer with unblocking
- [Browser API](https://docs.brightdata.com/scraping-automation/scraping-browser/browser-api) - REST API for browser automation

Learn to:
- Connect to Scraping Browser via Puppeteer
- Handle JavaScript rendering automatically
- Manage infinite scroll and dynamic content
- Validate geographic consistency

📁 [Go to Part 2 →](./src/part2-browser-execution/)

---

### Part 3: MCP Execution for AI Agents (20 min)
**AI-Native Web Execution for Unpredictable Environments**

**Bright Data Products Used:**
- [Bright Data MCP Server](https://github.com/luminati-io/brightdata-mcp) - AI-native web tools
- MCP tools: `search_engine`, `scrape_as_markdown`, `scrape_as_html`, `session_*`

Learn to:
- Connect Claude/LLMs to Bright Data MCP
- Use search and scraping tools in AI workflows
- Build autonomous research agents
- Calculate costs across execution levels

📁 [Go to Part 3 →](./src/part3-mcp-execution/)

---

### Part 4: Environmental Resilience & Observability (10 min)

Learn to:
- Monitor environments over time
- Detect structural drift
- Validate geographic consistency
- Set up automated alerting on environmental changes

📁 [Go to Part 4 →](./src/part4-resilience/)

---

## Bright Data Products Overview

### Web Unlocker (HTTP Execution)
```typescript
// Simple HTTP request with automatic unblocking
const response = await fetch(url, {
  proxy: `http://${username}:${password}@brd.superproxy.io:22225`
});
```

**Best for:** Static HTML, APIs, simple pages
**Cost:** ~$3/1000 requests

### Scraping Browser (Browser Execution)
```typescript
// Connect via Puppeteer with automatic unblocking
const browser = await puppeteer.connect({
  browserWSEndpoint: `wss://${auth}@brd.superproxy.io:9222`
});
```

**Best for:** JavaScript-heavy sites, SPAs, anti-bot protected sites
**Cost:** ~$8/1000 pages

### SERP API (Search Execution)
```typescript
// Get Google search results
const results = await serpApi.search({
  query: 'competitor analysis',
  country: 'us'
});
```

**Best for:** Search engine results, market research
**Cost:** ~$3/1000 searches

### MCP Server (AI Execution)
```json
{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["@anthropic/mcp-brightdata"]
    }
  }
}
```

**Best for:** AI agents, autonomous workflows
**Cost:** Variable based on operations

---

## Cost Hierarchy

| Level | Product | Cost/1000 | Speed | Use Case |
|-------|---------|-----------|-------|----------|
| HTTP | Web Unlocker | ~$3 | Fastest | Static HTML, APIs |
| Browser Light | Scraping Browser | ~$8 | Fast | JavaScript rendering |
| Browser Advanced | Scraping Browser | ~$15 | Medium | Anti-bot, fingerprinting |
| MCP Adaptive | MCP Server | Variable | Variable | AI workflows |

---

## Environment Variables

```env
# Bright Data Credentials
BRIGHTDATA_CUSTOMER_ID=your_customer_id
BRIGHTDATA_ZONE_WEB_UNLOCKER=web_unlocker_zone
BRIGHTDATA_ZONE_SCRAPING_BROWSER=scraping_browser_zone
BRIGHTDATA_PASSWORD=your_zone_password

# Optional: MCP API Token
BRIGHTDATA_API_TOKEN=your_api_token

# Optional: Database Output
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password

# Optional: Monitoring
SLACK_WEBHOOK_URL=your_webhook
```

---

## Resources

- [Bright Data Documentation](https://docs.brightdata.com)
- [Bright Data MCP Server](https://github.com/luminati-io/brightdata-mcp)
- [Web Unlocker Guide](https://docs.brightdata.com/scraping-automation/web-unlocker/introduction)
- [Scraping Browser Guide](https://docs.brightdata.com/scraping-automation/scraping-browser/introduction)
- [SERP API Guide](https://docs.brightdata.com/scraping-automation/serp-api/introduction)

---

## Support

- Workshop issues: Raise your hand or use the workshop Slack channel
- Post-workshop: Open an issue in this repository
- Bright Data support: support@brightdata.com

---

## License

MIT License - See [LICENSE](./LICENSE) for details.
