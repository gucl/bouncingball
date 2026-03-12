import { _decorator, Component, Node, director, PhysicsSystem2D } from 'cc';
import { GameConfig } from './GameConfig';
import { BallManager } from './BallManager';
import { PipeDisplay } from './PipeDisplay';
import { IdleSlotDisplay } from './IdleSlotDisplay';
import { PipeAnimator } from './PipeAnimator';
import { ScoreDisplay } from './ScoreDisplay';
import { ItemManager } from './ItemManager';

const { ccclass, property } = _decorator;

export enum GameState {
    READY,
    LAUNCHING,
    WAITING,
    MERGING,
    PROCESSING_IDLE,  // 处理闲置位回收
    PAUSED,
    GAME_OVER
}

@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager = null;
    public static get instance(): GameManager {
        return this._instance;
    }

    @property(Node)
    gameArea: Node = null;

    @property(Node)
    wallsNode: Node = null;

    @property(Node)
    pipeNode: Node = null;

    @property(Node)
    launcherNode: Node = null;

    @property(Node)
    collisionAreaNode: Node = null;

    @property(Node)
    smallBallsNode: Node = null;

    @property(Node)
    uiNode: Node = null;

    @property(Node)
    popupsNode: Node = null;

    @property(Node)
    idleSlotNode: Node = null;

    @property(Node)
    pipeAnimatorNode: Node = null;
    
    @property(Node)
    scoreDisplayNode: Node = null;

    private _pipeDisplay: PipeDisplay = null;
    private _idleSlotDisplay: IdleSlotDisplay = null;
    private _pipeAnimator: PipeAnimator = null;
    private _scoreDisplay: ScoreDisplay = null;
    
    // 回收动画相关
    private _pendingRecycleAnimations: number = 0;  // 正在播放的回收动画数量
    private _gameState: GameState = GameState.READY;
    private _currentRound: number = 1;
    private _totalScore: number = 0;
    private _maxBallValue: number = 0;
    private _pipeCapacity: number = GameConfig.INITIAL_PIPE_CAPACITY;
    private _pipeBalls: number[] = [];
    
    // 回合内发射状态追踪
    private _ballsToLaunchThisRound: number = 0;  // 本回合需要发射的小球数量
    private _ballsLaunchedThisRound: number = 0;  // 本回合已发射的小球数量
    
    // 闲置位：暂存本回合激活并回收的待获得小球
    private _idleSlotBalls: number[] = [];
    
    // 游戏加速相关
    private _launchStartTime: number = 0;           // 发射开始时间
    private _currentSpeedMultiplier: number = 1;    // 当前速度倍数

    public get gameState(): GameState { return this._gameState; }
    public get currentRound(): number { return this._currentRound; }
    public get totalScore(): number { return this._totalScore; }
    public get maxBallValue(): number { return this._maxBallValue; }
    public get pipeCapacity(): number { return this._pipeCapacity; }
    public get pipeBalls(): number[] { return this._pipeBalls; }
    public get idleSlotBalls(): number[] { return this._idleSlotBalls; }

    public get pipeSum(): number {
        return this._pipeBalls.reduce((sum, val) => sum + val, 0);
    }
    
    public get pendingRecycleAnimations(): number {
        return this._pendingRecycleAnimations;
    }
    
    // 获取本回合待发射的小球数量
    public get ballsToLaunchThisRound(): number { return this._ballsToLaunchThisRound; }
    public get ballsLaunchedThisRound(): number { return this._ballsLaunchedThisRound; }

    onLoad() {
        if (GameManager._instance) {
            this.destroy();
            return;
        }
        GameManager._instance = this;
    }

    start() {
        // 获取 PipeDisplay 组件
        if (this.pipeNode) {
            this._pipeDisplay = this.pipeNode.getComponent(PipeDisplay);
        }
        
        // 获取 IdleSlotDisplay 组件
        if (this.idleSlotNode) {
            this._idleSlotDisplay = this.idleSlotNode.getComponent(IdleSlotDisplay);
        }
        
        // 获取 PipeAnimator 组件
        if (this.pipeAnimatorNode) {
            this._pipeAnimator = this.pipeAnimatorNode.getComponent(PipeAnimator);
            if (this._pipeAnimator && this._pipeDisplay) {
                this._pipeAnimator.setPipeDisplay(this._pipeDisplay);
            }
        }
        
        // 获取 ScoreDisplay 组件
        if (this.scoreDisplayNode) {
            this._scoreDisplay = this.scoreDisplayNode.getComponent(ScoreDisplay);
        }
        
        this.initGame();
    }

    onDestroy() {
        if (GameManager._instance === this) {
            GameManager._instance = null;
        }
        // 恢复正常游戏速度
        this.resetGameSpeed();
    }
    
    update(deltaTime: number) {
        // 在等待小球回收状态时，检测并更新游戏速度
        if (this._gameState === GameState.WAITING || this._gameState === GameState.LAUNCHING) {
            this.updateGameSpeed();
            
            // 如果有加速，手动执行额外的物理步进
            if (this._currentSpeedMultiplier > 1) {
                const physicsSystem = PhysicsSystem2D.instance;
                if (physicsSystem) {
                    // 手动执行 (multiplier - 1) 次额外的物理步进
                    // 因为引擎已经执行了 1 次，我们需要额外执行 (multiplier - 1) 次
                    const extraSteps = this._currentSpeedMultiplier - 1;
                    for (let i = 0; i < extraSteps; i++) {
                        physicsSystem.step(physicsSystem.fixedTimeStep);
                    }
                }
            }
        }
    }
    
    /**
     * 更新游戏速度（根据发射后经过的时间）
     */
    private updateGameSpeed() {
        if (this._launchStartTime <= 0) return;
        
        const elapsedTime = (Date.now() - this._launchStartTime) / 1000;
        const newMultiplier = GameConfig.getGameSpeedMultiplier(elapsedTime);
        
        if (newMultiplier !== this._currentSpeedMultiplier) {
            this._currentSpeedMultiplier = newMultiplier;
            this.applyGameSpeed(newMultiplier);
        }
    }
    
    /**
     * 应用游戏速度
     */
    private applyGameSpeed(multiplier: number) {
        // 只修改调度器时间缩放（影响 schedule、tween 等）
        // 物理加速通过 update 中手动步进实现
        director.getScheduler().setTimeScale(multiplier);
    }
    
    /**
     * 重置游戏速度为正常
     */
    private resetGameSpeed() {
        this._currentSpeedMultiplier = 1;
        this._launchStartTime = 0;
        
        // 恢复调度器时间缩放
        director.getScheduler().setTimeScale(1);
    }

    initGame() {
        this._gameState = GameState.READY;
        this._currentRound = 1;
        // 更新GameConfig中的当前回合数，用于待获得小球权重计算
        GameConfig.currentRound = this._currentRound;
        this._totalScore = 0;
        this._maxBallValue = 0;
        this._pipeCapacity = GameConfig.INITIAL_PIPE_CAPACITY;
        this._pipeBalls = [...GameConfig.INITIAL_SMALL_BALLS];
        
        // 重置回合发射状态
        this._ballsToLaunchThisRound = 0;
        this._ballsLaunchedThisRound = 0;
        
        // 清空闲置位
        this._idleSlotBalls = [];
        
        // 重置动画计数
        this._pendingRecycleAnimations = 0;
        
        // 重置游戏速度
        this.resetGameSpeed();
        
        // 重置待获得小球产出概率加成
        GameConfig.resetSpawnChanceBonus();
        
        // 重置动态规则过渡状态
        GameConfig.resetDynamicRuleTransition();

        this.updateMaxBallValue();
        this.generateInitialBigBalls();
        this.updatePipeDisplay();
        this.updateIdleSlotDisplay();
    }
    
    private updatePipeDisplay() {
        if (this._pipeDisplay) {
            this._pipeDisplay.updateDisplay();
        }
    }
    
    private updateIdleSlotDisplay() {
        if (this._idleSlotDisplay) {
            this._idleSlotDisplay.updateDisplay();
        }
    }

    private generateInitialBigBalls() {
        this.scheduleOnce(() => {
            const ballManager = BallManager.instance;
            if (ballManager) {
                ballManager.generateInitialBigBalls();
            }
        }, 0.1);
    }

    setGameState(state: GameState) {
        const prevState = this._gameState;
        this._gameState = state;

        // 通知 ItemManager 状态变化
        const itemManager = ItemManager.instance;
        if (itemManager) {
            itemManager.onGameStateChanged(prevState, state);
        }

        switch (state) {
            case GameState.GAME_OVER:
                this.onGameOver();
                break;
        }
    }

    addBallToPipe(value: number) {
        if (this._pipeBalls.length < this._pipeCapacity) {
            this._pipeBalls.push(value);
            this.updateMaxBallValue();
            this.updatePipeDisplay();
        }
    }

    /**
     * 开始发射回合
     * 记录本回合需要发射的小球数量，防止回收的球被重新发射
     */
    startLaunchRound(): number {
        // 清空上一回合剩余的闲置位小球（玩家已经开始发射，不再有机会看广告增加容量）
        this.clearIdleSlot();
        
        this._ballsToLaunchThisRound = this._pipeBalls.length;
        this._ballsLaunchedThisRound = 0;
        
        // 记录发射开始时间，用于游戏加速
        this._launchStartTime = Date.now();
        // 重置游戏速度为1倍
        this.resetGameSpeed();
        this._launchStartTime = Date.now(); // resetGameSpeed会清零，需要重新设置
        
        // 启动一键收球倒计时
        const itemManager = ItemManager.instance;
        if (itemManager) {
            itemManager.startQuickRecallTimer();
        }
        
        return this._ballsToLaunchThisRound;
    }

    /**
     * 弹出第一个小球（发射口的球）
     * 只有在还有待发射的球时才弹出
     */
    popFirstBall(): number | null {
        if (this._ballsLaunchedThisRound >= this._ballsToLaunchThisRound) {
            return null;
        }
        
        if (this._pipeBalls.length === 0) {
            return null;
        }
        
        const value = this._pipeBalls.shift();
        this._ballsLaunchedThisRound++;
        this.updatePipeDisplay();
        return value;
    }

    /**
     * 检查本回合是否还有待发射的球
     */
    hasMoreBallsToLaunch(): boolean {
        return this._ballsLaunchedThisRound < this._ballsToLaunchThisRound;
    }

    /**
     * 回收小球到管道（带动画）
     * 这是从管道发射出去的小球回收
     * @param value 小球数值
     * @param startX 小球起始X坐标
     * @param startY 小球起始Y坐标（底部墙壁位置）
     */
    recycleBallWithAnimation(value: number, startX: number, startY: number) {
        if (this._pipeAnimator && this._pipeBalls.length + this._pendingRecycleAnimations < this._pipeCapacity) {
            // 计算目标索引：当前管道长度 + 正在播放动画的数量（预留位置）
            const targetIndex = this._pipeBalls.length + this._pendingRecycleAnimations;
            this._pendingRecycleAnimations++;
            this._pipeAnimator.playRecycleAnimation(startX, startY, value, targetIndex, () => {
                this.addBallToPipe(value);
                this._pendingRecycleAnimations--;
                this.checkAllRecycleAnimationsComplete();
            });
        } else {
            // 没有动画器或管道已满，直接添加
            this.addBallToPipe(value);
        }
    }
    
    /**
     * 回收小球到管道（无动画，直接添加）
     * 这是从管道发射出去的小球回收
     */
    recycleBall(value: number) {
        this.addBallToPipe(value);
    }
    
    /**
     * 回收待获得小球到闲置位（带动画）
     * 待获得小球（从大球消灭后产生的）回收到闲置位，等回合结束后再进入管道
     * @param value 小球数值
     * @param startX 小球起始X坐标
     * @param startY 小球起始Y坐标
     */
    recyclePendingBallToIdleSlotWithAnimation(value: number, startX: number, startY: number) {
        // 待获得小球直接加入闲置位，不播放动画（因为它们不是从底部回收的）
        this._idleSlotBalls.push(value);
        this.updateIdleSlotDisplay();
    }
    
    /**
     * 回收待获得小球到闲置位（无动画）
     */
    recyclePendingBallToIdleSlot(value: number) {
        this._idleSlotBalls.push(value);
        this.updateIdleSlotDisplay();
    }
    
    /**
     * 检查所有回收动画是否完成
     */
    private checkAllRecycleAnimationsComplete() {
        // 由 BallManager 来检查是否所有球都回收完成
    }
    
    /**
     * 从闲置位移动一个小球到管道
     * @returns 是否成功移动
     */
    moveOneFromIdleSlotToPipe(): boolean {
        if (this._idleSlotBalls.length === 0) {
            return false;
        }
        
        if (this._pipeBalls.length >= this._pipeCapacity) {
            return false;
        }
        
        const value = this._idleSlotBalls.shift();
        this._pipeBalls.push(value);
        this.updateMaxBallValue();
        this.updatePipeDisplay();
        this.updateIdleSlotDisplay();
        return true;
    }
    
    /**
     * 清空闲置位（下一回合开始时调用）
     */
    clearIdleSlot() {
        this._idleSlotBalls = [];
        this.updateIdleSlotDisplay();
    }
    
    /**
     * 检查管道是否有空位
     */
    hasPipeSpace(): boolean {
        return this._pipeBalls.length < this._pipeCapacity;
    }
    
    /**
     * 检查闲置位是否有小球
     */
    hasIdleSlotBalls(): boolean {
        return this._idleSlotBalls.length > 0;
    }

    checkAndMerge(): boolean {
        let merged = false;
        
        for (let i = 0; i < this._pipeBalls.length - 1; i++) {
            if (this._pipeBalls[i] === this._pipeBalls[i + 1]) {
                const newValue = this._pipeBalls[i] * 2;
                this._pipeBalls.splice(i, 2, newValue);
                merged = true;
                
                if (newValue >= GameConfig.AD_TRIGGER_VALUE) {
                    this.triggerMergeAd(newValue);
                }
                
                this.updateMaxBallValue();
                this.updatePipeDisplay();
                return this.checkAndMerge() || true;
            }
        }
        
        return merged;
    }

    private triggerMergeAd(value: number) {
        // TODO: 实现广告逻辑
    }

    private updateMaxBallValue() {
        const currentMax = Math.max(...this._pipeBalls, 0);
        if (currentMax > this._maxBallValue) {
            this._maxBallValue = currentMax;
        }
    }

    addScore(points: number) {
        this._totalScore += points;
    }

    /**
     * 回合结束，进入下一回合
     * 流程：
     * 1. 从闲置位回收小球到管道（直到管道满）
     * 2. 合成检测
     * 3. 若合成后有空位，继续从闲置位回收
     * 4. 重复1-3直到管道满且无法合成，或闲置位为空
     * 5. 清空闲置位剩余小球
     * 6. 大球上移 -> 生成新大球 -> 准备发射
     */
    nextRound() {
        // 重置发射状态
        this._ballsToLaunchThisRound = 0;
        this._ballsLaunchedThisRound = 0;
        
        // 重置游戏速度为正常
        this.resetGameSpeed();
        
        // 重置一键收球状态
        const itemManager = ItemManager.instance;
        if (itemManager) {
            itemManager.resetQuickRecall();
            itemManager.updateButtonStates();
        }
        
        // 进入闲置位处理状态
        this.setGameState(GameState.PROCESSING_IDLE);
        
        // 开始闲置位回收和合成循环
        this.processIdleSlotAndMerge();
    }
    
    /**
     * 处理闲置位回收和合成的循环
     * @param proceedToNextRoundOnComplete 完成后是否进入下一回合（默认true）
     */
    private processIdleSlotAndMerge(proceedToNextRoundOnComplete: boolean = true) {
        // 1. 从闲置位回收小球到管道（带动画）
        this.processIdleSlotRecycleWithAnimation(() => {
            // 2. 进行合成（带动画）
            this.setGameState(GameState.MERGING);
            this.processMergeWithAnimation(() => {
                // 3. 如果闲置位还有球且管道有空位，继续循环
                if (this.hasIdleSlotBalls() && this.hasPipeSpace()) {
                    this.processIdleSlotAndMerge(proceedToNextRoundOnComplete);
                    return;
                }
                
                // 4. 闲置位处理完成（可能还有剩余小球，但管道已满）
                if (proceedToNextRoundOnComplete) {
                    // 正常回合结束流程：进入下一回合
                    // 注意：不清空闲置位，保留到下一回合发射前，让玩家有机会看广告
                    this.proceedToNextRound();
                } else {
                    // 看广告增加容量后的处理，恢复READY状态
                    this.setGameState(GameState.READY);
                }
            });
        });
    }
    
    /**
     * 处理闲置位小球回收动画（批量处理）
     */
    private processIdleSlotRecycleWithAnimation(onComplete: () => void) {
        if (!this.hasIdleSlotBalls() || !this.hasPipeSpace()) {
            onComplete();
            return;
        }
        
        // 计算可以进入管道的小球数量
        const availableSpace = this._pipeCapacity - this._pipeBalls.length;
        const ballsToMove = Math.min(availableSpace, this._idleSlotBalls.length);
        
        if (ballsToMove <= 0) {
            onComplete();
            return;
        }
        
        // 获取闲置位位置
        const idleSlotX = GameConfig.PIPE_CORNER_X;
        const idleSlotY = this._idleSlotDisplay ? 
            (this._idleSlotDisplay as any).posY || -480 : -480;
        
        // 取出要移动的小球
        const ballsValues: number[] = [];
        const startIndex = this._pipeBalls.length;
        for (let i = 0; i < ballsToMove; i++) {
            ballsValues.push(this._idleSlotBalls.shift());
        }
        this.updateIdleSlotDisplay();
        
        if (this._pipeAnimator) {
            // 批量播放动画
            this._pipeAnimator.playBatchIdleSlotRecycleAnimation(
                idleSlotX, 
                idleSlotY, 
                ballsValues, 
                startIndex, 
                () => {
                    // 动画完成后，将所有小球添加到管道
                    for (const value of ballsValues) {
                        this._pipeBalls.push(value);
                    }
                    this.updateMaxBallValue();
                    this.updatePipeDisplay();
                    onComplete();
                }
            );
        } else {
            // 没有动画器，直接添加
            for (const value of ballsValues) {
                this._pipeBalls.push(value);
            }
            this.updateMaxBallValue();
            this.updatePipeDisplay();
            onComplete();
        }
    }
    
    /**
     * 处理合成动画
     */
    private processMergeWithAnimation(onComplete: () => void) {
        if (this._pipeAnimator) {
            this._pipeAnimator.playMergeAnimations(() => {
                this.updatePipeDisplay();
                onComplete();
            });
        } else {
            // 没有动画器，使用原来的合成逻辑
            this.checkAndMerge();
            onComplete();
        }
    }
    
    /**
     * 正式进入下一回合
     */
    private proceedToNextRound() {
        this._currentRound++;
        // 更新GameConfig中的当前回合数，用于待获得小球权重计算
        GameConfig.currentRound = this._currentRound;
        
        // 推进动态规则过渡阶段
        GameConfig.advanceDynamicRuleStage();

        if (this.checkGameOver()) {
            this.setGameState(GameState.GAME_OVER);
            return;
        }

        // 大球上移，如果触发游戏结束则停止
        if (this.moveBigBallsUp()) {
            return;
        }
        
        this.generateNewBigBallLayer();
        this.setGameState(GameState.READY);
    }

    private moveBigBallsUp(): boolean {
        const ballManager = BallManager.instance;
        if (ballManager) {
            const gameOver = ballManager.moveAllBigBallsUp();
            if (gameOver) {
                this.setGameState(GameState.GAME_OVER);
                return true;
            }
        }
        return false;
    }

    private generateNewBigBallLayer() {
        const ballManager = BallManager.instance;
        if (ballManager) {
            ballManager.generateBigBallLayer(1, this._currentRound, this.pipeSum);
        }
    }

    private checkGameOver(): boolean {
        const ballManager = BallManager.instance;
        if (ballManager) {
            return ballManager.checkGameOver();
        }
        return false;
    }

    private onGameOver() {
        console.log(`游戏结束！最终分数: ${this._totalScore}, 最大小球: ${this._maxBallValue}`);
    }

    /**
     * 增加管道容量（看广告奖励）
     * 增加后如果闲置位有小球，会尝试回收并合成
     * @returns 是否成功增加（已达到最大容量时返回false）
     */
    increasePipeCapacity(): boolean {
        // 检查是否已达到最大容量
        if (this._pipeCapacity >= GameConfig.MAX_PIPE_CAPACITY) {
            return false;
        }
        
        this._pipeCapacity += GameConfig.PIPE_CAPACITY_INCREASE;
        
        // 确保不超过最大容量
        if (this._pipeCapacity > GameConfig.MAX_PIPE_CAPACITY) {
            this._pipeCapacity = GameConfig.MAX_PIPE_CAPACITY;
        }
        
        // 如果闲置位有小球且当前是READY状态，尝试回收并合成
        // 传入false表示不清空闲置位，处理完后恢复READY状态
        if (this.hasIdleSlotBalls() && this._gameState === GameState.READY) {
            this.setGameState(GameState.PROCESSING_IDLE);
            this.processIdleSlotAndMerge(false);
        }
        
        return true;
    }
    
    /**
     * 检查是否可以增加管道容量
     */
    canIncreasePipeCapacity(): boolean {
        return this._pipeCapacity < GameConfig.MAX_PIPE_CAPACITY;
    }

    // ==================== 道具相关方法 ====================
    
    private _isBombMode: boolean = false;
    
    public get isBombMode(): boolean {
        return this._isBombMode;
    }

    /**
     * 进入炸弹球模式
     */
    enterBombMode() {
        if (this._gameState !== GameState.READY) return;
        this._isBombMode = true;
    }

    /**
     * 退出炸弹球模式
     */
    exitBombMode() {
        this._isBombMode = false;
    }

    /**
     * 整理管道 - 按数值从大到小排序，然后触发合成
     */
    sortPipeBalls() {
        if (this._gameState !== GameState.READY) return;
        
        // 按数值从大到小排序
        this._pipeBalls.sort((a, b) => b - a);
        
        this.updatePipeDisplay();
        
        // 进入合成处理状态
        this.setGameState(GameState.PROCESSING_IDLE);
        this.processIdleSlotAndMerge(false);
    }
}
