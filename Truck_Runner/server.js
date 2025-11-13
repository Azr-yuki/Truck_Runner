// 🔹 Import required modules
const express = require('express');      // Express framework for server
const cors = require('cors');            // CORS middleware to allow cross-origin requests
const app = express();                   // Initialize Express app
const PORT = 3000;                       // Server port number

// 🔹 Middleware
app.use(cors());                         // Enable CORS for all routes
app.use(express.json());                 // Parse JSON bodies

// 🔹 Banana API route
// This simulates returning a math puzzle as the "banana" challenge
app.get('/banana', (req, res) => {
  // Random numbers for the math puzzle
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  
  // Construct the response object
  const response = {
    question: `http://via.placeholder.com/200x80?text=${a}+%2B+${b}`, // Placeholder image with math question
    solution: a + b                                                     // Correct solution
  };
  
  // Send response as JSON
  res.json(response);
});

// 🔹 Start server
app.listen(PORT, () => {
  console.log(`🍌 Banana API server running at http://localhost:${PORT}`);
});
