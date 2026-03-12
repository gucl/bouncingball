import { _decorator, Component, Node, Prefab, instantiate, Vec3, tween, Tween, Label, Sprite, Color, RigidBody2D, Collider2D } from 'cc';
import { GameConfig } from './GameConfig';
import { GameManager } from './GameManager';
import { PipeDisplay } from './PipeDisplay';
import { SmallBall } from './SmallBall';

const { ccclass, property } = _decorator;

/**
 * 管道动画控制器
 * 负责：
 * 1. 小球回收动画（L形路径进入管道）
 * 2. 小球合成动画（移动+放缩）
 */
@ccclass('PipeAnimator')
export class PipeAnimator extends Component {
    private static _instance: PipeAnimator = null;
    public static get instance(): PipeAnimator {
        return this._instance;
    }

    @property(Prefab)
    ballDisplayPrefab: Prefab = null;

    @property(Node)
    animationContainer: Node = null;

    private _pipeDisplay: PipeDisplay = null;
    private _animatingBalls: Node[] = [];  // 正在播放动画的小球节点
    private _isMerging: boolean = false;   // 是否正在进行合成动画

    onLoad() {
        if (PipeAnimator._instance) {
            this.destroy();
            return;
        }
        PipeAnimator._instance = this;
    }

    start() {
        // 获取 PipeDisplay 组件
        const gameManager = GameManager.instance;
        if (gameManager && gameManager.node) {
            const pipeNode = gameManager.node.getChildByPath('GameArea/Pipe');
            if (pipeNode) {
                this._pipeDisplay = pipeNode.getComponent(PipeDisplay);
            }
        }
    }

    onDestroy() {
        // 清理所有动画节点
        for (const node of this._animatingBalls) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this._animatingBalls = [];

        if (PipeAnimator._instance === this) {
            PipeAnimator._instance = null;
        }
    }

    /**
     * 设置 PipeDisplay 引用
     */
    public setPipeDisplay(pipeDisplay: PipeDisplay) {
        this._pipeDisplay = pipeDisplay;
    }

    /**
     * 播放小球回收动画（从底部进入管道）
     * @param startX 小球起始X坐标
     * @param startY 小球起始Y坐标（底部墙壁位置）
     * @param value 小球数值
     * @param targetIndex 小球在管道中的目标索引位置
     * @param onComplete 动画完成回调
     */
    public playRecycleAnimation(startX: number, startY: number, value: number, targetIndex: number, onComplete: () => void) {
        const ballNode = this.createAnimationBall(value);
        if (!ballNode) {
            onComplete();
            return;
        }

        ballNode.setPosition(startX, startY, 0);
        this._animatingBalls.push(ballNode);

        // 计算路径点
        const cornerX = GameConfig.PIPE_CORNER_X;
        const cornerY = GameConfig.PIPE_HORIZONTAL_Y;
        const speed = GameConfig.BALL_RECYCLE_SPEED;

        // 获取目标位置
        let endPos = { x: cornerX, y: cornerY };
        if (this._pipeDisplay) {
            endPos = this._pipeDisplay.getBallPosition(targetIndex);
        }

        // 判断目标位置是在水平段还是垂直段
        const horizontalSlots = this._pipeDisplay ? this._pipeDisplay.horizontalSlots : 7;
        const isTargetInHorizontal = targetIndex < horizontalSlots;

        // 阶段1：水平向左移动到转弯点X坐标
        const dist1 = Math.abs(startX - cornerX);
        const time1 = dist1 / speed;

        // 阶段2：垂直向上移动到转弯点Y坐标
        const dist2 = Math.abs(cornerY - startY);
        const time2 = dist2 / speed;

        if (isTargetInHorizontal) {
            // 目标在水平段：先水平向左到转弯点X，再向上到转弯点Y，再向右到目标位置
            const dist3 = Math.abs(endPos.x - cornerX);
            const time3 = dist3 / speed;

            tween(ballNode)
                .to(time1, { position: new Vec3(cornerX, startY, 0) })
                .to(time2, { position: new Vec3(cornerX, cornerY, 0) })
                .to(time3, { position: new Vec3(endPos.x, endPos.y, 0) })
                .call(() => {
                    this.finishRecycleAnimation(ballNode, onComplete);
                })
                .start();
        } else {
            // 目标在垂直段：先水平向左到转弯点X，再向上到目标Y位置（不需要到转弯点Y再下来）
            // 因为垂直段在转弯点下方，所以直接向上到目标Y即可
            const dist2Modified = Math.abs(endPos.y - startY);
            const time2Modified = dist2Modified / speed;

            tween(ballNode)
                .to(time1, { position: new Vec3(cornerX, startY, 0) })
                .to(time2Modified, { position: new Vec3(endPos.x, endPos.y, 0) })
                .call(() => {
                    this.finishRecycleAnimation(ballNode, onComplete);
                })
                .start();
        }
    }

    /**
     * 播放闲置位小球进入管道的动画
     * @param startX 闲置位X坐标
     * @param startY 闲置位Y坐标
     * @param value 小球数值
     * @param targetIndex 小球在管道中的目标索引位置
     * @param onComplete 动画完成回调
     */
    public playIdleSlotRecycleAnimation(startX: number, startY: number, value: number, targetIndex: number, onComplete: () => void) {
        const ballNode = this.createAnimationBall(value);
        if (!ballNode) {
            onComplete();
            return;
        }

        ballNode.setPosition(startX, startY, 0);
        this._animatingBalls.push(ballNode);

        // 闲置位在管道L形转弯的正下方
        const cornerX = GameConfig.PIPE_CORNER_X;
        const cornerY = GameConfig.PIPE_HORIZONTAL_Y;
        const speed = GameConfig.BALL_RECYCLE_SPEED;

        // 获取目标位置
        let endPos = { x: cornerX, y: cornerY };
        if (this._pipeDisplay) {
            endPos = this._pipeDisplay.getBallPosition(targetIndex);
        }

        // 判断目标位置是在水平段还是垂直段
        const horizontalSlots = this._pipeDisplay ? this._pipeDisplay.horizontalSlots : 7;
        const isTargetInHorizontal = targetIndex < horizontalSlots;

        if (isTargetInHorizontal) {
            // 目标在水平段：先向上到转弯点，再向右到目标位置
            const dist1 = Math.abs(cornerY - startY);
            const time1 = dist1 / speed;
            const dist2 = Math.abs(endPos.x - cornerX);
            const time2 = dist2 / speed;

            tween(ballNode)
                .to(time1, { position: new Vec3(cornerX, cornerY, 0) })
                .to(time2, { position: new Vec3(endPos.x, endPos.y, 0) })
                .call(() => {
                    this.finishRecycleAnimation(ballNode, onComplete);
                })
                .start();
        } else {
            // 目标在垂直段：直接向上到目标位置
            const dist = Math.abs(endPos.y - startY);
            const time = dist / speed;

            tween(ballNode)
                .to(time, { position: new Vec3(endPos.x, endPos.y, 0) })
                .call(() => {
                    this.finishRecycleAnimation(ballNode, onComplete);
                })
                .start();
        }
    }

    private finishRecycleAnimation(ballNode: Node, onComplete: () => void) {
        // 从动画列表中移除
        const index = this._animatingBalls.indexOf(ballNode);
        if (index !== -1) {
            this._animatingBalls.splice(index, 1);
        }

        // 销毁动画节点
        if (ballNode && ballNode.isValid) {
            ballNode.destroy();
        }

        // 调用完成回调
        onComplete();
    }

    /**
     * 批量播放闲置位小球回收动画（所有小球同时进入管道，按顺序排队）
     * @param startX 闲置位X坐标
     * @param startY 闲置位第一个球的Y坐标
     * @param values 要移动的小球数值数组
     * @param startIndex 第一个小球在管道中的目标索引位置
     * @param onComplete 所有动画完成后的回调
     */
    public playBatchIdleSlotRecycleAnimation(
        startX: number, 
        startY: number, 
        values: number[], 
        startIndex: number, 
        onComplete: () => void
    ) {
        if (values.length === 0) {
            onComplete();
            return;
        }

        const cornerX = GameConfig.PIPE_CORNER_X;
        const cornerY = GameConfig.PIPE_HORIZONTAL_Y;
        const speed = GameConfig.BALL_RECYCLE_SPEED;
        const ballSpacing = GameConfig.BALL_RADIUS * 2 + 5; // 小球间距
        
        let completedCount = 0;
        const totalCount = values.length;

        // 为每个小球创建动画
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            const targetIndex = startIndex + i;
            
            const ballNode = this.createAnimationBall(value);
            if (!ballNode) {
                completedCount++;
                if (completedCount >= totalCount) {
                    onComplete();
                }
                continue;
            }

            // 计算每个小球的起始位置（排队等待，第一个在最上面）
            const ballStartY = startY - i * ballSpacing;
            ballNode.setPosition(startX, ballStartY, 0);
            this._animatingBalls.push(ballNode);

            // 获取目标位置
            let endPos = { x: cornerX, y: cornerY };
            if (this._pipeDisplay) {
                endPos = this._pipeDisplay.getBallPosition(targetIndex);
            }

            // 判断目标位置是在水平段还是垂直段
            const horizontalSlots = this._pipeDisplay ? this._pipeDisplay.horizontalSlots : 7;
            const isTargetInHorizontal = targetIndex < horizontalSlots;

            // 计算延迟时间（让小球按顺序进入，保持间距）
            const delayTime = i * (ballSpacing / speed);

            if (isTargetInHorizontal) {
                // 目标在水平段：先向上到转弯点，再向右到目标位置
                const dist1 = Math.abs(cornerY - ballStartY);
                const time1 = dist1 / speed;
                const dist2 = Math.abs(endPos.x - cornerX);
                const time2 = dist2 / speed;

                tween(ballNode)
                    .delay(delayTime)
                    .to(time1, { position: new Vec3(cornerX, cornerY, 0) })
                    .to(time2, { position: new Vec3(endPos.x, endPos.y, 0) })
                    .call(() => {
                        this.finishBatchRecycleAnimation(ballNode, () => {
                            completedCount++;
                            if (completedCount >= totalCount) {
                                onComplete();
                            }
                        });
                    })
                    .start();
            } else {
                // 目标在垂直段：直接向上到目标位置
                const dist = Math.abs(endPos.y - ballStartY);
                const time = dist / speed;

                tween(ballNode)
                    .delay(delayTime)
                    .to(time, { position: new Vec3(endPos.x, endPos.y, 0) })
                    .call(() => {
                        this.finishBatchRecycleAnimation(ballNode, () => {
                            completedCount++;
                            if (completedCount >= totalCount) {
                                onComplete();
                            }
                        });
                    })
                    .start();
            }
        }
    }

    private finishBatchRecycleAnimation(ballNode: Node, onComplete: () => void) {
        // 从动画列表中移除
        const index = this._animatingBalls.indexOf(ballNode);
        if (index !== -1) {
            this._animatingBalls.splice(index, 1);
        }

        // 销毁动画节点
        if (ballNode && ballNode.isValid) {
            ballNode.destroy();
        }

        // 调用完成回调
        onComplete();
    }

    /**
     * 播放管道内小球合成动画
     * @param pipeBalls 管道内的小球数值数组（会被修改）
     * @param onComplete 所有合成完成后的回调
     */
    public playMergeAnimations(onComplete: () => void) {
        if (this._isMerging) {
            onComplete();
            return;
        }

        this._isMerging = true;
        this.doMergeStep(onComplete);
    }

    /**
     * 执行一步合成
     */
    private doMergeStep(onComplete: () => void) {
        const gameManager = GameManager.instance;
        if (!gameManager) {
            this._isMerging = false;
            onComplete();
            return;
        }

        const pipeBalls = gameManager.pipeBalls;

        // 从第一位开始遍历，找到可合成的相邻小球
        let mergeIndex = -1;
        for (let i = 0; i < pipeBalls.length - 1; i++) {
            if (pipeBalls[i] === pipeBalls[i + 1]) {
                mergeIndex = i;
                break;
            }
        }

        if (mergeIndex === -1) {
            // 没有可合成的小球
            this._isMerging = false;
            onComplete();
            return;
        }

        // 播放合成动画
        this.playOneMergeAnimation(mergeIndex, () => {
            // 继续检查下一次合成
            this.doMergeStep(onComplete);
        });
    }

    /**
     * 播放一次合成动画
     * 只有 index+1 位置的球移动到 index 位置，其他球不动
     * @param index 前一位小球的索引（合成目标位置）
     * @param onComplete 动画完成回调
     */
    private playOneMergeAnimation(index: number, onComplete: () => void) {
        const gameManager = GameManager.instance;
        if (!gameManager || !this._pipeDisplay) {
            this.doDataMerge(index);
            onComplete();
            return;
        }

        const pipeBalls = gameManager.pipeBalls;
        const newValue = pipeBalls[index] * 2;
        
        // 隐藏整个 PipeDisplay（用动画球完全替代）
        this._pipeDisplay.hideAll();
        
        // 为所有小球创建动画球
        const allAnimBalls: Node[] = [];
        for (let i = 0; i < pipeBalls.length; i++) {
            const value = pipeBalls[i];
            const ballNode = this.createAnimationBall(value);
            if (ballNode) {
                const pos = this._pipeDisplay.getBallPosition(i);
                ballNode.setPosition(pos.x, pos.y, 0);
                this._animatingBalls.push(ballNode);
                allAnimBalls.push(ballNode);
            }
        }
        
        // 只有 index+1 位置的球需要移动到 index 位置
        const movingBallNode = allAnimBalls[index + 1];
        
        if (!movingBallNode) {
            // 清理动画球
            this.cleanupAnimBalls(allAnimBalls);
            this.doDataMerge(index);
            this._pipeDisplay.updateDisplay();
            this._pipeDisplay.showAll();
            onComplete();
            return;
        }
        
        // 获取起点和终点位置
        const startPos = this._pipeDisplay.getBallPosition(index + 1);
        const endPos = this._pipeDisplay.getBallPosition(index);
        const speed = GameConfig.BALL_MERGE_MOVE_SPEED;
        
        // 计算移动时间
        const dist = Math.sqrt(
            Math.pow(endPos.x - startPos.x, 2) +
            Math.pow(endPos.y - startPos.y, 2)
        );
        const moveTime = dist / speed;
        
        // 播放移动动画（只有 index+1 的球移动到 index 位置）
        tween(movingBallNode)
            .to(moveTime, { position: new Vec3(endPos.x, endPos.y, 0) })
            .call(() => {
                // 移动完成后，执行合成效果
                this.finishOneMergeAnimation(allAnimBalls, index, newValue, onComplete);
            })
            .start();
    }

    /**
     * 清理动画球数组
     */
    private cleanupAnimBalls(balls: Node[]) {
        for (const ball of balls) {
            const idx = this._animatingBalls.indexOf(ball);
            if (idx !== -1) {
                this._animatingBalls.splice(idx, 1);
            }
            if (ball && ball.isValid) {
                ball.destroy();
            }
        }
    }

    /**
     * 单次合成动画完成后的处理
     */
    private finishOneMergeAnimation(
        allAnimBalls: Node[],
        index: number,
        newValue: number,
        onComplete: () => void
    ) {
        // 销毁参与合成的两个球（index 和 index+1）
        const ball1 = allAnimBalls[index];
        const ball2 = allAnimBalls[index + 1];
        
        if (ball1 && ball1.isValid) {
            const idx = this._animatingBalls.indexOf(ball1);
            if (idx !== -1) this._animatingBalls.splice(idx, 1);
            ball1.destroy();
        }
        if (ball2 && ball2.isValid) {
            const idx = this._animatingBalls.indexOf(ball2);
            if (idx !== -1) this._animatingBalls.splice(idx, 1);
            ball2.destroy();
        }
        
        // 执行数据合成
        this.doDataMerge(index);
        
        // 创建合成后的小球用于放缩动画
        const frontPos = this._pipeDisplay ? this._pipeDisplay.getBallPosition(index) : { x: 0, y: 0 };
        const mergedBall = this.createAnimationBall(newValue);
        
        // 销毁其他动画球（因为数据已经变了，需要重新创建）
        for (let i = 0; i < allAnimBalls.length; i++) {
            if (i === index || i === index + 1) continue; // 已经销毁了
            const ball = allAnimBalls[i];
            if (ball && ball.isValid) {
                const idx = this._animatingBalls.indexOf(ball);
                if (idx !== -1) this._animatingBalls.splice(idx, 1);
                ball.destroy();
            }
        }
        
        if (!mergedBall) {
            // 没有动画球，直接更新显示
            if (this._pipeDisplay) {
                this._pipeDisplay.updateDisplay();
                this._pipeDisplay.showAll();
            }
            onComplete();
            return;
        }
        
        mergedBall.setPosition(frontPos.x, frontPos.y, 0);
        this._animatingBalls.push(mergedBall);
        
        // 更新 PipeDisplay 显示（使用新的数据），显示所有球，但隐藏 index 位置（因为要播放放缩动画）
        if (this._pipeDisplay) {
            this._pipeDisplay.updateDisplay();
            this._pipeDisplay.showAll();  // 先显示所有
            this._pipeDisplay.hideAtIndex(index);  // 再隐藏合成位置
        }
        
        // 播放放缩动画
        const maxScale = GameConfig.BALL_MERGE_SCALE_MAX;
        const minScale = GameConfig.BALL_MERGE_SCALE_MIN;
        const duration = GameConfig.BALL_MERGE_ANIM_DURATION;
        const expandDuration = duration / 2;
        const shrinkDuration = duration / 2;
        
        tween(mergedBall)
            .to(expandDuration, { scale: new Vec3(maxScale, maxScale, 1) })
            .to(shrinkDuration, { scale: new Vec3(minScale, minScale, 1) })
            .call(() => {
                // 销毁动画小球
                const idx = this._animatingBalls.indexOf(mergedBall);
                if (idx !== -1) {
                    this._animatingBalls.splice(idx, 1);
                }
                if (mergedBall && mergedBall.isValid) {
                    mergedBall.destroy();
                }
                
                // 恢复显示并更新
                if (this._pipeDisplay) {
                    this._pipeDisplay.showAll();
                }
                
                const gameManager = GameManager.instance;
                if (gameManager) {
                    (gameManager as any).updatePipeDisplay();
                }
                
                onComplete();
            })
            .start();
    }

    /**
     * 执行数据层面的合成
     */
    private doDataMerge(index: number) {
        const gameManager = GameManager.instance;
        if (!gameManager) return;

        const pipeBalls = gameManager.pipeBalls;
        if (index < 0 || index >= pipeBalls.length - 1) return;

        const newValue = pipeBalls[index] * 2;
        pipeBalls.splice(index, 2, newValue);

        // 触发广告检测
        if (newValue >= GameConfig.AD_TRIGGER_VALUE) {
            // TODO: 触发广告
        }

        // 更新最大值
        (gameManager as any).updateMaxBallValue();
    }

    /**
     * 创建动画用的小球节点
     */
    private createAnimationBall(value: number): Node {
        const container = this.animationContainer || this.node;

        if (this.ballDisplayPrefab) {
            const node = instantiate(this.ballDisplayPrefab);
            node.setParent(container);

            // 禁用物理组件
            const rigidBody = node.getComponent(RigidBody2D);
            if (rigidBody) {
                rigidBody.enabled = false;
            }
            const collider = node.getComponent(Collider2D);
            if (collider) {
                collider.enabled = false;
            }

            // 禁用 SmallBall 脚本但使用其 setValue 方法
            const smallBall = node.getComponent(SmallBall);
            if (smallBall) {
                smallBall.enabled = false;
                smallBall.setValue(value);
            }

            return node;
        }

        // 如果没有预制体，创建简单节点
        const node = new Node('AnimBall');
        node.setParent(container);

        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const colorHex = GameConfig.getBallColor(value);
        sprite.color = new Color().fromHEX(colorHex);

        const labelNode = new Node('Label');
        labelNode.setParent(node);
        const label = labelNode.addComponent(Label);
        label.string = value.toString();
        label.fontSize = 16;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(0, 0, 0, 255);

        return node;
    }

    /**
     * 检查是否正在播放动画
     */
    public get isAnimating(): boolean {
        return this._animatingBalls.length > 0 || this._isMerging;
    }
}
