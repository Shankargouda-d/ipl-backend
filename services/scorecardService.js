const db = require("../db");

function calcStrikeRate(runs, balls) {
  if (!balls || Number(balls) === 0) return 0;
  return Number(((Number(runs) / Number(balls)) * 100).toFixed(2));
}

function calcEconomy(runs, overs) {
  // Return 0 if overs not provided
  if (!overs) return 0;
  // Convert overs string like "3.4" (3 overs 4 balls) to real overs
  const realOvers = (() => {
    const str = String(overs);
    const [whole = "0", balls = "0"] = str.split('.');
    const wholeNum = parseInt(whole) || 0;
    const ballsNum = parseInt(balls) || 0;
    return wholeNum + ballsNum / 6;
  })();
  if (realOvers === 0) return 0;
  return Number((Number(runs) / realOvers).toFixed(2));
}



async function saveToss(payload) {
  const { match_id, toss_winner_team_id, decision, batting_first_team_id } = payload;
  await db.query(
    `INSERT INTO toss (match_id, toss_winner_team_id, decision, batting_first_team_id)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     toss_winner_team_id = VALUES(toss_winner_team_id),
     decision = VALUES(decision),
     batting_first_team_id = VALUES(batting_first_team_id)`,
    [match_id, toss_winner_team_id, decision, batting_first_team_id]
  );
  return { message: "Toss saved successfully" };
}

async function getTossByMatch(matchId) {
  const [rows] = await db.query(
    `SELECT t.*, 
      tm.team_name AS batting_first_name
     FROM toss t
     JOIN teams tm ON t.batting_first_team_id = tm.team_id
     WHERE t.match_id = ?`,
    [matchId]
  );
  return rows[0] || null;
}

async function saveSquad(payload) {
  const { match_id, team_id, players } = payload;
  await db.query(
    "DELETE FROM playing11 WHERE match_id = ? AND team_id = ?",
    [match_id, team_id]
  );
  for (const player of players) {
    await db.query(
      `INSERT INTO playing11 (match_id, team_id, player_id, is_impact_player)
       VALUES (?, ?, ?, ?)`,
      [match_id, team_id, player.player_id, player.is_impact_player ? 1 : 0]
    );
  }
  return { message: "Squad saved successfully" };
}

async function getSquad(matchId, teamId) {
  const [rows] = await db.query(
    `SELECT 
        p11.id,
        p11.match_id,
        p11.team_id,
        p11.is_impact_player,
        p.player_id,
        p.player_name,
        p.role AS player_role,
        p.batting_style,
        p.bowling_style
     FROM playing11 p11
     JOIN players p ON p11.player_id = p.player_id
     WHERE p11.match_id = ? AND p11.team_id = ?`,
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
      innings_number,
      batting_team_id,
      bowling_team_id,
      total_runs,
      total_wickets,
      overs,
      extras,
      batting,
      bowling,
    } = payload;

    // Check if innings already exists
    const [existing] = await connection.query(
      "SELECT innings_id FROM innings WHERE match_id = ? AND innings_number = ?",
      [match_id, innings_number]
    );

    let innings_id;

    if (existing.length > 0) {
      innings_id = existing[0].innings_id;
      await connection.query(
        `UPDATE innings SET
         batting_team_id = ?, bowling_team_id = ?,
         total_runs = ?, total_wickets = ?,
         overs = ?, extras = ?
         WHERE innings_id = ?`,
        [batting_team_id, bowling_team_id, total_runs,
         total_wickets, overs, extras, innings_id]
      );
    } else {
      const [result] = await connection.query(
        `INSERT INTO innings
         (match_id, innings_number, batting_team_id, bowling_team_id,
          total_runs, total_wickets, overs, extras)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [match_id, innings_number, batting_team_id, bowling_team_id,
         total_runs, total_wickets, overs, extras]
      );
      innings_id = result.insertId;
    }

    // Delete old records
    await connection.query(
      "DELETE FROM batting_scorecard WHERE innings_id = ?", [innings_id]
    );
    await connection.query(
      "DELETE FROM bowling_scorecard WHERE innings_id = ?", [innings_id]
    );

    // Insert batting
    for (const row of batting) {
      if (!row.player_id) continue;
      await connection.query(
        `INSERT INTO batting_scorecard
         (innings_id, player_id, runs, balls, fours, sixes,
          dismissal_type, wicket_taker_player_id, fielder_player_id,
          strike_rate, batting_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          innings_id,
          row.player_id,
          row.runs || 0,
          row.balls || 0,
          row.fours || 0,
          row.sixes || 0,
          row.dismissal_type || "not out",
          row.wicket_taker_player_id || null,
          row.fielder_player_id || null,
          calcStrikeRate(row.runs || 0, row.balls || 0),
          row.batting_order || null,
        ]
      );
    }

    // Insert bowling
    for (const row of bowling) {
      if (!row.player_id) continue;
      await connection.query(
        `INSERT INTO bowling_scorecard
         (innings_id, player_id, overs, maidens, runs_conceded,
          wickets, economy, wides, no_balls)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          innings_id,
          row.player_id,
          row.overs || 0,
          row.maidens || 0,
          row.runs_conceded || 0,
          row.wickets || 0,
          calcEconomy(row.runs_conceded || 0, row.overs || 0),
          row.wides || 0,
          row.no_balls || 0,
        ]
      );
    }

    await connection.commit();
    return { message: "Innings saved successfully", innings_id, total_runs, extras };

  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getInningsByMatch(matchId) {
  const [rows] = await db.query(
    "SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number",
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