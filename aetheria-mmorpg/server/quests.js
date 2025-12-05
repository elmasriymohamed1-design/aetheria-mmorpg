const db = require('./database');

class QuestSystem {
    constructor(io) {
        this.io = io;
        this.activeQuests = new Map();
        this.questProgress = new Map();
    }
    
    // بدء مهمة جديدة
    startQuest(playerId, questId) {
        const player = db.getPlayer(playerId);
        const quest = db.quests.get(questId);
        
        if (!player || !quest) {
            return { success: false, message: 'المهمة غير متاحة' };
        }
        
        // التحقق من المتطلبات
        if (!this.checkRequirements(player, quest)) {
            return { success: false, message: 'لا تستوفي متطلبات المهمة' };
        }
        
        // التحقق من عدم وجود المهمة نشطة بالفعل
        if (player.activeQuests?.some(q => q.id === questId)) {
            return { success: false, message: 'المهمة نشطة بالفعل' };
        }
        
        // تهيئة تقدم المهمة
        const questProgress = {
            id: questId,
            startedAt: new Date(),
            objectives: quest.objectives.map(obj => ({
                ...obj,
                current: 0,
                completed: false
            })),
            completed: false,
            claimed: false
        };
        
        // حفظ التقدم
        player.activeQuests = player.activeQuests || [];
        player.activeQuests.push(questProgress);
        
        // حفظ في الذاكرة للتتبع
        this.questProgress.set(`${playerId}_${questId}`, questProgress);
        
        // إرسال للمستخدم
        const playerSocket = this.getPlayerSocket(playerId);
        if (playerSocket) {
            playerSocket.emit('questStarted', {
                quest: quest,
                progress: questProgress
            });
        }
        
        // سجل المهام
        player.questLog = player.questLog || [];
        player.questLog.push({
            questId: questId,
            startedAt: new Date(),
            status: 'active'
        });
        
        return {
            success: true,
            quest: quest,
            progress: questProgress
        };
    }
    
    // تحديث تقدم المهمة
    updateQuestProgress(playerId, questId, objectiveType, target, amount = 1) {
        const player = db.getPlayer(playerId);
        const questProgress = player.activeQuests?.find(q => q.id === questId);
        
        if (!questProgress || questProgress.completed) {
            return false;
        }
        
        // البحث عن الهدف المناسب
        const objective = questProgress.objectives.find(obj => 
            obj.type === objectiveType && 
            obj.target === target &&
            !obj.completed
        );
        
        if (!objective) return false;
        
        // تحديث التقدم
        objective.current += amount;
        if (objective.current >= objective.count) {
            objective.completed = true;
            objective.current = objective.count;
        }
        
        // التحقق من اكتمال جميع الأهداف
        const allCompleted = questProgress.objectives.every(obj => obj.completed);
        if (allCompleted && !questProgress.completed) {
            questProgress.completed = true;
            questProgress.completedAt = new Date();
            
            // إعلام اللاعب
            this.completeQuest(playerId, questId);
        }
        
        // إرسال تحديث التقدم
        const playerSocket = this.getPlayerSocket(playerId);
        if (playerSocket) {
            playerSocket.emit('questProgressUpdated', {
                questId: questId,
                progress: questProgress
            });
        }
        
        return true;
    }
    
    // إكمال المهمة
    completeQuest(playerId, questId) {
        const player = db.getPlayer(playerId);
        const quest = db.quests.get(questId);
        const questProgress = player.activeQuests?.find(q => q.id === questId);
        
        if (!quest || !questProgress || !questProgress.completed) {
            return false;
        }
        
        questProgress.completedAt = new Date();
        
        // تحديث سجل المهام
        const logEntry = player.questLog?.find(log => log.questId === questId);
        if (logEntry) {
            logEntry.completedAt = new Date();
            logEntry.status = 'completed';
        }
        
        // إرسال إشعار الإكمال
        const playerSocket = this.getPlayerSocket(playerId);
        if (playerSocket) {
            playerSocket.emit('questCompleted', {
                questId: questId,
                quest: quest,
                progress: questProgress
            });
        }
        
        return true;
    }
    
    // تسليم المهمة والحصول على المكافآت
    claimQuestRewards(playerId, questId) {
        const player = db.getPlayer(playerId);
        const quest = db.quests.get(questId);
        const questProgress = player.activeQuests?.find(q => q.id === questId);
        
        if (!quest || !questProgress || !questProgress.completed || questProgress.claimed) {
            return { success: false, message: 'لا يمكن تسليم المهمة' };
        }
        
        questProgress.claimed = true;
        questProgress.claimedAt = new Date();
        
        // تطبيق المكافآت
        this.applyRewards(player, quest.rewards);
        
        // إزالة المهمة من النشطة
        player.activeQuests = player.activeQuests.filter(q => q.id !== questId);
        
        // فتح المهام الجديدة
        if (quest.rewards.unlock) {
            quest.rewards.unlock.forEach(unlockedQuestId => {
                if (db.quests.has(unlockedQuestId)) {
                    // إعلام اللاعب بالمهام الجديدة
                    const playerSocket = this.getPlayerSocket(playerId);
                    if (playerSocket) {
                        playerSocket.emit('questUnlocked', {
                            questId: unlockedQuestId,
                            quest: db.quests.get(unlockedQuestId)
                        });
                    }
                }
            });
        }
        
        // تحديث تقدم القصة
        player.storyProgress = player.storyProgress || {};
        player.storyProgress[quest.chapter] = player.storyProgress[quest.chapter] || {};
        player.storyProgress[quest.chapter][questId] = {
            completedAt: new Date(),
            claimed: true
        };
        
        // إرسال المكافآت
        const playerSocket = this.getPlayerSocket(playerId);
        if (playerSocket) {
            playerSocket.emit('questRewardsClaimed', {
                questId: questId,
                rewards: quest.rewards,
                newQuests: quest.rewards.unlock?.map(id => db.quests.get(id)) || []
            });
        }
        
        return {
            success: true,
            rewards: quest.rewards,
            message: 'تم استلام مكافآت المهمة بنجاح'
        };
    }
    
    // تطبيق المكافآت
    applyRewards(player, rewards) {
        if (rewards.experience) {
            player.experience = (player.experience || 0) + rewards.experience;
            this.checkLevelUp(player);
        }
        
        if (rewards.gold) {
            player.gold = (player.gold || 0) + rewards.gold;
        }
        
        if (rewards.ascensionPoints) {
            player.ascensionPoints = (player.ascensionPoints || 0) + rewards.ascensionPoints;
        }
        
        if (rewards.items) {
            player.inventory = player.inventory || [];
            rewards.items.forEach(item => {
                player.inventory.push({
                    id: item,
                    obtainedAt: new Date(),
                    fromQuest: true
                });
            });
        }
        
        if (rewards.skill) {
            player.skills = player.skills || [];
            if (!player.skills.includes(rewards.skill)) {
                player.skills.push(rewards.skill);
            }
        }
        
        // تحديث لوحة المتصدرين
        db.updateLeaderboard(player);
    }
    
    // التحقق من متطلبات المهمة
    checkRequirements(player, quest) {
        if (quest.requirements.level && player.level < quest.requirements.level) {
            return false;
        }
        
        if (quest.requirements.completed) {
            const completedQuests = player.questLog?.filter(q => 
                q.status === 'completed'
            ).map(q => q.questId) || [];
            
            const allRequiredCompleted = quest.requirements.completed.every(reqId => 
                completedQuests.includes(reqId)
            );
            
            if (!allRequiredCompleted) return false;
        }
        
        if (quest.requirements.clanMember && !player.clan) {
            return false;
        }
        
        return true;
    }
    
    // التحقق من ترقية المستوى
    checkLevelUp(player) {
        const requiredExp = this.calculateRequiredExp(player.level || 1);
        
        if (player.experience >= requiredExp) {
            player.level = (player.level || 1) + 1;
            player.experience -= requiredExp;
            
            const playerSocket = this.getPlayerSocket(player.id);
            if (playerSocket) {
                playerSocket.emit('levelUp', {
                    newLevel: player.level,
                    remainingExp: player.experience,
                    nextLevelExp: this.calculateRequiredExp(player.level)
                });
            }
            
            return true;
        }
        return false;
    }
    
    // حساب الخبرة المطلوبة للترقية
    calculateRequiredExp(level) {
        return Math.floor(1000 * Math.pow(1.5, level - 1));
    }
    
    // الحصول على المهام المتاحة للاعب
    getAvailableQuests(playerId) {
        const player = db.getPlayer(playerId);
        const available = [];
        
        db.quests.forEach(quest => {
            if (this.checkRequirements(player, quest)) {
                // التحقق من عدم إكمالها سابقاً
                const completed = player.questLog?.some(q => 
                    q.questId === quest.id && q.status === 'completed'
                );
                
                // التحقق من عدم كونها نشطة حالياً
                const active = player.activeQuests?.some(q => q.id === quest.id);
                
                if (!completed && !active) {
                    available.push(quest);
                }
            }
        });
        
        return available;
    }
    
    // تحديث المهام اليومية
    resetDailyQuests() {
        const now = new Date();
        
        db.players.forEach(player => {
            if (player.activeQuests) {
                player.activeQuests = player.activeQuests.filter(quest => {
                    const questData = db.quests.get(quest.id);
                    return questData?.type !== 'daily';
                });
            }
        });
        
        console.log('تم إعادة تعيين المهام اليومية');
    }
    
    // الحصول على سوكت اللاعب
    getPlayerSocket(playerId) {
        const sockets = this.io.sockets.sockets;
        return sockets.get(playerId);
    }
}

module.exports = QuestSystem;