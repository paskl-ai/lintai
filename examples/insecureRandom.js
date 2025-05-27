// examples/insecureRandom.js
// ❌ Using Math.random() for token generation is cryptographically insecure
function generateToken() {
    // Predictable entropy — don’t use for auth tokens!
    return Math.random().toString(36).substr(2);
  }
  
  console.log("Your token:", generateToken());
  