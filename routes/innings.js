const express = require("express");
const router = express.Router();
const scorecardService = require("../services/scorecardService");

router.get("/:matchId", async (req, res) => {
  try {
    const data = await scorecardService.getInningsByMatch(req.params.matchId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const data = await scorecardService.saveInnings(req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;