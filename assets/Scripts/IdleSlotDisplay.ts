import { _decorator, Component, Node, Prefab, instantiate, Label, Sprite, Color, UITransform, RigidBody2D, Collider2D } from 'cc';
import { GameConfig } from './GameConfig';
import { GameManager } from './GameManager';
import { SmallBall } from './SmallBall';

const { ccclass, property } = _decorator;

/**
 * 闲置位显示组件
 * 
 * 闲置位用于暂存本回合激活并回收的待获得小球
 * 显示位置：管道L形转弯最下方（与底部墙壁齐平）
 * 显示内容：
 * - 仅显示第1个小球
 * - 小球上方：向上箭头（指向管道）
 * - 小球下方：数量文字（如"6个"）
 */
@ccclass('IdleSlotDisplay')
export class IdleSlotDisplay extends Component {
    @property(Prefab)
    ballDisplayPrefab: Prefab = null;

    @property(Node)
    arrowNode: Node = null;

    @property(Label)
    countLabel: Label = null;

    @property({ tooltip: '闲置位X坐标（与管道垂直段对齐）' })
    posX: number = -300;

    @property({ tooltip: '闲置位Y坐标（与底部墙壁齐平）' })
    posY: number = -550;

    private _ballNode: Node = null;

    onLoad() {
        // 初始时隐藏所有元素
        this.hideAll();
    }

    start() {
        // 确保初始状态正确
        this.updateDisplay();
    }

    updateDisplay() {
        const gameManager = GameManager.instance;
        if (!gameManager) {
            // GameManager 未初始化时，隐藏所有元素
            this.hideAll();
            return;
        }

        const idleSlotBalls = gameManager.idleSlotBalls;
        const count = idleSlotBalls.length;

        // 闲置位没有小球时，隐藏所有元素
        if (count === 0) {
            this.hideAll();
            return;
        }

        // 有小球时才显示
        // 显示第一个小球
        const firstValue = idleSlotBalls[0];
        this.showBall(firstValue);

        // 显示箭头
        if (this.arrowNode) {
            this.arrowNode.active = true;
        }

        // 显示数量文本
        if (this.countLabel) {
            this.countLabel.node.active = true;
            this.countLabel.string = `${count}个`;
        }
    }

    private showBall(value: number) {
        if (!this._ballNode) {
            this._ballNode = this.createBallDisplay();
        }

        if (this._ballNode && this._ballNode.isValid) {
            this._ballNode.active = true;
            this._ballNode.setPosition(this.posX, this.posY, 0);
            this._ballNode.setScale(1, 1, 1);
            this.updateBallValue(this._ballNode, value);
        }
    }

    private hideAll() {
        // 隐藏小球
        if (this._ballNode && this._ballNode.isValid) {
            this._ballNode.active = false;
        }

        // 隐藏箭头
        if (this.arrowNode) {
            this.arrowNode.active = false;
        }

        // 隐藏数量文本，并清空内容
        if (this.countLabel) {
            this.countLabel.node.active = false;
            this.countLabel.string = '';
        }
    }

    private createBallDisplay(): Node {
        if (this.ballDisplayPrefab) {
            const node = instantiate(this.ballDisplayPrefab);
            node.setParent(this.node);

            // 禁用物理组件
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
        const node = new Node('IdleBallDisplay');
        node.setParent(this.node);

        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(40, 40);

        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

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

    private updateBallValue(node: Node, value: number) {
        // 如果使用 SmallBall 预制体
        const smallBall = node.getComponent(SmallBall);
        if (smallBall) {
            smallBall.setValue(value);
            return;
        }

        // 否则手动更新
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            const colorHex = GameConfig.getBallColor(value);
            sprite.color = new Color().fromHEX(colorHex);
        }

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

    clearDisplay() {
        this.hideAll();
    }

    onDestroy() {
        if (this._ballNode && this._ballNode.isValid) {
            this._ballNode.destroy();
        }
    }
}
