import { _decorator, Component, Node, Prefab, instantiate, Label, Sprite, Color, UITransform, Vec3, RigidBody2D, Collider2D } from 'cc';
import { GameConfig } from './GameConfig';
import { GameManager } from './GameManager';
import { SmallBall } from './SmallBall';

const { ccclass, property } = _decorator;

/**
 * 管道显示组件
 * 
 * 管道布局说明（参考竞品图）：
 * - 管道是 L 形的：顶部水平段 + 左侧垂直段
 * - 发射口在水平段的右端（屏幕中间位置）
 * - 第一个球（index=0）在发射口位置，是即将发射的球
 * - 后续的球从发射口向左排列（水平段）
 * - 超出水平段的球显示在垂直段（从水平段最左边向下延伸）
 * - 发射口位置的球不移动，发射后队列整体右移
 * 
 * 注意：垂直段的X坐标 = 水平段最左边小球的X坐标（自动计算）
 */
@ccclass('PipeDisplay')
export class PipeDisplay extends Component {
    @property(Prefab)
    ballDisplayPrefab: Prefab = null;

    @property(Node)
    ballContainer: Node = null;

    // ==================== 水平段设置（包含发射口） ====================
    @property({ tooltip: '发射口X坐标（屏幕中间）' })
    launchPosX: number = 0;

    @property({ tooltip: '水平段Y坐标（发射口和水平段在同一高度）' })
    horizontalY: number = 450;

    @property({ tooltip: '水平段小球间距' })
    horizontalSpacing: number = 50;

    @property({ tooltip: '水平段可容纳的小球数量（含发射口）' })
    horizontalSlots: number = 7;

    // ==================== 垂直段设置（从水平段最左边向下延伸） ====================
    @property({ tooltip: '垂直段小球间距（向下）' })
    verticalSpacing: number = 50;

    private _ballNodes: Node[] = [];

    start() {
        this.updateDisplay();
    }

    updateDisplay() {
        const gameManager = GameManager.instance;
        if (!gameManager) return;

        const pipeBalls = gameManager.pipeBalls;
        const visibleCount = Math.min(pipeBalls.length, GameConfig.VISIBLE_PIPE_SLOTS);

        console.log(`[PipeDisplay] updateDisplay - pipeBalls: [${pipeBalls.join(',')}], visibleCount: ${visibleCount}, _ballNodes.length: ${this._ballNodes.length}, ballContainer: ${this.ballContainer ? this.ballContainer.name : 'null'}`);

        // 清除多余的显示节点
        while (this._ballNodes.length > visibleCount) {
            const node = this._ballNodes.pop();
            console.log(`[PipeDisplay] 移除多余节点: ${node?.name}`);
            if (node && node.isValid) {
                node.destroy();
            }
        }

        // 创建或更新显示节点
        for (let i = 0; i < visibleCount; i++) {
            const value = pipeBalls[i];
            let ballNode: Node;

            if (i < this._ballNodes.length) {
                ballNode = this._ballNodes[i];
            } else {
                ballNode = this.createBallDisplay();
                if (ballNode) {
                    this._ballNodes.push(ballNode);
                }
            }

            if (ballNode && ballNode.isValid) {
                this.updateBallDisplay(ballNode, value, i);
            }
        }
    }

    private createBallDisplay(): Node {
        if (this.ballDisplayPrefab) {
            const node = instantiate(this.ballDisplayPrefab);
            const container = this.ballContainer || this.node;
            node.setParent(container);
            
            // 禁用物理组件（管道显示不需要物理）
            const rigidBody = node.getComponent(RigidBody2D);
            if (rigidBody) {
                rigidBody.enabled = false;
            }
            const collider = node.getComponent(Collider2D);
            if (collider) {
                collider.enabled = false;
            }
            
            // 禁用 SmallBall 脚本
            const smallBall = node.getComponent(SmallBall);
            if (smallBall) {
                smallBall.enabled = false;
            }
            
            return node;
        }

        // 如果没有预制体，创建简单的显示节点
        const node = new Node('BallDisplay');
        const container = this.ballContainer || this.node;
        node.setParent(container);

        // 添加 UITransform
        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(40, 40);

        // 添加 Sprite 作为背景
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 创建 Label 子节点
        const labelNode = new Node('Label');
        labelNode.setParent(node);
        const labelTransform = labelNode.addComponent(UITransform);
        labelTransform.setContentSize(40, 40);
        const label = labelNode.addComponent(Label);
        label.fontSize = 16;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(0, 0, 0, 255);

        return node;
    }

    /**
     * 获取水平段最左边小球的X坐标（也是垂直段的X坐标）
     */
    public getLeftmostX(): number {
        return this.launchPosX - (this.horizontalSlots - 1) * this.horizontalSpacing;
    }
    
    /**
     * 获取管道L形转弯点坐标
     */
    public getCornerPosition(): { x: number, y: number } {
        return {
            x: this.getLeftmostX(),
            y: this.horizontalY
        };
    }

    /**
     * 根据索引计算小球在管道中的位置
     * 
     * 布局：
     * - index=0: 发射口位置（launchPosX, horizontalY）
     * - index=1~(horizontalSlots-1): 水平段，从发射口向左排列
     * - index>=horizontalSlots: 垂直段，从水平段最左边向下延伸
     */
    public getBallPosition(index: number): { x: number, y: number } {
        if (index < this.horizontalSlots) {
            // 水平段（含发射口）：从发射口向左排列
            const x = this.launchPosX - index * this.horizontalSpacing;
            return {
                x: x,
                y: this.horizontalY
            };
        }

        // 垂直段：从水平段最左边向下延伸
        // 垂直段第一个球（index = horizontalSlots）在最左边小球的正下方
        const verticalIndex = index - this.horizontalSlots + 1;
        const y = this.horizontalY - verticalIndex * this.verticalSpacing;
        return {
            x: this.getLeftmostX(),
            y: y
        };
    }
    
    /**
     * 获取管道末尾位置（新球进入管道的目标位置）
     */
    public getEndPosition(): { x: number, y: number } {
        const gameManager = GameManager.instance;
        if (!gameManager) {
            return this.getBallPosition(0);
        }
        const pipeLength = gameManager.pipeBalls.length;
        return this.getBallPosition(pipeLength);
    }
    
    /**
     * 获取增加管道容量按钮应该显示的位置
     * 位置在当前管道容量的末尾后一位
     */
    public getAddCapacityButtonPosition(): { x: number, y: number } {
        const gameManager = GameManager.instance;
        if (!gameManager) {
            return this.getBallPosition(GameConfig.INITIAL_PIPE_CAPACITY);
        }
        const pipeCapacity = gameManager.pipeCapacity;
        return this.getBallPosition(pipeCapacity);
    }

    private updateBallDisplay(node: Node, value: number, index: number) {
        // 获取位置（不缩放，使用原始大小）
        const pos = this.getBallPosition(index);
        node.setPosition(pos.x, pos.y, 0);
        node.setScale(1, 1, 1);

        // 如果使用 SmallBall 预制体，通过 SmallBall 组件更新
        const smallBall = node.getComponent(SmallBall);
        if (smallBall) {
            smallBall.setValue(value);
            return;
        }

        // 否则手动更新颜色和标签
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            const colorHex = GameConfig.getBallColor(value);
            sprite.color = new Color().fromHEX(colorHex);
        }

        // 更新数值标签
        const labelNode = node.getChildByName('Label');
        if (labelNode) {
            const label = labelNode.getComponent(Label);
            if (label) {
                label.string = value.toString();
            }
        } else {
            const label = node.getComponentInChildren(Label);
            if (label) {
                label.string = value.toString();
            }
        }
    }

    /**
     * 隐藏从指定索引开始的所有小球（用于合成动画）
     */
    hideFromIndex(index: number) {
        for (let i = index; i < this._ballNodes.length; i++) {
            const node = this._ballNodes[i];
            if (node && node.isValid) {
                node.active = false;
            }
        }
    }
    
    /**
     * 隐藏指定索引的小球
     */
    hideAtIndex(index: number) {
        if (index >= 0 && index < this._ballNodes.length) {
            const node = this._ballNodes[index];
            if (node && node.isValid) {
                node.active = false;
            }
        }
    }
    
    /**
     * 显示所有小球
     */
    showAll() {
        for (const node of this._ballNodes) {
            if (node && node.isValid) {
                node.active = true;
            }
        }
    }

    /**
     * 隐藏所有小球
     */
    hideAll() {
        for (const node of this._ballNodes) {
            if (node && node.isValid) {
                node.active = false;
            }
        }
    }

    clearDisplay() {
        for (const node of this._ballNodes) {
            if (node && node.isValid) {
                node.destroy();
            }
        }
        this._ballNodes = [];
    }

    onDestroy() {
        this.clearDisplay();
    }
}
