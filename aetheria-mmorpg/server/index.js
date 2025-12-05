const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');

// استيراد الأنظمة
const db = require('./database');
const ArenaSystem = require('./arena');
const ClanSystem = require('./clans');
const QuestSystem = require('./quests');
const DungeonSystem = require('./dungeons');
const LeaderboardSystem = require('./leaderboard');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// تهيئة الأنظمة
const arenaSystem = new ArenaSystem(io);
const clanSystem = new ClanSystem(io);
const questSystem = new QuestSystem(io);
const dungeonSystem = new DungeonSystem(io);
const leaderboardSystem = new LeaderboardSystem(io);

// حالة العالم
const worldState = {
    playersOnline: 0,
    activeShardEchoes: [],
    memoryDecayLevel: 10,
    currentCycle: 'day',
    specialEvents: []
};

// تحديث حالة العالم بشكل دوري
setInterval(() => {
    worldState.playersOnline = io.engine.clientsCount;
    worldState.activeShardEchoes = dungeonSystem.activeDungeons.size;
    worldState.memoryDecayLevel = Math.min(100, worldState.memoryDecayLevel + 0.1);
    
    io.emit('worldStateUpdate', worldState);
}, 10000); // كل 10 ثواني

// إدارة الاتصالات
io.on('connection', (socket) => {
    console.log('لاعب جديد متصل:', socket.id);
    
    // إرسال حالة العالم الأولية
    socket.emit('worldState', worldState);
    socket.emit('leaderboards', leaderboardSystem.getLeaderboard('ascension'));
    
    // تسجيل دخول اللاعب
    socket.on('playerLogin', (playerData) => {
        const player = {
            id: socket.id,
            ...playerData,
            position: { x: 100, y: 100 },
            health: 100,
            maxHealth: 100,
            mana: 100,
            maxMana: 100,
            level: 1,
            experience: 0,
            gold: 1000,
            ascensionPoints: 0,
            dailyArenaMatches: 0,
            arenaStats: {
                wins: 0,
                losses: 0,
                rating: 1000,
                currentStreak: 0,
                bestStreak: 0
            },
            inventory: [],
            skills: [],
            online: true,
            lastOnline: new Date(),
            createdAt: new Date()
        };
        
        db.addPlayer(player);
        
        // إرسال بيانات اللاعب
        socket.emit('playerData', player);
        
        // إرسال المهام المتاحة
        const availableQuests = questSystem.getAvailableQuests(socket.id);
        socket.emit('availableQuests', availableQuests);
        
        // إرسال المتاهات النشطة
        const activeDungeons = dungeonSystem.activeDungeons;
        socket.emit('activeDungeons', Array.from(activeDungeons.values()));
        
        // إشعار الآخرين
        socket.broadcast.emit('playerJoined', {
            id: socket.id,
            name: playerData.name,
            level: 1
        });
    });
    
    // حركة اللاعب
    socket.on('playerMove', (position) => {
        const player = db.getPlayer(socket.id);
        if (player) {
            player.position = position;
            player.lastMove = new Date();
            
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                position: position,
                name: player.name
            });
        }
    });
    
    // الأرينا
    socket.on('startArenaMatch', () => {
        const player = db.getPlayer(socket.id);
        if (!player) return;
        
        // التحقق من الحد اليومي
        if (player.dailyArenaMatches >= 10) {
            socket.emit('arenaError', 'لقد وصلت للحد اليومي من المباريات');
            return;
        }
        
        arenaSystem.startMatch(socket, player);
    });
    
    // العشائر
    socket.on('createClan', (clanData) => {
        const result = clanSystem.createClan(socket.id, clanData);
        socket.emit('clanCreationResult', result);
    });
    
    socket.on('joinClan', (clanId) => {
        const result = clanSystem.joinClan(socket.id, clanId);
        socket.emit('clanJoinResult', result);
    });
    
    socket.on('clanChat', (message) => {
        clanSystem.sendClanChat(socket.id, message);
    });
    
    socket.on('getClanInfo', (clanId) => {
        const info = clanSystem.getClanInfo(clanId || db.getPlayer(socket.id)?.clan);
        socket.emit('clanInfo', info);
    });
    
    // المهام
    socket.on('startQuest', (questId) => {
        const result = questSystem.startQuest(socket.id, questId);
        socket.emit('questStartResult', result);
    });
    
    socket.on('claimQuestRewards', (questId) => {
        const result = questSystem.claimQuestRewards(socket.id, questId);
        socket.emit('questRewardsResult', result);
    });
    
    socket.on('getAvailableQuests', () => {
        const quests = questSystem.getAvailableQuests(socket.id);
        socket.emit('availableQuests', quests);
    });
    
    // المتاهات
    socket.on('enterDungeon', (dungeonInstanceId) => {
        const result = dungeonSystem.enterDungeon(socket.id, dungeonInstanceId);
        socket.emit('dungeonEnterResult', result);
    });
    
    socket.on('getActiveDungeons', () => {
        const dungeons = Array.from(dungeonSystem.activeDungeons.values());
        socket.emit('activeDungeons', dungeons);
    });
    
    // لوحة المتصدرين
    socket.on('getLeaderboard', (category) => {
        const leaderboard = leaderboardSystem.getLeaderboard(category);
        socket.emit('leaderboardData', leaderboard);
    });
    
    socket.on('searchPlayerRank', (playerId) => {
        const result = leaderboardSystem.searchPlayerInLeaderboards(playerId || socket.id);
        socket.emit('playerRankResult', result);
    });
    
    // الدردشة العامة
    socket.on('globalChat', (message) => {
        const player = db.getPlayer(socket.id);
        if (!player || !message.trim()) return;
        
        const chatMessage = {
            player: player.name,
            playerId: socket.id,
            message: message,
            timestamp: new Date(),
            type: 'global'
        };
        
        io.emit('globalChatMessage', chatMessage);
    });
    
    // تحديث حالة اللاعب
    socket.on('updateStats', (stats) => {
        const player = db.getPlayer(socket.id);
        if (player) {
            Object.assign(player, stats);
            player.lastUpdated = new Date();
            
            // تحديث لوحة المتصدرين
            db.updateLeaderboard(player);
        }
    });
    
    // انتهاء الاتصال
    socket.on('disconnect', () => {
        const player = db.getPlayer(socket.id);
        if (player) {
            player.online = false;
            player.lastOnline = new Date();
            
            // إشعار الآخرين
            socket.broadcast.emit('playerLeft', {
                id: socket.id,
                name: player.name
            });
            
            console.log('لاعب انقطع:', player.name);
        }
    });
});

// مسارات API
app.get('/api/world-state', (req, res) => {
    res.json(worldState);
});

app.get('/api/leaderboards/:category', (req, res) => {
    const category = req.params.category;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    
    const leaderboard = leaderboardSystem.getLeaderboard(category, limit, offset);
    res.json(leaderboard);
});

app.get('/api/active-dungeons', (req, res) => {
    const dungeons = Array.from(dungeonSystem.activeDungeons.values());
    res.json(dungeons);
});

app.get('/api/clans', (req, res) => {
    const clans = Array.from(db.clans.values()).map(clan => ({
        id: clan.id,
        name: clan.name,
        tag: clan.tag,
        level: clan.level,
        members: clan.members.length,
        description: clan.description
    }));
    
    res.json(clans);
});

// إعادة تعيين المهام اليومية كل يوم في منتصف الليل
const resetDailyQuests = () => {
    questSystem.resetDailyQuests();
    console.log('تم إعادة تعيين المهام اليومية');
};

// جدولة إعادة التعيين
setInterval(resetDailyQuests, 24 * 60 * 60 * 1000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
    console.log(`🌍 عالم أثيريا جاهز للاعبين!`);
    console.log(`🎮 الأنظمة المثبتة:`);
    console.log(`   - نظام الأرينا`);
    console.log(`   - نظام العشائر`);
    console.log(`   - نظام المهام القصصية`);
    console.log(`   - نظام متاهات الصيحات`);
    console.log(`   - نظام لوحة المتصدرين`);
});