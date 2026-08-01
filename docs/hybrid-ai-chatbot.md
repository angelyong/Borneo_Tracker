# Hybrid AI Chatbot

> Obsolete Stage 0 archive. This document describes the removed prototype from
> the `aichatbot` branch. It is kept only as historical context.

The current authoritative specification is
`docs/AI_CHATBOT_CONCEPT_AND_PLAN.md`.

The prototype described here is no longer current:

- The Vite `/api/ai/chat` middleware has been removed.
- The `src/server/ai/*` implementation has been deleted.
- The OpenAI SDK path and OpenAI environment variables are obsolete.
- Production failures must surface safe UI errors, not mock answers.

Stage 1 must start from the new plan: Supabase Edge Function runtime, Gemini via
server-side fetch, deterministic evidence objects, and no fabricated data.
