import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAnthropic } from "@/lib/outreach/anthropic";
import { withOrg } from "@/lib/with-org";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
});

/**
 * "Ask DonorLume" — system prompt is the source of truth for the
 * assistant's behavior. Kept verbatim from the help-page spec so any
 * future tweaks happen in one place.
 *
 * Stable per-byte (no timestamps / IDs / user-specific data) so the
 * prompt-caching breakpoint on the system block can land for every
 * follow-up turn inside the cache TTL.
 */
const SYSTEM_PROMPT = `You are a helpful support assistant for DonorLume, a cohort intelligence platform for nonprofits. Help users understand how to use the product — uploading donor lists, searching prospects, creating outreach campaigns, understanding cohort scores, managing their account. Be warm, concise, and practical. If you don't know something, say so and suggest emailing support@donorlume.com.`;

/**
 * POST /api/help/chat
 *
 * Streaming chat endpoint. Accepts the running conversation in
 * `messages`, calls Claude, and returns an SSE stream where each
 * `data: {"t": "..."}` line is a token delta. Terminates with
 * `data: {"done": true}` on success, or `data: {"error": "..."}` if
 * something fails mid-stream.
 *
 * Auth-gated (`withOrg`) — every chat call hits our Anthropic key, so we
 * scope it to authenticated org members. The org context itself isn't
 * passed to the model; the prompt is fully org-neutral so caching works
 * across customers.
 */
export const POST = withOrg(async (req) => {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let anthropic: Anthropic;
  try {
    anthropic = getAnthropic();
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Anthropic not configured." },
      { status: 500 },
    );
  }

  // The Anthropic SDK's `messages.stream(...)` returns a MessageStream
  // that's async-iterable. We forward only `text_delta` events to the
  // browser as compact JSON-line SSE chunks — keep payloads small and
  // skip empty thinking blocks (Opus 4.7 streams them by default).
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(obj)}\n\n`),
        );

      try {
        const stream = anthropic.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 1024,
          system: [
            {
              type: "text",
              text: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: parsed.data.messages,
        });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ t: event.delta.text });
          }
        }
        send({ done: true });
      } catch (e) {
        // Map upstream Anthropic errors to a clear message; everything
        // else surfaces a generic but non-leaky string.
        let message: string;
        if (e instanceof Anthropic.APIError) {
          message = `Claude: ${e.message}`;
        } else if (e instanceof Error) {
          message = e.message;
        } else {
          message = "Chat stream error";
        }
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Hint to proxies (Vercel, nginx) to flush each chunk.
      "X-Accel-Buffering": "no",
    },
  });
});
