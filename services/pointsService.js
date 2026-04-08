const db = require("../db");

function toOvers(overs, balls) {
  return Number(overs) + Number(balls) / 6;
}

async function getPointsTable() {
  const [teams] = await db.query("SELECT team_id, team_name FROM teams ORDER BY team_name");
  const [results] = await db.query("SELECT * FROM match_result");
  const [innings] = await db.query("SELECT * FROM innings");

  const table = teams.map((team) => {
    const teamResults = results.filter(
      (r) => r.team1_id === team.team_id || r.team2_id === team.team_id
    );

    const won = teamResults.filter((r) => r.winner_team_id === team.team_id).length;
    const lost = teamResults.filter(
      (r) => r.winner_team_id && r.winner_team_id !== team.team_id
    ).length;
    const tied = teamResults.filter((r) => r.win_type === "tie").length;
    const matches_played = teamResults.length;
    const points = won * 2 + tied;

    let runs_scored = 0;
    let runs_conceded = 0;
    let overs_faced = 0;
    let overs_bowled = 0;

    innings.forEach((inn) => {
      if (inn.batting_team_id === team.team_id) {
        runs_scored += Number(inn.total_runs);
        overs_faced += inn.is_all_out ? Number(inn.max_overs) : toOvers(inn.overs_bowled, inn.balls_bowled);
      }
      if (inn.bowling_team_id === team.team_id) {
        runs_conceded += Number(inn.total_runs);
        overs_bowled += inn.is_all_out ? Number(inn.max_overs) : toOvers(inn.overs_bowled, inn.balls_bowled);
      }
    });

    const runRateFor = overs_faced ? runs_scored / overs_faced : 0;
    const runRateAgainst = overs_bowled ? runs_conceded / overs_bowled : 0;
    const net_run_rate = Number((runRateFor - runRateAgainst).toFixed(3));

    return {
      team_id: team.team_id,
      team_name: team.team_name,
      matches_played,
      won,
      lost,
      tied,
      points,
      net_run_rate,
    };
  });

  table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.net_run_rate - a.net_run_rate;
  });

  return table;
}

module.exports = { getPointsTable };