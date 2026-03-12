import { _decorator, Component, Node, Vec2, Vec3, RigidBody2D, CircleCollider2D, Collider2D, Contact2DType, ERigidBody2DType, IPhysics2DContact } from 'cc';
import { GameConfig } from './GameConfig';
import { ItemManager } from './ItemManager';
import { BigBall } from './BigBall';
import { WallCollider, WallType } from './WallCollider';

const { ccclass, property } = _decorator;

/**
 * 炸弹球组件 - 碰到大球时爆炸，销毁范围内的大球
 * 碰到底部墙壁时直接销毁（不爆炸）
 * 碰到其他墙壁时反弹
 */
@ccclass('BombBall')
export class BombBall extends Component {
    private _rigidBody: RigidBody2D = null;
    private _collider: CircleCollider2D = null;
    private _hasExploded: boolean = false;
    private _isDestroyed: boolean = false;

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
        // 设置刚体属性
        this._rigidBody.type = ERigidBody2DType.Dynamic;
        this._rigidBody.gravityScale = 0;  // 不受重力影响
        this._rigidBody.linearDamping = 0;
        this._rigidBody.angularDamping = 0;
        this._rigidBody.allowSleep = false;
        this._rigidBody.enabledContactListener = true;
        
        // 设置碰撞器
        this._collider.radius = GameConfig.BOMB_BALL_RADIUS;
        this._collider.restitution = 1;  // 完全弹性碰撞（用于墙壁反弹）
        this._collider.friction = 0;
        this._collider.apply();
        
        // 监听碰撞
        this._collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
    }

    onDestroy() {
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    /**
     * 发射炸弹球
     */
    public launch(direction: Vec2) {
        if (!this._rigidBody) return;
        
        const speed = GameConfig.BOMB_BALL_SPEED;
        const normalizedDir = direction.clone().normalize();
        
        this._rigidBody.linearVelocity = new Vec2(
            normalizedDir.x * speed,
            normalizedDir.y * speed
        );
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact) {
        if (this._hasExploded || this._isDestroyed) return;
        
        // 检查是否碰到大球
        const bigBall = otherCollider.node.getComponent(BigBall);
        if (bigBall) {
            this._hasExploded = true;
            this.explode();
            return;
        }
        
        // 检查是否碰到底部墙壁
        const wallCollider = otherCollider.node.getComponent(WallCollider);
        if (wallCollider && wallCollider.wallType === WallType.BOTTOM) {
            this._isDestroyed = true;
            this.destroyBomb();
            return;
        }
        // 碰到其他墙壁会自动反弹（由物理引擎处理）
    }

    private explode() {
        // 触发爆炸效果
        const itemManager = ItemManager.instance;
        if (itemManager) {
            itemManager.explodeBomb(this.node.worldPosition);
        }
        
        // 销毁炸弹球
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0);
    }

    /**
     * 直接销毁炸弹球（不触发爆炸）
     */
    private destroyBomb() {
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0);
    }

    update(deltaTime: number) {
        // 检查是否超出边界（安全检查）
        const pos = this.node.position;
        if (pos.y < GameConfig.BOUNDARY_BOTTOM - 100 || 
            pos.y > GameConfig.BOUNDARY_TOP + 100 ||
            pos.x < GameConfig.BOUNDARY_LEFT - 100 ||
            pos.x > GameConfig.BOUNDARY_RIGHT + 100) {
            if (this.node && this.node.isValid && !this._isDestroyed) {
                this._isDestroyed = true;
                this.node.destroy();
            }
        }
    }
}
