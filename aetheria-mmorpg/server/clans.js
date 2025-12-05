const db = require('./database');

class ClanSystem {
    constructor(io) {
        this.io = io;
        this.clanChats = new Map();
        this.clanActions = new Map();
    }
    
    // إنشاء عشيرة جديدة
    createClan(creatorId, clanData) {
        const creator = db.getPlayer(creatorId);
        if (!creator || creator.level < 10) {
            return { success: false, message: 'يجب أن تكون مستوى 10 على الأقل' };
        }
        
        if (creator.gold < 50000) {
            return { success: false, message: 'تحتاج 50,000 ذهب لإنشاء عشيرة' };
        }
        
        const clanId = clanData.tag.toLowerCase();
        if (db.getClan(clanId)) {
            return { success: false, message: 'هذه العشيرة موجودة بالفعل' };
        }
        
        const newClan = {
            id: clanId,
            name: clanData.name,
            tag: clanData.tag.toUpperCase(),
            description: clanData.description,
            level: 1,
            members: [{
                id: creatorId,
                name: creator.name,
                rank: 'leader',
                contribution: 1000,
                joinedAt: new Date()
            }],
            maxMembers: 30,
            resources: {
                aetherium: 0,
                gold: 0,
                memoryCrystals: 0
            },
            perks: {
                experienceBoost: 0,
                craftingDiscount: 0,
                researchSpeed: 0
            },
            upgrades: [],
            vault: [],
            announcements: [],
            createdAt: new Date(),
            leader: creatorId
        };
        
        db.clans.set(clanId, newClan);
        creator.clan = clanId;
        creator.clanRank = 'leader';
        creator.gold -= 50000;
        
        // إنشاء غرفة دردشة للعشيرة
        this.clanChats.set(clanId, []);
        
        return {
            success: true,
            clan: newClan,
            message: `تم إنشاء عشيرة ${clanData.name} بنجاح!`
        };
    }
    
    // انضمام لاعب لعشيرة
    joinClan(playerId, clanId) {
        const result = db.joinClan(playerId, clanId);
        
        if (result) {
            const clan = db.getClan(clanId);
            const player = db.getPlayer(playerId);
            
            // إشعار أعضاء العشيرة
            this.broadcastToClan(clanId, 'clanMemberJoined', {
                player: {
                    id: playerId,
                    name: player.name,
                    level: player.level
                },
                timestamp: new Date()
            });
            
            return {
                success: true,
                clan: clan,
                message: `انضممت إلى عشيرة ${clan.name}`
            };
        }
        
        return { success: false, message: 'فشل الانضمام للعشيرة' };
    }
    
    // ترقية العشيرة
    upgradeClan(clanId, upgradeType) {
        const clan = db.getClan(clanId);
        if (!clan) return { success: false, message: 'العشيرة غير موجودة' };
        
        const upgrades = {
            memberCapacity: { cost: 10000, requirement: { level: 2 } },
            experienceBoost: { cost: 15000, requirement: { level: 3 } },
            craftingStation: { cost: 25000, requirement: { level: 4 } },
            researchLab: { cost: 50000, requirement: { level: 5 } }
        };
        
        const upgrade = upgrades[upgradeType];
        if (!upgrade) return { success: false, message: 'الترقية غير متاحة' };
        
        // التحقق من المتطلبات
        if (clan.level < upgrade.requirement.level) {
            return { success: false, message: `تحتاج عشيرة مستوى ${upgrade.requirement.level}` };
        }
        
        if (clan.resources.gold < upgrade.cost) {
            return { success: false, message: 'لا تملك العشيرة ذهباً كافياً' };
        }
        
        // تطبيق الترقية
        clan.resources.gold -= upgrade.cost;
        
        switch (upgradeType) {
            case 'memberCapacity':
                clan.maxMembers += 10;
                break;
            case 'experienceBoost':
                clan.perks.experienceBoost += 0.05;
                break;
            case 'craftingStation':
                clan.perks.craftingDiscount += 0.1;
                break;
            case 'researchLab':
                clan.perks.researchSpeed += 0.15;
                break;
        }
        
        clan.upgrades.push({
            type: upgradeType,
            completedAt: new Date(),
            cost: upgrade.cost
        });
        
        // إشعار الأعضاء
        this.broadcastToClan(clanId, 'clanUpgraded', {
            upgrade: upgradeType,
            newLevel: clan.level,
            perks: clan.perks
        });
        
        return {
            success: true,
            clan: clan,
            message: `تم ترقية ${upgradeType} بنجاح`
        };
    }
    
    // تبرع لاعب للعشيرة
    donateToClan(playerId, resourceType, amount) {
        const player = db.getPlayer(playerId);
        const clan = db.getClan(player.clan);
        
        if (!player || !clan) {
            return { success: false, message: 'لاعب أو عشيرة غير موجودة' };
        }
        
        // التحقق من أن اللاعب يملك المقدار
        if (player[resourceType] < amount) {
            return { success: false, message: 'لا تملك الموارد الكافية' };
        }
        
        // الخصم من اللاعب
        player[resourceType] -= amount;
        
        // الإضافة للعشيرة
        clan.resources[resourceType] += amount;
        
        // زيادة مساهمة اللاعب
        const member = clan.members.find(m => m.id === playerId);
        if (member) {
            member.contribution += amount;
            member.lastDonation = new Date();
        }
        
        // تحديث رتبة اللاعب إن لزم
        this.updateMemberRank(playerId, clan.id);
        
        // إشعار الأعضاء
        this.broadcastToClan(clan.id, 'clanDonation', {
            donor: player.name,
            resource: resourceType,
            amount: amount,
            totalResources: clan.resources
        });
        
        return {
            success: true,
            contribution: member.contribution,
            clanResources: clan.resources
        };
    }
    
    // تحديث رتبة العضو
    updateMemberRank(playerId, clanId) {
        const clan = db.getClan(clanId);
        const member = clan.members.find(m => m.id === playerId);
        
        if (!member) return;
        
        const oldRank = member.rank;
        let newRank = oldRank;
        
        // نظام الترقية حسب المساهمة
        if (member.contribution >= 50000) newRank = 'elder';
        else if (member.contribution >= 20000) newRank = 'veteran';
        else if (member.contribution >= 5000) newRank = 'officer';
        
        if (newRank !== oldRank) {
            member.rank = newRank;
            db.getPlayer(playerId).clanRank = newRank;
            
            // إشعار اللاعب
            const playerSocket = this.getPlayerSocket(playerId);
            if (playerSocket) {
                playerSocket.emit('clanRankUpdated', {
                    oldRank,
                    newRank,
                    contribution: member.contribution
                });
            }
        }
    }
    
    // مهمة عشائرية
    createClanQuest(clanId, questData) {
        const clan = db.getClan(clanId);
        if (!clan) return null;
        
        const questId = `clan_quest_${Date.now()}`;
        const quest = {
            id: questId,
            clanId: clanId,
            ...questData,
            createdBy: clan.leader,
            createdAt: new Date(),
            participants: [],
            progress: 0,
            completed: false
        };
        
        clan.activeQuests = clan.activeQuests || [];
        clan.activeQuests.push(quest);
        
        // إشعار الأعضاء
        this.broadcastToClan(clanId, 'newClanQuest', {
            quest: quest,
            expiresIn: quest.duration || 86400000 // 24 ساعة افتراضياً
        });
        
        return quest;
    }
    
    // بث رسالة للعشيرة
    broadcastToClan(clanId, event, data) {
        const clan = db.getClan(clanId);
        if (!clan) return;
        
        clan.members.forEach(member => {
            const socket = this.getPlayerSocket(member.id);
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
    
    // إرسال رسالة دردشة عشائرية
    sendClanChat(playerId, message) {
        const player = db.getPlayer(playerId);
        const clan = db.getClan(player.clan);
        
        if (!clan) return;
        
        const chatEntry = {
            player: player.name,
            playerId: playerId,
            rank: player.clanRank,
            message: message,
            timestamp: new Date()
        };
        
        // حفظ الرسالة (آخر 100 رسالة)
        let clanChat = this.clanChats.get(clan.id) || [];
        clanChat.push(chatEntry);
        if (clanChat.length > 100) clanChat = clanChat.slice(-100);
        this.clanChats.set(clan.id, clanChat);
        
        // بث للعشيرة
        this.broadcastToClan(clan.id, 'clanChatMessage', chatEntry);
    }
    
    // الحصول على معلومات العشيرة
    getClanInfo(clanId) {
        const clan = db.getClan(clanId);
        if (!clan) return null;
        
        const membersWithDetails = clan.members.map(member => {
            const player = db.getPlayer(member.id);
            return {
                ...member,
                level: player?.level || 1,
                lastOnline: player?.lastOnline,
                ascensionPoints: player?.ascensionPoints || 0
            };
        });
        
        // ترتيب الأعضاء حسب المساهمة
        membersWithDetails.sort((a, b) => b.contribution - a.contribution);
        
        return {
            ...clan,
            members: membersWithDetails,
            chat: this.clanChats.get(clanId) || [],
            onlineCount: membersWithDetails.filter(m => {
                const player = db.getPlayer(m.id);
                return player?.online;
            }).length
        };
    }
}

module.exports = ClanSystem;