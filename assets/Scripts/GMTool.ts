import { _decorator, Component, Node, Button, Label, Toggle } from 'cc';
import { GameManager, GameState } from './GameManager';
import { GameOverUI } from './GameOverUI';

const { ccclass, property } = _decorator;

/**
 * GM测试工具
 * 用于开发测试，正式发布时可以隐藏或删除
 */
@ccclass('GMTool')
export class GMTool extends Component {
    @property({ type: Node, tooltip: 'GM工具面板（包含所有GM按钮）' })
    gmPanel: Node = null;
    
    @property({ type: Button, tooltip: '显示/隐藏GM面板按钮' })
    toggleButton: Button = null;
    
    @property({ type: Button, tooltip: '触发游戏结束按钮' })
    gameOverButton: Button = null;
    
    @property({ type: Toggle, tooltip: '是否为新记录' })
    newRecordToggle: Toggle = null;
    
    @property({ type: Node, tooltip: 'GameOverUI所在节点' })
    gameOverUINode: Node = null;
    
    private _gameOverUI: GameOverUI = null;
    private _isPanelVisible: boolean = false;
    
    onLoad() {
        // 获取 GameOverUI 组件
        if (this.gameOverUINode) {
            this._gameOverUI = this.gameOverUINode.getComponent(GameOverUI);
        }
        
        // 绑定按钮事件
        if (this.toggleButton) {
            this.toggleButton.node.on(Button.EventType.CLICK, this.onTogglePanel, this);
        }
        if (this.gameOverButton) {
            this.gameOverButton.node.on(Button.EventType.CLICK, this.onGameOverClick, this);
        }
        
        // 初始隐藏GM面板
        if (this.gmPanel) {
            this.gmPanel.active = false;
        }
    }
    
    onDestroy() {
        if (this.toggleButton && this.toggleButton.node) {
            this.toggleButton.node.off(Button.EventType.CLICK, this.onTogglePanel, this);
        }
        if (this.gameOverButton && this.gameOverButton.node) {
            this.gameOverButton.node.off(Button.EventType.CLICK, this.onGameOverClick, this);
        }
    }
    
    /**
     * 切换GM面板显示/隐藏
     */
    private onTogglePanel() {
        this._isPanelVisible = !this._isPanelVisible;
        if (this.gmPanel) {
            this.gmPanel.active = this._isPanelVisible;
        }
    }
    
    /**
     * 触发游戏结束
     */
    private onGameOverClick() {
        const gm = GameManager.instance;
        if (!gm) {
            console.warn('[GMTool] GameManager 未找到');
            return;
        }
        
        // 获取是否为新记录
        const isNewRecord = this.newRecordToggle ? this.newRecordToggle.isChecked : false;
        
        // 获取当前游戏数据
        const finalScore = gm.totalScore > 0 ? gm.totalScore : 12345;  // 如果没有分数，使用测试值
        const maxBallValue = gm.maxBallValue > 0 ? gm.maxBallValue : 1024;  // 测试值
        const round = gm.currentRound > 0 ? gm.currentRound : 15;  // 测试值
        
        // 计算最高分
        let highScore = finalScore;
        if (!isNewRecord) {
            highScore = finalScore + 10000;  // 如果不是新记录，最高分比当前分高
        }
        
        // 显示游戏结束UI
        console.log('[GMTool] gameOverUINode:', this.gameOverUINode);
        console.log('[GMTool] _gameOverUI:', this._gameOverUI);
        
        if (this._gameOverUI) {
            // 先激活节点
            if (this.gameOverUINode) {
                this.gameOverUINode.active = true;
                console.log('[GMTool] 已激活 gameOverUINode');
            }
            this._gameOverUI.show(finalScore, highScore, maxBallValue, round, isNewRecord);
        } else {
            console.warn('[GMTool] GameOverUI 组件未找到，尝试重新获取...');
            // 尝试重新获取
            if (this.gameOverUINode) {
                this._gameOverUI = this.gameOverUINode.getComponent(GameOverUI);
                if (this._gameOverUI) {
                    this.gameOverUINode.active = true;
                    this._gameOverUI.show(finalScore, highScore, maxBallValue, round, isNewRecord);
                } else {
                    console.error('[GMTool] gameOverUINode 上没有 GameOverUI 组件！');
                }
            } else {
                console.error('[GMTool] gameOverUINode 未配置！');
            }
        }
        
        console.log(`[GMTool] 触发游戏结束 - 分数: ${finalScore}, 最高分: ${highScore}, 最大球: ${maxBallValue}, 回合: ${round}, 新记录: ${isNewRecord}`);
    }
}
