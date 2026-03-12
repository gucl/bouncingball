import { _decorator, Component, Label, Sprite, Color, Collider2D, Contact2DType, IPhysics2DContact, RigidBody2D, ERigidBody2DType, Vec2, Vec3, CircleCollider2D, BoxCollider2D, tween, Tween } from 'cc';
import { GameConfig } from './GameConfig';
import { GameManager } from './GameManager';
import { SmallBall, SmallBallState } from './SmallBall';
import { BallManager } from './BallManager';

const { ccclass, property } = _decorator;

export enum BigBallShape {
    CIRCLE = 0,
    SQUARE = 1,
    DIAMOND = 2  // 菱形（方形旋转45度）
}

@ccclass('BigBall')
export class BigBall extends Component {
    private valueLabel: Label = null;
    private ballSprite: Sprite = null;
    private _collider: Collider2D = null;
    private _rigidBody: RigidBody2D = null;

    private _value: number = 32;
    private _shape: BigBallShape = BigBallShape.CIRCLE;
    private _layer: number = 1;
    private _hitCooldowns: Map<string, number> = new Map();
    
    // 放缩动效相关
    private _isAnimating: boolean = false;  // 是否正在播放动效
    private _scaleTween: Tween<any> = null; // 当前的缩放动画

    public get value(): number { return this._value; }
    public get shape(): BigBallShape { return this._shape; }
    public get layer(): number { return this._layer; }
    public get isAnimating(): boolean { return this._isAnimating; }

    init(value: number, shape: BigBallShape, layer: number) {
        this._value = value;
        this._shape = shape;
        this._layer = layer;
        this.updateVisual();
    }

    setLayer(layer: number) {
        this._layer = layer;
    }

    onLoad() {
        this.valueLabel = this.node.getComponentInChildren(Label);
        this.ballSprite = this.getComponent(Sprite);
        this._collider = this.getComponent(Collider2D);
        this._rigidBody = this.getComponent(RigidBody2D);
        
        this.updateVisual();
    }

    start() {
        // 确保刚体是静态的
        if (this._rigidBody) {
            this._rigidBody.type = ERigidBody2DType.Static;
            this._rigidBody.enabledContactListener = true;
            this._rigidBody.group = GameConfig.GROUP_DEFAULT;
        }
        
        if (this._collider) {
            // 根据形状设置碰撞器大小
            this.applyColliderSize();
            
            this._collider.restitution = GameConfig.BIG_BALL_RESTITUTION;
            this._collider.friction = GameConfig.BIG_BALL_FRICTION;
            this._collider.group = GameConfig.GROUP_DEFAULT;
            // 应用碰撞器更改
            this._collider.apply();
            this._collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }
    
    /**
     * 根据形状和配置设置碰撞器大小
     */
    private applyColliderSize() {
        if (this._shape === BigBallShape.CIRCLE) {
            const circleCollider = this._collider as CircleCollider2D;
            if (circleCollider && circleCollider.radius !== undefined) {
                circleCollider.radius = GameConfig.BIG_BALL_RADIUS_CIRCLE;
            }
        } else if (this._shape === BigBallShape.SQUARE) {
            const boxCollider = this._collider as BoxCollider2D;
            if (boxCollider && boxCollider.size !== undefined) {
                const size = GameConfig.BIG_BALL_RADIUS_SQUARE * 2;
                boxCollider.size.set(size, size);
            }
        } else if (this._shape === BigBallShape.DIAMOND) {
            // 菱形使用方形碰撞器，但节点旋转45度
            const boxCollider = this._collider as BoxCollider2D;
            if (boxCollider && boxCollider.size !== undefined) {
                const size = GameConfig.BIG_BALL_RADIUS_DIAMOND * 2;
                boxCollider.size.set(size, size);
            }
            // 旋转节点45度形成菱形效果
            this.node.setRotationFromEuler(0, 0, 45);
            // 让数值文本反向旋转，保持正向显示
            if (this.valueLabel && this.valueLabel.node) {
                this.valueLabel.node.setRotationFromEuler(0, 0, -45);
            }
        }
    }

    onDestroy() {
        // 停止动画
        if (this._scaleTween) {
            this._scaleTween.stop();
            this._scaleTween = null;
        }
        
        if (this._collider) {
            this._collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    private updateVisual() {
        if (this.valueLabel) {
            this.valueLabel.string = this.formatValue(this._value);
        }

        if (this.ballSprite) {
            const color = this.getColorByValue();
            this.ballSprite.color = new Color().fromHEX(color);
        }
    }

    private formatValue(value: number): string {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return value.toString();
    }

    private getColorByValue(): string {
        const exp = GameConfig.getExponent(this._value);
        if (exp <= 6) return '#E8E8E8';
        if (exp <= 8) return '#C8E6C9';
        if (exp <= 10) return '#BBDEFB';
        if (exp <= 12) return '#FFE0B2';
        if (exp <= 14) return '#FFCDD2';
        return '#E1BEE7';
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact) {
        const otherNode = otherCollider.node;
        const smallBall = otherNode.getComponent(SmallBall);
        
        if (!smallBall) return;
        
        if (smallBall.state === SmallBallState.FLYING || smallBall.state === SmallBallState.LAUNCHING) {
            const ballId = otherNode.uuid;
            const now = Date.now() / 1000;
            const lastHit = this._hitCooldowns.get(ballId) || 0;
            
            if (now - lastHit >= GameConfig.BIG_BALL_HIT_COOLDOWN) {
                this._hitCooldowns.set(ballId, now);
                
                // 给小球施加额外的弹射速度（保底速度，防止小球卡在大球上）
                this.applyBounceSpeed(smallBall);
                
                this.onHitBySmallBall(smallBall);
            }
        }
    }
    
    private applyBounceSpeed(smallBall: SmallBall) {
        const smallBallRigidBody = smallBall.node.getComponent(RigidBody2D);
        if (!smallBallRigidBody) return;
        
        // 获取当前速度
        const currentVelocity = smallBallRigidBody.linearVelocity;
        const currentSpeed = Math.sqrt(currentVelocity.x * currentVelocity.x + currentVelocity.y * currentVelocity.y);
        
        // 保底弹射速度
        const minBounceSpeed = GameConfig.BIG_BALL_BOUNCE_SPEED;
        
        // 只有当当前速度低于保底速度时，才进行速度补偿
        if (currentSpeed < minBounceSpeed) {
            // 计算从大球中心指向小球中心的方向
            const bigBallPos = this.node.worldPosition;
            const smallBallPos = smallBall.node.worldPosition;
            
            const dirX = smallBallPos.x - bigBallPos.x;
            const dirY = smallBallPos.y - bigBallPos.y;
            const length = Math.sqrt(dirX * dirX + dirY * dirY);
            
            if (length < 0.001) return;
            
            // 归一化方向
            const normalizedDirX = dirX / length;
            const normalizedDirY = dirY / length;
            
            // 检查是否是近乎垂直的碰撞（容易导致卡住）
            // 如果水平分量太小，添加随机水平扰动
            const horizontalRatio = Math.abs(normalizedDirX);
            const minHorizontalRatio = 0.3; // 最小水平分量比例
            
            let finalDirX = normalizedDirX;
            let finalDirY = normalizedDirY;
            
            if (horizontalRatio < minHorizontalRatio) {
                // 添加随机水平扰动，打破垂直弹跳循环
                const randomSign = Math.random() > 0.5 ? 1 : -1;
                const horizontalBoost = minHorizontalRatio * randomSign;
                
                finalDirX = horizontalBoost;
                // 重新计算垂直分量以保持单位向量
                finalDirY = normalizedDirY > 0 ? 
                    Math.sqrt(1 - finalDirX * finalDirX) : 
                    -Math.sqrt(1 - finalDirX * finalDirX);
            }
            
            const newVelocity = new Vec2(
                finalDirX * minBounceSpeed,
                finalDirY * minBounceSpeed
            );
            smallBallRigidBody.linearVelocity = newVelocity;
        }
    }

    private onHitBySmallBall(smallBall: SmallBall) {
        const damage = smallBall.value;
        this._value -= damage;
        
        GameManager.instance?.addScore(damage);
        
        if (this._value <= 0) {
            this.onDestroyed();
        } else {
            this.updateVisual();
            // 播放放缩动效（仅在未播放动效时触发）
            this.playHitAnimation();
        }
    }
    
    /**
     * 播放被碰撞的放缩动效
     * 动效期间不会重复触发，但物理碰撞仍然按当前缩放进行
     */
    private playHitAnimation() {
        // 如果正在播放动效，不重复触发
        if (this._isAnimating) {
            return;
        }
        
        this._isAnimating = true;
        
        const maxScale = GameConfig.BIG_BALL_HIT_SCALE_MAX;
        const minScale = GameConfig.BIG_BALL_HIT_SCALE_MIN;
        const duration = GameConfig.BIG_BALL_HIT_ANIM_DURATION;
        
        // 放大阶段时长为总时长的一半
        const expandDuration = duration / 2;
        const shrinkDuration = duration / 2;
        
        // 停止之前的动画（如果有）
        if (this._scaleTween) {
            this._scaleTween.stop();
        }
        
        // 创建放大->缩小的动画序列
        this._scaleTween = tween(this.node)
            .to(expandDuration, { scale: new Vec3(maxScale, maxScale, 1) })
            .to(shrinkDuration, { scale: new Vec3(minScale, minScale, 1) })
            .call(() => {
                this._isAnimating = false;
                this._scaleTween = null;
            })
            .start();
    }
    
    // 注意：移除了 update 中的碰撞器实时更新
    // 原因：频繁调用 collider.apply() 会严重影响性能
    // 大球的缩放动画只是视觉效果，碰撞器大小保持不变

    private onDestroyed() {
        // 立即停止动效
        if (this._scaleTween) {
            this._scaleTween.stop();
            this._scaleTween = null;
        }
        this._isAnimating = false;
        
        const position = this.node.position.clone();
        
        BallManager.instance?.removeBigBall(this);
        
        // 按概率产出待获得小球
        if (GameConfig.shouldSpawnPendingBall()) {
            const pendingValue = GameConfig.generatePendingBallValue();
            this.scheduleOnce(() => {
                BallManager.instance?.createPendingBall(position, pendingValue);
            }, 0);
        }
        
        // 延迟销毁大球
        this.scheduleOnce(() => {
            if (this.node && this.node.isValid) {
                this.node.destroy();
            }
        }, 0);
    }

    /**
     * 强制销毁（被炸弹或激光销毁时调用）
     * 无论数值多少都立即销毁，并产出待获得小球
     */
    public forceDestroy() {
        // 记录原始数值用于计算分数
        const originalValue = this._value;
        GameManager.instance?.addScore(originalValue);
        
        this._value = 0;
        this.onDestroyed();
    }

    moveUp(): boolean {
        this._layer++;
        if (this._layer >= GameConfig.FAIL_LAYER) {
            return true;
        }
        return false;
    }
}
