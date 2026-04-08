const express = require("express");
const router = express.Router();
const playerService = require("../services/playerService");

router.get("/team/:teamId", async (req, res) => {
  try {
    const data = await playerService.getPlayersByTeam(req.params.teamId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = await playerService.addPlayer(req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:playerId", async (req, res) => {
  try {
    const data = await playerService.updatePlayer(req.params.playerId, req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:playerId", async (req, res) => {
  try {
    const data = await playerService.removePlayer(req.params.playerId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;