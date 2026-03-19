export interface Token {
  value: string;
  type: string;
  position: number;
}

export interface LexerResult {
  tokens: Token[];
  errors: string[];
}

export interface SyntaxResult {
  isValid: boolean;
  expected: string;
  found: string;
  errors: string[];
}

export interface SymbolTableEntry {
  variable: string;
  type: string;
  value: string;
  scopeLevel?: number;
  scopeLabel?: string;
  offset?: number;
}

export interface SemanticResult {
  isValid: boolean;
  messages: string[];
  errors: string[];
  symbolTable: SymbolTableEntry[];
}

export interface CompilerResult {
  lexer: LexerResult;
  syntax: SyntaxResult;
  semantic: SemanticResult;
}

export interface LineResult {
  lineNumber: number;
  code: string;
  result: CompilerResult;
}

export interface MultiLineCompilerResult {
  lines: LineResult[];
  finalSymbolTable: SymbolTableEntry[];
  outputValues: string[];
  hasErrors: boolean;
}
