// قاعدة بيانات في الذاكرة (مؤقتة)
class AetheriaDatabase {
    constructor() {
        this.players = new Map();
        this.clans = new Map();
        this.quests = new Map();
        this.dungeons = new Map();
        this.leaderboard = [];
        this.arenaMatches = new Map();
        
        this.initializeData();
    }
    
    initializeData() {
        // تهيئة المهام القصصية
        this.initializeQuests();
        
        // تهيئة العشائر
        this.initializeClans();
        
        // تهيئة المتاهات
        this.initializeDungeons();
    }
    
    initializeQuests() {
        // الفصل 1: اكتشاف الوباء
        this.quests.set('quest_1', {
            id: 'quest_1',
            title: 'الهمسة الأولى',
            description: 'اكتشف أول علامات الوباء الأثيري في قرية الذاكرة',
            type: 'story',
            chapter: 1,
            requirements: { level: 1 },
            objectives: [
                { type: 'talk', target: 'elder_npc', count: 1 },
                { type: 'collect', item: 'faded_scroll', count: 3 },
                { type: 'kill', enemy: 'corrupted_sprite', count: 5 }
            ],
            rewards: {
                experience: 1000,
                gold: 500,
                ascensionPoints: 10,
                items: ['novice_wand'],
                unlock: ['quest_2', 'arena_access']
            },
            location: { x: 150, y: 200, map: 'memory_village' }
        });
        
        // الفصل 2: البحث عن الشظايا
        this.quests.set('quest_2', {
            id: 'quest_2',
            title: 'صدى الشظية المفقودة',
            description: 'اتبع الصدى الأثيري للعثور على أول شظية',
            type: 'story',
            chapter: 2,
            requirements: { level: 5, completed: ['quest_1'] },
            objectives: [
                { type: 'dungeon', dungeonId: 'shard_echo_1', completion: 1 },
                { type: 'collect', item: 'shard_fragment', count: 1 },
                { type: 'report', target: 'archive_keeper' }
            ],
            rewards: {
                experience: 5000,
                gold: 2000,
                ascensionPoints: 50,
                items: ['shard_amulet'],
                skill: 'echo_detection'
            }
        });
        
        // مهمة يومية: تدريب الأرينا
        this.quests.set('daily_arena', {
            id: 'daily_arena',
            title: 'تدريب الصاعد',
            description: 'شارك في 3 مباريات أرينا اليومية',
            type: 'daily',
            reset: 'daily',
            objectives: [
                { type: 'arena_matches', count: 3 }
            ],
            rewards: {
                experience: 1500,
                gold: 1000,
                ascensionPoints: 25,
                arenaTokens: 50
            }
        });
        
        // مهمة عشائرية
        this.quests.set('clan_resource', {
            id: 'clan_resource',
            title: 'تجميع موارد العشيرة',
            description: 'اجمع 100 وحدة من الأثيريوم الخام',
            type: 'clan',
            requirements: { clanMember: true },
            objectives: [
                { type: 'collect', item: 'aetherium_ore', count: 100 }
            ],
            rewards: {
                experience: 2000,
                clanPoints: 500,
                personalContribution: 100,
                items: ['clan_cache_key']
            }
        });
    }
    
    initializeClans() {
        this.clans.set('dragons', {
            id: 'dragons',
            name: 'تنانين الأثير',
            tag: 'DRGN',
            description: 'عشيرة المحاربين الأشداء، حماة الذاكرة',
            level: 5,
            members: [],
            maxMembers: 50,
            resources: {
                aetherium: 15000,
                gold: 50000,
                memoryCrystals: 1200
            },
            perks: {
                craftingDiscount: 0.1,
                experienceBoost: 0.05,
                arenaBonus: 5
            },
            secrets: [
                'dragon_scale_armor',
                'breath_of_flame_skill'
            ],
            createdAt: new Date()
        });
        
        this.clans.set('phoenix', {
            id: 'phoenix',
            name: 'طيور الفينيق',
            tag: 'PHNX',
            description: 'حراس المعرفة، أمناء الأسرار',
            level: 4,
            members: [],
            maxMembers: 45,
            resources: {
                aetherium: 12000,
                gold: 45000,
                memoryCrystals: 1000
            },
            perks: {
                researchSpeed: 0.15,
                manaRegen: 0.1,
                dungeonBonus: 8
            },
            secrets: [
                'phoenix_feather_cape',
                'rebirth_ritual'
            ]
        });
        
        this.clans.set('wardens', {
            id: 'wardens',
            name: 'حراس الشظايا',
            tag: 'WARD',
            description: 'الصيادون الذين يتتبعون الشظايا المفقودة',
            level: 3,
            members: [],
            maxMembers: 40,
            resources: {
                aetherium: 8000,
                gold: 30000,
                memoryCrystals: 800
            },
            perks: {
                movementSpeed: 0.08,
                lootBonus: 0.12,
                shardDetection: true
            },
            secrets: [
                'warden_tracker',
                'shard_resonance'
            ]
        });
    }
    
    initializeDungeons() {
        // متاهة صيحة شظية الماء
        this.dungeons.set('shard_echo_1', {
            id: 'shard_echo_1',
            name: 'صيحة شظية الماء',
            shardType: 'water',
            description: 'متاهة مليئة بالمياه الأثيرية والوحوش المائية',
            level: 10,
            maxPlayers: 5,
            duration: 1800, // 30 دقيقة بالثانية
            difficulty: 'normal',
            stages: 3,
            enemies: [
                { type: 'water_elemental', count: 15, level: 10 },
                { type: 'corrupted_naiad', count: 8, level: 12 },
                { type: 'tidal_guardian', count: 1, level: 15 }
            ],
            rewards: {
                base: { experience: 5000, gold: 2000, ascensionPoints: 100 },
                items: ['water_shard_fragment', 'tidal_trident', 'aetherial_pearl'],
                chance: { epic: 0.1, legendary: 0.01 }
            },
            schedule: {
                active: true,
                nextActivation: Date.now() + 24 * 60 * 60 * 1000, // كل 24 ساعة
                duration: 2 * 60 * 60 * 1000 // متاحة لمدة ساعتين
            }
        });
        
        // متاهة صيحة شظية النار
        this.dungeons.set('shard_echo_2', {
            id: 'shard_echo_2',
            name: 'صيحة شظية النار',
            shardType: 'fire',
            description: 'متاهة بركانية تشتعل بالطاقة النارية',
            level: 15,
            maxPlayers: 5,
            duration: 2100, // 35 دقيقة
            difficulty: 'hard',
            stages: 4,
            enemies: [
                { type: 'fire_elemental', count: 20, level: 15 },
                { type: 'lava_behemoth', count: 3, level: 18 },
                { type: 'inferno_dragon', count: 1, level: 25 }
            ],
            rewards: {
                base: { experience: 8000, gold: 3500, ascensionPoints: 150 },
                items: ['fire_shard_fragment', 'inferno_blade', 'molten_core'],
                chance: { epic: 0.15, legendary: 0.02 }
            },
            schedule: {
                active: false,
                nextActivation: Date.now() + 48 * 60 * 60 * 1000, // كل 48 ساعة
                duration: 3 * 60 * 60 * 1000 // متاحة لمدة 3 ساعات
            }
        });
    }
    
    // دالات المساعدة
    getPlayer(playerId) {
        return this.players.get(playerId);
    }
    
    updatePlayer(playerId, data) {
        const player = this.players.get(playerId);
        if (player) {
            Object.assign(player, data);
        }
    }
    
    addPlayer(player) {
        this.players.set(player.id, player);
    }
    
    getActiveQuests(playerId) {
        const player = this.getPlayer(playerId);
        return player?.activeQuests || [];
    }
    
    getClan(clanId) {
        return this.clans.get(clanId);
    }
    
    joinClan(playerId, clanId) {
        const clan = this.clans.get(clanId);
        const player = this.getPlayer(playerId);
        
        if (clan && player && clan.members.length < clan.maxMembers) {
            clan.members.push({
                id: playerId,
                name: player.name,
                rank: 'member',
                contribution: 0,
                joinedAt: new Date()
            });
            
            player.clan = clanId;
            player.clanRank = 'member';
            
            return true;
        }
        return false;
    }
    
    getActiveDungeons() {
        const now = Date.now();
        const active = [];
        
        this.dungeons.forEach(dungeon => {
            if (dungeon.schedule.active && 
                now < dungeon.schedule.nextActivation + dungeon.schedule.duration) {
                active.push(dungeon);
            }
        });
        
        return active;
    }
    
    updateLeaderboard(player) {
        const index = this.leaderboard.findIndex(p => p.id === player.id);
        
        const entry = {
            id: player.id,
            name: player.name,
            ascensionPoints: player.ascensionPoints,
            level: player.level || 1,
            clan: player.clan,
            wins: player.arenaWins || 0,
            losses: player.arenaLosses || 0,
            lastUpdated: new Date()
        };
        
        if (index >= 0) {
            this.leaderboard[index] = entry;
        } else {
            this.leaderboard.push(entry);
        }
        
        // ترتيب حسب نقاط الصعود
        this.leaderboard.sort((a, b) => b.ascensionPoints - a.ascensionPoints);
        
        // حفظ أول 1000 فقط
        this.leaderboard = this.leaderboard.slice(0, 1000);
        
        return this.leaderboard;
    }
}

module.exports = new AetheriaDatabase();