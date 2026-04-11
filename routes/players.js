const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const { team_id } = req.query;
    let query = `SELECT p.*, t.short_name, t.team_name
                 FROM players p JOIN teams t ON p.team_id = t.team_id`;
    const params = [];
    if (team_id) {
      query += " WHERE p.team_id = ?";
      params.push(team_id);
    }
    query += " ORDER BY p.player_id";
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { player_name, team_id, role, batting_style, bowling_style } = req.body;

    const [[team]] = await pool.query(
      "SELECT short_name FROM teams WHERE team_id = ?",
      [team_id]
    );
    const prefix = team.short_name;

    const [existing] = await pool.query(
      "SELECT player_id FROM players WHERE player_id LIKE ? ORDER BY player_id DESC LIMIT 1",
      [`${prefix}%`]
    );

    let nextNum = 1;
    if (existing.length > 0) {
      const lastNum = parseInt(existing[0].player_id.replace(prefix, ""));
      nextNum = lastNum + 1;
    }

    const player_id = `${prefix}${String(nextNum).padStart(2, "0")}`;

    await pool.query(
      "INSERT INTO players (player_id, player_name, team_id, role, batting_style, bowling_style) VALUES (?, ?, ?, ?, ?, ?)",
      [player_id, player_name, team_id, role, batting_style || null, bowling_style || null]
    );

    res.json({ success: true, player_id, player_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:player_id", async (req, res) => {
  try {
    await pool.query("DELETE FROM players WHERE player_id = ?", [req.params.player_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;