const express = require("express");
const router = express.Router();
const db = require("../db");

// -------------------- GET ALL INNINGS BY MATCH --------------------
router.get("/match/:matchId", async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);

    const [rows] = await db.query(
      `
      SELECT
        i.innings_id,
        i.match_id,
        i.innings_number,
        i.batting_team_id,
        i.bowling_team_id,
        i.total_runs,
        i.total_wickets,
        i.overs,
        i.extras,
        t1.team_name AS battingteamname,
        t2.team_name AS bowlingteamname
      FROM innings i
      LEFT JOIN teams t1 ON i.batting_team_id = t1.team_id
      LEFT JOIN teams t2 ON i.bowling_team_id = t2.team_id
      WHERE i.match_id = ?
      ORDER BY i.innings_number
      `,
      [matchId]
    );

    res.json(rows);
  } catch (error) {
    console.error("innings fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------- GET BATTING --------------------
router.get("/:inningsId/batting", async (req, res) => {
  try {
    const inningsId = Number(req.params.inningsId);

    const [[inn]] = await db.query(
      `SELECT match_id, batting_team_id FROM innings WHERE innings_id = ?`,
      [inningsId]
    );

    if (!inn) return res.status(404).json({ error: "Innings not found" });

    const [squad] = await db.query(
      `
      SELECT p.player_id, p.player_name
      FROM playing11 p11
      JOIN players p ON p11.player_id = p.player_id
      WHERE p11.match_id = ? AND p11.team_id = ?
      `,
      [inn.match_id, inn.batting_team_id]
    );

    const [bat] = await db.query(
      `
      SELECT
        bs.*,
        p.player_name,
        wp.player_name AS wicket_taker_name,
        fp.player_name AS fielder_name
      FROM batting_scorecard bs
      JOIN players p ON bs.player_id = p.player_id
      LEFT JOIN players wp ON bs.wicket_taker_player_id = wp.player_id
      LEFT JOIN players fp ON bs.fielder_player_id = fp.player_id
      WHERE bs.innings_id = ?
      ORDER BY bs.batting_order
      `,
      [inningsId]
    );

    const map = {};
    bat.forEach((b) => {
      map[b.player_id] = b;
    });

    const final = squad.map((p, i) => {
      return (
        map[p.player_id] || {
          player_id: p.player_id,
          player_name: p.player_name,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          dismissal_type: "did not bat",
          batting_order: 100 + i,
        }
      );
    });

    res.json(final);
  } catch (error) {
    console.error("batting error:", error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------- GET BOWLING --------------------
router.get("/:inningsId/bowling", async (req, res) => {
  try {
    const inningsId = Number(req.params.inningsId);

    const [rows] = await db.query(
      `
      SELECT
        bs.*,
        p.player_name
      FROM bowling_scorecard bs
      JOIN players p ON bs.player_id = p.player_id
      WHERE bs.innings_id = ?
      ORDER BY bs.overs DESC, bs.wickets DESC
      `,
      [inningsId]
    );

    res.json(rows);
  } catch (error) {
    console.error("bowling error:", error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------- SAVE INNINGS --------------------
router.post("/save", async (req, res) => {
  try {
    const {
      match_id,
      innings_number,
      batting_team_id,
      bowling_team_id,
      total_runs,
      total_wickets,
      overs,
      extras,
      batting,
      bowling,
    } = req.body;

    // Check if innings already exists
    const [existing] = await db.query(
      `SELECT innings_id FROM innings WHERE match_id = ? AND innings_number = ?`,
      [match_id, innings_number]
    );

    let innings_id;

    if (existing.length > 0) {
      innings_id = existing[0].innings_id;

      await db.query(
        `UPDATE innings SET
          batting_team_id = ?,
          bowling_team_id = ?,
          total_runs = ?,
          total_wickets = ?,
          overs = ?,
          extras = ?
         WHERE innings_id = ?`,
        [
          batting_team_id,
          bowling_team_id,
          total_runs,
          total_wickets,
          overs,
          extras,
          innings_id,
        ]
      );

      // Delete old scorecards
      await db.query(`DELETE FROM batting_scorecard WHERE innings_id = ?`, [innings_id]);
      await db.query(`DELETE FROM bowling_scorecard WHERE innings_id = ?`, [innings_id]);
    } else {
      const [ins] = await db.query(
        `INSERT INTO innings
        (match_id, innings_number, batting_team_id, bowling_team_id, total_runs, total_wickets, overs, extras)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          match_id,
          innings_number,
          batting_team_id,
          bowling_team_id,
          total_runs,
          total_wickets,
          overs,
          extras,
        ]
      );

      innings_id = ins.insertId;
    }

    // Insert batting
    for (const b of batting) {
      await db.query(
        `INSERT INTO batting_scorecard
        (innings_id, player_id, runs, balls, fours, sixes, dismissal_type,
         wicket_taker_player_id, fielder_player_id, batting_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          innings_id,
          b.player_id,
          b.runs,
          b.balls,
          b.fours,
          b.sixes,
          b.dismissal_type,
          b.wicket_taker_player_id,
          b.fielder_player_id,
          b.batting_order,
        ]
      );
    }

    // Insert bowling
    for (const b of bowling) {
      await db.query(
        `INSERT INTO bowling_scorecard
        (innings_id, player_id, overs, maidens, runs_conceded, wickets, wides, no_balls)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          innings_id,
          b.player_id,
          b.overs,
          b.maidens,
          b.runs_conceded,
          b.wickets,
          b.wides,
          b.no_balls,
        ]
      );
    }

    res.json({ message: "Innings saved successfully" });

  } catch (error) {
    console.error("save innings error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;