const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req, res) => {
  try {
    const [teams] = await pool.query("SELECT * FROM teams");
    const [matches] = await pool.query(`
      SELECT m.team1_id, m.team2_id, mr.winner_team_id, 
             mr.team1_runs, mr.team2_runs, 
             mr.team1_overs, mr.team2_overs
      FROM matches m
      JOIN match_result mr ON m.match_id = mr.match_id
      WHERE m.status = 'completed'
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

          const isTeam1 = m.team1_id === t.team_id;
          const runsFor = isTeam1 ? m.team1_runs : m.team2_runs;
          const oversFor = isTeam1 ? m.team1_overs : m.team2_overs;
          const runsAgainst = isTeam1 ? m.team2_runs : m.team1_runs;
          const oversAgainst = isTeam1 ? m.team2_overs : m.team1_overs;

          rs += (Number(runsFor) || 0);
          of_real += toRealOvers(oversFor);
          rc += (Number(runsAgainst) || 0);
          ob_real += toRealOvers(oversAgainst);
        }
      });

      const points = (won * 2) + tied;
      const nrr = (of_real > 0 ? rs / of_real : 0) - (ob_real > 0 ? rc / ob_real : 0);

      return {
        ...t,
        played, won, lost, tied, points, 
        nrr: nrr.toFixed(3),
        runs_scored: rs,
        overs_faced: of_real.toFixed(2), // Just for debugging visibility
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