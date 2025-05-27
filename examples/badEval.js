// examples/badEval.js
// ❌ Unsanitized eval() usage
function runUserCode(code) {
    // Dangerous: will execute arbitrary JS
    return eval(code);
  }
  
  const result = runUserCode("2 + 2");
  console.log("Result is", result);
  