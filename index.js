/**
 * Package-root module for the Temporary Project Host half.
 *
 * The bundle patch imports `./route.js` directly, so the route implementation
 * lives in one file. This root re-export keeps the package importable for
 * tests and tooling.
 */
export * from './route.js'
