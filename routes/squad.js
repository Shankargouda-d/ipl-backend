const express = require("express");
const router = express.Router();
const scorecardService = require("../services/scorecardService");

router.get("/:matchId/:teamId", async (req, res) => {
  try {
    const data = await scorecardService.getSquad(req.params.matchId, req.params.teamId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = await scorecardService.saveSquad(req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;