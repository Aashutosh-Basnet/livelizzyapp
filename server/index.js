const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { fakeComments, generateFakeComment } = require('./constants');
const geoip = require('geoip-lite');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
        transports: ['websocket', 'polling']
    },
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000
});

// Add security middleware
app.use(helmet()); // Adds various HTTP headers for security
app.use(xss()); // Sanitize inputs

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Add CORS options
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://r4mb4ww9-5173.inc1.devtunnels.ms',
  'https://r4mb4ww9-3001.inc1.devtunnels.ms'
];

const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('.devtunnels.ms')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

app.use(express.json());

// Authentication middleware
const authenticate = (req, res, next) => {
    const { username, password } = req.body;
    
    // Rate limiting for login attempts
    const ip = req.ip;
    const now = Date.now();
    loginAttempts.set(ip, (loginAttempts.get(ip) || 0) + 1);
    
    if (loginAttempts.get(ip) > 50) {
        return res.status(429).json({ message: 'Too many login attempts' });
    }

    // Compare with hardcoded credentials temporarily
    if (username === 'admin' && password === '12345') {
        next();
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

let activeViewers = new Map(); // { socketId: { username, ip, country } }
let streamActive = false;
const chatHistory = [];
const MAX_CHAT_HISTORY = 100;
let botInterval = null;
const BOT_DELAY_MIN = 3000;  // 5 seconds minimum
const BOT_DELAY_MAX = 10000; // 15 seconds maximum

const generateBotMessage = () => {
  const fakeComment = generateFakeComment();
  return {
    ...fakeComment,
    timestamp: new Date().toISOString(),
    id: Math.random().toString(36).substr(2, 9)
  };
};

// Admin route for streamer authentication
app.post('/admin/auth', authenticate, (req, res) => {
    res.json({ success: true });
});

const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: '12345'
};

app.post('/api/admin/login', (req, res) => {
    console.log('Login attempt:', req.body); // Log the incoming request
    
    const { username, password } = req.body;
    
    // Check if username and password are provided
    if (!username || !password) {
        console.log('Missing credentials');
        return res.status(400).json({ 
            success: false, 
            message: 'Username and password are required' 
        });
    }

    // Check credentials
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        console.log('Login successful');
        res.json({ success: true });
    } else {
        console.log('Login failed - Invalid credentials');
        res.status(401).json({ 
            success: false, 
            message: 'Invalid credentials' 
        });
    }
});

// Enhanced WebRTC configuration for cross-network compatibility
const iceServers = {
  iceServers: [
    // STUN servers for NAT traversal
    { 
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302'
      ]
    },
    // TURN servers for fallback when STUN fails
    {
      urls: [
        'turn:numb.viagenie.ca:3478',
        'turn:numb.viagenie.ca:3478?transport=tcp', // TCP fallback
        'turns:numb.viagenie.ca:443' // TURNS for TLS
      ],
      username: 'webrtc@live.com',
      credential: 'muazkh'
    }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // Try both UDP and TCP
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

// Enhanced peer connection options
const peerConnectionConfig = {
  enableDtlsSrtp: true, // Enable DTLS for secure communication
  sdpSemantics: 'unified-plan',
  iceServers: iceServers
};

// Add rate limiting for socket connections
const socketRateLimit = {
  messageCount: 0,
  lastReset: Date.now(),
  blocked: false
};

// Reset rate limit every minute
const resetInterval = setInterval(() => {
  socketRateLimit.messageCount = 0;
  socketRateLimit.lastReset = Date.now();
  socketRateLimit.blocked = false;
}, 60000);

// Bot message functionality
const BOT_MESSAGES = [
  'Hello, how are you?',
  'What\'s up?',
  'How\'s it going?',
  'Hi, I\'m a bot!',
  'What\'s on your mind?'
];

const startBotMessages = () => {
    if (botInterval) {
        clearInterval(botInterval);
    }

    const sendBotMessage = () => {
        const randomMessage = BOT_MESSAGES[Math.floor(Math.random() * BOT_MESSAGES.length)];
        const botMessage = {
            username: 'Bot',
            message: randomMessage,
            timestamp: new Date().toISOString(),
            id: Math.random().toString(36).substr(2, 9)
        };

        chatHistory.push(botMessage);
        if (chatHistory.length > MAX_CHAT_HISTORY) {
            chatHistory.shift();
        }

        io.emit('chat:message', botMessage);
    };

    // Send first message immediately
    sendBotMessage();
    // Then send messages every 30 seconds
    botInterval = setInterval(sendBotMessage, 30000);
};

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Handle admin streaming
    socket.on('stream:start', () => {
        console.log('Admin started streaming');
        streamActive = true;
        socket.join('admin-room');
        socket.to('viewer-room').emit('stream-available', { streamerId: socket.id });
        startBotMessages();
    });

    socket.on('stream:end', () => {
        streamActive = false;
        if (botInterval) {
            clearInterval(botInterval);
        }
        socket.to('viewer-room').emit('stream-ended');
    });

    // Handle viewer joining
    socket.on('viewer:join', (username) => {
        console.log('Viewer joined:', username);
        const ip = socket.handshake.address;
        const geo = geoip.lookup(ip) || { country: 'Unknown' };
        
        activeViewers.set(socket.id, {
            username,
            country: geo.country,
            ip: ip
        });

        socket.join('viewer-room');
        
        // Update viewer counts
        io.emit('viewers:update', {
            count: activeViewers.size,
            viewers: Array.from(activeViewers.values())
        });

        // If admin is streaming, notify the new viewer
        if (io.sockets.adapter.rooms.get('admin-room')?.size > 0) {
            const adminId = Array.from(io.sockets.adapter.rooms.get('admin-room'))[0];
            socket.emit('stream-available', { streamerId: adminId });
        }
    });

    // Handle WebRTC signaling
    socket.on('offer', ({ offer, streamerId }) => {
        console.log('Relaying offer to streamer');
        socket.to(streamerId).emit('offer', { offer, viewerId: socket.id });
    });

    socket.on('answer', ({ answer, viewerId }) => {
        console.log('Relaying answer to viewer');
        socket.to(viewerId).emit('answer', { answer });
    });

    socket.on('ice-candidate', ({ candidate, streamerId, viewerId }) => {
        console.log('Relaying ICE candidate');
        if (streamerId) {
            socket.to(streamerId).emit('ice-candidate', { candidate, viewerId: socket.id });
        } else if (viewerId) {
            socket.to(viewerId).emit('ice-candidate', { candidate });
        }
    });

    // Handle chat messages
    socket.on('chat:message', (messageData) => {
        try {
            // Validate and sanitize message
            const sanitizedMessage = {
                username: messageData.username,
                message: messageData.message,
                timestamp: new Date().toISOString(),
                id: messageData.id || Math.random().toString(36).substr(2, 9)
            };

            // Add to history
            chatHistory.push(sanitizedMessage);
            if (chatHistory.length > MAX_CHAT_HISTORY) {
                chatHistory.shift();
            }

            // Broadcast to all clients
            io.emit('chat:message', sanitizedMessage);
        } catch (error) {
            console.error('Error handling chat message:', error);
        }
    });

    socket.on('chat:history', () => {
        socket.emit('chat:history', chatHistory);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        activeViewers.delete(socket.id);
        
        io.emit('viewers:update', {
            count: activeViewers.size,
            viewers: Array.from(activeViewers.values())
        });
    });
});

// Cleanup function for when server shuts down
process.on('SIGINT', () => {
    if (botInterval) {
        clearInterval(botInterval);
    }
    process.exit();
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});