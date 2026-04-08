const db = require("../db");

async function getPlayersByTeam(teamId) {
  const [rows] = await db.query("SELECT * FROM players WHERE team_id = ? ORDER BY player_id", [teamId]);
  return rows;
}

async function addPlayer(player) {
  const { player_name, team_id, player_role } = player;

  const [rows] = await db.query(
    "SELECT player_id FROM players WHERE team_id = ? ORDER BY player_id DESC LIMIT 1",
    [team_id]
  );

  let nextNumber = 1;
  if (rows.length > 0) {
    const lastId = rows[0].player_id;
    const lastNumber = parseInt(lastId.replace(team_id, ""), 10);
    nextNumber = lastNumber + 1;
  }

  const player_id = `${team_id}${String(nextNumber).padStart(2, "0")}`;

  await db.query(
    "INSERT INTO players (player_id, player_name, team_id, player_role) VALUES (?, ?, ?, ?)",
    [player_id, player_name, team_id, player_role]
  );

  return { message: "Player added successfully", player_id };
}

async function updatePlayer(playerId, payload) {
  await db.query(
    "UPDATE players SET player_name = ?, player_role = ? WHERE player_id = ?",
    [payload.player_name, payload.player_role, playerId]
  );
  return { message: "Player updated successfully" };
}

async function removePlayer(playerId) {
  await db.query("DELETE FROM players WHERE player_id = ?", [playerId]);
  return { message: "Player deleted successfully" };
}

module.exports = {
  getPlayersByTeam,
  addPlayer,
  updatePlayer,
  removePlayer,
};