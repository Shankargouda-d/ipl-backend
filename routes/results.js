const express = require("express");
const router = express.Router();
const pool = require("../db");

async function getTeamName(conn, team_id) {
  const [[team]] = await conn.query(
    "SELECT team_name FROM teams WHERE team_id = ?",
    [team_id]
  );
  return team.team_name;
}

async function updateNRR(conn, team_id) {
  const [scored] = await conn.query(
    `SELECT COALESCE(SUM(i.total_runs),0) AS runs, COALESCE(SUM(i.overs),0.1) AS overs
     FROM innings i JOIN matches m ON i.match_id = m.match_id
     WHERE i.batting_team_id = ? AND m.status = 'completed'`,
    [team_id]
  );
  const [conceded] = await conn.query(
    `SELECT COALESCE(SUM(i.total_runs),0) AS runs, COALESCE(SUM(i.overs),0.1) AS overs
     FROM innings i JOIN matches m ON i.match_id = m.match_id
     WHERE i.bowling_team_id = ? AND m.status = 'completed'`,
    [team_id]
  );

  const rs = scored[0].runs, of_ = scored[0].overs || 0.1;
  const rc = conceded[0].runs, ob = conceded[0].overs || 0.1;
  const nrr = ((rs / of_) - (rc / ob)).toFixed(3);

  await conn.query(
    `UPDATE points_table
     SET runs_scored=?, overs_faced=?, runs_conceded=?, overs_bowled=?, nrr=?
     WHERE team_id=?`,
    [rs, of_, rc, ob, nrr, team_id]
  );
}

router.post("/complete", async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { match_id } = req.body;

    const [innings] = await conn.query(
      "SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number",
      [match_id]
    );

    if (innings.length < 2) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: "Both innings must be entered first" });
    }

    const inn1 = innings[0];
    const inn2 = innings[1];
    const [[match]] = await conn.query(
      "SELECT team1_id, team2_id FROM matches WHERE match_id = ?",
      [match_id]
    );

    let winner_team_id, result_text;
    if (inn1.total_runs > inn2.total_runs) {
      winner_team_id = inn1.batting_team_id;
      const diff = inn1.total_runs - inn2.total_runs;
      const name = await getTeamName(conn, inn1.batting_team_id);
      result_text = `${name} won by ${diff} runs`;
    } else if (inn2.total_runs > inn1.total_runs) {
      winner_team_id = inn2.batting_team_id;
      const wickets = 10 - inn2.total_wickets;
      const name = await getTeamName(conn, inn2.batting_team_id);
      result_text = `${name} won by ${wickets} wickets`;
    } else {
      winner_team_id = inn1.batting_team_id;
      result_text = "Match tied";
    }

    // Player of the match = highest runs scorer
    const [topBatter] = await conn.query(
      `SELECT bs.player_id, SUM(bs.runs) AS total
       FROM batting_scorecard bs
       JOIN innings i ON bs.innings_id = i.innings_id
       WHERE i.match_id = ?
       GROUP BY bs.player_id
       ORDER BY total DESC LIMIT 1`,
      [match_id]
    );
    const player_of_match = topBatter[0]?.player_id || null;

    // Save match result
    await conn.query(
      `INSERT INTO match_result
        (match_id, winner_team_id, team1_runs, team2_runs, team1_overs, team2_overs, player_of_match, result_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         winner_team_id=VALUES(winner_team_id), team1_runs=VALUES(team1_runs),
         team2_runs=VALUES(team2_runs), team1_overs=VALUES(team1_overs),
         team2_overs=VALUES(team2_overs), player_of_match=VALUES(player_of_match),
         result_text=VALUES(result_text)`,
      [match_id, winner_team_id, inn1.total_runs, inn2.total_runs,
       inn1.overs, inn2.overs, player_of_match, result_text]
    );

    // Update match status
    await conn.query(
      "UPDATE matches SET status = 'completed' WHERE match_id = ?",
      [match_id]
    );

    // Update batting stats
    const [allBatting] = await conn.query(
      `SELECT bs.* FROM batting_scorecard bs
       JOIN innings i ON bs.innings_id = i.innings_id
       WHERE i.match_id = ?`,
      [match_id]
    );

    for (const b of allBatting) {
      const is50 = b.runs >= 50 && b.runs < 100 ? 1 : 0;
      const is100 = b.runs >= 100 ? 1 : 0;

      await conn.query(
        `INSERT INTO batting_stats
          (player_id, matches_played, total_runs, total_fours, total_sixes, fifties, hundreds, highest_score)
         VALUES (?, 1, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           matches_played = matches_played + 1,
           total_runs = total_runs + VALUES(total_runs),
           total_fours = total_fours + VALUES(total_fours),
           total_sixes = total_sixes + VALUES(total_sixes),
           fifties = fifties + VALUES(fifties),
           hundreds = hundreds + VALUES(hundreds),
           highest_score = GREATEST(highest_score, VALUES(highest_score))`,
        [b.player_id, b.runs, b.fours, b.sixes, is50, is100, b.runs]
      );

      await conn.query(
        `UPDATE batting_stats SET
           batting_avg = ROUND(total_runs / GREATEST(matches_played, 1), 2),
           strike_rate = CASE WHEN matches_played > 0
             THEN ROUND(total_runs * 100.0 / GREATEST(matches_played * 30, 1), 2)
             ELSE 0 END
         WHERE player_id = ?`,
        [b.player_id]
      );
    }

    // Update bowling stats
    const [allBowling] = await conn.query(
      `SELECT bw.* FROM bowling_scorecard bw
       JOIN innings i ON bw.innings_id = i.innings_id
       WHERE i.match_id = ?`,
      [match_id]
    );

    for (const b of allBowling) {
      await conn.query(
        `INSERT INTO bowling_stats
          (player_id, matches_played, total_overs, total_wickets, runs_conceded)
         VALUES (?, 1, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           matches_played = matches_played + 1,
           total_overs = total_overs + VALUES(total_overs),
           total_wickets = total_wickets + VALUES(total_wickets),
           runs_conceded = runs_conceded + VALUES(runs_conceded)`,
        [b.player_id, b.overs, b.wickets, b.runs_conceded]
      );

      await conn.query(
        `UPDATE bowling_stats SET
           economy = CASE WHEN total_overs > 0 THEN ROUND(runs_conceded / total_overs, 2) ELSE 0 END,
           bowling_avg = CASE WHEN total_wickets > 0 THEN ROUND(runs_conceded / total_wickets, 2) ELSE 0 END
         WHERE player_id = ?`,
        [b.player_id]
      );
    }

    // Update points table
    const isTied = result_text === "Match tied";
    const loser_team_id =
      parseInt(winner_team_id) === match.team1_id ? match.team2_id : match.team1_id;

    if (isTied) {
      for (const tid of [match.team1_id, match.team2_id]) {
        await conn.query(
          "UPDATE points_table SET played=played+1, tied=tied+1, points=points+1 WHERE team_id=?",
          [tid]
        );
      }
    } else {
      await conn.query(
        "UPDATE points_table SET played=played+1, won=won+1, points=points+2 WHERE team_id=?",
        [winner_team_id]
      );
      await conn.query(
        "UPDATE points_table SET played=played+1, lost=lost+1 WHERE team_id=?",
        [loser_team_id]
      );
    }

    await updateNRR(conn, match.team1_id);
    await updateNRR(conn, match.team2_id);

    await conn.commit();
    res.json({ success: true, result_text, winner_team_id, player_of_match });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get("/:match_id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT mr.*, t.team_name AS winner_name, p.player_name AS potm_name
       FROM match_result mr
       JOIN teams t ON mr.winner_team_id = t.team_id
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