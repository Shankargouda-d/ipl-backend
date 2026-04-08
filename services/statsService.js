const db = require("../db");

async function getPlayerStats() {
  const [rows] = await db.query(`
    SELECT
      p.player_id,
      p.player_name,
      p.team_id,
      COUNT(DISTINCT i.match_id) AS matches_played,
      COALESCE(SUM(ib.runs), 0) AS total_runs,
      COALESCE(SUM(ibo.wickets), 0) AS total_wickets
    FROM players p
    LEFT JOIN innings_batting ib ON p.player_id = ib.player_id
    LEFT JOIN innings i ON ib.innings_id = i.innings_id
    LEFT JOIN innings_bowling ibo ON p.player_id = ibo.player_id
    GROUP BY p.player_id, p.player_name, p.team_id
    ORDER BY total_runs DESC, total_wickets DESC
  `);

  return rows;
}

module.exports = { getPlayerStats };