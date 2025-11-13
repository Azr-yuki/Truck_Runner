import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/banana', async (req, res) => {
  try {
    const response = await fetch('http://marcconrad.com/uob/banana/api.php?out=json');
    const text = await response.text();
    res.send(text);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).send('Error fetching banana puzzle');
  }
});

app.listen(3000, () => console.log('✅ Proxy running at http://localhost:3000'));