// Глобальное состояние приложения
const app = {
    currentUser: null,
    token: null,
    posts: [],
    currentScreen: 'auth',
    theme: 'light',
    socket: null,
    viewedUserId: null
};

// API базовый URL
const API_URL = window.location.origin + '/api';

function looksLikeId(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const hex24Regex = /^[0-9a-fA-F]{24}$/;
    const digitsRegex = /^\d+$/;
    return uuidRegex.test(trimmed) || hex24Regex.test(trimmed) || digitsRegex.test(trimmed);
}

// Поиск пользователей
async function handleSearch(input) {
    const rawValue = typeof input === 'string' ? input : input?.target?.value || '';
    const query = rawValue.trim().toLowerCase();
    
    if (!query) {
        showScreen('feed');
        return;
    }
    if (query.length < 2) {
        displaySearchMessage('Введите минимум 2 символа для поиска');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            displaySearchResults(users);
            showScreen('search');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка поиска', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Поиск пользователей
async function handleSearch(e) {
    const query = typeof e === 'string' ? e : e.target.value.trim();
    
    console.log('Поиск:', query); // Отладка
    
    if (!query) {
        displaySearchMessage('Введите имя пользователя для поиска');
        return;
    }
    
    // Переключаемся на экран поиска
    showScreen('search');
    
    try {
        const url = `${API_URL}/users/search?q=${encodeURIComponent(query)}`;
        console.log('URL запроса:', url); // Отладка
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        console.log('Статус ответа:', response.status); // Отладка
        
        if (response.ok) {
            const users = await response.json();
            console.log('Найденные пользователи:', users); // Отладка
            displaySearchResults(users);
        } else {
            const data = await response.json();
            console.log('Ошибка поиска:', data); // Отладка
            showNotification(data.error || 'Ошибка поиска', 'error');
        }
    } catch (error) {
        console.log('Ошибка соединения:', error); // Отладка
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

function displaySearchResults(users) {
    console.log('displaySearchResults вызван с пользователями:', users); // Отладка
    
    const container = document.getElementById('searchResultsContainer');
    console.log('Контейнер найден:', container); // Отладка
    
    if (!container) {
        console.error('Контейнер searchResultsContainer не найден!'); // Отладка
        return;
    }
    
    if (users.length === 0) {
        container.innerHTML = '<p class="search-hint">Пользователи не найдены</p>';
        return;
    }
    
    console.log('Создаем HTML для пользователей...'); // Отладка
    
    const resultsHtml = users.map(user => `
        <div class="search-result-item" data-user-id="${user.id}">
            <div class="search-result-avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" />` : `<div class="avatar-placeholder">${user.name.charAt(0).toUpperCase()}</div>`}
            </div>
            <div class="search-result-info">
                <div class="search-result-name">${user.name}</div>
                <div class="search-result-username">@${user.username}</div>
            </div>
            <div class="search-result-actions">
                <button class="btn-primary btn-sm" onclick="viewUserProfile('${user.id}')">Профиль</button>
                <button class="btn-secondary btn-sm follow-btn" data-user-id="${user.id}">Подписаться</button>
            </div>
        </div>
    `).join('');
    
    console.log('HTML создан:', resultsHtml); // Отладка
    
    container.innerHTML = resultsHtml;
    
    // Добавляем обработчики кликов
    container.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Не обрабатываем клик на кнопки
            if (e.target.tagName === 'BUTTON') return;
            
            const userId = item.dataset.userId;
            console.log('Клик на пользователя:', userId); // Отладка
            viewUserProfile(userId);
        });
    });
    
    // Добавляем обработчики для кнопок подписки
    container.querySelectorAll('.follow-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const userId = btn.dataset.userId;
            toggleFollow(userId);
        });
    });
    
    console.log('Обработчики кликов добавлены'); // Отладка
}

function displaySearchMessage(message) {
    const container = document.getElementById('searchResultsContainer');
    if (container) {
        container.innerHTML = `<p class="search-hint">${message}</p>`;
    }
}

function resolveId(entity) {
    if (!entity) return null;
    if (typeof entity === 'string') {
        return looksLikeId(entity) ? entity.trim() : null;
    }
    return entity.id || entity._id || entity.user_id || entity.userId || null;
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    
    // Инициализация Socket.IO только для серверной версии (порт 3000)
    const isPort3000 = window.location.port === '3000';
    if (isPort3000) {
        initializeSocket();
    }
});

// Инициализация Socket.IO
function initializeSocket() {
    app.socket = io();
    
    app.socket.on('connect', () => {
        console.log('Подключено к серверу');
        if (app.token) {
            app.socket.emit('authenticate', app.token);
        }
    });
    
    app.socket.on('new_post', (post) => {
        if (app.currentScreen === 'feed') {
            addPostToFeed(post);
        }
    });
    
    app.socket.on('post_reaction', (data) => {
        updatePostReactions(data.postId, data.reactions);
    });
    
    app.socket.on('new_comment', (data) => {
        addCommentToPost(data.postId, data.comment);
    });
    
    app.socket.on('notification', (notification) => {
        showNotification(notification.message, 'info');
    });
    
    app.socket.on('banned', (data) => {
        showNotification(data.message || 'Ваш аккаунт был заблокирован', 'error');
        // Принудительный выход
        setTimeout(() => {
            localStorage.removeItem('clone_token');
            app.token = null;
            app.currentUser = null;
            
            if (app.socket) {
                app.socket.disconnect();
                app.socket = null;
            }
            
            document.getElementById('mainApp').classList.remove('active');
            document.getElementById('authScreen').classList.add('active');
            
            showNotification('Вы были забанены и вышли из аккаунта', 'error');
        }, 2000);
    });
    
    app.socket.on('post_deleted', (data) => {
        // Удаляем пост из DOM если он отображается
        const postElement = document.querySelector(`[data-post-id="${data.postId}"]`);
        if (postElement) {
            postElement.remove();
            showNotification('Пост был удален администратором', 'info');
        }
    });
}

// Инициализация
function initializeApp() {
    loadTheme();
    loadSnowSettings();
    
    // Проверка на локальную работу (только для разработки)
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isNotPort3000 = !window.location.port || window.location.port !== '3000';
    
    if (isLocalDev && isNotPort3000) {
        // Локальная работа - проверяем сохраненного пользователя
        const currentUser = localStorage.getItem('clone_current_user');
        if (currentUser) {
            const user = JSON.parse(currentUser);
            if (!user.banned) {
                app.currentUser = user;
                console.log('Пользователь восстановлен из localStorage:', user);
                showMainApp();
                
                // Инициализируем мессенджер для восстановленного пользователя
                console.log('Инициализируем мессенджер для восстановленного пользователя');
                initMessenger();
                setupChatWebSocket();
                
                return;
            } else {
                localStorage.removeItem('clone_current_user');
            }
        }
        return;
    }
    
    // Работа с сервером (продакшн или порт 3000)
    const savedToken = localStorage.getItem('clone_token');
    if (savedToken) {
        app.token = savedToken;
        verifyToken();
    } else {
        // На продакшене без токена пробуем localStorage
        const currentUser = localStorage.getItem('clone_current_user');
        if (currentUser) {
            const user = JSON.parse(currentUser);
            if (!user.banned) {
                app.currentUser = user;
                showMainApp();
                showNotification('Сессия восстановлена', 'success');
            } else {
                localStorage.removeItem('clone_current_user');
            }
        }
    }
}

// Проверка токена
async function verifyToken() {
    // Проверка на локальную работу (только для разработки)
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isNotPort3000 = !window.location.port || window.location.port !== '3000';
    
    if (isLocalDev && isNotPort3000) {
        // Локальная работа через localStorage
        const currentUser = localStorage.getItem('clone_current_user');
        if (currentUser) {
            const user = JSON.parse(currentUser);
            if (user.banned) {
                showNotification('Ваш аккаунт заблокирован', 'error');
                localStorage.removeItem('clone_current_user');
                return;
            }
            app.currentUser = user;
            showMainApp();
        }
        return;
    }
    
    // Работа с сервером (продакшн или порт 3000)
    try {
        const response = await fetch(`${API_URL}/me`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            
            // Проверяем, не забанен ли пользователь
            if (userData.banned) {
                showNotification('Ваш аккаунт заблокирован', 'error');
                localStorage.removeItem('clone_token');
                app.token = null;
                return;
            }
            
            app.currentUser = userData;
            console.log('Токен верифицирован, пользователь:', userData);
            showMainApp();
            
            // Инициализируем мессенджер после верификации токена
            console.log('Инициализируем мессенджер после верификации токена');
            initMessenger();
            setupChatWebSocket();
        } else {
            localStorage.removeItem('clone_token');
            app.token = null;
        }
    } catch (error) {
        // Если API недоступен на продакшене, пробуем localStorage
        console.log('API недоступен, пробую localStorage');
        const currentUser = localStorage.getItem('clone_current_user');
        if (currentUser) {
            const user = JSON.parse(currentUser);
            if (!user.banned) {
                app.currentUser = user;
                console.log('Пользователь восстановлен в оффлайн режиме:', user);
                showMainApp();
                showNotification('Вход выполнен (оффлайн режим)', 'success');
                
                // Инициализируем мессенджер в оффлайн режиме
                console.log('Инициализируем мессенджер в оффлайн режиме');
                initMessenger();
                setupChatWebSocket();
            } else {
                localStorage.removeItem('clone_current_user');
            }
        } else {
            console.error('Ошибка проверки токена:', error);
            localStorage.removeItem('clone_token');
            app.token = null;
        }
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Аутентификация
    document.getElementById('loginFormElement').addEventListener('submit', handleLogin);
    document.getElementById('registerFormElement').addEventListener('submit', handleRegister);
    
    // Переключение форм
    document.getElementById('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        switchToRegister();
    });
    
    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        switchToLogin();
    });
    // Навигация
    document.getElementById('feedBtn').addEventListener('click', () => showScreen('feed'));
    document.getElementById('profileBtn').addEventListener('click', () => {
        if (app.currentUser) {
            // Для своего профиля используем updateProfileInfo вместо showUserProfile
            showScreen('profile');
            updateProfileInfo();
        } else {
            showScreen('profile');
        }
    });
    
    // Посты
    const publishPostBtn = document.getElementById('publishPostBtn');
    if (publishPostBtn) {
        publishPostBtn.addEventListener('click', createPost);
    }

    const attachMediaBtn = document.getElementById('attachMediaBtn');
    if (attachMediaBtn) {
        attachMediaBtn.addEventListener('click', () => {
            document.getElementById('mediaInput').click();
        });
    }

    const mediaInput = document.getElementById('mediaInput');
    if (mediaInput) {
        mediaInput.addEventListener('change', handleMediaAttach);
    }
    
    // Профиль
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });
    }

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarChange);
    }

    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', toggleInlineProfileEdit);
    }

    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfile);
    }

    const followProfileBtn = document.getElementById('followProfileBtn');
    if (followProfileBtn) {
        followProfileBtn.addEventListener('click', () => {
            const targetId = followProfileBtn.dataset.userId;
            if (targetId) {
                toggleFollow(targetId);
            }
        });
    }

    const saveInlineBtn = document.getElementById('saveInlineProfileBtn');
    if (saveInlineBtn) {
        saveInlineBtn.addEventListener('click', saveInlineProfile);
    }
    
    const cancelInlineBtn = document.getElementById('cancelInlineProfileBtn');
    if (cancelInlineBtn) {
        cancelInlineBtn.addEventListener('click', cancelInlineProfileEdit);
    }
    
    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    document.getElementById('searchBtn').addEventListener('click', () => {
        if (!searchInput) return;
        const query = searchInput.value.trim();
        if (query) {
            handleSearch(query);
        }
    });
    document.getElementById('refreshFeed').addEventListener('click', refreshFeed);
    
    // Уведомления
    document.getElementById('notificationsBtn').addEventListener('click', openNotifications);
    document.getElementById('closeNotifications').addEventListener('click', closeNotifications);
    document.getElementById('markAllAsReadBtn').addEventListener('click', markAllAsRead);
    
    // Настройки
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('updateAccountBtn').addEventListener('click', updateAccount);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount);
    
    // Тема
    document.getElementById('themeToggleSwitch').addEventListener('change', toggleTheme);
    
    // Снег
    document.getElementById('snowToggleSwitch').addEventListener('change', toggleSnow);
    
    // Админ-панель
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', openAdminPanel);
    }
    
    document.getElementById('closeAdmin').addEventListener('click', closeAdminPanel);
    document.getElementById('showAllUsersBtn').addEventListener('click', () => showAllUsers());
    document.getElementById('showBannedBtn').addEventListener('click', () => showBannedUsers());
    document.getElementById('showVerificationRequestsBtn').addEventListener('click', () => showVerificationRequests());
    document.getElementById('showVerifiedUsersBtn').addEventListener('click', () => showVerifiedUsers());
    document.getElementById('adminSearchBtn').addEventListener('click', handleAdminSearch);
    document.getElementById('adminSearchInput').addEventListener('input', handleAdminSearch);
    
    // Закрытие модальных окон по клику вне их
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').classList.remove('active');
        });
    });
    
    // Модальные окна
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('closeEditProfile').addEventListener('click', closeEditProfile);
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
        });
    });
}

// Переключение между формами входа и регистрации
function switchToRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

function switchToLogin() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

// Обработка входа
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Проверка на локальную работу (только для разработки)
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isNotPort3000 = !window.location.port || window.location.port !== '3000';
    
    if (isLocalDev && isNotPort3000) {
        // Локальная работа через localStorage
        const users = JSON.parse(localStorage.getItem('clone_users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            if (user.banned) {
                showNotification('Ваш аккаунт заблокирован', 'error');
                return;
            }
            
            app.currentUser = user;
            localStorage.setItem('clone_current_user', JSON.stringify(user));
            
            showMainApp();
            showNotification('Вход выполнен успешно!', 'success');
        } else {
            showNotification('Неверный email или пароль', 'error');
        }
        return;
    }
    
    // Работа с сервером (продакшн или порт 3000)
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Проверяем, не забанен ли пользователь
            if (data.user && data.user.banned) {
                showNotification('Ваш аккаунт заблокирован', 'error');
                return;
            }
            
            app.token = data.token;
            app.currentUser = data.user;
            localStorage.setItem('clone_token', app.token);
            localStorage.setItem('clone_current_user', JSON.stringify(data.user));
            
            console.log('Пользователь вошел, данные:', app.currentUser);
            
            showMainApp();
            showNotification('Вход выполнен успешно!', 'success');
            
            // Инициализируем мессенджер после успешного входа
            console.log('Инициализируем мессенджер после входа...');
            initMessenger();
            setupChatWebSocket();
            
            // Аутентификация в Socket.IO
            if (app.socket) {
                app.socket.emit('authenticate', app.token);
            }
        } else {
            showNotification(data.error || 'Ошибка входа', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

async function saveInlineProfile() {
    const name = document.getElementById('inlineNameInput').value.trim();
    const username = document.getElementById('inlineUsernameInput').value.trim();
    const validationError = validateNameAndUsername(name, username);
    if (validationError) {
        showNotification(validationError, 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ name, username, bio: app.currentUser.bio })
        });
        if (response.ok) {
            const data = await response.json();
            app.currentUser = data.user;
            updateProfileInfo();
            showNotification('Профиль обновлен', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка обновления профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Валидация имени и username
function validateNameAndUsername(name, username) {
    // Разрешаем только буквы (включая кириллицу), цифры и подчеркивания
    const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s]+$/;
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    
    if (!nameRegex.test(name)) {
        return 'Имя может содержать только буквы и пробелы';
    }
    
    if (!usernameRegex.test(username)) {
        return 'Username может содержать только буквы, цифры и подчеркивания';
    }
    
    return null; // Нет ошибок
}

// Обработка регистрации
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    // Валидация имени и username
    const validationError = validateNameAndUsername(name, username);
    if (validationError) {
        showNotification(validationError, 'error');
        return;
    }
    
    // Проверка на локальную работу (только для разработки)
    const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isNotPort3000 = !window.location.port || window.location.port !== '3000';
    
    if (isLocalDev && isNotPort3000) {
        // Локальная работа через localStorage
        const users = JSON.parse(localStorage.getItem('clone_users') || '[]');
        
        // Проверка на уникальность email и username
        if (users.some(u => u.email === email)) {
            showNotification('Пользователь с таким email уже существует', 'error');
            return;
        }
        
        if (users.some(u => u.username === username)) {
            showNotification('Пользователь с таким username уже существует', 'error');
            return;
        }
        
        // Создание нового пользователя
        const newUser = {
            id: Date.now().toString(),
            name,
            username,
            email,
            password,
            avatar: null,
            bio: '',
            is_verified: false,
            banned: false,
            created_at: new Date().toISOString()
        };
        
        users.push(newUser);
        localStorage.setItem('clone_users', JSON.stringify(users));
        
        app.currentUser = newUser;
        localStorage.setItem('clone_current_user', JSON.stringify(newUser));
        
        showMainApp();
        showNotification('Регистрация успешна!', 'success');
        return;
    }
    
    // Работа с сервером (продакшн или порт 3000)
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            app.token = data.token;
            app.currentUser = data.user;
            localStorage.setItem('clone_token', app.token);
            localStorage.setItem('clone_current_user', JSON.stringify(data.user));
            
            showMainApp();
            showNotification('Регистрация выполнена успешно!', 'success');
            
            // Аутентификация в Socket.IO
            if (app.socket) {
                app.socket.emit('authenticate', app.token);
            }
        } else {
            showNotification(data.error || 'Ошибка регистрации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Показ главного приложения
function showMainApp() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('mainApp').classList.add('active');
    
    updateProfileInfo();
    updateAdminButtonVisibility();
    updateUserIdDisplay();
    updateVerificationStatus();
    
    // Отладка - выводим ID пользователя в консоль
    if (app.currentUser && app.currentUser.user_id) {
        console.log('=== ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ ===');
        console.log('ID пользователя:', app.currentUser.user_id);
        console.log('Имя:', app.currentUser.name);
        console.log('Username:', app.currentUser.username);
        console.log('============================');
        
        // Показываем уведомление с ID если это не создатель
        if (app.currentUser.user_id !== '1761560316') {
            showNotification(`Ваш ID: ${app.currentUser.user_id}. Используйте этот ID для настройки прав администратора.`, 'info');
        }
    }
    
    resetPagination();
    loadPosts();
    showScreen('feed');
    
    // Инициализация infinite scroll
    setTimeout(setupInfiniteScroll, 100);
}

// Показ экранов
function showScreen(screenName) {
    app.currentScreen = screenName;
    
    // Скрыть все экраны контента
    document.querySelectorAll('.content-screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Обновить навигацию - старые и новые кнопки
    document.querySelectorAll('.nav-btn, .nav-island-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать нужный экран
    switch(screenName) {
        case 'feed':
            document.getElementById('feedScreen').classList.add('active');
            document.getElementById('feedBtn').classList.add('active');
            if (app.posts.length === 0) {
                resetPagination();
                loadPosts();
            }
            break;
        case 'profile':
            document.getElementById('profileScreen').classList.add('active');
            document.getElementById('profileBtn').classList.add('active');
            loadUserPosts();
            break;
        case 'search':
            document.getElementById('searchScreen').classList.add('active');
            break;
    }
}

// Создание поста
async function createPost() {
    const content = document.getElementById('postContent').value.trim();
    
    if (!content) {
        showNotification('Напишите что-нибудь для публикации', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('content', content);
    
    // Добавление медиа файлов
    const mediaInput = document.getElementById('mediaInput');
    if (mediaInput.files.length > 0) {
        for (let file of mediaInput.files) {
            formData.append('media', file);
        }
    }
    
    try {
        const response = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            },
            body: formData
        });
        
        if (response.ok) {
            document.getElementById('postContent').value = '';
            mediaInput.value = '';
            showNotification('Пост опубликован!', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка публикации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Загрузка постов
let currentPage = 1;
let isLoading = false;
let hasMorePosts = true;

async function loadPosts(append = false) {
    if (isLoading || (!hasMorePosts && append)) return;
    
    isLoading = true;
    
    try {
        const limit = 10;
        const url = `${API_URL}/feed?page=${currentPage}&limit=${limit}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const newPosts = await response.json();
            
            if (append) {
                app.posts = [...app.posts, ...newPosts];
                newPosts.forEach(post => {
                    const postElement = createPostElement(post);
                    document.getElementById('postsContainer').appendChild(postElement);
                });
            } else {
                app.posts = newPosts;
                renderPosts();
            }
            
            // Обновляем статистику лайков в профиле после загрузки ленты
            updateProfileLikesCount();
            
            // Если постов меньше чем limit, значит это последняя страница
            if (newPosts.length < limit) {
                hasMorePosts = false;
            } else {
                currentPage++;
            }
            
            console.log(`Загружено ${newPosts.length} постов, страница ${currentPage}`);
        } else {
            showNotification('Ошибка загрузки ленты', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    } finally {
        isLoading = false;
    }
}

// Отображение постов
function renderPosts() {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '';
    
    if (app.posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Пока нет постов</p>';
        return;
    }
    
    app.posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
}

// Добавление поста в ленту (реальное время)
function addPostToFeed(post) {
    app.posts.unshift(post);
    const container = document.getElementById('postsContainer');
    const postElement = createPostElement(post);
    container.insertBefore(postElement, container.firstChild);
}

// Infinite Scroll
function setupInfiniteScroll() {
    const container = document.getElementById('postsContainer');
    
    window.addEventListener('scroll', () => {
        if (isLoading || !hasMorePosts) return;
        
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        // Если пользователь прокрутил до 90% страницы
        if (scrollTop + clientHeight >= scrollHeight * 0.9) {
            loadPosts(true); // Загружаем следующие посты
        }
    });
}

// Сброс пагинации при обновлении ленты
function resetPagination() {
    currentPage = 1;
    isLoading = false;
    hasMorePosts = true;
}

// Создание элемента поста
function createPostElement(post) {
    const postDiv = document.createElement('div');
    postDiv.className = 'post';
    postDiv.dataset.postId = post.id;
    
    const authorId = resolveId(post.author) || post.author_id || post.authorId || post.user_id || post.userId || '';
    const authorName = post.author_name || post.authorName || post.author?.name || 'Без имени';
    const authorUsername = post.author_username || post.authorUsername || post.author?.username || 'user';
    const avatarSrc = post.author_avatar || post.authorAvatar || post.author?.avatar;
    const isVerified = post.author_is_verified || post.author?.is_verified || false;

    const avatarHtml = avatarSrc 
        ? `<img src="${avatarSrc}" alt="${authorName}" class="post-avatar-img">`
        : '<div class="avatar-placeholder">😊</div>';
    
    const mediaHtml = post.media && post.media.length > 0 
        ? post.media.map(item => `
            <div class="post-media">
                ${item.type === 'image' 
                    ? `<img src="${item.url}" alt="Изображение">`
                    : `<video src="${item.url}" controls></video>`
                }
            </div>
          `).join('')
        : '';
    
    // Показываем только реакцию "сердце"
    const heartReaction = 'heart';
    
    const users = post.reactions[heartReaction] || [];
    const isActive = users.includes(app.currentUser?.id);
    const count = users.length;
    const reactionsHtml = `<button class="reaction-btn ${isActive ? 'active' : ''}" data-reaction="${heartReaction}" data-post-id="${post.id}">
                    ❤️ ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                </button>`;
    
    const commentsCount = post.comments.length;
    const commentsHtml = post.comments.map(comment => {
        const commentId = comment.id || comment._id || '';
        return `
        <div class="comment" ${commentId ? `data-comment-id="${commentId}"` : ''}>
            <div class="comment-avatar">${comment.avatar ? `<img src="${comment.avatar}" alt="${comment.authorName}" />` : comment.authorName ? comment.authorName.charAt(0).toUpperCase() : '😊'}</div>
            <div class="comment-content">
                <div class="comment-author">${comment.authorName}</div>
                <div class="comment-text">${comment.text}</div>
            </div>
        </div>`;
    }).join('');
    
    postDiv.innerHTML = `
        <div class="post-header ${isVerified ? 'post-verified' : ''}">
            <div class="post-avatar">${avatarHtml}</div>
            <div class="post-info">
                <div class="post-author" data-user-id="${authorId}">
                    ${authorName}
                    ${isVerified ? '<span class="verified-checkmark"><svg><use href="#verified-checkmark"></use></svg></span>' : ''}
                </div>
                <div class="post-username">@${authorUsername}</div>
            </div>
            <div class="post-time">${formatTime(post.created_at || post.createdAt)}</div>
            ${isAdmin ? `<button class="delete-post-btn" onclick="deletePostByAdmin('${post.id}')" title="Удалить пост">🗑️</button>` : ''}
        </div>
        <div class="post-content">${post.content}</div>
        ${mediaHtml}
        <div class="post-actions-bar">
            ${reactionsHtml}
            <button class="comments-toggle-btn" data-post-id="${post.id}">
                💬 ${commentsCount > 0 ? `<span class="comments-count">${commentsCount}</span>` : ''}
            </button>
        </div>
        <div class="comments-section hidden">
            ${commentsHtml}
            <div class="comment-input-container">
                <input type="text" class="comment-input" placeholder="Написать комментарий..." data-post-id="${post.id}">
                <button class="comment-submit-btn" data-post-id="${post.id}">💬</button>
            </div>
        </div>
    `;
    
    const avatarImgEl = postDiv.querySelector('.post-avatar-img');
    if (avatarImgEl) {
        avatarImgEl.addEventListener('error', () => replaceWithAvatarFallback(avatarImgEl));
    }
    attachMediaFallbacks(postDiv);

    // Добавляем обработчики для реакций и комментариев
    postDiv.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            const reaction = btn.dataset.reaction;
            toggleReaction(postId, reaction);
        });
    });
    
    // Обработчик для кнопки переключения комментариев
    const commentsToggleBtn = postDiv.querySelector('.comments-toggle-btn');
    if (commentsToggleBtn) {
        commentsToggleBtn.addEventListener('click', () => {
            const postId = commentsToggleBtn.dataset.postId;
            const commentsSection = postDiv.querySelector('.comments-section');
            
            if (commentsSection.classList.contains('hidden')) {
                // Показываем комментарии с анимацией
                commentsSection.classList.remove('hidden');
                commentsToggleBtn.classList.add('active');
                commentsToggleBtn.innerHTML = '💬 <span class="comments-count">Скрыть</span>';
            } else {
                // Скрываем комментарии с анимацией
                commentsSection.classList.add('hidden');
                commentsToggleBtn.classList.remove('active');
                const count = post.comments.length;
                commentsToggleBtn.innerHTML = `💬 ${count > 0 ? `<span class="comments-count">${count}</span>` : ''}`;
            }
        });
    }
    
    // Обработчик клика на имя пользователя
    const authorElement = postDiv.querySelector('.post-author');
    if (authorElement) {
        if (authorId) {
            authorElement.addEventListener('click', () => {
                viewUserProfile(authorId);
            });
            authorElement.style.cursor = 'pointer';
            authorElement.style.color = 'var(--primary-color)';
        } else {
            authorElement.style.cursor = 'default';
        }
    }
    
    postDiv.querySelectorAll('.comment-submit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const postId = btn.dataset.postId;
            const input = postDiv.querySelector(`.comment-input[data-post-id="${postId}"]`);
            const text = input.value.trim();
            if (text) {
                addComment(postId, text);
                input.value = '';
                // Предотвращаем двойной клик
                btn.disabled = true;
                setTimeout(() => btn.disabled = false, 1000);
            }
        });
    });
    
    postDiv.querySelectorAll('.comment-input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Предотвращаем двойную отправку
                const postId = input.dataset.postId;
                const text = input.value.trim();
                if (text) {
                    addComment(postId, text);
                    input.value = '';
                }
            }
        });
    });
    
    return postDiv;
}

// Получение эмодзи для реакции
function getReactionEmoji(reaction) {
    const emojis = {
        like: '👍',
        dislike: '👎',
        heart: '❤️',
        angry: '😡',
        laugh: '😂',
        cry: '😢'
    };
    return emojis[reaction] || '👍';
}

// Переключение реакции
async function toggleReaction(postId, reactionType) {
    try {
        const response = await fetch(`${API_URL}/posts/${postId}/reactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ reaction: reactionType })
        });
        
        if (response.ok) {
            const data = await response.json();
            updatePostReactions(postId, data.reactions);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка реакции', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обновление статистики лайков в профиле
function updateProfileLikesCount() {
    if (!app.currentUser) return;
    
    const currentId = resolveId(app.currentUser);
    const likesCountElement = document.getElementById('profileLikesCount');
    
    if (!likesCountElement) return;
    
    // Считаем лайки только из постов в ленте (app.posts)
    const userPosts = app.posts.filter(post => 
        post.user_id === currentId || post.userId === currentId || 
        (post.author && resolveId(post.author) === currentId)
    );
    
    const totalLikes = userPosts.reduce((sum, post) => {
        const reactions = post.reactions || {};
        const heartReactions = reactions.heart || [];
        return sum + heartReactions.length;
    }, 0);
    
    likesCountElement.textContent = totalLikes;
}

// Обновление реакций поста
function updatePostReactions(postId, reactions) {
    // Обновляем пост в ленте
    const post = app.posts.find(p => p.id === postId);
    if (post) {
        post.reactions = reactions;
    }
    
    // Обновляем пост в профиле (если он там есть)
    const profilePostElements = document.querySelectorAll('#userPostsContainer [data-post-id]');
    let profilePost = null;
    for (const element of profilePostElements) {
        if (element.dataset.postId === postId) {
            // Ищем пост в массиве постов профиля
            if (!app.profilePosts) app.profilePosts = [];
            profilePost = app.profilePosts.find(p => p.id === postId);
            if (profilePost) {
                profilePost.reactions = reactions;
            }
            break;
        }
    }
    
    // Обновляем DOM элементы и в ленте, и в профиле
    const postElements = document.querySelectorAll(`[data-post-id="${postId}"]`);
    postElements.forEach(postElement => {
        // Показываем только реакцию "сердце"
        const heartReaction = 'heart';
        const users = reactions[heartReaction] || [];
        const isActive = users.includes(app.currentUser?.id);
        const count = users.length;
        
        const reactionsHtml = `<button class="reaction-btn ${isActive ? 'active' : ''}" data-reaction="${heartReaction}" data-post-id="${postId}">
                    ❤️ ${count > 0 ? `<span class="reaction-count">${count}</span>` : ''}
                </button>`;
        
        const postActionsBar = postElement.querySelector('.post-actions-bar');
        const commentsToggleBtn = postElement.querySelector('.comments-toggle-btn');
        
        if (postActionsBar && commentsToggleBtn) {
            postActionsBar.innerHTML = reactionsHtml + commentsToggleBtn.outerHTML;
            
            // Добавляем обработчики для новых кнопок реакций
            postElement.querySelectorAll('.reaction-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const postId = btn.dataset.postId;
                    const reaction = btn.dataset.reaction;
                    toggleReaction(postId, reaction);
                });
            });
            
            // Добавляем обработчик для кнопки комментариев
            const newCommentsToggleBtn = postElement.querySelector('.comments-toggle-btn');
            if (newCommentsToggleBtn) {
                newCommentsToggleBtn.addEventListener('click', () => {
                    const postId = newCommentsToggleBtn.dataset.postId;
                    const commentsSection = postElement.querySelector('.comments-section');
                    const currentPost = app.posts.find(p => p.id === postId) || 
                                      (app.profilePosts && app.profilePosts.find(p => p.id === postId));
                    
                    if (commentsSection.classList.contains('hidden')) {
                        // Показываем комментарии с анимацией
                        commentsSection.classList.remove('hidden');
                        newCommentsToggleBtn.classList.add('active');
                        newCommentsToggleBtn.innerHTML = '💬 <span class="comments-count">Скрыть</span>';
                    } else {
                        // Скрываем комментарии с анимацией
                        commentsSection.classList.add('hidden');
                        newCommentsToggleBtn.classList.remove('active');
                        const count = currentPost ? currentPost.comments.length : 0;
                        newCommentsToggleBtn.innerHTML = `💬 ${count > 0 ? `<span class="comments-count">${count}</span>` : ''}`;
                    }
                });
            }
        }
    });
    
    // Обновляем статистику лайков в профиле если это наш пост
    if (app.currentUser) {
        const currentId = resolveId(app.currentUser);
        const updatedPost = post || profilePost;
        if (updatedPost && (updatedPost.user_id === currentId || updatedPost.userId === currentId)) {
            updateProfileLikesCount();
        }
    }
}

// Добавление комментария
async function addComment(postId, text) {
    if (!text.trim()) return;
    
    try {
        const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ text: text.trim() })
        });
        
        if (response.ok) {
            const comment = await response.json();
            addCommentToPost(postId, comment);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка комментария', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Добавление комментария к посту (реальное время)
function addCommentToPost(postId, comment) {
    const post = app.posts.find(p => p.id === postId);
    if (post) {
        const incomingCommentId = comment.id || comment._id || null;
        if (incomingCommentId) {
            const alreadyExists = post.comments.some(existing => (existing.id || existing._id) === incomingCommentId);
            if (alreadyExists) {
                return;
            }
        }
        post.comments.push(comment);
        
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const commentsSection = postElement.querySelector('.comments-section');
            const commentHtml = `
                <div class="comment" ${incomingCommentId ? `data-comment-id="${incomingCommentId}"` : ''}>
                    <div class="comment-avatar">${comment.avatar ? `<img src="${comment.avatar}" alt="${comment.authorName}" />` : comment.authorName ? comment.authorName.charAt(0).toUpperCase() : '😊'}</div>
                    <div class="comment-content">
                        <div class="comment-author">${comment.authorName}</div>
                        <div class="comment-text">${comment.text}</div>
                    </div>
                </div>
            `;
            
            const existingDomNode = incomingCommentId 
                ? commentsSection.querySelector(`.comment[data-comment-id="${incomingCommentId}"]`)
                : null;
            if (!existingDomNode) {
                const inputContainer = commentsSection.querySelector('.comment-input-container');
                inputContainer.insertAdjacentHTML('beforebegin', commentHtml);
                
                // Обновляем счетчик комментариев на кнопке
                const commentsToggleBtn = postElement.querySelector('.comments-toggle-btn');
                if (commentsToggleBtn) {
                    const commentsCount = post.comments.length;
                    if (commentsSection.classList.contains('hidden')) {
                        commentsToggleBtn.innerHTML = `💬 ${commentsCount > 0 ? `<span class="comments-count">${commentsCount}</span>` : ''}`;
                    } else {
                        commentsToggleBtn.innerHTML = '💬 <span class="comments-count">Скрыть</span>';
                    }
                }
                
                // Очистка поля ввода (если инициировано самим пользователем)
                const input = inputContainer.querySelector('.comment-input');
                if (input && document.activeElement !== input) {
                    input.value = '';
                }
            }
        }
    }
}

// Загрузка постов пользователя
async function loadUserPosts() {
    if (!app.currentUser) return;
    const currentId = resolveId(app.currentUser);
    if (!currentId) return;
    
    const result = await loadUserPostsById(currentId);
    
    // После загрузки постов обновляем статистику профиля
    if (result) {
        await updateProfileInfo();
    }
    
    return result;
}

// Отображение постов пользователя
function renderUserPosts(posts) {
    const container = document.getElementById('userPostsContainer');
    container.innerHTML = '';

    // Сохраняем посты профиля в отдельный массив
    app.profilePosts = posts;

    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">У вас пока нет постов</p>';
        return;
    }
    
    posts.forEach(post => {
        const postElement = createPostElement(post);
        container.appendChild(postElement);
    });
    
    // Обновляем статистику лайков после загрузки постов
    updateProfileLikesCount();
}

// Обновление информации профиля
async function updateProfileInfo() {
    if (!app.currentUser) return;
    
    const currentId = resolveId(app.currentUser);
    if (!currentId) return;
    
    try {
        // Загружаем актуальные данные пользователя с сервера
        const response = await fetch(`${API_URL}/users/${currentId}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            
            // Обновляем данные в app.currentUser
            app.currentUser.followersCount = userData.followersCount;
            app.currentUser.followingCount = userData.followingCount;
            
            // Обновляем UI
            const profileNameElement = document.getElementById('profileName');
            if (profileNameElement) {
                profileNameElement.innerHTML = `
                    ${app.currentUser.name}
                    ${app.currentUser.is_verified ? '<span class="verified-checkmark"><svg><use href="#verified-checkmark"></use></svg></span>' : ''}
                `;
            }
            
            document.getElementById('profileUsername').textContent = '@' + app.currentUser.username;
            document.getElementById('profileBio').textContent = app.currentUser.bio || 'Описание профиля';
            document.getElementById('profileFollowers').textContent = userData.followersCount || 0;
            document.getElementById('profileFollowing').textContent = userData.followingCount || 0;
            
            // Для лайков считаем из ленты
            updateProfileLikesCount();
            
            // Показываем кнопку редактирования для своего профиля
            const editBtn = document.getElementById('editProfileBtn');
            if (editBtn) {
                editBtn.classList.remove('hidden');
            }
            
            const avatarImg = document.getElementById('profileAvatar');
            const avatarPlaceholder = document.getElementById('avatarPlaceholder');
            
            if (app.currentUser.avatar) {
                avatarImg.src = app.currentUser.avatar;
                avatarImg.style.display = 'block';
                avatarPlaceholder.style.display = 'none';
            } else {
                avatarImg.style.display = 'none';
                avatarPlaceholder.style.display = 'flex';
            }

            // Заполняем поля для редактирования, но не показываем их
            document.getElementById('inlineNameInput').value = app.currentUser.name;
            document.getElementById('inlineUsernameInput').value = app.currentUser.username;
            document.getElementById('inlineBioInput').value = app.currentUser.bio || '';
            
            // Скрываем inline редактирование по умолчанию
            const ownerEdit = document.getElementById('profileOwnerEdit');
            if (ownerEdit) {
                ownerEdit.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        // Если ошибка, используем локальные данные
        const profileNameElement = document.getElementById('profileName');
        if (profileNameElement) {
            profileNameElement.innerHTML = `
                ${app.currentUser.name}
                ${app.currentUser.is_verified ? '<span class="verified-checkmark"><svg><use href="#verified-checkmark"></use></svg></span>' : ''}
            `;
        }
        
        document.getElementById('profileUsername').textContent = '@' + app.currentUser.username;
        document.getElementById('profileBio').textContent = app.currentUser.bio || 'Описание профиля';
        document.getElementById('profileFollowers').textContent = app.currentUser.followersCount || 0;
        document.getElementById('profileFollowing').textContent = app.currentUser.followingCount || 0;
        updateProfileLikesCount();
    }
}

// Обработка смены аватара
async function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) {
        const formData = new FormData();
        formData.append('avatar', file);
        
        try {
            const response = await fetch(`${API_URL}/avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${app.token}`
                },
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                app.currentUser.avatar = data.avatar;
                await updateProfileInfo();
                loadPosts();
                showNotification('Аватар обновлен!', 'success');
            } else {
                const data = await response.json();
                showNotification(data.error || 'Ошибка загрузки аватара', 'error');
            }
        } catch (error) {
            showNotification('Ошибка соединения с сервером', 'error');
        }
    }
}

// Переключение inline редактирования профиля
function toggleInlineProfileEdit() {
    const ownerEdit = document.getElementById('profileOwnerEdit');
    if (ownerEdit) {
        ownerEdit.classList.toggle('hidden');
    }
}

// Открытие редактирования профиля
function openEditProfile() {
    document.getElementById('editName').value = app.currentUser.name;
    document.getElementById('editUsername').value = app.currentUser.username;
    document.getElementById('editBio').value = app.currentUser.bio || '';
    document.getElementById('editProfileModal').classList.add('active');
}

function closeEditProfile() {
    document.getElementById('editProfileModal').classList.remove('active');
    // Обновляем информацию в профиле после закрытия модального окна
    updateProfileInfo();
}

// Сохранение профиля
async function saveProfile() {
    const name = document.getElementById('editName').value.trim();
    const username = document.getElementById('editUsername').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    
    if (!name || !username) {
        showNotification('Имя и username обязательны', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ name, username, bio })
        });
        
        if (response.ok) {
            const data = await response.json();
            app.currentUser = data.user;
            await updateProfileInfo();
            loadPosts();
            closeEditProfile();
            showNotification('Профиль обновлен!', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка обновления профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Просмотр профиля пользователя
async function viewUserProfile(userId) {
    const normalizedId = resolveId(userId);
    if (!normalizedId) {
        showNotification('Не удалось определить пользователя', 'error');
        return;
    }
    try {
        // Получаем информацию о пользователе
        const response = await fetch(`${API_URL}/users/${normalizedId}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const user = await response.json();
            showUserProfile(user);
        } else {
            showNotification('Ошибка загрузки профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Показ профиля пользователя
function showUserProfile(user) {
    const targetId = resolveId(user);
    if (!targetId) {
        showNotification('Не удалось открыть профиль пользователя', 'error');
        return;
    }
    app.viewedUserId = targetId;
    // Обновляем информацию в профиле
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) {
        profileNameEl.innerHTML = `
            ${user.name}
            ${user.is_verified ? '<span class="verified-checkmark"><svg><use href="#verified-checkmark"></use></svg></span>' : ''}
        `;
    }
    const profileUsernameEl = document.getElementById('profileUsername');
    if (profileUsernameEl) profileUsernameEl.textContent = '@' + user.username;
    const profileBioEl = document.getElementById('profileBio');
    if (profileBioEl) profileBioEl.textContent = user.bio || 'Описание профиля';
    
    const avatarImg = document.getElementById('profileAvatar');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    if (avatarImg && avatarPlaceholder) {
        if (user.avatar) {
            avatarImg.src = user.avatar;
            avatarImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
        }
        avatarImg.addEventListener('error', () => {
            avatarImg.style.display = 'none';
            avatarPlaceholder.style.display = 'flex';
        }, { once: true });
    }
    
    // Показываем количество подписчиков и статистику
    updateFollowersCount(user.followersCount || 0);
    document.getElementById('profileFollowing').textContent = user.followingCount || 0;
    
    // Для лайков всегда используем подсчет из ленты
    if (app.posts && app.posts.length > 0) {
        const userPosts = app.posts.filter(post => {
            const postAuthorId = post.user_id || post.userId || (post.author && resolveId(post.author));
            return postAuthorId === targetId;
        });
        
        const totalLikes = userPosts.reduce((sum, post) => {
            const reactions = post.reactions || {};
            const heartReactions = reactions.heart || [];
            return sum + heartReactions.length;
        }, 0);
        
        document.getElementById('profileLikesCount').textContent = totalLikes;
    } else {
        // Если посты еще не загружены, используем данные с сервера или 0
        document.getElementById('profileLikesCount').textContent = user.totalLikes || user.likesCount || 0;
    }
    
    // Показываем/скрываем кнопки в зависимости от чей профиль
    const currentId = resolveId(app.currentUser);
    const isOwnProfile = currentId && targetId === currentId;
    
    // Отладочная информация
    console.log('Profile Debug:', {
        currentId,
        targetId,
        isOwnProfile,
        currentUser: app.currentUser
    });
    
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn) {
        if (isOwnProfile) {
            editBtn.classList.remove('hidden');
        } else {
            editBtn.classList.add('hidden');
        }
    }

    const ownerEdit = document.getElementById('profileOwnerEdit');
    if (ownerEdit) {
        ownerEdit.classList.toggle('hidden', !isOwnProfile);
        if (isOwnProfile) {
            document.getElementById('inlineNameInput').value = user.name;
            document.getElementById('inlineUsernameInput').value = user.username;
            document.getElementById('inlineBioInput').value = user.bio || '';
        }
    }

    const followBtn = document.getElementById('followProfileBtn');
    if (followBtn) {
        if (isOwnProfile) {
            followBtn.classList.add('hidden');
            followBtn.dataset.userId = '';
        } else {
            followBtn.classList.remove('hidden');
            followBtn.dataset.userId = targetId;
            followBtn.textContent = user.isFollowing ? 'Отписаться' : 'Подписаться';
        }
    }
    
    // Загружаем посты пользователя
    loadUserPostsById(targetId);
    
    // Переключаемся на экран профиля
    showScreen('profile');
}

// Обновление количества подписчиков
function updateFollowersCount(count) {
    const followersElement = document.getElementById('profileFollowers');
    if (followersElement) {
        followersElement.textContent = count;
    }
}

// Загрузка постов пользователя по ID
async function loadUserPostsById(userId) {
    const normalizedId = resolveId(userId);
    if (!normalizedId) {
        showNotification('Не удалось загрузить посты пользователя', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/users/${normalizedId}/posts`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const posts = await response.json();
            renderUserPosts(posts);
        } else {
            showNotification('Ошибка загрузки постов', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Подписка/отписка
async function toggleFollow(userId) {
    const currentId = resolveId(app.currentUser);
    const targetId = resolveId(userId);
    if (!targetId) {
        showNotification('Некорректный пользователь', 'error');
        return;
    }
    if (currentId && currentId === targetId) {
        showNotification('Невозможно подписаться на себя', 'error');
        return;
    }
    try {
        const response = await fetch(`${API_URL}/users/${targetId}/follow`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showNotification(data.message, 'success');
            viewUserProfile(targetId);
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка подписки', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обработка поиска
async function handleSearch(query) {
    if (!query || query.length < 2) {
        document.getElementById('searchResultsContainer').innerHTML = '';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const results = await response.json();
            displaySearchResults(results);
        } else {
            console.error('Search error:', response.status);
        }
    } catch (error) {
        console.error('Search error:', error);
    }
}

// Отображение результатов поиска
function displaySearchResults(results) {
    const container = document.getElementById('searchResultsContainer');
    
    if (results.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Пользователи не найдены</p>';
        return;
    }
    
    const resultsHtml = results.map(user => `
        <div class="search-result-item" onclick="viewUserProfile('${user.id}')">
            <div class="search-result-avatar">
                ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" />` : user.name.charAt(0).toUpperCase()}
            </div>
            <div class="search-result-info">
                <div class="search-result-name">
                    ${user.name}
                    ${user.is_verified ? '<span class="verified-checkmark"><svg><use href="#verified-checkmark"></use></svg></span>' : ''}
                </div>
                <div class="search-result-username">@${user.username}</div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = resultsHtml;
}

// Обновление ленты
function refreshFeed() {
    resetPagination();
    loadPosts();
    showNotification('Лента обновлена', 'success');
}

// Уведомления
let notifications = [];
let unreadCount = 0;

function openNotifications() {
    document.getElementById('notificationsModal').classList.add('active');
    loadNotifications();
}

function closeNotifications() {
    document.getElementById('notificationsModal').classList.remove('active');
}

async function loadNotifications() {
    try {
        const response = await fetch(`${API_URL}/notifications`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            notifications = await response.json();
            renderNotifications();
            updateNotificationsBadge();
        }
    } catch (error) {
        console.error('Ошибка загрузки уведомлений:', error);
    }
}

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    
    if (notifications.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Уведомлений нет</p>';
        return;
    }
    
    container.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.read ? 'read' : 'unread'}" data-id="${notification.id}">
            <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${formatTime(notification.created_at)}</div>
            </div>
            ${!notification.read ? '<div class="notification-indicator"></div>' : ''}
        </div>
    `).join('');
}

function updateNotificationsBadge() {
    unreadCount = notifications.filter(n => !n.read).length;
    const notificationsBtn = document.getElementById('notificationsBtn');
    
    if (unreadCount > 0) {
        notificationsBtn.innerHTML = `🔔 <span class="notification-badge">${unreadCount}</span>`;
    } else {
        notificationsBtn.innerHTML = '🔔';
    }
}

async function markAllAsRead() {
    try {
        const response = await fetch(`${API_URL}/notifications/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            notifications.forEach(n => n.read = true);
            renderNotifications();
            updateNotificationsBadge();
            showNotification('Все уведомления отмечены как прочитанные', 'success');
        }
    } catch (error) {
        console.error('Ошибка отметки уведомлений:', error);
    }
}

// Настройки
function openSettings() {
    updateUserIdDisplay();
    updateVerificationStatus();
    
    // Добавляем обработчик для кнопки верификации
    const requestVerificationBtn = document.getElementById('requestVerificationBtn');
    if (requestVerificationBtn) {
        // Удаляем старые обработчики
        requestVerificationBtn.replaceWith(requestVerificationBtn.cloneNode(true));
        // Добавляем новый обработчик
        const newBtn = document.getElementById('requestVerificationBtn');
        newBtn.addEventListener('click', requestVerification);
    }
    
    document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('active');
}

// Обновление аккаунта
async function updateAccount() {
    const newEmail = document.getElementById('newEmail').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    
    if (!newEmail && !newPassword) {
        showNotification('Введите новые данные', 'error');
        return;
    }
    
    // В реальном приложении здесь был бы API endpoint
    showNotification('Функция обновления аккаунта в разработке', 'info');
    
    // Очистка полей
    document.getElementById('newEmail').value = '';
    document.getElementById('newPassword').value = '';
}

// Выход из аккаунта
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('clone_token');
        app.token = null;
        app.currentUser = null;
        
        if (app.socket) {
            app.socket.disconnect();
            app.socket = null;
        }
        
        document.getElementById('mainApp').classList.remove('active');
        document.getElementById('authScreen').classList.add('active');
        
        // Очистка форм
        document.getElementById('loginFormElement').reset();
        document.getElementById('registerFormElement').reset();
        
        showNotification('Вы вышли из аккаунта', 'info');
    }
}

// Удаление аккаунта
async function deleteAccount() {
    if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие нельзя отменить!')) {
        try {
            const response = await fetch(`${API_URL}/account`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${app.token}`
                }
            });
            
            if (response.ok) {
                localStorage.removeItem('clone_token');
                app.token = null;
                app.currentUser = null;
                
                if (app.socket) {
                    app.socket.disconnect();
                    app.socket = null;
                }
                
                document.getElementById('mainApp').classList.remove('active');
                document.getElementById('authScreen').classList.add('active');
                
                showNotification('Аккаунт удален', 'info');
            } else {
                const data = await response.json();
                showNotification(data.error || 'Ошибка удаления аккаунта', 'error');
            }
        } catch (error) {
            showNotification('Ошибка соединения с сервером', 'error');
        }
    }
}

// Тема
function toggleTheme(e) {
    const body = document.body;
    const themeSwitch = document.getElementById('themeToggleSwitch');
    const isChecked = themeSwitch.checked;
    
    if (isChecked) {
        body.classList.add('dark-theme');
        app.theme = 'dark';
    } else {
        body.classList.remove('dark-theme');
        app.theme = 'light';
    }
    
    localStorage.setItem('clone_theme', app.theme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('clone_theme');
    const themeSwitch = document.getElementById('themeToggleSwitch');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        app.theme = 'dark';
        if (themeSwitch) themeSwitch.checked = true;
    } else {
        app.theme = 'light';
        if (themeSwitch) themeSwitch.checked = false;
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Позиционирование
    notification.style.position = 'fixed';
    notification.style.top = '1rem';
    notification.style.right = '1rem';
    notification.style.zIndex = '2000';
    notification.style.animation = 'fadeIn 0.3s ease-out';
    
    // Автоматическое удаление
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Форматирование времени
function formatTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    if (days < 7) return `${days} д назад`;
    
    return date.toLocaleDateString('ru-RU');
}

// Обработка медиа файлов
function handleMediaAttach(e) {
    const files = e.target.files;
    const previewContainer = document.getElementById('mediaPreview') || createMediaPreviewContainer();
    
    // Очищаем предыдущий предпросмотр
    previewContainer.innerHTML = '';
    
    if (files.length > 0) {
        showNotification(`Выбрано файлов: ${files.length}`, 'success');
        
        // Создаем предпросмотр для каждого файла
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const previewItem = document.createElement('div');
                previewItem.className = 'media-preview-item';
                
                if (file.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.alt = 'Предпросмотр изображения';
                    previewItem.appendChild(img);
                } else if (file.type.startsWith('video/')) {
                    const video = document.createElement('video');
                    video.src = e.target.result;
                    video.controls = true;
                    previewItem.appendChild(video);
                }
                
                const removeBtn = document.createElement('button');
                removeBtn.className = 'media-preview-remove';
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', () => {
                    previewItem.remove();
                    updateMediaInput();
                });
                
                previewItem.appendChild(removeBtn);
                previewContainer.appendChild(previewItem);
            };
            
            reader.readAsDataURL(file);
        });
    }
}

// Создание контейнера для предпросмотра медиа
function createMediaPreviewContainer() {
    const container = document.createElement('div');
    container.id = 'mediaPreview';
    container.className = 'media-preview';
    container.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
        padding: 0.5rem;
        background: var(--bg-secondary);
        border-radius: var(--radius-md);
        min-height: 100px;
    `;
    
    // Вставляем в новый composer профиля
    const composer = document.querySelector('.profile-composer');
    if (composer) {
        composer.appendChild(container);
    }
    
    return container;
}

// Обновление input файлами после удаления
function updateMediaInput() {
    const input = document.getElementById('mediaInput');
    const previewItems = document.querySelectorAll('.media-preview-item');
    
    if (previewItems.length === 0) {
        input.value = '';
        document.getElementById('mediaPreview').style.display = 'none';
    }
}

// Добавление стилей для анимации fadeOut и новых элементов
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
    }
    
    .follow-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 0.875rem;
        transition: background-color 0.2s;
    }
    
    .follow-btn:hover {
        background: var(--primary-hover);
    }
    
    .comment-submit-btn {
        background: none;
        border: none;
        font-size: 1.25rem;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: var(--radius-sm);
        transition: background-color 0.2s;
    }
    
    .comment-submit-btn:hover {
        background: var(--bg-tertiary);
    }
    
    .media-preview-item {
        position: relative;
        width: 100px;
        height: 100px;
        border-radius: var(--radius-sm);
        overflow: hidden;
    }
    
    .media-preview-item img,
    .media-preview-item video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .media-preview-remove {
        position: absolute;
        top: 4px;
        right: 4px;
        background: rgba(255, 255, 255, 0.9);
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }
    
    .media-preview-remove:hover {
        background: rgba(255, 0, 0, 0.8);
        color: white;
    }
    
    .follow-profile-btn {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 0.875rem;
        margin-top: 0.5rem;
        transition: background-color 0.2s;
    }
    
    .follow-profile-btn:hover {
        background: var(--primary-hover);
    }
    
    .post-author {
        transition: color 0.2s;
    }
    
    .post-author:hover {
        color: var(--primary-hover) !important;
    }
    
    .notification-badge {
        background: var(--danger-color);
        color: white;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: absolute;
        top: -4px;
        right: -4px;
    }
    
    .notifications-list {
        max-height: 400px;
        overflow-y: auto;
    }
    
    .notification-item {
        display: flex;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color);
        cursor: pointer;
        transition: background-color 0.2s;
    }
    
    .notification-item:hover {
        background: var(--bg-secondary);
    }
    
    .notification-item.unread {
        background: var(--bg-tertiary);
        font-weight: 500;
    }
    
    .notification-content {
        flex: 1;
    }
    
    .notification-message {
        margin-bottom: 0.25rem;
    }
    
    .notification-time {
        font-size: 0.8rem;
        color: var(--text-secondary);
    }
    
    .notification-indicator {
        width: 8px;
        height: 8px;
        background: var(--primary-color);
        border-radius: 50%;
        margin-left: 0.5rem;
    }
    
    .avatar-placeholder {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--bg-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
    }
`;
document.head.appendChild(style);

function replaceWithAvatarFallback(img) {
    if (!img) return;
    const wrapper = img.parentElement;
    if (!wrapper) return;
    const fallback = document.createElement('div');
    fallback.className = 'avatar-placeholder';
    fallback.textContent = '😊';
    wrapper.innerHTML = '';
    wrapper.appendChild(fallback);
}

function attachMediaFallbacks(postElement) {
    if (!postElement) return;
    postElement.querySelectorAll('.post-media img').forEach(img => {
        img.addEventListener('error', () => {
            img.replaceWith(createMediaFallback('image'));
        });
    });
    postElement.querySelectorAll('.post-media video').forEach(video => {
        video.addEventListener('error', () => {
            video.replaceWith(createMediaFallback('video'));
        });
    });
}

function createMediaFallback(type) {
    const fallback = document.createElement('div');
    fallback.className = 'media-fallback';
    fallback.textContent = type === 'video' ? 'Видео недоступно' : 'Изображение недоступно';
    return fallback;
}

// Админ-панель функции
let isAdmin = false;
let currentAdminView = null;

// Проверка прав администратора
function checkAdminRights() {
    if (!app.currentUser || !app.currentUser.user_id) return false;
    
    // ID создателя (должен совпадать с тем, что в server-render.js)
    const CREATOR_USER_ID = '1761560316'; // ID создателя
    
    return app.currentUser.user_id === CREATOR_USER_ID;
}

// Показать/скрыть кнопку админ-панели
function updateAdminButtonVisibility() {
    const adminBtn = document.getElementById('adminBtn');
    if (!adminBtn) return;
    
    isAdmin = checkAdminRights();
    
    if (isAdmin) {
        adminBtn.classList.remove('hidden');
    } else {
        adminBtn.classList.add('hidden');
    }
}

// Открытие админ-панели
function openAdminPanel() {
    if (!isAdmin) {
        showNotification('Доступ запрещен', 'error');
        return;
    }
    
    document.getElementById('adminModal').classList.add('active');
    loadAdminStats();
}

// Закрытие админ-панели
function closeAdminPanel() {
    document.getElementById('adminModal').classList.remove('active');
    document.getElementById('usersListContainer').classList.add('hidden');
    currentAdminView = null;
}

// Загрузка статистики
async function loadAdminStats() {
    try {
        console.log('Loading admin stats from client...');
        console.log('API_URL:', API_URL);
        console.log('Token exists:', !!app.token);
        
        const response = await fetch(`${API_URL}/admin/stats`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (response.ok) {
            const stats = await response.json();
            console.log('Stats received:', stats);
            
            document.getElementById('totalUsers').textContent = stats.totalUsers;
            document.getElementById('bannedUsers').textContent = stats.bannedUsers;
            document.getElementById('activeUsers').textContent = stats.activeUsers;
        } else {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            showNotification('Ошибка загрузки статистики', 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Показ всех пользователей
async function showAllUsers(search = '') {
    currentAdminView = 'all';
    document.getElementById('usersListTitle').textContent = 'Все пользователи';
    document.getElementById('usersListContainer').classList.remove('hidden');
    
    await loadUsersList('/admin/users', search);
}

// Показ забаненных пользователей
async function showBannedUsers(search = '') {
    currentAdminView = 'banned';
    document.getElementById('usersListTitle').textContent = 'Забаненные пользователи';
    document.getElementById('usersListContainer').classList.remove('hidden');
    
    await loadUsersList('/admin/banned', search);
}

// Загрузка списка пользователей
async function loadUsersList(endpoint, search = '') {
    try {
        const url = search ? `${API_URL}${endpoint}?search=${encodeURIComponent(search)}` : `${API_URL}${endpoint}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            displayUsersList(users);
        } else {
            showNotification('Ошибка загрузки пользователей', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Отображение списка пользователей
function displayUsersList(users) {
    const container = document.getElementById('usersList');
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Пользователи не найдены</p>';
        return;
    }
    
    const usersHtml = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-avatar">
                    ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" />` : user.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-details">
                    <div class="user-name">
                        ${user.name}
                        ${user.is_verified ? '<span class="verified-checkmark"><svg><use href="#verified-checkmark"></use></svg></span>' : ''}
                    </div>
                    <div class="user-username">@${user.username}</div>
                    <div class="user-id">ID: ${user.user_id}</div>
                </div>
            </div>
            <div class="user-actions">
                ${user.banned ? 
                    `<button class="btn-secondary btn-sm" onclick="unbanUser('${user.id}')">Разбанить</button>` :
                    `<button class="btn-danger btn-sm" onclick="banUser('${user.id}')">Забанить</button>`
                }
            </div>
        </div>
    `).join('');
    
    container.innerHTML = usersHtml;
}

// Бан пользователя
async function banUser(userId) {
    if (!confirm('Вы уверены, что хотите забанить этого пользователя?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/ban/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Пользователь забанен', 'success');
            
            // Обновляем текущий список
            if (currentAdminView === 'all') {
                showAllUsers(document.getElementById('adminSearchInput').value);
            } else if (currentAdminView === 'banned') {
                showBannedUsers(document.getElementById('adminSearchInput').value);
            }
            
            // Обновляем статистику
            loadAdminStats();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка бана пользователя', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Разбан пользователя
async function unbanUser(userId) {
    if (!confirm('Вы уверены, что хотите разбанить этого пользователя?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/unban/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Пользователь разбанен', 'success');
            
            // Обновляем текущий список
            if (currentAdminView === 'all') {
                showAllUsers(document.getElementById('adminSearchInput').value);
            } else if (currentAdminView === 'banned') {
                showBannedUsers(document.getElementById('adminSearchInput').value);
            }
            
            // Обновляем статистику
            loadAdminStats();
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка разбана пользователя', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Удаление поста администратором
async function deletePostByAdmin(postId) {
    if (!isAdmin) {
        showNotification('Доступ запрещен', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить этот пост?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/posts/${postId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Пост удален', 'success');
            
            // Удаляем пост из DOM
            const postElement = document.querySelector(`[data-post-id="${postId}"]`);
            if (postElement) {
                postElement.remove();
            }
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка удаления поста', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Обновление ID пользователя в настройках
function updateUserIdDisplay() {
    const userIdElement = document.getElementById('currentUserId');
    if (userIdElement && app.currentUser && app.currentUser.user_id) {
        userIdElement.textContent = app.currentUser.user_id;
    }
}

// Поиск в админ-панели
function handleAdminSearch() {
    const search = document.getElementById('adminSearchInput').value.trim();
    
    if (currentAdminView === 'all') {
        showAllUsers(search);
    } else if (currentAdminView === 'banned') {
        showBannedUsers(search);
    } else {
        // Если нет активного представления, показываем все пользователи
        showAllUsers(search);
    }
}

// Верификация функции

// Обновление статуса верификации в настройках
function updateVerificationStatus() {
    const statusElement = document.getElementById('verificationStatus');
    const requestBtn = document.getElementById('requestVerificationBtn');
    
    if (!statusElement || !app.currentUser) return;
    
    const { is_verified, verification_requested } = app.currentUser;
    
    if (is_verified) {
        statusElement.innerHTML = `
            <div class="verified-badge">
                ✓ Верифицированный аккаунт
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                Ваш аккаунт имеет синюю галочку верификации
            </p>
        `;
        requestBtn.style.display = 'none';
    } else if (verification_requested) {
        statusElement.innerHTML = `
            <div class="verification-pending">
                ⏳ Заявка на верификацию отправлена
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                Ваша заявка рассматривается администратором
            </p>
        `;
        requestBtn.style.display = 'none';
    } else {
        statusElement.innerHTML = `
            <div class="verification-none">
                ❌ Аккаунт не верифицирован
            </div>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.5rem;">
                Запросите верификацию, чтобы получить синюю галочку
            </p>
        `;
        requestBtn.style.display = 'block';
    }
}

// Запрос верификации
async function requestVerification() {
    console.log('requestVerification called');
    console.log('app.currentUser:', app.currentUser);
    console.log('app.token:', !!app.token);
    
    try {
        const response = await fetch(`${API_URL}/verification/request`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        if (response.ok) {
            const data = await response.json();
            console.log('Response data:', data);
            showNotification(data.message, 'success');
            
            // Обновляем данные пользователя
            app.currentUser.verification_requested = true;
            updateVerificationStatus();
        } else {
            const data = await response.json();
            console.error('Error response:', data);
            showNotification(data.error || 'Ошибка запроса верификации', 'error');
        }
    } catch (error) {
        console.error('Network error:', error);
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Показ заявок на верификацию
async function showVerificationRequests() {
    currentAdminView = 'verification_requests';
    document.getElementById('usersListTitle').textContent = 'Заявки на верификацию';
    document.getElementById('usersListContainer').classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}/admin/verification/requests`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const requests = await response.json();
            displayVerificationRequests(requests);
        } else {
            showNotification('Ошибка загрузки заявок на верификацию', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Показ верифицированных пользователей
async function showVerifiedUsers() {
    currentAdminView = 'verified_users';
    document.getElementById('usersListTitle').textContent = 'Верифицированные пользователи';
    document.getElementById('usersListContainer').classList.remove('hidden');
    
    try {
        const response = await fetch(`${API_URL}/admin/verification/verified`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            displayVerifiedUsers(users);
        } else {
            showNotification('Ошибка загрузки верифицированных пользователей', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Отображение заявок на верификацию
function displayVerificationRequests(requests) {
    const container = document.getElementById('usersList');
    
    if (requests.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Нет заявок на верификацию</p>';
        return;
    }
    
    const requestsHtml = requests.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-avatar">
                    ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" />` : user.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-details">
                    <div class="user-name">${user.name}</div>
                    <div class="user-username">@${user.username}</div>
                    <div class="user-id">ID: ${user.user_id}</div>
                </div>
            </div>
            <div class="user-actions verification-actions">
                <button class="btn-primary btn-sm" onclick="approveVerification('${user.id}')">✅ Одобрить</button>
                <button class="btn-danger btn-sm" onclick="rejectVerification('${user.id}')">❌ Отклонить</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = requestsHtml;
}

// Отображение верифицированных пользователей
function displayVerifiedUsers(users) {
    const container = document.getElementById('usersList');
    
    if (users.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Нет верифицированных пользователей</p>';
        return;
    }
    
    const usersHtml = users.map(user => `
        <div class="user-item">
            <div class="user-info">
                <div class="user-avatar">
                    ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}" />` : user.name.charAt(0).toUpperCase()}
                </div>
                <div class="user-details">
                    <div class="user-name">
                        ${user.name}
                        <span class="verified-checkmark">✓</span>
                    </div>
                    <div class="user-username">@${user.username}</div>
                    <div class="user-id">ID: ${user.user_id}</div>
                </div>
            </div>
            <div class="user-actions">
                <button class="btn-danger btn-sm" onclick="revokeVerification('${user.id}')">❌ Снять галочку</button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = usersHtml;
}

// Одобрение верификации
async function approveVerification(userId) {
    if (!confirm('Одобрить заявку на верификацию?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/verification/approve/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Верификация одобрена', 'success');
            showVerificationRequests(); // Обновляем список
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка одобрения верификации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Отклонение верификации
async function rejectVerification(userId) {
    if (!confirm('Отклонить заявку на верификацию?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/verification/reject/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Заявка отклонена', 'success');
            showVerificationRequests(); // Обновляем список
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка отклонения верификации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Снятие верификации
async function revokeVerification(userId) {
    if (!confirm('Снять синюю галочку с этого пользователя?')) return;
    
    try {
        const response = await fetch(`${API_URL}/admin/verification/revoke/${userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });
        
        if (response.ok) {
            showNotification('Верификация снята', 'success');
            showVerifiedUsers(); // Обновляем список
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка снятия верификации', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Сохранение inline профиля
async function saveInlineProfile() {
    const name = document.getElementById('inlineNameInput').value.trim();
    const username = document.getElementById('inlineUsernameInput').value.trim();
    const bio = document.getElementById('inlineBioInput').value.trim();
    
    if (!name || !username) {
        showNotification('Имя и username обязательны', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${app.token}`
            },
            body: JSON.stringify({ name, username, bio })
        });
        
        if (response.ok) {
            const data = await response.json();
            app.currentUser = data.user;
            updateProfileInfo();
            loadPosts();
            cancelInlineProfileEdit();
            showNotification('Профиль обновлен!', 'success');
        } else {
            const data = await response.json();
            showNotification(data.error || 'Ошибка обновления профиля', 'error');
        }
    } catch (error) {
        showNotification('Ошибка соединения с сервером', 'error');
    }
}

// Отмена inline редактирования
function cancelInlineProfileEdit() {
    const ownerEdit = document.getElementById('profileOwnerEdit');
    if (ownerEdit) {
        ownerEdit.classList.add('hidden');
    }
}

// Снег эффект
let snowInterval = null;
let snowflakes = [];

function toggleSnow() {
    const isEnabled = document.getElementById('snowToggleSwitch').checked;
    localStorage.setItem('clone_snow_enabled', isEnabled);
    
    if (isEnabled) {
        startSnow();
    } else {
        stopSnow();
    }
}

function startSnow() {
    const container = document.getElementById('snowContainer');
    if (!container) return;
    
    // Очищаем предыдущие снежинки
    container.innerHTML = '';
    snowflakes = [];
    
    // Создаем снежинки
    const createSnowflake = () => {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.innerHTML = '❄';
        
        // Случайные параметры
        const size = Math.random() * 20 + 10; // 10-30px
        const startPosition = Math.random() * window.innerWidth;
        const animationDuration = Math.random() * 10 + 10; // 10-20 секунд
        const opacity = Math.random() * 0.6 + 0.4; // 0.4-1.0
        
        snowflake.style.left = startPosition + 'px';
        snowflake.style.fontSize = size + 'px';
        snowflake.style.animationDuration = animationDuration + 's';
        snowflake.style.opacity = opacity;
        
        container.appendChild(snowflake);
        snowflakes.push(snowflake);
        
        // Удаляем снежинку после окончания анимации
        setTimeout(() => {
            if (snowflake.parentNode) {
                snowflake.remove();
                const index = snowflakes.indexOf(snowflake);
                if (index > -1) {
                    snowflakes.splice(index, 1);
                }
            }
        }, animationDuration * 1000);
    };
    
    // Создаем снежинки периодически
    snowInterval = setInterval(createSnowflake, 300);
    
    // Создаем начальные снежинки
    for (let i = 0; i < 10; i++) {
        setTimeout(createSnowflake, i * 100);
    }
}

function stopSnow() {
    if (snowInterval) {
        clearInterval(snowInterval);
        snowInterval = null;
    }
    
    // Удаляем все снежинки
    const container = document.getElementById('snowContainer');
    if (container) {
        container.innerHTML = '';
    }
}

function loadSnowSettings() {
    const snowEnabled = localStorage.getItem('clone_snow_enabled') === 'true';
    const snowToggle = document.getElementById('snowToggleSwitch');
    if (snowToggle) {
        snowToggle.checked = snowEnabled;
        if (snowEnabled) {
            startSnow();
        }
    }
}

// ==================== МЕССЕНДЖЕР ====================

// Глобальные переменные мессенджера
let currentChatId = null;
let currentChatUser = null;
let messageUpdateInterval = null;
let lastMessageCount = 0;
let allChats = []; // Храним все чаты для поиска
let currentFile = null; // Храним текущий файл для отправки

// Инициализация мессенджера в стиле Telegram
function initMessenger() {
    console.log('Инициализация Telegram мессенджера');
    
    // Проверяем, что обработчики еще не добавлены
    if (window.messengerInitialized) {
        console.log('Мессенджер уже инициализирован, пропускаем');
        return;
    }
    
    window.messengerInitialized = true;

    // Проверяем наличие элементов
    const requiredElements = [
        'chatsBtn', 'backToFeedBtn', 'backToChatsBtn', 'startChatBtn', 'chatUserSearch',
        'sendMessageBtn', 'attachFileBtn', 'fileInput', 'chatMessageInput', 'chatsModal', 'chatsList',
        'chatMenuBtn'
    ];

    for (const id of requiredElements) {
        if (!document.getElementById(id)) {
            console.error(`Элемент ${id} не найден`);
            return;
        }
    }

    // Обработчики событий в стиле Telegram
    document.getElementById('chatsBtn').addEventListener('click', openChatsModal);
    document.getElementById('backToFeedBtn').addEventListener('click', backToFeed);
    document.getElementById('backToChatsBtn').addEventListener('click', closeChatWindow);
    document.getElementById('startChatBtn').addEventListener('click', startNewChat);
    // Обработчик отправки сообщения
    const sendMessageBtn = document.getElementById('sendMessageBtn');
    if (sendMessageBtn) {
        sendMessageBtn.onclick = function(e) {
            console.log('Клик по кнопке отправки сообщения');
            e.preventDefault();
            sendMessage();
        };
        console.log('Обработчик для sendMessageBtn добавлен');
    } else {
        console.error('Кнопка sendMessageBtn не найдена!');
    }
    document.getElementById('attachFileBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('chatMessageInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Обработчики для меню чата
    const chatMenuBtn = document.getElementById('chatMenuBtn');
    const deleteChatBtn = document.getElementById('deleteChatBtn');
    
    if (chatMenuBtn) {
        chatMenuBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Клик по кнопке удаления чата');
            deleteChat();
        };
        console.log('Обработчик для chatMenuBtn добавлен');
    } else {
        console.error('Кнопка chatMenuBtn не найдена!');
    }

    // Закрытие модального окна по клику вне его
    document.getElementById('chatsModal').addEventListener('click', (e) => {
        if (e.target.id === 'chatsModal') {
            closeChatsModal();
        }
    });

    // Делегированный клик по чатам
    document.getElementById('chatsList').addEventListener('click', (e) => {
        const chatItem = e.target.closest('.telegram-chat-item');
        if (chatItem) {
            const chatId = chatItem.dataset.chatId;
            const chat = findChatById(chatId);
            if (chat) {
                openChat(chat);
            }
        }
    });

    // Загружаем чаты при открытии модального окна
    loadChats();
}

// Открытие модального окна с чатами
function openChatsModal() {
    console.log('Открываю модальное окно чатов');
    
    // Устанавливаем тему на документ
    document.documentElement.setAttribute('data-theme', app.theme || 'light');
    console.log('Установлена тема:', app.theme || 'light');
    
    // Блокируем прокрутку фона
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    
    // Скрываем навигационный остров
    const navIsland = document.querySelector('.nav-island');
    if (navIsland) {
        navIsland.style.display = 'none';
    }
    
    // Показываем модальное окно
    const modal = document.getElementById('chatsModal');
    if (modal) {
        modal.classList.add('active');
        console.log('Модальное окно показано');
    } else {
        console.error('Модальное окно чатов не найдено');
    }
    
    // Загружаем чаты
    loadChats();
}

// Закрытие модального окна чатов
function closeChatsModal() {
    // Восстанавливаем прокрутку body
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    
    // Показываем навигационный остров при закрытии мессенджера
    const navIsland = document.querySelector('.nav-island');
    if (navIsland) {
        navIsland.style.display = '';
    }
    
    document.getElementById('chatsModal').classList.remove('active');
    closeChatWindow();
}

// Возврат на ленту
function backToFeed() {
    // Восстанавливаем прокрутку body
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    
    // Показываем навигационный остров
    const navIsland = document.querySelector('.nav-island');
    if (navIsland) {
        navIsland.style.display = '';
    }
    
    // Закрываем мессенджер
    closeChatsModal();
    
    // Переключаемся на ленту
    showSection('feedSection');
}

// Открытие профиля пользователя
function openUserProfile() {
    console.log('Функция openUserProfile вызвана');
    
    if (!currentChatUser) {
        console.error('currentChatUser не найден!');
        showNotification('Пользователь не найден', 'error');
        return;
    }
    
    console.log('Открываю профиль пользователя:', currentChatUser);
    
    // Восстанавливаем прокрутку body
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    
    // Закрываем мессенджер
    closeChatsModal();
    
    // Показываем навигационный остров
    const navIsland = document.querySelector('.nav-island');
    if (navIsland) {
        navIsland.style.display = '';
    }
    
    // Проверяем, что это не свой профиль
    if (app.currentUser && currentChatUser && currentChatUser.id === app.currentUser.id) {
        console.log('Это ваш собственный профиль, переключаюсь на профиль');
        if (typeof showSection === 'function') {
            showSection('profileSection');
        } else {
            console.error('showSection не найдена, использую прямой метод');
            const profileSection = document.getElementById('profileSection');
            if (profileSection) {
                document.querySelectorAll('.section').forEach(section => {
                    section.style.display = 'none';
                });
                profileSection.style.display = 'block';
            }
        }
        return;
    }
    
    // Для чужого профиля - используем поиск
    console.log('Открываю профиль собеседника через поиск');
    if (currentChatUser && currentChatUser.username) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = currentChatUser.username;
            if (typeof handleSearch === 'function') {
                console.log('Вызываю handleSearch для username:', currentChatUser.username);
                handleSearch(currentChatUser.username);
            } else {
                console.error('handleSearch не найдена');
                showNotification('Не удалось открыть профиль', 'error');
            }
        } else {
            console.error('Поле поиска не найдено');
            showNotification('Не удалось открыть профиль', 'error');
        }
    } else {
        console.error('Username или currentChatUser не найден');
        showNotification('Не удалось открыть профиль', 'error');
    }
}

// Создание нового чата
async function startNewChat() {
    const username = document.getElementById('chatUserSearch').value.trim();

    if (!username) {
        showNotification('Введите username пользователя', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/chats/${encodeURIComponent(username)}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });

        if (response.ok) {
            const chat = await response.json();
            document.getElementById('chatUserSearch').value = '';
            loadChats();
            openChat(chat);
            showNotification('Чат создан!', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'Ошибка создания чата', 'error');
        }
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        showNotification('Ошибка сети', 'error');
    }
}

// Загрузка списка чатов
async function loadChats() {
    try {
        const response = await fetch(`${API_URL}/chats`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });

        if (response.ok) {
            const chats = await response.json();
            allChats = chats; // Сохраняем чаты для поиска
            displayChats(chats);
        }
    } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
    }
}

// Поиск чата по ID
function findChatById(chatId) {
    return allChats.find(chat => chat.id === chatId);
}

// Отображение списка чатов в стиле Telegram
function displayChats(chats) {
    const container = document.getElementById('chatsList');

    if (chats.length === 0) {
        container.innerHTML = '<p class="no-chats" style="color: #8e8e93; text-align: center; padding: 20px;">У вас нет чатов. Начните новый чат выше.</p>';
        return;
    }

    container.innerHTML = chats.map(chat => {
        const unreadCount = chat.unread_count || 0;
        const lastMessage = chat.last_message_content || 'Нет сообщений';
        
        return `
            <div class="telegram-chat-item" data-chat-id="${chat.id}">
                <div class="telegram-chat-avatar">
                    ${chat.other_user.avatar ? 
                        `<img src="${chat.other_user.avatar}" alt="${chat.other_user.name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : 
                        chat.other_user.name.charAt(0).toUpperCase()
                    }
                </div>
                <div class="telegram-chat-info">
                    <div class="telegram-chat-name">${chat.other_user.name}</div>
                    <div class="telegram-chat-last-message">${lastMessage}</div>
                </div>
                <div class="telegram-chat-meta">
                    <div class="telegram-chat-time">${chat.last_message_at ? formatTime(chat.last_message_at) : ''}</div>
                    ${unreadCount > 0 ? `<div class="telegram-chat-unread">${unreadCount > 99 ? '99+' : unreadCount}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Открытие чата в стиле Telegram
async function openChat(chat) {
    console.log('Открываю чат:', chat);
    
    // Закрываем предыдущий чат
    if (currentChatId) {
        closeChatWindow();
    }

    currentChatId = chat.id;
    currentChatUser = chat.other_user;
    
    console.log('Установлен currentChatUser:', currentChatUser);

    // Обновляем UI в стиле Telegram
    const avatarElement = document.getElementById('chatAvatar');
    const avatarContent = currentChatUser.avatar ? 
        `<img src="${currentChatUser.avatar}" alt="${currentChatUser.name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : 
        currentChatUser.name.charAt(0).toUpperCase();
    
    avatarElement.innerHTML = avatarContent;
    document.getElementById('chatUserName').textContent = currentChatUser.name;
    document.getElementById('chatUserStatus').textContent = 'last seen recently';

    // Показываем окно чата (Telegram стиль)
    if (window.innerWidth <= 768) {
        document.querySelector('.telegram-chat-list').classList.add('hidden');
    }
    document.getElementById('chatWindow').classList.remove('hidden');

    // Загружаем сообщения
    await loadChatMessages(currentChatId);

    // Запускаем обновление каждые 5 секунд
    if (messageUpdateInterval) {
        clearInterval(messageUpdateInterval);
    }

    messageUpdateInterval = setInterval(async () => {
        if (currentChatId) {
            console.log('Проверяем новые сообщения...');
            await loadChatMessages(currentChatId);
        }
    }, 5000);
}

// Закрытие окна чата в стиле Telegram
function closeChatWindow() {
    if (messageUpdateInterval) {
        clearInterval(messageUpdateInterval);
        messageUpdateInterval = null;
    }

    currentChatId = null;
    currentChatUser = null;
    lastMessageCount = 0; // Сбрасываем счетчик сообщений

    // Telegram стиль закрытия
    document.getElementById('chatWindow').classList.add('hidden');
    
    if (window.innerWidth <= 768) {
        document.querySelector('.telegram-chat-list').classList.remove('hidden');
    }
    
    document.getElementById('chatMessages').innerHTML = '';
}

// Загрузка сообщений чата
async function loadChatMessages(chatId) {
    try {
        const response = await fetch(`${API_URL}/chats/${chatId}/messages`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });

        if (response.ok) {
            const messages = await response.json();
            const newMessageCount = messages.length;

            console.log(`Загружено ${newMessageCount} сообщений для чата ${chatId}`);

            // Всегда обновляем при первой загрузке или если количество изменилось
            if (lastMessageCount === 0 || newMessageCount !== lastMessageCount) {
                console.log(`Обновляем сообщения: было ${lastMessageCount}, стало ${newMessageCount}`);
                displayMessages(messages);
                lastMessageCount = newMessageCount;
            } else {
                console.log('Количество сообщений не изменилось, пропускаем обновление');
            }
        } else {
            console.error('Ошибка загрузки сообщений:', response.status);
        }
    } catch (error) {
        console.error('Ошибка загрузки сообщений:', error);
    }
}

// Отображение сообщений в стиле Telegram
function displayMessages(messages) {
    const container = document.getElementById('chatMessages');

    if (messages.length === 0) {
        container.innerHTML = '<p class="no-messages" style="color: #8e8e93; text-align: center; padding: 20px;">В этом чате пока нет сообщений</p>';
        return;
    }

    // Разворачиваем массив, чтобы старые сообщения были вверху, новые внизу
    const reversedMessages = [...messages].reverse();

    container.innerHTML = reversedMessages.map(message => {
        const isOwn = message.sender_id === app.currentUser.id;
        const sender = isOwn ? app.currentUser : currentChatUser;
        
        // Определяем тип контента
        let messageContent = '';
        if (message.file_url) {
            if (message.file_type && message.file_type.startsWith('image/')) {
                messageContent = `<img src="${message.file_url}" alt="Image" style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer;" onclick="window.open('${message.file_url}', '_blank')">`;
            } else {
                messageContent = `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                        <span style="font-size: 20px;">📎</span>
                        <div>
                            <div style="font-size: 14px; font-weight: 500;">${message.file_name || 'File'}</div>
                            <div style="font-size: 12px; opacity: 0.7;">${message.file_size || ''}</div>
                        </div>
                        <button onclick="window.open('${message.file_url}', '_blank')" style="background: none; border: none; color: #007aff; cursor: pointer; font-size: 16px;">⬇</button>
                    </div>
                `;
            }
        } else {
            messageContent = escapeHtml(message.content);
        }
        
        return `
            <div class="telegram-message ${isOwn ? 'own' : ''}">
                ${!isOwn ? `
                    <div class="telegram-message-avatar">
                        ${sender.avatar ? 
                            `<img src="${sender.avatar}" alt="${sender.name}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : 
                            sender.name.charAt(0).toUpperCase()
                        }
                    </div>
                ` : ''}
                <div class="telegram-message-content">
                    <div class="telegram-message-bubble">
                        ${messageContent}
                        <span class="telegram-message-time">${formatTime(message.created_at)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Скролл вниз
    container.scrollTop = container.scrollHeight;
}

// Обработка выбора файла
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        // Показываем превью файла
        const fileName = file.name;
        const fileSize = (file.size / 1024 / 1024).toFixed(2) + ' MB';
        
        // Добавляем информацию о файле в поле ввода
        const input = document.getElementById('chatMessageInput');
        input.value = `📎 ${fileName} (${fileSize})`;
        
        // Сохраняем файл для отправки
        currentFile = file;
    }
}

// Отправка сообщения с поддержкой файлов
async function sendMessage() {
    console.log('=== Функция sendMessage вызвана ===');
    
    const input = document.getElementById('chatMessageInput');
    const content = input.value.trim();
    const fileToSend = currentFile;

    console.log('Input элемент найден:', !!input);
    console.log('Содержимое:', content);
    console.log('Файл:', fileToSend);
    console.log('currentChatId:', currentChatId);
    console.log('app.token:', app.token ? 'есть' : 'нет');

    if (!content && !fileToSend) {
        console.log('❌ Блокировка: Нет контента и файла');
        showNotification('Сообщение не может быть пустым', 'error');
        return;
    }

    if (!currentChatId) {
        console.log('❌ Блокировка: Нет текущего чата');
        showNotification('Нет активного чата', 'error');
        return;
    }

    console.log('✅ Все проверки пройдены, отправляем сообщение');

    const messageContent = content || (fileToSend ? `📎 ${fileToSend.name}` : '');

    console.log('Отправляем:', messageContent, 'в чат:', currentChatId);

    try {
        let formData = new FormData();
        formData.append('content', messageContent);
        
        if (fileToSend) {
            formData.append('file', fileToSend);
        }

        const response = await fetch(`${API_URL}/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${app.token}`
            },
            body: formData
        });

        console.log('Ответ сервера:', response.status);

        if (response.ok) {
            const newMessage = await response.json();
            console.log('Сообщение отправлено:', newMessage);
            
            // Очищаем только после успешной отправки
            input.value = '';
            currentFile = null;
            document.getElementById('fileInput').value = '';
            
            // Обновляем сообщения
            await loadChatMessages(currentChatId);
        } else {
            const errorData = await response.json();
            console.log('Ошибка отправки:', errorData);
            showNotification(errorData.error || 'Ошибка отправки сообщения', 'error');
        }
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        showNotification('Ошибка соединения', 'error');
    }
}

// Удаление чата
async function deleteChat() {
    console.log('🗑️ deleteChat вызвана');
    if (!currentChatId) {
        console.error('❌ Нет текущего чата для удаления');
        showNotification('Нет активного чата', 'error');
        return;
    }

    // Закрываем меню перед удалением
    const menu = document.getElementById('chatMenu');
    if (menu) {
        menu.classList.add('hidden');
        console.log('✅ Меню закрыто');
    }

    if (!confirm('Удалить этот чат? Это действие нельзя отменить.')) {
        console.log('❌ Пользователь отменил удаление');
        return;
    }

    console.log('✅ Начинаем удаление чата:', currentChatId);

    try {
        const response = await fetch(`${API_URL}/chats/${currentChatId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });

        if (response.ok) {
            console.log('✅ Чат успешно удален');
            showNotification('Чат удален', 'success');

            // Очищаем текущий чат и закрываем окно
            currentChatId = null;
            currentChatUser = null;

            // Останавливаем обновление сообщений
            if (messageUpdateInterval) {
                clearInterval(messageUpdateInterval);
                messageUpdateInterval = null;
            }

            // Закрываем окно чата и показываем список чатов
            document.getElementById('chatWindow').classList.add('hidden');
            document.getElementById('chatsListSection').classList.remove('hidden');
            document.getElementById('chatMessages').innerHTML = '';

            // Перезагружаем список чатов
            loadChats();
        } else {
            const error = await response.json();
            console.error('❌ Ошибка удаления чата:', error);
            showNotification(error.error || 'Ошибка удаления', 'error');
        }
    } catch (error) {
        console.error('❌ Ошибка сети при удалении:', error);
        showNotification('Ошибка сети', 'error');
    }
}

// Обновление количества непрочитанных
async function updateUnreadCount() {
    try {
        const response = await fetch(`${API_URL}/messages/unread-count`, {
            headers: {
                'Authorization': `Bearer ${app.token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            const badge = document.getElementById('unreadBadge');
            const count = data.count;

            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Ошибка получения непрочитанных:', error);
    }
}

// WebSocket для реального времени
function setupChatWebSocket() {
    if (!app.socket) return;

    app.socket.on('new_chat_message', (data) => {
        console.log('Новое сообщение через WebSocket:', data);
        if (data.chat_id === currentChatId) {
            loadChatMessages(currentChatId);
        } else {
            loadChats();
            updateUnreadCount();
        }
    });

    app.socket.on('connect', () => {
        console.log('WebSocket подключен');
        if (app.token) {
            app.socket.emit('authenticate', app.token);
        }
    });
}

// Вспомогательные функции
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, текущий пользователь:', app.currentUser);
    
    // Устанавливаем тему на документ
    document.documentElement.setAttribute('data-theme', app.theme || 'light');
    console.log('Установлена тема при загрузке:', app.theme || 'light');

    // Инициализируем мессенджер если пользователь авторизован
    if (app.currentUser) {
        console.log('Пользователь авторизован при загрузке, инициализируем мессенджер');
        initMessenger();
        setupChatWebSocket();
    } else {
        console.log('Пользователь не авторизован при загрузке, мессенджер не инициализируем');
    }
});