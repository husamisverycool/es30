// Netlify Function: the Roster class API at /api/*.
// Storage: Netlify Blobs (no setup needed on Netlify). Optional: set the
// ANTHROPIC_API_KEY environment variable to let the organizer draft lecture
// recaps with Claude; without it, the organizer writes recap lines by hand.
import { getStore } from "@netlify/blobs";
import Anthropic from "@anthropic-ai/sdk";
import { makeHandler } from "../../lib/api-core.mjs";

async function draft(prompt) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      // Short extraction from the organizer's own notes: low effort keeps it inside the function time limit.
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") throw Object.assign(new Error("declined"), { status: 422, code: "refused" });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text, truncated: response.stop_reason === "max_tokens" };
  } catch (e) {
    if (e.code === "refused") throw e;
    if (e instanceof Anthropic.RateLimitError) throw Object.assign(new Error("rate limited"), { status: 429, code: "rate_limited" });
    if (e instanceof Anthropic.AuthenticationError) throw Object.assign(new Error("bad key"), { status: 501, code: "not_granted" });
    if (e instanceof Anthropic.APIConnectionError) throw Object.assign(new Error("connection"), { status: 503, code: "unavailable" });
    if (e instanceof Anthropic.APIError) throw Object.assign(new Error("api error"), { status: 502, code: "unavailable" });
    throw e;
  }
}

const handler = makeHandler({
  store: (name) => getStore({ name, consistency: "strong" }),
  env: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "" },
  draft,
});

export default handler;
export const config = { path: "/api/*" };
