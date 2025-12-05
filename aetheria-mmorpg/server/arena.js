const db = require('./database');

class ArenaSystem {
    constructor(io) {
        this.io = io;
        this.activeMatches = new Map();
        this.waitingPlayers = [];
        this.ranking = new Map();
        this.season = {
            number: 1,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 يوم
            name: 'صحوة الأثير',
            rewards: this.getSeasonRewards(1)
        };
        
        this.initializeRanking();
        setInterval(() => this.processWaitingPlayers(), 5000); // كل 5 ثواني
    }
    
    initializeRanking() {
        // إعادة تعيين الترتيب في بداية الموسم
        db.players.forEach(player => {
            this.ranking.set(player.id, {
                playerId: player.id,
                name: player.name,
                rating: 1000, // نقاط البداية
                wins: 0,
                losses: 0,
                draws: 0,
                streak: 0,
                bestStreak: 0,
                lastMatch: null,
                tier: this.calculateTier(1000),
                rankChange: 0
            });
        });
    }
    
    // البحث عن خصم
    findOpponent(playerId) {
        const player = db.getPlayer(playerId);
        const playerRank = this.ranking.get(playerId);
        
        if (!player || !playerRank) return null;
        
        // التحقق من الحد اليومي
        if (player.dailyArenaMatches >= 10) {
            return { error: 'لقد وصلت للحد اليومي من المباريات (10/10)' };
        }
        
        // البحث في قائمة الانتظار
        for (let i = 0; i < this.waitingPlayers.length; i++) {
            const waitingPlayer = this.waitingPlayers[i];
            
            // تجنب المباراة مع نفس اللاعب
            if (waitingPlayer.id === playerId) continue;
            
            // التحقق من فرق النقاط (لا يزيد عن 200 نقطة)
            const waitingRank = this.ranking.get(waitingPlayer.id);
            if (Math.abs(playerRank.rating - waitingRank.rating) <= 200) {
                // وجدنا خصم مناسب
                const opponent = this.waitingPlayers.splice(i, 1)[0];
                return opponent;
            }
        }
        
        // إذا لم يجد خصم، يضاف لقائمة الانتظار
        this.waitingPlayers.push({
            id: playerId,
            name: player.name,
            class: player.class,
            rating: playerRank.rating,
            joinedAt: Date.now()
        });
        
        return { waiting: true, position: this.waitingPlayers.length };
    }
    
    // معالجة قائمة الانتظار
    processWaitingPlayers() {
        const now = Date.now();
        
        // إزالة اللاعبين الذين انتظروا أكثر من 5 دقائق
        this.waitingPlayers = this.waitingPlayers.filter(player => {
            return now - player.joinedAt < 5 * 60 * 1000; // 5 دقائق
        });
        
        // محاولة توفيق اللاعبين
        for (let i = 0; i < this.waitingPlayers.length; i++) {
            for (let j = i + 1; j < this.waitingPlayers.length; j++) {
                const player1 = this.waitingPlayers[i];
                const player2 = this.waitingPlayers[j];
                
                // التحقق من فرق النقاط
                if (Math.abs(player1.rating - player2.rating) <= 200) {
                    // بدء مباراة
                    this.startMatch(player1, player2);
                    
                    // إزالة اللاعبين من قائمة الانتظار
                    this.waitingPlayers.splice(j, 1);
                    this.waitingPlayers.splice(i, 1);
                    
                    return;
                }
            }
        }
    }
    
    // بدء مباراة
    startMatch(player1, player2) {
        const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const match = {
            id: matchId,
            player1: player1,
            player2: player2,
            startTime: Date.now(),
            duration: 5 * 60 * 1000, // 5 دقائق
            state: 'active',
            winner: null,
            room: `arena_${matchId}`,
            round: 1,
            maxRounds: 3,
            scores: {
                [player1.id]: 0,
                [player2.id]: 0
            }
        };
        
        this.activeMatches.set(matchId, match);
        
        // زيادة عدد المباريات اليومية
        const dbPlayer1 = db.getPlayer(player1.id);
        const dbPlayer2 = db.getPlayer(player2.id);
        
        if (dbPlayer1) dbPlayer1.dailyArenaMatches = (dbPlayer1.dailyArenaMatches || 0) + 1;
        if (dbPlayer2) dbPlayer2.dailyArenaMatches = (dbPlayer2.dailyArenaMatches || 0) + 1;
        
        // إعلام اللاعبين
        this.io.to(player1.id).emit('arenaMatchFound', {
            matchId: matchId,
            opponent: {
                id: player2.id,
                name: player2.name,
                class: player2.class,
                rating: player2.rating,
                tier: this.ranking.get(player2.id)?.tier || 'مبتدئ'
            },
            matchSettings: {
                duration: match.duration,
                maxRounds: match.maxRounds
            }
        });
        
        this.io.to(player2.id).emit('arenaMatchFound', {
            matchId: matchId,
            opponent: {
                id: player1.id,
                name: player1.name,
                class: player1.class,
                rating: player1.rating,
                tier: this.ranking.get(player1.id)?.tier || 'مبتدئ'
            },
            matchSettings: {
                duration: match.duration,
                maxRounds: match.maxRounds
            }
        });
        
        // بدء المؤقت
        setTimeout(() => this.endMatch(matchId, 'timeout'), match.duration);
        
        return match;
    }
    
    // تحديث نتيجة المباراة
    updateMatchScore(matchId, playerId, damage) {
        const match = this.activeMatches.get(matchId);
        if (!match || match.state !== 'active') return;
        
        // زيادة النتيجة
        match.scores[playerId] = (match.scores[playerId] || 0) + damage;
        
        // التحقق من نهاية الجولة
        if (match.scores[playerId] >= 100) {
            this.endRound(matchId, playerId);
        }
        
        // إرسال تحديث النتيجة للاعبين
        this.io.to(match.room).emit('arenaScoreUpdate', {
            matchId: matchId,
            scores: match.scores,
            round: match.round
        });
    }
    
    // إنهاء جولة
    endRound(matchId, winnerId) {
        const match = this.activeMatches.get(matchId);
        if (!match) return;
        
        // زيادة عدد الجولات المربوحة
        match.scores[winnerId] = 0;
        match.scores[winnerId === match.player1.id ? match.player2.id : match.player1.id] = 0;
        
        // زيادة عداد الجولات
        match.round++;
        
        // التحقق من نهاية المباراة
        const player1Wins = match.scores[match.player1.id] || 0;
        const player2Wins = match.scores[match.player2.id] || 0;
        
        if (match.round > match.maxRounds) {
            // المباراة انتهت
            if (player1Wins > player2Wins) {
                this.endMatch(matchId, 'victory', match.player1.id);
            } else if (player2Wins > player1Wins) {
                this.endMatch(matchId, 'victory', match.player2.id);
            } else {
                this.endMatch(matchId, 'draw');
            }
        } else {
            // بدء جولة جديدة
            this.io.to(match.room).emit('arenaRoundEnded', {
                matchId: matchId,
                round: match.round - 1,
                winner: winnerId,
                nextRound: match.round,
                scores: {
                    [match.player1.id]: player1Wins,
                    [match.player2.id]: player2Wins
                }
            });
            
            // تأخير 10 ثواني قبل الجولة التالية
            setTimeout(() => {
                this.io.to(match.room).emit('arenaRoundStart', {
                    matchId: matchId,
                    round: match.round
                });
            }, 10000);
        }
    }
    
    // إنهاء المباراة
    endMatch(matchId, reason, winnerId = null) {
        const match = this.activeMatches.get(matchId);
        if (!match || match.state !== 'active') return;
        
        match.state = 'ended';
        match.endReason = reason;
        match.winner = winnerId;
        match.endTime = Date.now();
        
        // حساب النقاط
        let player1Points = 0;
        let player2Points = 0;
        
        if (reason === 'victory') {
            const winner = winnerId === match.player1.id ? match.player1 : match.player2;
            const loser = winnerId === match.player1.id ? match.player2 : match.player1;
            
            player1Points = this.calculatePoints(match.player1, match.player2, winnerId === match.player1.id);
            player2Points = this.calculatePoints(match.player2, match.player1, winnerId === match.player2.id);
            
            // تحديث الإحصائيات
            this.updatePlayerStats(match.player1.id, winnerId === match.player1.id, player1Points);
            this.updatePlayerStats(match.player2.id, winnerId === match.player2.id, player2Points);
        } else if (reason === 'draw') {
            player1Points = 5; // نقاط التعادل
            player2Points = 5;
            
            this.updatePlayerStats(match.player1.id, 'draw', player1Points);
            this.updatePlayerStats(match.player2.id, 'draw', player2Points);
        }
        
        // إرسال النتائج
        this.io.to(match.room).emit('arenaMatchEnded', {
            matchId: matchId,
            winner: winnerId,
            reason: reason,
            points: {
                [match.player1.id]: player1Points,
                [match.player2.id]: player2Points
            },
            duration: match.endTime - match.startTime
        });
        
        // تحديث نقاط الصعود للاعبين
        const player1 = db.getPlayer(match.player1.id);
        const player2 = db.getPlayer(match.player2.id);
        
        if (player1) player1.ascensionPoints = (player1.ascensionPoints || 0) + player1Points;
        if (player2) player2.ascensionPoints = (player2.ascensionPoints || 0) + player2Points;
        
        // تحديث لوحة المتصدرين
        db.updateLeaderboard(player1);
        db.updateLeaderboard(player2);
        
        // تنظيف
        this.activeMatches.delete(matchId);
    }
    
    // حساب النقاط
    calculatePoints(player, opponent, isWinner) {
        const playerRank = this.ranking.get(player.id);
        const opponentRank = this.ranking.get(opponent.id);
        
        let basePoints = isWinner ? 15 : -5;
        
        // مكافأة التحدي (إذا كان الخصم أعلى)
        if (opponentRank.rating > playerRank.rating + 100) {
            basePoints += isWinner ? 10 : 5;
        }
        
        // مكافأة الانتصارات المتتالية
        if (isWinner && playerRank.streak > 0) {
            if (playerRank.streak >= 3) basePoints += 5;
            if (playerRank.streak >= 5) basePoints += 10;
            if (playerRank.streak >= 10) basePoints += 20;
        }
        
        // الحد الأدنى للنقاط
        if (!isWinner && basePoints < -10) {
            basePoints = -10;
        }
        
        return basePoints;
    }
    
    // تحديث إحصائيات اللاعب
    updatePlayerStats(playerId, result, points) {
        const rank = this.ranking.get(playerId);
        if (!rank) return;
        
        if (result === true || result === 'win') {
            rank.wins++;
            rank.streak++;
            if (rank.streak > rank.bestStreak) {
                rank.bestStreak = rank.streak;
            }
        } else if (result === false || result === 'loss') {
            rank.losses++;
            rank.streak = 0;
        } else if (result === 'draw') {
            rank.draws++;
        }
        
        rank.rating += points;
        rank.tier = this.calculateTier(rank.rating);
        rank.lastMatch = new Date();
        
        // تحديث في قاعدة البيانات
        const player = db.getPlayer(playerId);
        if (player) {
            player.arenaStats = player.arenaStats || {};
            player.arenaStats.wins = rank.wins;
            player.arenaStats.losses = rank.losses;
            player.arenaStats.rating = rank.rating;
            player.arenaStats.currentStreak = rank.streak;
            player.arenaStats.bestStreak = rank.bestStreak;
        }
    }
    
    // حساب المستوى (Tier)
    calculateTier(rating) {
        if (rating >= 5000) return 'الصاعد';
        if (rating >= 4000) return 'أسطوري';
        if (rating >= 3000) return 'بطل';
        if (rating >= 2000) return 'محارب';
        if (rating >= 1000) return 'متمرن';
        return 'مبتدئ';
    }
    
    // الحصول على مكافآت الموسم
    getSeasonRewards(seasonNumber) {
        return {
            top1: {
                title: 'الصاعد الأعظم',
                gold: 100000,
                ascensionPoints: 5000,
                items: ['ascendant_weapon', 'legendary_armor_set']
            },
            top3: {
                title: 'بطل الموسم',
                gold: 50000,
                ascensionPoints: 3000,
                items: ['epic_weapon', 'rare_armor_set']
            },
            top10: {
                title: 'المتصدر',
                gold: 25000,
                ascensionPoints: 1500,
                items: ['rare_weapon']
            },
            top100: {
                title: 'المنافس',
                gold: 10000,
                ascensionPoints: 800
            }
        };
    }
    
    // الحصول على المكافآت اليومية
    getDailyRewards(playerId) {
        const player = db.getPlayer(playerId);
        if (!player) return null;
        
        const matchesPlayed = player.dailyArenaMatches || 0;
        const rewards = {
            gold: 0,
            ascensionPoints: 0,
            arenaTokens: 0
        };
        
        if (matchesPlayed >= 1) {
            rewards.gold += 100;
            rewards.ascensionPoints += 5;
        }
        if (matchesPlayed >= 3) {
            rewards.gold += 150;
            rewards.arenaTokens += 10;
        }
        if (matchesPlayed >= 5) {
            rewards.gold += 250;
            rewards.ascensionPoints += 10;
        }
        if (matchesPlayed >= 7) {
            rewards.gold += 400;
            rewards.arenaTokens += 25;
        }
        if (matchesPlayed >= 10) {
            rewards.gold += 600;
            rewards.ascensionPoints += 15;
            rewards.arenaTokens += 50;
        }
        
        return rewards;
    }
    
    // الحصول على معلومات اللاعب في الأرينا
    getPlayerArenaInfo(playerId) {
        const player = db.getPlayer(playerId);
        const rank = this.ranking.get(playerId);
        
        if (!player || !rank) return null;
        
        return {
            player: {
                id: playerId,
                name: player.name,
                class: player.class
            },
            ranking: {
                rating: rank.rating,
                tier: rank.tier,
                wins: rank.wins,
                losses: rank.losses,
                draws: rank.draws,
                streak: rank.streak,
                bestStreak: rank.bestStreak,
                rank: this.getPlayerRank(playerId)
            },
            daily: {
                matchesPlayed: player.dailyArenaMatches || 0,
                matchesRemaining: Math.max(0, 10 - (player.dailyArenaMatches || 0)),
                rewardsAvailable: this.checkDailyRewards(playerId)
            }
        };
    }
    
    // الحصول على رتبة اللاعب
    getPlayerRank(playerId) {
        const sortedRanking = Array.from(this.ranking.values())
            .sort((a, b) => b.rating - a.rating);
        
        const index = sortedRanking.findIndex(rank => rank.playerId === playerId);
        return index >= 0 ? index + 1 : null;
    }
    
    // التحقق من المكافآت اليومية
    checkDailyRewards(playerId) {
        const player = db.getPlayer(playerId);
        if (!player) return false;
        
        return (player.dailyArenaMatches || 0) >= 3; // مكافأة بعد 3 مباريات
    }
    
    // إعادة تعيين المباريات اليومية
    resetDailyMatches() {
        db.players.forEach(player => {
            player.dailyArenaMatches = 0;
        });
        
        console.log('تم إعادة تعيين المباريات اليومية');
    }
    
    // الحصول على أفضل 100 لاعب
    getTopPlayers(limit = 100) {
        return Array.from(this.ranking.values())
            .sort((a, b) => b.rating - a.rating)
            .slice(0, limit)
            .map((rank, index) => ({
                rank: index + 1,
                ...rank
            }));
    }
}

module.exports = ArenaSystem;