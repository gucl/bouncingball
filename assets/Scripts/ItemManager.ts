import { _decorator, Component, Node, Vec3, Vec2, Prefab, instantiate, tween, Tween, Color, Sprite, Label, UITransform, sys } from 'cc';
import { GameConfig } from './GameConfig';
import { GameManager, GameState } from './GameManager';
import { BallManager } from './BallManager';
import { SmallBall, SmallBallState } from './SmallBall';
import { PipeDisplay } from './PipeDisplay';

const { ccclass, property } = _decorator;

/**
 * 道具类型枚举
 */
export enum ItemType {
    BOMB = 'bomb',
    DOUBLE = 'double',
    LASER = 'laser',
    SORT_PIPE = 'sortPipe'
}

/**
 * 道具管理器 - 管理所有道具的使用和效果
 */
@ccclass('ItemManager')
export class ItemManager extends Component {
    private static _instance: ItemManager = null;
    public static get instance(): ItemManager { return ItemManager._instance; }

    // ==================== 一键收球相关 ====================
    @property({ type: Node, tooltip: '一键收球按钮节点' })
    quickRecallButton: Node = null;

    @property({ type: Label, tooltip: '一键收球倒计时文本' })
    quickRecallLabel: Label = null;

    private _quickRecallTimer: number = 0;
    private _isQuickRecallAvailable: boolean = false;

    // ==================== 炸弹球相关 ====================
    @property({ type: Prefab, tooltip: '炸弹球预制体' })
    bombBallPrefab: Prefab = null;

    @property({ type: Node, tooltip: '炸弹球按钮节点' })
    bombButton: Node = null;

    @property({ type: Label, tooltip: '炸弹球数量/广告显示标签' })
    bombCountLabel: Label = null;

    @property({ type: Node, tooltip: '发射口炸弹显示节点（放在发射口位置，默认隐藏）' })
    launcherBombDisplay: Node = null;

    // ==================== 翻倍球相关 ====================
    @property({ type: Prefab, tooltip: '翻倍球预制体' })
    doubleBallPrefab: Prefab = null;

    @property({ type: Node, tooltip: '翻倍球按钮节点' })
    doubleButton: Node = null;

    @property({ type: Label, tooltip: '翻倍球数量/广告显示标签' })
    doubleCountLabel: Label = null;

    @property({ type: Node, tooltip: '翻倍球容器节点' })
    doubleBallContainer: Node = null;

    private _activeDoubleBalls: Node[] = [];
    private _doubleBallTargetPositions: Vec3[] = [];  // 记录翻倍球的目标位置（包括飞行中的）

    // ==================== 激光相关 ====================
    @property({ type: Node, tooltip: '激光按钮节点' })
    laserButton: Node = null;

    @property({ type: Label, tooltip: '激光数量/广告显示标签' })
    laserCountLabel: Label = null;

    @property({ type: Node, tooltip: '激光效果节点' })
    laserEffectNode: Node = null;

    // ==================== 整理管道相关 ====================
    @property({ type: Node, tooltip: '整理管道按钮节点' })
    sortPipeButton: Node = null;

    @property({ type: Label, tooltip: '整理管道数量/广告显示标签' })
    sortPipeCountLabel: Label = null;

    // ==================== 增加管道容量相关 ====================
    @property({ type: Node, tooltip: '增加管道容量按钮节点（会跟随管道末尾移动）' })
    addCapacityButton: Node = null;

    @property({ type: Label, tooltip: '当前管道容量显示' })
    capacityLabel: Label = null;

    @property({ type: Node, tooltip: 'PipeDisplay所在节点（用于获取管道位置）' })
    pipeDisplayNode: Node = null;

    private _pipeDisplay: PipeDisplay = null;

    // ==================== 道具数量 ====================
    private _itemCounts: { [key: string]: number } = {
        [ItemType.BOMB]: 0,
        [ItemType.DOUBLE]: 0,
        [ItemType.LASER]: 0,
        [ItemType.SORT_PIPE]: 0
    };

    // 本地存储键名
    private static readonly STORAGE_KEY = 'item_counts';

    onLoad() {
        ItemManager._instance = this;
        this.loadItemCounts();
    }

    onDestroy() {
        if (ItemManager._instance === this) {
            ItemManager._instance = null;
        }
    }

    start() {
        // 获取 PipeDisplay 组件
        if (this.pipeDisplayNode) {
            this._pipeDisplay = this.pipeDisplayNode.getComponent(PipeDisplay);
        }

        this.initButtons();
        this.updateQuickRecallUI();
        this.updateCapacityUI();
        this.updateAllItemCountUI();
        this.updateAddCapacityButtonPosition();
    }

    // ==================== 道具数量管理 ====================

    /**
     * 从本地存储加载道具数量
     */
    private loadItemCounts() {
        try {
            const data = sys.localStorage.getItem(ItemManager.STORAGE_KEY);
            if (data) {
                const counts = JSON.parse(data);
                for (const key in counts) {
                    if (this._itemCounts.hasOwnProperty(key)) {
                        this._itemCounts[key] = counts[key] || 0;
                    }
                }
            } else {
                // 没有存储数据，使用初始配置
                const initialCounts = GameConfig.INITIAL_ITEM_COUNTS;
                this._itemCounts[ItemType.BOMB] = initialCounts.bomb || 0;
                this._itemCounts[ItemType.DOUBLE] = initialCounts.double || 0;
                this._itemCounts[ItemType.LASER] = initialCounts.laser || 0;
                this._itemCounts[ItemType.SORT_PIPE] = initialCounts.sortPipe || 0;
                this.saveItemCounts();
            }
        } catch (e) {
            console.error('[ItemManager] 加载道具数量失败:', e);
        }
    }

    /**
     * 保存道具数量到本地存储
     */
    private saveItemCounts() {
        try {
            sys.localStorage.setItem(ItemManager.STORAGE_KEY, JSON.stringify(this._itemCounts));
        } catch (e) {
            console.error('[ItemManager] 保存道具数量失败:', e);
        }
    }

    /**
     * 获取道具数量
     */
    public getItemCount(itemType: ItemType): number {
        return this._itemCounts[itemType] || 0;
    }

    /**
     * 增加道具数量
     */
    public addItemCount(itemType: ItemType, count: number = 1) {
        this._itemCounts[itemType] = (this._itemCounts[itemType] || 0) + count;
        this.saveItemCounts();
        this.updateItemCountUI(itemType);
    }

    /**
     * 消耗道具数量
     * @returns 是否成功消耗
     */
    public consumeItem(itemType: ItemType): boolean {
        if (this._itemCounts[itemType] > 0) {
            this._itemCounts[itemType]--;
            this.saveItemCounts();
            this.updateItemCountUI(itemType);
            return true;
        }
        return false;
    }

    /**
     * 更新所有道具数量UI
     */
    private updateAllItemCountUI() {
        this.updateItemCountUI(ItemType.BOMB);
        this.updateItemCountUI(ItemType.DOUBLE);
        this.updateItemCountUI(ItemType.LASER);
        this.updateItemCountUI(ItemType.SORT_PIPE);
    }

    /**
     * 更新单个道具数量UI
     * 数量为0时显示广告图标文字，数量>=1时显示数量
     */
    private updateItemCountUI(itemType: ItemType) {
        let label: Label = null;

        switch (itemType) {
            case ItemType.BOMB:
                label = this.bombCountLabel;
                break;
            case ItemType.DOUBLE:
                label = this.doubleCountLabel;
                break;
            case ItemType.LASER:
                label = this.laserCountLabel;
                break;
            case ItemType.SORT_PIPE:
                label = this.sortPipeCountLabel;
                break;
        }

        if (!label) return;

        const count = this._itemCounts[itemType] || 0;
        if (count > 0) {
            label.string = count.toString();
        } else {
            label.string = '广告';
        }
    }

    update(deltaTime: number) {
        this.updateQuickRecallTimer(deltaTime);
    }

    private initButtons() {
        // 初始化按钮状态
        this.updateButtonStates();

        // 确保发射口炸弹显示默认隐藏
        if (this.launcherBombDisplay) {
            this.launcherBombDisplay.active = false;
        }
    }

    // ==================== 按钮状态更新 ====================

    public updateButtonStates() {
        const gm = GameManager.instance;
        const isReady = gm?.gameState === GameState.READY;
        const isBombMode = gm?.isBombMode || false;

        // 炸弹、翻倍、激光、整理管道只能在准备状态使用
        // 炸弹模式下，炸弹按钮置灰
        if (this.bombButton) {
            this.setBombButtonEnabled(isReady && !isBombMode);
        }
        if (this.doubleButton) {
            this.setDoubleButtonEnabled(isReady && !isBombMode);
        }
        if (this.laserButton) {
            this.setLaserButtonEnabled(isReady && !isBombMode);
        }
        if (this.sortPipeButton) {
            this.setSortPipeButtonEnabled(isReady && !isBombMode);
        }

        // 增加管道容量按钮：只在READY状态且未达到最大容量时可用
        if (this.addCapacityButton) {
            const canIncrease = gm?.canIncreasePipeCapacity() || false;
            this.setAddCapacityButtonEnabled(isReady && !isBombMode && canIncrease);
        }

        // 更新容量显示
        this.updateCapacityUI();
    }

    private setBombButtonEnabled(enabled: boolean) {
        if (this.bombButton) {
            const sprite = this.bombButton.getComponent(Sprite);
            if (sprite) {
                sprite.color = enabled ? Color.WHITE : new Color(255, 87, 34, 255);
            }
        }
    }

    private setDoubleButtonEnabled(enabled: boolean) {
        if (this.doubleButton) {
            const sprite = this.doubleButton.getComponent(Sprite);
            if (sprite) {
                sprite.color = enabled ? Color.WHITE : new Color(255, 215, 0, 255);
            }
        }
    }

    private setLaserButtonEnabled(enabled: boolean) {
        if (this.laserButton) {
            const sprite = this.laserButton.getComponent(Sprite);
            if (sprite) {
                sprite.color = enabled ? Color.WHITE : new Color(33, 150, 243, 255);
            }
        }
    }

    private setSortPipeButtonEnabled(enabled: boolean) {
        if (this.sortPipeButton) {
            const sprite = this.sortPipeButton.getComponent(Sprite);
            if (sprite) {
                sprite.color = enabled ? Color.WHITE : new Color(156, 39, 176, 255);
            }
        }
    }

    private setAddCapacityButtonEnabled(enabled: boolean) {
        if (this.addCapacityButton) {
            const sprite = this.addCapacityButton.getComponent(Sprite);
            if (sprite) {
                sprite.color = enabled ? Color.WHITE : new Color(128, 128, 128, 255);
            }
        }
    }

    // ==================== 一键收球功能 ====================

    /**
     * 开始一键收球倒计时（在发射小球时调用）
     */
    public startQuickRecallTimer() {
        this._quickRecallTimer = GameConfig.QUICK_RECALL_COOLDOWN;
        this._isQuickRecallAvailable = false;
        this.updateQuickRecallUI();
    }

    /**
     * 重置一键收球状态（在回合结束时调用）
     */
    public resetQuickRecall() {
        this._quickRecallTimer = 0;
        this._isQuickRecallAvailable = false;
        this.updateQuickRecallUI();
    }

    private updateQuickRecallTimer(deltaTime: number) {
        // 只在倒计时进行中才更新
        if (this._quickRecallTimer > 0) {
            this._quickRecallTimer -= deltaTime;

            if (this._quickRecallTimer <= 0) {
                this._quickRecallTimer = 0;
                this._isQuickRecallAvailable = true;
            }

            this.updateQuickRecallUI();
        }
    }

    /**
     * 游戏状态变化时的回调（由 GameManager 调用）
     */
    public onGameStateChanged(prevState: GameState, newState: GameState) {
        const wasWaiting = prevState === GameState.WAITING || prevState === GameState.LAUNCHING;
        const isWaiting = newState === GameState.WAITING || newState === GameState.LAUNCHING;

        // 从等待状态变为非等待状态时，清空倒计时
        if (wasWaiting && !isWaiting) {
            this._quickRecallTimer = 0;
            this._isQuickRecallAvailable = false;
            this.updateQuickRecallUI();
        }

        // 更新按钮状态
        this.updateButtonStates();
    }

    private updateQuickRecallUI() {
        if (!this.quickRecallLabel) return;

        const gameState = GameManager.instance?.gameState;
        const isWaiting = gameState === GameState.WAITING || gameState === GameState.LAUNCHING;

        if (!isWaiting) {
            this.quickRecallLabel.node.active = false;
            if (this.quickRecallButton) {
                const sprite = this.quickRecallButton.getComponent(Sprite);
                if (sprite) sprite.color = new Color(76, 175, 80, 255);
            }
            return;
        }

        if (this._quickRecallTimer > 0) {
            this.quickRecallLabel.node.active = true;
            this.quickRecallLabel.string = Math.ceil(this._quickRecallTimer).toString();
            if (this.quickRecallButton) {
                const sprite = this.quickRecallButton.getComponent(Sprite);
                if (sprite) sprite.color = new Color(76, 175, 80, 255);
            }
        } else if (this._isQuickRecallAvailable) {
            this.quickRecallLabel.node.active = false;
            if (this.quickRecallButton) {
                const sprite = this.quickRecallButton.getComponent(Sprite);
                if (sprite) sprite.color = Color.WHITE;
            }
        }
    }

    /**
     * 使用一键收球
     */
    public useQuickRecall() {
        if (!this._isQuickRecallAvailable) return;

        const gameState = GameManager.instance?.gameState;
        if (gameState !== GameState.WAITING && gameState !== GameState.LAUNCHING) return;

        this._isQuickRecallAvailable = false;
        this.updateQuickRecallUI();

        // 让所有飞行中的小球立即回收
        const ballManager = BallManager.instance;
        if (ballManager) {
            ballManager.quickRecallAllSmallBalls();
        }
    }

    // ==================== 炸弹球功能 ====================

    /**
     * 使用炸弹球道具（点击按钮后调用）
     * 在发射口显示炸弹，等待玩家瞄准发射
     */
    public useBombBall() {
        const gm = GameManager.instance;
        if (!gm) return;
        if (gm.gameState !== GameState.READY) return;
        if (gm.isBombMode) return;

        const count = this.getItemCount(ItemType.BOMB);

        if (count > 0) {
            // 有道具，直接使用
            this.executeBombBall();
        } else {
            // 没有道具，需要看广告
            this.showRewardedAd(() => {
                // 广告完成，执行道具效果
                this.executeBombBall();
            });
        }
    }

    /**
     * 执行炸弹球效果（消耗道具或看完广告后调用）
     */
    private executeBombBall() {
        const gm = GameManager.instance;
        if (!gm) return;
        if (gm.gameState !== GameState.READY) return;
        if (gm.isBombMode) return;

        // 如果有道具则消耗
        this.consumeItem(ItemType.BOMB);

        gm.enterBombMode();

        if (this.launcherBombDisplay) {
            this.launcherBombDisplay.active = true;
        }

        this.updateButtonStates();
    }

    /**
     * 取消炸弹球模式（如果需要取消功能可以调用）
     */
    public cancelBombMode() {
        const gm = GameManager.instance;
        if (!gm || !gm.isBombMode) return;

        gm.exitBombMode();

        // 隐藏发射口的炸弹
        if (this.launcherBombDisplay) {
            this.launcherBombDisplay.active = false;
        }

        this.updateButtonStates();
    }

    public get isBombMode(): boolean {
        return GameManager.instance?.isBombMode || false;
    }

    /**
     * 发射炸弹球（玩家松开瞄准后调用）
     */
    public launchBomb(direction: Vec2) {
        const gm = GameManager.instance;
        if (!gm || !gm.isBombMode || !this.bombBallPrefab) return;

        if (this.launcherBombDisplay) {
            this.launcherBombDisplay.active = false;
        }

        const bombNode = instantiate(this.bombBallPrefab);
        if (!bombNode) return;

        const ballManager = BallManager.instance;
        bombNode.parent = (ballManager && ballManager.node) ? ballManager.node : this.node.parent;
        bombNode.setPosition(GameConfig.LAUNCH_POS_X, GameConfig.LAUNCH_POS_Y, 0);

        const bombBall = bombNode.getComponent('BombBall');
        if (bombBall) {
            (bombBall as any).launch(direction);
        }

        gm.exitBombMode();
        this.updateButtonStates();
    }

    /**
     * 炸弹爆炸效果
     */
    public explodeBomb(position: Vec3) {
        const radius = GameConfig.BOMB_EXPLOSION_RADIUS;
        const ballManager = BallManager.instance;

        if (ballManager) {
            ballManager.destroyBigBallsInRadius(position, radius);
        }
    }

    // ==================== 翻倍球功能 ====================

    /**
     * 使用翻倍球道具
     */
    public useDoubleBall() {
        const gameState = GameManager.instance?.gameState;
        if (gameState !== GameState.READY) return;

        if (!this.doubleBallPrefab || !this.doubleBallContainer) return;

        // 检查是否有空位
        const targetPosition = this.findDoubleBallPosition();
        if (!targetPosition) {
            return;
        }

        const count = this.getItemCount(ItemType.DOUBLE);

        if (count > 0) {
            // 有道具，直接使用
            this.executeDoubleBall();
        } else {
            // 没有道具，需要看广告
            this.showRewardedAd(() => {
                this.executeDoubleBall();
            });
        }
    }

    /**
     * 执行翻倍球效果
     */
    private executeDoubleBall() {
        const gameState = GameManager.instance?.gameState;
        if (gameState !== GameState.READY) return;

        if (!this.doubleBallPrefab || !this.doubleBallContainer) return;

        // 获取翻倍球的目标位置
        const targetPosition = this.findDoubleBallPosition();
        if (!targetPosition) {
            return;
        }

        // 消耗道具
        this.consumeItem(ItemType.DOUBLE);

        // 立即记录目标位置，防止重复占用
        this._doubleBallTargetPositions.push(targetPosition.clone());

        const doubleBallNode = instantiate(this.doubleBallPrefab);
        if (!doubleBallNode) {
            // 创建失败，移除已记录的位置
            this._doubleBallTargetPositions.pop();
            return;
        }

        doubleBallNode.parent = this.doubleBallContainer;
        this._activeDoubleBalls.push(doubleBallNode);

        // 从按钮位置开始飞入
        const startPos = this.doubleButton ?
            this.doubleButton.worldPosition.clone() :
            new Vec3(280, 100, 0);

        // 转换为容器的本地坐标
        const localStartPos = this.doubleBallContainer.inverseTransformPoint(new Vec3(), startPos);
        doubleBallNode.setPosition(localStartPos.x, localStartPos.y, 0);

        // 计算飞行时间
        const dx = targetPosition.x - localStartPos.x;
        const dy = targetPosition.y - localStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const flyTime = distance / GameConfig.DOUBLE_BALL_FLY_SPEED;

        // 播放飞入动画
        tween(doubleBallNode)
            .to(flyTime, { position: targetPosition })
            .start();

        this.updateButtonStates();
    }

    /**
     * 查找翻倍球的目标位置
     * 优先在上4层找空位，找不到则往下找
     */
    private findDoubleBallPosition(): Vec3 | null {
        const ballManager = BallManager.instance;
        if (!ballManager) return null;

        // 使用目标位置数组来检查占用（包括飞行中的翻倍球）
        const occupiedPositions: Vec3[] = [...this._doubleBallTargetPositions];

        // 先在优先层（上4层）查找
        let emptyPositions = ballManager.getEmptyPositionsInTopLayers(
            GameConfig.DOUBLE_BALL_PRIORITY_LAYERS,
            occupiedPositions
        );

        if (emptyPositions.length > 0) {
            // 随机选择一个空位
            const randomIndex = Math.floor(Math.random() * emptyPositions.length);
            return emptyPositions[randomIndex];
        }

        // 优先层没有空位，继续往下找
        for (let layer = GameConfig.BIG_BALL_LAYERS - GameConfig.DOUBLE_BALL_PRIORITY_LAYERS; layer >= 1; layer--) {
            const positions = ballManager.getLayerPositions(layer);
            for (const pos of positions) {
                // 检查是否被大球占用
                if (ballManager.isPositionOccupiedByBigBall(pos)) continue;

                // 检查是否被翻倍球占用
                let isOccupied = false;
                for (const occupied of occupiedPositions) {
                    const dx = Math.abs(occupied.x - pos.x);
                    const dy = Math.abs(occupied.y - pos.y);
                    if (dx < 30 && dy < 30) {
                        isOccupied = true;
                        break;
                    }
                }

                if (!isOccupied) {
                    return pos;
                }
            }
        }

        // 全屏都被占满
        return null;
    }

    /**
     * 检查是否还能放置翻倍球
     */
    public canPlaceDoubleBall(): boolean {
        return this.findDoubleBallPosition() !== null;
    }

    /**
     * 移除翻倍球
     */
    public removeDoubleBall(node: Node) {
        const index = this._activeDoubleBalls.indexOf(node);
        if (index !== -1) {
            this._activeDoubleBalls.splice(index, 1);
            // 同时移除对应的目标位置
            if (index < this._doubleBallTargetPositions.length) {
                this._doubleBallTargetPositions.splice(index, 1);
            }
        }
        if (node && node.isValid) {
            node.destroy();
        }
    }

    // ==================== 激光功能 ====================

    /**
     * 使用激光道具
     */
    public useLaser() {
        const gameState = GameManager.instance?.gameState;
        if (gameState !== GameState.READY) return;

        // 检查上4层是否有大球
        const ballManager = BallManager.instance;
        if (!ballManager || !ballManager.hasTopLayerBigBalls(GameConfig.LASER_SWEEP_LAYERS)) {
            return;
        }

        const count = this.getItemCount(ItemType.LASER);

        if (count > 0) {
            // 有道具，直接使用
            this.executeLaser();
        } else {
            // 没有道具，需要看广告
            this.showRewardedAd(() => {
                this.executeLaser();
            });
        }
    }

    /**
     * 执行激光效果
     */
    private executeLaser() {
        const gameState = GameManager.instance?.gameState;
        if (gameState !== GameState.READY) return;

        const ballManager = BallManager.instance;
        if (!ballManager || !ballManager.hasTopLayerBigBalls(GameConfig.LASER_SWEEP_LAYERS)) {
            return;
        }

        // 消耗道具
        this.consumeItem(ItemType.LASER);

        // 播放激光动画并销毁大球
        this.playLaserAnimation();
    }

    private playLaserAnimation() {
        // 计算激光扫描的Y范围（从上往下）
        // 大球层从底部开始编号，第1层在最下面，第8层在最上面
        const ballManager = BallManager.instance;
        if (!ballManager) {
            return;
        }

        const sweepLayers = GameConfig.LASER_SWEEP_LAYERS;
        const topLayer = GameConfig.BIG_BALL_LAYERS;
        const bottomLayer = topLayer - sweepLayers + 1;

        const topLayerY = ballManager.getLayerY(topLayer);
        const bottomLayerY = ballManager.getLayerY(bottomLayer);

        const startY = topLayerY + 50; // 从最上层上方开始
        const endY = bottomLayerY - 50; // 到目标层下方结束

        if (!this.laserEffectNode) {
            // 没有激光效果节点，直接执行效果（一次性销毁）
            ballManager.destroyTopLayerBigBalls(sweepLayers);
            return;
        }

        this.laserEffectNode.active = true;
        this.laserEffectNode.setPosition(0, startY, 0);

        // 记录每层的Y坐标和对应的层号，用于逐层销毁
        const layerYPositions: { layer: number, y: number }[] = [];
        for (let layer = topLayer; layer >= bottomLayer; layer--) {
            layerYPositions.push({
                layer: layer,
                y: ballManager.getLayerY(layer)
            });
        }

        // 记录已销毁的层
        const destroyedLayers = new Set<number>();

        // 使用 update 回调来检测激光位置并逐层销毁
        const checkAndDestroy = () => {
            if (!this.laserEffectNode || !this.laserEffectNode.active) return;

            const laserY = this.laserEffectNode.position.y;

            for (const { layer, y } of layerYPositions) {
                // 当激光经过大球圆心时销毁该层
                if (!destroyedLayers.has(layer) && laserY <= y) {
                    destroyedLayers.add(layer);
                    ballManager.destroyBigBallsInLayer(layer);
                }
            }
        };

        // 启动定时检测
        this.schedule(checkAndDestroy, 0.016); // 约60fps检测

        tween(this.laserEffectNode)
            .to(GameConfig.LASER_SWEEP_DURATION, { position: new Vec3(0, endY, 0) })
            .call(() => {
                this.laserEffectNode.active = false;
                this.unschedule(checkAndDestroy);

                // 确保所有目标层都被销毁（以防检测遗漏）
                for (const { layer } of layerYPositions) {
                    if (!destroyedLayers.has(layer)) {
                        ballManager.destroyBigBallsInLayer(layer);
                    }
                }
            })
            .start();
    }

    // ==================== 整理管道功能 ====================

    /**
     * 使用整理管道
     */
    public useSortPipe() {
        const gameState = GameManager.instance?.gameState;
        if (gameState !== GameState.READY) return;

        const count = this.getItemCount(ItemType.SORT_PIPE);

        if (count > 0) {
            // 有道具，直接使用
            this.executeSortPipe();
        } else {
            // 没有道具，需要看广告
            this.showRewardedAd(() => {
                this.executeSortPipe();
            });
        }
    }

    /**
     * 执行整理管道效果
     */
    private executeSortPipe() {
        const gameState = GameManager.instance?.gameState;
        if (gameState !== GameState.READY) return;

        // 消耗道具
        this.consumeItem(ItemType.SORT_PIPE);

        GameManager.instance?.sortPipeBalls();
    }

    // ==================== 增加管道容量功能 ====================

    /**
     * 更新管道容量UI显示
     */
    private updateCapacityUI() {
        if (!this.capacityLabel) return;

        const gm = GameManager.instance;
        if (!gm) return;

        const current = gm.pipeCapacity;
        const max = GameConfig.MAX_PIPE_CAPACITY;

        this.capacityLabel.string = `${current}/${max}`;

        // 更新按钮位置
        this.updateAddCapacityButtonPosition();
    }

    /**
     * 更新增加管道容量按钮的位置（跟随管道末尾）
     */
    private updateAddCapacityButtonPosition() {
        if (!this.addCapacityButton) return;
        if (!this._pipeDisplay) return;

        const pos = this._pipeDisplay.getAddCapacityButtonPosition();
        this.addCapacityButton.setPosition(-350, pos.y, 0);
    }

    /**
     * 使用增加管道容量（点击按钮后调用）
     * 会先调用广告接口，广告播放完成后增加容量
     */
    public useAddCapacity() {
        const gm = GameManager.instance;
        if (!gm) return;

        // 检查游戏状态
        if (gm.gameState !== GameState.READY) return;

        // 检查是否已达到最大容量
        if (!gm.canIncreasePipeCapacity()) return;

        // 调用广告接口
        this.showRewardedAd(() => {
            // 广告播放完成，增加管道容量
            this.onAddCapacityAdComplete();
        });
    }

    /**
     * 广告播放完成后的回调
     */
    private onAddCapacityAdComplete() {
        const gm = GameManager.instance;
        if (!gm) return;

        const success = gm.increasePipeCapacity();
        if (success) {
            this.updateCapacityUI();
            this.updateAddCapacityButtonPosition();
            this.updateButtonStates();
        }
    }

    /**
     * 显示激励广告
     * @param onComplete 广告播放完成后的回调
     * @param onFailed 广告播放失败的回调（可选）
     */
    private showRewardedAd(onComplete: () => void, onFailed?: () => void) {
        // 检查是否在微信小程序环境
        if (typeof wx !== 'undefined' && wx.createRewardedVideoAd) {
            // 微信小程序环境
            this.showWxRewardedAd(onComplete, onFailed);
        } else {
            // 非微信环境（开发测试用），直接调用完成回调
            console.log('[ItemManager] 非微信环境，跳过广告直接发放奖励');
            onComplete();
        }
    }

    /**
     * 显示微信激励视频广告
     */
    private showWxRewardedAd(onComplete: () => void, onFailed?: () => void) {
        // 创建激励视频广告实例
        // 注意：广告单元ID需要在微信公众平台申请
        const rewardedVideoAd = wx.createRewardedVideoAd({
            adUnitId: 'your-ad-unit-id'  // TODO: 替换为实际的广告单元ID
        });

        // 监听广告关闭事件
        const onCloseHandler = (res: { isEnded: boolean }) => {
            // 移除监听
            rewardedVideoAd.offClose(onCloseHandler);
            rewardedVideoAd.offError(onErrorHandler);

            if (res && res.isEnded) {
                // 用户完整观看了广告
                onComplete();
            } else {
                // 用户中途退出
                if (onFailed) {
                    onFailed();
                }
            }
        };

        // 监听广告错误事件
        const onErrorHandler = (err: any) => {
            console.error('[ItemManager] 广告加载失败:', err);
            rewardedVideoAd.offClose(onCloseHandler);
            rewardedVideoAd.offError(onErrorHandler);

            if (onFailed) {
                onFailed();
            }
        };

        rewardedVideoAd.onClose(onCloseHandler);
        rewardedVideoAd.onError(onErrorHandler);

        // 显示广告
        rewardedVideoAd.show().catch(() => {
            // 失败重试
            rewardedVideoAd.load().then(() => {
                rewardedVideoAd.show();
            }).catch((err: any) => {
                console.error('[ItemManager] 广告加载失败:', err);
                rewardedVideoAd.offClose(onCloseHandler);
                rewardedVideoAd.offError(onErrorHandler);

                if (onFailed) {
                    onFailed();
                }
            });
        });
    }
}
