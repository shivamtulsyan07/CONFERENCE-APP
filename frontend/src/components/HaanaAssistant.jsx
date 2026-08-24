import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { Sparkles, SendHorizonal } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SID_KEY = "haana_session_id";

const sessionId = () => {
  let s = localStorage.getItem(SID_KEY);
  if (!s) {
    s = `haana-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SID_KEY, s);
  }
  return s;
};

const SUGGESTIONS = [
  "What is pending with the company?",
  "Which party has the most pending rows?",
  "Top 5 items I must order from the company",
  "Summarise today's position in 3 lines",
];

export const HaanaAssistant = ({ suggestionsFor }) => {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const sid = useRef(sessionId());
  const boxRef = useRef(null);

  useEffect(() => {
    api.assistantHistory(sid.current).then((h) => setMsgs(h.map((m) => ({ role: m.role, text: m.text })))).catch(() => {});
  }, []);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  const ask = async (text) => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setQ("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: question }, { role: "assistant", text: "" }]);
    try {
      const res = await fetch(`${API}/assistant/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sid.current, message: question }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", text: acc };
          return c;
        });
      }
    } catch (e) {
      setMsgs((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", text: `Could not reach the assistant (${e.message}).` };
        return c;
      });
    } finally {
      setBusy(false);
    }
  };

  const chips = suggestionsFor?.length ? suggestionsFor : SUGGESTIONS;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="haana-assistant">
      <div ref={boxRef} className="min-h-0 flex-1 overflow-auto px-3 py-2 space-y-2">
        {msgs.length === 0 && (
          <div className="text-[11px] text-[color:var(--dash-dim)] mono leading-relaxed">
            Ask HAANA anything about your live sheets — pending at company, party position, what to order.
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            data-testid={`haana-msg-${m.role}-${i}`}
            className={`text-xs leading-relaxed whitespace-pre-wrap border-l-2 pl-2 py-1 ${
              m.role === "user"
                ? "border-[color:var(--tone-accent)] text-[color:var(--tone-accent)]"
                : "border-[color:var(--dash-line)] text-[color:var(--dash-text)]"
            }`}
          >
            <span className="mono text-[9px] uppercase tracking-[0.16em] text-[color:var(--dash-dim)] block mb-0.5">
              {m.role === "user" ? "You" : "Haana"}
            </span>
            {m.text || (busy ? "…" : "")}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-[color:var(--dash-line)] px-3 py-2">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {chips.map((c, i) => (
            <button
              key={i}
              data-testid={`haana-chip-${i}`}
              disabled={busy}
              onClick={() => ask(c)}
              className="border border-[color:var(--dash-line)] px-2 py-1 text-[10px] text-[color:var(--dash-dim)] hover:border-[color:var(--tone-accent)] hover:text-white transition-colors duration-200 disabled:opacity-40"
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[color:var(--tone-accent)] shrink-0" />
          <input
            data-testid="haana-input"
            value={q}
            disabled={busy}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
            placeholder={busy ? "Haana is thinking…" : "Ask about your data…"}
            className="flex-1 bg-transparent text-xs text-[color:var(--dash-text)] placeholder:text-[color:var(--dash-dim)] outline-none py-1"
          />
          <button
            data-testid="haana-send"
            disabled={busy}
            onClick={() => ask()}
            className="border border-[color:var(--tone-accent)] px-2 py-1 text-[color:var(--tone-accent)] hover:bg-[color:var(--tone-accent)] hover:text-[color:var(--dash-bg)] transition-colors duration-200 disabled:opacity-40"
          >
            <SendHorizonal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
