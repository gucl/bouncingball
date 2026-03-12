import { _decorator, Component, PhysicsSystem2D, EPhysics2DDrawFlags, Vec2 } from 'cc';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

@ccclass('PhysicsConfig')
export class PhysicsConfig extends Component {
    @property({ tooltip: '是否启用物理调试绘制' })
    enableDebugDraw: boolean = true;

    onLoad() {
        this.initPhysics();
    }

    private initPhysics() {
        const physics = PhysicsSystem2D.instance;
        if (!physics) return;

        physics.enable = true;
        physics.gravity = new Vec2(GameConfig.GRAVITY_X, GameConfig.GRAVITY_Y);
        physics.allowSleep = false;
        physics.fixedTimeStep = 1/120;
        physics.maxSubSteps = 8;

        const matrix = physics.collisionMatrix;
        if (matrix) {
            matrix[0] = 1;
        }

        if (this.enableDebugDraw) {
            physics.debugDrawFlags = 
                EPhysics2DDrawFlags.Aabb |
                EPhysics2DDrawFlags.Shape;
        }
    }
}
