require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticationMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(authenticationMiddleware);

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

// Register routes
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/students', studentsRouter);
app.use('/institutes', instituteRouter);
app.use('/faculty', facultyRouter);
app.use('/mentor', mentorRouter);
app.use('/companies', companiesRouter);
app.use('/jobs', jobsRouter);
app.use('/logbook', logbookRouter);
app.use('/roadmaps', roadmapsRouter);
app.use('/internship-management', internshipMgmtRouter);
app.use('/internships', internshipsRouter);
app.use('/test', testRouter);
app.use('/chat', chatRouter);
app.use('/notifications', notificationsRouter);
app.use('/applications', applicationRoutes);
app.use('/certifications', certificationsRouter);


// ============================================
// CREATE HTTP SERVER & SOCKET.IO
// ============================================
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // Allow all origins for now
    methods: ["GET", "POST"]
  }
});

// Setup WebSocket chat
setupChatSocket(io);

// Make io accessible in routes
app.set('io', io);

// ============================================
// HOME ROUTE
// ============================================
app.get('/', (req, res) => {
  res.json({ 
    message: 'EduSphere Platform API with WebSocket',
    status: 'running',
    version: '2.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/auth',
      users: '/users',
      students: '/students',
      institutes: '/institutes',
      faculty: '/faculty',
      mentor: '/mentor',
      companies: '/companies',
      jobs: '/jobs',
      logbook: '/logbook',
      roadmaps: '/roadmaps',
      internships: '/internships',
      internshipManagement: '/internship-management',
      applications: '/applications',
      certifications: '/certifications',
      chat: '/chat',
      notifications: '/notifications',
      test: '/test'
    },
    websocket: `ws://localhost:${PORT}`
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================



app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});



httpServer.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ WebSocket server ready`);
  console.log(`📡 REST API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
});