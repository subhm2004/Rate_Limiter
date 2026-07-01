"use client";

import { useState } from "react";

// VS Code–style viewer for the real C++ header behind the selected algorithm.
// Fetches /api/source (served straight from backend/include/) and renders it
// inside an editor window styled after VS Code's Dark+ theme, with a
// dependency-free tokenizer that mimics Dark+ C++ colouring.

// control-flow keywords → purple (#C586C0)
const CONTROL = new Set([
  "if", "else", "for", "while", "do", "switch", "case", "default", "break",
  "continue", "return", "throw", "try", "catch", "new", "delete", "goto",
]);
// storage / type keywords → blue (#569CD6)
const STORAGE = new Set([
  "class", "struct", "enum", "union", "namespace", "using", "template",
  "typename", "public", "private", "protected", "const", "constexpr", "static",
  "inline", "virtual", "override", "final", "friend", "explicit", "mutable",
  "noexcept", "operator", "this", "sizeof", "typedef", "void", "bool", "int",
  "double", "float", "char", "long", "short", "unsigned", "signed", "auto",
  "true", "false", "nullptr",
]);

// one line -> array of {t: text, c: className} tokens (Dark+ colours)
function tokenizeLine(line) {
  const out = [];

  // preprocessor lines: directive purple, <header> / "header" orange
  const pp = line.match(/^(\s*#\s*\w+)(.*)$/);
  if (pp) {
    out.push({ t: pp[1], c: "tk-pp" });
    const rest = pp[2];
    const rre = /(<[^>]*>|"(?:[^"\\]|\\.)*")/g;
    let last = 0, m;
    while ((m = rre.exec(rest)) !== null) {
      if (m.index > last) out.push({ t: rest.slice(last, m.index) });
      out.push({ t: m[0], c: "tk-str" });
      last = rre.lastIndex;
    }
    if (last < rest.length) out.push({ t: rest.slice(last) });
    return out;
  }

  const re = /("(?:[^"\\]|\\.)*")|([A-Za-z_]\w*)|(\d+(?:\.\d+)?(?:e[+-]?\d+)?[fuUL]*)/g;
  let last = 0, m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ t: line.slice(last, m.index) });
    if (m[1]) {
      out.push({ t: m[1], c: "tk-str" });
    } else if (m[2]) {
      const id = m[2];
      const next2 = line.slice(re.lastIndex, re.lastIndex + 2);
      let cls = "tk-var";
      if (CONTROL.has(id)) cls = "tk-ctl";
      else if (STORAGE.has(id)) cls = "tk-kw";
      else if (/^[A-Z]/.test(id) || next2.startsWith("::") || next2.startsWith("<")) cls = "tk-type";
      else if (next2.startsWith("(")) cls = "tk-fn";
      out.push({ t: id, c: cls });
    } else if (m[3]) {
      out.push({ t: m[3], c: "tk-num" });
    }
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

  const fname = data?.file ? data.file.split("/").pop() : "…";
  const lines = data?.source ? data.source.split("\n") : [];

  return (
    <div className="src-wrap">
      <button className="btn src-btn" onClick={toggle}>
        {open ? "▾ Hide C++ source" : "‹/› View the C++ source"}
      </button>

      {open && (
        <div className="vsc">
          {/* window title bar with a VS Code-style tab */}
          <div className="vsc-bar">
            <span className="vsc-dots"><i /><i /><i /></span>
            <span className="vsc-tab">
              <span className="vsc-ico">⟨⟩</span>
              {fname}
              <span className="vsc-x">×</span>
            </span>
          </div>

          {data?.error && (
            <p className="vsc-err">Could not load the source — is the backend running?</p>
          )}

          {data?.source && (
            <pre className="vsc-code">
              {lines.map((line, i) => (
                <div className="vsc-line" key={i}>
                  <span className="vsc-ln">{i + 1}</span>
                  <span className="vsc-txt">
                    {tokenizeLine(line).map((tok, j) =>
                      tok.c ? <span key={j} className={tok.c}>{tok.t}</span> : tok.t
                    )}
                  </span>
                </div>
              ))}
            </pre>
          )}

          {/* the classic blue status bar */}
          <div className="vsc-status">
            <span>⑂ main</span>
            <span>{lines.length} lines · Spaces: 4 · UTF-8 · LF · C++</span>
          </div>
        </div>
      )}
    </div>
  );
}
