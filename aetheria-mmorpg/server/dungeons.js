const db = require('./database');

class DungeonSystem {
    constructor(io) {
        this.io = io;
        this.activeDungeons = new Map();
        this.dungeonSessions = new Map();
        this.shardEchoSchedule = new Map();
        
        this.initializeSchedule();
        setInterval(() => this.checkShardEchoes(), 60000); // كل دقيقة
    }
    
    // تهيئة جدول الصيحات
    initializeSchedule() {
        const now = Date.now();
        
        // صيحة شظية الماء - كل يوم في 20:00
        this.shardEchoSchedule.set('water', {
            lastActivation: now - 24 * 60 * 60 * 1000,
            interval: 24 * 60 * 60 * 1000, // 24 ساعة
            duration: 2 * 60 * 60 * 1000, // ساعتان
            active: false
        });
        
        // صيحة شظية النار - كل يومين في 18:00
        this.shardEchoSchedule.set('fire', {
            lastActivation: now - 48 * 60 * 60 * 1000,
            interval: 48 * 60 * 60 * 1000, // 48 ساعة
            duration: 3 * 60 * 60 * 1000, // ثلاث ساعات
            active: false
        });
        
        // صيحة شظية الأرض - كل 3 أيام في 14:00
        this.shardEchoSchedule.set('earth', {
            lastActivation: now - 72 * 60 * 60 * 1000,
            interval: 72 * 60 * 60 * 1000, // 72 ساعة
            duration: 4 * 60 * 60 * 1000, // أربع ساعات
            active: false
        });
    }
    
    // التحقق من وقت الصيحات
    checkShardEchoes() {
        const now = Date.now();
        
        this.shardEchoSchedule.forEach((schedule, shardType) => {
            const timeSinceLastActivation = now - schedule.lastActivation;
            
            if (!schedule.active && timeSinceLastActivation >= schedule.interval) {
                this.activateShardEcho(shardType);
                schedule.lastActivation = now;
                schedule.active = true;
                
                // إشعار عالمي
                this.io.emit('shardEchoActivated', {
                    shardType: shardType,
                    dungeonId: `shard_echo_${shardType}`,
                    duration: schedule.duration,
                    endsAt: now + schedule.duration
                });
                
                console.log(`📢 صيحة شظية ${shardType} نشطة الآن!`);
                
                // إعداد الإيقاف التلقائي
                setTimeout(() => {
                    this.deactivateShardEcho(shardType);
                    schedule.active = false;
                }, schedule.duration);
            }
        });
    }
    
    // تفعيل صيحة شظية
    activateShardEcho(shardType) {
        const dungeonId = `shard_echo_${shardType}`;
        const dungeonTemplate = db.dungeons.get(dungeonId);
        
        if (!dungeonTemplate) {
            // إنشاء متاهة ديناميكية إذا لم تكن موجودة
            this.createDynamicDungeon(shardType);
            return;
        }
        
        // تفعيل المتاهة
        dungeonTemplate.schedule.active = true;
        dungeonTemplate.schedule.nextActivation = Date.now() + dungeonTemplate.schedule.duration;
        
        // إنشاء نسخة نشطة
        const activeDungeon = {
            ...dungeonTemplate,
            instanceId: `instance_${Date.now()}_${shardType}`,
            createdAt: new Date(),
            players: [],
            enemies: [],
            loot: [],
            status: 'open'
        };
        
        this.activeDungeons.set(activeDungeon.instanceId, activeDungeon);
    }
    
    // إنشاء متاهة ديناميكية
    createDynamicDungeon(shardType) {
        const dungeonData = {
            id: `shard_echo_${shardType}`,
            name: `صيحة شظية ${this.getShardName(shardType)}`,
            shardType: shardType,
            description: `متاهة مليئة بطاقة ${this.getShardName(shardType)} الأثيرية`,
            level: 10 + Math.floor(Math.random() * 10),
            maxPlayers: 5,
            duration: 1800,
            difficulty: ['normal', 'hard', 'elite'][Math.floor(Math.random() * 3)],
            stages: 3 + Math.floor(Math.random() * 2),
            enemies: this.generateEnemies(shardType),
            rewards: this.generateRewards(shardType),
            schedule: {
                active: true,
                nextActivation: Date.now() + 2 * 60 * 60 * 1000,
                duration: 2 * 60 * 60 * 1000
            }
        };
        
        db.dungeons.set(dungeonData.id, dungeonData);
        this.activateShardEcho(shardType);
    }
    
    // توليد أعداء حسب نوع الشظية
    generateEnemies(shardType) {
        const enemyTemplates = {
            water: ['water_elemental', 'corrupted_naiad', 'tidal_guardian'],
            fire: ['fire_elemental', 'lava_behemoth', 'inferno_dragon'],
            earth: ['stone_golem', 'crystal_beast', 'mountain_titan']
        };
        
        const enemies = enemyTemplates[shardType] || enemyTemplates.water;
        return enemies.map(enemy => ({
            type: enemy,
            count: 10 + Math.floor(Math.random() * 10),
            level: 10 + Math.floor(Math.random() * 10)
        }));
    }
    
    // توليد مكافآت حسب نوع الشظية
    generateRewards(shardType) {
        const baseRewards = {
            water: ['water_shard_fragment', 'tidal_trident', 'aetherial_pearl'],
            fire: ['fire_shard_fragment', 'inferno_blade', 'molten_core'],
            earth: ['earth_shard_fragment', 'stone_hammer', 'crystal_shard']
        };
        
        return {
            base: {
                experience: 5000 + Math.floor(Math.random() * 5000),
                gold: 2000 + Math.floor(Math.random() * 2000),
                ascensionPoints: 100 + Math.floor(Math.random() * 100)
            },
            items: baseRewards[shardType] || baseRewards.water,
            chance: {
                epic: 0.1 + Math.random() * 0.1,
                legendary: 0.01 + Math.random() * 0.01
            }
        };
    }
    
    // إلغاء تفعيل الصيحة
    deactivateShardEcho(shardType) {
        const dungeonId = `shard_echo_${shardType}`;
        const dungeon = db.dungeons.get(dungeonId);
        
        if (dungeon) {
            dungeon.schedule.active = false;
        }
        
        // إشعار عالمي
        this.io.emit('shardEchoDeactivated', {
            shardType: shardType,
            dungeonId: dungeonId,
            nextActivation: dungeon?.schedule.nextActivation
        });
        
        console.log(`📢 صيحة شظية ${shardType} توقفت!`);
    }
    
    // دخول متاهة
    enterDungeon(playerId, dungeonInstanceId) {
        const player = db.getPlayer(playerId);
        const dungeon = this.activeDungeons.get(dungeonInstanceId);
        
        if (!player || !dungeon || dungeon.status !== 'open') {
            return { success: false, message: 'المتاهة غير متاحة' };
        }
        
        if (dungeon.players.length >= dungeon.maxPlayers) {
            return { success: false, message: 'المتاهة ممتلئة' };
        }
        
        if (player.level < dungeon.level) {
            return { success: false, message: `تحتاج مستوى ${dungeon.level} على الأقل` };
        }
        
        // الانضمام للمتاهة
        dungeon.players.push({
            id: playerId,
            name: player.name,
            class: player.class,
            health: player.health,
            maxHealth: player.maxHealth,
            joinedAt: new Date()
        });
        
        // إنشاء جلسة لاعب
        const sessionId = `${dungeonInstanceId}_${playerId}`;
        this.dungeonSessions.set(sessionId, {
            playerId: playerId,
            dungeonId: dungeonInstanceId,
            startTime: new Date(),
            kills: 0,
            damageDealt: 0,
            damageTaken: 0,
            lootCollected: [],
            status: 'active'
        });
        
        // إعلام اللاعبين الآخرين في المتاهة
        this.broadcastToDungeon(dungeonInstanceId, 'playerEnteredDungeon', {
            player: {
                id: playerId,
                name: player.name,
                class: player.class,
                level: player.level
            },
            currentPlayers: dungeon.players.length,
            maxPlayers: dungeon.maxPlayers
        });
        
        // إرسال بيانات المتاهة للاعب الجديد
        const playerSocket = this.getPlayerSocket(playerId);
        if (playerSocket) {
            playerSocket.emit('dungeonEntered', {
                dungeon: dungeon,
                players: dungeon.players,
                enemies: dungeon.enemies,
                sessionId: sessionId
            });
        }
        
        return {
            success: true,
            dungeon: dungeon,
            sessionId: sessionId
        };
    }
    
    // بدء المتاهة (عندما يكتمل عدد اللاعبين)
    startDungeon(dungeonInstanceId) {
        const dungeon = this.activeDungeons.get(dungeonInstanceId);
        if (!dungeon || dungeon.status !== 'open') return;
        
        dungeon.status = 'in_progress';
        dungeon.startedAt = new Date();
        
        // توليد الأعداء
        this.spawnDungeonEnemies(dungeonInstanceId);
        
        // إعلام جميع اللاعبين
        this.broadcastToDungeon(dungeonInstanceId, 'dungeonStarted', {
            startTime: dungeon.startedAt,
            duration: dungeon.duration,
            stages: dungeon.stages,
            enemies: dungeon.enemies
        });
        
        // بدء المؤقت
        setTimeout(() => {
            this.endDungeon(dungeonInstanceId, 'timeout');
        }, dungeon.duration * 1000);
    }
    
    // توليد أعداء المتاهة
    spawnDungeonEnemies(dungeonInstanceId) {
        const dungeon = this.activeDungeons.get(dungeonInstanceId);
        if (!dungeon) return;
        
        // إنشاء أعداء حقيقيين
        dungeon.enemies = dungeon.enemies.flatMap(enemyTemplate => {
            const enemies = [];
            for (let i = 0; i < enemyTemplate.count; i++) {
                enemies.push({
                    id: `enemy_${Date.now()}_${i}`,
                    type: enemyTemplate.type,
                    level: enemyTemplate.level,
                    health: 100 * enemyTemplate.level,
                    maxHealth: 100 * enemyTemplate.level,
                    damage: 10 * enemyTemplate.level,
                    position: this.getRandomPosition(),
                    stage: Math.floor(i / (enemyTemplate.count / dungeon.stages)) + 1
                });
            }
            return enemies;
        });
    }
    
    // إنهاء المتاهة
    endDungeon(dungeonInstanceId, reason) {
        const dungeon = this.activeDungeons.get(dungeonInstanceId);
        if (!dungeon || dungeon.status === 'completed') return;
        
        dungeon.status = 'completed';
        dungeon.endedAt = new Date();
        dungeon.completionReason = reason;
        
        // حساب المكافآت
        const rewards = this.calculateDungeonRewards(dungeonInstanceId);
        
        // توزيع المكافآت
        dungeon.players.forEach(player => {
            const playerRewards = rewards[player.id] || {};
            this.giveDungeonRewards(player.id, playerRewards);
        });
        
        // إعلام اللاعبين
        this.broadcastToDungeon(dungeonInstanceId, 'dungeonCompleted', {
            reason: reason,
            rewards: rewards,
            completionTime: dungeon.endedAt - dungeon.startedAt,
            kills: this.calculateTotalKills(dungeonInstanceId)
        });
        
        // تنظيف الجلسات
        this.cleanupDungeonSessions(dungeonInstanceId);
        
        // إزالة المتاهة بعد 5 دقائق
        setTimeout(() => {
            this.activeDungeons.delete(dungeonInstanceId);
        }, 5 * 60 * 1000);
    }
    
    // حساب مكافآت المتاهة
    calculateDungeonRewards(dungeonInstanceId) {
        const dungeon = this.activeDungeons.get(dungeonInstanceId);
        const rewards = {};
        
        dungeon.players.forEach(player => {
            const sessionId = `${dungeonInstanceId}_${player.id}`;
            const session = this.dungeonSessions.get(sessionId);
            
            if (session) {
                const baseReward = dungeon.rewards.base;
                const performanceMultiplier = this.calculatePerformanceMultiplier(session);
                
                rewards[player.id] = {
                    experience: Math.floor(baseReward.experience * performanceMultiplier),
                    gold: Math.floor(baseReward.gold * performanceMultiplier),
                    ascensionPoints: Math.floor(baseReward.ascensionPoints * performanceMultiplier),
                    items: this.generateLoot(dungeon, performanceMultiplier),
                    sessionStats: {
                        kills: session.kills,
                        damageDealt: session.damageDealt,
                        damageTaken: session.damageTaken
                    }
                };
            }
        });
        
        return rewards;
    }
    
    // حساب مضاعف الأداء
    calculatePerformanceMultiplier(session) {
        let multiplier = 1.0;
        
        // مكافأة القتل
        multiplier += session.kills * 0.05;
        
        // مكافأة الضرر
        multiplier += Math.min(session.damageDealt / 10000, 1.0);
        
        // عقوبة الضرر المتلقي
        if (session.damageTaken > 5000) {
            multiplier -= 0.2;
        }
        
        return Math.max(0.5, Math.min(2.0, multiplier));
    }
    
    // توليد الغنائم
    generateLoot(dungeon, multiplier) {
        const loot = [];
        const itemPool = dungeon.rewards.items;
        
        // عنصر مضمون
        loot.push(itemPool[Math.floor(Math.random() * itemPool.length)]);
        
        // فرصة الحصول على عنصر إضافي
        const chance = dungeon.rewards.chance.epic * multiplier;
        if (Math.random() < chance) {
            loot.push(itemPool[Math.floor(Math.random() * itemPool.length)]);
        }
        
        // فرصة نادرة للحصول على عنصر أسطوري
        const legendaryChance = dungeon.rewards.chance.legendary * multiplier;
        if (Math.random() < legendaryChance) {
            loot.push(`${dungeon.shardType}_shard_legendary`);
        }
        
        return loot;
    }
    
    // بث رسالة للاعبين في المتاهة
    broadcastToDungeon(dungeonInstanceId, event, data) {
        const dungeon = this.activeDungeons.get(dungeonInstanceId);
        if (!dungeon) return;
        
        dungeon.players.forEach(player => {
            const socket = this.getPlayerSocket(player.id);
            if (socket) {
                socket.emit(event, data);
            }
        });
    }
    
    // الحصول على سوكت اللاعب
    getPlayerSocket(playerId) {
        const sockets = this.io.sockets.sockets;
        return sockets.get(playerId);
    }
    
    // وظائف مساعدة
    getShardName(shardType) {
        const names = {
            water: 'الماء',
            fire: 'النار',
            earth: 'الأرض'
        };
        return names[shardType] || 'المجهولة';
    }
    
    getRandomPosition() {
        return {
            x: 100 + Math.random() * 600,
            y: 100 + Math.random() * 400
        };
    }
    
    calculateTotalKills(dungeonInstanceId) {
        let totalKills = 0;
        
        this.dungeonSessions.forEach(session => {
            if (session.dungeonId === dungeonInstanceId) {
                totalKills += session.kills;
            }
        });
        
        return totalKills;
    }
    
    cleanupDungeonSessions(dungeonInstanceId) {
        const sessionsToDelete = [];
        
        this.dungeonSessions.forEach((session, sessionId) => {
            if (session.dungeonId === dungeonInstanceId) {
                sessionsToDelete.push(sessionId);
            }
        });
        
        sessionsToDelete.forEach(sessionId => {
            this.dungeonSessions.delete(sessionId);
        });
    }
}

module.exports = DungeonSystem;