const pool = require("./db");

async function fixSchema() {
  try {
    console.log("Fixing quiz_attempts schema...");
    
    // Add points_earned column
    await pool.query(`
      ALTER TABLE quiz_attempts 
      ADD COLUMN points_earned INT AFTER is_correct
    `);
    
    console.log("Schema fixed successfully!");
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("Column already exists.");
      process.exit(0);
    }
    console.error("Schema fix failed:", err);
    process.exit(1);
  }
}

fixSchema();
