const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');
const { sequelize } = require('./config/db');
const { startS3rver } = require('./services/s3Service');
const router = require('./routes');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Rate Limiting (Bonus Point)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// S3rver Proxy for Render (Single Port Expose)
app.use('/s3-proxy', createProxyMiddleware({
  target: `http://127.0.0.1:${config.S3_PORT}`,
  changeOrigin: true,
  pathRewrite: {
    '^/s3-proxy': '', // remove /s3-proxy prefix when forwarding to s3rver
  },
}));

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', host: config.HOST_IP });
});

// API Routes
app.use('/api', router);

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    // 1. Start Express (so the S3 proxy is available)
    const server = app.listen(config.PORT, '0.0.0.0', () => {
      console.log(`[Backend] Server listening on http://localhost:${config.PORT}`);
      console.log(`[Backend] Network-accessible address: http://${config.HOST_IP}:${config.PORT}`);
    });

    // 2. Start Local S3 Mock Server
    await startS3rver();

    // 3. Connect Database
    await sequelize.sync({ force: false });
    console.log('[Database] SQLite synced successfully.');
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

// Start only if run directly (not loaded by tests)
if (require.main === module) {
  start();
}

module.exports = app;
