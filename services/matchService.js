const db = require("../db");

async function getMatches() {
  const [rows] = await db.query(`
    SELECT m.*, t1.team_name AS team1_name, t2.team_name AS team2_name
    FROM matches m
    JOIN teams t1 ON m.team1_id = t1.team_id
    JOIN teams t2 ON m.team2_id = t2.team_id
    ORDER BY m.match_no
  `);
  return rows;
}

async function getMatchById(matchId) {
  const [rows] = await db.query("SELECT * FROM matches WHERE match_id = ?", [matchId]);
  return rows[0] || null;
}

async function createMatch(match) {
  const { match_no, team1_id, team2_id, match_date, match_time, venue } = match;
  const [result] = await db.query(
    `INSERT INTO matches (match_no, team1_id, team2_id, match_date, match_time, venue)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [match_no, team1_id, team2_id, match_date, match_time, venue]
  );

  return { message: "Match added successfully", match_id: result.insertId };
}

module.exports = {
  getMatches,
  getMatchById,
  createMatch,
};