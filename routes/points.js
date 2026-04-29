const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const [teams] = await pool.query("SELECT * FROM teams");

    // Get completed match results for W/L/T
    const [matches] = await pool.query(`
      SELECT m.match_id, m.team1_id, m.team2_id, mr.winner_team_id, mr.result_text
      FROM matches m
      JOIN match_result mr ON m.match_id = mr.match_id
      WHERE m.status = 'completed'
    `);

    // Get innings data directly for accurate NRR calculation
    const [inningsData] = await pool.query(`
      SELECT 
        i.match_id,
        i.batting_team_id,
        i.bowling_team_id,
        i.total_runs,
        i.total_wickets,
        i.overs
      FROM innings i
      JOIN matches m ON i.match_id = m.match_id
      WHERE m.status = 'completed' AND i.innings_number IN (1, 2)
    `);

    // Helper to convert cricket overs string like "19.4" to real mathematical fractional overs
    const toRealOvers = (oversStr) => {
      if (oversStr === undefined || oversStr === null) return 0;
      const str = String(oversStr);
      const [whole, balls = "0"] = str.split(".");
      return parseInt(whole || 0) + parseInt(balls || 0) / 6;
    };

    const table = teams.map(t => {
      let played = 0, won = 0, lost = 0, tied = 0;
      let rs = 0, of_real = 0;
      let rc = 0, ob_real = 0;

      // Count W/L/T from match results
      matches.forEach(m => {
        if (m.team1_id === t.team_id || m.team2_id === t.team_id) {
          played++;
          
          if (m.winner_team_id === t.team_id) {
            won++;
          } else if (m.winner_team_id !== null) {
            lost++;
          } else {
            tied++;
          }
        }
      });

      // Calculate NRR from innings table (much more reliable)
      inningsData.forEach(inn => {
        const actualOvers = toRealOvers(inn.overs);
        // Rule: If all out, use full quota (20 overs) for NRR calculation
        const effectiveOvers = (Number(inn.total_wickets) >= 10) ? 20 : actualOvers;

        if (inn.batting_team_id === t.team_id) {
          // This team batted — add to runs scored / overs faced
          rs += (Number(inn.total_runs) || 0);
          of_real += effectiveOvers;
        }
        if (inn.bowling_team_id === t.team_id) {
          // This team bowled — add to runs conceded / overs bowled
          rc += (Number(inn.total_runs) || 0);
          ob_real += effectiveOvers;
        }
      });

      const points = (won * 2) + tied;
      const nrr = (of_real > 0 ? rs / of_real : 0) - (ob_real > 0 ? rc / ob_real : 0);

      return {
        ...t,
        played, won, lost, tied, points, 
        nrr: nrr.toFixed(3),
        runs_scored: rs,
        overs_faced: of_real.toFixed(2),
        runs_conceded: rc,
        overs_bowled: ob_real.toFixed(2)
      };
    });

    // Sort by points DESC, then NRR DESC
    table.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return parseFloat(b.nrr) - parseFloat(a.nrr);
    });

    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;