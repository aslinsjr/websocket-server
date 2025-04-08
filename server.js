const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Configuração do Express
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  maxHttpBufferSize: 5e6 // 5MB - aumentado para suportar imagens
});

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Lista para armazenar usuários conectados
const users = {};

// Configuração do Socket.IO
io.on('connection', (socket) => {
  console.log('Novo usuário conectado');

  // Quando um usuário entra no chat
  socket.on('user-join', (username) => {
    users[socket.id] = username;
    socket.broadcast.emit('user-connected', username);
    io.emit('update-users', Object.values(users));
  });

  // Quando um usuário envia uma mensagem
  socket.on('send-message', (messageData) => {
    io.emit('new-message', {
      message: messageData,
      user: users[socket.id],
      time: new Date().toLocaleTimeString()
    });
  });

  // Quando um usuário está digitando
  socket.on('typing', () => {
    socket.broadcast.emit('user-typing', users[socket.id]);
  });

  // Quando um usuário para de digitar
  socket.on('stop-typing', () => {
    socket.broadcast.emit('user-stop-typing');
  });

  // Quando um usuário desconecta
  socket.on('disconnect', () => {
    socket.broadcast.emit('user-disconnected', users[socket.id]);
    delete users[socket.id];
    io.emit('update-users', Object.values(users));
    console.log('Usuário desconectado');
  });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});