import { _decorator, Component, Label, Node, Sprite, Color, sys } from 'cc';
import { GameManager } from './GameManager';
import { GameConfig } from './GameConfig';

const { ccclass, property } = _decorator;

@ccclass('ScoreDisplay')
export class ScoreDisplay extends Component {
    @property(Label)
    scoreLabel: Label = null;
    
    @property(Label)
    highScoreLabel: Label = null;
    
    @property(Label)
    roundLabel: Label = null;
    
    @property({ type: Node, tooltip: '最大小球显示节点（包含Sprite和Label子节点）' })
    maxBallNode: Node = null;
    
    @property({ type: Sprite, tooltip: '最大小球的Sprite组件' })
    maxBallSprite: Sprite = null;
    
    @property({ type: Label, tooltip: '最大小球的数值Label' })
    maxBallValueLabel: Label = null;
    
    private _highScore: number = 0;
    private _lastScore: number = -1;
    private _lastRound: number = -1;
    private _lastMaxBallValue: number = -1;
    
    private static readonly HIGH_SCORE_KEY = 'tanqiu2048_high_score';

    onLoad() {
        this.loadHighScore();
    }

    start() {
        // 初始隐藏最大小球显示（在start中执行，确保节点已完全初始化）
        if (this.maxBallNode) {
            this.maxBallNode.active = false;
        }
        this.updateDisplay();
    }

    update(deltaTime: number) {
        this.updateDisplay();
    }
    
    private updateDisplay() {
        const gameManager = GameManager.instance;
        if (!gameManager) return;
        
        const currentScore = gameManager.totalScore;
        const currentRound = gameManager.currentRound;
        const currentMaxBallValue = gameManager.maxBallValue;
        
        // 只在数值变化时更新，避免频繁更新
        if (currentScore !== this._lastScore) {
            this._lastScore = currentScore;
            this.updateScoreLabel(currentScore);
            this.checkAndUpdateHighScore(currentScore);
        }
        
        if (currentRound !== this._lastRound) {
            this._lastRound = currentRound;
            this.updateRoundLabel(currentRound);
        }
        
        if (currentMaxBallValue !== this._lastMaxBallValue) {
            this._lastMaxBallValue = currentMaxBallValue;
            this.updateMaxBallDisplay(currentMaxBallValue);
        }
    }
    
    private updateScoreLabel(score: number) {
        if (this.scoreLabel) {
            this.scoreLabel.string = this.formatNumber(score);
        }
    }
    
    private updateRoundLabel(round: number) {
        if (this.roundLabel) {
            this.roundLabel.string = `第 ${round} 回合`;
        }
    }
    
    private updateMaxBallDisplay(value: number) {
        if (!this.maxBallNode) return;
        
        if (value > 0) {
            // 显示最大小球
            this.maxBallNode.active = true;
            
            // 更新颜色
            if (this.maxBallSprite) {
                const colorHex = GameConfig.getBallColor(value);
                this.maxBallSprite.color = new Color().fromHEX(colorHex);
            }
            
            // 更新数值文本
            if (this.maxBallValueLabel) {
                this.maxBallValueLabel.string = this.formatBallValue(value);
                this.maxBallValueLabel.color = new Color(0, 0, 0, 255);
            }
        } else {
            // 隐藏最大小球
            this.maxBallNode.active = false;
        }
    }
    
    private formatBallValue(value: number): string {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 10000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return value.toString();
    }
    
    private checkAndUpdateHighScore(currentScore: number) {
        if (currentScore > this._highScore) {
            this._highScore = currentScore;
            this.saveHighScore();
            this.updateHighScoreLabel();
        }
    }
    
    private updateHighScoreLabel() {
        if (this.highScoreLabel) {
            this.highScoreLabel.string = `最高: ${this.formatNumber(this._highScore)}`;
        }
    }
    
    private formatNumber(num: number): string {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 10000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    private loadHighScore() {
        const saved = sys.localStorage.getItem(ScoreDisplay.HIGH_SCORE_KEY);
        if (saved) {
            this._highScore = parseInt(saved) || 0;
        }
        this.updateHighScoreLabel();
    }
    
    private saveHighScore() {
        sys.localStorage.setItem(ScoreDisplay.HIGH_SCORE_KEY, this._highScore.toString());
    }
    
    public resetHighScore() {
        this._highScore = 0;
        this.saveHighScore();
        this.updateHighScoreLabel();
    }
    
    public refreshDisplay() {
        this._lastScore = -1;
        this._lastRound = -1;
        this._lastMaxBallValue = -1;
        this.updateDisplay();
    }
}
