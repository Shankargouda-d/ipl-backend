const express = require("express");
const router = express.Router();
const resultService = require("../services/resultService");

router.get("/:matchId", async (req, res) => {
  try {
    const data = await resultService.generateResult(req.params.matchId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;