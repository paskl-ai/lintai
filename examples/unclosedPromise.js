// examples/unclosedPromise.js
// ❌ Missing catch() on Promise chain
function fetchData(url) {
    return fetch(url)
      .then((res) => res.json()  // Syntax error: unclosed parenthesis
      // No .catch() to handle network/JSON errors
  }
  
  fetchData("/api/data")
    .then(data => console.log(data));
  