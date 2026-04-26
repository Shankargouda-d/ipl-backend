const express = require("express");
const router = express.Router();
const pool = require("../db");



// POST /vote — cast or update a fan vote
router.post("/vote", async (req, res) => {
  try {
    const { visitor_id, team_id } = req.body;
    if (!visitor_id || !team_id) {
      return res.status(400).json({ error: "visitor_id and team_id required" });
    }

    await pool.query(
      `INSERT INTO fan_votes (visitor_id, team_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE team_id = VALUES(team_id), voted_at = CURRENT_TIMESTAMP`,
      [visitor_id, team_id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /standings — fan count per team, sorted desc
router.get("/standings", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        t.team_id,
        t.team_name,
        t.short_name,
        COUNT(fv.id) AS fan_count
      FROM teams t
      LEFT JOIN fan_votes fv ON t.team_id = fv.team_id
      GROUP BY t.team_id, t.team_name, t.short_name
      ORDER BY fan_count DESC, t.team_name ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /my-vote/:visitorId — check if a visitor already voted
router.get("/my-vote/:visitorId", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT team_id FROM fan_votes WHERE visitor_id = ?",
      [req.params.visitorId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
