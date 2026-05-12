require('dotenv').config();

const express = require('express');
const webhookRouter = require('./routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies — all our webhook payloads are JSON
app.use(express.json());

// Health check so we can quickly verify the server is running
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount the webhook routes
app.use('/webhook', webhookRouter);

// Catch-all for undefined routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Nistula webhook server running on http://localhost:${PORT}`);
});

module.exports = app;
