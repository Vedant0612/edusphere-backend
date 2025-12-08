require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticationMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Import routes
const { createServer } = require('http');
const { Server } = require('socket.io');

const setupChatSocket = require('./socket/chat.socket');

// Import routers
const authRouter = require('./routes/auth.routes');
const usersRouter = require('./routes/users.routes');
const studentsRouter = require('./routes/students.routes');
const instituteRouter = require('./routes/institute.routes');
const facultyRouter = require('./routes/faculty.routes');
const mentorRouter = require('./routes/mentor.routes');
const companiesRouter = require('./routes/companies.routes');
const jobsRouter = require('./routes/jobs.routes');
const logbookRouter = require('./routes/logbook.routes');
const roadmapsRouter = require('./routes/roadmaps.routes');
const internshipsRouter = require('./routes/internships.routes');
const internshipMgmtRouter = require('./routes/internship-management.routes');
const testRouter = require('./routes/testMulter.route');
const chatRouter = require('./routes/chat.routes');
const notificationsRouter = require('./routes/notifications.routes');
const applicationRoutes = require('./routes/applications.routes');
const certificationsRouter = require('./routes/certifications.routes');

// ============================================
// CREATE HTTP SERVER & SOCKET.IO
// ============================================
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Setup WebSocket chat
setupChatSocket(io);

// Make io accessible in routes
app.set('io', io);

// ============================================
// HOME ROUTE (NO AUTH NEEDED)
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    message: 'EduSphere Platform API with WebSocket',
    status: 'running',
    version: '2.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      students: '/api/students',
      institutes: '/api/institutes',
      faculty: '/api/faculty',
      mentor: '/api/mentor',
      companies: '/api/companies',
      jobs: '/api/jobs',
      logbook: '/api/logbook',
      roadmaps: '/api/roadmaps',
      internships: '/api/internships',
      internshipManagement: '/api/internship-management',
      applications: '/api/applications',
      certifications: '/api/certifications',
      chat: '/api/chat',
      notifications: '/api/notifications',
      test: '/api/test'
    },
    websocket: `ws://localhost:${PORT}`
  });
});

// ============================================
// WHATSAPP TEST ROUTE (NO AUTH NEEDED)
// ============================================
app.get('/send-whatsapp-test', async (req, res) => {
  try {
    const twilio = require('twilio');
    
    // Debug: Print what we're using
    console.log('🔍 Account SID:', process.env.TWILIO_WHATSAPP_ACCOUNT_SID);
    console.log('🔍 From Number:', process.env.TWILIO_WHATSAPP_NUMBER);
    console.log('🔍 To Number:', 'whatsapp:+918921811139');
    
    const client = twilio(
      process.env.TWILIO_WHATSAPP_ACCOUNT_SID,
      process.env.TWILIO_WHATSAPP_AUTH_TOKEN
    );
    
    const message = await client.messages.create({
      body: '🚀 Hello from Prashikshan! Your WhatsApp integration is working!',
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: 'whatsapp:+918921811139'
    });
    
    console.log('✅ Message sent! SID:', message.sid);
    
    res.json({ 
      success: true, 
      message: 'WhatsApp sent!', 
      sid: message.sid 
    });
    
  } catch (error) {
    console.error('❌ Full Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.code
    });
  }
});

// ============================================
// PUBLIC ROUTES (NO AUTH)
// ============================================
app.use('/api/auth', authRouter);

// ============================================
// PROTECTED ROUTES (AUTH REQUIRED)
// ============================================
app.use(authenticationMiddleware);

app.use('/api/users', usersRouter);
app.use('/api/students', studentsRouter);
app.use('/api/institutes', instituteRouter);
app.use('/api/faculty', facultyRouter);
app.use('/api/mentor', mentorRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/logbook', logbookRouter);
app.use('/api/roadmaps', roadmapsRouter);
app.use('/api/internship-management', internshipMgmtRouter);
app.use('/api/internships', internshipsRouter);
app.use('/api/test', testRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/applications', applicationRoutes);
app.use('/api/certifications', certificationsRouter);

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================
// START SERVER (THIS WAS MISSING!)
// ============================================
httpServer.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ WebSocket server ready`);
  console.log(`📡 REST API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`🧪 Test WhatsApp: http://localhost:${PORT}/send-whatsapp-test`);
  console.log('='.repeat(50));
});