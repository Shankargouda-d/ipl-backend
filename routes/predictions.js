const express = require("express");
const router = express.Router();
const pool = require("../db");

// Get predictions for a match
router.get("/:match_id", async (req, res) => {
  try {
    const { match_id } = req.params;
    
    // Count votes grouped by team_id
    const [rows] = await pool.query(
      `SELECT team_id, COUNT(*) as votes 
       FROM match_predictions 
       WHERE match_id = ? 
       GROUP BY team_id`,
      [match_id]
    );

    const results = {};
    let totalVotes = 0;

    rows.forEach(row => {
      results[row.team_id] = row.votes;
      totalVotes += row.votes;
    });

    res.json({
      total_votes: totalVotes,
      votes: results
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new prediction
router.post("/", async (req, res) => {
  try {
    const { match_id, team_id } = req.body;
    
    if (!match_id || !team_id) {
      return res.status(400).json({ error: "match_id and team_id are required" });
    }

    await pool.query(
      "INSERT INTO match_predictions (match_id, team_id) VALUES (?, ?)",
      [match_id, team_id]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
