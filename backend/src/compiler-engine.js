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

const defaultInputHandler = async (identifier) => {
  throw new Error(
    `No input handler configured for '${identifier}'. Call setInputHandler(fn) before compiling sniff statements.`,
  );
};

let inputHandler = defaultInputHandler;
const pendingInputResolvers = new Map();
let waitingForInput = false;
let inputRequestCounter = 0;

function createAbortError(message) {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function clearPendingInputRequest(requestId) {
  pendingInputResolvers.delete(requestId);
  waitingForInput = pendingInputResolvers.size > 0;
}

function resetInputState() {
  for (const { reject } of pendingInputResolvers.values()) {
    reject(createAbortError("Compilation reset - input cancelled"));
  }
  pendingInputResolvers.clear();
  waitingForInput = false;
}

function requestInputValue(identifier) {
  return new Promise((resolve, reject) => {
    const requestId = `${identifier}:${Date.now()}:${inputRequestCounter++}`;

    pendingInputResolvers.set(requestId, {
      resolve: (value) => {
        clearPendingInputRequest(requestId);
        resolve(value);
      },
      reject: (error) => {
        clearPendingInputRequest(requestId);
        reject(error);
      },
    });
    waitingForInput = true;

    Promise.resolve()
      .then(() => inputHandler(identifier, requestId))
      .then((value) => {
        const resolver = pendingInputResolvers.get(requestId);
        if (!resolver) return;
        resolver.resolve(value);
      })
      .catch((error) => {
        const resolver = pendingInputResolvers.get(requestId);
        if (!resolver) return;
        resolver.reject(error);
      });
  });
}

function setInputHandler(fn) {
  if (typeof fn !== "function") {
    throw new TypeError("setInputHandler expects a function");
  }
  inputHandler = fn;
}

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
      const normalized = value.toLowerCase();
      let type = TOKEN_TYPES.IDENTIFIER;
      if (DATATYPES.includes(normalized)) {
        type = TOKEN_TYPES.DATATYPE;
        value = normalized;
      } else if (normalized === "true" || normalized === "false") {
        type = TOKEN_TYPES.BOOLEAN_LITERAL;
        value = normalized;
      } else if (KEYWORDS[normalized]) {
        type = KEYWORDS[normalized];
        value = normalized;
      }
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

function evaluateCondition(condTokens, symbolTable, currentScope) {
  const hasParens = condTokens.some((token) => token.type === TOKEN_TYPES.PAREN_OPEN);
  const openIdx = hasParens ? condTokens.findIndex((token) => token.type === TOKEN_TYPES.PAREN_OPEN) : -1;
  const closeIdx = hasParens
    ? condTokens.findIndex((token, index) => index > openIdx && token.type === TOKEN_TYPES.PAREN_CLOSE)
    : -1;

  const conditionTokens = hasParens
    ? condTokens.slice(openIdx + 1, closeIdx)
    : condTokens;

  if (conditionTokens.length === 0) {
    return { ok: false, value: false, error: "Empty condition expression" };
  }

  const expressionParts = [];

  for (const token of conditionTokens) {
    if (
      token.type === TOKEN_TYPES.COMPARISON_OPERATOR ||
      token.type === TOKEN_TYPES.LOGICAL_OPERATOR ||
      token.type === TOKEN_TYPES.ARITHMETIC_OPERATOR ||
      token.type === TOKEN_TYPES.PAREN_OPEN ||
      token.type === TOKEN_TYPES.PAREN_CLOSE
    ) {
      expressionParts.push(token.value);
      continue;
    }

    if (token.type === TOKEN_TYPES.NUMERIC_LITERAL) {
      expressionParts.push(token.value);
      continue;
    }

    if (token.type === TOKEN_TYPES.BOOLEAN_LITERAL) {
      expressionParts.push(token.value === "true" ? "true" : "false");
      continue;
    }

    if (token.type === TOKEN_TYPES.STRING_LITERAL) {
      expressionParts.push(JSON.stringify(token.value.replace(/^"|"$/g, "")));
      continue;
    }

    if (token.type === TOKEN_TYPES.IDENTIFIER) {
      const symbol = findSymbol(symbolTable, token.value, currentScope);
      if (!symbol) {
        return { ok: false, value: false, error: `Undefined variable in condition: '${token.value}'` };
      }

      if (NUMERIC_TYPES.has(symbol.type)) {
        expressionParts.push(String(Number(symbol.value)));
      } else if (BOOL_TYPES.has(symbol.type)) {
        expressionParts.push(String(symbol.value).toLowerCase() === "true" ? "true" : "false");
      } else {
        expressionParts.push(JSON.stringify(String(symbol.value)));
      }
      continue;
    }

    return { ok: false, value: false, error: `Invalid token '${token.value}' in condition` };
  }

  const safeExpression = expressionParts.join(" ").trim();
  if (!safeExpression) {
    return { ok: false, value: false, error: "Empty condition expression" };
  }

  if (!/^[\w\s'"=!<>&|+\-*/().]+$/.test(safeExpression)) {
    return { ok: false, value: false, error: "Unsafe condition expression" };
  }

  try {
    const evaluated = Function(`"use strict"; return (${safeExpression});`)();
    return { ok: true, value: Boolean(evaluated) };
  } catch (_) {
    return { ok: false, value: false, error: "Failed to evaluate condition" };
  }
}

function enterScope(context) {
  const newScope = context.currentScope + 1;
  context.currentScope = newScope;
  if (typeof context.scopeOffsets[newScope] !== "number") {
    context.scopeOffsets[newScope] = 0;
  }
}

function exitScope(context) {
  if (context.currentScope === 0) return;
  const nextScope = context.currentScope - 1;
  context.currentScope = nextScope;
  context.symbolTable = context.symbolTable.filter((entry) => entry.scopeLevel <= nextScope);
}

function buildProgram(lines) {
  return lines.map((line, index) => {
    const code = line.trim();
    const lexer = lexicalAnalysis(code);
    const recovery = applyRecoveryStrategies(lexer.tokens);
    const syntax = syntaxAnalysis(recovery.tokens);
    syntax.recoveryStrategies = recovery.messages;
    syntax.recoverableErrors = recovery.recoverableErrors;
    syntax.normalizedTokens = recovery.tokens;
    return { index, lineNumber: index + 1, code, lexer, syntax, tokens: lexer.tokens };
  });
}

function buildBlockMaps(program) {
  const blockMap = new Map();
  const reverseBlockMap = new Map();
  const braceStack = [];

  for (const line of program) {
    for (const token of line.tokens) {
      if (token.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) {
        braceStack.push(line.index);
      } else if (token.type === TOKEN_TYPES.SCOPE_END_KEYWORD) {
        const openLine = braceStack.pop();
        if (typeof openLine === "number") {
          blockMap.set(openLine, line.index);
          reverseBlockMap.set(line.index, openLine);
        }
      }
    }
  }

  return { blockMap, reverseBlockMap };
}

function buildFunctionMap(program, blockMap) {
  const functionMap = new Map();

  for (const line of program) {
    const tokens = line.tokens;
    if (tokens[0]?.type !== TOKEN_TYPES.TRICK_KEYWORD || tokens[1]?.type !== TOKEN_TYPES.IDENTIFIER) {
      continue;
    }

    const fnName = tokens[1].value;
    const startLine = line.index;
    const endLine = blockMap.get(startLine);
    if (typeof endLine !== "number") {
      continue;
    }

    const openParen = tokens.findIndex((token) => token.type === TOKEN_TYPES.PAREN_OPEN);
    const closeParen = tokens.findIndex((token, idx) => idx > openParen && token.type === TOKEN_TYPES.PAREN_CLOSE);
    const paramNames = [];
    if (openParen !== -1 && closeParen !== -1) {
      for (let idx = openParen + 1; idx < closeParen; idx++) {
        if (tokens[idx].type === TOKEN_TYPES.IDENTIFIER && tokens[idx - 1]?.type === TOKEN_TYPES.DATATYPE) {
          paramNames.push(tokens[idx].value);
        }
      }
    }

    functionMap.set(fnName, { startLine, endLine, paramNames });
  }

  return functionMap;
}

function evaluateValueForType(datatype, exprTokens, context) {
  if (NUMERIC_TYPES.has(datatype)) {
    const numeric = evaluateNumericExpression(exprTokens, context.symbolTable, context.currentScope);
    if (numeric.error) return { error: numeric.error };
    if (datatype === "bone" && !Number.isInteger(numeric.value)) {
      return { error: `Type mismatch: bone expects integer, got ${numeric.value}` };
    }
    return { value: String(numeric.value) };
  }

  if (BOOL_TYPES.has(datatype)) {
    const token = exprTokens[0];
    if (token?.type === TOKEN_TYPES.BOOLEAN_LITERAL) {
      return { value: token.value };
    }
    if (token?.type === TOKEN_TYPES.IDENTIFIER) {
      const entry = findSymbol(context.symbolTable, token.value, context.currentScope);
      if (!entry) return { error: `Undefined variable '${token.value}'` };
      if (!BOOL_TYPES.has(entry.type)) return { error: `Type mismatch: woof expects boolean value` };
      return { value: String(entry.value).toLowerCase() === "true" ? "true" : "false" };
    }
    return { error: "Type mismatch: woof expects boolean literal" };
  }

  if (STRING_TYPES.has(datatype)) {
    const token = exprTokens[0];
    if (token?.type === TOKEN_TYPES.STRING_LITERAL) {
      return { value: token.value.replace(/^"|"$/g, "") };
    }
    if (token?.type === TOKEN_TYPES.IDENTIFIER) {
      const entry = findSymbol(context.symbolTable, token.value, context.currentScope);
      if (!entry) return { error: `Undefined variable '${token.value}'` };
      if (!STRING_TYPES.has(entry.type)) return { error: "Type mismatch: fur expects string value" };
      return { value: String(entry.value) };
    }
    return { error: "Type mismatch: fur expects string literal" };
  }

  return { value: "" };
}

function runInitTokens(initTokens, context) {
  if (
    initTokens.length < 4 ||
    initTokens[0].type !== TOKEN_TYPES.DATATYPE ||
    initTokens[1].type !== TOKEN_TYPES.IDENTIFIER ||
    initTokens[2].type !== TOKEN_TYPES.ASSIGN_OPERATOR
  ) {
    return { error: "Invalid run init. Expected: <type> <name> := <expr>" };
  }

  const datatype = initTokens[0].value;
  const identifier = initTokens[1].value;
  const exprTokens = initTokens.slice(3);
  const evaluated = evaluateValueForType(datatype, exprTokens, context);
  if (evaluated.error) {
    return { error: evaluated.error };
  }

  const existing = context.symbolTable.find(
    (entry) => entry.variable === identifier && entry.scopeLevel === context.currentScope,
  );

  if (existing) {
    if (existing.type !== datatype) {
      return { error: `Type mismatch: '${identifier}' is ${existing.type}, run init expects ${datatype}` };
    }

    const revIdx = [...context.symbolTable]
      .reverse()
      .findIndex((entry) => entry.variable === identifier && entry.scopeLevel === context.currentScope);
    const realIdx = context.symbolTable.length - 1 - revIdx;
    if (realIdx >= 0) {
      context.symbolTable[realIdx] = { ...context.symbolTable[realIdx], value: evaluated.value };
      updateSymbolValueInHistory(context.symbolHistory, identifier, context.currentScope, evaluated.value);
    }
    return { ok: true, message: `run init updated '${identifier}' = ${evaluated.value}` };
  }

  const offset = context.scopeOffsets[context.currentScope] || 0;
  const declaredEntry = {
    variable: identifier,
    type: datatype,
    value: evaluated.value,
    scopeLevel: context.currentScope,
    scopeLabel: context.currentScope === 0 ? "Global" : "Local",
    offset,
  };
  context.symbolTable.push(declaredEntry);
  context.symbolHistory.push({ ...declaredEntry });
  context.scopeOffsets[context.currentScope] = offset + (TYPE_SIZE_MAP[datatype] || 4);
  return { ok: true, message: `run init declared '${identifier}' = ${evaluated.value}` };
}

function applyRunStep(stepTokens, context) {
  if (stepTokens.length < 2 || stepTokens[0].type !== TOKEN_TYPES.IDENTIFIER) {
    return { error: "Invalid run step expression" };
  }

  const stepVariable = stepTokens[0].value;
  const entry = findSymbol(context.symbolTable, stepVariable, context.currentScope);
  if (!entry) {
    return { error: `Undefined loop variable '${stepVariable}' in run step` };
  }
  if (!NUMERIC_TYPES.has(entry.type)) {
    return { error: `Loop variable '${stepVariable}' must be numeric` };
  }

  const idx = [...context.symbolTable]
    .reverse()
    .findIndex((item) => item.variable === stepVariable && item.scopeLevel === entry.scopeLevel);
  const realIdx = context.symbolTable.length - 1 - idx;
  if (realIdx < 0) {
    return { error: `Loop variable '${stepVariable}' was not found` };
  }

  const currentValue = Number(context.symbolTable[realIdx].value);
  if (Number.isNaN(currentValue)) {
    return { error: `Loop variable '${stepVariable}' is not numeric` };
  }

  if (stepTokens[1].type === TOKEN_TYPES.INCREMENT) {
    const nextValue = String(currentValue + 1);
    context.symbolTable[realIdx] = { ...context.symbolTable[realIdx], value: nextValue };
    updateSymbolValueInHistory(context.symbolHistory, stepVariable, entry.scopeLevel, nextValue);
    return { ok: true };
  }

  if (stepTokens[1].type === TOKEN_TYPES.DECREMENT) {
    const nextValue = String(currentValue - 1);
    context.symbolTable[realIdx] = { ...context.symbolTable[realIdx], value: nextValue };
    updateSymbolValueInHistory(context.symbolHistory, stepVariable, entry.scopeLevel, nextValue);
    return { ok: true };
  }

  return { error: "Only ++ and -- are supported in run step" };
}

function updateSymbolValueInHistory(symbolHistory, variableName, scopeLevel, nextValue) {
  if (!Array.isArray(symbolHistory)) return;

  const reverseIndex = [...symbolHistory]
    .reverse()
    .findIndex((entry) => entry.variable === variableName && entry.scopeLevel === scopeLevel);

  if (reverseIndex === -1) return;

  const realIndex = symbolHistory.length - 1 - reverseIndex;
  symbolHistory[realIndex] = { ...symbolHistory[realIndex], value: nextValue };
}

function statementRequiresDelimiter(tokens) {
  const t0 = tokens[0]?.type;
  if (!t0) return false;

  if (
    t0 === TOKEN_TYPES.DATATYPE ||
    t0 === TOKEN_TYPES.FETCH_KEYWORD ||
    t0 === TOKEN_TYPES.OUTPUT_KEYWORD ||
    t0 === TOKEN_TYPES.INPUT_KEYWORD ||
    t0 === TOKEN_TYPES.RETURN_KEYWORD
  ) {
    return true;
  }

  // function call statement: name(...)!
  if (t0 === TOKEN_TYPES.IDENTIFIER && tokens[1]?.type === TOKEN_TYPES.PAREN_OPEN) {
    return true;
  }

  return false;
}

function applyRecoveryStrategies(tokens) {
  const messages = [];
  const recoverableErrors = [];
  const panicSkippedTokens = tokens.filter((token) => token.type === TOKEN_TYPES.UNKNOWN);
  let normalizedTokens = tokens.filter((token) => token.type !== TOKEN_TYPES.UNKNOWN);

  if (panicSkippedTokens.length > 0) {
    const skippedValues = panicSkippedTokens.map((token) => token.value).join(" ");
    recoverableErrors.push(`Invalid token(s) found: ${skippedValues}`);
    messages.push(
      `Panic Mode Recovery: skipped invalid token(s): ${skippedValues}. Parsing continued with valid tokens.`,
    );
  }

  const needsDelimiter = statementRequiresDelimiter(normalizedTokens);
  const hasDelimiter = normalizedTokens[normalizedTokens.length - 1]?.type === TOKEN_TYPES.DELIMITER;
  if (needsDelimiter && !hasDelimiter) {
    const insertAt = normalizedTokens[normalizedTokens.length - 1]?.position ?? -1;
    recoverableErrors.push("Missing delimiter '!' at end of statement");
    normalizedTokens = [
      ...normalizedTokens,
      { value: "!", type: TOKEN_TYPES.DELIMITER, position: insertAt },
    ];
    messages.push("Phrase-Level Recovery: inserted missing delimiter '!' at end of statement.");
  }

  return { tokens: normalizedTokens, messages, recoverableErrors };
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
    const expected = "run [TYPE] [ID] := [INIT] ; [COND] ; [STEP] {";
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.SCOPE_BEGIN_KEYWORD) errors.push("Expected { at end of run");
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
    const expected = "[DATATYPE] [ID] ! OR [DATATYPE] [ID] := [EXPR] !";
    if (tokens.length < 3) { errors.push("Incomplete declaration"); return { isValid:false, expected, found, errors }; }
    if (tokens[1].type !== TOKEN_TYPES.IDENTIFIER) errors.push("Expected identifier after datatype");
    if (tokens[tokens.length-1].type !== TOKEN_TYPES.DELIMITER) errors.push("Expected !");

    const isBareDeclaration = tokens.length === 3;
    if (!isBareDeclaration && tokens[2].type !== TOKEN_TYPES.ASSIGN_OPERATOR) {
      errors.push("Expected := for initialized declaration");
    }

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
async function semanticAnalysis(tokens, context) {
  const messages = [];
  const errors = [];
  const newSymbolTable = [...context.symbolTable];
  const nextContext = {
    ...context,
    symbolTable: newSymbolTable,
    scopeOffsets: { ...context.scopeOffsets },
    symbolHistory: [...(context.symbolHistory || [])],
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
        if (realIdx >= 0) {
          const nextValue = String(numEval.value);
          newSymbolTable[realIdx] = { ...newSymbolTable[realIdx], value: nextValue };
          updateSymbolValueInHistory(nextContext.symbolHistory, identifier, entry.scopeLevel, nextValue);
        }
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

    let rawInput;
    try {
      rawInput = await requestInputValue(identifier);
    } catch (error) {
      errors.push(error?.message || `Failed to read input for '${identifier}'`);
      return { isValid: false, messages, errors, symbolTable: newSymbolTable, context: nextContext };
    }

    const parseResult = parseSniffValue(rawInput, entry.type, identifier);
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
      updateSymbolValueInHistory(nextContext.symbolHistory, identifier, entry.scopeLevel, parseResult.value);
    }

    nextContext.symbolTable = newSymbolTable;

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
  if (t0 === TOKEN_TYPES.DATATYPE && tokens.length >= 3) {
    const datatype   = tokens[0].value;
    const identifier = tokens[1].value;
    const isBareDeclaration = tokens.length === 3;
    const exprTokens = isBareDeclaration ? [] : tokens.slice(3, -1);

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

    if (isBareDeclaration) {
      if (datatype === "bone" || datatype === "paw" || datatype === "tail") boundValue = "0";
      else if (datatype === "woof") boundValue = "false";
      else boundValue = "";
      isCompatible = true;
    }

    if (!isBareDeclaration && NUMERIC_TYPES.has(datatype)) {
      const numEval = evaluateNumericExpression(exprTokens, newSymbolTable, currentScope);
      if (numEval.error) { errors.push(numEval.error); }
      else {
        const isInt = datatype === "bone";
        if (isInt && !Number.isInteger(numEval.value))
          errors.push(`Type mismatch: bone expects integer, got ${numEval.value}`);
        else { isCompatible = true; boundValue = String(numEval.value); }
      }
    } else if (!isBareDeclaration && BOOL_TYPES.has(datatype)) {
      const exprToken = exprTokens[0];
      if (exprToken?.type === TOKEN_TYPES.BOOLEAN_LITERAL) { isCompatible = true; boundValue = exprToken.value; }
      else { errors.push(`Type mismatch: woof expects boolean literal`); }
    } else if (!isBareDeclaration && STRING_TYPES.has(datatype)) {
      const exprToken = exprTokens[0];
      if (exprToken?.type === TOKEN_TYPES.STRING_LITERAL) { isCompatible = true; boundValue = exprToken.value.replace(/^"|"$/g,""); }
      else { errors.push(`Type mismatch: fur expects string literal`); }
    }

    if (isCompatible) {
      const offset = nextContext.scopeOffsets[currentScope] || 0;
      const declaredEntry = {
        variable: identifier, type: datatype, value: boundValue,
        scopeLevel: currentScope,
        scopeLabel: currentScope === 0 ? "Global" : "Local",
        offset,
      };
      newSymbolTable.push(declaredEntry);
      nextContext.symbolHistory.push({ ...declaredEntry });
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
async function compile(code, context) {
  const lexer  = lexicalAnalysis(code);
  const recovery = applyRecoveryStrategies(lexer.tokens);
  const syntax = syntaxAnalysis(recovery.tokens);
  syntax.recoveryStrategies = recovery.messages;
  syntax.recoverableErrors = recovery.recoverableErrors;
  syntax.normalizedTokens = recovery.tokens;
  const semantic = await semanticAnalysis(recovery.tokens, context);
  return { lexer, syntax, semantic };
}

async function compileMultiLine(code, runtimeInput = {}) {
  resetInputState();
  const sourceLines = code.split("\n").filter((line) => line.trim() !== "" && !line.trim().startsWith("//"));
  const program = buildProgram(sourceLines);
  const { blockMap, reverseBlockMap } = buildBlockMaps(program);
  const functionMap = buildFunctionMap(program, blockMap);

  const results = [];
  let hasErrors = false;
  const outputValues = [];
  let context = { currentScope: 0, scopeOffsets: { 0: 0 }, symbolTable: [], symbolHistory: [], runtimeInput };
  let pc = 0;

  const callStack = [];
  const loopStack = [];
  const skipStayOpeners = new Set();

  const pushLineResult = (line, result) => {
    results.push({ lineNumber: line.lineNumber, code: line.code, result });
    const hasRecoverableSyntaxErrors = Array.isArray(result.syntax.recoverableErrors)
      ? result.syntax.recoverableErrors.length > 0
      : false;
    if (
      result.lexer.errors.length > 0 ||
      result.syntax.errors.length > 0 ||
      hasRecoverableSyntaxErrors ||
      result.semantic.errors.length > 0
    ) {
      hasErrors = true;
    }
    if (result.semantic.outputValue !== undefined && result.semantic.outputValue !== null) {
      outputValues.push(result.semantic.outputValue);
    }
  };

  const semanticPassResult = (line, messages = []) => ({
    lexer: line.lexer,
    syntax: line.syntax,
    semantic: {
      isValid: true,
      messages,
      errors: [],
      symbolTable: context.symbolTable,
      context,
    },
  });

  const previousInputHandler = inputHandler;
  const useRuntimeInputFallback =
    inputHandler === defaultInputHandler &&
    runtimeInput !== null &&
    typeof runtimeInput === "object" &&
    !Array.isArray(runtimeInput);

  if (useRuntimeInputFallback) {
    inputHandler = async (identifier) => {
      if (Object.prototype.hasOwnProperty.call(runtimeInput, identifier)) {
        return runtimeInput[identifier];
      }
      throw new Error(`No input provided for '${identifier}'. Add it in Program Input as ${identifier}=value`);
    };
  }

  try {
    while (pc < program.length) {
      const line = program[pc];
      const tokens = line.tokens;

      const hasUnrecoverableLexErrors = line.lexer.errors.some(
        (error) => !error.startsWith("Unknown character"),
      );
      if (hasUnrecoverableLexErrors || line.syntax.errors.length > 0) {
        const failed = {
          lexer: line.lexer,
          syntax: line.syntax,
          semantic: {
            isValid: false,
            messages: ["Skipped semantic analysis due lexer/syntax errors"],
            errors: [],
            symbolTable: context.symbolTable,
            context,
          },
        };
        pushLineResult(line, failed);
        pc += 1;
        continue;
      }

      // Function definitions are registered in the pre-pass and skipped until called.
      if (tokens[0]?.type === TOKEN_TYPES.TRICK_KEYWORD) {
        const fnName = tokens[1]?.value;
        const fnMeta = fnName ? functionMap.get(fnName) : null;
        pushLineResult(line, semanticPassResult(line, [`Registered function '${fnName}'`]));
        if (fnMeta) {
          pc = fnMeta.endLine + 1;
        } else {
          pc += 1;
        }
        continue;
      }

      // Combined closing + else opening line: } stay {
      if (
        tokens[0]?.type === TOKEN_TYPES.SCOPE_END_KEYWORD &&
        tokens[1]?.type === TOKEN_TYPES.ELSE_KEYWORD &&
        tokens[2]?.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD
      ) {
        exitScope(context);

        if (skipStayOpeners.has(pc)) {
          skipStayOpeners.delete(pc);
          const stayEnd = blockMap.get(pc);
          pushLineResult(line, semanticPassResult(line, ["Skipped stay block"]));
          pc = typeof stayEnd === "number" ? stayEnd + 1 : pc + 1;
          continue;
        }

        enterScope(context);
        pushLineResult(line, semanticPassResult(line, ["Entered stay block"]));
        pc += 1;
        continue;
      }

      if (tokens[0]?.type === TOKEN_TYPES.WAG_KEYWORD) {
        const sitEnd = blockMap.get(pc);
        const conditionResult = evaluateCondition(tokens, context.symbolTable, context.currentScope);

        if (!conditionResult.ok) {
          const failed = {
            lexer: line.lexer,
            syntax: line.syntax,
            semantic: {
              isValid: false,
              messages: [],
              errors: [conditionResult.error || "Failed to evaluate sit condition"],
              symbolTable: context.symbolTable,
              context,
            },
          };
          pushLineResult(line, failed);
          pc += 1;
          continue;
        }

        let stayLine = null;
        if (typeof sitEnd === "number") {
          const closeTokens = program[sitEnd]?.tokens || [];
          if (
            closeTokens[0]?.type === TOKEN_TYPES.SCOPE_END_KEYWORD &&
            closeTokens[1]?.type === TOKEN_TYPES.ELSE_KEYWORD &&
            closeTokens[2]?.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD
          ) {
            stayLine = sitEnd;
          } else {
            const nextIndex = sitEnd + 1;
            const nextTokens = program[nextIndex]?.tokens || [];
            if (nextTokens[0]?.type === TOKEN_TYPES.ELSE_KEYWORD && nextTokens.some((t) => t.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD)) {
              stayLine = nextIndex;
            }
          }
        }

        if (conditionResult.value) {
          if (typeof stayLine === "number") {
            skipStayOpeners.add(stayLine);
          }
          enterScope(context);
          pushLineResult(line, semanticPassResult(line, ["sit condition is true"]));
          pc += 1;
        } else if (typeof stayLine === "number") {
          if (stayLine === sitEnd) {
            enterScope(context);
            pushLineResult(line, semanticPassResult(line, ["sit condition is false, entering stay block"]));
            pc = stayLine + 1;
          } else {
            pushLineResult(line, semanticPassResult(line, ["sit condition is false, jumping to stay"]));
            pc = stayLine;
          }
        } else {
          pushLineResult(line, semanticPassResult(line, ["sit condition is false, skipping block"]));
          pc = typeof sitEnd === "number" ? sitEnd + 1 : pc + 1;
        }
        continue;
      }

      if (tokens[0]?.type === TOKEN_TYPES.ELSE_KEYWORD && tokens.some((token) => token.type === TOKEN_TYPES.SCOPE_BEGIN_KEYWORD)) {
        if (skipStayOpeners.has(pc)) {
          skipStayOpeners.delete(pc);
          const stayEnd = blockMap.get(pc);
          pushLineResult(line, semanticPassResult(line, ["Skipped stay block"]));
          pc = typeof stayEnd === "number" ? stayEnd + 1 : pc + 1;
        } else {
          enterScope(context);
          pushLineResult(line, semanticPassResult(line, ["Entered stay block"]));
          pc += 1;
        }
        continue;
      }

      if (tokens[0]?.type === TOKEN_TYPES.LOOP_KEYWORD) {
        const loopEnd = blockMap.get(pc);
        const conditionResult = evaluateCondition(tokens, context.symbolTable, context.currentScope);
        if (!conditionResult.ok) {
          const failed = {
            lexer: line.lexer,
            syntax: line.syntax,
            semantic: {
              isValid: false,
              messages: [],
              errors: [conditionResult.error || "Failed to evaluate walk condition"],
              symbolTable: context.symbolTable,
              context,
            },
          };
          pushLineResult(line, failed);
          pc += 1;
          continue;
        }

        const existingLoop = loopStack.find((loop) => loop.type === "walk" && loop.headerPc === pc);
        if (conditionResult.value) {
          if (!existingLoop && typeof loopEnd === "number") {
            loopStack.push({ type: "walk", headerPc: pc, endPc: loopEnd });
          }
          enterScope(context);
          pushLineResult(line, semanticPassResult(line, ["walk condition is true"]));
          pc += 1;
        } else {
          if (existingLoop) {
            const idx = loopStack.indexOf(existingLoop);
            loopStack.splice(idx, 1);
          }
          pushLineResult(line, semanticPassResult(line, ["walk condition is false, exiting loop"]));
          pc = typeof loopEnd === "number" ? loopEnd + 1 : pc + 1;
        }
        continue;
      }

      if (tokens[0]?.type === TOKEN_TYPES.RUN_KEYWORD) {
        const runEnd = blockMap.get(pc);
        let runFrame = loopStack.find((loop) => loop.type === "run" && loop.headerPc === pc);

        if (!runFrame) {
          const bodyTokens = tokens.slice(1, -1);
          const segments = [];
          let currentSegment = [];
          for (const token of bodyTokens) {
            if (token.type === TOKEN_TYPES.SEMICOLON) {
              segments.push(currentSegment);
              currentSegment = [];
            } else {
              currentSegment.push(token);
            }
          }
          segments.push(currentSegment);

          if (segments.length !== 3 || typeof runEnd !== "number") {
            const failed = {
              lexer: line.lexer,
              syntax: line.syntax,
              semantic: {
                isValid: false,
                messages: [],
                errors: ["Invalid run header. Expected init; condition; step"],
                symbolTable: context.symbolTable,
                context,
              },
            };
            pushLineResult(line, failed);
            pc += 1;
            continue;
          }

          const initResult = runInitTokens(segments[0], context);
          if (initResult.error) {
            const failed = {
              lexer: line.lexer,
              syntax: line.syntax,
              semantic: {
                isValid: false,
                messages: [],
                errors: [initResult.error],
                symbolTable: context.symbolTable,
                context,
              },
            };
            pushLineResult(line, failed);
            pc += 1;
            continue;
          }

          runFrame = {
            type: "run",
            headerPc: pc,
            endPc: runEnd,
            conditionTokens: segments[1],
            stepTokens: segments[2],
            initMessage: initResult.message,
          };
          loopStack.push(runFrame);
        }

        const conditionResult = evaluateCondition(runFrame.conditionTokens, context.symbolTable, context.currentScope);
        if (!conditionResult.ok) {
          const failed = {
            lexer: line.lexer,
            syntax: line.syntax,
            semantic: {
              isValid: false,
              messages: [],
              errors: [conditionResult.error || "Failed to evaluate run condition"],
              symbolTable: context.symbolTable,
              context,
            },
          };
          pushLineResult(line, failed);
          pc += 1;
          continue;
        }

        if (conditionResult.value) {
          enterScope(context);
          const messages = runFrame.initMessage
            ? [runFrame.initMessage, "run condition is true"]
            : ["run condition is true"];
          runFrame.initMessage = null;
          pushLineResult(line, semanticPassResult(line, messages));
          pc += 1;
        } else {
          const loopIdx = loopStack.indexOf(runFrame);
          if (loopIdx !== -1) {
            loopStack.splice(loopIdx, 1);
          }
          pushLineResult(line, semanticPassResult(line, ["run condition is false, exiting loop"]));
          pc = runFrame.endPc + 1;
        }
        continue;
      }

      if (tokens[0]?.type === TOKEN_TYPES.RETURN_KEYWORD && callStack.length > 0) {
        const runtimeResult = await compile(line.code, context);
        context = runtimeResult.semantic.context;
        pushLineResult(line, runtimeResult);

        const frame = callStack.pop();
        exitScope(context);
        pc = frame.returnPc;
        continue;
      }

      if (
        tokens[0]?.type === TOKEN_TYPES.IDENTIFIER &&
        tokens[1]?.type === TOKEN_TYPES.PAREN_OPEN &&
        tokens[tokens.length - 1]?.type === TOKEN_TYPES.DELIMITER
      ) {
        const fnName = tokens[0].value;
        const fnMeta = functionMap.get(fnName);
        if (fnMeta) {
          callStack.push({ returnPc: pc + 1, endLine: fnMeta.endLine });
          enterScope(context);
          pushLineResult(line, semanticPassResult(line, [`Calling function '${fnName}'`]));
          pc = fnMeta.startLine + 1;
          continue;
        }
      }

      if (tokens[0]?.type === TOKEN_TYPES.SCOPE_END_KEYWORD && tokens.length === 1) {
        const ownerPc = reverseBlockMap.get(pc);
        const ownerTokens = typeof ownerPc === "number" ? program[ownerPc].tokens : [];
        const currentLoop = loopStack[loopStack.length - 1];
        const currentCall = callStack[callStack.length - 1];

        if (currentCall && currentCall.endLine === pc) {
          exitScope(context);
          pushLineResult(line, semanticPassResult(line, ["Function returned"]));
          callStack.pop();
          pc = currentCall.returnPc;
          continue;
        }

        if (currentLoop && currentLoop.endPc === pc && currentLoop.type === "walk") {
          exitScope(context);
          pushLineResult(line, semanticPassResult(line, ["walk iteration complete"]));
          pc = currentLoop.headerPc;
          continue;
        }

        if (currentLoop && currentLoop.endPc === pc && currentLoop.type === "run") {
          const stepResult = applyRunStep(currentLoop.stepTokens, context);
          if (stepResult.error) {
            const failed = {
              lexer: line.lexer,
              syntax: line.syntax,
              semantic: {
                isValid: false,
                messages: [],
                errors: [stepResult.error],
                symbolTable: context.symbolTable,
                context,
              },
            };
            pushLineResult(line, failed);
            pc += 1;
            continue;
          }
          exitScope(context);
          pushLineResult(line, semanticPassResult(line, ["run iteration complete"]));
          pc = currentLoop.headerPc;
          continue;
        }

        if (
          ownerTokens[0]?.type === TOKEN_TYPES.WAG_KEYWORD ||
          ownerTokens[0]?.type === TOKEN_TYPES.ELSE_KEYWORD ||
          ownerTokens[0]?.type === TOKEN_TYPES.CHASE_KEYWORD
        ) {
          exitScope(context);
          pushLineResult(line, semanticPassResult(line, ["Closed conditional block"]));
          pc += 1;
          continue;
        }

        exitScope(context);
        pushLineResult(line, semanticPassResult(line, ["Closed block"]));
        pc += 1;
        continue;
      }

      const runtimeResult = await compile(line.code, context);
      context = runtimeResult.semantic.context;
      pushLineResult(line, runtimeResult);
      pc += 1;
    }

    return { lines: results, finalSymbolTable: context.symbolHistory, outputValues, hasErrors };
  } finally {
    if (useRuntimeInputFallback) {
      inputHandler = previousInputHandler;
    }
  }
}

module.exports = { compileMultiLine, setInputHandler, resetInputState };
