const express = require("express");
const router = express.Router();
const db = require("../db");

// Orange cap — most runs
router.get("/orange-cap", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.player_id,
        p.player_name,
        t.team_name,
        t.short_name,
        SUM(bs.runs) AS total_runs,
        SUM(bs.fours) AS total_fours,
        SUM(bs.sixes) AS total_sixes,
        COUNT(DISTINCT i.match_id) AS matches_played,
        MAX(bs.runs) AS highest_score,
        ROUND(AVG(bs.runs), 2) AS batting_avg,
        ROUND(SUM(bs.runs) / NULLIF(SUM(bs.balls), 0) * 100, 2) AS strike_rate
      FROM batting_scorecard bs
      JOIN innings i ON bs.innings_id = i.innings_id
      JOIN players p ON bs.player_id = p.player_id
      JOIN teams t ON p.team_id = t.team_id
      GROUP BY p.player_id, p.player_name, t.team_name, t.short_name
      ORDER BY total_runs DESC, strike_rate DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Purple cap — most wickets
router.get("/purple-cap", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.player_id,
        p.player_name,
        t.team_name,
        t.short_name,
        SUM(bs.wickets) AS total_wickets,
        SUM(bs.overs) AS total_overs,
        SUM(bs.runs_conceded) AS runs_conceded,
        COUNT(DISTINCT i.match_id) AS matches_played,
        ROUND(SUM(bs.runs_conceded) / NULLIF(SUM(bs.overs), 0), 2) AS economy,
        ROUND(SUM(bs.runs_conceded) / NULLIF(SUM(bs.wickets), 0), 2) AS bowling_avg
      FROM bowling_scorecard bs
      JOIN innings i ON bs.innings_id = i.innings_id
      JOIN players p ON bs.player_id = p.player_id
      JOIN teams t ON p.team_id = t.team_id
      GROUP BY p.player_id, p.player_name, t.team_name, t.short_name
      ORDER BY total_wickets DESC, economy ASC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Hundreds list (from aggregated batting)
router.get("/hundreds", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.player_id,
        p.player_name,
        t.team_name,
        t.short_name,
        SUM(CASE WHEN bs.runs >= 100 THEN 1 ELSE 0 END) AS hundreds,
        SUM(bs.runs) AS total_runs
      FROM batting_scorecard bs
      JOIN innings i ON bs.innings_id = i.innings_id
      JOIN players p ON bs.player_id = p.player_id
      JOIN teams t ON p.team_id = t.team_id
      GROUP BY p.player_id, p.player_name, t.team_name, t.short_name
      HAVING hundreds > 0
      ORDER BY hundreds DESC, total_runs DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fifties list (from aggregated batting)
router.get("/fifties", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.player_id,
        p.player_name,
        t.team_name,
        t.short_name,
        COUNT(DISTINCT i.match_id) AS matches_played,
        SUM(CASE WHEN bs.runs BETWEEN 50 AND 99 THEN 1 ELSE 0 END) AS fifties,
        SUM(bs.runs) AS total_runs,
        ROUND(AVG(bs.runs), 2) AS batting_avg
      FROM batting_scorecard bs
      JOIN innings i ON bs.innings_id = i.innings_id
      JOIN players p ON bs.player_id = p.player_id
      JOIN teams t ON p.team_id = t.team_id
      GROUP BY p.player_id, p.player_name, t.team_name, t.short_name
      HAVING fifties > 0
      ORDER BY fifties DESC, total_runs DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Most sixes
router.get("/most-sixes", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.player_id,
        p.player_name,
        t.team_name,
        t.short_name,
        COUNT(DISTINCT i.match_id) AS matches_played,
        SUM(bs.sixes) AS total_sixes
      FROM batting_scorecard bs
      JOIN innings i ON bs.innings_id = i.innings_id
      JOIN players p ON bs.player_id = p.player_id
      JOIN teams t ON p.team_id = t.team_id
      GROUP BY p.player_id, p.player_name, t.team_name, t.short_name
      HAVING total_sixes > 0
      ORDER BY total_sixes DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Most fours
router.get("/most-fours", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.player_id,
        p.player_name,
        t.team_name,
        t.short_name,
        SUM(bs.fours) AS total_fours
      FROM batting_scorecard bs
      JOIN innings i ON bs.innings_id = i.innings_id
      JOIN players p ON bs.player_id = p.player_id
      JOIN teams t ON p.team_id = t.team_id
      GROUP BY p.player_id, p.player_name, t.team_name, t.short_name
      HAVING total_fours > 0
      ORDER BY total_fours DESC
      LIMIT 10
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// All players for dropdown in compare
router.get("/all-players", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        p.player_id, 
        p.player_name, 
        p.role, 
        t.team_name, 
        t.short_name
      FROM players p 
      JOIN teams t ON p.team_id = t.team_id
      ORDER BY t.short_name, p.player_name
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compare two players (aggregate from scorecards)
router.get("/compare", async (req, res) => {
  try {
    const { player1, player2 } = req.query;
    if (!player1 || !player2) {
      return res.status(400).json({ error: "Both player IDs required" });
    }

    const [rows] = await db.query(
      `
      SELECT
        p.player_id,
        p.player_name,
        p.role,
        p.batting_style,
        p.bowling_style,
        t.team_name,
        t.short_name,

        -- Batting aggregates
        COALESCE(bat.total_matches, 0)      AS bat_matches,
        COALESCE(bat.total_runs, 0)         AS total_runs,
        COALESCE(bat.total_fours, 0)        AS total_fours,
        COALESCE(bat.total_sixes, 0)        AS total_sixes,
        COALESCE(bat.fifties, 0)            AS fifties,
        COALESCE(bat.hundreds, 0)           AS hundreds,
        COALESCE(bat.highest_score, 0)      AS highest_score,
        COALESCE(bat.batting_avg, 0)        AS batting_avg,
        COALESCE(bat.strike_rate, 0)        AS strike_rate,

        -- Bowling aggregates
        COALESCE(bowl.total_matches, 0)     AS bowl_matches,
        COALESCE(bowl.total_wickets, 0)     AS total_wickets,
        COALESCE(bowl.total_overs, 0)       AS total_overs,
        COALESCE(bowl.runs_conceded, 0)     AS runs_conceded,
        COALESCE(bowl.economy, 0)           AS economy,
        COALESCE(bowl.bowling_avg, 0)       AS bowling_avg

      FROM players p
      JOIN teams t ON p.team_id = t.team_id

      LEFT JOIN (
        SELECT 
          bs.player_id,
          COUNT(DISTINCT i.match_id) AS total_matches,
          SUM(bs.runs) AS total_runs,
          SUM(bs.fours) AS total_fours,
          SUM(bs.sixes) AS total_sixes,
          SUM(CASE WHEN bs.runs BETWEEN 50 AND 99 THEN 1 ELSE 0 END) AS fifties,
          SUM(CASE WHEN bs.runs >= 100 THEN 1 ELSE 0 END) AS hundreds,
          MAX(bs.runs) AS highest_score,
          ROUND(AVG(bs.runs), 2) AS batting_avg,
          ROUND(SUM(bs.runs) / NULLIF(SUM(bs.balls), 0) * 100, 2) AS strike_rate
        FROM batting_scorecard bs
        JOIN innings i ON bs.innings_id = i.innings_id
        GROUP BY bs.player_id
      ) AS bat ON p.player_id = bat.player_id

      LEFT JOIN (
        SELECT 
          bs.player_id,
          COUNT(DISTINCT i.match_id) AS total_matches,
          SUM(bs.wickets) AS total_wickets,
          SUM(bs.overs) AS total_overs,
          SUM(bs.runs_conceded) AS runs_conceded,
          ROUND(SUM(bs.runs_conceded) / NULLIF(SUM(bs.overs), 0), 2) AS economy,
          ROUND(SUM(bs.runs_conceded) / NULLIF(SUM(bs.wickets), 0), 2) AS bowling_avg
        FROM bowling_scorecard bs
        JOIN innings i ON bs.innings_id = i.innings_id
        GROUP BY bs.player_id
      ) AS bowl ON p.player_id = bowl.player_id

      WHERE p.player_id IN (?, ?)
      `,
      [player1, player2]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Match-by-match batting stats for a player (for trend chart)
router.get("/player-matches/:playerId", async (req, res) => {
  try {
    const { playerId } = req.params;
    const [rows] = await db.query(
      `
      SELECT
        m.match_id,
        m.match_number,
        m.match_date,
        CONCAT(t1.short_name, ' vs ', t2.short_name) AS match_label,
        COALESCE(bs.runs, 0)   AS runs,
        COALESCE(bs.balls, 0)  AS balls,
        COALESCE(bs.fours, 0)  AS fours,
        COALESCE(bs.sixes, 0)  AS sixes,
        COALESCE(bw.wickets, 0) AS wickets
      FROM matches m
      JOIN teams t1 ON m.team1_id = t1.team_id
      JOIN teams t2 ON m.team2_id = t2.team_id
      LEFT JOIN innings i ON i.match_id = m.match_id
      LEFT JOIN batting_scorecard bs
        ON bs.innings_id = i.innings_id AND bs.player_id = ?
      LEFT JOIN bowling_scorecard bw
        ON bw.innings_id = i.innings_id AND bw.player_id = ?
      WHERE m.status = 'completed'
        AND (bs.player_id = ? OR bw.player_id = ?)
      GROUP BY m.match_id, m.match_number, m.match_date, match_label,
               bs.runs, bs.balls, bs.fours, bs.sixes, bw.wickets
      ORDER BY m.match_date ASC, m.match_number ASC
      `,
      [playerId, playerId, playerId, playerId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

