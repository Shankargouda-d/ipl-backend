const express = require("express");
const router = express.Router();
const pointsService = require("../services/pointsService");

router.get("/", async (req, res) => {
  try {
    const data = await pointsService.getPointsTable();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;