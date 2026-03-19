const TOKEN_TYPES = {
  DATATYPE: "DATATYPE",
  IDENTIFIER: "IDENTIFIER",
  ASSIGN_OPERATOR: "ASSIGN_OPERATOR",
  ASSIGN_EQUAL_OPERATOR: "ASSIGN_EQUAL_OPERATOR",
  NUMERIC_LITERAL: "NUMERIC_LITERAL",
  BOOLEAN_LITERAL: "BOOLEAN_LITERAL",
  STRING_LITERAL: "STRING_LITERAL",
  CHAR_LITERAL: "CHAR_LITERAL",
  ARITHMETIC_OPERATOR: "ARITHMETIC_OPERATOR",
  COMPARISON_OPERATOR: "COMPARISON_OPERATOR",
  LOGICAL_OPERATOR: "LOGICAL_OPERATOR",
  PAREN_OPEN: "PAREN_OPEN",
  PAREN_CLOSE: "PAREN_CLOSE",
  DELIMITER: "DELIMITER",
  SCOPE_BEGIN_KEYWORD: "SCOPE_BEGIN_KEYWORD",
  SCOPE_END_KEYWORD: "SCOPE_END_KEYWORD",
  UNKNOWN: "UNKNOWN",
  // new keywords
  DECLARE_KEYWORD: "DECLARE_KEYWORD",
  FETCH_KEYWORD: "FETCH_KEYWORD",
  OUTPUT_KEYWORD: "OUTPUT_KEYWORD",
  INPUT_KEYWORD: "INPUT_KEYWORD",
  WAG_KEYWORD: "WAG_KEYWORD",
  ELSE_KEYWORD: "ELSE_KEYWORD",
  CHASE_KEYWORD: "CHASE_KEYWORD",
  WALK_KEYWORD: "WALK_KEYWORD",
  RUN_KEYWORD: "RUN_KEYWORD",
  TRICK_KEYWORD: "TRICK_KEYWORD",
  RETURN_KEYWORD: "RETURN_KEYWORD",
  // legacy
  IF_KEYWORD: "IF_KEYWORD",
  LOOP_KEYWORD: "LOOP_KEYWORD",
  FUNCTION_KEYWORD: "FUNCTION_KEYWORD",
  BRANCH_KEYWORD: "BRANCH_KEYWORD",
  // punctuation
  COLON: "COLON",
  SEMICOLON: "SEMICOLON",
  COMMA: "COMMA",
  BRACKET_OPEN: "BRACKET_OPEN",
  BRACKET_CLOSE: "BRACKET_CLOSE",
  INCREMENT: "INCREMENT",
  DECREMENT: "DECREMENT",
};

const DATATYPES = [
  "fur","bone","tail","paw","woof",
];

const KEYWORDS = {
  sit:     "WAG_KEYWORD",
  stay:    "ELSE_KEYWORD",
  rollover:"CHASE_KEYWORD",
  fetch:   "FETCH_KEYWORD",
  arf:     "OUTPUT_KEYWORD",
  sniff:   "INPUT_KEYWORD",
  walk:    "LOOP_KEYWORD",
  run:     "RUN_KEYWORD",
  trick:   "TRICK_KEYWORD",
  yield:   "RETURN_KEYWORD",
};

const TYPE_SIZE_MAP = {
  fur:4,bone:4,paw:4,tail:8,woof:1,
};

const NUMERIC_TYPES = new Set(["bone","paw","tail"]);
const STRING_TYPES  = new Set(["fur"]);
const BOOL_TYPES    = new Set(["woof"]);
const CHAR_TYPES    = new Set([]);

// ── Lexer ─────────────────────────────────────────────────────────────────────
function lexicalAnalysis(code) {
  const tokens = [];
  const errors = [];

  if (!code.trim()) {
    errors.push("Empty input provided");
    return { tokens, errors };
  }

  let i = 0;
  const length = code.length;

  while (i < length) {
    if (/\s/.test(code[i])) { i++; continue; }

    // single-line comment
    if (code[i] === "/" && code[i+1] === "/") {
      while (i < length && code[i] !== "\n") i++;
      continue;
    }
    // block comment
    if (code[i] === "/" && code[i+1] === "*") {
      i += 2;
      while (i < length-1 && !(code[i] === "*" && code[i+1] === "/")) i++;
      i += 2;
      continue;
    }

    // double-quoted string
    if (code[i] === '"') {
      let value = '"'; i++;
      let closed = false;
      while (i < length) {
        if (code[i] === "\\" && i+1 < length) { value += code[i]+code[i+1]; i+=2; continue; }
        value += code[i];
        if (code[i] === '"') { closed = true; i++; break; }
        i++;
      }
      if (!closed) errors.push("Unclosed string literal");
      tokens.push({ value, type: TOKEN_TYPES.STRING_LITERAL, position: i });
      continue;
    }

    // single-quoted char
    if (code[i] === "'") {
      let value = "'"; i++;
      let closed = false;
      while (i < length && code[i] !== "'") { value += code[i]; i++; }
      if (i < length && code[i] === "'") { value += code[i]; closed = true; i++; }
      if (!closed) errors.push("Unclosed character literal");
      tokens.push({ value, type: TOKEN_TYPES.CHAR_LITERAL, position: i });
      continue;
    }

    // :=
    if (code[i] === ":" && code[i+1] === "=") {
      tokens.push({ value: ":=", type: TOKEN_TYPES.ASSIGN_OPERATOR, position: i }); i+=2; continue;
    }
    // : alone
    if (code[i] === ":") {
      tokens.push({ value: ":", type: TOKEN_TYPES.COLON, position: i }); i++; continue;
    }
    // ==
    if (code[i] === "=" && code[i+1] === "=") {
      tokens.push({ value: "==", type: TOKEN_TYPES.COMPARISON_OPERATOR, position: i }); i+=2; continue;
    }
    // !=
    if (code[i] === "!" && code[i+1] === "=") {
      tokens.push({ value: "!=", type: TOKEN_TYPES.COMPARISON_OPERATOR, position: i }); i+=2; continue;
    }
    // >= <=
    if ((code[i] === ">" || code[i] === "<") && code[i+1] === "=") {
      tokens.push({ value: code[i]+"=", type: TOKEN_TYPES.COMPARISON_OPERATOR, position: i }); i+=2; continue;
    }
    // &&
    if (code[i] === "&" && code[i+1] === "&") {
      tokens.push({ value: "&&", type: TOKEN_TYPES.LOGICAL_OPERATOR, position: i }); i+=2; continue;
    }
    // ||
    if (code[i] === "|" && code[i+1] === "|") {
      tokens.push({ value: "||", type: TOKEN_TYPES.LOGICAL_OPERATOR, position: i }); i+=2; continue;
    }
    // ++
    if (code[i] === "+" && code[i+1] === "+") {
      tokens.push({ value: "++", type: TOKEN_TYPES.INCREMENT, position: i }); i+=2; continue;
    }
    // --
    if (code[i] === "-" && code[i+1] === "-") {
      tokens.push({ value: "--", type: TOKEN_TYPES.DECREMENT, position: i }); i+=2; continue;
    }
    // =
    if (code[i] === "=") {
      tokens.push({ value: "=", type: TOKEN_TYPES.ASSIGN_EQUAL_OPERATOR, position: i }); i++; continue;
    }
    if (code[i] === ">" || code[i] === "<") {
      tokens.push({ value: code[i], type: TOKEN_TYPES.COMPARISON_OPERATOR, position: i }); i++; continue;
    }
    if ("+-*/".includes(code[i])) {
      tokens.push({ value: code[i], type: TOKEN_TYPES.ARITHMETIC_OPERATOR, position: i }); i++; continue;
    }
    if (code[i] === "(") { tokens.push({ value:"(", type: TOKEN_TYPES.PAREN_OPEN, position: i }); i++; continue; }
    if (code[i] === ")") { tokens.push({ value:")", type: TOKEN_TYPES.PAREN_CLOSE, position: i }); i++; continue; }
    if (code[i] === "[") { tokens.push({ value:"[", type: TOKEN_TYPES.BRACKET_OPEN, position: i }); i++; continue; }
    if (code[i] === "]") { tokens.push({ value:"]", type: TOKEN_TYPES.BRACKET_CLOSE, position: i }); i++; continue; }
    if (code[i] === ";") { tokens.push({ value:";", type: TOKEN_TYPES.SEMICOLON, position: i }); i++; continue; }
    if (code[i] === ",") { tokens.push({ value:",", type: TOKEN_TYPES.COMMA, position: i }); i++; continue; }
    if (code[i] === "!") { tokens.push({ value:"!", type: TOKEN_TYPES.DELIMITER, position: i }); i++; continue; }
    if (code[i] === "{") { tokens.push({ value:"{", type: TOKEN_TYPES.SCOPE_BEGIN_KEYWORD, position: i }); i++; continue; }
    if (code[i] === "}") { tokens.push({ value:"}", type: TOKEN_TYPES.SCOPE_END_KEYWORD, position: i }); i++; continue; }

    // number
    if (/\d/.test(code[i])) {
      let value = ""; let hasDot = false;
      while (i < length && (/\d/.test(code[i]) || (!hasDot && code[i] === "."))) {
        if (code[i] === ".") hasDot = true;
        value += code[i]; i++;
      }
      tokens.push({ value, type: TOKEN_TYPES.NUMERIC_LITERAL, position: i });
      continue;
    }

    // identifier / keyword / datatype / boolean
    if (/[a-zA-Z_]/.test(code[i])) {
      let value = "";
      while (i < length && /[a-zA-Z0-9_]/.test(code[i])) { value += code[i]; i++; }
      let type = TOKEN_TYPES.IDENTIFIER;
      if (DATATYPES.includes(value))               type = TOKEN_TYPES.DATATYPE;
      else if (value === "true" || value === "false") type = TOKEN_TYPES.BOOLEAN_LITERAL;
      else if (KEYWORDS[value])                    type = KEYWORDS[value];
      tokens.push({ value, type, position: i });
      continue;
    }

    errors.push(`Unknown character '${code[i]}' at position ${i}`);
    tokens.push({ value: code[i], type: TOKEN_TYPES.UNKNOWN, position: i });
    i++;
  }

  return { tokens, errors };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isExpressionToken(token) {
  return [
    TOKEN_TYPES.IDENTIFIER, TOKEN_TYPES.NUMERIC_LITERAL, TOKEN_TYPES.BOOLEAN_LITERAL,
    TOKEN_TYPES.STRING_LITERAL, TOKEN_TYPES.CHAR_LITERAL, TOKEN_TYPES.ARITHMETIC_OPERATOR,
    TOKEN_TYPES.COMPARISON_OPERATOR, TOKEN_TYPES.LOGICAL_OPERATOR,
    TOKEN_TYPES.PAREN_OPEN, TOKEN_TYPES.PAREN_CLOSE, TOKEN_TYPES.COMMA, TOKEN_TYPES.COLON,
  ].includes(token.type);
}

function findSymbol(symbolTable, variableName, currentScope) {
  for (let scope = currentScope; scope >= 0; scope--) {
    const match = [...symbolTable].reverse()
      .find((e) => e.variable === variableName && e.scopeLevel === scope);
    if (match) return match;
  }
  return null;
}

function evaluateNumericExpression(expressionTokens, symbolTable, currentScope) {
  let expression = "";
  for (const token of expressionTokens) {
    if ([TOKEN_TYPES.NUMERIC_LITERAL, TOKEN_TYPES.ARITHMETIC_OPERATOR,
         TOKEN_TYPES.PAREN_OPEN, TOKEN_TYPES.PAREN_CLOSE].includes(token.type)) {
      expression += token.value + " "; continue;
    }
    if (token.type === TOKEN_TYPES.IDENTIFIER) {
      const entry = findSymbol(symbolTable, token.value, currentScope);
      if (!entry) return { error: `Undefined variable '${token.value}'` };
      if (!NUMERIC_TYPES.has(entry.type))
        return { error: `'${token.value}' is not a numeric type (got ${entry.type})` };
      expression += entry.value + " "; continue;
    }
    return { error: `Invalid token '${token.value}' in numeric expression` };
  }
  const safe = expression.trim();
  if (!safe) return { error: "Empty arithmetic expression" };
  if (!/^[0-9+\-*/().\s]+$/.test(safe)) return { error: "Unsafe arithmetic expression" };
  try {
    const value = Function(`"use strict"; return (${safe});`)();
    if (typeof value !== "number" || Number.isNaN(value)) return { error: "Expression did not produce a number" };
    return { value };
  } catch (_) { return { error: "Invalid arithmetic expression" }; }
}

function evaluateBarkExpression(exprTokens, symbolTable, currentScope) {
  // Evaluate a bark expression and return a string result
  let parts = [];
  let i = 0;
  while (i < exprTokens.length) {
    const token = exprTokens[i];
    if (token.type === TOKEN_TYPES.ARITHMETIC_OPERATOR && token.value === "+") {
      i++; continue; // string concatenation operator — just skip
    }
    if (token.type === TOKEN_TYPES.STRING_LITERAL) {
      parts.push(token.value.replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
    } else if (token.type === TOKEN_TYPES.NUMERIC_LITERAL) {
      parts.push(token.value);
    } else if (token.type === TOKEN_TYPES.BOOLEAN_LITERAL) {
      parts.push(token.value);
    } else if (token.type === TOKEN_TYPES.IDENTIFIER) {
      const entry = findSymbol(symbolTable, token.value, currentScope);
      if (!entry) return { error: `Undefined variable '${token.value}' in bark statement` };
      parts.push(String(entry.value));
    } else {
      // other tokens (parens, etc.) — skip silently
    }
    i++;
  }
  return { value: parts.join("") };
}

function parseSniffValue(rawValue, datatype, variableName) {
  const textValue = String(rawValue).trim();

  if (NUMERIC_TYPES.has(datatype)) {
    if (textValue.length === 0 || Number.isNaN(Number(textValue))) {
      return { error: `Input for '${variableName}' must be numeric (got '${rawValue}')` };
    }
    const parsed = Number(textValue);
    const isInt = datatype === "bone";
    if (isInt && !Number.isInteger(parsed)) {
      return { error: `Input for '${variableName}' must be an integer (${datatype})` };
    }
    return { value: String(parsed) };
  }

  if (STRING_TYPES.has(datatype)) {
    return { value: String(rawValue) };
  }

  if (BOOL_TYPES.has(datatype)) {
    const lowered = textValue.toLowerCase();
    if (lowered === "true" || lowered === "false") {
      return { value: lowered };
    }
    return { error: `Input for '${variableName}' must be boolean: true or false` };
  }

  if (CHAR_TYPES.has(datatype)) {
    if (textValue.length !== 1) {
      return { error: `Input for '${variableName}' must be exactly one character` };
    }
    return { value: textValue };
  }

  return { value: String(rawValue) };
}

// ── Syntax Analysis ───────────────────────────────────────────────────────────
function syntaxAnalysis(tokens) {
  const errors = [];
  const found = tokens.map((t) => `[${t.type}]`).join(" ");

  if (tokens.length === 0) {
    return { isValid: false, expected: "Valid statement", found: "Empty", errors: ["No tokens to analyze"] };
  }

  const t0 = tokens[0].type;

  // } else {
  if (t0 === TOKEN_TYPES.SCOPE_END_KEYWORD &&
      tokens[1]?.type === TOKEN_TYPES.ELSE_KEYWORD &&
      tokens[2]?.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD && tokens.length === 3) {
    return { isValid: true, expected: "} stay {", found, errors };
  }

  // } rollover (condition) {
  if (t0 === TOKEN_TYPES.SCOPE_END_KEYWORD && tokens[1]?.type === TOKEN_TYPES.CHASE_KEYWORD) {
    const expected = "} rollover ( [COND] ) {";
    if (tokens.length < 6) { errors.push("Incomplete rollover statement"); return { isValid:false, expected, found, errors }; }
    if (tokens[2].type !== TOKEN_TYPES.PAREN_OPEN) errors.push("Expected ( after rollover");
    if (tokens[tokens.length - 1].type !== TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) errors.push("Expected { at end of rollover");
    if (!tokens.find((t, i) => i > 2 && t.type === TOKEN_TYPES.PAREN_CLOSE)) errors.push("Expected ) in rollover condition");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // { or }
  if (t0 === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) {
    if (tokens.length > 1) errors.push("Unexpected tokens after {");
    return { isValid: errors.length === 0, expected: "{", found, errors };
  }
  if (t0 === TOKEN_TYPES.SCOPE_END_KEYWORD) {
    if (tokens.length > 1) errors.push("Unexpected tokens after }");
    return { isValid: errors.length === 0, expected: "}", found, errors };
  }

  // fetch name := expr!
  if (t0 === TOKEN_TYPES.FETCH_KEYWORD) {
    const expected = "fetch [ID] := [EXPR] !";
    if (tokens.length < 5) { errors.push("Incomplete fetch statement"); return { isValid:false, expected, found, errors }; }
    if (tokens[1].type !== TOKEN_TYPES.IDENTIFIER)     errors.push("Expected variable name after fetch");
    if (tokens[2].type !== TOKEN_TYPES.ASSIGN_OPERATOR) errors.push("Expected := after identifier");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.DELIMITER) errors.push("Expected ! at end");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // arf expr!
  if (t0 === TOKEN_TYPES.OUTPUT_KEYWORD) {
    const expected = "arf [EXPR] !";
    if (tokens.length < 3) { errors.push("Incomplete arf statement"); return { isValid:false, expected, found, errors }; }
    if (tokens[0].value !== "arf") errors.push("Only 'arf' is allowed as output function");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.DELIMITER) errors.push("Expected ! at end of arf");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // sniff name!
  if (t0 === TOKEN_TYPES.INPUT_KEYWORD) {
    const expected = "sniff [ID] !";
    if (tokens.length < 3) { errors.push("Incomplete sniff statement"); return { isValid:false, expected, found, errors }; }
    if (tokens[1].type !== TOKEN_TYPES.IDENTIFIER) errors.push("Expected identifier after sniff");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.DELIMITER) errors.push("Expected ! at end");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // sit/rollover (condition) {
  if (t0 === TOKEN_TYPES.WAG_KEYWORD || t0 === TOKEN_TYPES.CHASE_KEYWORD) {
    const kw = tokens[0].value;
    const expected = `${kw} ( [COND] ) {`;
    if (tokens.length < 4) { errors.push(`Incomplete ${kw} statement`); return { isValid:false, expected, found, errors }; }
    if (tokens[1].type !== TOKEN_TYPES.PAREN_OPEN) errors.push(`Expected ( after ${kw}`);
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) errors.push(`Expected { at end of ${kw}`);
    if (!tokens.find((t,i) => i > 0 && t.type === TOKEN_TYPES.PAREN_CLOSE)) errors.push("Expected ) in condition");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // stay / stay {
  if (t0 === TOKEN_TYPES.ELSE_KEYWORD) {
    return { isValid: true, expected: "stay { }", found, errors };
  }

  // run type id := init; cond; step {
  if (t0 === TOKEN_TYPES.RUN_KEYWORD) {
    const expected = "run [TYPE] [ID] := ... {";
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) errors.push("Expected { at end of walk");
    if (tokens[1]?.type !== TOKEN_TYPES.DATATYPE) errors.push("Expected datatype after run");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // walk (condition) {
  if (t0 === TOKEN_TYPES.LOOP_KEYWORD) {
    const expected = "walk ( [COND] ) {";
    if (tokens.length < 4) { errors.push("Incomplete walk statement"); return { isValid:false, expected, found, errors }; }
    if (tokens[1].type !== TOKEN_TYPES.PAREN_OPEN) errors.push("Expected ( after walk");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) errors.push("Expected { at end of walk");
    if (!tokens.find((t,i) => i > 0 && t.type === TOKEN_TYPES.PAREN_CLOSE)) errors.push("Expected ) in walk condition");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // trick name(...) {
  if (t0 === TOKEN_TYPES.TRICK_KEYWORD) {
    const expected = "trick [ID] ( [PARAMS] ) {";
    if (tokens[1]?.type !== TOKEN_TYPES.IDENTIFIER) errors.push("Expected function name after trick");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) errors.push("Expected { at end of trick");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // function call: name(...)!
  if (t0 === TOKEN_TYPES.IDENTIFIER && tokens[1]?.type === TOKEN_TYPES.PAREN_OPEN) {
    const expected = "[ID] ( [ARGS] ) !";
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.DELIMITER) errors.push("Expected ! after function call");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // yield expr!
  if (t0 === TOKEN_TYPES.RETURN_KEYWORD) {
    const expected = "yield [EXPR] !";
    if (tokens[0].value !== "yield") errors.push("Only 'yield' is allowed for return statements");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.DELIMITER) errors.push("Expected ! at end");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  // DATATYPE id := expr!
  if (t0 === TOKEN_TYPES.DATATYPE) {
    const expected = "[DATATYPE] [ID] := [EXPR] !";
    if (tokens.length < 5) { errors.push("Incomplete assignment"); return { isValid:false, expected, found, errors }; }
    if (tokens[1].type !== TOKEN_TYPES.IDENTIFIER) errors.push("Expected identifier after datatype");
    if (tokens[2].type !== TOKEN_TYPES.ASSIGN_OPERATOR)
      errors.push("Expected :=");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.DELIMITER) errors.push("Expected !");
    return { isValid: errors.length === 0, expected, found, errors };
  }

  return {
    isValid: false,
    expected: "Valid statement",
    found,
    errors: ["Unrecognized statement — check your syntax"],
  };
}

// ── Semantic Analysis ─────────────────────────────────────────────────────────
function semanticAnalysis(tokens, context) {
  const messages = [];
  const errors = [];
  const newSymbolTable = [...context.symbolTable];
  const nextContext = {
    ...context,
    symbolTable: newSymbolTable,
    scopeOffsets: { ...context.scopeOffsets },
  };
  const currentScope = context.currentScope;

  if (tokens.length === 0) {
    return { isValid: false, messages, errors: ["No tokens"], symbolTable: newSymbolTable, context: nextContext };
  }

  messages.push("Checking type compatibility...");
  const t0 = tokens[0].type;

  // ── } else { ─────────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.SCOPE_END_KEYWORD &&
      tokens[1]?.type === TOKEN_TYPES.ELSE_KEYWORD &&
      tokens[2]?.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) {
    // close current scope, re-open at same level
    const closedScope = currentScope;
    const reopenedScope = closedScope; // net 0 change
    nextContext.currentScope = reopenedScope;
    nextContext.symbolTable = newSymbolTable.filter((e) => e.scopeLevel < closedScope);
    nextContext.scopeOffsets[reopenedScope] = 0;
    messages.push(`Closed scope ${closedScope}, opened else block at scope ${reopenedScope}`);
    return { isValid: true, messages, errors, symbolTable: nextContext.symbolTable, context: nextContext };
  }

  // ── } rollover (condition) { ─────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.SCOPE_END_KEYWORD && tokens[1]?.type === TOKEN_TYPES.CHASE_KEYWORD) {
    if (currentScope === 0) {
      errors.push("Cannot close scope: already at global scope");
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    const parentScope = currentScope - 1;
    const trimmedSymbols = newSymbolTable.filter((e) => e.scopeLevel <= parentScope);
    const closeParenIdx = tokens.findIndex((t, i) => i > 2 && t.type === TOKEN_TYPES.PAREN_CLOSE);
    const condTokens = tokens.slice(3, closeParenIdx);

    condTokens
      .filter((t) => t.type === TOKEN_TYPES.IDENTIFIER)
      .forEach((t) => {
        if (!findSymbol(trimmedSymbols, t.value, parentScope)) {
          errors.push(`Undefined variable in rollover condition: '${t.value}'`);
        }
      });

    if (errors.length > 0) {
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    nextContext.currentScope = currentScope;
    nextContext.symbolTable = trimmedSymbols;
    if (typeof nextContext.scopeOffsets[currentScope] !== "number") nextContext.scopeOffsets[currentScope] = 0;
    messages.push(`Closed scope ${currentScope}, opened rollover block at scope ${currentScope}`);
    return { isValid: true, messages, errors, symbolTable: nextContext.symbolTable, context: nextContext };
  }

  // ── { open scope ─────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) {
    const newScope = currentScope + 1;
    nextContext.currentScope = newScope;
    if (typeof nextContext.scopeOffsets[newScope] !== "number") nextContext.scopeOffsets[newScope] = 0;
    messages.push(`Entered scope level ${newScope}`);
    return { isValid: true, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── } close scope ─────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.SCOPE_END_KEYWORD) {
    if (currentScope === 0) {
      errors.push("Cannot close scope: already at global scope");
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }
    nextContext.currentScope = currentScope - 1;
    nextContext.symbolTable = newSymbolTable.filter((e) => e.scopeLevel <= nextContext.currentScope);
    messages.push(`Exited to scope level ${nextContext.currentScope}`);
    return { isValid: true, messages, errors, symbolTable: nextContext.symbolTable, context: nextContext };
  }

  // ── fetch name := expr! ───────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.FETCH_KEYWORD && tokens.length >= 5) {
    const identifier = tokens[1].value;
    const exprTokens = tokens.slice(3, -1);
    const entry = findSymbol(newSymbolTable, identifier, currentScope);
    if (!entry) {
      errors.push(`Cannot fetch '${identifier}': variable not declared`);
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    messages.push(`Updating '${identifier}' (${entry.type}) in scope ${entry.scopeLevel}`);

    // Update value in symbol table if we can evaluate it
    if (NUMERIC_TYPES.has(entry.type)) {
      const numEval = evaluateNumericExpression(exprTokens, newSymbolTable, currentScope);
      if (numEval.error) { errors.push(numEval.error); }
      else {
        const idx = [...newSymbolTable].reverse().findIndex((e) => e.variable === identifier && e.scopeLevel === entry.scopeLevel);
        const realIdx = newSymbolTable.length - 1 - idx;
        if (realIdx >= 0) newSymbolTable[realIdx] = { ...newSymbolTable[realIdx], value: String(numEval.value) };
        messages.push(`fetch validated ✓, new value: ${numEval.value}`);
      }
    } else {
      messages.push("fetch validated ✓");
    }

    return { isValid: errors.length === 0, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── arf expr! ─────────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.OUTPUT_KEYWORD && tokens.length >= 3) {
    const exprTokens = tokens.slice(1, -1);
    if (tokens[0].value !== "arf") {
      errors.push("Only 'arf' is allowed as output function");
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }
    const result = evaluateBarkExpression(exprTokens, newSymbolTable, currentScope);
    if (result.error) {
      errors.push(result.error);
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }
    messages.push(`arf output: "${result.value}" ✓`);
    return {
      isValid: true, messages, errors,
      outputValue: result.value,
      symbolTable: newSymbolTable, context: nextContext,
    };
  }

  // ── sniff name! ───────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.INPUT_KEYWORD) {
    const identifier = tokens[1]?.value;
    const entry = findSymbol(newSymbolTable, identifier, currentScope);
    if (!entry) {
      errors.push(`Cannot sniff into '${identifier}': variable not declared`);
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    const runtimeInput = context.runtimeInput || {};
    if (!Object.prototype.hasOwnProperty.call(runtimeInput, identifier)) {
      errors.push(`No input provided for '${identifier}'. Add it in Program Input as ${identifier}=value`);
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    const parseResult = parseSniffValue(runtimeInput[identifier], entry.type, identifier);
    if (parseResult.error) {
      errors.push(parseResult.error);
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    const idx = [...newSymbolTable].reverse().findIndex(
      (e) => e.variable === identifier && e.scopeLevel === entry.scopeLevel,
    );
    const realIdx = newSymbolTable.length - 1 - idx;
    if (realIdx >= 0) {
      newSymbolTable[realIdx] = { ...newSymbolTable[realIdx], value: parseResult.value };
    }

    messages.push(`sniff captured '${identifier}' = ${parseResult.value} ✓`);
    return { isValid: true, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── sit/rollover (condition) { ───────────────────────────────────────────
  if (t0 === TOKEN_TYPES.WAG_KEYWORD || t0 === TOKEN_TYPES.CHASE_KEYWORD) {
    const kw = tokens[0].value;
    const closeParenIdx = tokens.findIndex((t, i) => i > 0 && t.type === TOKEN_TYPES.PAREN_CLOSE);
    const condTokens = tokens.slice(2, closeParenIdx);
    condTokens
      .filter((t) => t.type === TOKEN_TYPES.IDENTIFIER)
      .forEach((t) => {
        if (!findSymbol(newSymbolTable, t.value, currentScope))
          errors.push(`Undefined variable in ${kw} condition: '${t.value}'`);
      });
    if (errors.length === 0) messages.push(`${kw} condition validated ✓`);
    // the { opens a new scope
    const newScope = currentScope + 1;
    nextContext.currentScope = newScope;
    if (typeof nextContext.scopeOffsets[newScope] !== "number") nextContext.scopeOffsets[newScope] = 0;
    return { isValid: errors.length === 0, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── stay / stay { ─────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.ELSE_KEYWORD) {
    if (tokens[1]?.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) {
      const newScope = currentScope + 1;
      nextContext.currentScope = newScope;
      if (typeof nextContext.scopeOffsets[newScope] !== "number") nextContext.scopeOffsets[newScope] = 0;
    }
    messages.push("stay block validated ✓");
    return { isValid: true, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── walk (condition) { ────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.LOOP_KEYWORD) {
    const closeParenIdx = tokens.findIndex((t, i) => i > 0 && t.type === TOKEN_TYPES.PAREN_CLOSE);
    const condTokens = tokens.slice(2, closeParenIdx);
    condTokens.filter((t) => t.type === TOKEN_TYPES.IDENTIFIER).forEach((t) => {
      if (!findSymbol(newSymbolTable, t.value, currentScope)) {
        errors.push(`Undefined variable in walk condition: '${t.value}'`);
      }
    });
    if (errors.length === 0) messages.push("walk condition validated ✓");
    const newScope = currentScope + 1;
    nextContext.currentScope = newScope;
    if (typeof nextContext.scopeOffsets[newScope] !== "number") nextContext.scopeOffsets[newScope] = 0;
    return { isValid: errors.length === 0, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── run ... { ─────────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.RUN_KEYWORD) {
    messages.push("run (for) header validated ✓");
    const newScope = currentScope + 1;
    nextContext.currentScope = newScope;
    if (typeof nextContext.scopeOffsets[newScope] !== "number") nextContext.scopeOffsets[newScope] = 0;
    return { isValid: true, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── trick name(...) { ────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.TRICK_KEYWORD) {
    const fnName = tokens[1]?.value || "anonymous";
    messages.push(`trick '${fnName}' declaration validated ✓`);
    const newScope = currentScope + 1;
    nextContext.currentScope = newScope;
    if (typeof nextContext.scopeOffsets[newScope] !== "number") nextContext.scopeOffsets[newScope] = 0;
    return { isValid: true, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── function call: name(...)! ────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.IDENTIFIER && tokens[1]?.type === TOKEN_TYPES.PAREN_OPEN) {
    const fnName = tokens[0].value;

    // Built-in print function syntax: arf(...)
    if (fnName === "arf") {
      const closeParenIdx = tokens.findIndex((t, i) => i > 1 && t.type === TOKEN_TYPES.PAREN_CLOSE);
      const exprTokens = closeParenIdx > 1 ? tokens.slice(2, closeParenIdx) : [];
      const result = evaluateBarkExpression(exprTokens, newSymbolTable, currentScope);
      if (result.error) {
        errors.push(result.error);
        return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
      }
      messages.push(`arf output: "${result.value}" ✓`);
      return {
        isValid: true,
        messages,
        errors,
        outputValue: result.value,
        symbolTable: newSymbolTable,
        context: nextContext,
      };
    }

    messages.push(`Function call '${fnName}(...)' validated ✓`);
    return { isValid: true, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── yield ─────────────────────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.RETURN_KEYWORD) {
    if (tokens[0].value !== "yield") {
      errors.push("Only 'yield' is allowed for return statements");
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }
    messages.push("yield statement validated ✓");
    return { isValid: true, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  // ── DATATYPE id := expr! ──────────────────────────────────────────────────
  if (t0 === TOKEN_TYPES.DATATYPE && tokens.length >= 5) {
    const datatype   = tokens[0].value;
    const identifier = tokens[1].value;
    const exprTokens = tokens.slice(3, -1);

    const existing = newSymbolTable.find(
      (e) => e.variable === identifier && e.scopeLevel === currentScope,
    );
    if (existing) {
      errors.push(`Variable '${identifier}' already declared in scope ${currentScope}`);
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    messages.push(`'${identifier}' declared as ${datatype}`);
    let boundValue = "";
    let isCompatible = false;

    if (NUMERIC_TYPES.has(datatype)) {
      const numEval = evaluateNumericExpression(exprTokens, newSymbolTable, currentScope);
      if (numEval.error) { errors.push(numEval.error); }
      else {
        const isInt = datatype === "bone";
        if (isInt && !Number.isInteger(numEval.value))
          errors.push(`Type mismatch: bone expects integer, got ${numEval.value}`);
        else { isCompatible = true; boundValue = String(numEval.value); }
      }
    } else if (BOOL_TYPES.has(datatype)) {
      const exprToken = exprTokens[0];
      if (exprToken?.type === TOKEN_TYPES.BOOLEAN_LITERAL) { isCompatible = true; boundValue = exprToken.value; }
      else { errors.push(`Type mismatch: woof expects boolean literal`); }
    } else if (STRING_TYPES.has(datatype)) {
      const exprToken = exprTokens[0];
      if (exprToken?.type === TOKEN_TYPES.STRING_LITERAL) { isCompatible = true; boundValue = exprToken.value.replace(/^"|"$/g,""); }
      else { errors.push(`Type mismatch: fur expects string literal`); }
    }

    if (isCompatible) {
      const offset = nextContext.scopeOffsets[currentScope] || 0;
      newSymbolTable.push({
        variable: identifier, type: datatype, value: boundValue,
        scopeLevel: currentScope,
        scopeLabel: currentScope === 0 ? "Global" : "Local",
        offset,
      });
      nextContext.scopeOffsets[currentScope] = offset + (TYPE_SIZE_MAP[datatype] || 4);
      messages.push("Type check passed ✓");
    }

    return { isValid: errors.length === 0, messages, errors, symbolTable: newSymbolTable, context: nextContext };
  }

  return {
    isValid: false, messages,
    errors: ["Unable to perform semantic analysis"],
    symbolTable: newSymbolTable, context: nextContext,
  };
}

// ── Compile ───────────────────────────────────────────────────────────────────
function compile(code, context) {
  const lexer  = lexicalAnalysis(code);
  const syntax = syntaxAnalysis(lexer.tokens);
  const semantic = semanticAnalysis(lexer.tokens, context);
  return { lexer, syntax, semantic };
}

function compileMultiLine(code, runtimeInput = {}) {
  const lines = code.split("\n").filter((line) => line.trim() !== "" && !line.trim().startsWith("//"));
  const results = [];
  let hasErrors = false;
  const outputValues = [];
  const allDeclaredSymbols = [];
  let context = { currentScope: 0, scopeOffsets: { 0: 0 }, symbolTable: [], runtimeInput };

  lines.forEach((line, index) => {
    const prevCount = context.symbolTable.length;
    const result = compile(line.trim(), context);
    context = result.semantic.context;

    if (context.symbolTable.length > prevCount) {
      allDeclaredSymbols.push(...context.symbolTable.slice(prevCount));
    }

    if (result.lexer.errors.length > 0 || result.syntax.errors.length > 0 || result.semantic.errors.length > 0) {
      hasErrors = true;
    }

    if (result.semantic.outputValue !== undefined && result.semantic.outputValue !== null) {
      outputValues.push(result.semantic.outputValue);
    }

    results.push({ lineNumber: index + 1, code: line.trim(), result });
  });

  return { lines: results, finalSymbolTable: allDeclaredSymbols, outputValues, hasErrors };
}

module.exports = { compileMultiLine };
