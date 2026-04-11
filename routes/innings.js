const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/:match_id", async (req, res) => {
  try {
    const [innings] = await pool.query(
      `SELECT i.*, bt.team_name AS batting_team_name, bt.short_name AS batting_short,
              blt.team_name AS bowling_team_name
       FROM innings i
       JOIN teams bt ON i.batting_team_id = bt.team_id
       JOIN teams blt ON i.bowling_team_id = blt.team_id
       WHERE i.match_id = ?
       ORDER BY i.innings_number`,
      [req.params.match_id]
    );

    for (const inn of innings) {
      const [batting] = await pool.query(
        `SELECT bs.*, p.player_name
         FROM batting_scorecard bs
         JOIN players p ON bs.player_id = p.player_id
         WHERE bs.innings_id = ?
         ORDER BY bs.batting_order`,
        [inn.innings_id]
      );
      const [bowling] = await pool.query(
        `SELECT bw.*, p.player_name
         FROM bowling_scorecard bw
         JOIN players p ON bw.player_id = p.player_id
         WHERE bw.innings_id = ?`,
        [inn.innings_id]
      );
      const [extras] = await pool.query(
        "SELECT * FROM extras WHERE match_id = ? AND innings_number = ?",
        [req.params.match_id, inn.innings_number]
      );
      inn.batting = batting;
      inn.bowling = bowling;
      inn.extrasDetail = extras[0] || null;
    }

    res.json(innings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/create", async (req, res) => {
  try {
    const {
      match_id, innings_number, batting_team_id,
      bowling_team_id, total_runs, total_wickets, overs, extras
    } = req.body;

    const [existing] = await pool.query(
      "SELECT innings_id FROM innings WHERE match_id = ? AND innings_number = ?",
      [match_id, innings_number]
    );

    let innings_id;
    if (existing.length > 0) {
      innings_id = existing[0].innings_id;
      await pool.query(
        `UPDATE innings SET total_runs=?, total_wickets=?, overs=?, extras=?
         WHERE innings_id=?`,
        [total_runs, total_wickets, overs, extras, innings_id]
      );
    } else {
      const [result] = await pool.query(
        `INSERT INTO innings (match_id, innings_number, batting_team_id, bowling_team_id,
          total_runs, total_wickets, overs, extras)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [match_id, innings_number, batting_team_id, bowling_team_id,
         total_runs, total_wickets, overs, extras]
      );
      innings_id = result.insertId;
    }

    res.json({ success: true, innings_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/batting", async (req, res) => {
  try {
    const { innings_id, batting } = req.body;

    await pool.query("DELETE FROM batting_scorecard WHERE innings_id = ?", [innings_id]);

    for (const b of batting) {
      const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(2) : 0;
      await pool.query(
        `INSERT INTO batting_scorecard
          (innings_id, player_id, runs, balls, fours, sixes, strike_rate, dismissal_type, batting_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [innings_id, b.player_id, b.runs, b.balls, b.fours, b.sixes,
         sr, b.dismissal_type || "not out", b.batting_order]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bowling", async (req, res) => {
  try {
    const { innings_id, bowling } = req.body;

    await pool.query("DELETE FROM bowling_scorecard WHERE innings_id = ?", [innings_id]);

    for (const b of bowling) {
      const eco = b.overs > 0 ? (b.runs_conceded / b.overs).toFixed(2) : 0;
      await pool.query(
        `INSERT INTO bowling_scorecard
          (innings_id, player_id, overs, maidens, runs_conceded, wickets, economy, wides, no_balls)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [innings_id, b.player_id, b.overs, b.maidens || 0,
         b.runs_conceded, b.wickets, eco, b.wides || 0, b.no_balls || 0]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/extras", async (req, res) => {
  try {
    const { match_id, innings_number, wides, no_balls, byes, leg_byes } = req.body;
    const total = (wides || 0) + (no_balls || 0) + (byes || 0) + (leg_byes || 0);

    await pool.query(
      `INSERT INTO extras (match_id, innings_number, wides, no_balls, byes, leg_byes, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         wides=VALUES(wides), no_balls=VALUES(no_balls),
         byes=VALUES(byes), leg_byes=VALUES(leg_byes), total=VALUES(total)`,
      [match_id, innings_number, wides || 0, no_balls || 0, byes || 0, leg_byes || 0, total]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;