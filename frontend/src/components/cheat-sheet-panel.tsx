import { useMemo, useState, type ReactNode } from 'react';
import { Card } from './card';
import { Braces, ChevronDown, ChevronRight, Search, Sigma, Type, X } from 'lucide-react';
import { cn } from './utils';

type GuideSection = {
  id: string;
  title: string;
  icon: ReactNode;
  accent: string;
  subtitle: string;
  items: { label: string; value: string }[];
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'syntax',
    title: 'Syntax',
    icon: <Braces className="size-4" />,
    accent: 'from-amber-500/20 to-orange-500/5',
    subtitle: 'Retriever language commands and structure.',
    items: [
      { label: 'Conditionals', value: 'sit (...) { } | rollover (...) { } | stay { }' },
      { label: 'Loops', value: 'walk (...) { } | run <type> <name> := ... { }' },
      { label: 'Functions', value: 'trick <name>(...) { ... yield <expr> ! }' },
      { label: 'Statements', value: 'Every statement ends with !' },
      { label: 'Scopes', value: 'Use { } to define block scope' },
    ],
  },
  {
    id: 'types',
    title: 'Data Types',
    icon: <Type className="size-4" />,
    accent: 'from-sky-500/20 to-cyan-500/5',
    subtitle: 'Supported primitives in the analyzer.',
    items: [
      { label: 'fur', value: 'string' },
      { label: 'bone', value: 'integer' },
      { label: 'paw', value: 'float' },
      { label: 'tail', value: 'double' },
      { label: 'woof', value: 'boolean' },
    ],
  },
  {
    id: 'operators',
    title: 'Operators',
    icon: <Sigma className="size-4" />,
    accent: 'from-violet-500/20 to-fuchsia-500/5',
    subtitle: 'Expression and assignment operators.',
    items: [
      { label: 'Assignment', value: ':=' },
      { label: 'Arithmetic', value: '+  -  *  /' },
      { label: 'Comparison', value: '==  !=  >  <  >=  <=' },
      { label: 'Logical', value: '&&  ||' },
      { label: 'I/O', value: 'arf <expr> ! | sniff <name> !' },
    ],
  },
];

export function CheatSheetPanel({ className }: { className?: string }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSectionIds, setOpenSectionIds] = useState<string[]>(['syntax', 'types', 'operators']);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return GUIDE_SECTIONS;
    const query = searchQuery.toLowerCase();
    return GUIDE_SECTIONS
      .map(section => ({
        ...section,
        items: section.items.filter(item =>
          item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query),
        ),
      }))
      .filter(section => section.items.length > 0 || section.title.toLowerCase().includes(query));
  }, [searchQuery]);

  const toggleSection = (id: string) => {
    setOpenSectionIds(current =>
      current.includes(id)
        ? current.filter(openId => openId !== id)
        : [...current, id],
    );
  };

  return (
    <Card className={cn('h-full min-h-[340px] gap-0 overflow-hidden border-border/70 bg-card/90 shadow-xl', className)}>
      <div className="border-b border-border/70 bg-muted/40 p-3">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Cheat Sheet</p>
        <p className="mt-1 text-sm font-medium text-foreground">Retriever quick lookup</p>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search keywords, types, operators"
            className="h-9 w-full rounded-lg border border-border/70 bg-background/70 pl-8 pr-8 text-xs outline-none transition focus:border-[color:var(--golden-main)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {filteredSections.length === 0 && (
          <p className="py-12 text-center text-xs italic text-muted-foreground">No results for "{searchQuery}".</p>
        )}

        {filteredSections.map((section, index) => {
          const isOpen = openSectionIds.includes(section.id);
          return (
            <div
              key={section.id}
              className="guide-slide rounded-xl border border-border/70 bg-card/70"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  'group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition',
                  `bg-gradient-to-r ${section.accent}`,
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg border border-border/70 bg-background/60 p-1.5 text-[color:var(--golden-main)]">
                    {section.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{section.title}</p>
                    <p className="text-[11px] text-muted-foreground">{section.subtitle}</p>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronDown className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                ) : (
                  <ChevronRight className="size-4 text-muted-foreground transition group-hover:text-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="space-y-2 px-3 pb-3">
                  {section.items.map((item) => (
                    <div key={`${section.id}-${item.label}`} className="rounded-lg border border-border/60 bg-background/45 px-2.5 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className="mt-1 font-mono text-xs leading-relaxed text-[var(--tok-kw)]">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
