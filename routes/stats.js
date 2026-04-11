const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/orange-cap", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bs.*, p.player_name, p.role, t.team_name, t.short_name
       FROM batting_stats bs
       JOIN players p ON bs.player_id = p.player_id
       JOIN teams t ON p.team_id = t.team_id
       WHERE bs.matches_played > 0
       ORDER BY bs.total_runs DESC, bs.strike_rate DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/purple-cap", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bw.*, p.player_name, p.role, t.team_name, t.short_name
       FROM bowling_stats bw
       JOIN players p ON bw.player_id = p.player_id
       JOIN teams t ON p.team_id = t.team_id
       WHERE bw.matches_played > 0
       ORDER BY bw.total_wickets DESC, bw.economy ASC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/hundreds", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bs.*, p.player_name, p.role, t.team_name, t.short_name
       FROM batting_stats bs
       JOIN players p ON bs.player_id = p.player_id
       JOIN teams t ON p.team_id = t.team_id
       WHERE bs.hundreds > 0
       ORDER BY bs.hundreds DESC, bs.total_runs DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/fifties", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bs.*, p.player_name, p.role, t.team_name, t.short_name
       FROM batting_stats bs
       JOIN players p ON bs.player_id = p.player_id
       JOIN teams t ON p.team_id = t.team_id
       WHERE bs.fifties > 0
       ORDER BY bs.fifties DESC, bs.total_runs DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/most-sixes", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bs.*, p.player_name, p.role, t.team_name, t.short_name
       FROM batting_stats bs
       JOIN players p ON bs.player_id = p.player_id
       JOIN teams t ON p.team_id = t.team_id
       WHERE bs.total_sixes > 0
       ORDER BY bs.total_sixes DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/most-fours", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bs.*, p.player_name, p.role, t.team_name, t.short_name
       FROM batting_stats bs
       JOIN players p ON bs.player_id = p.player_id
       JOIN teams t ON p.team_id = t.team_id
       WHERE bs.total_fours > 0
       ORDER BY bs.total_fours DESC
       LIMIT 10`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All players for dropdown in compare
router.get("/all-players", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.player_id, p.player_name, p.role, t.team_name, t.short_name
       FROM players p JOIN teams t ON p.team_id = t.team_id
       ORDER BY t.short_name, p.player_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compare two players
router.get("/compare", async (req, res) => {
  try {
    const { player1, player2 } = req.query;
    if (!player1 || !player2) {
      return res.status(400).json({ error: "Both player IDs required" });
    }
    const [rows] = await pool.query(
      `SELECT
         p.player_id, p.player_name, p.role, p.batting_style, p.bowling_style,
         t.team_name, t.short_name,
         COALESCE(bs.matches_played, 0)  AS bat_matches,
         COALESCE(bs.total_runs, 0)      AS total_runs,
         COALESCE(bs.total_fours, 0)     AS total_fours,
         COALESCE(bs.total_sixes, 0)     AS total_sixes,
         COALESCE(bs.fifties, 0)         AS fifties,
         COALESCE(bs.hundreds, 0)        AS hundreds,
         COALESCE(bs.highest_score, 0)   AS highest_score,
         COALESCE(bs.batting_avg, 0)     AS batting_avg,
         COALESCE(bs.strike_rate, 0)     AS strike_rate,
         COALESCE(bw.matches_played, 0)  AS bowl_matches,
         COALESCE(bw.total_wickets, 0)   AS total_wickets,
         COALESCE(bw.total_overs, 0)     AS total_overs,
         COALESCE(bw.runs_conceded, 0)   AS runs_conceded,
         COALESCE(bw.economy, 0)         AS economy,
         COALESCE(bw.bowling_avg, 0)     AS bowling_avg
       FROM players p
       JOIN teams t ON p.team_id = t.team_id
       LEFT JOIN batting_stats bs ON p.player_id = bs.player_id
       LEFT JOIN bowling_stats bw ON p.player_id = bw.player_id
       WHERE p.player_id IN (?, ?)`,
      [player1, player2]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;