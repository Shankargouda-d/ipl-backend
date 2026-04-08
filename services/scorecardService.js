const db = require("../db");

function calcStrikeRate(runs, balls) {
  if (!balls || Number(balls) === 0) return 0;
  return Number(((Number(runs) / Number(balls)) * 100).toFixed(2));
}

function ballsFromOvers(overs, balls) {
  return Number(overs) * 6 + Number(balls);
}

function calcEconomy(runs, overs, balls) {
  const totalBalls = ballsFromOvers(overs, balls);
  if (!totalBalls) return 0;
  return Number((Number(runs) / (totalBalls / 6)).toFixed(2));
}

async function saveToss(payload) {
  const { match_id, toss_winner_team_id, toss_decision } = payload;
  await db.query(
    `INSERT INTO match_toss (match_id, toss_winner_team_id, toss_decision)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
     toss_winner_team_id = VALUES(toss_winner_team_id),
     toss_decision = VALUES(toss_decision)`,
    [match_id, toss_winner_team_id, toss_decision]
  );
  return { message: "Toss saved successfully" };
}

async function getTossByMatch(matchId) {
  const [rows] = await db.query("SELECT * FROM match_toss WHERE match_id = ?", [matchId]);
  return rows[0] || null;
}

async function saveSquad(payload) {
  const { match_id, team_id, players } = payload;

  await db.query("DELETE FROM match_team_selection WHERE match_id = ? AND team_id = ?", [match_id, team_id]);

  for (const player of players) {
    await db.query(
      `INSERT INTO match_team_selection (match_id, team_id, player_id, is_playing_xi, is_impact_player)
       VALUES (?, ?, ?, ?, ?)`,
      [
        match_id,
        team_id,
        player.player_id,
        player.is_playing_xi ? 1 : 0,
        player.is_impact_player ? 1 : 0,
      ]
    );
  }

  return { message: "Squad saved successfully" };
}

async function getSquad(matchId, teamId) {
  const [rows] = await db.query(
    `SELECT s.*, p.player_name, p.player_role
     FROM match_team_selection s
     JOIN players p ON s.player_id = p.player_id
     WHERE s.match_id = ? AND s.team_id = ?`,
    [matchId, teamId]
  );
  return rows;
}

async function saveInnings(payload) {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const {
      match_id,
      innings_no,
      batting_team_id,
      bowling_team_id,
      wickets,
      overs_bowled,
      balls_bowled,
      wides,
      no_balls,
      byes,
      leg_byes,
      penalty_runs,
      is_all_out,
      max_overs,
      batting,
      bowling,
    } = payload;

    const battingRuns = batting.reduce((sum, row) => sum + Number(row.runs || 0), 0);
    const extras =
      Number(wides || 0) +
      Number(no_balls || 0) +
      Number(byes || 0) +
      Number(leg_byes || 0) +
      Number(penalty_runs || 0);

    const total_runs = battingRuns + extras;

    await connection.query(
      `INSERT INTO innings
      (match_id, innings_no, batting_team_id, bowling_team_id, total_runs, wickets,
       overs_bowled, balls_bowled, wides, no_balls, byes, leg_byes, penalty_runs, is_all_out, max_overs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
      batting_team_id = VALUES(batting_team_id),
      bowling_team_id = VALUES(bowling_team_id),
      total_runs = VALUES(total_runs),
      wickets = VALUES(wickets),
      overs_bowled = VALUES(overs_bowled),
      balls_bowled = VALUES(balls_bowled),
      wides = VALUES(wides),
      no_balls = VALUES(no_balls),
      byes = VALUES(byes),
      leg_byes = VALUES(leg_byes),
      penalty_runs = VALUES(penalty_runs),
      is_all_out = VALUES(is_all_out),
      max_overs = VALUES(max_overs)`,
      [
        match_id,
        innings_no,
        batting_team_id,
        bowling_team_id,
        total_runs,
        wickets,
        overs_bowled,
        balls_bowled,
        wides,
        no_balls,
        byes,
        leg_byes,
        penalty_runs,
        is_all_out ? 1 : 0,
        max_overs || 20,
      ]
    );

    const [inningsRows] = await connection.query(
      "SELECT innings_id FROM innings WHERE match_id = ? AND innings_no = ?",
      [match_id, innings_no]
    );

    const innings_id = inningsRows[0].innings_id;

    await connection.query("DELETE FROM innings_batting WHERE innings_id = ?", [innings_id]);
    await connection.query("DELETE FROM innings_bowling WHERE innings_id = ?", [innings_id]);

    for (const row of batting) {
      if (!row.player_id) continue;
      await connection.query(
        `INSERT INTO innings_batting
        (innings_id, player_id, batting_position, runs, balls, fours, sixes, is_out, dismissal_type, strike_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          innings_id,
          row.player_id,
          row.batting_position || null,
          row.runs || 0,
          row.balls || 0,
          row.fours || 0,
          row.sixes || 0,
          row.is_out ? 1 : 0,
          row.dismissal_type || null,
          calcStrikeRate(row.runs || 0, row.balls || 0),
        ]
      );
    }

    for (const row of bowling) {
      if (!row.player_id) continue;
      await connection.query(
        `INSERT INTO innings_bowling
        (innings_id, player_id, overs, balls, maidens, runs_conceded, wickets, economy)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          innings_id,
          row.player_id,
          row.overs || 0,
          row.balls || 0,
          row.maidens || 0,
          row.runs_conceded || 0,
          row.wickets || 0,
          calcEconomy(row.runs_conceded || 0, row.overs || 0, row.balls || 0),
        ]
      );
    }

    await connection.commit();

    return {
      message: "Innings saved successfully",
      innings_id,
      total_runs,
      extras,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getInningsByMatch(matchId) {
  const [rows] = await db.query(
    "SELECT * FROM innings WHERE match_id = ? ORDER BY innings_no",
    [matchId]
  );
  return rows;
}

module.exports = {
  saveToss,
  getTossByMatch,
  saveSquad,
  getSquad,
  saveInnings,
  getInningsByMatch,
};