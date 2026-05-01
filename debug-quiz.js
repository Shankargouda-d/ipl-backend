const pool = require("./db");

async function debugQuiz() {
  try {
    const [users] = await pool.query("SELECT * FROM quiz_users");
    const [attempts] = await pool.query("SELECT * FROM quiz_attempts");
    
    console.log("--- QUIZ USERS ---");
    console.table(users);
    
    console.log("\n--- QUIZ ATTEMPTS ---");
    console.table(attempts);
    
    process.exit(0);
  } catch (err) {
    console.error("Debug failed:", err);
    process.exit(1);
  }
}

debugQuiz();
