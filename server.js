const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const titleRoutes = require('./routes/titles');
const paintingRoutes = require('./routes/paintings');
const referenceRoutes = require('./routes/references');
require('dotenv').config();

const app = express();
const SERVER_PORT = process.env.SERVER_PORT || 3000;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5000',
    'http://localhost:3000',
    'http://161.35.89.78:5000',
    'http://161.35.89.78:3000',
    'https://161.35.89.78:5000',
    'https://161.35.89.78:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/titles', titleRoutes);
app.use('/api/paintings', paintingRoutes);
app.use('/api/references', referenceRoutes);

// Config endpoint to provide server information to frontend
app.get('/api/config', (req, res) => {
  res.json({
    serverIP: process.env.SERVER_IP,
    apiPort: process.env.SERVER_PORT || 3000
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'AI Image Generator API' });
});

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(SERVER_PORT, () => {
      console.log(`Server running on port ${SERVER_PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  }); 