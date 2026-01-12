/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * WEB EXECUTION LAYER WORKSHOP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Main entry point for the workshop code.
 * Run each part sequentially or all together with runFullDemo().
 *
 * WORKSHOP STRUCTURE:
 * - Part 1: HTTP Execution with Bright Data Web Unlocker
 * - Part 2: Browser Execution with Bright Data Scraping Browser
 * - Part 3: MCP Execution for AI-Native Workflows
 * - Part 4: Environmental Resilience & Observability
 *
 * USAGE:
 *   npm run part1    - Run Part 1 demo
 *   npm run part2    - Run Part 2 demo
 *   npm run part3    - Run Part 3 demo
 *   npm run part4    - Run Part 4 demo
 *   npm run demo     - Run complete workshop
 */

// Import all parts
const part1 = require('./part1-http-execution');
const part2 = require('./part2-browser-execution');
const part3 = require('./part3-mcp-execution');
const part4 = require('./part4-resilience');

/**
 * Run all workshop demos sequentially
 */
async function runFullDemo() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║                                                          ║');
  console.log('║         WEB EXECUTION LAYER WORKSHOP                     ║');
  console.log('║         Building Web Execution Pipelines                 ║');
  console.log('║                                                          ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  console.log('\nThis workshop covers:');
  console.log('  • Part 1: HTTP Execution for Simple Environments');
  console.log('  • Part 2: Browser Execution for Complex Environments');
  console.log('  • Part 3: MCP Execution for AI-Native Workflows');
  console.log('  • Part 4: Environmental Resilience & Observability');

  console.log('\nStarting demos...\n');

  await part1.runDemo();
  await part2.runDemo();
  await part3.runDemo();
  await part4.runDemo();

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║         ALL DEMOS COMPLETE! 🎉                           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('\n');
}

// Export everything
module.exports = {
  // Part 1: HTTP Execution
  ...part1,

  // Part 2: Browser Execution
  ...part2,

  // Part 3: MCP Execution
  ...part3,

  // Part 4: Resilience
  ...part4,

  // Demo runners
  runPart1Demo: part1.runDemo,
  runPart2Demo: part2.runDemo,
  runPart3Demo: part3.runDemo,
  runPart4Demo: part4.runDemo,
  runFullDemo
};

// Run full demo if executed directly
if (require.main === module) {
  runFullDemo().catch(console.error);
}
