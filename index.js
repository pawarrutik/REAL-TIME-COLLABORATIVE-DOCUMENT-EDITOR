const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Document = require('./models/Document');

const app = express();
const server = http.createServer(app);

// 🧠 Use CORS for frontend communication
app.use(cors());

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // frontend URL
    methods: ['GET', 'POST']
  }
});

// 🔌 Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/collab-editor', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 📄 Load initial document content from DB
let documentContent = '';
Document.findOne().then(doc => {
  if (doc) {
    documentContent = doc.content;
  } else {
    Document.create({ content: '' });
    console.log('📝 Created new blank document in DB');
  }
});

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // 📨 Send current document to new user
  socket.emit('document', documentContent);

  // ✏️ Listen for edits and broadcast to others
  socket.on('edit', async (newContent) => {
    documentContent = newContent;
    socket.broadcast.emit('document', newContent);

    try {
      const doc = await Document.findOne();
      if (doc) {
        doc.content = newContent;
        await doc.save();
        console.log('💾 Document updated in MongoDB');
      }
    } catch (err) {
      console.error('❌ Error saving to MongoDB:', err);
    }
  });

  // 💾 Manual Save Trigger (from Save button)
  socket.on('save', async () => {
    try {
      const doc = await Document.findOne();
      if (doc) {
        doc.content = documentContent;
        await doc.save();
        socket.emit('saved', '✅ Document saved to database!');
        console.log('📥 Document saved manually by user');
      }
    } catch (err) {
      console.error('❌ Error saving document manually:', err);
      socket.emit('saved', '❌ Failed to save document.');
    }
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

server.listen(5000, () => {
  console.log('🚀 Server running at http://localhost:5000');
});
