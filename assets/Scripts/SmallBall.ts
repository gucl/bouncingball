import { _decorator, Component, Vec2, RigidBody2D, CircleCollider2D, Label, Sprite, Color, director, ERigidBody2DType, Vec3, Contact2DType, Collider2D, IPhysics2DContact } from 'cc';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

export enum SmallBallState {
    IN_PIPE,
    LAUNCHING,
    FLYING,
    PENDING,
    RECYCLING
}

@ccclass('SmallBall')
export class SmallBall extends Component {
    private valueLabel: Label = null;
    private ballSprite: Sprite = null;
    private rigidBody: RigidBody2D = null;
    private collider: CircleCollider2D = null;

    private _value: number = 2;
    private _state: SmallBallState = SmallBallState.IN_PIPE;
    private _isFromPipe: boolean = true;  // 是否是从管道发射的球（区别于待获得球）

    public get value(): number { return this._value; }
    public get state(): SmallBallState { return this._state; }
    public get isFromPipe(): boolean { return this._isFromPipe; }
    
    public setIsFromPipe(value: boolean) {
        this._isFromPipe = value;
    }

    setValue(value: number) {
        this._value = value;
        this.updateVisual();
    }

    setState(state: SmallBallState) {
        this._state = state;
    }

    onLoad() {
        this.valueLabel = this.node.getComponentInChildren(Label);
        this.ballSprite = this.getComponent(Sprite);
        this.rigidBody = this.getComponent(RigidBody2D);
        this.collider = this.getComponent(CircleCollider2D);
        this.updateVisual();
    }

    start() {
        if (this.rigidBody) {
            this.rigidBody.type = ERigidBody2DType.Dynamic;
            this.rigidBody.enabledContactListener = true;
            this.rigidBody.gravityScale = GameConfig.BALL_GRAVITY_SCALE;
            this.rigidBody.linearDamping = GameConfig.BALL_LINEAR_DAMPING;
            this.rigidBody.angularDamping = GameConfig.BALL_ANGULAR_DAMPING;
            this.rigidBody.allowSleep = false;
            this.rigidBody.group = GameConfig.GROUP_DEFAULT;
        }
        
        if (this.collider) {
            // 从配置读取小球半径
            this.collider.radius = GameConfig.BALL_RADIUS;
            this.collider.restitution = GameConfig.BALL_RESTITUTION;
            this.collider.friction = GameConfig.BALL_FRICTION;
            this.collider.group = GameConfig.GROUP_DEFAULT;
            this.collider.apply();
            this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.collider.on(Contact2DType.PRE_SOLVE, this.onPreSolve, this);
        }
    }
    
    onDestroy() {
        if (this.collider) {
            this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.collider.off(Contact2DType.PRE_SOLVE, this.onPreSolve, this);
        }
    }
    
    // 在物理求解前禁用小球之间的碰撞
    private onPreSolve(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact) {
        const otherSmallBall = otherCollider.node.getComponent(SmallBall);
        
        // 如果碰撞对象也是小球，禁用此次碰撞
        if (otherSmallBall) {
            // 待获得小球与飞行中小球的碰撞需要保留（用于激活）
            // 但物理效果需要禁用
            contact.disabled = true;
        }
    }
    
    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact) {
        const otherSmallBall = otherCollider.node.getComponent(SmallBall);
        
        if (this._state === SmallBallState.PENDING) {
            if (otherSmallBall && (otherSmallBall.state === SmallBallState.FLYING || otherSmallBall.state === SmallBallState.LAUNCHING)) {
                this._state = SmallBallState.RECYCLING;
                this.scheduleOnce(() => {
                    this._state = SmallBallState.PENDING;
                    director.emit('PENDING_BALL_ACTIVATED', this);
                }, 0);
            }
        }
    }

    update(deltaTime: number) {
        if (!this.node || !this.node.isValid) return;
        if (this._state === SmallBallState.RECYCLING || this._state === SmallBallState.IN_PIPE) return;
        
        // 使用本地坐标
        const pos = this.node.position;
        
        // 底部回收检测
        if (pos.y < GameConfig.BOUNDARY_BOTTOM) {
            this.triggerRecycle();
            return;
        }
        
        // 简单的边界限制（空气墙）
        if (this.rigidBody) {
            const velocity = this.rigidBody.linearVelocity;
            
            // 左边界
            if (pos.x < GameConfig.BOUNDARY_LEFT && velocity.x < 0) {
                this.rigidBody.linearVelocity = new Vec2(-velocity.x * 0.8, velocity.y);
                this.node.setPosition(GameConfig.BOUNDARY_LEFT, pos.y, pos.z);
            }
            // 右边界
            else if (pos.x > GameConfig.BOUNDARY_RIGHT && velocity.x > 0) {
                this.rigidBody.linearVelocity = new Vec2(-velocity.x * 0.8, velocity.y);
                this.node.setPosition(GameConfig.BOUNDARY_RIGHT, pos.y, pos.z);
            }
            
            // 顶部边界
            if (pos.y > GameConfig.BOUNDARY_TOP && velocity.y > 0) {
                this.rigidBody.linearVelocity = new Vec2(velocity.x, -velocity.y * 0.8);
                this.node.setPosition(pos.x, GameConfig.BOUNDARY_TOP, pos.z);
            }
        }
    }

    private triggerRecycle() {
        this.recycle();
    }

    private updateVisual() {
        if (this.valueLabel) {
            this.valueLabel.string = this._value.toString();
            this.valueLabel.color = new Color(0, 0, 0, 255);
        }

        if (this.ballSprite) {
            const colorHex = GameConfig.getBallColor(this._value);
            this.ballSprite.color = new Color().fromHEX(colorHex);
        }
    }

    launch(direction: Vec2, speed: number = GameConfig.BALL_INITIAL_SPEED) {
        this._state = SmallBallState.FLYING;
        
        if (this.rigidBody) {
            this.rigidBody.enabled = true;
            this.rigidBody.type = ERigidBody2DType.Dynamic;
            this.rigidBody.gravityScale = GameConfig.BALL_GRAVITY_SCALE;
            this.rigidBody.linearDamping = GameConfig.BALL_LINEAR_DAMPING;
            this.rigidBody.allowSleep = false;
            this.rigidBody.group = GameConfig.GROUP_DEFAULT;
            
            const vx = direction.x * speed;
            const vy = direction.y * speed;
            this.rigidBody.linearVelocity = new Vec2(vx, vy);
        }
        
        if (this.collider) {
            this.collider.enabled = true;
            this.collider.sensor = false;
            this.collider.group = GameConfig.GROUP_DEFAULT;
            this.collider.apply();
        }
    }

    // 设置为待获得状态（半透明，使用sensor模式检测碰撞）
    setAsPending() {
        this._state = SmallBallState.PENDING;
        
        // 设置半透明
        if (this.ballSprite) {
            const color = this.ballSprite.color.clone();
            color.a = 150;  // 半透明
            this.ballSprite.color = color;
        }
        
        // 保持 Dynamic 刚体类型，但禁用重力和运动
        // 这样可以确保与其他 Dynamic 刚体的碰撞检测正常工作
        if (this.rigidBody) {
            this.rigidBody.type = ERigidBody2DType.Dynamic;
            this.rigidBody.gravityScale = 0;  // 不受重力影响
            this.rigidBody.linearVelocity = new Vec2(0, 0);  // 停止运动
            this.rigidBody.angularVelocity = 0;
            this.rigidBody.linearDamping = 1000;  // 极高阻尼防止移动
            this.rigidBody.enabledContactListener = true;
            this.rigidBody.group = GameConfig.GROUP_DEFAULT;
        }
        
        if (this.collider) {
            this.collider.enabled = true;
            this.collider.group = GameConfig.GROUP_DEFAULT;
            // 使用 sensor 模式：可以检测碰撞但不产生物理反弹
            // 这样飞行中的小球可以穿过待获得小球并触发碰撞事件
            this.collider.sensor = true;
            // 确保碰撞事件监听器已注册
            this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
            this.collider.apply();
        }
    }

    // 激活待获得小球，变为正常飞行状态
    // 激活后垂直向上起飞，使用发射初始速度
    activate() {
        if (this._state === SmallBallState.PENDING) {
            // 恢复不透明
            if (this.ballSprite) {
                const color = this.ballSprite.color.clone();
                color.a = 255;
                this.ballSprite.color = color;
            }
            
            // 变为动态刚体
            if (this.rigidBody) {
                this.rigidBody.type = ERigidBody2DType.Dynamic;
                this.rigidBody.gravityScale = GameConfig.BALL_GRAVITY_SCALE;
                this.rigidBody.linearDamping = GameConfig.BALL_LINEAR_DAMPING;
                this.rigidBody.allowSleep = false;
                this.rigidBody.group = GameConfig.GROUP_DEFAULT;
                // 垂直向上起飞，使用发射初始速度
                this.rigidBody.linearVelocity = new Vec2(0, GameConfig.BALL_INITIAL_SPEED);
            }
            
            if (this.collider) {
                this.collider.sensor = false;  // 关闭 sensor 模式，恢复正常物理碰撞
                this.collider.group = GameConfig.GROUP_DEFAULT;
                this.collider.apply();
            }
            
            this._state = SmallBallState.FLYING;
        }
    }

    /**
     * 数值翻倍（被翻倍球碰到时调用）
     */
    doubleValue() {
        this._value *= 2;
        this.updateVisual();
    }

    recycle() {
        if (this._state === SmallBallState.RECYCLING || this._state === SmallBallState.IN_PIPE) return;
        this._state = SmallBallState.RECYCLING;
        director.emit('BALL_RECYCLE', this);
    }

    /**
     * 禁用物理（一键收球时调用，让小球不再与大球碰撞）
     */
    disablePhysics() {
        if (this.collider) {
            this.collider.sensor = true;
            this.collider.apply();
        }
        if (this.rigidBody) {
            this.rigidBody.gravityScale = 5; // 加速下落
            this.rigidBody.linearVelocity = new Vec2(0, -500); // 直接向下
        }
    }
}
