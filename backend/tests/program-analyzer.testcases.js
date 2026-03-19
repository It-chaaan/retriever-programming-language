const { compileMultiLine } = require("../src/compiler-engine");

function stageStatus(hasErrors, goodMsg, badMsg) {
  return hasErrors ? badMsg : goodMsg;
}

function findLogicalErrors(code) {
  const logicalErrors = [];

  const lines = code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    // Heuristic 1: obvious division by zero in source text.
    if (/\/\s*0(?![\d.])/.test(line)) {
      logicalErrors.push(`Line ${lineNo}: possible division by zero`);
    }

    // Heuristic 2: trivial constant-only conditions like wag ( 1 > 2 ) {
    const conditionMatch = line.match(/^(wag|chase)\s*\(([^)]*)\)\s*\{$/);
    if (conditionMatch) {
      const cond = conditionMatch[2].trim();
      if (/^\d+(\.\d+)?\s*(==|!=|>=|<=|>|<)\s*\d+(\.\d+)?$/.test(cond)) {
        logicalErrors.push(`Line ${lineNo}: constant-only condition may indicate logic bug`);
      }
    }
  });

  return logicalErrors;
}

const testCases = [
  {
    id: "TC-01",
    name: "Basic program using custom syntax",
    category: "success",
    code: `bone number := 10 !
bone total := number + 5 !
arf "Total is: " + total !`,
    expected: { lexer: true, parser: true, semantic: true, logical: true },
  },
  {
    id: "TC-02",
    name: "Program prints output and takes input",
    category: "success",
    code: `fur username := "guest" !
sniff username !
arf "Hello, " + username !`,
    input: { username: "Buddy" },
    expected: { lexer: true, parser: true, semantic: true, logical: true },
  },
  {
    id: "TC-03",
    name: "Different scope with proper indentation",
    category: "success",
    code: `bone x := 5 !
sit ( x > 3 ) {
  bone y := x + 2 !
  arf "Inner: " + y !
}
arf "Outer: " + x !`,
    expected: { lexer: true, parser: true, semantic: true, logical: true },
  },
  {
    id: "TC-04",
    name: "If-else logic program",
    category: "success",
    code: `bone score := 85 !
sit ( score >= 75 ) {
  arf "Pass" !
} stay {
  arf "Fail" !
}`,
    expected: { lexer: true, parser: true, semantic: true, logical: true },
  },
  {
    id: "TC-05",
    name: "Lexical error program",
    category: "error",
    code: `bone bad := 5 @ !`,
    expected: { lexer: false, parser: true, semantic: false, logical: true },
  },
  {
    id: "TC-06",
    name: "Syntactical error program",
    category: "error",
    code: `bone value = 10 !`,
    expected: { lexer: true, parser: false, semantic: true, logical: true },
  },
  {
    id: "TC-07",
    name: "Semantic error program",
    category: "error",
    code: `bone total := missingVar + 1 !`,
    expected: { lexer: true, parser: true, semantic: false, logical: true },
  },
  {
    id: "TC-08",
    name: "Logical error program",
    category: "error",
    code: `bone n := 10 !
  bone result := n / 0 !
arf result !`,
    expected: { lexer: true, parser: true, semantic: false, logical: false },
  },
  {
    id: "TC-09",
    name: "Sample analyzer case (semantic fail only)",
    category: "error",
    code: `bone good := 7 !
  fur textVal := "dog" !
  bone computed := textVal + 1 !`,
    expected: { lexer: true, parser: true, semantic: false, logical: true },
  },
];

function summarizeCase(result, code) {
  const hasLexicalErrors = result.lines.some((line) => line.result.lexer.errors.length > 0);
  const hasParserErrors = result.lines.some((line) => line.result.syntax.errors.length > 0);
  const hasSemanticErrors = result.lines.some((line) => line.result.semantic.errors.length > 0);
  const logicalErrors = findLogicalErrors(code);
  const hasLogicalErrors = logicalErrors.length > 0;

  return {
    lexer: !hasLexicalErrors,
    parser: !hasParserErrors,
    semantic: !hasSemanticErrors,
    logical: !hasLogicalErrors,
    logicalErrors,
  };
}

function printAnalyzerMessages(summary) {
  console.log(
    `1. Lexer says: ${stageStatus(
      !summary.lexer,
      "GoodDog: All tokens are valid, no lexical error found.",
      "BadDogError: Lexical error found. Compilation failed."
    )}`
  );
  console.log(
    `2. Parser says: ${stageStatus(
      !summary.parser,
      "GoodDog: The program structure is valid.",
      "BadDogError: Syntax error found. Compilation failed."
    )}`
  );
  console.log(
    `3. Semantic Analyzer says: ${stageStatus(
      !summary.semantic,
      "GoodDog: No semantic error found.",
      "BadDogError: Semantic error found. Compilation failed."
    )}`
  );
  console.log(
    `4. Logical Analyzer says: ${stageStatus(
      !summary.logical,
      "GoodDog: No logical error found.",
      "BadDogError: Logical error found. Review program logic."
    )}`
  );
}

function run() {
  let passCount = 0;

  console.log("Program Analyzer Test Cases\n");

  testCases.forEach((testCase) => {
    const compiled = compileMultiLine(testCase.code, testCase.input || {});
    const summary = summarizeCase(compiled, testCase.code);

    const matched =
      summary.lexer === testCase.expected.lexer &&
      summary.parser === testCase.expected.parser &&
      summary.semantic === testCase.expected.semantic &&
      summary.logical === testCase.expected.logical;

    if (matched) passCount += 1;

    console.log(`[${testCase.id}] ${testCase.name}`);
    printAnalyzerMessages(summary);

    if (summary.logicalErrors.length > 0) {
      console.log("Logical details:");
      summary.logicalErrors.forEach((err) => console.log(`- ${err}`));
    }

    if (!matched) {
      console.log("Expected:", testCase.expected);
      console.log("Actual:", {
        lexer: summary.lexer,
        parser: summary.parser,
        semantic: summary.semantic,
        logical: summary.logical,
      });
    }

    console.log(`Result: ${matched ? "PASS" : "FAIL"}\n`);
  });

  console.log(`Summary: ${passCount}/${testCases.length} test cases passed.`);

  if (passCount !== testCases.length) {
    process.exitCode = 1;
  }
}

run();