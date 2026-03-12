/**
 * 微信小程序 API 类型声明
 * 仅包含本项目使用到的 API
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

interface Wx {
    createRewardedVideoAd(options: WxRewardedVideoAdOptions): WxRewardedVideoAd;
}

declare const wx: Wx | undefined;
