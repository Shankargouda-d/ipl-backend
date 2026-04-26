const express = require("express");
const router = express.Router();
const pool = require("../db");

async function getTeamName(conn, team_id) {
  const [[team]] = await conn.query(
    "SELECT team_name FROM teams WHERE team_id = ?",
    [team_id]
  );
  return team?.team_name || "";
}

router.post("/abandon", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { match_id } = req.body;

    const [[match]] = await conn.query(
      "SELECT team1_id, team2_id FROM matches WHERE match_id = ?",
      [match_id]
    );

    if (!match) {
      await conn.rollback();
      return res.status(404).json({ error: "Match not found" });
    }

    const team1Id = match.team1_id;
    const team2Id = match.team2_id;
    const result_text = "Match Abandoned without a ball bowled";

    // Mark match completed
    await conn.query(
      "UPDATE matches SET status = 'completed' WHERE match_id = ?",
      [match_id]
    );

    // Insert into match_result
    await conn.query(
      `INSERT INTO match_result
        (match_id, winner_team_id, team1_runs, team2_runs, team1_overs, team2_overs, player_of_match, result_text)
       VALUES (?, NULL, 0, 0, 0, 0, NULL, ?)
       ON DUPLICATE KEY UPDATE
         result_text = VALUES(result_text)`,
      [match_id, result_text]
    );


    await conn.commit();
    res.json({ success: true, message: "Match abandoned successfully" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.post("/complete", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { match_id, player_of_match_id } = req.body;
    const player_of_match = player_of_match_id || null;

    const [innings] = await conn.query(
      "SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number",
      [match_id]
    );

    if (innings.length < 2) {
      await conn.rollback();
      return res
        .status(400)
        .json({ error: "Both innings must be entered first" });
    }

    const inn1 = innings[0];
    const inn2 = innings[1];

    const [[match]] = await conn.query(
      "SELECT team1_id, team2_id FROM matches WHERE match_id = ?",
      [match_id]
    );

    if (!match) {
      await conn.rollback();
      return res.status(404).json({ error: "Match not found" });
    }

    let winner_team_id = null;
    let result_text = "";

    const { abandoned } = req.body;

    if (abandoned) {
      // No Result — rain or abandoned — both teams get 1 point
      result_text = "No Result (Match Abandoned)";
    } else if (Number(inn1.total_runs) > Number(inn2.total_runs)) {
      winner_team_id = inn1.batting_team_id;
      const diff = Number(inn1.total_runs) - Number(inn2.total_runs);
      const name = await getTeamName(conn, inn1.batting_team_id);
      result_text = `${name} won by ${diff} runs`;
    } else if (Number(inn2.total_runs) > Number(inn1.total_runs)) {
      winner_team_id = inn2.batting_team_id;
      const wickets = 10 - Number(inn2.total_wickets || 0);
      const name = await getTeamName(conn, inn2.batting_team_id);
      result_text = `${name} won by ${wickets} wickets`;
    } else {
      winner_team_id = null;
      result_text = "Match Tied";
    }

    // Map runs/overs to the correct team (team1/team2 from matches table, NOT innings order)
    const team1Id_m = match.team1_id;
    const team2Id_m = match.team2_id;

    let team1_runs, team2_runs, team1_overs, team2_overs;
    if (Number(inn1.batting_team_id) === Number(team1Id_m)) {
      // inn1 = team1 batting, inn2 = team2 batting
      team1_runs = inn1.total_runs;
      team1_overs = inn1.overs;
      team2_runs = inn2.total_runs;
      team2_overs = inn2.overs;
    } else {
      // inn1 = team2 batting, inn2 = team1 batting
      team1_runs = inn2.total_runs;
      team1_overs = inn2.overs;
      team2_runs = inn1.total_runs;
      team2_overs = inn1.overs;
    }

    // save result row
    await conn.query(
      `INSERT INTO match_result
        (match_id, winner_team_id, team1_runs, team2_runs, team1_overs, team2_overs, player_of_match, result_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         winner_team_id = VALUES(winner_team_id),
         team1_runs = VALUES(team1_runs),
         team2_runs = VALUES(team2_runs),
         team1_overs = VALUES(team1_overs),
         team2_overs = VALUES(team2_overs),
         player_of_match = VALUES(player_of_match),
         result_text = VALUES(result_text)`,
      [
        match_id,
        winner_team_id,
        team1_runs,
        team2_runs,
        team1_overs,
        team2_overs,
        player_of_match,
        result_text,
      ]
    );

    // mark match completed
    await conn.query(
      "UPDATE matches SET status = 'completed' WHERE match_id = ?",
      [match_id]
    );

    const team1Id = match.team1_id;
    const team2Id = match.team2_id;


    await conn.commit();
    res.json({ success: true, result_text, winner_team_id, player_of_match });
  } catch (err) {
    await conn.rollback();
    console.error("RESULT COMPLETE ERROR:", err);
    res.status(500).json({
      error: err.message,
      sqlMessage: err.sqlMessage || null,
      code: err.code || null,
    });
  } finally {
    conn.release();
  }
});

router.get("/:match_id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT mr.*, t.team_name AS winner_name, p.player_name AS potm_name
       FROM match_result mr
       LEFT JOIN teams t ON mr.winner_team_id = t.team_id
       LEFT JOIN players p ON mr.player_of_match = p.player_id
       WHERE mr.match_id = ?`,
      [req.params.match_id]
    );

    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
