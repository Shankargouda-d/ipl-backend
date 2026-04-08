const db = require("../db");

async function generateResult(matchId) {
  const [matchRows] = await db.query("SELECT * FROM matches WHERE match_id = ?", [matchId]);
  if (!matchRows.length) {
    throw new Error("Match not found");
  }

  const match = matchRows[0];
  const [innings] = await db.query(
    "SELECT * FROM innings WHERE match_id = ? ORDER BY innings_no",
    [matchId]
  );

  if (innings.length < 2) {
    return { message: "Result cannot be generated until both innings are saved" };
  }

  const innings1 = innings[0];
  const innings2 = innings[1];

  let winner_team_id = null;
  let win_type = null;
  let win_margin = 0;

  if (innings1.total_runs > innings2.total_runs) {
    winner_team_id = innings1.batting_team_id;
    win_type = "runs";
    win_margin = innings1.total_runs - innings2.total_runs;
  } else if (innings2.total_runs > innings1.total_runs) {
    winner_team_id = innings2.batting_team_id;
    win_type = "wickets";
    win_margin = 10 - Number(innings2.wickets);
  } else {
    win_type = "tie";
  }

  const [topBatter] = await db.query(
    `SELECT ib.player_id
     FROM innings_batting ib
     JOIN innings i ON ib.innings_id = i.innings_id
     WHERE i.match_id = ?
     ORDER BY ib.runs DESC, ib.balls ASC
     LIMIT 1`,
    [matchId]
  );

  const player_of_match_id = topBatter.length ? topBatter[0].player_id : null;

  const team1Runs =
    innings1.batting_team_id === match.team1_id ? innings1.total_runs : innings2.total_runs;
  const team2Runs =
    innings1.batting_team_id === match.team2_id ? innings1.total_runs : innings2.total_runs;

  await db.query(
    `INSERT INTO match_result
    (match_id, team1_id, team2_id, team1_runs, team2_runs, winner_team_id, win_type, win_margin, player_of_match_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    team1_runs = VALUES(team1_runs),
    team2_runs = VALUES(team2_runs),
    winner_team_id = VALUES(winner_team_id),
    win_type = VALUES(win_type),
    win_margin = VALUES(win_margin),
    player_of_match_id = VALUES(player_of_match_id)`,
    [
      matchId,
      match.team1_id,
      match.team2_id,
      team1Runs,
      team2Runs,
      winner_team_id,
      win_type,
      win_margin,
      player_of_match_id,
    ]
  );

  return {
    match_id: Number(matchId),
    team1_id: match.team1_id,
    team2_id: match.team2_id,
    team1_runs: team1Runs,
    team2_runs: team2Runs,
    winner_team_id,
    win_type,
    win_margin,
    player_of_match_id,
  };
}

module.exports = { generateResult };