import { _decorator, Component } from 'cc';
import { GameConfig } from './GameConfig';

const { ccclass } = _decorator;

/** 好友排行单项 */
export interface FriendRankItem {
    openid: string;
    nickname: string;
    avatarUrl?: string;
    score: number;
}

/**
 * 排行榜管理
 * - 游戏结束时将分数写入微信云托管（setUserCloudStorage）
 * - 拉取好友托管数据用于排行榜与超越好友提示（getFriendCloudStorage 在开放数据域中可用）
 *
 * 使用：在场景中挂到常驻节点上（如 Canvas 或 Popups），保证 GameOver 时能访问 instance。
 */
@ccclass('LeaderboardManager')
export class LeaderboardManager extends Component {
    private static _instance: LeaderboardManager = null;
    public static get instance(): LeaderboardManager {
        return this._instance;
    }

    /** 最近一次拉取的好友列表（按分数降序），用于超越好友数计算 */
    private _lastFriendList: FriendRankItem[] = [];

    onLoad() {
        if (LeaderboardManager._instance) {
            this.destroy();
            return;
        }
        LeaderboardManager._instance = this;
    }

    onDestroy() {
        if (LeaderboardManager._instance === this) {
            LeaderboardManager._instance = null;
        }
    }

    /**
     * 是否在微信小游戏环境且支持云存储
     */
    public isWxCloudAvailable(): boolean {
        return typeof wx !== 'undefined' && typeof wx.setUserCloudStorage === 'function';
    }

    /**
     * 将本局分数写入微信用户托管数据（用于好友排行榜）
     * 主域、开放数据域均可调用
     */
    public saveScoreToCloud(score: number): void {
        if (!this.isWxCloudAvailable()) return;
        const key = GameConfig.CLOUD_STORAGE_KEY_SCORE;
        wx.setUserCloudStorage({
            KVDataList: [{ key, value: String(score) }],
            success: () => { console.log('[LeaderboardManager] 分数已写入云托管:', score); },
            fail: (err) => { console.warn('[LeaderboardManager] 写入云托管失败', err); }
        });
    }

    /**
     * 拉取好友云托管数据并排序
     * 注意：getFriendCloudStorage 在微信中需在开放数据域调用；主域调用可能失败，返回空数组
     */
    public getFriendRankList(): Promise<FriendRankItem[]> {
        return new Promise((resolve) => {
            if (typeof wx === 'undefined' || typeof wx.getFriendCloudStorage !== 'function') {
                this._lastFriendList = [];
                resolve([]);
                return;
            }
            wx.getFriendCloudStorage({
                keyList: [GameConfig.CLOUD_STORAGE_KEY_SCORE],
                success: (res) => {
                    const list = (res.data || []).map((user: any) => {
                        const kv = (user.KVDataList || []).find((k: any) => k.key === GameConfig.CLOUD_STORAGE_KEY_SCORE);
                        const score = kv ? (parseInt(kv.value, 10) || 0) : 0;
                        return {
                            openid: user.openid || '',
                            nickname: user.nickname || user.nickName || '未知',
                            avatarUrl: user.avatarUrl || user.avatar,
                            score
                        } as FriendRankItem;
                    });
                    list.sort((a, b) => b.score - a.score);
                    this._lastFriendList = list;
                    resolve(list);
                },
                fail: () => {
                    this._lastFriendList = [];
                    resolve([]);
                }
            });
        });
    }

    /**
     * 根据当前分数计算超越了多少名好友（分数严格大于好友分数的人数）
     */
    public getSurpassedCount(currentScore: number, list?: FriendRankItem[]): number {
        const rankList = list != null ? list : this._lastFriendList;
        return rankList.filter((item) => item.score > 0 && currentScore > item.score).length;
    }

    /**
     * 获取最近一次拉取的好友列表（供 UI 显示）
     */
    public getLastFriendList(): FriendRankItem[] {
        return this._lastFriendList.slice();
    }
}
