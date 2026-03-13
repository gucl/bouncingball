import { _decorator, Component, Node, Prefab, instantiate, Vec3, Vec2, director } from 'cc';
import { GameConfig } from './GameConfig';
import { GameManager, GameState } from './GameManager';
import { SmallBall, SmallBallState } from './SmallBall';
import { BigBall, BigBallShape } from './BigBall';

const { ccclass, property } = _decorator;

@ccclass('BallManager')
export class BallManager extends Component {
    private static _instance: BallManager = null;
    public static get instance(): BallManager {
        return this._instance;
    }

    @property(Prefab)
    smallBallPrefab: Prefab = null;

    @property(Prefab)
    bigBallCirclePrefab: Prefab = null;

    @property(Prefab)
    bigBallSquarePrefab: Prefab = null;

    @property(Prefab)
    bigBallDiamondPrefab: Prefab = null;

    @property(Node)
    smallBallsContainer: Node = null;

    @property(Node)
    bigBallsContainer: Node = null;

    @property(Node)
    pipeContainer: Node = null;

    private _flyingBalls: SmallBall[] = [];
    private _bigBalls: BigBall[][] = [];
    private _pendingBalls: SmallBall[] = [];

    onLoad() {
        if (BallManager._instance) {
            this.destroy();
            return;
        }
        BallManager._instance = this;

        for (let i = 0; i < GameConfig.BIG_BALL_LAYERS; i++) {
            this._bigBalls.push([]);
        }

        director.on('BALL_RECYCLE', this.onBallRecycleEvent, this);
        director.on('PENDING_BALL_ACTIVATED', this.onPendingBallActivated, this);
    }

    start() {
    }

    onDestroy() {
        director.off('BALL_RECYCLE', this.onBallRecycleEvent, this);
        director.off('PENDING_BALL_ACTIVATED', this.onPendingBallActivated, this);

        if (BallManager._instance === this) {
            BallManager._instance = null;
        }
    }

    private onBallRecycleEvent(ball: SmallBall) {
        this.recycleBall(ball);
    }

    private onPendingBallActivated(ball: SmallBall) {
        this.activatePendingBall(ball);
    }

    createAndLaunchSmallBall(value: number, launchWorldPos: Vec3, direction: Vec2): SmallBall {
        if (!this.smallBallPrefab || !this.smallBallsContainer) {
            return null;
        }

        const containerWorldPos = this.smallBallsContainer.worldPosition;
        const ballNode = instantiate(this.smallBallPrefab);
        ballNode.setParent(this.smallBallsContainer);

        const localX = launchWorldPos.x - containerWorldPos.x;
        const localY = launchWorldPos.y - containerWorldPos.y;
        ballNode.setPosition(localX, localY, 0);
        ballNode.setScale(1, 1, 1);

        const smallBall = ballNode.getComponent(SmallBall);
        if (smallBall) {
            smallBall.setValue(value);
            this._flyingBalls.push(smallBall);

            this.scheduleOnce(() => {
                if (smallBall && smallBall.node && smallBall.node.isValid) {
                    smallBall.launch(direction);
                }
            }, 0);
        }

        return smallBall;
    }

    createPendingBall(position: Vec3, value: number): SmallBall {
        if (!this.smallBallPrefab || !this.smallBallsContainer) {
            return null;
        }

        const ballNode = instantiate(this.smallBallPrefab);
        ballNode.setParent(this.smallBallsContainer);
        ballNode.setPosition(position);
        ballNode.setScale(1, 1, 1);

        const smallBall = ballNode.getComponent(SmallBall);
        if (smallBall) {
            smallBall.setValue(value);
            smallBall.setIsFromPipe(false);  // 标记为待获得球（不是从管道发射的）

            this.scheduleOnce(() => {
                if (smallBall && smallBall.node && smallBall.node.isValid) {
                    smallBall.setAsPending();
                }
            }, 0);

            this._pendingBalls.push(smallBall);
        }

        return smallBall;
    }

    activatePendingBall(ball: SmallBall) {
        const index = this._pendingBalls.indexOf(ball);
        if (index !== -1) {
            this._pendingBalls.splice(index, 1);
            ball.activate();
            this._flyingBalls.push(ball);
        }
    }

    recycleBall(ball: SmallBall) {
        const flyingIndex = this._flyingBalls.indexOf(ball);
        if (flyingIndex !== -1) {
            this._flyingBalls.splice(flyingIndex, 1);
        }

        const pendingIndex = this._pendingBalls.indexOf(ball);
        if (pendingIndex !== -1) {
            this._pendingBalls.splice(pendingIndex, 1);
        }

        // 获取小球当前位置（用于回收动画）
        const ballPos = ball.node.position;
        const value = ball.value;
        const isFromPipe = ball.isFromPipe;

        // 先销毁小球节点
        ball.node.destroy();

        // 根据小球来源决定回收到管道还是闲置位
        if (isFromPipe) {
            // 从管道发射的球，回收到管道（带动画）
            GameManager.instance?.recycleBallWithAnimation(value, ballPos.x, ballPos.y);
        } else {
            // 待获得球（从大球消灭产生的），回收到闲置位
            GameManager.instance?.recyclePendingBallToIdleSlot(value);
        }

        this.checkAllBallsRecycled();
    }

    private checkAllBallsRecycled() {
        if (this._flyingBalls.length === 0) {
            // 等待所有回收动画完成后再进入下一回合
            this.waitForRecycleAnimations(() => {
                GameManager.instance?.nextRound();
            });
        }
    }

    /**
     * 等待所有回收动画完成
     */
    private waitForRecycleAnimations(onComplete: () => void) {
        const gameManager = GameManager.instance;
        if (!gameManager || gameManager.pendingRecycleAnimations === 0) {
            onComplete();
            return;
        }

        // 轮询检查动画是否完成
        this.scheduleOnce(() => {
            this.waitForRecycleAnimations(onComplete);
        }, 0.05);
    }

    recallAllBalls() {
        const balls = [...this._flyingBalls];
        for (const ball of balls) {
            this.recycleBall(ball);
        }
    }

    /**
     * 清除所有球（重新开始游戏时调用）
     */
    clearAllBalls() {
        // 清除所有飞行中的小球
        for (const ball of this._flyingBalls) {
            if (ball && ball.node && ball.node.isValid) {
                ball.node.destroy();
            }
        }
        this._flyingBalls = [];

        // 清除所有待获得小球
        for (const ball of this._pendingBalls) {
            if (ball && ball.node && ball.node.isValid) {
                ball.node.destroy();
            }
        }
        this._pendingBalls = [];

        // 清除所有大球
        for (let layer = 0; layer < this._bigBalls.length; layer++) {
            for (const ball of this._bigBalls[layer]) {
                if (ball && ball.node && ball.node.isValid) {
                    ball.node.destroy();
                }
            }
            this._bigBalls[layer] = [];
        }
    }

    generateInitialBigBalls() {
        // 初始生成3层大球
        // 所有层都使用回合1的数值范围，但用不同的"虚拟回合数"来实现4/5容量的错层效果
        for (let layer = 1; layer <= 3; layer++) {
            // layer 用于决定4容量/5容量（错层效果）
            // 但数值生成统一使用回合1的范围
            this.generateBigBallLayerWithCapacity(layer, layer, 1, 0);
        }
    }

    /**
     * 生成大球层
     * @param layer 层号（1-8）
     * @param round 当前回合数（同时用于决定4容量/5容量和数值范围）
     * @param pipeSum 管道总值
     */
    generateBigBallLayer(layer: number, round: number, pipeSum: number) {
        this.generateBigBallLayerWithCapacity(layer, round, round, pipeSum);
    }

    /**
     * 生成大球层（可分别指定容量和数值的回合数）
     * @param layer 层号（1-8）
     * @param capacityRound 用于决定4容量/5容量的回合数（奇数=4容量，偶数=5容量）
     * @param valueRound 用于决定数值范围的回合数
     * @param pipeSum 管道总值
     */
    generateBigBallLayerWithCapacity(layer: number, capacityRound: number, valueRound: number, pipeSum: number) {
        // 根据 capacityRound 决定容量：奇数回合用4容量，偶数回合用5容量
        const capacity = (capacityRound % 2 === 1) ? 4 : 5;

        // 获取上一层（layer+1，因为新层在最底部，上一层在上面）的大球数量
        const previousLayerBallCount = this.getBallCountInLayer(layer + 1);

        // 使用权重配置生成大球数量
        const count = GameConfig.generateBigBallCount(capacity, previousLayerBallCount);

        // 使用统一的层高，加上底部边距配置
        const layerHeight = GameConfig.LAYER_HEIGHT_4;
        const baseY = GameConfig.COLLISION_AREA_BOTTOM + GameConfig.BIG_BALL_BOTTOM_MARGIN;
        const layerY = baseY + (layer - 0.5) * layerHeight;

        const positions = this.calculateBallPositions(capacity, layer);
        const selectedPositions = this.randomSelect(positions, count);

        for (const pos of selectedPositions) {
            // 使用 valueRound 决定数值范围
            const value = GameConfig.generateBigBallValue(valueRound, pipeSum);
            // 使用配置的权重随机生成形状
            const shapeIndex = GameConfig.generateBigBallShape();
            const shape = shapeIndex as BigBallShape;
            this.createBigBall(new Vec3(pos.x, layerY, 0), value, shape, layer);
        }
    }

    /**
     * 获取指定层的大球数量
     * @param layer 层号
     * @returns 该层的大球数量，如果层不存在返回-1
     */
    getBallCountInLayer(layer: number): number {
        if (layer < 1 || layer > this._bigBalls.length) {
            return -1;
        }
        const count = this._bigBalls[layer - 1].length;
        return count > 0 ? count : -1;
    }

    private calculateBallPositions(capacity: number, layer: number): Vec2[] {
        const positions: Vec2[] = [];
        const spacing = (capacity === 4) ? GameConfig.BIG_BALL_SPACING_4 : GameConfig.BIG_BALL_SPACING_5;
        const totalWidth = spacing * (capacity - 1);
        const startX = -totalWidth / 2;

        for (let i = 0; i < capacity; i++) {
            const x = startX + spacing * i;
            positions.push(new Vec2(x, 0));
        }

        return positions;
    }

    private randomSelect<T>(array: T[], count: number): T[] {
        const shuffled = [...array].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    createBigBall(position: Vec3, value: number, shape: BigBallShape, layer: number): BigBall {
        let prefab: Prefab = null;

        switch (shape) {
            case BigBallShape.CIRCLE:
                prefab = this.bigBallCirclePrefab;
                break;
            case BigBallShape.SQUARE:
                prefab = this.bigBallSquarePrefab;
                break;
            case BigBallShape.DIAMOND:
                // 菱形使用方形预制体，在BigBall.ts中会旋转45度
                prefab = this.bigBallDiamondPrefab || this.bigBallSquarePrefab;
                break;
        }

        if (!prefab || !this.bigBallsContainer) {
            return null;
        }

        const ballNode = instantiate(prefab);
        ballNode.setParent(this.bigBallsContainer);
        ballNode.setPosition(position);

        const bigBall = ballNode.getComponent(BigBall);
        if (bigBall) {
            bigBall.init(value, shape, layer);
            this._bigBalls[layer - 1].push(bigBall);
        }

        return bigBall;
    }

    moveAllBigBallsUp(): boolean {
        let gameOver = false;

        for (let layer = GameConfig.BIG_BALL_LAYERS; layer >= 1; layer--) {
            const layerBalls = this._bigBalls[layer - 1];

            for (const ball of layerBalls) {
                if (ball.moveUp()) {
                    gameOver = true;
                }
            }

            if (layer < GameConfig.BIG_BALL_LAYERS) {
                this._bigBalls[layer].push(...layerBalls);
            }
            this._bigBalls[layer - 1] = [];
        }

        this.updateBigBallPositions();

        // 待获得小球也上移一层
        this.movePendingBallsUp();

        return gameOver;
    }

    // 待获得小球上移一层
    private movePendingBallsUp() {
        const layerHeight = GameConfig.LAYER_HEIGHT_4;  // 使用统一的层高
        const ballsToRemove: SmallBall[] = [];

        // 计算第9层的Y坐标（超过这个就销毁）
        const layer9Y = GameConfig.COLLISION_AREA_BOTTOM + (GameConfig.FAIL_LAYER - 0.5) * layerHeight;

        for (const ball of this._pendingBalls) {
            if (!ball || !ball.node || !ball.node.isValid) {
                ballsToRemove.push(ball);
                continue;
            }

            const pos = ball.node.position;
            const newY = pos.y + layerHeight;

            if (newY >= layer9Y) {
                ball.node.destroy();
                ballsToRemove.push(ball);
            } else {
                ball.node.setPosition(pos.x, newY, pos.z);
            }
        }

        // 移除已销毁的球
        for (const ball of ballsToRemove) {
            const index = this._pendingBalls.indexOf(ball);
            if (index !== -1) {
                this._pendingBalls.splice(index, 1);
            }
        }
    }

    private updateBigBallPositions() {
        const baseY = GameConfig.COLLISION_AREA_BOTTOM + GameConfig.BIG_BALL_BOTTOM_MARGIN;

        for (let layer = 1; layer <= GameConfig.BIG_BALL_LAYERS; layer++) {
            const capacity = (layer % 2 === 1) ? GameConfig.LAYER_4_CAPACITY : GameConfig.LAYER_5_CAPACITY;
            const layerHeight = (capacity === 4) ? GameConfig.LAYER_HEIGHT_4 : GameConfig.LAYER_HEIGHT_5;
            const layerY = baseY + (layer - 0.5) * layerHeight;

            for (const ball of this._bigBalls[layer - 1]) {
                const pos = ball.node.position;
                ball.node.setPosition(pos.x, layerY, pos.z);
            }
        }
    }

    checkGameOver(): boolean {
        for (const ball of this._bigBalls[GameConfig.BIG_BALL_LAYERS - 1]) {
            if (ball.layer >= GameConfig.FAIL_LAYER) {
                return true;
            }
        }
        return false;
    }

    updatePipeDisplay() {
    }

    // ==================== 道具相关方法 ====================

    /**
     * 一键收球 - 让所有飞行中的小球立即回收
     */
    quickRecallAllSmallBalls() {
        // 复制数组，避免遍历时修改原数组
        const flyingBallsCopy = [...this._flyingBalls];
        for (const ball of flyingBallsCopy) {
            if (ball && ball.node && ball.node.isValid && ball.state === SmallBallState.FLYING) {
                // 禁用物理碰撞
                ball.disablePhysics();
                // 触发回收
                ball.recycle();
            }
        }

        // 同时处理待获得小球
        const pendingBallsCopy = [...this._pendingBalls];
        for (const ball of pendingBallsCopy) {
            if (ball && ball.node && ball.node.isValid) {
                ball.disablePhysics();
                ball.recycle();
            }
        }
    }

    /**
     * 炸弹爆炸 - 销毁指定半径内的所有大球
     */
    destroyBigBallsInRadius(center: Vec3, radius: number) {
        const ballsToDestroy: BigBall[] = [];

        for (let layer = 0; layer < this._bigBalls.length; layer++) {
            for (const ball of this._bigBalls[layer]) {
                if (!ball || !ball.node || !ball.node.isValid) continue;

                const ballPos = ball.node.worldPosition;
                const dx = ballPos.x - center.x;
                const dy = ballPos.y - center.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance <= radius) {
                    ballsToDestroy.push(ball);
                }
            }
        }

        // 延迟销毁，避免在遍历时修改数组
        this.scheduleOnce(() => {
            for (const ball of ballsToDestroy) {
                if (ball && ball.node && ball.node.isValid) {
                    ball.forceDestroy();
                }
            }
        }, 0);
    }

    /**
     * 激光扫描 - 销毁指定Y范围内的所有大球
     */
    destroyBigBallsInYRange(minY: number, maxY: number) {
        const ballsToDestroy: BigBall[] = [];

        for (let layer = 0; layer < this._bigBalls.length; layer++) {
            for (const ball of this._bigBalls[layer]) {
                if (!ball || !ball.node || !ball.node.isValid) continue;

                const ballY = ball.node.worldPosition.y;

                if (ballY >= minY && ballY <= maxY) {
                    ballsToDestroy.push(ball);
                }
            }
        }

        // 延迟销毁
        this.scheduleOnce(() => {
            for (const ball of ballsToDestroy) {
                if (ball && ball.node && ball.node.isValid) {
                    ball.forceDestroy();
                }
            }
        }, 0);
    }

    /**
     * 从大球列表中移除指定大球
     */
    removeBigBall(ball: BigBall) {
        for (let layer = 0; layer < this._bigBalls.length; layer++) {
            const index = this._bigBalls[layer].indexOf(ball);
            if (index !== -1) {
                this._bigBalls[layer].splice(index, 1);
                return;
            }
        }
    }

    /**
     * 检查从上往下指定层数内是否有大球
     */
    hasTopLayerBigBalls(layerCount: number): boolean {
        const totalLayers = GameConfig.BIG_BALL_LAYERS;
        for (let i = 0; i < layerCount; i++) {
            const layerIndex = totalLayers - 1 - i; // 从最上层开始
            if (layerIndex >= 0 && this._bigBalls[layerIndex].length > 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * 获取指定层的Y坐标
     * @param layer 层号（1-8，1在最下面）
     */
    getLayerY(layer: number): number {
        const baseY = GameConfig.COLLISION_AREA_BOTTOM + GameConfig.BIG_BALL_BOTTOM_MARGIN;
        const capacity = (layer % 2 === 1) ? GameConfig.LAYER_4_CAPACITY : GameConfig.LAYER_5_CAPACITY;
        const layerHeight = (capacity === 4) ? GameConfig.LAYER_HEIGHT_4 : GameConfig.LAYER_HEIGHT_5;
        return baseY + (layer - 0.5) * layerHeight;
    }

    /**
     * 销毁从上往下指定层数的所有大球
     */
    destroyTopLayerBigBalls(layerCount: number) {
        const totalLayers = GameConfig.BIG_BALL_LAYERS;
        const ballsToDestroy: BigBall[] = [];

        for (let i = 0; i < layerCount; i++) {
            const layerIndex = totalLayers - 1 - i; // 从最上层开始
            if (layerIndex >= 0) {
                for (const ball of this._bigBalls[layerIndex]) {
                    if (ball && ball.node && ball.node.isValid) {
                        ballsToDestroy.push(ball);
                    }
                }
            }
        }

        // 延迟销毁
        this.scheduleOnce(() => {
            for (const ball of ballsToDestroy) {
                if (ball && ball.node && ball.node.isValid) {
                    ball.forceDestroy();
                }
            }
        }, 0);
    }

    /**
     * 销毁指定层的所有大球
     * @param layer 层号（1-8，1是最下层，8是最上层）
     */
    destroyBigBallsInLayer(layer: number) {
        const layerIndex = layer - 1; // 转换为0-based索引
        if (layerIndex < 0 || layerIndex >= this._bigBalls.length) return;

        const ballsToDestroy: BigBall[] = [];
        for (const ball of this._bigBalls[layerIndex]) {
            if (ball && ball.node && ball.node.isValid) {
                ballsToDestroy.push(ball);
            }
        }

        // 立即销毁（不延迟，因为激光动画需要即时反馈）
        for (const ball of ballsToDestroy) {
            if (ball && ball.node && ball.node.isValid) {
                ball.forceDestroy();
            }
        }
    }

    /**
     * 获取指定层的大球位置列表
     * @param layer 层号（1-8）
     * @returns 该层所有可能的大球位置
     */
    getLayerPositions(layer: number): Vec3[] {
        const positions: Vec3[] = [];
        const capacity = (layer % 2 === 1) ? GameConfig.LAYER_4_CAPACITY : GameConfig.LAYER_5_CAPACITY;
        const spacing = (capacity === 4) ? GameConfig.BIG_BALL_SPACING_4 : GameConfig.BIG_BALL_SPACING_5;
        const layerY = this.getLayerY(layer);

        const startX = -(capacity - 1) * spacing / 2;
        for (let i = 0; i < capacity; i++) {
            positions.push(new Vec3(startX + i * spacing, layerY, 0));
        }

        return positions;
    }

    /**
     * 检查指定位置是否已有大球
     */
    isPositionOccupiedByBigBall(position: Vec3, tolerance: number = 30): boolean {
        for (let layer = 0; layer < this._bigBalls.length; layer++) {
            for (const ball of this._bigBalls[layer]) {
                if (!ball || !ball.node || !ball.node.isValid) continue;
                const ballPos = ball.node.position;
                const dx = Math.abs(ballPos.x - position.x);
                const dy = Math.abs(ballPos.y - position.y);
                if (dx < tolerance && dy < tolerance) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 获取从上往下指定层数内的空位
     * @param layerCount 从上往下检查的层数
     * @param occupiedPositions 已被占用的位置（如翻倍球位置）
     * @returns 空位位置数组
     */
    getEmptyPositionsInTopLayers(layerCount: number, occupiedPositions: Vec3[] = []): Vec3[] {
        const emptyPositions: Vec3[] = [];
        const totalLayers = GameConfig.BIG_BALL_LAYERS;

        for (let i = 0; i < layerCount; i++) {
            const layer = totalLayers - i; // 从最上层开始（第8层、第7层...）
            if (layer < 1) continue;

            const positions = this.getLayerPositions(layer);
            for (const pos of positions) {
                // 检查是否被大球占用
                if (this.isPositionOccupiedByBigBall(pos)) continue;

                // 检查是否被其他物体（如翻倍球）占用
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
                    emptyPositions.push(pos);
                }
            }
        }

        return emptyPositions;
    }
}
