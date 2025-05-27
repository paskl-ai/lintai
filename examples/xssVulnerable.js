// examples/xssVulnerable.js
// ❌ Direct innerHTML assignment leads to XSS
function displayContent(userInput) {
    const outputEl = document.getElementById("output");
    // If userInput = "<img src=x onerror=alert(1)>", this will pop the alert
    outputEl.innerHTML = userInput;
  }
  
  // Example call:
  displayContent(location.search.slice(1));
  