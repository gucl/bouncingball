/**
 * 微信小游戏 API 类型声明
 * 包含激励视频、云存储（排行榜）、分享等
 */

interface WxRewardedVideoAdOptions {
    adUnitId: string;
}

interface WxRewardedVideoAd {
    show(): Promise<void>;
    load(): Promise<void>;
    onClose(callback: (res: { isEnded: boolean }) => void): void;
    offClose(callback: (res: { isEnded: boolean }) => void): void;
    onError(callback: (err: any) => void): void;
    offError(callback: (err: any) => void): void;
}

/** 云存储 KV 项 */
interface WxKVData {
    key: string;
    value: string;
}

/** 用户托管数据项（好友排行榜） */
interface WxUserGameData {
    openid: string;
    nickname: string;
    avatarUrl: string;
    KVDataList: WxKVData[];
}

interface WxSetUserCloudStorageOptions {
    KVDataList: WxKVData[];
    success?: () => void;
    fail?: (err: any) => void;
    complete?: () => void;
}

interface WxGetUserCloudStorageOptions {
    keyList: string[];
    success?: (res: { KVDataList: WxKVData[] }) => void;
    fail?: (err: any) => void;
    complete?: () => void;
}

interface WxGetFriendCloudStorageOptions {
    keyList: string[];
    success?: (res: { data: WxUserGameData[] }) => void;
    fail?: (err: any) => void;
    complete?: () => void;
}

interface WxShareAppMessageOptions {
    title?: string;
    imageUrl?: string;
    query?: string;
}

interface Wx {
    createRewardedVideoAd(options: WxRewardedVideoAdOptions): WxRewardedVideoAd;
    /** 写用户托管数据（主域、开放数据域均可调用） */
    setUserCloudStorage(options: WxSetUserCloudStorageOptions): void;
    /** 读当前用户托管数据 */
    getUserCloudStorage(options: WxGetUserCloudStorageOptions): void;
    /** 拉取同玩好友托管数据（开放数据域中调用，主域可能受限） */
    getFriendCloudStorage(options: WxGetFriendCloudStorageOptions): void;
    /** 分享给好友 */
    shareAppMessage?(options: WxShareAppMessageOptions): void;
}

declare const wx: Wx | undefined;
