import { _decorator, Component, Collider2D, RigidBody2D, Contact2DType, IPhysics2DContact, Enum, ERigidBody2DType } from 'cc';
import { SmallBall, SmallBallState } from './SmallBall';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

export enum WallType {
    LEFT = 0,
    RIGHT = 1,
    BOTTOM = 2,
    PIPE_EXIT = 3
}

const WallTypeEnum = Enum(WallType);

@ccclass('WallCollider')
export class WallCollider extends Component {
    @property({ type: WallTypeEnum })
    wallType: WallType = WallType.LEFT;

    private collider: Collider2D = null;
    private rigidBody: RigidBody2D = null;

    onLoad() {
        this.collider = this.getComponent(Collider2D);
        this.rigidBody = this.getComponent(RigidBody2D);
    }

    start() {
        if (this.rigidBody) {
            this.rigidBody.type = ERigidBody2DType.Static;
            this.rigidBody.enabledContactListener = true;
            this.rigidBody.group = GameConfig.GROUP_DEFAULT;
        }
        
        if (this.collider) {
            this.collider.group = GameConfig.GROUP_DEFAULT;
            
            if (this.wallType === WallType.LEFT || this.wallType === WallType.RIGHT) {
                this.collider.restitution = GameConfig.WALL_SIDE_RESTITUTION;
                this.collider.friction = GameConfig.WALL_SIDE_FRICTION;
            } else if (this.wallType === WallType.BOTTOM) {
                this.collider.restitution = GameConfig.WALL_BOTTOM_RESTITUTION;
                this.collider.friction = GameConfig.WALL_BOTTOM_FRICTION;
            }
            
            this.collider.apply();
            this.collider.on(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    onDestroy() {
        if (this.collider) {
            this.collider.off(Contact2DType.BEGIN_CONTACT, this.onBeginContact, this);
        }
    }

    private onBeginContact(selfCollider: Collider2D, otherCollider: Collider2D, contact: IPhysics2DContact) {
        const otherNode = otherCollider.node;
        const smallBall = otherNode.getComponent(SmallBall);

        if (!smallBall) return;
        
        if (this.wallType === WallType.BOTTOM) {
            if (smallBall.state !== SmallBallState.RECYCLING && smallBall.state !== SmallBallState.IN_PIPE) {
                this.scheduleOnce(() => {
                    if (smallBall && smallBall.node && smallBall.node.isValid) {
                        smallBall.recycle();
                    }
                }, 0);
            }
        }
    }
}
