const express = require("express");
const router = express.Router();
const scorecardService = require("../services/scorecardService");
const db = require("../db");

// Save full innings batting bowling together
router.post("/save", async (req, res) => {
  try {
    const result = await scorecardService.saveInnings(req.body);
    res.json(result);
  } catch (error) {
    console.error("saveInnings error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get batting scorecard for an innings
// Includes wicket taker / fielder names and also players who did not bat
router.get("/:inningsId/batting", async (req, res) => {
  try {
    const inningsId = Number(req.params.inningsId);

    const inningsRows = await db.query(
      `
      SELECT inningsid, matchid, battingteamid
      FROM innings
      WHERE inningsid = ?
      `,
      [inningsId]
    );

    if (!inningsRows.length) {
      return res.status(404).json({ error: "Innings not found" });
    }

    const { matchid, battingteamid } = inningsRows[0];

    const squadRows = await db.query(
      `
      SELECT p11.playerid, p.playername
      FROM playing11 p11
      JOIN players p ON p11.playerid = p.playerid
      WHERE p11.matchid = ? AND p11.teamid = ?
      ORDER BY p.playername
      `,
      [matchid, battingteamid]
    );

    const batRows = await db.query(
      `
      SELECT
        bs.id,
        bs.inningsid,
        bs.playerid,
        p.playername,
        bs.runs,
        bs.balls,
        bs.fours,
        bs.sixes,
        bs.dismissaltype,
        bs.wickettakerplayerid,
        wp.playername AS wickettakername,
        bs.fielderplayerid,
        fp.playername AS fieldername,
        bs.battingorder
      FROM battingscorecard bs
      JOIN players p ON bs.playerid = p.playerid
      LEFT JOIN players wp ON bs.wickettakerplayerid = wp.playerid
      LEFT JOIN players fp ON bs.fielderplayerid = fp.playerid
      WHERE bs.inningsid = ?
      ORDER BY bs.battingorder
      `,
      [inningsId]
    );

    const batMap = {};
    batRows.forEach((row) => {
      batMap[String(row.playerid)] = {
        id: row.id,
        innings_id: row.inningsid,
        player_id: row.playerid,
        player_name: row.playername,
        runs: row.runs,
        balls: row.balls,
        fours: row.fours,
        sixes: row.sixes,
        dismissal_type: row.dismissaltype,
        wicket_taker_player_id: row.wickettakerplayerid,
        wicket_taker_name: row.wickettakername,
        fielder_player_id: row.fielderplayerid,
        fielder_name: row.fieldername,
        batting_order: row.battingorder,
      };
    });

    const finalRows = squadRows.map((player, index) => {
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

    finalRows.sort((a, b) => (a.batting_order ?? 999) - (b.batting_order ?? 999));

    res.json(finalRows);
  } catch (error) {
    console.error("batting fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get bowling scorecard for an innings
router.get("/:inningsId/bowling", async (req, res) => {
  try {
    const inningsId = Number(req.params.inningsId);

    const rows = await db.query(
      `
      SELECT
        bs.id,
        bs.inningsid,
        bs.playerid,
        p.playername,
        bs.overs,
        bs.maidens,
        bs.runsconceded,
        bs.wickets,
        bs.wides,
        bs.noballs
      FROM bowlingscorecard bs
      JOIN players p ON bs.playerid = p.playerid
      WHERE bs.inningsid = ?
      ORDER BY bs.overs DESC, bs.wickets DESC, bs.runsconceded ASC
      `,
      [inningsId]
    );

    const formatted = rows.map((row) => ({
      id: row.id,
      innings_id: row.inningsid,
      player_id: row.playerid,
      player_name: row.playername,
      overs: row.overs,
      maidens: row.maidens,
      runs_conceded: row.runsconceded,
      wickets: row.wickets,
      wides: row.wides,
      no_balls: row.noballs,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("bowling fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all innings for a match
router.get("/match/:matchId", async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);

    const rows = await db.query(
      `
      SELECT
        i.inningsid,
        i.matchid,
        i.inningsnumber,
        i.battingteamid,
        i.bowlingteamid,
        i.totalruns,
        i.totalwickets,
        i.overs,
        i.extras,
        t1.teamname AS battingteamname,
        t2.teamname AS bowlingteamname
      FROM innings i
      LEFT JOIN teams t1 ON i.battingteamid = t1.teamid
      LEFT JOIN teams t2 ON i.bowlingteamid = t2.teamid
      WHERE i.matchid = ?
      ORDER BY i.inningsnumber
      `,
      [matchId]
    );

    const formatted = rows.map((row) => ({
      innings_id: row.inningsid,
      match_id: row.matchid,
      innings_number: row.inningsnumber,
      batting_team_id: row.battingteamid,
      bowling_team_id: row.bowlingteamid,
      total_runs: row.totalruns,
      total_wickets: row.totalwickets,
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

module.exports = router;
