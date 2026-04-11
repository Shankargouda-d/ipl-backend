const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pt.*, t.team_name, t.short_name, t.logo_url
       FROM points_table pt
       JOIN teams t ON pt.team_id = t.team_id
       ORDER BY pt.points DESC, pt.nrr DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;