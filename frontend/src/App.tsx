import type { KeyboardEvent } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card } from './components/card';
import { Button } from './components/button';
import { Badge } from './components/badge';
import { CheatSheetPanel } from './components/cheat-sheet-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/table';
import { Play, Trash2, Sun, Moon, Loader2, PawPrint, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { MultiLineCompilerResult } from './types/compiler';
import { cn } from './components/utils';

// ── Types ─────────────────────────────────────────────────
type CompilerSymbol = MultiLineCompilerResult['finalSymbolTable'][number];
type SymbolRow = { name: string; type: string; levelScope: string; offset: number; size: number };

// ── Constants ─────────────────────────────────────────────
const EXAMPLE_SNIPPETS = {
  basicProgram: [
    'bone number := 10 !',
    'bone total := number + 5 !',
    'arf "Total is: " + total !',
  ].join('\n'),
  inputOutput: [
    'fur username := "guest" !',
    'sniff username !',
    'arf "Hello, " + username !',
  ].join('\n'),
  scopedProgram: [
    'bone x := 5 !',
    'sit ( x > 3 ) {',
    '  bone y := x + 2 !',
    '  arf "Inner: " + y !',
    '}',
    'arf "Outer: " + x !',
  ].join('\n'),
  ifElseProgram: [
    'bone score := 85 !',
    'sit ( score >= 75 ) {',
    '  arf "Pass" !',
    '} stay {',
    '  arf "Fail" !',
    '}',
  ].join('\n'),
  lexicalError: 'bone bad := 5 @ !',
  syntaxError: 'bone value = 10 !',
  semanticError: 'bone total := missingVar + 1 !',
  logicalError: ['bone n := 10 !', 'bone result := n / 0 !', 'arf result !'].join('\n'),
};

const TYPE_LABEL_MAP: Record<string, string> = {
  fur: 'string', bone: 'int', paw: 'float', tail: 'double', woof: 'bool',
};
const TYPE_SIZE_MAP: Record<string, number> = {
  fur: 4, bone: 4, paw: 4, tail: 8, woof: 1,
};

// ── Syntax Highlighting ───────────────────────────────────
const KEYWORDS = new Set([
  'sit','stay','rollover','walk','run',
  'fetch','sniff','trick','yield',
  'arf',
  'fur','bone','paw','tail','woof',
  'true','false',
]);

function tokenizeLine(line: string) {
  const out: { type: string; value: string }[] = [];
  let i = 0;
  while (i < line.length) {
    // Comment
    if (line[i] === '/' && line[i + 1] === '/') { out.push({ type: 'cmt', value: line.slice(i) }); break; }
    // Double-quoted string
    if (line[i] === '"') {
      let j = i + 1; while (j < line.length && line[j] !== '"') j++;
      out.push({ type: 'str', value: line.slice(i, j + 1) }); i = j + 1; continue;
    }
    // Single-quoted string
    if (line[i] === "'") {
      let j = i + 1; while (j < line.length && line[j] !== "'") j++;
      out.push({ type: 'str', value: line.slice(i, j + 1) }); i = j + 1; continue;
    }
    // Identifier / keyword
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i; while (j < line.length && /\w/.test(line[j])) j++;
      const w = line.slice(i, j);
      out.push({ type: KEYWORDS.has(w) ? 'kw' : 'id', value: w }); i = j; continue;
    }
    // Number
    if (/\d/.test(line[i])) {
      let j = i; while (j < line.length && /[\d.]/.test(line[j])) j++;
      out.push({ type: 'num', value: line.slice(i, j) }); i = j; continue;
    }
    // Two-char operators
    const two = line.slice(i, i + 2);
    if ([':=','==','&&','||'].includes(two)) { out.push({ type: 'op', value: two }); i += 2; continue; }
    // Single-char delimiter / operator
    if (line[i] === '!') { out.push({ type: 'dlm', value: '!' }); i++; continue; }
    if ('+-*/!<>='.includes(line[i])) { out.push({ type: 'op', value: line[i] }); i++; continue; }
    out.push({ type: 'plain', value: line[i] }); i++;
  }
  return out;
}

function htmlEsc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHighlightedHtml(code: string): string {
  return code.split('\n').map(line =>
    tokenizeLine(line).map(({ type, value }) => {
      const e = htmlEsc(value);
      if (type === 'kw')  return `<span class="tok-kw">${e}</span>`;
      if (type === 'str') return `<span class="tok-str">${e}</span>`;
      if (type === 'num') return `<span class="tok-num">${e}</span>`;
      if (type === 'cmt') return `<span class="tok-cmt">${e}</span>`;
      if (type === 'op')  return `<span class="tok-op">${e}</span>`;
      if (type === 'dlm') return `<span class="tok-dlm">${e}</span>`;
      return e;
    }).join('')
  ).join('\n');
}

// ── Code Editor Component ─────────────────────────────────
interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  onRunCompiler: () => void;
  errorLines: Set<number>;
  editorRef: React.RefObject<HTMLTextAreaElement | null>;
}

type MascotState = 'idle' | 'loading' | 'success' | 'error';

function CompileMascot({ state }: { state: MascotState }) {
  const toneClass = state === 'success'
    ? 'text-emerald-500'
    : state === 'error'
      ? 'text-[#FF6B6B]'
      : state === 'loading'
        ? 'text-[color:var(--golden-main)] animate-pulse'
        : 'text-muted-foreground';

  return (
    <div className={cn('flex items-center gap-2 rounded-full border border-border bg-background/70 px-2.5 py-1', toneClass)}>
      <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
        <path d="M16 18c-5 0-9 4-9 9v8c0 4 2 8 6 10l6-4V18h-3z" fill="currentColor" opacity="0.25" />
        <path d="M48 18c5 0 9 4 9 9v8c0 4-2 8-6 10l-6-4V18h3z" fill="currentColor" opacity="0.25" />
        <circle cx="32" cy="32" r="18" fill="currentColor" opacity="0.18" />
        <circle cx="25" cy="29" r="2" fill="currentColor" />
        <circle cx="39" cy="29" r="2" fill="currentColor" />
        <ellipse cx="32" cy="36" rx="4" ry="3" fill="currentColor" opacity="0.9" />
        {state === 'success' && <path d="M23 41c2 4 5 6 9 6s7-2 9-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />}
        {state === 'error' && <path d="M24 47c2-3 5-4 8-4s6 1 8 4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />}
        {state === 'loading' && <path d="M24 42c3 2 5 3 8 3s5-1 8-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 2" />}
        {state === 'idle' && <path d="M25 43c2 1.5 4 2 7 2s5-0.5 7-2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
      </svg>
      <span className="text-[10px] font-mono uppercase tracking-wide">
        {state === 'success' ? 'Happy Retriever' : state === 'error' ? 'Concerned Retriever' : state === 'loading' ? 'Sniffing...' : 'Ready'}
      </span>
    </div>
  );
}

function CodeEditor({ value, onChange, onRunCompiler, errorLines, editorRef }: CodeEditorProps) {
  const preRef     = useRef<HTMLPreElement>(null);
  const lineNumRef = useRef<HTMLDivElement>(null);

  const syncScroll = () => {
    const ta = editorRef.current;
    if (!ta) return;  
    if (preRef.current)     { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
    if (lineNumRef.current) { lineNumRef.current.scrollTop = ta.scrollTop; }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); onRunCompiler(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const s = ta.selectionStart, end = ta.selectionEnd;
      const next = value.slice(0, s) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
  };

  const lineCount  = Math.max(value.split('\n').length, 30);
  const highlighted = useMemo(() => buildHighlightedHtml(value), [value]);

  return (
    <div className={cn('code-editor-wrap flex h-full min-h-[460px] overflow-hidden font-mono text-sm leading-6 rounded-b-xl', !value.trim() && 'is-empty')}>
      {/* Line numbers */}
      <div ref={lineNumRef} className="code-line-nums flex-none w-11 overflow-hidden select-none text-right pt-3 pr-3 pl-2 text-xs">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className={cn('leading-6', errorLines.has(i + 1) ? 'text-[#FF4C4C] font-bold' : '')}>
            {i + 1}
          </div>
        ))}
      </div>
      {/* Highlighted overlay + textarea */}
      <div className="relative flex-1 overflow-hidden">
        {!value.trim() && (
          <PawPrint className="pointer-events-none absolute bottom-4 right-5 z-0 size-20 text-[color:var(--editor-placeholder)] opacity-[0.08]" aria-hidden />
        )}
        <pre
          ref={preRef}
          className="code-pre absolute inset-0 z-[1] m-0 overflow-hidden whitespace-pre-wrap break-words pointer-events-none pt-3 px-3 pb-3 leading-6 text-sm font-mono"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
          aria-hidden
        />
        <textarea
          ref={editorRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          placeholder="// Write your Retriever code here...  e.g. Fur name := &quot;Buddy&quot;!"
          className="code-textarea absolute inset-0 z-10 w-full h-full resize-none overflow-auto pt-3 px-3 pb-3 outline-none border-0 leading-6 text-sm font-mono"
        />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────
function buildLineErrors(results: MultiLineCompilerResult) {
  return results.lines
    .map(line => ({
      lineNumber: line.lineNumber,
      messages: [
        ...line.result.lexer.errors.map(m => `LEXER: ${m}`),
        ...line.result.syntax.errors.map(m => `SYNTAX: ${m}`),
        ...line.result.semantic.errors.map(m => `SEMANTIC: ${m}`),
      ],
    }))
    .filter(l => l.messages.length > 0);
}

function buildSymbolRows(entries: CompilerSymbol[]): SymbolRow[] {
  return entries.map((entry, idx) => {
    const scopeLevel = typeof entry.scopeLevel === 'number' ? entry.scopeLevel : 0;
    const fallbackOffset = entries
      .slice(0, idx)
      .filter(p => (typeof p.scopeLevel === 'number' ? p.scopeLevel : 0) === scopeLevel)
      .reduce((sum, p) => sum + (TYPE_SIZE_MAP[p.type] ?? 4), 0);
    return {
      name: entry.variable,
      type: TYPE_LABEL_MAP[entry.type] ?? entry.type.toLowerCase(),
      levelScope: `${scopeLevel} (${entry.scopeLabel || (scopeLevel === 0 ? 'Global' : 'Local')})`,
      offset: typeof entry.offset === 'number' ? entry.offset : fallbackOffset,
      size: TYPE_SIZE_MAP[entry.type] ?? 4,
    };
  });
}

// ── App ───────────────────────────────────────────────────
export default function App() {
  const [code, setCode]               = useState('');
  const [runtimeInputMap, setRuntimeInputMap] = useState<Record<string, string>>({});
  const [consoleInputText, setConsoleInputText] = useState('');
  const [pendingSniffVar, setPendingSniffVar] = useState<string | null>(null);
  const [pendingSniffPrompt, setPendingSniffPrompt] = useState('');
  const [lastInputEcho, setLastInputEcho] = useState<{ prompt: string; value: string } | null>(null);
  const [result, setResult]           = useState<MultiLineCompilerResult | null>(null);
  const [isRunning, setIsRunning]     = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isDark, setIsDark]           = useState(() => localStorage.getItem('theme') === 'dark');
  const [activeOutputTab, setActiveOutputTab] = useState<'output' | 'errors' | 'logs'>('output');
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const editorRef                     = useRef<HTMLTextAreaElement>(null);

  // Apply / persist dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const detectSniffRequest = useCallback((compileResult: MultiLineCompilerResult) => {
    const missingInputMessage = compileResult.lines
      .flatMap((line) => line.result.semantic.errors)
      .find((msg) => /No input provided for '\w+'/i.test(msg));

    if (!missingInputMessage) return null;
    const match = missingInputMessage.match(/No input provided for '(\w+)'/i);
    if (!match) return null;

    return match[1];
  }, []);

  const handleRunCompiler = useCallback(async (overrideInput?: Record<string, string>) => {
    if (!code.trim()) return;

    const payloadInput = overrideInput ?? runtimeInputMap;

    setIsRunning(true);
    setRequestError(null);
    try {
      const res = await fetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input: payloadInput }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? 'Failed to compile code');
      }
      const compileResult = (await res.json()) as MultiLineCompilerResult;
      setResult(compileResult);

      const missingSniffVar = detectSniffRequest(compileResult);
      if (missingSniffVar) {
        const promptCandidate = compileResult.outputValues?.length
          ? compileResult.outputValues[compileResult.outputValues.length - 1]
          : `enter ${missingSniffVar}:`;
        setPendingSniffVar(missingSniffVar);
        setPendingSniffPrompt(promptCandidate);
      } else {
        setPendingSniffVar(null);
        setPendingSniffPrompt('');
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Unexpected error while compiling';
      const networkLike = /failed to fetch|networkerror|network error|load failed/i.test(rawMessage);
      setRequestError(
        networkLike
          ? 'Cannot reach compiler API. Start backend with: npm run backend (from project root) or npm run dev (inside backend).'
          : rawMessage,
      );
      setResult(null);
    } finally {
      setIsRunning(false);
    }
  }, [code, runtimeInputMap, detectSniffRequest]);

  const handleClear = () => {
    setCode('');
    setRuntimeInputMap({});
    setConsoleInputText('');
    setPendingSniffVar(null);
    setPendingSniffPrompt('');
    setLastInputEcho(null);
    setResult(null);
    setRequestError(null);
  };

  const handleSubmitConsoleInput = useCallback(async () => {
    if (!pendingSniffVar) return;
    const value = consoleInputText.trim();
    if (!value) {
      setRequestError(`Please enter a value for '${pendingSniffVar}'.`);
      return;
    }

    const nextInputMap = { ...runtimeInputMap, [pendingSniffVar]: value };
    setRuntimeInputMap(nextInputMap);
    setLastInputEcho({ prompt: pendingSniffPrompt || `enter ${pendingSniffVar}:`, value });
    setConsoleInputText('');
    setPendingSniffVar(null);
    setPendingSniffPrompt('');
    await handleRunCompiler(nextInputMap);
  }, [pendingSniffVar, consoleInputText, runtimeInputMap, pendingSniffPrompt, handleRunCompiler]);

  const jumpToLine = useCallback((ln: number) => {
    const ta = editorRef.current;
    if (!ta) return;
    const lines = code.split('\n');
    const start = lines.slice(0, ln - 1).reduce((s, l) => s + l.length + 1, 0);
    const end   = start + (lines[ln - 1]?.length ?? 0);
    ta.focus();
    ta.setSelectionRange(start, end);
    ta.scrollTop = Math.max(0, (ln - 4) * 24);
  }, [code]);

  const lineErrors  = result ? buildLineErrors(result) : [];
  const symbolRows  = result ? buildSymbolRows(result.finalSymbolTable) : [];
  const errorLineSet = useMemo(() => new Set(lineErrors.map(l => l.lineNumber)), [lineErrors]);
  const mascotState: MascotState = isRunning
    ? 'loading'
    : requestError || lineErrors.length > 0
      ? 'error'
      : result && !result.hasErrors
        ? 'success'
        : 'idle';
  const runLogs = useMemo(() => {
    const logs: string[] = [];
    if (isRunning) logs.push('Fetching results... paw-ping');
    if (result) {
      logs.push(`Received ${result.lines.length} analyzed line(s).`);
      logs.push(result.hasErrors ? `Detected ${lineErrors.length} line(s) with issues.` : 'Compilation completed without errors.');
      if (result.outputValues?.length) logs.push(`Program produced ${result.outputValues.length} output value(s).`);
    }
    if (requestError) logs.push(`Request failed: ${requestError}`);
    return logs;
  }, [isRunning, result, lineErrors.length, requestError]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-screen-xl px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/retriever-logo.png" alt="Retriever logo" className="h-9 w-9 rounded-lg object-cover flex-none" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight leading-none flex items-center gap-1.5">
                Retriever
                <PawPrint className="size-4 text-[color:var(--golden-main)]" />
              </h1>
              <p className="text-[11px] text-muted-foreground">Your loyal coding companion</p>
            </div>
            <div className="ml-2 hidden sm:flex flex-wrap gap-1.5">
              <Badge className="treat-badge text-[10px]">Assignment :=</Badge>
              <Badge className="treat-badge text-[10px]">Delimiter !</Badge>
              <Badge className="treat-badge text-[10px]">Output arf</Badge>
              <Badge className="treat-badge text-[10px]">fur · bone · paw · tail · woof</Badge>
            </div>
          </div>
          <Button
            variant="ghost" size="icon"
            onClick={() => setIsDark(d => !d)}
            className="h-9 w-9 rounded-full flex-none"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="mx-auto w-full max-w-screen-xl flex-1 px-4 py-4 pb-24 flex flex-col gap-4">

        {/* Row 1: Editor | Cheat Sheet */}
        <div className={cn('grid gap-4', isGuideOpen ? 'lg:grid-cols-[1fr_360px]' : 'lg:grid-cols-1')}>

          {/* Editor card */}
          <Card className="gap-0 overflow-hidden border border-border shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2 flex-none">
              <span className="font-mono text-[11px] tracking-wide uppercase text-muted-foreground">
                Source Code
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground/50 font-mono hidden sm:block">
                  Ctrl+Enter to run · Tab to indent
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsGuideOpen(v => !v)}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  {isGuideOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
                  {isGuideOpen ? 'Hide Guide' : 'Show Guide'}
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={code}
                onChange={setCode}
                onRunCompiler={handleRunCompiler}
                errorLines={errorLineSet}
                editorRef={editorRef}
              />
            </div>
          </Card>

          {/* Cheat sheet */}
          {isGuideOpen && <CheatSheetPanel />}
        </div>

        {/* Row 2: Compiler Output (full width) */}
        <Card className="gap-0 overflow-hidden border border-border shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
            <span className="font-mono text-[11px] tracking-wide uppercase text-muted-foreground">
              Compiler Output
            </span>
            <div className="flex items-center gap-2">
              <CompileMascot state={mascotState} />
              <div className="rounded-full border border-border bg-background/70 p-0.5 flex items-center gap-1">
                <button
                  onClick={() => setActiveOutputTab('output')}
                  className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors', activeOutputTab === 'output' ? 'bg-[color:var(--golden-main)] text-[#2A1D0A]' : 'text-muted-foreground hover:text-foreground')}
                >
                  Output
                </button>
                <button
                  onClick={() => setActiveOutputTab('errors')}
                  className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors', activeOutputTab === 'errors' ? 'bg-[color:var(--golden-main)] text-[#2A1D0A]' : 'text-muted-foreground hover:text-foreground')}
                >
                  Errors
                </button>
                <button
                  onClick={() => setActiveOutputTab('logs')}
                  className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors', activeOutputTab === 'logs' ? 'bg-[color:var(--golden-main)] text-[#2A1D0A]' : 'text-muted-foreground hover:text-foreground')}
                >
                  Logs
                </button>
              </div>
              {isRunning && (
                <span className="flex items-center gap-1.5 text-xs text-[color:var(--golden-main)] font-medium">
                  <Loader2 className="size-3 animate-spin" /> Fetching results...
                </span>
              )}
            </div>
          </div>
          <div className="p-4 min-h-[180px]">
            {activeOutputTab === 'output' && requestError ? (
              <div className="confused-shake rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-4 py-3 text-sm">
                <p className="font-semibold text-[#FF6B6B] mb-1">Oops! Something went wrong.</p>
                <p className="text-[#FF6B6B]/80 mb-2">Let's sniff out the issue...</p>
                <p className="text-[#FF6B6B]/80">{requestError}</p>
              </div>
            ) : activeOutputTab === 'output' && result && !result.hasErrors ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-lg border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <span>✓</span> Good job! Your code ran perfectly!
                  <span className="paw-pop paw-pop-1" aria-hidden>+</span>
                  <span className="paw-pop paw-pop-2" aria-hidden>+</span>
                  <span className="paw-pop paw-pop-3" aria-hidden>+</span>
                </div>
                {result.outputValues && result.outputValues.length > 0 && (
                  <div className="rounded-lg border border-border bg-[#1e2330] px-4 py-3 font-mono text-sm">
                    <p className="text-[10px] uppercase tracking-wider text-[color:var(--golden-main)] mb-2 font-semibold">Output</p>
                    {result.outputValues.map((val, i) => {
                      const shouldEchoInput = Boolean(
                        lastInputEcho &&
                        val.trim() === lastInputEcho.prompt.trim() &&
                        i === result.outputValues.findIndex((v) => v.trim() === lastInputEcho.prompt.trim()),
                      );

                      const rendered = shouldEchoInput
                        ? `${val} ${lastInputEcho?.value ?? ''}`
                        : val;

                      return <div key={i} className="text-[#B5CEA8] leading-6">› {rendered}</div>;
                    })}

                    {pendingSniffVar && (
                      <div className="mt-2 border-t border-white/10 pt-2">
                        <div className="text-[#9CDCFE] leading-6">› {pendingSniffPrompt || `enter ${pendingSniffVar}:`}</div>
                        <div className="flex items-center gap-2">
                          <input
                            value={consoleInputText}
                            onChange={(e) => setConsoleInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleSubmitConsoleInput();
                              }
                            }}
                            placeholder={`Type value for ${pendingSniffVar}`}
                            className="h-8 flex-1 rounded border border-border bg-[#111520] px-2 text-[#DCDCDC] outline-none focus:border-[color:var(--golden-main)]"
                          />
                          <Button className="h-8 px-3 text-xs" onClick={() => void handleSubmitConsoleInput()}>
                            Submit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : activeOutputTab === 'output' && !isRunning ? (
              <div className="flex min-h-[140px] items-center justify-center text-center text-muted-foreground/50 text-sm italic">
                Compiler output will appear here after running your code.
              </div>
            ) : activeOutputTab === 'errors' && lineErrors.length > 0 ? (
              <div className="space-y-2">
                {lineErrors.map(line => (
                  <button
                    key={`line-${line.lineNumber}`}
                    onClick={() => jumpToLine(line.lineNumber)}
                    className="w-full text-left rounded-lg border border-[#FF6B6B]/25 bg-[#FF6B6B]/8 hover:bg-[#FF6B6B]/15 dark:bg-[#FF6B6B]/10 dark:hover:bg-[#FF6B6B]/18 px-4 py-2.5 transition-colors cursor-pointer"
                  >
                    <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-[#FF6B6B]">
                      ↳ Line {line.lineNumber}
                      <span className="ml-2 text-[#FF6B6B]/50 normal-case font-normal">click to jump</span>
                    </p>
                    {line.messages.map(msg => (
                      <p key={msg} className="text-sm text-[#FF9B9B]">{msg}</p>
                    ))}
                  </button>
                ))}
              </div>
            ) : activeOutputTab === 'errors' ? (
              <div className="flex min-h-[140px] items-center justify-center text-center text-muted-foreground/50 text-sm italic">
                No errors yet. Run your code to check behavior.
              </div>
            ) : activeOutputTab === 'logs' ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 font-mono text-xs space-y-1.5">
                {runLogs.length === 0 ? (
                  <p className="text-muted-foreground/50 italic">No logs yet. Hit Run Compiler to start a trace.</p>
                ) : runLogs.map((log, i) => (
                  <p key={`${log}-${i}`} className="text-muted-foreground">[{String(i + 1).padStart(2, '0')}] {log}</p>
                ))}
              </div>
            ) : null}
          </div>
        </Card>

        {/* Row 3: Symbol Table */}
        <Card className="gap-0 overflow-hidden border border-border shadow-sm">
          <div className="border-b border-border bg-muted/40 px-4 py-2">
            <span className="font-mono text-[11px] tracking-wide uppercase text-muted-foreground">Dog Tag Registry</span>
          </div>
          {symbolRows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="table-fixed min-w-[440px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[24%] py-2.5 px-4 font-mono text-xs font-bold uppercase tracking-wide">Name</TableHead>
                    <TableHead className="w-[16%] py-2.5 font-mono text-xs font-bold uppercase tracking-wide">Type</TableHead>
                    <TableHead className="w-[32%] py-2.5 font-mono text-xs font-bold uppercase tracking-wide">Level (Scope)</TableHead>
                    <TableHead className="w-[14%] py-2.5 font-mono text-xs font-bold uppercase tracking-wide">Offset</TableHead>
                    <TableHead className="w-[14%] py-2.5 font-mono text-xs font-bold uppercase tracking-wide">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {symbolRows.map((entry, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="py-2 px-4 font-mono text-sm">{entry.name}</TableCell>
                      <TableCell className="py-2 font-mono text-sm text-[color:var(--golden-main)]">{entry.type}</TableCell>
                      <TableCell className="py-2 font-mono text-sm text-muted-foreground">{entry.levelScope}</TableCell>
                      <TableCell className="py-2 font-mono text-sm">{entry.offset}</TableCell>
                      <TableCell className="py-2 font-mono text-sm">{entry.size} B</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <tfoot>
                  <TableRow className="border-t border-border bg-muted/30">
                    <TableCell colSpan={4} className="py-2 px-4 font-mono text-xs font-bold uppercase tracking-wide text-muted-foreground">Total Space</TableCell>
                    <TableCell className="py-2 font-mono text-sm font-bold">{symbolRows.reduce((s, r) => s + r.size, 0)} B</TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          ) : (
            <div className="p-6 text-center text-sm italic text-muted-foreground/60">
              Nothing stored yet... try running your code.
            </div>
          )}
        </Card>
      </main>

      {/* ── Floating Action Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <div className="mx-auto max-w-screen-xl px-4 py-2 flex flex-wrap items-center gap-2">
          {/* Primary actions */}
          <Button
            onClick={() => void handleRunCompiler()}
            disabled={!code.trim() || isRunning}
            className="wag-hover h-9 bg-[linear-gradient(135deg,#E6A84A,#C98A2E)] text-[#2A1D0A] hover:shadow-[0_0_20px_rgba(230,168,74,0.35)] active:translate-y-[1px] shadow-sm font-semibold px-5 disabled:opacity-40"
          >
            {isRunning
              ? <><Loader2 className="mr-1.5 size-3.5 animate-spin" />Fetching results...</>
              : <><PawPrint className="mr-1 size-3.5" /><Play className="mr-1.5 size-3.5" />Run Compiler</>}
          </Button>
          <Button variant="ghost" onClick={handleClear} className="h-9 text-muted-foreground hover:text-foreground">
            <Trash2 className="mr-1.5 size-3.5" />Clear
          </Button>

          {/* Separator */}
          <div className="hidden sm:block h-5 w-px bg-border mx-0.5" />

          {/* Test cases */}
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">Tests:</span>
          <Button variant="outline" className="h-7 text-xs px-2.5" onClick={() => setCode(EXAMPLE_SNIPPETS.basicProgram)}>basic</Button>
          <Button variant="outline" className="h-7 text-xs px-2.5" onClick={() => { setCode(EXAMPLE_SNIPPETS.inputOutput); setRuntimeInputMap({}); setLastInputEcho(null); }}>input/output</Button>
          <Button variant="outline" className="h-7 text-xs px-2.5" onClick={() => setCode(EXAMPLE_SNIPPETS.scopedProgram)}>scopes</Button>
          <Button variant="outline" className="h-7 text-xs px-2.5" onClick={() => setCode(EXAMPLE_SNIPPETS.ifElseProgram)}>if else</Button>

          {/* Separator */}
          <div className="hidden sm:block h-5 w-px bg-border mx-0.5" />

          {/* Error demos */}
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">Errors:</span>
          <Button variant="outline" className="h-7 text-xs px-2.5 text-[#FF8080] border-[#FF6B6B]/25 hover:bg-[#FF6B6B]/10 hover:text-[#FF6B6B]" onClick={() => setCode(EXAMPLE_SNIPPETS.lexicalError)}>lexical</Button>
          <Button variant="outline" className="h-7 text-xs px-2.5 text-[#FF8080] border-[#FF6B6B]/25 hover:bg-[#FF6B6B]/10 hover:text-[#FF6B6B]" onClick={() => setCode(EXAMPLE_SNIPPETS.syntaxError)}>syntax</Button>
          <Button variant="outline" className="h-7 text-xs px-2.5 text-[#FF8080] border-[#FF6B6B]/25 hover:bg-[#FF6B6B]/10 hover:text-[#FF6B6B]" onClick={() => setCode(EXAMPLE_SNIPPETS.semanticError)}>semantic</Button>
          <Button variant="outline" className="h-7 text-xs px-2.5 text-[#FF8080] border-[#FF6B6B]/25 hover:bg-[#FF6B6B]/10 hover:text-[#FF6B6B]" onClick={() => setCode(EXAMPLE_SNIPPETS.logicalError)}>logical</Button>
        </div>
      </div>
    </div>
  );
}