const express = require("express");
const router = express.Router();
const scorecardService = require("../services/scorecardService");
const db = require("../db");

// -------------------- SAVE FULL INNINGS --------------------
router.post("/save", async (req, res) => {
  try {
    const result = await scorecardService.saveInnings(req.body);
    res.json(result);
  } catch (error) {
    console.error("saveInnings error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================================
// IMPORTANT: KEEP THIS ROUTE FIRST (avoid conflicts)
// ==========================================================

// -------------------- GET ALL INNINGS BY MATCH --------------------
router.get("/match/:matchId", async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);

    if (isNaN(matchId)) {
      return res.status(400).json({ error: "Invalid matchId" });
    }

    const rows = await db.query(
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
        t1.teamname AS battingteamname,
        t2.teamname AS bowlingteamname
      FROM innings i
      LEFT JOIN teams t1 ON i.batting_team_id = t1.teamid
      LEFT JOIN teams t2 ON i.bowling_team_id = t2.teamid
      WHERE i.match_id = ?
      ORDER BY i.innings_number
      `,
      [matchId]
    );

    const formatted = (rows || []).map((row) => ({
      innings_id: row.innings_id,
      match_id: row.match_id,
      innings_number: row.innings_number,
      batting_team_id: row.batting_team_id,
      bowling_team_id: row.bowling_team_id,
      total_runs: row.total_runs,
      total_wickets: row.total_wickets,
      overs: row.overs,
      extras: row.extras,
      batting_team_name: row.battingteamname,
      bowling_team_name: row.bowlingteamname,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("innings fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------- GET BATTING BY INNINGS --------------------
router.get("/:inningsId/batting", async (req, res) => {
  try {
    const inningsId = Number(req.params.inningsId);

    if (isNaN(inningsId)) {
      return res.status(400).json({ error: "Invalid inningsId" });
    }

    // 1) innings info
    const inningsRows = await db.query(
      `
      SELECT innings_id, match_id, batting_team_id
      FROM innings
      WHERE innings_id = ?
      `,
      [inningsId]
    );

    if (!inningsRows.length) {
      return res.status(404).json({ error: "Innings not found" });
    }

    const { match_id, batting_team_id } = inningsRows[0];

    // 2) playing 11
    const squadRows = await db.query(
      `
      SELECT p11.playerid, p.playername
      FROM playing11 p11
      JOIN players p ON p11.playerid = p.playerid
      WHERE p11.matchid = ? AND p11.teamid = ?
      ORDER BY p.playername
      `,
      [match_id, batting_team_id]
    );

    // 3) batting scorecard
    const batRows = await db.query(
      `
      SELECT
        bs.id,
        bs.innings_id,
        bs.player_id,
        p.playername,
        bs.runs,
        bs.balls,
        bs.fours,
        bs.sixes,
        bs.dismissal_type,
        bs.wicket_taker_player_id,
        wp.playername AS wicket_taker_name,
        bs.fielder_player_id,
        fp.playername AS fielder_name,
        bs.batting_order
      FROM batting_scorecard bs
      JOIN players p ON bs.player_id = p.playerid
      LEFT JOIN players wp ON bs.wicket_taker_player_id = wp.playerid
      LEFT JOIN players fp ON bs.fielder_player_id = fp.playerid
      WHERE bs.innings_id = ?
      ORDER BY bs.batting_order
      `,
      [inningsId]
    );

    const batMap = {};
    batRows.forEach((row) => {
      batMap[String(row.player_id)] = {
        id: row.id,
        innings_id: row.innings_id,
        player_id: row.player_id,
        player_name: row.playername,
        runs: row.runs,
        balls: row.balls,
        fours: row.fours,
        sixes: row.sixes,
        dismissal_type: row.dismissal_type,
        wicket_taker_player_id: row.wicket_taker_player_id,
        wicket_taker_name: row.wicket_taker_name,
        fielder_player_id: row.fielder_player_id,
        fielder_name: row.fielder_name,
        batting_order: row.batting_order,
      };
    });

    // merge DNB players
    const finalRows = (squadRows || []).map((player, index) => {
      const key = String(player.playerid);

      if (batMap[key]) return batMap[key];

      return {
        id: `dnb-${inningsId}-${player.playerid}`,
        innings_id: inningsId,
        player_id: player.playerid,
        player_name: player.playername,
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

    finalRows.sort(
      (a, b) => (a.batting_order ?? 999) - (b.batting_order ?? 999)
    );

    res.json(finalRows);
  } catch (error) {
    console.error("batting fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// -------------------- GET BOWLING BY INNINGS --------------------
router.get("/:inningsId/bowling", async (req, res) => {
  try {
    const inningsId = Number(req.params.inningsId);

    if (isNaN(inningsId)) {
      return res.status(400).json({ error: "Invalid inningsId" });
    }

    const rows = await db.query(
      `
      SELECT
        bs.id,
        bs.innings_id,
        bs.player_id,
        p.playername,
        bs.overs,
        bs.maidens,
        bs.runs_conceded,
        bs.wickets,
        bs.wides,
        bs.no_balls
      FROM bowling_scorecard bs
      JOIN players p ON bs.player_id = p.playerid
      WHERE bs.innings_id = ?
      ORDER BY bs.overs DESC, bs.wickets DESC, bs.runs_conceded ASC
      `,
      [inningsId]
    );

    const formatted = (rows || []).map((row) => ({
      id: row.id,
      innings_id: row.innings_id,
      player_id: row.player_id,
      player_name: row.playername,
      overs: row.overs,
      maidens: row.maidens,
      runs_conceded: row.runs_conceded,
      wickets: row.wickets,
      wides: row.wides,
      no_balls: row.no_balls,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("bowling fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;