import { _decorator, Component, Node, Vec2, Vec3, EventTouch, input, Input, Graphics, UITransform } from 'cc';
import { GameManager, GameState } from './GameManager';
import { GameConfig } from './GameConfig';
import { BallManager } from './BallManager';
import { ItemManager } from './ItemManager';

const { ccclass, property } = _decorator;

@ccclass('LaunchController')
export class LaunchController extends Component {
    @property(Node)
    launcherNode: Node = null;

    @property(Graphics)
    aimLine: Graphics = null;

    private _isTouching: boolean = false;
    private _aimDirection: Vec2 = new Vec2(0, -1);
    private _launcherWorldPos: Vec3 = new Vec3();
    private _bombLaunchedThisTouch: boolean = false;  // 本次触摸是否已发射炸弹
    
    private static _bombJustLaunched: boolean = false;  // 静态标志：刚刚发射了炸弹

    onEnable() {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDisable() {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    private onTouchStart(event: EventTouch) {
        // 炸弹模式下，检查是否已经在触摸中（防止按钮点击触发新的触摸）
        const gm = GameManager.instance;
        if (gm?.isBombMode && this._isTouching) {
            return;
        }
        
        if (!this.canLaunch()) return;
        this._isTouching = true;
        this._bombLaunchedThisTouch = false;
        this.updateAimDirection(event);
    }

    private onTouchMove(event: EventTouch) {
        if (!this._isTouching || !this.canLaunch()) return;
        this.updateAimDirection(event);
    }

    private onTouchEnd(event: EventTouch) {
        // 如果刚刚发射了炸弹（静态标志），忽略这次触摸结束
        if (LaunchController._bombJustLaunched) {
            LaunchController._bombJustLaunched = false;
            this._isTouching = false;
            this.clearAimLine();
            return;
        }
        
        if (!this._isTouching) return;
        
        // 检查是否是炸弹模式
        const gm = GameManager.instance;
        const isBombMode = gm?.isBombMode || false;
        
        if (isBombMode) {
            LaunchController._bombJustLaunched = true;
            this._isTouching = false;
            this.clearAimLine();
            this.launchBomb();
            return;
        }
        
        this._isTouching = false;
        this.clearAimLine();
        
        if (this.canLaunch()) {
            this.launchBalls();
        }
    }

    private updateAimDirection(event: EventTouch) {
        if (!this.launcherNode || !this.aimLine) return;

        // 获取发射口的世界坐标
        this._launcherWorldPos = this.launcherNode.worldPosition.clone();
        
        // 获取触摸点的UI坐标（屏幕坐标）
        const touchPos = event.getUILocation();
        
        // 将触摸坐标转换为 aimLine 节点的本地坐标系
        const aimLineUITransform = this.aimLine.node.getComponent(UITransform);
        if (!aimLineUITransform) return;
        
        // 触摸点转换到 aimLine 的本地坐标
        const localTouchPos = aimLineUITransform.convertToNodeSpaceAR(new Vec3(touchPos.x, touchPos.y, 0));
        
        // 计算方向向量（从原点指向触摸点）
        // aimLine 的原点就是发射口位置
        const dirX = localTouchPos.x;
        const dirY = localTouchPos.y;
        
        // 只允许向下发射（Y必须为负）
        if (dirY >= 0) {
            return;
        }
        
        // 归一化方向
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        if (length > 10) {
            this._aimDirection.set(dirX / length, dirY / length);
            this.drawAimLine();
        }
    }

    private drawAimLine() {
        if (!this.aimLine) return;

        this.aimLine.clear();
        this.aimLine.strokeColor.fromHEX('#FF0000');
        this.aimLine.lineWidth = 4;

        const dashLen = GameConfig.AIM_LINE_DASH_LENGTH;
        const gapLen = GameConfig.AIM_LINE_GAP_LENGTH;
        const totalLen = GameConfig.AIM_LINE_MAX_LENGTH;
        
        let currentLen = 0;
        let drawing = true;
        
        while (currentLen < totalLen) {
            const segLen = drawing ? dashLen : gapLen;
            const nextLen = Math.min(currentLen + segLen, totalLen);
            
            if (drawing) {
                const sx = this._aimDirection.x * currentLen;
                const sy = this._aimDirection.y * currentLen;
                const ex = this._aimDirection.x * nextLen;
                const ey = this._aimDirection.y * nextLen;
                
                this.aimLine.moveTo(sx, sy);
                this.aimLine.lineTo(ex, ey);
            }
            
            currentLen = nextLen;
            drawing = !drawing;
        }
        
        this.aimLine.stroke();
    }

    private clearAimLine() {
        if (this.aimLine) {
            this.aimLine.clear();
        }
    }

    private canLaunch(): boolean {
        const gm = GameManager.instance;
        if (!gm) return false;
        
        // 炸弹模式下也可以瞄准
        if (gm.isBombMode) return true;
        
        return gm.gameState === GameState.READY;
    }

    /**
     * 发射炸弹球
     */
    private launchBomb() {
        const itemManager = ItemManager.instance;
        if (!itemManager) return;
        
        itemManager.launchBomb(this._aimDirection.clone());
    }

    private launchBalls() {
        const gm = GameManager.instance;
        if (!gm) return;

        const totalBalls = gm.startLaunchRound();
        if (totalBalls === 0) return;
        
        gm.setGameState(GameState.LAUNCHING);
        this.launchSequence();
    }

    private launchSequence() {
        const gm = GameManager.instance;
        if (!gm) return;

        if (!gm.hasMoreBallsToLaunch()) {
            gm.setGameState(GameState.WAITING);
            return;
        }

        const value = gm.popFirstBall();
        if (value === null) {
            gm.setGameState(GameState.WAITING);
            return;
        }

        this.launchOneBall(value);
        
        this.scheduleOnce(() => {
            this.launchSequence();
        }, GameConfig.BALL_LAUNCH_INTERVAL);
    }

    private launchOneBall(value: number) {
        const bm = BallManager.instance;
        if (!bm || !this.launcherNode) return;

        const launchPos = this.launcherNode.worldPosition.clone();
        bm.createAndLaunchSmallBall(value, launchPos, this._aimDirection.clone());
    }
}
