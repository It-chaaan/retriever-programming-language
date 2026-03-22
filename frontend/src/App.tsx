import type { KeyboardEvent } from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { Card } from './components/card';
import { Button } from './components/button';
import { CheatSheetPanel } from './components/cheat-sheet-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/table';
import {
  Play,
  Trash2,
  Sun,
  Moon,
  Loader2,
  PawPrint,
  PanelRightClose,
  PanelRightOpen,
  TerminalSquare,
  AlertTriangle,
  Rows3,
  FileCode2,
  BookOpenText,
  SlidersHorizontal,
  FlaskConical,
} from 'lucide-react';
import type { MultiLineCompilerResult } from './types/compiler';
import { cn } from './components/utils';

// ── Types ─────────────────────────────────────────────────
type CompilerSymbol = MultiLineCompilerResult['finalSymbolTable'][number];
type SymbolRow = { name: string; type: string; levelScope: string; offset: number; size: number };
type TestCaseId = keyof typeof EXAMPLE_SNIPPETS;

// ── Constants ─────────────────────────────────────────────
const EXAMPLE_SNIPPETS = {
  simpleScopeArithmetic: [
    'bone number := 10!',
    'bone total := number + 5!',
    '{',
    '  bone local := total * 2!',
    '  arf "Local value: " + local!',
    '}',
    'arf "Total is: " + total!',
  ].join('\n'),
  loopProgram: [
    'bone i := 0!',
    'walk ( i < 3 ) {',
    '  arf "walk i = " + i!',
    '  fetch i := i + 1!',
    '}',
    'run bone j := 0; j < 3; j++ {',
    '  arf "run j = " + j!',
    '}',
  ].join('\n'),
  ifElseProgram: [
    'bone score!',
    'arf "Enter score: "!',
    'sniff score!',
    'sit ( score >= 75 ) {',
    '  arf "Pass" !',
    '} stay {',
    '  arf "Fail" !',
    '}',
  ].join('\n'),
  functionProgram: [
    'trick showMessage() {',
    '  arf "Function executed!"!',
    '  yield true!',
    '}',
    'showMessage()!',
  ].join('\n'),
  lexicalError: [
    'bone @age := 5!',
    'arf ("Hello " + age)!',
  ].join('\n'),
  syntacticalError: [
    'bone age := 5',
    'fur name := "Buddy"!',
    'arf("Hello " + name)!',
  ].join('\n'),
  semanticError: [
    'bone age := "Buddy"!',
    'fur name := 5!',
    'arf(age + name)!',
  ].join('\n'),
  recoveryError: [
    'bone age := 20',
    'bone points := age + 5 @ !',
    'arf "Recovered total: " + points!',
  ].join('\n'),
};

const TYPE_LABEL_MAP: Record<string, string> = {
  fur: 'string', bone: 'int', paw: 'float', tail: 'double', woof: 'bool',
};
const TYPE_SIZE_MAP: Record<string, number> = {
  fur: 4, bone: 4, paw: 4, tail: 8, woof: 1,
};

const TEST_CASES: Array<{
  id: TestCaseId;
  label: string;
  kind: 'normal' | 'error';
}> = [
  { id: 'simpleScopeArithmetic', label: 'simple scope + arithmetic', kind: 'normal' },
  { id: 'loopProgram', label: 'loop', kind: 'normal' },
  { id: 'ifElseProgram', label: 'if else', kind: 'normal' },
  { id: 'functionProgram', label: 'function', kind: 'normal' },
  { id: 'lexicalError', label: 'lexical error', kind: 'error' },
  { id: 'syntacticalError', label: 'syntactical error', kind: 'error' },
  { id: 'semanticError', label: 'semantic error', kind: 'error' },
  { id: 'recoveryError', label: 'recovery', kind: 'error' },
];

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
  const [activeLine, setActiveLine] = useState(1);
  const [scrollTop, setScrollTop] = useState(0);
  const [lineMetrics, setLineMetrics] = useState({ lineHeight: 24, paddingTop: 12 });

  const updateCaretLine = useCallback((element: HTMLTextAreaElement) => {
    const cursor = element.selectionStart;
    const line = element.value.slice(0, cursor).split('\n').length;
    setActiveLine(line);
  }, []);

  useEffect(() => {
    const ta = editorRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart;
    const line = value.slice(0, cursor).split('\n').length;
    setActiveLine(line);
  }, [value, editorRef]);

  useEffect(() => {
    const ta = editorRef.current;
    if (!ta) return;
    const styles = window.getComputedStyle(ta);
    const parsedLineHeight = Number.parseFloat(styles.lineHeight);
    const parsedPaddingTop = Number.parseFloat(styles.paddingTop);
    setLineMetrics({
      lineHeight: Number.isFinite(parsedLineHeight) ? parsedLineHeight : 24,
      paddingTop: Number.isFinite(parsedPaddingTop) ? parsedPaddingTop : 12,
    });
  }, [editorRef]);

  const syncScroll = () => {
    const ta = editorRef.current;
    if (!ta) return;  
    if (preRef.current)     { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
    if (lineNumRef.current) { lineNumRef.current.scrollTop = ta.scrollTop; }
    setScrollTop(ta.scrollTop);
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

  const lineCount  = Math.max(value.split('\n').length, 28);
  const highlighted = useMemo(() => buildHighlightedHtml(value), [value]);

  return (
    <div className={cn('code-editor-wrap flex h-full min-h-[360px] overflow-hidden font-mono text-sm leading-6 rounded-b-2xl', !value.trim() && 'is-empty')}>
      {/* Line numbers */}
      <div ref={lineNumRef} className="code-line-nums flex-none w-12 overflow-hidden select-none text-right pt-3 pr-3 pl-2 text-xs">
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className={cn('leading-6', errorLines.has(i + 1) ? 'text-[#FF4C4C] font-bold' : '')}>
            {i + 1}
          </div>
        ))}
      </div>
      {/* Highlighted overlay + textarea */}
      <div className="relative flex-1 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 right-0 z-[0] h-6 bg-[linear-gradient(90deg,rgba(230,168,74,0.16),rgba(230,168,74,0.04),transparent)]"
          style={{
            top: `${lineMetrics.paddingTop + (activeLine - 1) * lineMetrics.lineHeight - scrollTop}px`,
            height: `${lineMetrics.lineHeight}px`,
          }}
        />
        {!value.trim() && (
          <PawPrint className="pointer-events-none absolute bottom-4 right-5 z-0 size-20 text-[color:var(--editor-placeholder)] opacity-[0.08]" aria-hidden />
        )}
        <pre
          ref={preRef}
          className="code-pre absolute inset-0 z-[1] m-0 overflow-hidden whitespace-pre pointer-events-none pt-3 px-3 pb-3 leading-6 text-sm font-mono"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
          aria-hidden
        />
        <textarea
          ref={editorRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            updateCaretLine(e.currentTarget);
          }}
          onKeyDown={handleKeyDown}
          onClick={(event) => updateCaretLine(event.currentTarget)}
          onKeyUp={(event) => updateCaretLine(event.currentTarget)}
          onSelect={(event) => updateCaretLine(event.currentTarget)}
          onScroll={syncScroll}
          spellCheck={false}
          wrap="off"
          placeholder="// Write your Retriever code here..."
          className="code-textarea absolute inset-0 z-10 w-full h-full resize-none overflow-auto pt-3 px-3 pb-3 outline-none border-0 leading-6 text-sm font-mono"
        />
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────
function buildLineErrors(results: MultiLineCompilerResult) {
  const isLexicalRecovery = (message: string) => message.startsWith('Invalid token(s) found');

  return results.lines
    .map(line => ({
      lineNumber: line.lineNumber,
      messages: [
        ...line.result.lexer.errors.map(m => `LEXER: ${m}`),
        ...line.result.syntax.errors.map(m => `SYNTAX: ${m}`),
        ...(line.result.syntax.recoverableErrors ?? [])
          .filter(m => !isLexicalRecovery(m))
          .map(m => `SYNTAX (Recovered): ${m}`),
        ...(line.result.syntax.recoverableErrors ?? [])
          .filter(isLexicalRecovery)
          .map(m => `LEXER (Recovered): ${m}`),
        ...(line.result.syntax.recoveryStrategies ?? []).map(m => `RECOVERY: ${m}`),
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

function buildAnalyzerStageSummary(results: MultiLineCompilerResult) {
  const parserRecoverableCount = (line: MultiLineCompilerResult['lines'][number]) =>
    (line.result.syntax.recoverableErrors ?? []).filter((message) => !message.startsWith('Invalid token(s) found')).length;

  const hasLexicalErrors = results.lines.some((line) => line.result.lexer.errors.length > 0);
  const hasParserErrors = results.lines.some(
    (line) => line.result.syntax.errors.length > 0 || parserRecoverableCount(line) > 0,
  );
  const hasSemanticErrors = results.lines.some((line) => line.result.semantic.errors.length > 0);

  const errors: string[] = [];
  if (hasLexicalErrors) {
    errors.push('Lexer says: BadDogError: Lexical error found. Compilation failed.');
  }
  if (hasParserErrors) {
    errors.push('Parser says: BadDogError: Syntax error found. Compilation failed.');
  }
  if (hasSemanticErrors) {
    errors.push('Semantic Analyzer says: BadDogError: Semantic error found. Compilation failed.');
  }

  return errors;
}

function buildAnalyzerTranscript(results: MultiLineCompilerResult) {
  const isLexicalRecovery = (message: string) => message.startsWith('Invalid token(s) found');
  const parserRecoverableCount = (line: MultiLineCompilerResult['lines'][number]) =>
    (line.result.syntax.recoverableErrors ?? []).filter((message) => !isLexicalRecovery(message)).length;

  const transcript: string[] = [];
  const unknownTokenCount = results.lines.reduce(
    (count, line) => count + line.result.lexer.tokens.filter((token) => token.type === 'UNKNOWN').length,
    0,
  );
  const lexicalErrorCount = results.lines.reduce((count, line) => count + line.result.lexer.errors.length, 0);
  const syntaxErrorCount = results.lines.reduce((count, line) => count + line.result.syntax.errors.length, 0);
  const syntaxRecoveredErrorCount = results.lines.reduce(
    (count, line) => count + parserRecoverableCount(line),
    0,
  );
  const semanticErrorCount = results.lines.reduce((count, line) => count + line.result.semantic.errors.length, 0);

  transcript.push('--- STARTING LEXICAL ANALYSIS ---');
  results.lines.forEach((line) => {
    if (!line.code.trim()) return;
    line.result.lexer.tokens.forEach((token) => {
      transcript.push(`[LEXER] Found '${token.value}' -> Identified as ${token.type}`);
    });
    line.result.lexer.errors.forEach((error) => {
      transcript.push(`[LEXER] Error (line ${line.lineNumber}): ${error}`);
    });
  });

  if (lexicalErrorCount === 0) {
    transcript.push(`✓ Lexical Analysis Complete. ${unknownTokenCount} Unknown Tokens.`);
  } else {
    transcript.push(`✗ Lexical Analysis Complete with ${lexicalErrorCount} error(s).`);
  }

  transcript.push('');
  transcript.push('--- STARTING SYNTAX ANALYSIS ---');
  transcript.push('[PARSER] Checking statement structure...');
  results.lines.forEach((line) => {
    if (!line.code.trim()) return;
    (line.result.syntax.recoverableErrors ?? []).filter((error) => !isLexicalRecovery(error)).forEach((error) => {
      transcript.push(`[PARSER] Line ${line.lineNumber} recovered error: ${error}`);
    });
    (line.result.syntax.recoveryStrategies ?? []).forEach((strategy) => {
      transcript.push(`[PARSER] Recovery strategy (line ${line.lineNumber}): ${strategy}`);
    });
    transcript.push(`[PARSER] Line ${line.lineNumber} expected rule: ${line.result.syntax.expected}`);
    const recoveredErrorCount = parserRecoverableCount(line);
    if (line.result.syntax.errors.length === 0 && recoveredErrorCount === 0) {
      transcript.push(`[PARSER] Line ${line.lineNumber} structure is valid.`);
    } else {
      line.result.syntax.errors.forEach((error) => {
        transcript.push(`[PARSER] Line ${line.lineNumber} error: ${error}`);
      });
      if (line.result.syntax.errors.length === 0 && recoveredErrorCount > 0) {
        transcript.push(`[PARSER] Line ${line.lineNumber} had recoverable syntax error(s).`);
      }
    }
  });

  const totalParserErrorCount = syntaxErrorCount + syntaxRecoveredErrorCount;
  if (totalParserErrorCount === 0) {
    transcript.push('✓ Syntax Analysis Complete. No structural errors.');
  } else {
    transcript.push(`✗ Syntax Analysis Complete with ${totalParserErrorCount} error(s).`);
  }

  transcript.push('');
  transcript.push('--- STARTING SEMANTIC ANALYSIS ---');
  transcript.push('[SEMANTICS] Checking type compatibility...');
  results.lines.forEach((line) => {
    if (!line.code.trim()) return;
    line.result.semantic.messages.forEach((message) => {
      transcript.push(`[SEMANTICS] ${message}`);
    });
    line.result.semantic.errors.forEach((error) => {
      transcript.push(`[SEMANTICS] Error (line ${line.lineNumber}): ${error}`);
    });
  });

  if (semanticErrorCount === 0) {
    transcript.push('✓ Semantic Analysis Complete.');
  } else {
    transcript.push(`✗ Semantic Analysis Complete with ${semanticErrorCount} error(s).`);
  }

  return transcript;
}

// ── App ───────────────────────────────────────────────────
export default function App() {
  const [code, setCode]               = useState('');
  const [activeTestCase, setActiveTestCase] = useState<TestCaseId | null>(null);
  const [runtimeInputMap, setRuntimeInputMap] = useState<Record<string, string>>({});
  const [consoleInputText, setConsoleInputText] = useState('');
  const [pendingSniffVar, setPendingSniffVar] = useState<string | null>(null);
  const [pendingSniffRequestId, setPendingSniffRequestId] = useState<string | null>(null);
  const [pendingSniffPrompt, setPendingSniffPrompt] = useState('');
  const [lastInputEcho, setLastInputEcho] = useState<{ prompt: string; value: string } | null>(null);
  const [result, setResult]           = useState<MultiLineCompilerResult | null>(null);
  const [isRunning, setIsRunning]     = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isDark, setIsDark]           = useState(() => localStorage.getItem('theme') === 'dark');
  const [activeOutputTab, setActiveOutputTab] = useState<'output' | 'errors' | 'symbols' | 'analyzer'>('output');
  const [isGuideOpen, setIsGuideOpen] = useState(true);
  const [outputHeight, setOutputHeight] = useState(248);
  const editorRef                     = useRef<HTMLTextAreaElement>(null);
  const socketRef                     = useRef<Socket | null>(null);

  // Apply / persist dark class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('request-input', (payload: { name?: string; requestId?: string }) => {
      const variableName = typeof payload?.name === 'string' ? payload.name : '';
      if (!variableName) return;

      setPendingSniffVar(variableName);
      setPendingSniffRequestId(typeof payload?.requestId === 'string' ? payload.requestId : null);
      setPendingSniffPrompt(`enter ${variableName}:`);
      setActiveOutputTab('output');
      setRequestError(null);
    });

    socket.on('reset-input', () => {
      setPendingSniffVar(null);
      setPendingSniffRequestId(null);
      setPendingSniffPrompt('');
      setConsoleInputText('');
      setLastInputEcho(null);
    });

    socket.on('compile-result', (compileResult: MultiLineCompilerResult) => {
      setResult(compileResult);
      setPendingSniffVar(null);
      setPendingSniffRequestId(null);
      setPendingSniffPrompt('');
      setIsRunning(false);
      setRequestError(null);
    });

    socket.on('compile-error', (payload: { message?: string }) => {
      setRequestError(payload?.message ?? 'Compilation failed');
      setPendingSniffVar(null);
      setPendingSniffRequestId(null);
      setPendingSniffPrompt('');
      setIsRunning(false);
    });

    socket.on('connect_error', () => {
      setRequestError('Cannot connect to compiler socket. Start backend and refresh the page.');
      setIsRunning(false);
    });

    return () => {
      socket.off('request-input');
      socket.off('reset-input');
      socket.off('compile-result');
      socket.off('compile-error');
      socket.off('connect_error');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const handleRunCompiler = useCallback((overrideInput?: Record<string, string>) => {
    if (!code.trim()) return;

    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setRequestError('Cannot connect to compiler socket. Start backend and refresh the page.');
      return;
    }

    const payloadInput = overrideInput ?? runtimeInputMap;

    setIsRunning(true);
    setRequestError(null);
    setPendingSniffVar(null);
    setPendingSniffRequestId(null);
    setPendingSniffPrompt('');

    socket.emit('compile', { code, input: payloadInput });
  }, [code, runtimeInputMap]);

  const handleClear = () => {
    setCode('');
    setRuntimeInputMap({});
    setConsoleInputText('');
    setPendingSniffVar(null);
    setPendingSniffRequestId(null);
    setPendingSniffPrompt('');
    setLastInputEcho(null);
    setResult(null);
    setRequestError(null);
  };

  const handleSubmitConsoleInput = useCallback(async () => {
    if (!pendingSniffVar) return;
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      setRequestError('Socket disconnected while waiting for input. Run again after reconnecting.');
      return;
    }

    const value = consoleInputText.trim();
    if (!value) {
      setRequestError(`Please enter a value for '${pendingSniffVar}'.`);
      return;
    }

    const nextInputMap = { ...runtimeInputMap, [pendingSniffVar]: value };
    setRuntimeInputMap(nextInputMap);
    setLastInputEcho({ prompt: pendingSniffPrompt || `enter ${pendingSniffVar}:`, value });
    setConsoleInputText('');
    socket.emit('submit-input', { requestId: pendingSniffRequestId, name: pendingSniffVar, value });
    setPendingSniffVar(null);
    setPendingSniffRequestId(null);
    setPendingSniffPrompt('');
  }, [pendingSniffVar, pendingSniffRequestId, consoleInputText, runtimeInputMap, pendingSniffPrompt]);

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

  const lineErrors = useMemo(() => (result ? buildLineErrors(result) : []), [result]);
  const symbolRows  = result ? buildSymbolRows(result.finalSymbolTable) : [];
  const symbolSpaceByLevel = useMemo(() => {
    if (!result) return [] as Array<{ level: number; total: number }>;

    const totals = result.finalSymbolTable.reduce((acc, entry) => {
      const level = typeof entry.scopeLevel === 'number' ? entry.scopeLevel : 0;
      const size = TYPE_SIZE_MAP[entry.type] ?? 4;
      acc.set(level, (acc.get(level) ?? 0) + size);
      return acc;
    }, new Map<number, number>());

    return [...totals.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, total]) => ({ level, total }));
  }, [result]);
  const errorLineSet = useMemo(() => new Set(lineErrors.map(l => l.lineNumber)), [lineErrors]);
  const mascotState: MascotState = isRunning
    ? 'loading'
    : requestError || lineErrors.length > 0
      ? 'error'
      : result && !result.hasErrors
        ? 'success'
        : 'idle';
  const analyzerSummary = useMemo(() => (result ? buildAnalyzerStageSummary(result) : []), [result]);
  const analyzerTranscript = useMemo(() => (result ? buildAnalyzerTranscript(result) : []), [result]);

  const handleEditorChange = useCallback((nextCode: string) => {
    setCode(nextCode);
    setActiveTestCase(null);
  }, []);

  const handleApplyTestCase = useCallback((id: TestCaseId) => {
    setCode(EXAMPLE_SNIPPETS[id]);
    setActiveTestCase(id);
  }, []);

  const lastAutoFocusedErrorLineRef = useRef<number | null>(null);
  useEffect(() => {
    if (lineErrors.length === 0) {
      lastAutoFocusedErrorLineRef.current = null;
      if (result && !requestError) {
        setActiveOutputTab('output');
      }
      return;
    }

    const firstErrorLine = lineErrors[0].lineNumber;
    setActiveOutputTab('errors');

    if (lastAutoFocusedErrorLineRef.current !== firstErrorLine) {
      lastAutoFocusedErrorLineRef.current = firstErrorLine;
      jumpToLine(firstErrorLine);
    }
  }, [lineErrors, result, requestError, jumpToLine]);

  const startOutputResize = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = outputHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const next = startHeight + (startY - moveEvent.clientY);
      setOutputHeight(Math.max(170, Math.min(520, next)));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [outputHeight]);

  const outputTabs: Array<{ id: 'output' | 'errors' | 'symbols' | 'analyzer'; label: string; icon: React.ReactNode }> = [
    { id: 'output', label: 'Output', icon: <TerminalSquare className="size-3.5" /> },
    { id: 'errors', label: 'Errors', icon: <AlertTriangle className="size-3.5" /> },
    { id: 'symbols', label: 'Symbols', icon: <Rows3 className="size-3.5" /> },
    { id: 'analyzer', label: 'Analyzer', icon: <BookOpenText className="size-3.5" /> },
  ];

  return (
    <div className="ide-atmosphere min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src="/retriever-logo.png" alt="Retriever logo" className="h-10 w-10 rounded-xl border border-border/70 object-cover shadow-md" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Retriever IDE</p>
              <h1 className="flex items-center gap-1.5 text-lg font-semibold tracking-tight">
                Compiler Workbench
                <PawPrint className="size-4 text-[color:var(--golden-main)]/70" aria-hidden />
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden rounded-full border border-border/70 bg-muted/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground md:inline-flex">
              Ctrl+Enter run | Tab indent
            </span>
            <Button
              onClick={() => handleRunCompiler()}
              disabled={!code.trim() || isRunning}
              className="run-cta h-9 rounded-xl bg-[color:var(--golden-main)] px-4 text-white shadow-sm transition hover:shadow-[0_0_18px_rgba(61,155,255,0.38)]"
            >
              {isRunning ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Running
                </>
              ) : (
                <>
                  <Play className="size-3.5" /> Run
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleClear} className="h-9 rounded-xl border-border/80 px-3">
              <Trash2 className="size-3.5" /> Clear
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsGuideOpen(v => !v)}
              className="h-9 w-9 rounded-xl border border-border/70"
              aria-label="Toggle guide"
            >
              {isGuideOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(d => !d)}
              className="h-9 w-9 rounded-xl border border-border/70"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex h-[calc(100vh-73px)] w-full max-w-[1500px] flex-col gap-3 px-4 py-3">
        <section className={cn('grid min-h-0 flex-1 gap-3', isGuideOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1')}>
          <Card className="glass-panel editor-shell min-h-0 gap-0 overflow-hidden rounded-2xl border-border/70">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/35 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <FileCode2 className="size-4 text-[color:var(--golden-main)]" />
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Editor</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FlaskConical className="size-3.5 text-[color:var(--golden-main)]" />
                  Test Cases:
                </p>
                {TEST_CASES.map((testCase) => {
                  const isActive = activeTestCase === testCase.id;
                  const isErrorCase = testCase.kind === 'error';

                  return (
                    <Button
                      key={testCase.id}
                      variant="outline"
                      className={cn(
                        'case-pill h-7 rounded-lg border-border/70 px-2 text-xs',
                        isErrorCase && 'case-pill-error',
                        isActive && 'case-pill-active',
                      )}
                      onClick={() => handleApplyTestCase(testCase.id)}
                    >
                      {isErrorCase ? <AlertTriangle className="size-3" /> : <FlaskConical className="size-3" />}
                      {testCase.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <CodeEditor
                value={code}
                onChange={handleEditorChange}
                onRunCompiler={handleRunCompiler}
                errorLines={errorLineSet}
                editorRef={editorRef}
              />
            </div>
          </Card>

          {isGuideOpen && (
            <div className="guide-appear min-h-0">
              <CheatSheetPanel className="h-full rounded-2xl" />
            </div>
          )}
        </section>

        <section className="relative">
          <button
            type="button"
            onMouseDown={startOutputResize}
            className="output-resizer group"
            aria-label="Resize output panel"
          >
            <SlidersHorizontal className="size-3.5 text-muted-foreground/70 transition group-hover:text-foreground" />
          </button>

          <Card
            className="glass-panel gap-0 overflow-hidden rounded-2xl border-border/70"
            style={{ height: `${outputHeight}px` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/35 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <CompileMascot state={mascotState} />
                <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Output Panel</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-background/70 p-1">
                {outputTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveOutputTab(tab.id)}
                    className={cn(
                      'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition',
                      activeOutputTab === tab.id
                        ? 'bg-[color:var(--golden-main)] text-white'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-full overflow-auto p-3">
              {activeOutputTab === 'output' && requestError ? (
                <div className="confused-shake rounded-xl border border-[#FF6B6B]/35 bg-[#FF6B6B]/10 p-4 text-sm">
                  <p className="font-semibold text-[#FF6B6B]">Request failed</p>
                  <p className="mt-1 text-[#FFB3B3]">{requestError}</p>
                </div>
              ) : activeOutputTab === 'output' && (pendingSniffVar || isRunning || result) ? (
                <div className="space-y-3">
                  {isRunning && (
                    <div className="rounded-xl border border-[color:var(--golden-main)]/35 bg-[color:var(--golden-main)]/10 px-3 py-2 text-xs font-medium text-foreground/90">
                      Compiler is processing your program.
                    </div>
                  )}

                  <div className="rounded-xl border border-border/70 bg-[#151B28] px-4 py-3 font-mono text-sm">
                    <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[color:var(--golden-main)]">Console</p>

                    {result?.outputValues?.length ? result.outputValues.map((val, index) => {
                      const shouldEchoInput = Boolean(
                        lastInputEcho &&
                        val.trim() === lastInputEcho.prompt.trim() &&
                        index === result.outputValues.findIndex((item) => item.trim() === lastInputEcho.prompt.trim()),
                      );
                      const rendered = shouldEchoInput ? `${val} ${lastInputEcho?.value ?? ''}` : val;
                      return <div key={`${val}-${index}`} className="leading-6 text-[#B5CEA8]">&gt; {rendered}</div>;
                    }) : (
                      <p className="text-[#95A4C1]">Console is idle.</p>
                    )}

                    {pendingSniffVar && (
                      <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                        <div className="leading-6 text-[#9CDCFE]">&gt; {pendingSniffPrompt || `enter ${pendingSniffVar}:`}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={consoleInputText}
                            onChange={(event) => setConsoleInputText(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                void handleSubmitConsoleInput();
                              }
                            }}
                            placeholder={`Type value for ${pendingSniffVar}`}
                            className="h-9 min-w-[200px] flex-1 rounded-lg border border-border/70 bg-[#101624] px-2.5 text-[#DCDCDC] outline-none focus:border-[color:var(--golden-main)]"
                          />
                          <Button className="h-9 rounded-lg px-3 text-xs" onClick={() => void handleSubmitConsoleInput()}>
                            Submit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeOutputTab === 'output' ? (
                <div className="flex h-full min-h-[120px] items-center justify-center text-sm italic text-muted-foreground">
                  Run compiler to see output and interactive input prompts.
                </div>
              ) : activeOutputTab === 'errors' && lineErrors.length > 0 ? (
                <div className="space-y-2">
                  {analyzerSummary.length > 0 && (
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Error Report
                      </p>
                      {analyzerSummary.map((message) => (
                        <p key={message} className="font-mono text-xs leading-6 text-foreground/85">
                          {message}
                        </p>
                      ))}
                    </div>
                  )}
                  {lineErrors.map((line) => (
                    <button
                      type="button"
                      key={`line-${line.lineNumber}`}
                      onClick={() => jumpToLine(line.lineNumber)}
                      className="w-full cursor-pointer rounded-xl border border-[#FF6B6B]/30 bg-[#FF6B6B]/10 p-3 text-left transition hover:bg-[#FF6B6B]/15"
                    >
                      <p className="font-mono text-[11px] font-bold uppercase tracking-wide text-[#FF6B6B]">line {line.lineNumber}</p>
                      {line.messages.map((message) => (
                        <p key={message} className="mt-1 text-sm text-[#FFB3B3]">{message}</p>
                      ))}
                    </button>
                  ))}
                </div>
              ) : activeOutputTab === 'errors' ? (
                <div className="flex h-full min-h-[120px] items-center justify-center text-sm italic text-muted-foreground">
                  No analyzer errors detected.
                </div>
              ) : activeOutputTab === 'symbols' && symbolRows.length > 0 ? (
                <div className="space-y-3">
                  <Table className="min-w-[520px] table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[26%] px-3 py-2 text-xs uppercase tracking-wide">Name</TableHead>
                        <TableHead className="w-[16%] py-2 text-xs uppercase tracking-wide">Type</TableHead>
                        <TableHead className="w-[32%] py-2 text-xs uppercase tracking-wide">Scope</TableHead>
                        <TableHead className="w-[12%] py-2 text-xs uppercase tracking-wide">Offset</TableHead>
                        <TableHead className="w-[14%] py-2 text-xs uppercase tracking-wide">Size</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {symbolRows.map((entry, index) => (
                        <TableRow key={`${entry.name}-${index}`}>
                          <TableCell className="px-3 py-2 font-mono text-sm">{entry.name}</TableCell>
                          <TableCell className="py-2 font-mono text-sm text-[color:var(--golden-main)]">{entry.type}</TableCell>
                          <TableCell className="py-2 font-mono text-sm text-muted-foreground">{entry.levelScope}</TableCell>
                          <TableCell className="py-2 font-mono text-sm">{entry.offset}</TableCell>
                          <TableCell className="py-2 font-mono text-sm">{entry.size} B</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5 font-mono text-xs">
                    {symbolSpaceByLevel.map(({ level, total }) => (
                      <p key={`space-level-${level}`} className="leading-6 text-foreground/85">
                        Total Space for level {level} = {total} B
                      </p>
                    ))}
                  </div>
                </div>
              ) : activeOutputTab === 'symbols' ? (
                <div className="flex h-full min-h-[120px] items-center justify-center text-sm italic text-muted-foreground">
                  Symbol registry appears after a compile run.
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-[#151B28] px-4 py-3 font-mono text-xs">
                  {analyzerTranscript.length === 0 ? (
                    <p className="text-[#95A4C1] italic">Run compiler to generate analyzer report.</p>
                  ) : analyzerTranscript.map((line, index) => (
                    <p
                      key={`${line}-${index}`}
                      className={cn(
                        'leading-6',
                        line.startsWith('---') ? 'text-[color:var(--golden-main)] font-semibold' : 'text-[#B5CEA8]',
                      )}
                    >
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </section>

      </main>
    </div>
  );
}