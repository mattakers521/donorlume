"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Send, Sparkles } from "lucide-react";

import { C, brandGradient } from "@/lib/design";
import { StarburstLogo } from "@/components/starburst-logo";

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

const SUGGESTIONS = [
  "How do I upload my donor list?",
  "What does the reactivation score mean?",
  "How do I send an outreach campaign?",
  "What's the difference between Starter and Growth?",
];

/**
 * Ask DonorLume — streaming chat assistant. Conversation history lives
 * in component state (cleared on a hard refresh / route-away). The
 * "Reset conversation" action wipes state so a user can start over
 * without reloading. Streaming uses SSE-style chunks from
 * /api/help/chat — each `{"t": "..."}` line appends to the in-progress
 * assistant message in place.
 */
export function HelpChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on each render where messages changed — this is fine
  // under React 19's set-state-in-effect rule because we're mutating a
  // DOM ref, not calling setState.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);

    // Optimistically render the user message + an empty assistant
    // placeholder we'll stream into.
    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages([...nextHistory, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/help/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextHistory }),
      });
      if (!res.ok || !res.body) {
        const errBody = await res.text().catch(() => "");
        throw new Error(errBody || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: { t?: string; done?: boolean; error?: string };
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (event.error) throw new Error(event.error);
          if (event.t) {
            assistantText += event.t;
            setMessages((curr) => {
              const updated = [...curr];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantText,
                };
              }
              return updated;
            });
          }
        }
      }

      // If the stream closed without sending any text, drop the empty
      // placeholder so the user sees a clean error rather than an
      // invisible assistant bubble.
      if (assistantText.length === 0) {
        setMessages((curr) =>
          curr.slice(0, -1),
        );
        throw new Error(
          "The assistant returned no response. Try asking again.",
        );
      }
    } catch (e) {
      // Roll back the empty assistant placeholder so the user can retry.
      setMessages((curr) => {
        const last = curr[curr.length - 1];
        if (last?.role === "assistant" && last.content.length === 0) {
          return curr.slice(0, -1);
        }
        return curr;
      });
      setError(e instanceof Error ? e.message : "Chat error");
    } finally {
      setStreaming(false);
      // Restore focus to the input so the user can immediately retry
      // or follow up without grabbing the mouse.
      textareaRef.current?.focus();
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const reset = () => {
    if (streaming) return;
    setMessages([]);
    setError(null);
    setInput("");
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <section
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        border: `1px solid ${C.border}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px clamp(18px, 3vw, 26px)",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          gap: 14,
          background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        }}
      >
        <StarburstLogo size={36} idKey="help-chat" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: C.amberDark,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 2,
            }}
          >
            Ask DonorLume
          </div>
          <div
            style={{
              fontSize: 14,
              color: C.textBody,
              fontWeight: 500,
            }}
          >
            Your built-in fundraising co-pilot — ask anything about using
            DonorLume.
          </div>
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={reset}
            disabled={streaming}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: C.textSecondary,
              backgroundColor: "transparent",
              border: `1px solid ${C.border}`,
              borderRadius: 100,
              padding: "6px 12px",
              cursor: streaming ? "default" : "pointer",
              opacity: streaming ? 0.5 : 1,
              fontFamily: "var(--font-jakarta), sans-serif",
            }}
          >
            <RefreshCw size={12} /> New chat
          </button>
        )}
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        style={{
          padding: "clamp(18px, 3vw, 26px)",
          maxHeight: 520,
          minHeight: 280,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          backgroundColor: C.bg,
        }}
      >
        {isEmpty ? (
          <EmptyState onSuggest={(s) => send(s)} disabled={streaming} />
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={i}
              role={m.role}
              content={m.content}
              isStreaming={
                streaming &&
                i === messages.length - 1 &&
                m.role === "assistant"
              }
            />
          ))
        )}
      </div>

      {/* Error strip */}
      {error && (
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: C.redLight,
            borderTop: `1px solid ${C.border}`,
            color: C.red,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        style={{
          padding: "14px clamp(14px, 3vw, 20px)",
          borderTop: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          backgroundColor: C.surface,
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask a question…"
          aria-label="Type your question"
          rows={1}
          disabled={streaming}
          style={{
            flex: 1,
            resize: "none",
            border: `1.5px solid ${C.border}`,
            borderRadius: 14,
            padding: "12px 16px",
            fontSize: 15,
            lineHeight: 1.5,
            color: C.text,
            fontFamily: "var(--font-jakarta), sans-serif",
            outline: "none",
            backgroundColor: C.bg,
            maxHeight: 160,
            minHeight: 44,
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = C.amber;
            e.currentTarget.style.boxShadow =
              "0 0 0 4px rgba(232,134,12,0.10)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = C.border;
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Send"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 14,
            background:
              streaming || !input.trim()
                ? C.surfaceHover
                : brandGradient,
            color: streaming || !input.trim() ? C.textTertiary : "#fff",
            border: "none",
            cursor:
              streaming || !input.trim() ? "default" : "pointer",
            boxShadow:
              streaming || !input.trim()
                ? "none"
                : "0 8px 20px rgba(232,134,12,0.30)",
            transition: "background 0.15s, box-shadow 0.15s",
            flexShrink: 0,
          }}
        >
          {streaming ? (
            <Loader2 size={18} className="spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </section>
  );
}

function EmptyState({
  onSuggest,
  disabled,
}: {
  onSuggest: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "20px 12px",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: brandGradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
          boxShadow: "0 12px 32px rgba(232,134,12,0.25)",
        }}
      >
        <Sparkles size={24} color="#fff" />
      </div>
      <h3
        style={{
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          fontSize: 22,
          fontWeight: 400,
          color: C.text,
          margin: "0 0 6px",
          letterSpacing: -0.4,
        }}
      >
        How can I help?
      </h3>
      <p
        style={{
          fontSize: 14,
          color: C.textBody,
          margin: "0 0 22px",
          maxWidth: 380,
          lineHeight: 1.6,
          fontWeight: 500,
        }}
      >
        Ask anything about uploading donors, searching prospects, building
        cohorts, or running outreach campaigns.
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 560,
        }}
      >
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSuggest(s)}
            disabled={disabled}
            style={{
              padding: "10px 14px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: C.surface,
              color: C.text,
              border: `1px solid ${C.border}`,
              cursor: disabled ? "default" : "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              fontFamily: "var(--font-jakarta), sans-serif",
              transition: "background-color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.borderColor = C.amber;
                e.currentTarget.style.backgroundColor = C.amberLight;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.backgroundColor = C.surface;
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  isStreaming,
}: {
  role: ChatRole;
  content: string;
  isStreaming: boolean;
}) {
  const isUser = role === "user";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          maxWidth: "min(640px, 88%)",
          padding: "12px 16px",
          borderRadius: 16,
          backgroundColor: isUser ? C.text : C.surface,
          color: isUser ? "#fff" : C.text,
          border: isUser ? "none" : `1px solid ${C.border}`,
          boxShadow: isUser
            ? "0 4px 12px rgba(0,0,0,0.08)"
            : "0 1px 3px rgba(0,0,0,0.04)",
          fontSize: 14.5,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontWeight: isUser ? 500 : 500,
          // Tail on assistant side
          borderTopLeftRadius: isUser ? 16 : 4,
          borderTopRightRadius: isUser ? 4 : 16,
        }}
      >
        {content || (isStreaming ? <StreamingDots /> : "")}
        {isStreaming && content && <StreamingCaret />}
      </div>
    </div>
  );
}

function StreamingDots() {
  return (
    <span
      aria-label="Thinking"
      style={{
        display: "inline-flex",
        gap: 4,
        alignItems: "center",
        color: C.textTertiary,
      }}
    >
      <Dot delay={0} />
      <Dot delay={0.15} />
      <Dot delay={0.3} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        backgroundColor: C.amber,
        animation: `help-dot-bounce 1s ${delay}s infinite ease-in-out`,
      }}
    />
  );
}

function StreamingCaret() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: 6,
        height: 16,
        marginLeft: 2,
        verticalAlign: "text-bottom",
        backgroundColor: C.amber,
        animation: "help-caret-blink 1s steps(1) infinite",
        borderRadius: 1,
      }}
    />
  );
}
