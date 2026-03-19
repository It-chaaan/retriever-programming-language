const express = require('express');
const cors = require('cors');
const { compileMultiLine } = require('./compiler-engine');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/compile', (req, res) => {
  const { code, input } = req.body || {};

  if (typeof code !== 'string') {
    return res.status(400).json({
      message: 'Invalid request body. Expected: { code: string }',
    });
  }

  if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) {
    return res.status(400).json({
      message: 'Invalid request body. Expected optional input as an object map: { code: string, input?: Record<string,string|number|boolean> }',
    });
  }

  const result = compileMultiLine(code, input || {});
  return res.json(result);
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
