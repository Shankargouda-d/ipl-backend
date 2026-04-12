const express = require("express");
const router = express.Router();
const scorecardService = require("../services/scorecardService");
const db = require("../db");

// Save full innings (batting + bowling together)
router.post("/save", async (req, res) => {
  try {
    const result = await scorecardService.saveInnings(req.body);
    res.json(result);
  } catch (error) {
    console.error("saveInnings error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all innings for a match
router.get("/:matchId", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.*,
              t1.team_name AS batting_team_name,
              t2.team_name AS bowling_team_name
       FROM innings i
       LEFT JOIN teams t1 ON i.batting_team_id = t1.team_id
       LEFT JOIN teams t2 ON i.bowling_team_id = t2.team_id
       WHERE i.match_id = ?
       ORDER BY i.innings_number`,
      [req.params.matchId]
    );
    res.json(rows);
  } catch (error) {
    console.error("innings fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get batting scorecard for an innings
// Includes wicket taker and fielder names
// Also includes players who did not bat
router.get("/:inningsId/batting", async (req, res) => {
  try {
    const inningsId = req.params.inningsId;

    // Get innings info first
    const [inningsRows] = await db.query(
      `SELECT innings_id, match_id, batting_team_id
       FROM innings
       WHERE innings_id = ?`,
      [inningsId]
    );

    if (inningsRows.length === 0) {
      return res.status(404).json({ error: "Innings not found" });
    }

    const { match_id, batting_team_id } = inningsRows[0];

    // Get full batting team squad for that match
    // This assumes your squad table is named 'squad'
    // and has columns: match_id, team_id, player_id
    const [squadRows] = await db.query(
      `SELECT
         s.player_id,
         p.player_name
       FROM squad s
       JOIN players p ON s.player_id = p.player_id
       WHERE s.match_id = ? AND s.team_id = ?
       ORDER BY p.player_name`,
      [match_id, batting_team_id]
    );

    // Get saved batting rows
    const [batRows] = await db.query(
      `SELECT
         bs.*,
         p.player_name,
         wp.player_name AS wicket_taker_name,
         fp.player_name AS fielder_name
       FROM batting_scorecard bs
       JOIN players p ON bs.player_id = p.player_id
       LEFT JOIN players wp ON bs.wicket_taker_player_id = wp.player_id
       LEFT JOIN players fp ON bs.fielder_player_id = fp.player_id
       WHERE bs.innings_id = ?
       ORDER BY bs.batting_order`,
      [inningsId]
    );

    // Map existing batting rows by player_id
    const batMap = {};
    batRows.forEach((row) => {
      batMap[row.player_id] = row;
    });

    // Merge squad with batting rows
    const finalRows = squadRows.map((player, index) => {
      if (batMap[player.player_id]) {
        return batMap[player.player_id];
      }

      return {
        id: `dnb-${inningsId}-${player.player_id}`,
        innings_id: Number(inningsId),
        player_id: player.player_id,
        player_name: player.player_name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        dismissal_type: "did not bat",
        wicket_taker_player_id: null,
        wicket_taker_name: null,
        fielder_player_id: null,
        fielder_name: null,
        batting_order: 100 + index,
      };
    });

    // Sort actual batting rows first, did-not-bat after them
    finalRows.sort((a, b) => (a.batting_order || 999) - (b.batting_order || 999));

    res.json(finalRows);
  } catch (error) {
    console.error("batting fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get bowling scorecard for an innings
router.get("/:inningsId/bowling", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT bs.*, p.player_name
       FROM bowling_scorecard bs
       JOIN players p ON bs.player_id = p.player_id
       WHERE bs.innings_id = ?
       ORDER BY bs.overs DESC, bs.wickets DESC, bs.runs_conceded ASC`,
      [req.params.inningsId]
    );
    res.json(rows);
  } catch (error) {
    console.error("bowling fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;