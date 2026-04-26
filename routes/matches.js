const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT m.*,
        t1.team_name AS team1_name, t1.short_name AS team1_short,
        t2.team_name AS team2_name, t2.short_name AS team2_short,
        mr.result_text, mr.winner_team_id,
        wt.team_name AS winner_name
      FROM matches m
      JOIN teams t1 ON m.team1_id = t1.team_id
      JOIN teams t2 ON m.team2_id = t2.team_id
      LEFT JOIN match_result mr ON m.match_id = mr.match_id
      LEFT JOIN teams wt ON mr.winner_team_id = wt.team_id
    `;
    const params = [];
    if (status) {
      query += " WHERE m.status = ?";
      params.push(status);
    }
    if (status === "scheduled") {
      query += " ORDER BY m.match_number ASC";
    } else {
      query += " ORDER BY m.match_date DESC, m.match_number ASC";
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const [[match]] = await pool.query(
      `SELECT m.*,
        t1.team_name AS team1_name, t1.short_name AS team1_short,
        t2.team_name AS team2_name, t2.short_name AS team2_short,
        mr.result_text, mr.winner_team_id, mr.player_of_match,
        p.player_name AS potm_name,
        wt.team_name AS winner_name,
        ts.toss_winner_team_id, ts.decision, ts.batting_first_team_id,
        tbf.team_name AS batting_first_name
      FROM matches m
      JOIN teams t1 ON m.team1_id = t1.team_id
      JOIN teams t2 ON m.team2_id = t2.team_id
      LEFT JOIN match_result mr ON m.match_id = mr.match_id
      LEFT JOIN teams wt ON mr.winner_team_id = wt.team_id
      LEFT JOIN players p ON mr.player_of_match = p.player_id
      LEFT JOIN toss ts ON m.match_id = ts.match_id
      LEFT JOIN teams tbf ON ts.batting_first_team_id = tbf.team_id
      WHERE m.match_id = ?`,
      [req.params.id]
    );
    res.json(match || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { match_number, team1_id, team2_id, match_date, match_time, venue } = req.body;
    const [result] = await pool.query(
      "INSERT INTO matches (match_number, team1_id, team2_id, match_date, match_time, venue) VALUES (?, ?, ?, ?, ?, ?)",
      [match_number, team1_id, team2_id, match_date, match_time, venue]
    );
    res.json({ success: true, match_id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query("UPDATE matches SET status = ? WHERE match_id = ?", [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const matchId = req.params.id;

    // Get match details
    const [[match]] = await conn.query("SELECT team1_id, team2_id FROM matches WHERE match_id = ?", [matchId]);
    if (!match) {
      await conn.rollback();
      return res.status(404).json({ error: "Match not found" });
    }

    // Determine team IDs
    const team1 = match.team1_id;
    const team2 = match.team2_id;

    // Get result if exists
    const [results] = await conn.query("SELECT * FROM match_result WHERE match_id = ?", [matchId]);
    if (results.length > 0) {
      const result = results[0];
      const winner = result.winner_team_id;

      const team2 = match.team2_id;

      // Delete related data
      await conn.query("DELETE FROM innings_batting WHERE innings_id IN (SELECT innings_id FROM innings WHERE match_id = ?)", [matchId]);
      await conn.query("DELETE FROM innings_bowling WHERE innings_id IN (SELECT innings_id FROM innings WHERE match_id = ?)", [matchId]);
      await conn.query("DELETE FROM innings_extras WHERE innings_id IN (SELECT innings_id FROM innings WHERE match_id = ?)", [matchId]);
      // Delete innings
      await conn.query("DELETE FROM innings WHERE match_id = ?", [matchId]);

      // Delete match_result
      await conn.query("DELETE FROM match_result WHERE match_id = ?", [matchId]);
    }

    // Delete other related data if any
    await conn.query("DELETE FROM toss WHERE match_id = ?", [matchId]);
    // Add other deletes if needed

    // Finally delete match
    await conn.query("DELETE FROM matches WHERE match_id = ?", [matchId]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;