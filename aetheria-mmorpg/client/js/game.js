class AetheriaGame {
    constructor() {
        // عناصر DOM
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.loginScreen = document.getElementById('loginScreen');
        this.gameContainer = document.getElementById('gameContainer');
        
        // حالة اللعبة
        this.socket = null;
        this.player = null;
        this.otherPlayers = new Map();
        this.npcs = new Map();
        this.enemies = new Map();
        this.projectiles = new Map();
        this.particles = new Map();
        
        // التحكم
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false };
        this.lastClick = 0;
        
        // حالة العالم
        this.worldState = {
            playersOnline: 0,
            memoryDecay: 10,
            currentCycle: 'day',
            activeEvents: []
        };
        
        // الإعدادات
        this.settings = {
            soundVolume: 0.7,
            musicVolume: 0.5,
            showDamageNumbers: true,
            showPlayerNames: true,
            graphicsQuality: 'medium'
        };
        
        // تهيئة اللعبة
        this.init();
    }
    
    init() {
        // إعداد القماش
        this.setupCanvas();
        
        // إعداد المستمعين للأحداث
        this.setupEventListeners();
        
        // الاتصال بالخادم
        this.connectToServer();
        
        // بدء حلقة اللعبة
        this.gameLoop();
    }
    
    setupCanvas() {
        // ضبط حجم القماش ليتناسب مع النافذة
        this.resizeCanvas();
        
        // إعادة ضبط الحجم عند تغيير حجم النافذة
        window.addEventListener('resize', () => this.resizeCanvas());
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    setupEventListeners() {
        // تسجيل الدخول
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        
        // إدخال الاسم (زر Enter)
        document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.startGame();
        });
        
        // لوحة المفاتيح
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.toggleMenu();
            this.keys[e.key.toLowerCase()] = true;
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
        
        // الفأرة
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.down = true;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
            
            // استخدام المهارة إذا كان هناك هدف
            if (Date.now() - this.lastClick > 500) { // منع النقر السريع
                this.useSkill();
                this.lastClick = Date.now();
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        // الدردشة
        document.getElementById('sendChatBtn').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });
        
        // مهارات شريط المهارات
        document.querySelectorAll('.skill-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                const skillSlot = e.target.dataset.slot;
                this.useSkill(skillSlot);
            });
        });
    }
    
    connectToServer() {
        this.socket = io('http://localhost:5000');
        
        // معالجة أحداث الخادم
        this.socket.on('connect', () => {
            console.log('✅ متصل بالخادم');
            this.showNotification('✅ متصل بالخادم', 'success');
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ انقطع الاتصال بالخادم');
            this.showNotification('❌ انقطع الاتصال بالخادم', 'error');
        });
        
        // بيانات اللاعب
        this.socket.on('playerData', (playerData) => {
            this.player = playerData;
            this.updatePlayerUI();
            this.showNotification(`مرحباً ${playerData.name}!`, 'success');
        });
        
        // حالة العالم
        this.socket.on('worldState', (state) => {
            this.worldState = state;
            this.updateWorldUI();
        });
        
        this.socket.on('worldStateUpdate', (update) => {
            Object.assign(this.worldState, update);
            this.updateWorldUI();
        });
        
        // اللاعبون الآخرون
        this.socket.on('playerJoined', (player) => {
            this.otherPlayers.set(player.id, player);
            this.showNotification(`${player.name} انضم للعالم`, 'info');
        });
        
        this.socket.on('playerMoved', (data) => {
            const player = this.otherPlayers.get(data.id);
            if (player) {
                player.position = data.position;
            }
        });
        
        this.socket.on('playerLeft', (playerId) => {
            const player = this.otherPlayers.get(playerId);
            if (player) {
                this.showNotification(`${player.name} غادر العالم`, 'info');
                this.otherPlayers.delete(playerId);
            }
        });
        
        // الدردشة
        this.socket.on('globalChatMessage', (message) => {
            this.addChatMessage(message, 'global');
        });
        
        this.socket.on('clanChatMessage', (message) => {
            this.addChatMessage(message, 'clan');
        });
        
        // المهام
        this.socket.on('availableQuests', (quests) => {
            this.updateQuestsList(quests);
        });
        
        this.socket.on('questStarted', (data) => {
            this.showNotification(`بدأت مهمة: ${data.quest.title}`, 'success');
        });
        
        this.socket.on('questCompleted', (data) => {
            this.showNotification(`أكملت مهمة: ${data.quest.title}!`, 'success');
        });
        
        // الأرينا
        this.socket.on('arenaMatchStarted', (matchData) => {
            this.startArenaMatch(matchData);
        });
        
        this.socket.on('arenaError', (message) => {
            this.showNotification(message, 'error');
        });
        
        // المتاهات
        this.socket.on('activeDungeons', (dungeons) => {
            this.updateDungeonsList(dungeons);
        });
        
        this.socket.on('shardEchoActivated', (data) => {
            this.showNotification(`📢 صيحة شظية ${data.shardType} نشطة الآن!`, 'warning');
        });
        
        // لوحة المتصدرين
        this.socket.on('leaderboardsUpdated', (leaderboards) => {
            this.updateLeaderboards(leaderboards);
        });
        
        // العشائر
        this.socket.on('clanInfo', (info) => {
            this.updateClanInfo(info);
        });
    }
    
    startGame() {
        const name = document.getElementById('playerNameInput').value.trim();
        const playerClass = document.getElementById('playerClass').value;
        
        if (!name) {
            this.showNotification('الرجاء إدخال اسم اللاعب', 'error');
            return;
        }
        
        if (!playerClass) {
            this.showNotification('الرجاء اختيار فئة اللاعب', 'error');
            return;
        }
        
        // إخفاء شاشة تسجيل الدخول
        this.loginScreen.style.display = 'none';
        this.gameContainer.style.display = 'block';
        
        // إرسال بيانات اللاعب للخادم
        this.socket.emit('playerLogin', {
            name: name,
            class: playerClass
        });
    }
    
    update() {
        if (!this.player) return;
        
        // تحديث حركة اللاعب
        this.updatePlayerMovement();
        
        // تحديث الجسيمات
        this.updateParticles();
        
        // تحديث المقذوفات
        this.updateProjectiles();
        
        // تحديث الأعداء
        this.updateEnemies();
    }
    
    updatePlayerMovement() {
        const speed = 5;
        let moveX = 0;
        let moveY = 0;
        
        // التحكم بحركة WASD
        if (this.keys['w'] || this.keys['arrowup']) moveY = -speed;
        if (this.keys['s'] || this.keys['arrowdown']) moveY = speed;
        if (this.keys['a'] || this.keys['arrowleft']) moveX = -speed;
        if (this.keys['d'] || this.keys['arrowright']) moveX = speed;
        
        // تطبيق الحركة
        if (moveX !== 0 || moveY !== 0) {
            this.player.position.x += moveX;
            this.player.position.y += moveY;
            
            // إرسال الموقع للخادم
            this.socket.emit('playerMove', this.player.position);
        }
    }
    
    useSkill(skillSlot = '1') {
        if (!this.player) return;
        
        // هنا سيتم تنفيذ منطق استخدام المهارة
        const skillKey = `skill${skillSlot}`;
        
        // إرسال حدث استخدام المهارة للخادم
        this.socket.emit('useSkill', {
            skillSlot: skillSlot,
            target: { x: this.mouse.x, y: this.mouse.y }
        });
        
        // تأثير مرئي محلي
        this.createParticleEffect(this.mouse.x, this.mouse.y, 'skill_cast');
    }
    
    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message || !this.player) return;
        
        // إرسال للخادم
        this.socket.emit('globalChat', message);
        
        // مسح حقل الإدخال
        input.value = '';
        input.focus();
    }
    
    addChatMessage(messageData, type = 'global') {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        
        messageDiv.className = `chat-message ${type}`;
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${messageData.player}</span>
                <span class="message-time">${this.formatTime(messageData.timestamp)}</span>
            </div>
            <div class="message-content">${messageData.message}</div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    updatePlayerUI() {
        if (!this.player) return;
        
        // تحديث الاسم
        document.getElementById('playerNameDisplay').textContent = this.player.name;
        
        // تحديث المستوى
        document.getElementById('levelValue').textContent = this.player.level || 1;
        
        // تحديث نقاط الصعود
        document.getElementById('ascensionPoints').textContent = 
            `${this.player.ascensionPoints || 0} نقطة صعود`;
        
        // تحديث المباريات اليومية
        document.getElementById('dailyMatches').textContent = 
            `${this.player.dailyArenaMatches || 0}/10 مباريات اليوم`;
        
        // تحديث شريط التقدم
        const progressPercent = Math.min(100, (this.player.ascensionPoints || 0) / 50);
        document.getElementById('ascensionProgress').textContent = `${progressPercent}%`;
        document.getElementById('ascensionBar').style.width = `${progressPercent}%`;
    }
    
    updateWorldUI() {
        // تحديث عدد اللاعبين
        document.getElementById('onlinePlayers').textContent = this.worldState.playersOnline;
        
        // تحديث مستوى النسيان
        document.getElementById('memoryDecay').textContent = 
            `${Math.round(this.worldState.memoryDecay)}%`;
        
        // تحديث الوقت
        document.getElementById('worldTime').textContent = 
            this.worldState.currentCycle === 'day' ? '☀️ نهار' : '🌙 ليل';
        
        // تحديث الأحداث
        const eventElement = document.getElementById('activeEvent');
        if (this.worldState.activeEvents.length > 0) {
            eventElement.textContent = this.worldState.activeEvents[0];
            eventElement.className = 'world-event active';
        } else {
            eventElement.textContent = 'لا توجد أحداث نشطة';
            eventElement.className = 'world-event';
        }
    }
    
    updateQuestsList(quests) {
        // هنا سيتم تحديث قائمة المهام
        console.log('المهام المتاحة:', quests);
    }
    
    updateDungeonsList(dungeons) {
        // هنا سيتم تحديث قائمة المتاهات
        console.log('المتاهات النشطة:', dungeons);
    }
    
    updateLeaderboards(leaderboards) {
        // هنا سيتم تحديث لوحة المتصدرين
        console.log('لوحة المتصدرين:', leaderboards);
    }
    
    updateClanInfo(info) {
        // هنا سيتم تحديث معلومات العشيرة
        console.log('معلومات العشيرة:', info);
    }
    
    startArenaMatch(matchData) {
        this.showNotification(`بدأت مباراة ضد ${matchData.players[1].name}`, 'info');
        // هنا سيتم تنفيذ شاشة المباراة
    }
    
    createParticleEffect(x, y, type) {
        const particleId = `particle_${Date.now()}_${Math.random()}`;
        const particles = [];
        
        for (let i = 0; i < 10; i++) {
            particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1.0,
                color: this.getParticleColor(type),
                size: Math.random() * 5 + 2
            });
        }
        
        this.particles.set(particleId, particles);
        
        // إزالة الجسيمات بعد فترة
        setTimeout(() => {
            this.particles.delete(particleId);
        }, 1000);
    }
    
    getParticleColor(type) {
        const colors = {
            skill_cast: '#4cc9f0',
            damage: '#ff416c',
            heal: '#43e97b',
            mana: '#7209b7'
        };
        
        return colors[type] || '#ffffff';
    }
    
    updateParticles() {
        this.particles.forEach((particles, id) => {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                
                // تحديث الموقع
                p.x += p.vx;
                p.y += p.vy;
                
                // تقليل العمر
                p.life -= 0.02;
                
                // إزالة الجسيمات الميتة
                if (p.life <= 0) {
                    particles.splice(i, 1);
                }
            }
            
            // إزالة مجموعة الجسيمات إذا فارغة
            if (particles.length === 0) {
                this.particles.delete(id);
            }
        });
    }
    
    updateProjectiles() {
        // تحديث المقذوفات
        // (للتطوير المستقبلي)
    }
    
    updateEnemies() {
        // تحديث الأعداء
        // (للتطوير المستقبلي)
    }
    
    draw() {
        // مسح الشاشة
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // رسم الخلفية
        this.drawBackground();
        
        // رسم الشبكة (للتوجيه)
        if (this.settings.graphicsQuality !== 'low') {
            this.drawGrid();
        }
        
        // رسم اللاعبين الآخرين
        this.otherPlayers.forEach(player => {
            this.drawPlayer(player, false);
        });
        
        // رسم الأعداء
        this.enemies.forEach(enemy => {
            this.drawEnemy(enemy);
        });
        
        // رسم المقذوفات
        this.projectiles.forEach(projectile => {
            this.drawProjectile(projectile);
        });
        
        // رسم الجسيمات
        this.drawParticles();
        
        // رسم اللاعب الحالي (في الأعلى)
        if (this.player) {
            this.drawPlayer(this.player, true);
        }
        
        // رسم واجهة التصويب
        this.drawTargeting();
    }
    
    drawBackground() {
        // خلفية متدرجة
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        
        if (this.worldState.currentCycle === 'day') {
            gradient.addColorStop(0, '#4cc9f0');
            gradient.addColorStop(0.5, '#4895ef');
            gradient.addColorStop(1, '#4361ee');
        } else {
            gradient.addColorStop(0, '#0f3460');
            gradient.addColorStop(0.5, '#1a1a2e');
            gradient.addColorStop(1, '#16213e');
        }
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawGrid() {
        const gridSize = 100;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        
        // خطوط رأسية
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // خطوط أفقية
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawPlayer(player, isCurrentPlayer) {
        const colors = {
            warrior: '#ff416c',
            mage: '#4cc9f0',
            rogue: '#f72585'
        };
        
        const playerColor = colors[player.class] || '#ffffff';
        const x = player.position.x;
        const y = player.position.y;
        
        this.ctx.save();
        
        // تأثير التحديد للاعب الحالي
        if (isCurrentPlayer) {
            this.ctx.shadowColor = playerColor;
            this.ctx.shadowBlur = 20;
            
            // دائرة التحديد
            this.ctx.beginPath();
            this.ctx.arc(x + 25, y + 25, 30, 0, Math.PI * 2);
            this.ctx.strokeStyle = playerColor;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
        
        // الجسم (دائرة)
        this.ctx.fillStyle = playerColor;
        this.ctx.beginPath();
        this.ctx.arc(x + 25, y + 25, 20, 0, Math.PI * 2);
        this.ctx.fill();
        
        // التأثير الداخلي
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.beginPath();
        this.ctx.arc(x + 20, y + 20, 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // العينان
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(x + 20, y + 20, 3, 0, Math.PI * 2);
        this.ctx.arc(x + 30, y + 20, 3, 0, Math.PI * 2);
        this.ctx.fill();
        
        // شريط الصحة
        const healthPercent = (player.health || 100) / (player.maxHealth || 100);
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x + 5, y + 55, 40, 6);
        this.ctx.fillStyle = healthPercent > 0.5 ? '#43e97b' : 
                           healthPercent > 0.25 ? '#ff9a00' : '#ff416c';
        this.ctx.fillRect(x + 5, y + 55, 40 * healthPercent, 6);
        
        // الاسم
        if (this.settings.showPlayerNames) {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(player.name, x + 25, y + 75);
            
            // مستوى اللاعب
            this.ctx.font = '12px Arial';
            this.ctx.fillStyle = '#4cc9f0';
            this.ctx.fillText(`مستوى ${player.level || 1}`, x + 25, y + 90);
        }
        
        this.ctx.restore();
    }
    
    drawEnemy(enemy) {
        // رسم العدو
        // (للتطوير المستقبلي)
    }
    
    drawProjectile(projectile) {
        // رسم المقذوف
        // (للتطوير المستقبلي)
    }
    
    drawParticles() {
        this.particles.forEach(particles => {
            particles.forEach(p => {
                this.ctx.save();
                
                this.ctx.globalAlpha = p.life;
                this.ctx.fillStyle = p.color;
                
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.restore();
            });
        });
    }
    
    drawTargeting() {
        if (this.mouse.down) {
            // رسم مؤشر الهدف
            this.ctx.save();
            
            this.ctx.strokeStyle = '#ff416c';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            
            this.ctx.beginPath();
            this.ctx.arc(this.mouse.x, this.mouse.y, 20, 0, Math.PI * 2);
            this.ctx.stroke();
            
            this.ctx.restore();
        }
    }
    
    gameLoop() {
        // تحديث
        this.update();
        
        // رسم
        this.draw();
        
        // الطلب التالي
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // وظائف مساعدة
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.getElementById('quickNotifications').appendChild(notification);
        
        // إزالة بعد 3 ثواني
        setTimeout(() => {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
    
    toggleMenu() {
        // تبديل القائمة
        // (للتطوير المستقبلي)
    }
}

// جعل الكلاس متاحاً عالمياً
window.AetheriaGame = AetheriaGame;