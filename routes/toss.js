const express = require("express");
const router = express.Router();
const pool = require("../db");

router.post("/", async (req, res) => {
  try {
    const { match_id, toss_winner_team_id, decision } = req.body;

    const [[match]] = await pool.query(
      "SELECT team1_id, team2_id FROM matches WHERE match_id = ?",
      [match_id]
    );

    let batting_first_team_id;
    if (decision === "bat") {
      batting_first_team_id = toss_winner_team_id;
    } else {
      batting_first_team_id =
        parseInt(toss_winner_team_id) === match.team1_id
          ? match.team2_id
          : match.team1_id;
    }

    await pool.query(
      `INSERT INTO toss (match_id, toss_winner_team_id, decision, batting_first_team_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         toss_winner_team_id = VALUES(toss_winner_team_id),
         decision = VALUES(decision),
         batting_first_team_id = VALUES(batting_first_team_id)`,
      [match_id, toss_winner_team_id, decision, batting_first_team_id]
    );

    await pool.query(
      "UPDATE matches SET status = 'live' WHERE match_id = ?",
      [match_id]
    );

    res.json({ success: true, batting_first_team_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:match_id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, tw.team_name AS toss_winner_name, tb.team_name AS batting_first_name
       FROM toss t
       JOIN teams tw ON t.toss_winner_team_id = tw.team_id
       JOIN teams tb ON t.batting_first_team_id = tb.team_id
       WHERE t.match_id = ?`,
      [req.params.match_id]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;