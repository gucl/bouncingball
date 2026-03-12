import { _decorator, Component, Node, RigidBody2D, CircleCollider2D, Collider2D, Contact2DType, ERigidBody2DType, IPhysics2DContact, Label, Color, Sprite, tween, Vec3 } from 'cc';
import { GameConfig } from './GameConfig';
import { ItemManager } from './ItemManager';
import { SmallBall, SmallBallState } from './SmallBall';

const { ccclass, property } = _decorator;

/**
 * 翻倍球组件 - 碰到小球时使小球数值翻倍
 */
@ccclass('DoubleBall')
export class DoubleBall extends Component {
    @property(Label)
    countLabel: Label = null;
    
    private _rigidBody: RigidBody2D = null;
    private _collider: CircleCollider2D = null;
    private _remainingHits: number = GameConfig.DOUBLE_BALL_HIT_COUNT;

    onLoad() {
        this._rigidBody = this.node.getComponent(RigidBody2D);
        this._collider = this.node.getComponent(CircleCollider2D);
        
        if (!this._rigidBody) {
            this._rigidBody = this.node.addComponent(RigidBody2D);
        }
        if (!this._collider) {
            this._collider = this.node.addComponent(CircleCollider2D);
        }
    }

    start() {
        // 设置刚体属性（静态，不受物理影响）
        this._rigidBody.type = ERigidBody2DType.Static;
        this._rigidBody.enabledContactListener = true;
        
        // 设置碰撞器（传感器模式，小球穿过时触发翻倍效果）
        this._collider.radius = GameConfig.DOUBLE_BALL_RADIUS;
        this._collider.sensor = true;  // 传感器模式，不产生物理碰撞，小球直接穿过
        this._collider.apply();
        
        // 监听碰撞
        this._collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        
        this.updateDisplay();
    }

    onDestroy() {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact) {
        // 如果剩余次数已经为0，不再处理碰撞
        if (this._remainingHits <= 0) return;
        
        // 检查是否碰到飞行中的小球
        const smallBall = otherCollider.node.getComponent(SmallBall);
        if (smallBall && smallBall.state === SmallBallState.FLYING) {
            this.onHitBySmallBall(smallBall);
        }
    }

    private onHitBySmallBall(smallBall: SmallBall) {
        // 再次检查剩余次数（防止并发碰撞）
        if (this._remainingHits <= 0) return;
        
        // 小球数值翻倍
        smallBall.doubleValue();
        
        // 减少剩余次数
        this._remainingHits--;
        this.updateDisplay();
        
        // 播放缩放动画
        this.playHitAnimation();
        
        // 检查是否用完
        if (this._remainingHits <= 0) {
            this.scheduleOnce(() => {
                const itemManager = ItemManager.instance;
                if (itemManager) {
                    itemManager.removeDoubleBall(this.node);
                }
            }, 0.1);
        }
    }

    private updateDisplay() {
        if (this.countLabel) {
            this.countLabel.string = this._remainingHits.toString();
        }
    }

    private playHitAnimation() {
        tween(this.node)
            .to(0.1, { scale: new Vec3(1.3, 1.3, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
    }
}
