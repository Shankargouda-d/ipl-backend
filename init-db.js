const pool = require("./db");

async function initQuizTables() {
  try {
    console.log("Creating quiz tables...");
    
    // 1. quiz_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_users (
        visitor_id VARCHAR(255) PRIMARY KEY,
        nickname VARCHAR(50),
        total_points INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("- Created quiz_users");

    // 2. quiz_attempts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        visitor_id VARCHAR(255),
        question_id VARCHAR(255),
        is_correct BOOLEAN,
        points_earned INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (visitor_id) REFERENCES quiz_users(visitor_id) ON DELETE CASCADE,
        UNIQUE KEY unique_attempt (visitor_id, question_id)
      )
    `);
    console.log("- Created quiz_attempts");

    console.log("Quiz tables initialized successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Error creating quiz tables:", err);
    process.exit(1);
  }
}

initQuizTables();
