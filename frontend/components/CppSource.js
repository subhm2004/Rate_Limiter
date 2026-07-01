"use client";

import { useState } from "react";

// Collapsible viewer for the real C++ header behind the selected algorithm.
// Fetches /api/source (served straight from backend/include/) and renders it
// with a tiny dependency-free syntax highlighter.

const KEYWORDS = new Set([
  "auto", "bool", "break", "case", "catch", "char", "class", "const", "constexpr",
  "continue", "default", "delete", "do", "double", "else", "enum", "explicit",
  "false", "float", "for", "friend", "if", "inline", "int", "long", "mutable",
  "namespace", "new", "noexcept", "nullptr", "operator", "override", "private",
  "protected", "public", "return", "short", "signed", "sizeof", "static",
  "struct", "switch", "template", "this", "throw", "true", "try", "typedef",
  "typename", "union", "unsigned", "using", "virtual", "void", "while",
]);

// one line -> array of {t: text, c: className} tokens
function tokenizeLine(line) {
  const out = [];
  const re = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(^\s*#\s*\w+)|([A-Za-z_]\w*)|(\b\d+(?:\.\d+)?[fuUL]*\b)/g;
  let last = 0, m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    if (m[1]) out.push({ t: m[1], c: "tok-cm" });
    else if (m[2]) out.push({ t: m[2], c: "tok-str" });
    else if (m[3]) out.push({ t: m[3], c: "tok-pre" });
    else if (m[4]) out.push({ t: m[4], c: KEYWORDS.has(m[4]) ? "tok-kw" : undefined });
    else if (m[5]) out.push({ t: m[5], c: "tok-num" });
    last = re.lastIndex;
  }
  if (last < line.length) out.push({ t: line.slice(last) });
  return out;
}

export default function CppSource({ algoId }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);

  function toggle() {
    setOpen((o) => !o);
    if (!data) {
      fetch(`/api/source?algo=${algoId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setData)
        .catch(() => setData({ error: true }));
    }
  }

  return (
    <div className="src-wrap">
      <button className="btn src-btn" onClick={toggle}>
        {open ? "▾ Hide C++ source" : "‹/› View the C++ source"}
      </button>

      {open && (
        <div className="src-view">
          <div className="src-head">
            <span className="src-file">{data?.file || "loading…"}</span>
            <span className="muted small">the actual engine code, straight from the repo</span>
          </div>
          {data?.error && (
            <p className="src-err">Could not load the source — is the backend running?</p>
          )}
          {data?.source && (
            <pre className="src-code">
              {data.source.split("\n").map((line, i) => (
                <div className="src-line" key={i}>
                  <span className="src-ln">{i + 1}</span>
                  <span className="src-txt">
                    {tokenizeLine(line).map((tok, j) =>
                      tok.c ? <span key={j} className={tok.c}>{tok.t}</span> : tok.t
                    )}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
