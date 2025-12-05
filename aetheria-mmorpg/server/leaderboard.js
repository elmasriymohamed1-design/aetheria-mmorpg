const db = require('./database');

class LeaderboardSystem {
    constructor(io) {
        this.io = io;
        this.seasonalData = new Map();
        this.historicalData = new Map();
        this.categories = [
            'ascension',
            'arena',
            'clans',
            'dungeons',
            'quests'
        ];
        
        this.initializeSeason();
        setInterval(() => this.updateAllLeaderboards(), 30000); // كل 30 ثانية
    }
    
    // تهيئة الموسم الجديد
    initializeSeason() {
        const seasonNumber = 1;
        const seasonStart = new Date();
        const seasonEnd = new Date(seasonStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 يوم
        
        this.currentSeason = {
            number: seasonNumber,
            startDate: seasonStart,
            endDate: seasonEnd,
            name: 'صحوة الأثير',
            rewards: this.getSeasonRewards(seasonNumber)
        };
        
        // إعادة تعيين البيانات الموسمية
        this.resetSeasonalData();
        
        // إشعار جميع اللاعبين
        this.io.emit('newSeasonStarted', {
            season: this.currentSeason,
            timeRemaining: seasonEnd - Date.now()
        });
    }
    
    // إعادة تعيين البيانات الموسمية
    resetSeasonalData() {
        this.seasonalData.clear();
        
        // تهيئة كل فئة
        this.categories.forEach(category => {
            this.seasonalData.set(category, []);
        });
        
        // إعادة تعيين نقاط الموسم للاعبين
        db.players.forEach(player => {
            player.seasonalPoints = 0;
            player.seasonalRank = null;
            player.seasonalStats = {
                arenaWins: 0,
                arenaLosses: 0,
                dungeonCompletions: 0,
                questsCompleted: 0,
                clanContributions: 0,
                totalExperience: 0
            };
        });
    }
    
    // تحديث جميع لوحات المتصدرين
    updateAllLeaderboards() {
        this.updateAscensionLeaderboard();
        this.updateArenaLeaderboard();
        this.updateClanLeaderboard();
        this.updateDungeonLeaderboard();
        this.updateQuestLeaderboard();
        
        // بث التحديثات
        this.broadcastLeaderboards();
    }
    
    // لوحة الصعود (الأساسية)
    updateAscensionLeaderboard() {
        const players = Array.from(db.players.values());
        
        const ascensionRanking = players
            .filter(p => p.ascensionPoints > 0)
            .map(player => ({
                id: player.id,
                name: player.name,
                points: player.ascensionPoints,
                level: player.level || 1,
                class: player.class,
                clan: player.clan,
                tier: this.calculateTier(player.ascensionPoints),
                rankChange: this.calculateRankChange(player.id, 'ascension'),
                lastUpdated: new Date()
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 1000);
        
        // تحديث رتب الموسم
        ascensionRanking.forEach((entry, index) => {
            const player = db.getPlayer(entry.id);
            if (player) {
                player.seasonalRank = index + 1;
                player.seasonalPoints = entry.points;
            }
        });
        
        this.seasonalData.set('ascension', ascensionRanking);
    }
    
    // لوحة الأرينا
    updateArenaLeaderboard() {
        const players = Array.from(db.players.values());
        
        const arenaRanking = players
            .filter(p => (p.arenaStats?.wins || 0) > 0)
            .map(player => ({
                id: player.id,
                name: player.name,
                wins: player.arenaStats?.wins || 0,
                losses: player.arenaStats?.losses || 0,
                winRate: this.calculateWinRate(player.arenaStats),
                streak: player.arenaStats?.currentStreak || 0,
                bestStreak: player.arenaStats?.bestStreak || 0,
                points: player.arenaStats?.rating || 1000,
                tier: this.calculateArenaTier(player.arenaStats?.rating || 1000),
                rankChange: this.calculateRankChange(player.id, 'arena'),
                lastMatch: player.arenaStats?.lastMatch
            }))
            .sort((a, b) => b.points - a.points)
            .slice(0, 500);
        
        this.seasonalData.set('arena', arenaRanking);
    }
    
    // لوحة العشائر
    updateClanLeaderboard() {
        const clans = Array.from(db.clans.values());
        
        const clanRanking = clans
            .map(clan => {
                const totalMembers = clan.members.length;
                const totalContribution = clan.members.reduce((sum, member) => 
                    sum + (member.contribution || 0), 0);
                const avgMemberLevel = this.calculateAvgMemberLevel(clan);
                
                return {
                    id: clan.id,
                    name: clan.name,
                    tag: clan.tag,
                    level: clan.level,
                    members: totalMembers,
                    totalContribution: totalContribution,
                    avgMemberLevel: avgMemberLevel,
                    resources: clan.resources,
                    perks: clan.perks,
                    created: clan.createdAt,
                    rankChange: this.calculateClanRankChange(clan.id)
                };
            })
            .sort((a, b) => b.totalContribution - a.totalContribution)
            .slice(0, 100);
        
        this.seasonalData.set('clans', clanRanking);
    }
    
    // لوحة المتاهات
    updateDungeonLeaderboard() {
        const players = Array.from(db.players.values());
        
        const dungeonRanking = players
            .filter(p => p.dungeonStats?.completions || 0 > 0)
            .map(player => ({
                id: player.id,
                name: player.name,
                completions: player.dungeonStats?.completions || 0,
                fastestTime: player.dungeonStats?.fastestTime || null,
                totalEnemiesKilled: player.dungeonStats?.totalKills || 0,
                totalDamage: player.dungeonStats?.totalDamage || 0,
                shardsCollected: player.dungeonStats?.shardsCollected || 0,
                highestDifficulty: player.dungeonStats?.highestDifficulty || 'normal',
                favoriteDungeon: player.dungeonStats?.favoriteDungeon,
                rankChange: this.calculateRankChange(player.id, 'dungeons'),
                lastDungeon: player.dungeonStats?.lastCompletion
            }))
            .sort((a, b) => b.completions - a.completions)
            .slice(0, 500);
        
        this.seasonalData.set('dungeons', dungeonRanking);
    }
    
    // لوحة المهام
    updateQuestLeaderboard() {
        const players = Array.from(db.players.values());
        
        const questRanking = players
            .filter(p => p.questStats?.completed || 0 > 0)
            .map(player => ({
                id: player.id,
                name: player.name,
                completed: player.questStats?.completed || 0,
                storyProgress: player.storyProgress?.chapter || 1,
                dailyQuests: player.questStats?.dailyCompleted || 0,
                clanQuests: player.questStats?.clanCompleted || 0,
                totalRewards: player.questStats?.totalRewards || 0,
                fastestCompletion: player.questStats?.fastestCompletion || null,
                achievements: player.achievements?.length || 0,
                rankChange: this.calculateRankChange(player.id, 'quests'),
                lastQuest: player.questStats?.lastCompletion
            }))
            .sort((a, b) => b.completed - a.completed)
            .slice(0, 500);
        
        this.seasonalData.set('quests', questRanking);
    }
    
    // بث لوحات المتصدرين
    broadcastLeaderboards() {
        const leaderboards = {
            season: this.currentSeason,
            categories: {}
        };
        
        this.categories.forEach(category => {
            const data = this.seasonalData.get(category) || [];
            leaderboards.categories[category] = {
                top10: data.slice(0, 10),
                top100: data.slice(0, 100),
                updatedAt: new Date()
            };
        });
        
        // إرسال للجميع
        this.io.emit('leaderboardsUpdated', leaderboards);
    }
    
    // الحصول على لوحة متصدرين محددة
    getLeaderboard(category, limit = 100, offset = 0) {
        const data = this.seasonalData.get(category) || [];
        return {
            category: category,
            season: this.currentSeason.number,
            total: data.length,
            players: data.slice(offset, offset + limit),
            top3: data.slice(0, 3),
            currentTime: new Date(),
            seasonEndsIn: this.currentSeason.endDate - Date.now()
        };
    }
    
    // البحث عن لاعب في اللوحة
    searchPlayerInLeaderboards(playerId) {
        const results = {};
        
        this.categories.forEach(category => {
            const data = this.seasonalData.get(category) || [];
            const index = data.findIndex(entry => entry.id === playerId);
            
            if (index >= 0) {
                results[category] = {
                    rank: index + 1,
                    data: data[index],
                    totalInCategory: data.length
                };
            }
        });
        
        return {
            playerId: playerId,
            player: db.getPlayer(playerId),
            rankings: results,
            season: this.currentSeason.number
        };
    }
    
    // مكافآت نهاية الموسم
    async distributeSeasonRewards() {
        console.log('توزيع مكافآت الموسم...');
        
        const ascensionTop100 = this.seasonalData.get('ascension').slice(0, 100);
        const rewards = this.currentSeason.rewards;
        
        ascensionTop100.forEach((player, index) => {
            const playerData = db.getPlayer(player.id);
            if (!playerData) return;
            
            const tierRewards = this.getTierRewards(index + 1);
            
            // تطبيق المكافآت
            playerData.gold = (playerData.gold || 0) + tierRewards.gold;
            playerData.ascensionPoints = (playerData.ascensionPoints || 0) + tierRewards.ascensionPoints;
            
            if (tierRewards.items) {
                playerData.inventory = playerData.inventory || [];
                tierRewards.items.forEach(item => {
                    playerData.inventory.push({
                        id: item,
                        obtainedAt: new Date(),
                        fromSeason: this.currentSeason.number
                    });
                });
            }
            
            if (tierRewards.title) {
                playerData.titles = playerData.titles || [];
                playerData.titles.push({
                    title: tierRewards.title,
                    season: this.currentSeason.number,
                    rank: index + 1
                });
            }
            
            // إرسال الإشعار للاعب
            const socket = this.getPlayerSocket(player.id);
            if (socket) {
                socket.emit('seasonRewardsReceived', {
                    season: this.currentSeason.number,
                    rank: index + 1,
                    rewards: tierRewards,
                    nextSeasonStart: new Date(Date.now() + 24 * 60 * 60 * 1000) // بعد 24 ساعة
                });
            }
        });
        
        // بدء الموسم الجديد بعد 24 ساعة
        setTimeout(() => {
            this.currentSeason.number += 1;
            this.currentSeason.name = this.getSeasonName(this.currentSeason.number);
            this.currentSeason.startDate = new Date();
            this.currentSeason.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            this.currentSeason.rewards = this.getSeasonRewards(this.currentSeason.number);
            
            this.resetSeasonalData();
            this.initializeSeason();
        }, 24 * 60 * 60 * 1000);
    }
    
    // الحصول على مكافآت حسب الرتبة
    getTierRewards(rank) {
        if (rank === 1) {
            return {
                gold: 100000,
                ascensionPoints: 5000,
                items: ['ascendant_weapon', 'legendary_armor_set'],
                title: 'الصاعد الأعظم',
                specialMount: 'celestial_steed',
                vipAccess: true
            };
        } else if (rank <= 3) {
            return {
                gold: 50000,
                ascensionPoints: 3000,
                items: ['epic_weapon', 'rare_armor_set'],
                title: 'بطل الموسم',
                specialMount: 'mythical_steed'
            };
        } else if (rank <= 10) {
            return {
                gold: 25000,
                ascensionPoints: 1500,
                items: ['rare_weapon'],
                title: 'المتصدر'
            };
        } else if (rank <= 50) {
            return {
                gold: 10000,
                ascensionPoints: 800,
                items: ['uncommon_weapon']
            };
        } else if (rank <= 100) {
            return {
                gold: 5000,
                ascensionPoints: 400
            };
        } else {
            return {
                gold: 1000,
                ascensionPoints: 100
            };
        }
    }
    
    // وظائف مساعدة
    calculateWinRate(arenaStats) {
        if (!arenaStats) return 0;
        const total = (arenaStats.wins || 0) + (arenaStats.losses || 0);
        return total > 0 ? ((arenaStats.wins || 0) / total * 100).toFixed(1) : 0;
    }
    
    calculateTier(points) {
        if (points >= 5000) return 'الصاعد';
        if (points >= 4000) return 'أسطوري';
        if (points >= 3000) return 'بطل';
        if (points >= 2000) return 'محارب';
        if (points >= 1000) return 'متمرن';
        return 'مبتدئ';
    }
    
    calculateArenaTier(rating) {
        if (rating >= 3000) return 'أسطورة';
        if (rating >= 2500) return 'سيد';
        if (rating >= 2000) return 'بطل';
        if (rating >= 1500) return 'مقاتل';
        if (rating >= 1000) return 'مبتدئ';
        return 'جديد';
    }
    
    calculateAvgMemberLevel(clan) {
        if (clan.members.length === 0) return 0;
        
        const totalLevel = clan.members.reduce((sum, member) => {
            const player = db.getPlayer(member.id);
            return sum + (player?.level || 1);
        }, 0);
        
        return Math.round(totalLevel / clan.members.length);
    }
    
    calculateRankChange(playerId, category) {
        // هنا يمكن إضافة منطق تتبع التغير في الرتبة
        return 0; // مؤقتاً
    }
    
    calculateClanRankChange(clanId) {
        // هنا يمكن إضافة منطق تتبع التغير في رتبة العشيرة
        return 0; // مؤقتاً
    }
    
    getSeasonRewards(seasonNumber) {
        return {
            goldMultiplier: 1 + (seasonNumber * 0.1),
            experienceMultiplier: 1 + (seasonNumber * 0.05),
            specialItems: [`season_${seasonNumber}_exclusive`]
        };
    }
    
    getSeasonName(seasonNumber) {
        const names = [
            'صحوة الأثير',
            'صراع الشظايا',
            'ذاكرة الأبطال',
            'عودة الصاعد',
            'نهاية النسيان'
        ];
        return names[(seasonNumber - 1) % names.length];
    }
    
    getPlayerSocket(playerId) {
        const sockets = this.io.sockets.sockets;
        return sockets.get(playerId);
    }
}

module.exports = LeaderboardSystem;