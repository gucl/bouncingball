/**
 * 游戏配置 - 包含所有游戏参数
 * 所有可调控的参数都在这里，方便统一配置
 */
export class GameConfig {
    // ==================== 画布设置 ====================
    static readonly DESIGN_WIDTH = 720;              // 设计宽度
    static readonly DESIGN_HEIGHT = 1280;            // 设计高度

    // ==================== 物理系统设置 ====================
    static readonly GRAVITY_X = 0;                   // 重力X分量
    static readonly GRAVITY_Y = -800;                // 重力Y分量（负值向下）
    
    // ==================== 碰撞分组设置 ====================
    // 所有物体使用默认分组，通过代码逻辑控制碰撞行为
    static readonly GROUP_DEFAULT = 1 << 0;          // 默认分组

    // ==================== 管道设置 ====================
    static readonly INITIAL_PIPE_CAPACITY = 12;      // 初始管道容量
    static readonly MAX_PIPE_CAPACITY = 22;          // 最大管道容量
    static readonly VISIBLE_PIPE_SLOTS = 12;         // 可见小球数（水平段+垂直段）
    static readonly INITIAL_SMALL_BALLS = [8, 4, 2]; // 初始小球数值
    static readonly PIPE_CAPACITY_INCREASE = 1;      // 每次看广告增加的管道容量
    
    // ==================== 发射口位置设置 ====================
    // 注意：发射口位置应该与 PipeDisplay 中的 horizontalY 保持一致
    // 同时需要在编辑器中将 Launcher 节点的 Y 坐标设置为此值
    static readonly LAUNCH_POS_X = 0;                // 发射口X坐标（屏幕中间）
    static readonly LAUNCH_POS_Y = 450;              // 发射口Y坐标（与管道水平段同高度）

    // ==================== 小球物理设置 ====================
    static readonly BALL_LAUNCH_INTERVAL = 0.2;      // 发射间隔（秒）
    static readonly BALL_INITIAL_SPEED = 45;       // 发射初始速度
    static readonly BALL_RADIUS = 22;                // 小球半径
    static readonly BALL_GRAVITY_SCALE = 2.5;        // 小球重力缩放（1.0为正常重力）
    static readonly BALL_LINEAR_DAMPING = 0;         // 小球线性阻尼（0为无阻尼）
    static readonly BALL_ANGULAR_DAMPING = 0;        // 小球角阻尼
    static readonly BALL_RESTITUTION = 0.6;          // 小球弹性系数（0-1，越大越弹）
    static readonly BALL_FRICTION = 0;               // 小球摩擦力（0为无摩擦）

    // ==================== 大球物理设置 ====================
    static readonly BIG_BALL_RESTITUTION = 0.2;      // 大球弹性系数
    static readonly BIG_BALL_FRICTION = 0;           // 大球摩擦力
    static readonly BIG_BALL_HIT_COOLDOWN = 0.05;     // 同一小球对同一大球的碰撞冷却时间（秒）
    static readonly BIG_BALL_BOUNCE_SPEED = 40;      // 大球弹射速度（保底速度，防止小球卡在大球上）
    
    // ==================== 大球碰撞动效设置 ====================
    static readonly BIG_BALL_HIT_SCALE_MAX = 1.2;    // 大球被碰撞时的最大放大倍数
    static readonly BIG_BALL_HIT_SCALE_MIN = 1.0;    // 大球被碰撞后恢复的缩放倍数
    static readonly BIG_BALL_HIT_ANIM_DURATION = 0.25; // 大球放缩动效总时长（秒）

    // ==================== 墙壁物理设置 ====================
    static readonly WALL_SIDE_RESTITUTION = 0.6;     // 左右墙壁弹性系数
    static readonly WALL_SIDE_FRICTION = 0;          // 左右墙壁摩擦力
    static readonly WALL_BOTTOM_RESTITUTION = 0;     // 底部墙壁弹性系数（0不反弹）
    static readonly WALL_BOTTOM_FRICTION = 0.5;      // 底部墙壁摩擦力

    // ==================== 碰撞区域设置 ====================
    static readonly COLLISION_AREA_BOTTOM = -350;    // 碰撞区底部Y坐标
    static readonly BIG_BALL_BOTTOM_MARGIN = -50;      // 最下层大球距离碰撞区底部的额外边距（正值向上偏移）

    // ==================== 大球层设置 ====================
    static readonly BIG_BALL_LAYERS = 8;             // 碰撞区层数
    static readonly FAIL_LAYER = 9;                  // 失败判定层
    static readonly LAYER_HEIGHT_4 = 95;             // 4容量层的层高（大球垂直间距）
    static readonly LAYER_HEIGHT_5 = 95;             // 5容量层的层高
    static readonly LAYER_4_CAPACITY = 4;            // 4容量层的最大大球数
    static readonly LAYER_5_CAPACITY = 5;            // 5容量层的最大大球数
    static readonly BIG_BALL_RADIUS_CIRCLE = 33;     // 圆形大球半径
    static readonly BIG_BALL_RADIUS_SQUARE = 25;     // 方形大球半边长
    static readonly BIG_BALL_RADIUS_DIAMOND = 28;    // 菱形大球半边长（旋转45度的方形）
    static readonly BIG_BALL_SPACING_4 = 95;        // 4容量层大球之间的水平间距
    static readonly BIG_BALL_SPACING_5 = 95;         // 5容量层大球之间的水平间距
    
    // ==================== 大球数量权重配置 ====================
    // 4容量层大球数量权重配置
    // 格式：{ 数量: 权重 }
    static readonly LAYER_4_BALL_COUNT_WEIGHTS: { [count: number]: number } = {
        1: 10,    // 1个大球，权重5
        2: 20,   // 2个大球，权重15
        3: 25,   // 3个大球，权重30
        4: 15,   // 4个大球，权重50
    };
    
    // 5容量层大球数量权重配置
    static readonly LAYER_5_BALL_COUNT_WEIGHTS: { [count: number]: number } = {
        1: 10,    // 1个大球，权重5
        2: 20,   // 2个大球，权重10
        3: 25,   // 3个大球，权重25
        4: 20,   // 4个大球，权重35
        5: 15,   // 5个大球，权重25
    };
    
    // 上一行大球数量少于阈值时，提高最大数权重的配置
    static readonly LAYER_4_LOW_COUNT_THRESHOLD = 2;  // 4容量层：上一行少于2个时触发
    static readonly LAYER_5_LOW_COUNT_THRESHOLD = 2;  // 5容量层：上一行少于2个时触发
    static readonly LOW_COUNT_MAX_WEIGHT_BOOST = 50;  // 最大数权重提升量
    
    // ==================== 大球形状随机权重配置 ====================
    // 格式：{ 形状索引: 权重 }
    // 形状索引：0=圆形, 1=方形, 2=菱形
    // 概率计算：某形状概率 = 该形状权重 / 所有权重之和
    static readonly BIG_BALL_SHAPE_WEIGHTS: { [shape: number]: number } = {
        0: 10,   // 圆形权重
        1: 0,   // 方形权重
        2: 10,   // 菱形权重
    };
    
    /**
     * 根据权重随机生成大球形状
     * @returns 形状索引（0=圆形, 1=方形, 2=菱形）
     */
    static generateBigBallShape(): number {
        const weights = this.BIG_BALL_SHAPE_WEIGHTS;
        
        // 计算权重总和
        let totalWeight = 0;
        for (const shape in weights) {
            totalWeight += weights[shape];
        }
        
        // 随机选择
        let random = Math.random() * totalWeight;
        for (const shapeStr in weights) {
            const shape = parseInt(shapeStr);
            const weight = weights[shape];
            random -= weight;
            if (random <= 0) {
                return shape;
            }
        }
        
        // 默认返回圆形
        return 0;
    }

    // ==================== 边界设置（空气墙） ====================
    // 这些是相对于Canvas的本地坐标
    static readonly BOUNDARY_LEFT = -220;            // 左边界X坐标
    static readonly BOUNDARY_RIGHT = 220;            // 右边界X坐标
    static readonly BOUNDARY_TOP = 500;              // 顶部边界Y坐标
    static readonly BOUNDARY_BOTTOM = -510;          // 底部边界Y坐标（触发回收）
    
    // ==================== 道具系统设置 ====================
    // 一键收球
    static readonly QUICK_RECALL_COOLDOWN = 5;      // 一键收球冷却时间（秒），发射后需等待此时间才能使用
    
    // 炸弹球
    static readonly BOMB_EXPLOSION_RADIUS = 200;     // 炸弹爆炸半径（像素）
    static readonly BOMB_BALL_SPEED = 50;           // 炸弹球飞行速度（不受重力影响）
    static readonly BOMB_BALL_RADIUS = 35;           // 炸弹球半径
    
    // 翻倍球
    static readonly DOUBLE_BALL_RADIUS = 33;         // 翻倍球半径
    static readonly DOUBLE_BALL_HIT_COUNT = 3;       // 翻倍球可被碰撞次数
    static readonly DOUBLE_BALL_FLY_SPEED = 3000;     // 翻倍球飞入速度（像素/秒）
    static readonly DOUBLE_BALL_PRIORITY_LAYERS = 4; // 翻倍球优先放置的层数（从上往下）
    
    // 激光
    static readonly LASER_SWEEP_LAYERS = 4;          // 激光扫过的层数
    static readonly LASER_SWEEP_DURATION = 1.5;      // 激光扫描动画时长（秒）
    static readonly LASER_WIDTH = 20;                // 激光宽度
    
    // 道具初始数量（用于新玩家或测试）
    static readonly INITIAL_ITEM_COUNTS = {
        bomb: 0,        // 炸弹球初始数量
        double: 0,      // 翻倍球初始数量
        laser: 0,       // 激光初始数量
        sortPipe: 0     // 整理管道初始数量
    };
    
    // ==================== 游戏加速设置 ====================
    // 防止小球卡住导致玩家等待过久，发射后逐渐加速
    // static readonly GAME_SPEED_UP_INTERVAL = 3;     // 加速间隔（秒）已弃用
    // 加速倍数配置：[时间阈值, 速度倍数]
    // 注意：速度倍数请使用整数，不支持小数（小数会导致性能问题）
    static readonly GAME_SPEED_LEVELS: [number, number][] = [
        [0, 1],      // 0秒开始，1倍速
        [15, 2],     // 15秒开始，2倍速
        [25, 4],     // 30秒开始，4倍速
        [33, 8],     // 45秒开始，8倍速
        [38, 16],    // 60秒开始，16倍速
        [42, 32],    // 75秒开始，32倍速
        [45, 64],    // 90秒开始，64倍速
    ];
    
    /**
     * 根据发射后经过的时间获取游戏速度倍数
     * @param elapsedTime 发射后经过的时间（秒）
     * @returns 速度倍数
     */
    static getGameSpeedMultiplier(elapsedTime: number): number {
        let multiplier = 1;
        for (const [threshold, speed] of this.GAME_SPEED_LEVELS) {
            if (elapsedTime >= threshold) {
                multiplier = speed;
            } else {
                break;
            }
        }
        return multiplier;
    }

    // ==================== 瞄准线设置 ====================
    static readonly AIM_LINE_MAX_LENGTH = 600;       // 瞄准线最大长度
    static readonly AIM_LINE_WIDTH = 6;              // 瞄准线宽度
    static readonly AIM_LINE_DASH_LENGTH = 10;       // 瞄准线虚线长度
    static readonly AIM_LINE_GAP_LENGTH = 10;        // 瞄准线虚线间隔

    // ==================== 道具设置 ====================
    static readonly RECALL_COUNTDOWN = 25;           // 一键收球倒计时（秒）
    static readonly DOUBLE_BALL_HITS = 3;            // 翻倍球可触发次数
    static readonly LASER_CLEAR_LAYERS = 4;          // 激光清除层数

    // ==================== 合成设置 ====================
    static readonly MERGE_ANIMATION_DURATION = 0.2;  // 合成动画时长（秒）- 已废弃，使用下方新参数
    static readonly AD_TRIGGER_VALUE = 32;           // 触发广告的最小合成值
    
    // ==================== 待获得小球产出设置 ====================
    // 大球销毁后产出待获得小球的概率配置（根据回合数）
    // 格式：{ 回合数阈值: 概率 }
    // 当回合数 >= 阈值时使用该概率，取最大的满足条件的阈值
    static readonly PENDING_BALL_SPAWN_CHANCE_BY_ROUND: { [round: number]: number } = {
        1: 0.65,    // 回合1-2：65%概率
        3: 0.5,   // 回合3-4：50%概率
        5: 0.4,   // 回合5-6：40%概率
        7: 0.35,  // 回合7-8：35%概率
        9: 0.3,   // 回合9+：30%概率
    };
    
    // 未产出待获得小球时的概率递增配置
    static readonly PENDING_BALL_SPAWN_CHANCE_INCREMENT = 0.08;  // 每次未产出时增加的概率
    static readonly PENDING_BALL_SPAWN_CHANCE_MAX = 1.0;        // 概率上限（100%必定产出）
    
    // 当前概率加成（运行时变量，由 BallManager 管理）
    static currentSpawnChanceBonus: number = 0;
    
    // 当前回合数（由GameManager在每回合开始时更新）
    static currentRound: number = 1;
    
    /**
     * 获取当前回合的待获得小球产出基础概率
     */
    static getSpawnChanceByRound(round: number): number {
        let bestThreshold = 1;
        for (const thresholdStr in this.PENDING_BALL_SPAWN_CHANCE_BY_ROUND) {
            const threshold = parseInt(thresholdStr);
            if (round >= threshold && threshold > bestThreshold) {
                bestThreshold = threshold;
            }
        }
        return this.PENDING_BALL_SPAWN_CHANCE_BY_ROUND[bestThreshold];
    }
    
    /**
     * 判断大球销毁后是否产出待获得小球（带概率递增机制）
     * @returns true表示产出，false表示不产出
     */
    static shouldSpawnPendingBall(): boolean {
        const baseChance = this.getSpawnChanceByRound(this.currentRound);
        const finalChance = Math.min(baseChance + this.currentSpawnChanceBonus, this.PENDING_BALL_SPAWN_CHANCE_MAX);
        
        if (Math.random() < finalChance) {
            // 产出成功，重置概率加成
            this.currentSpawnChanceBonus = 0;
            return true;
        } else {
            // 未产出，增加概率加成
            this.currentSpawnChanceBonus += this.PENDING_BALL_SPAWN_CHANCE_INCREMENT;
            return false;
        }
    }
    
    /**
     * 重置产出概率加成（游戏重新开始时调用）
     */
    static resetSpawnChanceBonus() {
        this.currentSpawnChanceBonus = 0;
    }
    
    // 待获得小球数值权重配置
    // 格式：{ 回合数阈值: { 数值: 权重 } }
    // 当回合数 >= 阈值时使用该配置，取最大的满足条件的阈值
    // 例如：回合3时，会使用阈值1的配置；回合5时，会使用阈值5的配置
    static readonly PENDING_BALL_VALUE_WEIGHTS: { [roundThreshold: number]: { [value: number]: number } } = {
        // 回合1-4：基础权重
        1: {
            2: 20,      // 2的权重
            4: 15,      // 4的权重
            8: 10,      // 8的权重
            16: 5,      // 16的权重
        },
        // 回合5-11：稍微提升高数值概率
        5: {
            2: 20,
            4: 20,
            8: 15,
            16: 10,
            32: 5,
        },
        // 回合12-19：继续提升
        10: {
            2: 20,
            4: 20,
            8: 20,
            16: 15,
            32: 10,
            64: 5,
        },
        // 回合20+：高数值更常见（这是动态成长的基础配置）
        15: {
            2: 20,
            4: 20,
            8: 20,
            16: 20,
            32: 15,
            64: 10,
            128: 5,
        },
    };
    
    // ==================== 待获得小球动态成长设置 ====================
    // 当回合数超过配置的最大回合数后，每隔N回合自动成长一次
    static readonly PENDING_BALL_GROWTH_START_ROUND = 15;  // 动态成长开始的回合数（应与PENDING_BALL_VALUE_WEIGHTS最大阈值一致）
    static readonly PENDING_BALL_GROWTH_INTERVAL = 5;      // 每隔多少回合成长一次
    // 成长时新数值的初始权重序列（循环使用）
    // 例如：[5, 10, 20] 表示新数值第1次出现权重5，第2次成长后权重10，第3次成长后权重15，第4次成长后权重20，之后保持20
    static readonly PENDING_BALL_GROWTH_WEIGHTS: number[] = [5, 10, 15, 20];
    
    // ==================== 小球回收动画设置 ====================
    static readonly BALL_RECYCLE_SPEED = 5000;        // 小球回收飞行速度（像素/秒）
    static readonly PIPE_CORNER_X = -300;            // 管道L形转弯点X坐标（与PipeDisplay的getLeftmostX一致）
    static readonly PIPE_HORIZONTAL_Y = 450;         // 管道水平段Y坐标（与LAUNCH_POS_Y一致）
    
    // ==================== 小球合成动画设置 ====================
    static readonly BALL_MERGE_MOVE_SPEED = 1000;     // 小球合成时移动速度（像素/秒）
    static readonly BALL_MERGE_SCALE_MAX = 1.4;      // 小球合成时最大放大倍数
    static readonly BALL_MERGE_SCALE_MIN = 1.0;      // 小球合成后恢复的缩放倍数
    static readonly BALL_MERGE_ANIM_DURATION = 0.5; // 小球合成放缩动效总时长（秒）

    // ==================== 小球颜色配置（10色循环） ====================
    static readonly BALL_COLORS: { [key: number]: string } = {
        0: '#87CEEB',  // 2, 2048, 2097152...    浅蓝
        1: '#90EE90',  // 4, 4096, 4194304...    浅绿
        2: '#FFD700',  // 8, 8192, 8388608...    黄色
        3: '#FFA500',  // 16, 16384...           橙色
        4: '#FF6B6B',  // 32, 32768...           红色
        5: '#9B59B6',  // 64, 65536...           紫色
        6: '#3498DB',  // 128, 131072...         深蓝
        7: '#1ABC9C',  // 256, 262144...         青色
        8: '#FF69B4',  // 512, 524288...         粉色
        9: '#F39C12',  // 1024, 1048576...       金色
    };

    /**
     * 根据小球数值获取颜色
     */
    static getBallColor(value: number): string {
        const exponent = Math.log2(value);
        const colorIndex = (exponent - 1) % 10;
        return this.BALL_COLORS[colorIndex] || '#FFFFFF';
    }

    /**
     * 获取数值所在的指数
     */
    static getExponent(value: number): number {
        return Math.floor(Math.log2(value));
    }

    /**
     * 根据指数获取数值
     */
    static getValue(exponent: number): number {
        return Math.pow(2, exponent);
    }

    // ==================== 大球数值生成规则 ====================
    // 动态规则生效的起始回合数（达到此回合后才启用动态提升规则）
    // 在此回合之前，仅使用基础回合规则（规则A）
    // 达到此回合后，取规则A和规则B（基于管道总值的动态规则）中较高的值
    static readonly DYNAMIC_RULE_START_ROUND = 4;
    
    // 动态提升分阶段过渡配置
    // 格式：[阶段1比例, 阶段2比例, ...]
    // 例如 [0.5, 1.0] 表示：第1回合提升到目标值的50%，第2回合提升到100%
    // [1.0] 表示立即生效（无过渡）
    static readonly DYNAMIC_RULE_TRANSITION_STAGES: number[] = [0.5, 1.0];
    
    // 动态规则过渡状态（运行时变量）
    private static _dynamicRuleTargetRange: [number, number] | null = null;  // 目标指数范围
    private static _dynamicRuleBaseRange: [number, number] | null = null;    // 过渡开始时的基础范围
    private static _dynamicRuleCurrentStage: number = 0;                     // 当前阶段索引
    private static _lastUsedRange: [number, number] | null = null;           // 上一回合实际使用的范围（防止数值倒退）

    /**
     * 规则A：基础回合递增规则
     */
    static getBaseExponentRange(round: number): [number, number] {
        if (round <= 1) return [5, 6];       // 32-64
        if (round <= 2) return [6, 7];       // 32-128
        if (round <= 4) return [7, 8];       // 64-256
        if (round <= 6) return [7, 9];       // 128-512
        if (round <= 9) return [8, 10];     // 256-1024
        if (round <= 12) return [9, 11];     // 512-2048
        if (round <= 15) return [10, 12];    // 1024-4096
        if (round <= 18) return [11, 13];    // 2048-8192
        if (round <= 21) return [12, 14];    // 4096-16384
        
        const extraLevels = Math.floor((round - 21) / 5);
        const minExp = 13 + extraLevels;
        const maxExp = 15 + extraLevels;
        return [minExp, maxExp];
    }

    /**
     * 规则B：动态提升规则（计算目标范围）
     */
    static getDynamicExponentRange(pipeSum: number): [number, number] | null {
        if (pipeSum <= 0) return null;
        const n = Math.floor(Math.log2(pipeSum));
        return [n + 2, n + 3];
    }
    
    /**
     * 重置动态规则过渡状态（游戏重新开始时调用）
     */
    static resetDynamicRuleTransition() {
        this._dynamicRuleTargetRange = null;
        this._dynamicRuleBaseRange = null;
        this._dynamicRuleCurrentStage = 0;
        this._lastUsedRange = null;
    }
    
    /**
     * 推进动态规则过渡阶段（每回合结束时调用）
     */
    static advanceDynamicRuleStage() {
        if (this._dynamicRuleTargetRange !== null) {
            const stages = this.DYNAMIC_RULE_TRANSITION_STAGES;
            if (this._dynamicRuleCurrentStage < stages.length - 1) {
                this._dynamicRuleCurrentStage++;
            }
        }
    }

    /**
     * 获取本回合大球数值生成范围
     * 
     * 策略：
     * - 回合数 < DYNAMIC_RULE_START_ROUND：仅使用基础回合规则（规则A）
     * - 回合数 >= DYNAMIC_RULE_START_ROUND：取规则A和规则B中较高的值，并支持分阶段过渡
     * - 始终确保不会比上一回合的数值范围更低（防止数值倒退）
     */
    static getBigBallExponentRange(round: number, pipeSum: number): [number, number] {
        const baseRange = this.getBaseExponentRange(round);
        
        // 未达到动态规则生效回合，仅使用基础规则
        if (round < this.DYNAMIC_RULE_START_ROUND) {
            this._lastUsedRange = baseRange;
            return baseRange;
        }
        
        // 计算动态规则的目标范围
        const dynamicRange = this.getDynamicExponentRange(pipeSum);
        
        // 如果动态规则没有更高的值，使用基础规则（但不低于上次使用的范围）
        if (!dynamicRange || dynamicRange[0] <= baseRange[0]) {
            const result = this.ensureNoRegression(baseRange);
            this._lastUsedRange = result;
            return result;
        }
        
        // 检查是否需要开始新的过渡（目标范围提升了）
        if (this._dynamicRuleTargetRange === null || dynamicRange[0] > this._dynamicRuleTargetRange[0]) {
            // 新的更高目标，开始过渡
            // 关键修复：以「上一回合实际使用的范围」作为过渡起点，而不是旧目标
            this._dynamicRuleBaseRange = this._lastUsedRange || baseRange;
            this._dynamicRuleTargetRange = dynamicRange;
            this._dynamicRuleCurrentStage = 0;
        }
        
        // 计算当前阶段的实际范围
        const stages = this.DYNAMIC_RULE_TRANSITION_STAGES;
        const stageRatio = stages[Math.min(this._dynamicRuleCurrentStage, stages.length - 1)];
        
        const startRange = this._dynamicRuleBaseRange || baseRange;
        const targetRange = this._dynamicRuleTargetRange;
        
        const minExp = Math.round(startRange[0] + (targetRange[0] - startRange[0]) * stageRatio);
        const maxExp = Math.round(startRange[1] + (targetRange[1] - startRange[1]) * stageRatio);
        
        // 确保不低于基础规则，也不低于上次使用的范围
        const result: [number, number] = [
            Math.max(minExp, baseRange[0]),
            Math.max(maxExp, baseRange[1])
        ];
        
        const finalResult = this.ensureNoRegression(result);
        this._lastUsedRange = finalResult;
        return finalResult;
    }
    
    /**
     * 确保数值范围不会倒退（不低于上一回合使用的范围）
     */
    private static ensureNoRegression(range: [number, number]): [number, number] {
        if (this._lastUsedRange === null) {
            return range;
        }
        return [
            Math.max(range[0], this._lastUsedRange[0]),
            Math.max(range[1], this._lastUsedRange[1])
        ];
    }

    /**
     * 生成大球数值
     */
    static generateBigBallValue(round: number, pipeSum: number): number {
        const [minExp, maxExp] = this.getBigBallExponentRange(round, pipeSum);
        const exponent = minExp + Math.floor(Math.random() * (maxExp - minExp + 1));
        return Math.pow(2, exponent);
    }

    /**
     * 生成每层大球数量
     */
    /**
     * 生成每层大球数量（使用权重配置）
     * @param layerCapacity 层容量（4或5）
     * @param previousLayerBallCount 上一层的大球数量（用于判断是否需要提高最大数权重）
     */
    static generateBigBallCount(layerCapacity: number, previousLayerBallCount: number = -1): number {
        // 复制权重配置（避免修改原配置）
        const weights: { [count: number]: number } = layerCapacity === 4 ? 
            { ...this.LAYER_4_BALL_COUNT_WEIGHTS } : 
            { ...this.LAYER_5_BALL_COUNT_WEIGHTS };
        
        // 检查是否需要提高最大数权重
        const threshold = layerCapacity === 4 ? 
            this.LAYER_4_LOW_COUNT_THRESHOLD : 
            this.LAYER_5_LOW_COUNT_THRESHOLD;
        
        if (previousLayerBallCount >= 0 && previousLayerBallCount < threshold) {
            const maxCount = layerCapacity;
            weights[maxCount] = (weights[maxCount] || 0) + this.LOW_COUNT_MAX_WEIGHT_BOOST;
        }
        
        // 根据权重随机选择
        return this.weightedRandomSelect(weights);
    }
    
    /**
     * 根据权重随机选择
     * @param weights 权重配置 { 值: 权重 }
     * @returns 选中的值
     */
    private static weightedRandomSelect(weights: { [key: number]: number }): number {
        let totalWeight = 0;
        for (const key in weights) {
            totalWeight += weights[key];
        }
        
        let random = Math.random() * totalWeight;
        for (const keyStr in weights) {
            const key = parseInt(keyStr);
            const weight = weights[key];
            random -= weight;
            if (random <= 0) {
                return key;
            }
        }
        
        // 默认返回第一个键值（理论上不会执行到这里）
        return parseInt(Object.keys(weights)[0]);
    }
    
    /**
     * 获取当前回合对应的权重配置
     * 根据当前回合数找到最大的满足条件的阈值
     * 如果超过动态成长开始回合，则自动计算成长后的权重
     */
    static getCurrentWeights(): { [value: number]: number } {
        const round = this.currentRound;
        let bestThreshold = 1;
        
        // 找到最大的满足条件的阈值
        for (const thresholdStr in this.PENDING_BALL_VALUE_WEIGHTS) {
            const threshold = parseInt(thresholdStr);
            if (round >= threshold && threshold > bestThreshold) {
                bestThreshold = threshold;
            }
        }
        
        // 获取基础权重配置（复制一份，避免修改原配置）
        const baseWeights = { ...this.PENDING_BALL_VALUE_WEIGHTS[bestThreshold] };
        
        // 如果未达到动态成长开始回合，直接返回基础配置
        if (round < this.PENDING_BALL_GROWTH_START_ROUND) {
            return baseWeights;
        }
        
        // 计算已经成长了多少次
        const roundsAfterGrowthStart = round - this.PENDING_BALL_GROWTH_START_ROUND;
        const growthCount = Math.floor(roundsAfterGrowthStart / this.PENDING_BALL_GROWTH_INTERVAL);
        
        if (growthCount <= 0) {
            return baseWeights;
        }
        
        // 应用动态成长
        return this.applyDynamicGrowth(baseWeights, growthCount);
    }
    
    /**
     * 应用动态成长规则
     * @param baseWeights 基础权重配置
     * @param growthCount 成长次数
     * @returns 成长后的权重配置
     */
    private static applyDynamicGrowth(baseWeights: { [value: number]: number }, growthCount: number): { [value: number]: number } {
        const result: { [value: number]: number } = {};
        const growthWeights = this.PENDING_BALL_GROWTH_WEIGHTS;
        const maxGrowthWeight = growthWeights[growthWeights.length - 1];
        
        // 获取基础配置中的所有数值，并排序
        const baseValues = Object.keys(baseWeights).map(v => parseInt(v)).sort((a, b) => a - b);
        const maxBaseValue = baseValues[baseValues.length - 1];
        
        // 计算需要新增多少个更大的数值
        // 每次成长新增1个数值
        const newValuesCount = growthCount;
        
        // 生成新的数值列表（在最大值基础上翻倍）
        const allValues = [...baseValues];
        let nextValue = maxBaseValue * 2;
        for (let i = 0; i < newValuesCount; i++) {
            allValues.push(nextValue);
            nextValue *= 2;
        }
        
        // 为每个数值计算权重
        // 原有数值：根据成长次数提升权重等级
        // 新增数值：根据其"年龄"（被添加后经过的成长次数）分配权重
        for (let i = 0; i < allValues.length; i++) {
            const value = allValues[i];
            const isNewValue = baseValues.indexOf(value) === -1;
            
            if (!isNewValue) {
                // 原有数值：找到它在基础配置中的位置，然后根据成长次数提升
                const originalIndex = baseValues.indexOf(value);
                // 成长后，该数值的权重等级提升 growthCount 级
                // 权重等级 = 原始等级 + 成长次数，但不超过最大等级
                const newIndex = Math.min(originalIndex + growthCount, baseValues.length - 1);
                const targetValue = baseValues[newIndex];
                result[value] = baseWeights[targetValue];
            } else {
                // 新增数值：计算它是第几个新增的数值
                const newValueIndex = allValues.indexOf(value) - baseValues.length;
                // 计算这个新数值已经存在了多少次成长周期
                const ageInGrowthCycles = growthCount - newValueIndex - 1;
                
                if (ageInGrowthCycles < 0) {
                    // 这个数值还没被添加（理论上不会发生）
                    continue;
                }
                
                // 根据年龄从 growthWeights 中获取权重
                const weightIndex = Math.min(ageInGrowthCycles, growthWeights.length - 1);
                result[value] = growthWeights[weightIndex];
            }
        }
        
        return result;
    }
    
    /**
     * 生成待获得小球的数值（基于权重）
     */
    static generatePendingBallValue(): number {
        const weights = this.getCurrentWeights();
        
        // 计算权重总和
        let totalWeight = 0;
        for (const value in weights) {
            totalWeight += weights[value];
        }
        
        // 随机选择
        let random = Math.random() * totalWeight;
        for (const valueStr in weights) {
            const value = parseInt(valueStr);
            const weight = weights[value];
            random -= weight;
            if (random <= 0) {
                return value;
            }
        }
        
        // 默认返回最小值（理论上不会执行到这里）
        return 2;
    }
}
