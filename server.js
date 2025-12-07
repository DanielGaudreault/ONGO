// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

// User tracking
const users = {};
const waitingUsers = [];
const activeChats = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);
  
  // Add user to waiting list
  socket.on('find-partner', (userData) => {
    users[socket.id] = {
      id: socket.id,
      interests: userData.interests || [],
      language: userData.language || 'en'
    };
    
    // Find matching partner
    findPartner(socket);
  });
  
  // Handle messages
  socket.on('send-message', (data) => {
    const partnerId = activeChats.get(socket.id);
    if (partnerId && io.sockets.sockets.get(partnerId)) {
      io.to(partnerId).emit('receive-message', {
        text: data.text,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    const partnerId = activeChats.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-typing', isTyping);
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const partnerId = activeChats.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected');
      activeChats.delete(partnerId);
    }
    
    activeChats.delete(socket.id);
    delete users[socket.id];
    
    // Remove from waiting list
    const index = waitingUsers.indexOf(socket.id);
    if (index > -1) {
      waitingUsers.splice(index, 1);
    }
  });
  
  // Skip/next partner
  socket.on('skip-partner', () => {
    const partnerId = activeChats.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-skipped');
      activeChats.delete(partnerId);
      activeChats.delete(socket.id);
      
      // Find new partners for both
      setTimeout(() => {
        findPartner(socket);
        if (io.sockets.sockets.get(partnerId)) {
          findPartner(io.sockets.sockets.get(partnerId));
        }
      }, 500);
    }
  });
});

function findPartner(socket) {
  // Remove from any existing chat
  const existingPartner = activeChats.get(socket.id);
  if (existingPartner) {
    activeChats.delete(existingPartner);
    activeChats.delete(socket.id);
  }
  
  // Find match from waiting users
  if (waitingUsers.length > 0 && waitingUsers[0] !== socket.id) {
    const partnerId = waitingUsers.shift();
    
    // Check if partner is still available
    if (io.sockets.sockets.get(partnerId)) {
      activeChats.set(socket.id, partnerId);
      activeChats.set(partnerId, socket.id);
      
      // Notify both users
      io.to(socket.id).emit('partner-found');
      io.to(partnerId).emit('partner-found');
      
      console.log(`Matched ${socket.id} with ${partnerId}`);
      return;
    }
  }
  
  // Add to waiting list if no partner found
  if (!waitingUsers.includes(socket.id)) {
    waitingUsers.push(socket.id);
    socket.emit('searching', { count: waitingUsers.length });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
