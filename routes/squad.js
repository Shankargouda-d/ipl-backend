const express = require("express");
const router = express.Router();
const db = require("../db");

// POST /api/squad — save playing 11 for a match
router.post("/", async (req, res) => {
  try {
    const { match_id, team_id, players } = req.body;
    // players = [{ player_id, is_impact_player }]

    // Delete existing squad for this match+team before re-saving
    await db.query(
      "DELETE FROM playing_11 WHERE match_id = ? AND team_id = ?",
      [match_id, team_id]
    );

    for (const player of players) {
      await db.query(
        `INSERT INTO playing_11 (match_id, player_id, team_id, is_impact_player)
         VALUES (?, ?, ?, ?)`,
        [match_id, player.player_id, team_id, player.is_impact_player || false]
      );
    }

    res.json({ message: "Squad saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save squad" });
  }
});

// GET /api/squad/:matchId/:teamId — get playing 11 for a match+team
router.get("/:matchId/:teamId", async (req, res) => {
  try {
    const { matchId, teamId } = req.params;
    const [rows] = await db.query(
      `SELECT p.player_id, p.player_name, p.role, pl.is_impact_player
       FROM playing_11 pl
       JOIN players p ON pl.player_id = p.player_id
       WHERE pl.match_id = ? AND pl.team_id = ?`,
      [matchId, teamId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch squad" });
  }
});

module.exports = router;