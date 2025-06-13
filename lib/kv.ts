import { kv } from "@vercel/kv"
import type { VercelKV } from "@vercel/kv" // Import the type for clarity

// The @vercel/kv package automatically uses the KV_... environment variables
// when deployed on Vercel. No explicit configuration is needed here for production.

// For local development, you might need to set up environment variables
// if you're connecting to a remote Vercel KV store or using a local Redis via upstash-redis-proxy.
// See Vercel KV documentation for local development setup.

console.log("[lib/kv.ts] Initializing Vercel KV client...")

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  if (process.env.NODE_ENV === "production") {
    // This case should ideally not happen if Vercel KV is correctly provisioned
    console.error(
      "[lib/kv.ts] CRITICAL: Missing Vercel KV credentials (KV_REST_API_URL or KV_REST_API_TOKEN) in PRODUCTION.",
    )
    // Fallback to a mock or throw an error, depending on desired behavior
    // For now, let's allow a mock to prevent hard crashes in previews if misconfigured.
  } else {
    console.warn(
      "[lib/kv.ts] Missing Vercel KV credentials. This is expected for local development if not using a remote KV store. " +
        "API calls to KV will likely fail or use a local mock if one were implemented here.",
    )
  }
  // Note: @vercel/kv might still work locally if you've used `vc dev` which injects env vars.
  // If not, and you need a local mock, you'd implement it similarly to the Redis mock,
  // but matching the @vercel/kv API. For now, we'll assume it either connects or fails gracefully
  // if env vars are missing locally and no local proxy is running.
} else {
  console.log("[lib/kv.ts] Vercel KV credentials found. Client should be operational.")
}

// Export the kv client directly
export { kv }
export type { VercelKV } // Export the type if needed elsewhere
