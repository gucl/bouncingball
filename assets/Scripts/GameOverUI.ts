import { _decorator, Component, Node, Label, Sprite, Color, Button, tween, Vec3, UIOpacity } from 'cc';
import { GameManager } from './GameManager';
import { GameConfig } from './GameConfig';
import { LeaderboardManager } from './LeaderboardManager';

const { ccclass, property } = _decorator;

/**
 * 游戏结束UI组件
 * 显示最终分数、最高合成球、超越好友提示，提供重新开始、分享、排行榜按钮
 */
@ccclass('GameOverUI')
export class GameOverUI extends Component {
    // ==================== UI节点引用 ====================
    @property({ type: Node, tooltip: '游戏结束弹窗根节点' })
    popupNode: Node = null;
    
    @property({ type: Node, tooltip: '半透明遮罩层' })
    maskNode: Node = null;
    
    @property({ type: Node, tooltip: '弹窗内容面板' })
    panelNode: Node = null;
    
    // ==================== 分数显示 ====================
    @property({ type: Label, tooltip: '最终分数标签' })
    finalScoreLabel: Label = null;
    
    @property({ type: Label, tooltip: '最高分数标签' })
    highScoreLabel: Label = null;
    
    @property({ type: Label, tooltip: '本局回合数标签' })
    roundLabel: Label = null;
    
    @property({ type: Label, tooltip: '是否刷新记录提示' })
    newRecordLabel: Label = null;
    
    @property({ type: Label, tooltip: '超越好友提示（如：超越了 3 个好友）' })
    surpassedCountLabel: Label = null;
    
    // ==================== 最大合成球显示 ====================
    @property({ type: Node, tooltip: '最大合成球显示节点' })
    maxBallNode: Node = null;
    
    @property({ type: Sprite, tooltip: '最大合成球Sprite' })
    maxBallSprite: Sprite = null;
    
    @property({ type: Label, tooltip: '最大合成球数值Label' })
    maxBallValueLabel: Label = null;
    
    // ==================== 按钮 ====================
    @property({ type: Button, tooltip: '重新开始按钮' })
    restartButton: Button = null;
    
    @property({ type: Button, tooltip: '分享按钮' })
    shareButton: Button = null;
    
    @property({ type: Button, tooltip: '排行榜按钮（可选）' })
    leaderboardButton: Button = null;
    
    @property({ type: Node, tooltip: '排行榜弹窗节点（可选，点击排行榜按钮时显示）' })
    leaderboardPanel: Node = null;
    
    @property({ type: Label, tooltip: '排行榜弹窗内的列表文字（可选）' })
    rankListLabel: Label = null;
    
    private _isShowing: boolean = false;
    private _isInitialized: boolean = false;
    
    onLoad() {
        this.initComponent();
    }
    
    /**
     * 初始化组件（确保只初始化一次）
     */
    private initComponent() {
        if (this._isInitialized) return;
        this._isInitialized = true;
        
        // 绑定按钮事件
        if (this.restartButton && this.restartButton.node) {
            this.restartButton.node.on(Button.EventType.CLICK, this.onRestartClick, this);
        }
        if (this.shareButton && this.shareButton.node) {
            this.shareButton.node.on(Button.EventType.CLICK, this.onShareClick, this);
        }
        if (this.leaderboardButton && this.leaderboardButton.node) {
            this.leaderboardButton.node.on(Button.EventType.CLICK, this.onLeaderboardClick, this);
        }
        
        console.log('[GameOverUI] 组件已初始化');
    }
    
    onDestroy() {
        if (this.restartButton && this.restartButton.node) {
            this.restartButton.node.off(Button.EventType.CLICK, this.onRestartClick, this);
        }
        if (this.shareButton && this.shareButton.node) {
            this.shareButton.node.off(Button.EventType.CLICK, this.onShareClick, this);
        }
        if (this.leaderboardButton && this.leaderboardButton.node) {
            this.leaderboardButton.node.off(Button.EventType.CLICK, this.onLeaderboardClick, this);
        }
    }
    
    /**
     * 显示游戏结束UI
     * @param finalScore 最终分数
     * @param highScore 最高分数
     * @param maxBallValue 最大合成球数值
     * @param round 本局回合数
     * @param isNewRecord 是否刷新记录
     */
    public show(finalScore: number, highScore: number, maxBallValue: number, round: number, isNewRecord: boolean) {
        console.log('[GameOverUI] show() 被调用');
        
        // 确保组件已初始化（处理节点初始禁用的情况）
        this.initComponent();
        
        if (this._isShowing) {
            console.log('[GameOverUI] 已经在显示中，跳过');
            return;
        }
        this._isShowing = true;
        
        // 更新显示内容
        this.updateDisplay(finalScore, highScore, maxBallValue, round, isNewRecord);
        
        // 先显示「超越好友」占位，再异步拉取好友排行并更新
        this.updateSurpassedCountLabel(finalScore, null);
        const leaderboard = LeaderboardManager.instance;
        if (leaderboard && this.surpassedCountLabel) {
            leaderboard.getFriendRankList().then((list) => {
                if (!this._isShowing || !this.surpassedCountLabel) return;
                this.updateSurpassedCountLabel(finalScore, list);
            });
        }
        
        // 显示弹窗 - 先激活节点本身，再激活 popupNode
        this.node.active = true;
        
        if (this.popupNode) {
            this.popupNode.active = true;
            console.log('[GameOverUI] popupNode 已激活');
        } else {
            console.warn('[GameOverUI] popupNode 为空！请检查属性配置');
        }
        
        // 播放显示动画
        this.playShowAnimation();
    }
    
    /**
     * 更新「超越好友」提示
     * @param finalScore 本局分数
     * @param list 好友排行（null 表示尚未拉取）
     */
    private updateSurpassedCountLabel(finalScore: number, list: { score: number }[] | null) {
        if (!this.surpassedCountLabel) return;
        this.surpassedCountLabel.node.active = true;
        if (list === null) {
            this.surpassedCountLabel.string = '正在加载…';
            return;
        }
        const leaderboard = LeaderboardManager.instance;
        const count = leaderboard ? leaderboard.getSurpassedCount(finalScore, list as any) : 0;
        if (list.length === 0) {
            this.surpassedCountLabel.string = '暂无好友数据';
        } else if (count > 0) {
            this.surpassedCountLabel.string = `超越了 ${count} 个好友！`;
        } else {
            this.surpassedCountLabel.string = '继续加油，超越好友吧';
        }
    }
    
    /**
     * 隐藏游戏结束UI
     */
    public hide() {
        if (!this._isShowing) return;
        
        this.playHideAnimation(() => {
            this._isShowing = false;
            if (this.popupNode) {
                this.popupNode.active = false;
            }
        });
    }
    
    /**
     * 更新显示内容
     */
    private updateDisplay(finalScore: number, highScore: number, maxBallValue: number, round: number, isNewRecord: boolean) {
        // 更新最终分数
        if (this.finalScoreLabel) {
            this.finalScoreLabel.string = this.formatNumber(finalScore);
        }
        
        // 更新最高分数
        if (this.highScoreLabel) {
            this.highScoreLabel.string = `最高记录: ${this.formatNumber(highScore)}`;
        }
        
        // 更新回合数
        if (this.roundLabel) {
            this.roundLabel.string = `坚持了 ${round} 回合`;
        }
        
        // 更新新记录提示
        if (this.newRecordLabel) {
            this.newRecordLabel.node.active = isNewRecord;
            if (isNewRecord) {
                this.newRecordLabel.string = '新记录！';
            }
        }
        
        // 更新最大合成球显示
        this.updateMaxBallDisplay(maxBallValue);
    }
    
    /**
     * 更新最大合成球显示
     */
    private updateMaxBallDisplay(value: number) {
        if (!this.maxBallNode) return;
        
        if (value > 0) {
            this.maxBallNode.active = true;
            
            // 更新颜色
            if (this.maxBallSprite) {
                const colorHex = GameConfig.getBallColor(value);
                this.maxBallSprite.color = new Color().fromHEX(colorHex);
            }
            
            // 更新数值
            if (this.maxBallValueLabel) {
                this.maxBallValueLabel.string = this.formatBallValue(value);
                this.maxBallValueLabel.color = new Color(0, 0, 0, 255);
            }
        } else {
            this.maxBallNode.active = false;
        }
    }
    
    /**
     * 播放显示动画
     */
    private playShowAnimation() {
        // 遮罩淡入
        if (this.maskNode) {
            const maskOpacity = this.maskNode.getComponent(UIOpacity);
            if (maskOpacity) {
                maskOpacity.opacity = 0;
                tween(maskOpacity)
                    .to(0.2, { opacity: 180 })
                    .start();
            }
        }
        
        // 面板弹入
        if (this.panelNode) {
            this.panelNode.setScale(0.5, 0.5, 1);
            tween(this.panelNode)
                .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }
    }
    
    /**
     * 播放隐藏动画
     */
    private playHideAnimation(onComplete: () => void) {
        // 面板缩小
        if (this.panelNode) {
            tween(this.panelNode)
                .to(0.2, { scale: new Vec3(0.5, 0.5, 1) }, { easing: 'backIn' })
                .start();
        }
        
        // 遮罩淡出
        if (this.maskNode) {
            const maskOpacity = this.maskNode.getComponent(UIOpacity);
            if (maskOpacity) {
                tween(maskOpacity)
                    .to(0.2, { opacity: 0 })
                    .call(onComplete)
                    .start();
            } else {
                this.scheduleOnce(onComplete, 0.2);
            }
        } else {
            this.scheduleOnce(onComplete, 0.2);
        }
    }
    
    /**
     * 重新开始按钮点击
     */
    private onRestartClick() {
        this.hide();
        
        // 延迟一点再重新开始，等待隐藏动画完成
        this.scheduleOnce(() => {
            const gameManager = GameManager.instance;
            if (gameManager) {
                gameManager.restartGame();
            }
        }, 0.3);
    }
    
    /**
     * 排行榜按钮点击：显示好友排行弹窗并刷新列表
     */
    private onLeaderboardClick() {
        if (!this.leaderboardPanel) return;
        this.leaderboardPanel.active = !this.leaderboardPanel.active;
        if (this.leaderboardPanel.active && this.rankListLabel) {
            const leaderboard = LeaderboardManager.instance;
            if (leaderboard) {
                leaderboard.getFriendRankList().then((list) => {
                    if (!this.rankListLabel) return;
                    if (list.length === 0) {
                        this.rankListLabel.string = '暂无好友排行\n（需在微信小游戏中游玩并授权）';
                    } else {
                        const lines = list.map((item, i) =>
                            `${i + 1}. ${item.nickname}  ${this.formatNumber(item.score)}分`
                        );
                        this.rankListLabel.string = lines.join('\n');
                    }
                });
            } else {
                this.rankListLabel.string = '暂无排行榜数据';
            }
        }
    }
    
    /**
     * 分享按钮点击
     */
    private onShareClick() {
        // 检查是否在微信环境
        if (typeof wx !== 'undefined' && wx.shareAppMessage) {
            const gameManager = GameManager.instance;
            const score = gameManager?.totalScore || 0;
            const maxBall = gameManager?.maxBallValue || 0;
            
            wx.shareAppMessage({
                title: `我在弹球2048中获得了${this.formatNumber(score)}分，最高合成${this.formatBallValue(maxBall)}！`,
                imageUrl: '', // 可以设置分享图片
            });
        } else {
            console.log('[GameOverUI] 非微信环境，无法分享');
        }
    }
    
    /**
     * 格式化数字
     */
    private formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 10000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }
    
    /**
     * 格式化球数值
     */
    private formatBallValue(value: number): string {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 10000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return value.toString();
    }
}
