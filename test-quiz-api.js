const axios = require("axios");

async function testAttempt() {
  const visitor_id = "v_2nrtccvtz1777202800559";
  const question_id = "test_q_" + Date.now();
  
  try {
    console.log("Testing Quiz Attempt API...");
    const res = await axios.post("http://localhost:5000/api/quiz/attempt", {
      visitor_id,
      question_id,
      is_correct: true,
      points_earned: 10
    });
    console.log("Response:", res.data);
    
    const statsRes = await axios.get(`http://localhost:5000/api/quiz/stats/${visitor_id}`);
    console.log("Updated Stats:", statsRes.data);
    
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err.response ? err.response.data : err.message);
    process.exit(1);
  }
}

testAttempt();
