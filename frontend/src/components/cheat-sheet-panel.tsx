import { useState } from 'react';
import { Card } from './card';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { cn } from './utils';

type CheatSheetItem = {
  feature: string;
  syntax: string;
  details: string;
  status: 'supported' | 'ui' | 'note';
};

const CHEAT_SHEET_ITEMS = [
  {
    feature: '1) Retriever Syntax',
    syntax: 'sit = if condition\nstay = else branch\nrollover = else-if branch\nwalk = while loop\nrun = for loop\nfetch = update variable value\narf = print output\nsniff = read input\nyield = return value\ntrick = function declaration\n{ } = scope markers',
    details: 'Official Retriever keywords and symbols used by the current compiler.',
    status: 'supported',
  },
  {
    feature: '2) Data Types',
    syntax: 'fur = string\nbone = integer\ntail = double\npaw = float\nwoof = boolean',
    details: 'Registered datatypes supported by the language and semantic analyzer.',
    status: 'supported',
  },
  {
    feature: '3) Operators',
    syntax: 'Assignment: :=\nArithmetic: +  -  *  /\nComparison: ==  !=  >  <  >=  <=\nLogical: &&  ||',
    details: 'Use := for assignment, then arithmetic/comparison/logical operators in expressions.',
    status: 'supported',
  },
  {
    feature: '4) Delimiter',
    syntax: '!',
    details: 'Every executable statement must end with ! delimiter.',
    status: 'supported',
  },
  {
    feature: '5) Output and Input Function',
    syntax: 'arf "Hello" !\nsniff username !',
    details: 'Use arf for output and sniff for input typed directly in the Output console prompt.',
    status: 'supported',
  },
  {
    feature: '6) Basic Rules',
    syntax: '1) Declare before use\n2) Match value type with datatype\n3) Close scopes with }\n4) One statement per line is recommended',
    details: 'Keep declarations valid, use compatible types, and maintain proper scope structure.',
    status: 'supported',
  },
  {
    feature: '7) Basic Format',
    syntax: '<datatype> <name> := <value> !\nfetch <name> := <expression> !\narf <expression> !\nsniff <name> !\nsit ( <condition> ) { ... }\nrollover ( <condition> ) { ... }\nstay { ... }\nwalk ( <condition> ) { ... }\nrun <datatype> <name> := ... { ... }\nyield <expression> !',
    details: 'Core statement shapes for declarations, control flow, loops, I/O, and return.',
    status: 'supported',
  },
] satisfies CheatSheetItem[];

export function CheatSheetPanel() {
  const [isOpen, setIsOpen]           = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = searchQuery.trim()
    ? CHEAT_SHEET_ITEMS.filter(item =>
        item.feature.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.syntax.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.details.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : CHEAT_SHEET_ITEMS;

  return (
    <Card className="gap-0 overflow-hidden border border-border shadow-sm flex flex-col">
      {/* Header row */}
      <div className="border-b border-border bg-muted/40 px-4 py-2 flex-none">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setIsOpen(o => !o)}
            className="flex items-center gap-1.5 hover:opacity-70 transition-opacity min-w-0"
            aria-expanded={isOpen}
          >
            {isOpen
              ? <ChevronDown className="size-3.5 text-muted-foreground flex-none" />
              : <ChevronRight className="size-3.5 text-muted-foreground flex-none" />}
            <span className="font-mono text-[11px] tracking-wide uppercase text-muted-foreground truncate">
              Retriever Cheat Sheet
            </span>
          </button>
          <span className="text-[10px] text-muted-foreground/50 flex-none">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search box — only visible when open */}
        {isOpen && (
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/50 pointer-events-none" />
            <input
              type="text"
              placeholder="Search syntax, features…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-background text-foreground pl-7 pr-7 py-1.5 text-xs placeholder:text-muted-foreground/50 outline-none focus:border-ring focus:ring-1 focus:ring-ring/30 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 hover:opacity-70"
              >
                <X className="size-3 text-muted-foreground" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {isOpen ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[520px] lg:max-h-[600px]">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-xs italic text-muted-foreground/50">
              No results for "{searchQuery}"
            </div>
          ) : (
            filtered.map(item => (
              <div
                key={item.feature}
                className="rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors p-3"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{item.feature}</p>
                  <span className={cn(
                    'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide flex-none',
                    item.status === 'supported'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : item.status === 'ui'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                  )}>
                    {item.status}
                  </span>
                </div>
                <p className="mb-1 font-mono text-xs text-[var(--tok-kw)] whitespace-pre-wrap break-words leading-relaxed">{item.syntax}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{item.details}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="px-4 py-3 text-xs italic text-muted-foreground/40 text-center">
          Click title to open your command handbook
        </div>
      )}
    </Card>
  );
}
