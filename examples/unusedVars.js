// examples/unusedVars.js
// ⚠️ Variable declared but never used
const secretKey = process.env.SECRET_KEY;  // should be used or removed

function greet(name) {
  console.log("Hello, " + name);
}

greet("LintAI");
