// client/js/ui.js - النسخة المحدثة الشاملة
class AetheriaUI {
    constructor(game) {
        this.game = game;
        this.currentView = 'game';
        this.modals = new Map();
        this.currentTab = 'story'; // للمهام
        this.currentLBCategory = 'ascension'; // للمتصدرين
        
        this.initializeUI();
        this.setupEventListeners();
        this.setupSocketListeners();
    }
    
    initializeUI() {
        this.createArenaModal();
        this.createQuestsModal();
        this.createClansModal();
        this.createDungeonsModal();
        this.createLeaderboardModal();
        this.createInventoryModal();
        this.createSkillsModal();
        this.createSettingsModal();
    }
    
    // ==================== نظام المهام ====================
    createQuestsModal() {
        const modalHTML = `
            <div id="questsModal" class="modal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h2>📜 المهام القصصية</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="quests-container">
                            <div class="quests-tabs">
                                <button class="tab-btn active" data-tab="story" onclick="ui.switchQuestTab('story')">القصة الرئيسية</button>
                                <button class="tab-btn" data-tab="daily" onclick="ui.switchQuestTab('daily')">المهام اليومية</button>
                                <button class="tab-btn" data-tab="clan" onclick="ui.switchQuestTab('clan')">مهام العشيرة</button>
                                <button class="tab-btn" data-tab="completed" onclick="ui.switchQuestTab('completed')">المكتملة</button>
                            </div>
                            
                            <div class="quests-content">
                                <div id="storyQuests" class="tab-content active">
                                    <h3>رحلة الصاعد</h3>
                                    <div class="quest-list" id="storyQuestList">
                                        <!-- سيتم ملؤها ديناميكياً -->
                                    </div>
                                </div>
                                <div id="dailyQuests" class="tab-content">
                                    <h3>التحديات اليومية</h3>
                                    <div class="quest-list" id="dailyQuestList"></div>
                                </div>
                                <div id="clanQuests" class="tab-content">
                                    <h3>مهام العشيرة</h3>
                                    <div class="quest-list" id="clanQuestList"></div>
                                </div>
                                <div id="completedQuests" class="tab-content">
                                    <h3>الإنجازات</h3>
                                    <div class="quest-list" id="completedQuestList"></div>
                                </div>
                            </div>
                            
                            <div class="active-quests">
                                <h3>المهام النشطة</h3>
                                <div class="active-quests-list" id="activeQuestsList"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modals.set('quests', document.getElementById('questsModal'));
    }
    
    switchQuestTab(tabName) {
        this.currentTab = tabName;
        
        // تحديث التبويبات النشطة
        document.querySelectorAll('.quests-tabs .tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // تحديث المحتوى
        document.querySelectorAll('.quests-content .tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}Quests`);
        });
        
        // تحميل المهام الخاصة بالتبويب
        this.loadQuestsForTab(tabName);
    }
    
    loadQuestsForTab(tabName) {
        const questList = document.getElementById(`${tabName}QuestList`);
        
        // طلب المهام من الخادم
        if (this.game.socket) {
            this.game.socket.emit('getAvailableQuests');
        }
        
        // عرض رسالة مؤقتة
        questList.innerHTML = `
            <div class="loading-quests">
                <div class="spinner"></div>
                <p>جاري تحميل المهام...</p>
            </div>
        `;
    }
    
    updateQuestsList(quests) {
        const questList = document.getElementById(`${this.currentTab}QuestList`);
        
        if (!quests || quests.length === 0) {
            questList.innerHTML = `
                <div class="no-quests">
                    <p>لا توجد مهام متاحة حالياً</p>
                    <button class="btn-primary" onclick="ui.refreshQuests()">🔄 تحديث</button>
                </div>
            `;
            return;
        }
        
        let html = '';
        quests.forEach(quest => {
            html += `
                <div class="quest-item" data-quest-id="${quest.id}">
                    <div class="quest-header">
                        <h4>${quest.title}</h4>
                        <span class="quest-type ${quest.type}">${this.getQuestTypeName(quest.type)}</span>
                    </div>
                    <p class="quest-description">${quest.description}</p>
                    
                    <div class="quest-requirements">
                        <div class="requirement">
                            <span class="req-icon">📊</span>
                            <span>المستوى ${quest.requirements?.level || 1}+</span>
                        </div>
                    </div>
                    
                    <div class="quest-rewards">
                        <div class="reward-item">
                            <span class="reward-icon">⭐</span>
                            <span>${quest.rewards?.experience || 0} خبرة</span>
                        </div>
                        <div class="reward-item">
                            <span class="reward-icon">💰</span>
                            <span>${quest.rewards?.gold || 0} ذهب</span>
                        </div>
                    </div>
                    
                    <button class="btn-primary start-quest-btn" onclick="ui.startQuest('${quest.id}')">
                        بدء المهمة
                    </button>
                </div>
            `;
        });
        
        questList.innerHTML = html;
    }
    
    startQuest(questId) {
        if (this.game.socket) {
            this.game.socket.emit('startQuest', questId);
        }
    }
    
    getQuestTypeName(type) {
        const types = {
            'story': 'قصة',
            'daily': 'يومية', 
            'clan': 'عشائرية'
        };
        return types[type] || 'مهمة';
    }
    
    refreshQuests() {
        this.loadQuestsForTab(this.currentTab);
    }
    
    // ==================== نظام العشائر ====================
    createClansModal() {
        const modalHTML = `
            <div id="clansModal" class="modal">
                <div class="modal-content xlarge">
                    <div class="modal-header">
                        <h2>🏛️ العشائر</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="clans-container">
                            <!-- معلومات العشيرة الحالية -->
                            <div class="clan-info" id="playerClanInfo" style="display: none;">
                                <div class="clan-header">
                                    <h3 id="clanNameDisplay">اسم العشيرة</h3>
                                    <span class="clan-tag" id="clanTagDisplay">[TAG]</span>
                                </div>
                                
                                <div class="clan-details">
                                    <p id="clanDescriptionDisplay">وصف العشيرة</p>
                                    
                                    <div class="clan-stats">
                                        <div class="clan-stat">
                                            <span class="stat-label">المستوى:</span>
                                            <span class="stat-value" id="clanLevel">1</span>
                                        </div>
                                        <div class="clan-stat">
                                            <span class="stat-label">الأعضاء:</span>
                                            <span class="stat-value" id="clanMembers">0/50</span>
                                        </div>
                                        <div class="clan-stat">
                                            <span class="stat-label">الموارد:</span>
                                            <span class="stat-value" id="clanResources">0</span>
                                        </div>
                                    </div>
                                    
                                    <div class="clan-perks" id="clanPerks"></div>
                                </div>
                                
                                <div class="clan-actions">
                                    <button class="btn-primary" onclick="ui.viewClanMembers()">👥 عرض الأعضاء</button>
                                    <button class="btn-secondary" onclick="ui.openClanChat()">💬 دردشة العشيرة</button>
                                    <button class="btn-success" onclick="ui.openDonateModal()">💰 التبرع</button>
                                    <button class="btn-danger" onclick="ui.leaveClan()">🚪 مغادرة</button>
                                </div>
                            </div>
                            
                            <!-- قائمة العشائر -->
                            <div class="clans-list-section">
                                <h3>العشائر المتاحة</h3>
                                <div class="clans-filters">
                                    <input type="text" id="clanSearch" placeholder="بحث عن عشيرة..." 
                                           oninput="ui.searchClans(this.value)">
                                    <select id="clanFilter" onchange="ui.filterClans()">
                                        <option value="all">جميع العشائر</option>
                                        <option value="recruiting">تقبل أعضاء جدد</option>
                                        <option value="highLevel">عالية المستوى</option>
                                    </select>
                                </div>
                                
                                <div class="clans-list" id="clansList">
                                    <!-- سيتم ملؤها ديناميكياً -->
                                </div>
                                
                                <!-- إنشاء عشيرة جديدة -->
                                <div class="create-clan-section">
                                    <h4>إنشاء عشيرة جديدة</h4>
                                    <div class="create-clan-form">
                                        <input type="text" id="newClanName" placeholder="اسم العشيرة" maxlength="20">
                                        <input type="text" id="newClanTag" placeholder="الاختصار (4 أحرف)" maxlength="4">
                                        <textarea id="newClanDescription" placeholder="وصف العشيرة" maxlength="200"></textarea>
                                        <button class="btn-primary" onclick="ui.createClan()">
                                            إنشاء العشيرة (50,000 ذهب)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modals.set('clans', document.getElementById('clansModal'));
    }
    
    loadClansList() {
        if (this.game.socket) {
            this.game.socket.emit('getClanInfo');
        }
        
        const clansList = document.getElementById('clansList');
        clansList.innerHTML = `
            <div class="loading-clans">
                <div class="spinner"></div>
                <p>جاري تحميل العشائر...</p>
            </div>
        `;
    }
    
    updateClanInfo(info) {
        const playerClanInfo = document.getElementById('playerClanInfo');
        const clansList = document.getElementById('clansList');
        
        if (info && info.id) {
            // عرض معلومات العشيرة الحالية
            playerClanInfo.style.display = 'block';
            
            document.getElementById('clanNameDisplay').textContent = info.name;
            document.getElementById('clanTagDisplay').textContent = `[${info.tag}]`;
            document.getElementById('clanDescriptionDisplay').textContent = info.description;
            document.getElementById('clanLevel').textContent = info.level;
            document.getElementById('clanMembers').textContent = `${info.members?.length || 0}/${info.maxMembers || 50}`;
            document.getElementById('clanResources').textContent = info.resources?.gold || 0;
            
            // تحديث المزايا
            const perksHtml = this.generatePerksHtml(info.perks);
            document.getElementById('clanPerks').innerHTML = perksHtml;
        } else {
            playerClanInfo.style.display = 'none';
        }
        
        // تحميل قائمة العشائر (يجب أن تأتي من الخادم)
        // هذا مثال مؤقت
        const sampleClans = [
            { id: 'dragons', name: 'تنانين الأثير', tag: 'DRGN', level: 5, members: 45, maxMembers: 50, description: 'عشيرة المحاربين الأشداء' },
            { id: 'phoenix', name: 'طيور الفينيق', tag: 'PHNX', level: 4, members: 38, maxMembers: 45, description: 'حراس المعرفة والأسرار' },
            { id: 'wardens', name: 'حراس الشظايا', tag: 'WARD', level: 3, members: 25, maxMembers: 40, description: 'صيادو الشظايا المفقودة' }
        ];
        
        this.displayClansList(sampleClans);
    }
    
    generatePerksHtml(perks) {
        if (!perks) return '<p>لا توجد مزايا حالياً</p>';
        
        let html = '<h4>مزايا العشيرة:</h4><ul class="perks-list">';
        
        if (perks.experienceBoost) {
            html += `<li>📈 زيادة خبرة: +${(perks.experienceBoost * 100)}%</li>`;
        }
        
        if (perks.craftingDiscount) {
            html += `<li>⚒️ خصم صياغة: ${(perks.craftingDiscount * 100)}%</li>`;
        }
        
        if (perks.researchSpeed) {
            html += `<li>🔬 سرعة بحث: +${(perks.researchSpeed * 100)}%</li>`;
        }
        
        html += '</ul>';
        return html;
    }
    
    displayClansList(clans) {
        const clansList = document.getElementById('clansList');
        
        if (!clans || clans.length === 0) {
            clansList.innerHTML = '<p class="no-clans">لا توجد عشائر متاحة حالياً</p>';
            return;
        }
        
        let html = '';
        clans.forEach(clan => {
            const memberPercent = (clan.members / clan.maxMembers) * 100;
            
            html += `
                <div class="clan-item" data-clan-id="${clan.id}">
                    <div class="clan-header">
                        <h4>${clan.name} <span class="clan-tag">[${clan.tag}]</span></h4>
                        <span class="clan-level">المستوى ${clan.level}</span>
                    </div>
                    
                    <p class="clan-description">${clan.description}</p>
                    
                    <div class="clan-stats">
                        <div class="clan-stat">
                            <span class="stat-icon">👥</span>
                            <span class="stat-value">${clan.members}/${clan.maxMembers}</span>
                            <div class="progress-bar small">
                                <div class="progress-fill" style="width: ${memberPercent}%"></div>
                            </div>
                        </div>
                        <div class="clan-stat">
                            <span class="stat-icon">📊</span>
                            <span class="stat-value">نشطة</span>
                        </div>
                    </div>
                    
                    <button class="btn-primary join-clan-btn" onclick="ui.joinClan('${clan.id}')">
                        انضم للعشيرة
                    </button>
                </div>
            `;
        });
        
        clansList.innerHTML = html;
    }
    
    createClan() {
        const name = document.getElementById('newClanName').value.trim();
        const tag = document.getElementById('newClanTag').value.trim().toUpperCase();
        const description = document.getElementById('newClanDescription').value.trim();
        
        if (!name || !tag || !description) {
            this.showNotification('يرجى ملء جميع الحقول', 'error');
            return;
        }
        
        if (tag.length !== 4) {
            this.showNotification('الاختصار يجب أن يكون 4 أحرف', 'error');
            return;
        }
        
        if (this.game.socket) {
            this.game.socket.emit('createClan', {
                name: name,
                tag: tag,
                description: description
            });
        }
    }
    
    joinClan(clanId) {
        if (this.game.socket) {
            this.game.socket.emit('joinClan', clanId);
        }
    }
    
    // ==================== نظام المتاهات ====================
    createDungeonsModal() {
        const modalHTML = `
            <div id="dungeonsModal" class="modal">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h2>🏰 متاهات الصيحات</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="dungeons-container">
                            <!-- معلومات صيحات الشظايا -->
                            <div class="shard-echoes-info">
                                <h3>📢 صيحات الشظايا النشطة</h3>
                                <div class="echoes-list" id="activeEchoes">
                                    <!-- سيتم ملؤها ديناميكياً -->
                                </div>
                            </div>
                            
                            <!-- المتاهات النشطة -->
                            <div class="active-dungeons-section">
                                <h3>المتاهات المفتوحة</h3>
                                <div class="dungeons-list" id="activeDungeonsList">
                                    <!-- سيتم ملؤها ديناميكياً -->
                                </div>
                            </div>
                            
                            <!-- إحصائيات المتاهات -->
                            <div class="dungeon-stats-section">
                                <h3>إحصائياتك في المتاهات</h3>
                                <div class="stats-grid">
                                    <div class="stat-card">
                                        <div class="stat-icon">🏆</div>
                                        <div class="stat-content">
                                            <div class="stat-value" id="dungeonsCompleted">0</div>
                                            <div class="stat-label">مكتملة</div>
                                        </div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">⚔️</div>
                                        <div class="stat-content">
                                            <div class="stat-value" id="totalKills">0</div>
                                            <div class="stat-label">قتلى</div>
                                        </div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">💰</div>
                                        <div class="stat-content">
                                            <div class="stat-value" id="totalLoot">0</div>
                                            <div class="stat-label">غنائم</div>
                                        </div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-icon">⏱️</div>
                                        <div class="stat-content">
                                            <div class="stat-value" id="bestTime">--:--</div>
                                            <div class="stat-label">أفضل وقت</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- زر دخول المتاهة -->
                            <div class="dungeon-actions">
                                <button class="btn-primary" onclick="ui.refreshDungeons()">
                                    🔄 تحديث القائمة
                                </button>
                                <button class="btn-success" id="enterDungeonBtn" disabled 
                                        onclick="ui.enterSelectedDungeon()">
                                    🚪 دخول المتاهة
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modals.set('dungeons', document.getElementById('dungeonsModal'));
    }
    
    loadDungeons() {
        if (this.game.socket) {
            this.game.socket.emit('getActiveDungeons');
        }
        
        const dungeonsList = document.getElementById('activeDungeonsList');
        dungeonsList.innerHTML = `
            <div class="loading-dungeons">
                <div class="spinner"></div>
                <p>جاري تحميل المتاهات...</p>
            </div>
        `;
    }
    
    updateDungeonsList(dungeons) {
        const echoesList = document.getElementById('activeEchoes');
        const dungeonsList = document.getElementById('activeDungeonsList');
        
        if (!dungeons || dungeons.length === 0) {
            echoesList.innerHTML = '<p class="no-echoes">لا توجد صيحات نشطة حالياً</p>';
            dungeonsList.innerHTML = '<p class="no-dungeons">لا توجد متاهات مفتوحة حالياً</p>';
            return;
        }
        
        // عرض الصيحات النشطة
        let echoesHtml = '';
        dungeons.filter(d => d.schedule?.active).forEach(dungeon => {
            const timeRemaining = this.calculateTimeRemaining(dungeon.schedule);
            
            echoesHtml += `
                <div class="echo-item ${dungeon.shardType}">
                    <div class="echo-header">
                        <h4>${dungeon.name}</h4>
                        <span class="echo-type">${this.getShardName(dungeon.shardType)}</span>
                    </div>
                    <p>${dungeon.description}</p>
                    <div class="echo-timer">
                        <span class="timer-label">تنتهي بعد:</span>
                        <span class="timer-value">${timeRemaining}</span>
                    </div>
                </div>
            `;
        });
        
        echoesList.innerHTML = echoesHtml || '<p class="no-echoes">لا توجد صيحات نشطة حالياً</p>';
        
        // عرض المتاهات المتاحة
        let dungeonsHtml = '';
        dungeons.forEach(dungeon => {
            dungeonsHtml += `
                <div class="dungeon-item" data-dungeon-id="${dungeon.instanceId}">
                    <div class="dungeon-header">
                        <h4>${dungeon.name}</h4>
                        <div class="dungeon-difficulty ${dungeon.difficulty}">
                            ${this.getDifficultyName(dungeon.difficulty)}
                        </div>
                    </div>
                    
                    <div class="dungeon-info">
                        <div class="info-item">
                            <span class="info-icon">📊</span>
                            <span>المستوى ${dungeon.level}+</span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">👥</span>
                            <span>${dungeon.players?.length || 0}/${dungeon.maxPlayers}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">🎯</span>
                            <span>${dungeon.stages} مراحل</span>
                        </div>
                    </div>
                    
                    <div class="dungeon-rewards">
                        <div class="reward-preview">
                            <span class="reward-icon">⭐</span>
                            <span>${dungeon.rewards?.base?.experience || 0}+ خبرة</span>
                        </div>
                        <div class="reward-preview">
                            <span class="reward-icon">💰</span>
                            <span>${dungeon.rewards?.base?.gold || 0}+ ذهب</span>
                        </div>
                    </div>
                    
                    <button class="btn-primary enter-dungeon-btn" 
                            onclick="ui.selectDungeon('${dungeon.instanceId}')">
                        دخول المتاهة
                    </button>
                </div>
            `;
        });
        
        dungeonsList.innerHTML = dungeonsHtml || '<p class="no-dungeons">لا توجد متاهات مفتوحة حالياً</p>';
    }
    
    selectDungeon(dungeonId) {
        document.getElementById('enterDungeonBtn').disabled = false;
        document.getElementById('enterDungeonBtn').dataset.dungeonId = dungeonId;
        this.selectedDungeon = dungeonId;
    }
    
    enterSelectedDungeon() {
        if (this.selectedDungeon && this.game.socket) {
            this.game.socket.emit('enterDungeon', this.selectedDungeon);
        }
    }
    
    calculateTimeRemaining(schedule) {
        if (!schedule) return 'غير معروف';
        
        const now = Date.now();
        const endTime = schedule.nextActivation + schedule.duration;
        const remaining = endTime - now;
        
        if (remaining <= 0) return 'منتهية';
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        return `${hours}س ${minutes}د`;
    }
    
    getShardName(shardType) {
        const names = {
            'water': 'شظية الماء',
            'fire': 'شظية النار',
            'earth': 'شظية الأرض'
        };
        return names[shardType] || 'شظية';
    }
    
    getDifficultyName(difficulty) {
        const names = {
            'normal': 'عادية',
            'hard': 'صعبة',
            'elite': 'نخبة'
        };
        return names[difficulty] || difficulty;
    }
    
    refreshDungeons() {
        this.loadDungeons();
    }
    
    // ==================== نظام لوحة المتصدرين ====================
    createLeaderboardModal() {
        const modalHTML = `
            <div id="leaderboardModal" class="modal">
                <div class="modal-content xlarge">
                    <div class="modal-header">
                        <h2>🏆 لوحة المتصدرين</h2>
                        <span class="close">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="leaderboard-container">
                            <!-- معلومات الموسم -->
                            <div class="season-info">
                                <h3 id="seasonName">الموسم 1: صحوة الأثير</h3>
                                <div class="season-timer">
                                    <span class="timer-label">ينتهي الموسم بعد:</span>
                                    <span class="timer-value" id="seasonTimeRemaining">29 يوم 23 ساعة</span>
                                    <div class="season-progress">
                                        <div class="progress-bar">
                                            <div class="progress-fill" id="seasonProgressFill" style="width: 10%"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- تبويبات الفئات -->
                            <div class="leaderboard-tabs">
                                <button class="lb-tab active" data-category="ascension" 
                                        onclick="ui.switchLBCategory('ascension')">⭐ الصعود</button>
                                <button class="lb-tab" data-category="arena" 
                                        onclick="ui.switchLBCategory('arena')">⚔️ الأرينا</button>
                                <button class="lb-tab" data-category="clans" 
                                        onclick="ui.switchLBCategory('clans')">🏛️ العشائر</button>
                                <button class="lb-tab" data-category="dungeons" 
                                        onclick="ui.switchLBCategory('dungeons')">🏰 المتاهات</button>
                                <button class="lb-tab" data-category="quests" 
                                        onclick="ui.switchLBCategory('quests')">📜 المهام</button>
                            </div>
                            
                            <!-- محتوى اللوحة -->
                            <div class="leaderboard-content">
                                <!-- الثلاثة الأوائل -->
                                <div class="top-three" id="topThree">
                                    <div class="top-player second">
                                        <div class="rank">🥈</div>
                                        <div class="player-name">--</div>
                                        <div class="player-points">0 نقطة</div>
                                    </div>
                                    <div class="top-player first">
                                        <div class="rank">🥇</div>
                                        <div class="player-name">--</div>
                                        <div class="player-points">0 نقطة</div>
                                    </div>
                                    <div class="top-player third">
                                        <div class="rank">🥉</div>
                                        <div class="player-name">--</div>
                                        <div class="player-points">0 نقطة</div>
                                    </div>
                                </div>
                                
                                <!-- جدول اللوحة -->
                                <div class="leaderboard-table-container">
                                    <div class="table-controls">
                                        <div class="search-box">
                                            <input type="text" id="leaderboardSearch" 
                                                   placeholder="بحث عن لاعب..." 
                                                   oninput="ui.searchLeaderboard(this.value)">
                                        </div>
                                        <div class="table-actions">
                                            <button class="btn-secondary" onclick="ui.refreshLeaderboard()">
                                                🔄 تحديث
                                            </button>
                                            <button class="btn-primary" onclick="ui.jumpToMyRank()">
                                                🎯 رتبتي
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div class="leaderboard-table">
                                        <div class="table-header">
                                            <div class="header-cell rank">#</div>
                                            <div class="header-cell name">اللاعب</div>
                                            <div class="header-cell points">النقاط</div>
                                            <div class="header-cell level">المستوى</div>
                                            <div class="header-cell clan">العشيرة</div>
                                        </div>
                                        <div class="table-body" id="leaderboardTable">
                                            <!-- سيتم ملؤها ديناميكياً -->
                                        </div>
                                    </div>
                                    
                                    <div class="table-pagination">
                                        <button class="page-btn" onclick="ui.prevPage()">◀ السابق</button>
                                        <span class="page-info" id="pageInfo">الصفحة 1 من 10</span>
                                        <button class="page-btn" onclick="ui.nextPage()">التالي ▶</button>
                                    </div>
                                </div>
                                
                                <!-- رتبة اللاعب الحالي -->
                                <div class="player-rank-card" id="playerRankCard">
                                    <h4>رتبتك</h4>
                                    <div class="player-rank-info">
                                        <div class="rank-position" id="playerRankPosition">#---</div>
                                        <div class="player-details">
                                            <div class="player-name" id="playerRankName">...</div>
                                            <div class="player-points" id="playerRankPoints">0 نقطة</div>
                                        </div>
                                        <div class="rank-change" id="playerRankChange">
                                            <span class="change-icon">➡️</span>
                                            <span class="change-value">0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modals.set('leaderboard', document.getElementById('leaderboardModal'));
    }
    
    switchLBCategory(category) {
        this.currentLBCategory = category;
        this.currentPage = 1;
        
        // تحديث التبويبات النشطة
        document.querySelectorAll('.lb-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        
        // تحميل بيانات الفئة الجديدة
        this.loadLeaderboardData(category);
    }
    
    loadLeaderboardData(category) {
        if (this.game.socket) {
            this.game.socket.emit('getLeaderboard', category);
        }
        
        const tableBody = document.getElementById('leaderboardTable');
        tableBody.innerHTML = `
            <div class="loading-leaderboard">
                <div class="spinner"></div>
                <p>جاري تحميل البيانات...</p>
            </div>
        `;
        
        // عرض بيانات تجريبية مؤقتة
        setTimeout(() => this.displaySampleLeaderboard(), 1000);
    }
    
    displaySampleLeaderboard() {
        const tableBody = document.getElementById('leaderboardTable');
        let html = '';
        
        // بيانات تجريبية
        const sampleData = [
            { rank: 1, name: 'الصاعد_الأعظم', points: 5340, level: 50, clan: 'تنانين الأثير' },
            { rank: 2, name: 'بطل_الأثير', points: 5210, level: 48, clan: 'طيور الفينيق' },
            { rank: 3, name: 'ناظم_الذاكرة', points: 5120, level: 47, clan: 'حراس الشظايا' },
            { rank: 4, name: 'حارس_الليل', points: 4980, level: 46, clan: 'تنانين الأثير' },
            { rank: 5, name: 'صائد_الشظايا', points: 4870, level: 45, clan: null },
            { rank: 6, name: 'ساحر_الأثير', points: 4760, level: 44, clan: 'طيور الفينيق' },
            { rank: 7, name: 'المحارب_الأسطوري', points: 4650, level: 43, clan: 'حراس الشظايا' },
            { rank: 8, name: 'الفارس_المقدس', points: 4540, level: 42, clan: null },
            { rank: 9, name: 'الرامي_الدقيق', points: 4430, level: 41, clan: 'تنانين الأثير' },
            { rank: 10, name: 'المنجد_العظيم', points: 4320, level: 40, clan: 'طيور الفينيق' }
        ];
        
        sampleData.forEach(player => {
            const isCurrentPlayer = this.game.player && player.name === this.game.player.name;
            
            html += `
                <div class="table-row ${isCurrentPlayer ? 'current-player' : ''}">
                    <div class="cell rank">${player.rank}</div>
                    <div class="cell name">
                        <span class="player-name">${player.name}</span>
                        ${player.rank <= 3 ? this.getRankIcon(player.rank) : ''}
                    </div>
                    <div class="cell points">${player.points.toLocaleString()}</div>
                    <div class="cell level">${player.level}</div>
                    <div class="cell clan">${player.clan || '--'}</div>
                </div>
            `;
        });
        
        tableBody.innerHTML = html;
        
        // تحديث الثلاثة الأوائل
        this.updateTopThree(sampleData.slice(0, 3));
        
        // تحديث رتبة اللاعب الحالي
        this.updatePlayerRank();
    }
    
    getRankIcon(rank) {
        const icons = {
            1: '👑',
            2: '🥈', 
            3: '🥉'
        };
        return `<span class="rank-icon">${icons[rank] || ''}</span>`;
    }
    
    updateTopThree(topPlayers) {
        const positions = ['second', 'first', 'third'];
        
        positions.forEach((pos, index) => {
            const player = topPlayers[index];
            const element = document.querySelector(`.top-player.${pos}`);
            
            if (element && player) {
                element.querySelector('.player-name').textContent = player.name;
                element.querySelector('.player-points').textContent = 
                    `${player.points.toLocaleString()} نقطة`;
            }
        });
    }
    
    updatePlayerRank() {
        const playerRankCard = document.getElementById('playerRankCard');
        const player = this.game.player;
        
        if (!player) {
            playerRankCard.style.display = 'none';
            return;
        }
        
        playerRankCard.style.display = 'block';
        
        // تحديث البيانات (بيانات تجريبية)
        document.getElementById('playerRankPosition').textContent = '#42';
        document.getElementById('playerRankName').textContent = player.name;
        document.getElementById('playerRankPoints').textContent = 
            `${player.ascensionPoints || 0} نقطة`;
        
        // تأثير التغير في الرتبة (بيانات تجريبية)
        const rankChange = document.getElementById('playerRankChange');
        const change = Math.floor(Math.random() * 10) - 5; // -5 إلى +5
        
        if (change > 0) {
            rankChange.innerHTML = `<span class="change-icon">⬆️</span>
                                   <span class="change-value positive">+${change}</span>`;
        } else if (change < 0) {
            rankChange.innerHTML = `<span class="change-icon">⬇️</span>
                                   <span class="change-value negative">${change}</span>`;
        } else {
            rankChange.innerHTML = `<span class="change-icon">➡️</span>
                                   <span class="change-value">0</span>`;
        }
    }
    
    searchLeaderboard(query) {
        // بحث في لوحة المتصدرين
        console.log('البحث عن:', query);
    }
    
    refreshLeaderboard() {
        this.loadLeaderboardData(this.currentLBCategory);
    }
    
    jumpToMyRank() {
        // الانتقال إلى رتبة اللاعب الحالي
        this.showNotification('جاري الانتقال إلى رتبتك...', 'info');
    }
    
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePageInfo();
        }
    }
    
    nextPage() {
        this.currentPage++;
        this.updatePageInfo();
    }
    
    updatePageInfo() {
        document.getElementById('pageInfo').textContent = 
            `الصفحة ${this.currentPage} من 10`;
    }
    
    // ==================== الأنظمة الأخرى ====================
    createArenaModal() {
        // (نفس الكود السابق)
    }
    
    createInventoryModal() {
        // نظام الجرد (للتطوير المستقبلي)
    }
    
    createSkillsModal() {
        // نظام المهارات (للتطوير المستقبلي)
    }
    
    createSettingsModal() {
        // نظام الإعدادات (للتطوير المستقبلي)
    }
    
    setupEventListeners() {
        // إغلاق النوافذ
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.closeAllModals());
        });
        
        // النقر خارج النافذة يغلقها
        window.addEventListener('click', (e) => {
            this.modals.forEach(modal => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
        
        // أزرار القائمة الرئيسية
        const menuButtons = {
            'arenaButton': 'arena',
            'questsButton': 'quests', 
            'clansButton': 'clans',
            'dungeonsButton': 'dungeons',
            'leaderboardButton': 'leaderboard',
            'inventoryButton': 'inventory',
            'skillsButton': 'skills',
            'settingsButton': 'settings'
        };
        
        Object.entries(menuButtons).forEach(([buttonId, modalName]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    this.showModal(modalName);
                    this.onModalOpen(modalName);
                });
            }
        });
    }
    
    setupSocketListeners() {
        if (!this.game || !this.game.socket) return;
        
        const socket = this.game.socket;
        
        // تحديث المهام
        socket.on('availableQuests', (quests) => {
            this.updateQuestsList(quests);
        });
        
        socket.on('questStarted', (data) => {
            this.showNotification(`بدأت مهمة: ${data.quest.title}`, 'success');
        });
        
        // تحديث العشائر
        socket.on('clanInfo', (info) => {
            this.updateClanInfo(info);
        });
        
        // تحديث المتاهات
        socket.on('activeDungeons', (dungeons) => {
            this.updateDungeonsList(dungeons);
        });
        
        // تحديث لوحة المتصدرين
        socket.on('leaderboardData', (data) => {
            this.displayLeaderboardData(data);
        });
    }
    
    showModal(modalName) {
        this.closeAllModals();
        
        const modal = this.modals.get(modalName);
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    onModalOpen(modalName) {
        switch(modalName) {
            case 'quests':
                this.loadQuestsForTab(this.currentTab);
                break;
            case 'clans':
                this.loadClansList();
                break;
            case 'dungeons':
                this.loadDungeons();
                break;
            case 'leaderboard':
                this.loadLeaderboardData(this.currentLBCategory);
                break;
        }
    }
    
    closeAllModals() {
        this.modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
    
    showNotification(message, type = 'info') {
        // استخدام دالة الإشعارات من game.js
        if (this.game && this.game.showNotification) {
            this.game.showNotification(message, type);
        } else {
            // بديل مؤقت
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }
}

// جعل الكلاس متاحاً عالمياً
window.AetheriaUI = AetheriaUI;