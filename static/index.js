document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const welcomeMessage = document.querySelector('.welcome-message');
    
    let isFirstMessage = true;

    // Scroll xuống dưới cùng khi load
    scrollToBottom();

    // Event listeners
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Gợi ý nhanh từ welcome message và suggestions
    setupQuickPrompts();

    // Auto-focus input
    userInput.focus();

    function setupQuickPrompts() {
        const topicTags = document.querySelectorAll('.topic-tag');
        topicTags.forEach(tag => {
            tag.addEventListener('click', () => {
                const prompt = tag.getAttribute('data-prompt');
                sendQuickPrompt(prompt);
            });
        });

        const suggestions = document.querySelectorAll('.suggestion');
        suggestions.forEach(suggestion => {
            suggestion.addEventListener('click', () => {
                const prompt = suggestion.getAttribute('data-prompt');
                sendQuickPrompt(prompt);
            });
        });
    }

    function sendQuickPrompt(prompt) {
        userInput.value = prompt;
        sendMessage();
    }

    async function sendMessage() {
        const prompt = userInput.value.trim();
        if (!prompt) return;

        // Ẩn welcome message sau khi gửi tin nhắn đầu tiên
        if (isFirstMessage && welcomeMessage) {
            welcomeMessage.style.display = 'none';
            isFirstMessage = false;
        }

        // Vô hiệu hóa input và button
        setInputState(false);

        // Thêm user message vào UI
        addMessage('user', prompt);
        userInput.value = '';

        // Hiển thị loading indicator
        const loadingElement = showLoading();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (!response.ok) {
                throw new Error(`Lỗi server: ${response.statusText}`);
            }

            // Xử lý response như stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let messageRow = null;
            let textDiv = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                fullText += chunk;

                if (!messageRow) {
                    hideLoading(loadingElement);
                    messageRow = addMessage('assistant', '', false);
                    textDiv = messageRow.querySelector('.message-text');
                }

                try {
                    textDiv.innerHTML = marked.parse(fullText);
                } catch (e) {
                    console.error('Error parsing Markdown:', e);
                    textDiv.innerHTML = fullText; // Fallback to plain text
                }
                scrollToBottom();
            }

        } catch (error) {
            console.error('Error:', error);
            hideLoading(loadingElement);
            addMessage('assistant', '❌ Lỗi kết nối server. Vui lòng thử lại.');
        } finally {
            setInputState(true);
            userInput.focus();
        }
    }

    function addMessage(role, content, isMarkdown = true) {
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${role}-row`;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = `<i class="bi ${role === 'user' ? 'bi-person-fill' : 'bi-robot'}"></i>`;

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';

        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = isMarkdown ? marked.parse(content) : content;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = getCurrentTime();

        messageContent.appendChild(textDiv);
        messageContent.appendChild(timeDiv);

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messageRow.appendChild(messageDiv);
        
        chatMessages.appendChild(messageRow);
        scrollToBottom();
        return messageRow;
    }

    function showLoading() {
        const loadingRow = document.createElement('div');
        loadingRow.className = 'loading-row';

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'loading-avatar';
        avatar.innerHTML = '<i class="bi bi-robot"></i>';

        const loadingContent = document.createElement('div');
        loadingContent.className = 'loading-content';

        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';

        loadingContent.appendChild(typingIndicator);
        loadingDiv.appendChild(avatar);
        loadingDiv.appendChild(loadingContent);
        loadingRow.appendChild(loadingDiv);
        
        chatMessages.appendChild(loadingRow);
        scrollToBottom();
        return loadingRow;
    }

    function hideLoading(loadingElement) {
        if (loadingElement) {
            loadingElement.remove();
        }
    }

    function setInputState(enabled) {
        userInput.disabled = !enabled;
        sendButton.disabled = !enabled;
        
        if (enabled) {
            sendButton.innerHTML = '<i class="bi bi-send-fill"></i>';
        } else {
            sendButton.innerHTML = '<i class="bi bi-hourglass-split"></i>';
        }
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function getCurrentTime() {
        return new Date().toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
});