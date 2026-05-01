const pool = require("./db");

async function updateSchema() {
  try {
    console.log("Updating quiz_attempts schema...");
    
    await pool.query(`
      ALTER TABLE quiz_attempts 
      ADD COLUMN selected_option VARCHAR(255) AFTER question_id
    `);
    
    console.log("Schema updated successfully!");
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log("Column already exists.");
      process.exit(0);
    }
    console.error("Schema update failed:", err);
    process.exit(1);
  }
}

updateSchema();
