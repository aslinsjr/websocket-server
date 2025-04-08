document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    // Elementos do DOM
    const loginScreen = document.getElementById('login-screen');
    const chatScreen = document.getElementById('chat-screen');
    const loginForm = document.getElementById('login-form');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages');
    const typingStatus = document.getElementById('typing-status');
    const usersList = document.getElementById('users');
    const userCount = document.getElementById('user-count');
    const emojiButton = document.getElementById('emoji-button');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const fileUpload = document.getElementById('file-upload');
    
    let username = '';
    let typingTimeout;
    let selectedImage = null;
    
    // Inicializa o seletor de emojis
    const emojiPicker = document.createElement('emoji-picker');
    emojiPickerContainer.appendChild(emojiPicker);
    
    // Login
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      username = document.getElementById('username').value.trim();
      
      if (username) {
        // Esconde a tela de login e mostra o chat
        loginScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        
        // Emite evento para o servidor informando que o usuário entrou
        socket.emit('user-join', username);
        
        // Adiciona mensagem de boas-vindas
        addSystemMessage(`Bem-vindo ao chat, ${username}!`);
      }
    });
    
    // Envio de mensagem
    messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = messageInput.value.trim();
      
      // Verifica se tem mensagem ou imagem para enviar
      if (message || selectedImage) {
        // Envia mensagem para o servidor
        socket.emit('send-message', {
          text: message,
          image: selectedImage
        });
        
        // Limpa o campo de entrada e a imagem selecionada
        messageInput.value = '';
        removeImagePreview();
        
        // Emite evento para parar de digitar
        socket.emit('stop-typing');
      }
    });
    
    // Evento de digitação
    let isTyping = false;
    messageInput.addEventListener('input', () => {
      if (!isTyping) {
        // Emite evento informando que está digitando
        socket.emit('typing');
        isTyping = true;
      }
      
      // Limpa o timeout anterior
      clearTimeout(typingTimeout);
      
      // Define novo timeout para parar de digitar após 2 segundos sem atividade
      typingTimeout = setTimeout(() => {
        socket.emit('stop-typing');
        isTyping = false;
      }, 2000);
    });
    
    // Controlador do seletor de emojis
    emojiButton.addEventListener('click', () => {
      emojiPickerContainer.classList.toggle('hidden');
    });
    
    // Fechar o seletor de emojis quando clicar fora dele
    document.addEventListener('click', (e) => {
      if (!emojiPickerContainer.contains(e.target) && 
          e.target !== emojiButton && 
          !emojiButton.contains(e.target)) {
        emojiPickerContainer.classList.add('hidden');
      }
    });
    
    // Selecionar um emoji
    emojiPicker.addEventListener('emoji-click', event => {
      const emoji = event.detail.unicode;
      messageInput.value += emoji;
      messageInput.focus();
      emojiPickerContainer.classList.add('hidden');
    });
    
    // Upload de imagem
    fileUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file && file.type.match('image.*')) {
        const reader = new FileReader();
        
        reader.onload = function(event) {
          // Converte a imagem para base64 para enviar pela websocket
          selectedImage = event.target.result;
          
          // Mostra a pré-visualização da imagem
          showImagePreview(selectedImage);
        };
        
        reader.readAsDataURL(file);
      }
    });
    
    // Escuta evento de nova mensagem
    socket.on('new-message', (data) => {
      // Verifica se a mensagem é do próprio usuário
      const messageType = data.user === username ? 'sent' : 'received';
      
      // Adiciona a mensagem ao chat
      addMessage(data.user, data.message.text, data.message.image, data.time, messageType);
      
      // Rola para a mensagem mais recente
      scrollToBottom();
    });
    
    // Escuta evento de usuário conectado
    socket.on('user-connected', (user) => {
      addSystemMessage(`${user} entrou no chat.`);
    });
    
    // Escuta evento de usuário desconectado
    socket.on('user-disconnected', (user) => {
      if (user) {
        addSystemMessage(`${user} saiu do chat.`);
      }
    });
    
    // Escuta evento de usuário digitando
    socket.on('user-typing', (user) => {
      typingStatus.textContent = `${user} está digitando...`;
    });
    
    // Escuta evento de usuário parou de digitar
    socket.on('user-stop-typing', () => {
      typingStatus.textContent = '';
    });
    
    // Escuta evento de atualização de usuários
    socket.on('update-users', (users) => {
      // Atualiza contagem de usuários
      userCount.textContent = users.length;
      
      // Limpa a lista de usuários
      usersList.innerHTML = '';
      
      // Adiciona cada usuário à lista
      users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user === username ? `${user} (você)` : user;
        usersList.appendChild(li);
      });
    });
    
    // Função para adicionar mensagem ao chat
    function addMessage(user, text, image, time, type) {
      const messageElement = document.createElement('div');
      messageElement.className = `message ${type}`;
      
      const userElement = document.createElement('div');
      userElement.className = 'user-name';
      userElement.textContent = type === 'sent' ? 'Você' : user;
      
      const timeElement = document.createElement('div');
      timeElement.className = 'time';
      timeElement.textContent = time;
      
      messageElement.appendChild(userElement);
      
      // Adiciona texto se houver
      if (text) {
        const contentElement = document.createElement('div');
        contentElement.className = 'message-content';
        // Processa emojis, converte texto Unicode para emoji renderizado
        contentElement.innerHTML = convertEmoji(text);
        messageElement.appendChild(contentElement);
      }
      
      // Adiciona imagem se houver
      if (image) {
        const imageElement = document.createElement('img');
        imageElement.src = image;
        imageElement.className = 'message-image';
        imageElement.addEventListener('click', () => {
          // Abre a imagem em uma nova aba em tamanho real
          window.open(image, '_blank');
        });
        messageElement.appendChild(imageElement);
      }
      
      messageElement.appendChild(timeElement);
      messagesContainer.appendChild(messageElement);
      
      // Rola para a mensagem mais recente
      scrollToBottom();
    }
    
    // Função para adicionar mensagem do sistema
    function addSystemMessage(message) {
      const systemMessage = document.createElement('div');
      systemMessage.className = 'system-message';
      systemMessage.textContent = message;
      messagesContainer.appendChild(systemMessage);
      scrollToBottom();
    }
    
    // Função para mostrar pré-visualização da imagem
    function showImagePreview(imageData) {
      // Remove qualquer pré-visualização existente
      removeImagePreview();
      
      // Cria o container de pré-visualização
      const previewContainer = document.createElement('div');
      previewContainer.className = 'image-preview';
      previewContainer.id = 'image-preview';
      
      // Adiciona a imagem
      const previewImg = document.createElement('img');
      previewImg.src = imageData;
      previewContainer.appendChild(previewImg);
      
      // Adiciona o botão de remover
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remover';
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        removeImagePreview();
      });
      previewContainer.appendChild(removeBtn);
      
      // Adiciona antes do formulário de mensagem
      messageForm.insertBefore(previewContainer, messageForm.firstChild);
    }
    
    // Função para remover pré-visualização da imagem
    function removeImagePreview() {
      const preview = document.getElementById('image-preview');
      if (preview) {
        preview.remove();
      }
      selectedImage = null;
      fileUpload.value = '';
    }
    
    // Função para rolar para a última mensagem
    function scrollToBottom() {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Função para converter texto de emoji para HTML renderizado
    function convertEmoji(text) {
      // Apenas retorna o texto, pois os emojis Unicode já são renderizados naturalmente
      return text;
    }
  });