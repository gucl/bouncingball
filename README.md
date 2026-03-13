# 弹球2048 完整技术设计方案

> 版本：v11 - 完整可执行版
> 更新日期：2026-03-06
> 引擎：Cocos Creator 3.8.7
> 目标平台：微信小程序

---

## 一、游戏概述

### 1.1 游戏类型
弹球 + 2048 合成玩法的休闲游戏

### 1.2 核心玩法简述
玩家控制发射口向下发射带有数值（2的幂次方）的小球，小球在碰撞区与大球碰撞，每次碰撞减少大球数值（减少量=小球数值）。当大球数值归零时销毁，有概率产出待获得小球。小球落到底部后回收进管道，相邻且数值相同的小球会合成（数值翻倍）。每回合结束大球上移一层，底部生成新大球。当大球到达第9层时游戏结束。

### 1.3 游戏目标
- 无胜利条件，追求高分
- 通过合成获得更大数值的小球
- 尽可能延长游戏时间

---

## 二、坐标系统与屏幕布局

### 2.1 坐标原点
- 游戏使用 Cocos Creator 的 2D 坐标系
- 原点 (0, 0) 位于 Canvas 中心
- X轴：向右为正
- Y轴：向上为正

### 2.2 设计分辨率
```typescript
DESIGN_WIDTH = 720       // 设计宽度
DESIGN_HEIGHT = 1280     // 设计高度
```

### 2.3 游戏区域边界（空气墙）
```typescript
BOUNDARY_LEFT = -220     // 左边界X坐标
BOUNDARY_RIGHT = 220     // 右边界X坐标
BOUNDARY_TOP = 500       // 顶边界Y坐标
BOUNDARY_BOTTOM = -510   // 底边界Y坐标（小球回收触发线）
```

### 2.4 关键位置坐标
```typescript
LAUNCH_POS_X = 0         // 发射口X坐标（屏幕水平中心）
LAUNCH_POS_Y = 450       // 发射口Y坐标（屏幕上方）
COLLISION_AREA_BOTTOM = -350  // 碰撞区底部Y坐标
```

---

## 三、物理系统配置

### 3.1 重力设置
```typescript
GRAVITY_X = 0            // 重力X分量
GRAVITY_Y = -800         // 重力Y分量（负值向下）
```

### 3.2 碰撞分组
所有物体使用默认碰撞组（GROUP_DEFAULT = 1），通过代码中的 `onPreSolve` 回调控制具体碰撞行为。

### 3.3 碰撞规则
| 碰撞对象A | 碰撞对象B | 碰撞行为 |
|-----------|-----------|----------|
| 小球 | 小球 | **不产生物理碰撞**（通过onPreSolve禁用），但检测碰撞事件用于激活待获得小球 |
| 小球 | 大球 | 正常物理碰撞，触发大球扣血和动画 |
| 小球 | 墙壁 | 正常物理碰撞反弹 |
| 小球 | 翻倍球 | **不产生物理碰撞**（翻倍球是sensor），但触发翻倍效果 |
| 炸弹球 | 大球 | 触发爆炸，销毁范围内大球 |
| 炸弹球 | 墙壁 | 左右墙壁反弹，底部墙壁直接销毁 |

---

## 四、管道系统详细设计

### 4.1 管道形态：L形管道

管道是一个 **L形** 的结构，由两部分组成：
1. **水平段**：位于屏幕上方，从发射口向左延伸
2. **垂直段**：从水平段最左端向下延伸

```
视觉示意图：

    发射口
       ↓
[6][5][4][3][2][1][0]  ← 水平段（index 0-6，共7个槽位）
                   ↑
                   └── 发射口位置，index=0 的小球在这里
       ↓
      [7]              ← 垂直段开始（index 7+）
      [8]
      [9]
      [10]
      [11]
       ↓
      ...
```

### 4.2 管道参数配置
```typescript
// PipeDisplay 组件属性
launchPosX = 0            // 发射口X坐标（水平段右端）
horizontalY = 450         // 水平段Y坐标
horizontalSpacing = 50    // 水平段小球间距
horizontalSlots = 7       // 水平段槽位数（含发射口）
verticalSpacing = 50      // 垂直段小球间距

// GameConfig 中的管道配置
INITIAL_PIPE_CAPACITY = 12    // 初始管道容量
MAX_PIPE_CAPACITY = 22        // 最大管道容量
VISIBLE_PIPE_SLOTS = 12       // 最多显示的小球数
PIPE_CAPACITY_INCREASE = 1    // 每次看广告增加的容量
```

### 4.3 小球在管道中的位置计算

```typescript
getBallPosition(index: number): { x: number, y: number } {
    if (index < horizontalSlots) {
        // 水平段：从发射口向左排列
        // index=0 在发射口，index=1 在发射口左边，以此类推
        return {
            x: launchPosX - index * horizontalSpacing,
            y: horizontalY
        };
    } else {
        // 垂直段：从水平段最左端向下延伸
        const verticalIndex = index - horizontalSlots + 1;
        return {
            x: launchPosX - (horizontalSlots - 1) * horizontalSpacing,  // 最左端X坐标
            y: horizontalY - verticalIndex * verticalSpacing
        };
    }
}
```

### 4.4 管道数据结构

```typescript
// GameManager 中的管道数据
private _pipeBalls: number[] = [];  // 存储小球数值的数组
private _pipeCapacity: number = INITIAL_PIPE_CAPACITY;  // 当前管道容量

// 数组索引含义：
// index=0: 发射口位置的小球（下一个要发射的）
// index=1: 发射口左边第一个
// index=2: 发射口左边第二个
// ...
// 数组末尾: 管道最深处的小球
```

### 4.5 初始管道小球
```typescript
INITIAL_SMALL_BALLS = [8, 4, 2];  // 游戏开始时管道内的小球
// 索引0的8在发射口，索引1的4在左边，索引2的2在最左边
```

---

## 五、小球系统详细设计

### 5.1 小球状态枚举

```typescript
enum SmallBallState {
    IN_PIPE,      // 在管道中（仅用于显示，实际数据在 GameManager._pipeBalls）
    LAUNCHING,    // 正在发射中（刚离开发射口）
    FLYING,       // 飞行中（在碰撞区内运动）
    PENDING,      // 待获得状态（半透明，等待被激活）
    RECYCLING     // 回收中（正在播放回收动画或已触发回收）
}
```

### 5.2 小球类型区分

小球分为两种来源：
1. **管道小球**（`isFromPipe = true`）：从管道发射出去的小球
2. **待获得小球**（`isFromPipe = false`）：大球销毁后产出的小球

**区分原因**：回收时处理逻辑不同
- 管道小球回收后：直接进入管道末尾（带L形路径动画）
- 待获得小球回收后：先进入闲置位，等待进入管道

### 5.3 小球物理参数

```typescript
BALL_RADIUS = 22             // 小球碰撞器半径
BALL_INITIAL_SPEED = 45      // 发射初始速度
BALL_GRAVITY_SCALE = 2.5     // 重力缩放
BALL_LINEAR_DAMPING = 0      // 线性阻尼
BALL_ANGULAR_DAMPING = 0     // 角度阻尼
BALL_RESTITUTION = 0.6       // 弹性系数
BALL_FRICTION = 0            // 摩擦系数
BALL_LAUNCH_INTERVAL = 0.2   // 连续发射间隔（秒）
```

### 5.4 小球数值与颜色

小球数值为 2 的幂次方：2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048...

颜色使用10色循环：
```typescript
BALL_COLORS = {
    0: '#87CEEB',  // 2, 2048, 2097152...    浅蓝
    1: '#90EE90',  // 4, 4096, 4194304...    浅绿
    2: '#FFD700',  // 8, 8192, 8388608...    黄色
    3: '#FFA500',  // 16, 16384...           橙色
    4: '#FF6B6B',  // 32, 32768...           红色
    5: '#9B59B6',  // 64, 65536...           紫色
    6: '#3498DB',  // 128, 131072...         深蓝
    7: '#1ABC9C',  // 256, 262144...         青色
    8: '#FF69B4',  // 512, 524288...         粉色
    9: '#F39C12',  // 1024, 1048576...       金色
};

// 颜色计算方法
getBallColor(value: number): string {
    const exponent = Math.log2(value);
    const colorIndex = (exponent - 1) % 10;
    return BALL_COLORS[colorIndex];
}
```

### 5.5 小球发射流程

```
1. 玩家触摸屏幕开始瞄准
2. 显示瞄准线（从发射口指向触摸点方向的虚线）
3. 只允许向下发射（触摸点Y坐标必须小于发射口Y坐标）
4. 玩家松开触摸
5. 检查是否为炸弹模式：
   - 是：调用 ItemManager.launchBomb(direction)
   - 否：继续正常发射流程
6. 检查游戏状态是否为 READY
7. 调用 GameManager.startLaunchRound()
   - 清空闲置位（上一回合剩余的）
   - 记录本回合要发射的球数 = 当前管道小球数
   - 记录发射开始时间（用于游戏加速）
   - 启动一键收球倒计时
8. 游戏状态变为 LAUNCHING
9. 开始发射序列：
   a. 从管道弹出第一个小球（index=0）
   b. 在发射口位置创建小球实体
   c. 设置小球速度 = 瞄准方向 × 初始速度
   d. 更新管道显示（所有小球向前移动一位）
   e. 等待 BALL_LAUNCH_INTERVAL 秒
   f. 重复 a-e 直到本回合所有小球发射完毕
10. 游戏状态变为 WAITING
```

### 5.6 小球边界检测（空气墙）

在 `SmallBall.update()` 中每帧检测：

```typescript
// 底部回收检测
if (pos.y < BOUNDARY_BOTTOM) {
    this.recycle();  // 触发回收
    return;
}

// 左边界反弹
if (pos.x < BOUNDARY_LEFT && velocity.x < 0) {
    velocity.x = -velocity.x * 0.8;  // 反向并衰减
    pos.x = BOUNDARY_LEFT;           // 修正位置
}

// 右边界反弹
if (pos.x > BOUNDARY_RIGHT && velocity.x > 0) {
    velocity.x = -velocity.x * 0.8;
    pos.x = BOUNDARY_RIGHT;
}

// 顶部边界反弹
if (pos.y > BOUNDARY_TOP && velocity.y > 0) {
    velocity.y = -velocity.y * 0.8;
    pos.y = BOUNDARY_TOP;
}
```

### 5.7 小球回收流程

```
1. 小球触碰底部边界（y < BOUNDARY_BOTTOM）
2. SmallBall.recycle() 被调用
3. 小球状态变为 RECYCLING
4. 发送事件 'BALL_RECYCLE'
5. BallManager.recycleBall() 处理：
   a. 从飞行列表移除该小球
   b. 获取小球当前位置和数值
   c. 销毁小球节点
   d. 判断小球来源（isFromPipe）：
      - 如果 isFromPipe = true（管道小球）：
        · 调用 GameManager.recycleBallWithAnimation()
        · 播放L形路径回收动画
        · 动画结束后将数值添加到 _pipeBalls 末尾
      - 如果 isFromPipe = false（待获得小球）：
        · 调用 GameManager.recyclePendingBallToIdleSlot()
        · 将数值添加到 _idleSlotBalls 末尾
        · 更新闲置位显示
   e. 检查是否所有小球已回收
6. 所有小球回收完毕后，等待回收动画完成，然后触发 nextRound()
```

### 5.8 小球回收动画（L形路径）

```typescript
// 动画参数
BALL_RECYCLE_SPEED = 5000;  // 回收飞行速度（像素/秒）
PIPE_CORNER_X = -350;       // L形转弯点X坐标
PIPE_HORIZONTAL_Y = 265;    // 水平段Y坐标

// 动画路径计算
playRecycleAnimation(startX, startY, value, targetIndex, onComplete) {
    // 1. 计算目标位置
    const targetPos = pipeDisplay.getBallPosition(targetIndex);
    
    // 2. 计算路径
    // 路径分段：
    // - 第一段：从起点水平移动到转弯点X
    // - 第二段：从转弯点垂直移动到水平段Y
    // - 第三段：从转弯点水平移动到目标X（如果目标在水平段）
    //   或者垂直移动到目标Y（如果目标在垂直段）
    
    // 3. 创建动画小球
    const animBall = createAnimationBall(value);
    animBall.setPosition(startX, startY, 0);
    
    // 4. 播放动画（保持匀速）
    // 使用 tween 按路径移动
    
    // 5. 动画结束后销毁动画小球，调用 onComplete
}
```

---

## 六、大球系统详细设计

### 6.1 大球形状

```typescript
enum BigBallShape {
    CIRCLE = 0,   // 圆形
    SQUARE = 1,   // 方形
    DIAMOND = 2   // 菱形（方形旋转45度，但文字保持正向）
}
```

### 6.2 大球层级系统

```
层级编号（从下到上）：
Layer 1: 最底层（靠近底部墙壁）
Layer 2: 第二层
...
Layer 8: 最顶层（靠近发射口）
Layer 9: 游戏失败层（大球到达此层时游戏结束）
```

### 6.3 大球容量交替规则

```typescript
// 奇数层（1, 3, 5, 7）：4个大球槽位
// 偶数层（2, 4, 6, 8）：5个大球槽位

getLayerCapacity(layer: number): number {
    return (layer % 2 === 1) ? 4 : 5;
}

// 实际生成的大球数量由权重配置决定，不一定填满所有槽位
```

### 6.4 大球物理参数

```typescript
BIG_BALL_RADIUS_CIRCLE = 33   // 圆形大球半径
BIG_BALL_RADIUS_SQUARE = 25   // 方形大球半边长
BIG_BALL_RADIUS_DIAMOND = 28  // 菱形大球半边长
BIG_BALL_RESTITUTION = 0.2    // 弹性系数
BIG_BALL_FRICTION = 0         // 摩擦系数
BIG_BALL_BOUNCE_SPEED = 40    // 保底弹射速度
BIG_BALL_HIT_COOLDOWN = 0.05  // 同一小球连续碰撞冷却时间（秒）
```

### 6.5 大球层位置参数

```typescript
BIG_BALL_LAYERS = 8           // 碰撞区层数
FAIL_LAYER = 9                // 失败判定层
LAYER_HEIGHT_4 = 95           // 4容量层的层高
LAYER_HEIGHT_5 = 95           // 5容量层的层高
BIG_BALL_SPACING_4 = 95       // 4容量层大球之间的水平间距
BIG_BALL_SPACING_5 = 95       // 5容量层大球之间的水平间距
BIG_BALL_BOTTOM_MARGIN = -50  // 最下层大球距离碰撞区底部的额外边距
```

### 6.6 大球位置计算

```typescript
// 层Y坐标计算
getLayerY(layer: number): number {
    const baseY = COLLISION_AREA_BOTTOM + BIG_BALL_BOTTOM_MARGIN;
    const layerHeight = LAYER_HEIGHT_4;  // 使用统一层高
    return baseY + (layer - 0.5) * layerHeight;
}

// 层内大球X坐标计算
calculateBallPositions(capacity: number): Vec2[] {
    const positions = [];
    const spacing = (capacity === 4) ? BIG_BALL_SPACING_4 : BIG_BALL_SPACING_5;
    const totalWidth = spacing * (capacity - 1);
    const startX = -totalWidth / 2;
    
    for (let i = 0; i < capacity; i++) {
        positions.push(new Vec2(startX + spacing * i, 0));
    }
    return positions;
}
```

### 6.7 大球被碰撞处理

```typescript
onBeginContact(smallBall) {
    // 1. 检查碰撞冷却（防止同一小球短时间内多次扣血）
    const now = Date.now() / 1000;
    const lastHit = hitCooldowns.get(smallBall.uuid);
    if (now - lastHit < BIG_BALL_HIT_COOLDOWN) return;
    hitCooldowns.set(smallBall.uuid, now);
    
    // 2. 给小球施加保底弹射速度（防止卡住）
    applyBounceSpeed(smallBall);
    
    // 3. 减少大球数值
    this._value -= smallBall.value;
    
    // 4. 增加玩家分数
    GameManager.addScore(smallBall.value);
    
    // 5. 检查是否销毁
    if (this._value <= 0) {
        this.onDestroyed();
    } else {
        this.updateVisual();
        this.playHitAnimation();
    }
}
```

### 6.8 保底弹射速度逻辑

防止小球卡在大球上反复碰撞但无法弹开：

```typescript
applyBounceSpeed(smallBall) {
    const currentSpeed = smallBall.rigidBody.linearVelocity.length();
    
    // 只有当前速度低于保底速度时才补偿
    if (currentSpeed < BIG_BALL_BOUNCE_SPEED) {
        // 计算从大球中心指向小球中心的方向
        const direction = (smallBall.position - this.position).normalize();
        
        // 检查是否近乎垂直碰撞（容易卡住）
        if (Math.abs(direction.x) < 0.3) {
            // 添加随机水平扰动
            direction.x = (Math.random() > 0.5 ? 1 : -1) * 0.3;
            direction.normalize();
        }
        
        // 设置新速度
        smallBall.rigidBody.linearVelocity = direction * BIG_BALL_BOUNCE_SPEED;
    }
}
```

### 6.9 大球被击中动画

```typescript
// 动画参数
BIG_BALL_HIT_SCALE_MAX = 1.2       // 最大放大倍数
BIG_BALL_HIT_SCALE_MIN = 1.0       // 恢复缩放
BIG_BALL_HIT_ANIM_DURATION = 0.25  // 动画时长

playHitAnimation() {
    if (this._isAnimating) return;  // 动画中不重复触发
    
    this._isAnimating = true;
    const duration = BIG_BALL_HIT_ANIM_DURATION;
    const maxScale = BIG_BALL_HIT_SCALE_MAX;
    const minScale = BIG_BALL_HIT_SCALE_MIN;
    
    tween(this.node)
        .to(duration/2, { scale: new Vec3(maxScale, maxScale, 1) })
        .to(duration/2, { scale: new Vec3(minScale, minScale, 1) })
        .call(() => { this._isAnimating = false; })
        .start();
}
```

### 6.10 大球销毁处理

```typescript
onDestroyed() {
    // 1. 停止动画
    if (this._scaleTween) this._scaleTween.stop();
    
    // 2. 从管理器移除
    BallManager.removeBigBall(this);
    
    // 3. 按概率产出待获得小球（使用动态概率机制）
    if (GameConfig.shouldSpawnPendingBall()) {
        const value = GameConfig.generatePendingBallValue();
        BallManager.createPendingBall(this.position, value);
    }
    
    // 4. 销毁节点
    this.node.destroy();
}
```

### 6.11 大球数值生成规则

#### 规则A：基础回合递增规则
```typescript
getBaseExponentRange(round: number): [number, number] {
    if (round <= 1) return [5, 6];       // 32-64
    if (round <= 2) return [6, 7];       // 64-128
    if (round <= 4) return [7, 8];       // 128-256
    if (round <= 6) return [7, 9];       // 128-512
    if (round <= 9) return [8, 10];      // 256-1024
    if (round <= 12) return [9, 11];     // 512-2048
    if (round <= 15) return [10, 12];    // 1024-4096
    if (round <= 18) return [11, 13];    // 2048-8192
    if (round <= 21) return [12, 14];    // 4096-16384
    
    // 21回合后继续递增
    const extraLevels = Math.floor((round - 21) / 5);
    return [13 + extraLevels, 15 + extraLevels];
}
```

#### 规则B：动态提升规则（基于管道总值）
```typescript
getDynamicExponentRange(pipeSum: number): [number, number] | null {
    if (pipeSum <= 0) return null;
    const n = Math.floor(Math.log2(pipeSum));
    return [n + 2, n + 3];
}
```

#### 动态规则生效条件
```typescript
DYNAMIC_RULE_START_ROUND = 4;  // 达到此回合后才启用动态规则
```

#### 规则B分阶段过渡
当规则B计算出更高的目标值时，不会立即生效，而是分阶段过渡：

```typescript
DYNAMIC_RULE_TRANSITION_STAGES = [0.5, 1.0];
// [0.5, 1.0] 表示：
//   - 第1回合：提升到目标值的50%
//   - 第2回合：提升到目标值的100%
```

#### 防数值倒退机制
系统记录上一回合实际使用的范围 `_lastUsedRange`，确保新计算的范围永远不会低于上一回合。

#### 最终规则
- 回合 < DYNAMIC_RULE_START_ROUND：仅使用规则A
- 回合 >= DYNAMIC_RULE_START_ROUND：取规则A和规则B（带过渡）中较高的值
- 始终确保不低于上一回合使用的范围

### 6.12 大球数量生成规则（权重配置）

每层生成的大球数量使用权重随机：

```typescript
// 4容量层大球数量权重
LAYER_4_BALL_COUNT_WEIGHTS = {
    1: 10,   // 1个大球，权重10
    2: 20,   // 2个大球，权重20
    3: 25,   // 3个大球，权重25
    4: 15,   // 4个大球，权重15
};

// 5容量层大球数量权重
LAYER_5_BALL_COUNT_WEIGHTS = {
    1: 10,
    2: 20,
    3: 25,
    4: 20,
    5: 15,
};

// 上一行大球数量少于阈值时，提高最大数权重
LAYER_4_LOW_COUNT_THRESHOLD = 2;   // 4容量层阈值
LAYER_5_LOW_COUNT_THRESHOLD = 2;   // 5容量层阈值
LOW_COUNT_MAX_WEIGHT_BOOST = 50;   // 权重提升量
```

### 6.13 大球形状随机生成

```typescript
BIG_BALL_SHAPE_WEIGHTS = {
    0: 10,   // 圆形
    1: 0,    // 方形（当前权重0，不生成）
    2: 10,   // 菱形
};

generateBigBallShape(): BigBallShape {
    // 根据权重随机选择
    const totalWeight = sum(BIG_BALL_SHAPE_WEIGHTS);
    const random = Math.random() * totalWeight;
    // ... 权重选择逻辑
}
```

---

## 七、待获得小球系统

### 7.1 产出概率（根据回合配置 + 递增机制）

#### 基础概率配置
```typescript
PENDING_BALL_SPAWN_CHANCE_BY_ROUND = {
    1: 0.65,   // 回合1-2：65%概率
    3: 0.5,    // 回合3-4：50%概率
    5: 0.4,    // 回合5-6：40%概率
    7: 0.35,   // 回合7-8：35%概率
    9: 0.3,    // 回合9+：30%概率
};
```

#### 概率递增机制
当大球销毁后未产出待获得小球时，下次产出概率会增加，直到产出成功后重置。

```typescript
PENDING_BALL_SPAWN_CHANCE_INCREMENT = 0.08;  // 每次未产出时增加8%
PENDING_BALL_SPAWN_CHANCE_MAX = 1.0;         // 概率上限100%

// 判断逻辑
shouldSpawnPendingBall(): boolean {
    const baseChance = getSpawnChanceByRound(currentRound);
    const finalChance = min(baseChance + currentBonus, SPAWN_CHANCE_MAX);
    
    if (random() < finalChance) {
        currentBonus = 0;  // 产出成功，重置加成
        return true;
    } else {
        currentBonus += INCREMENT;  // 未产出，增加加成
        return false;
    }
}
```

### 7.2 数值权重配置

```typescript
PENDING_BALL_VALUE_WEIGHTS = {
    // 回合1-4：使用此配置
    1: { 2: 20, 4: 15, 8: 10, 16: 5 },
    
    // 回合5-9：使用此配置
    5: { 2: 20, 4: 20, 8: 15, 16: 10, 32: 5 },
    
    // 回合10-14：使用此配置
    10: { 2: 20, 4: 20, 8: 20, 16: 15, 32: 10, 64: 5 },
    
    // 回合15+：使用此配置
    15: { 2: 20, 4: 20, 8: 20, 16: 20, 32: 15, 64: 10, 128: 5 },
};
```

### 7.3 动态权重成长

当回合数超过配置的最大阈值后，权重会动态成长：

```typescript
PENDING_BALL_GROWTH_START_ROUND = 15  // 动态成长开始回合
PENDING_BALL_GROWTH_INTERVAL = 5      // 每隔5回合成长一次
PENDING_BALL_GROWTH_WEIGHTS = [5, 10, 15, 20]  // 新数值的权重序列

// 成长逻辑示例：
// 回合15：基础权重 { 2:20, 4:20, 8:20, 16:20, 32:15, 64:10, 128:5 }
// 回合20：新增256，权重为5，其他权重提升
// 回合25：256权重提升到10，新增512权重5
// 以此类推...
```

### 7.4 待获得小球状态

```typescript
// 待获得小球特征：
// - 半透明显示（alpha = 150）
// - 物理类型：Dynamic（但 gravityScale = 0，不受重力）
// - 碰撞器：sensor = true（可检测碰撞但不产生物理反弹）
// - 位置固定在大球销毁位置

setAsPending() {
    this._state = SmallBallState.PENDING;
    this.ballSprite.color.a = 150;  // 半透明
    this.rigidBody.gravityScale = 0;
    this.rigidBody.linearVelocity = Vec2.ZERO;
    this.rigidBody.linearDamping = 1000;  // 极高阻尼防止移动
    this.collider.sensor = true;
}
```

### 7.5 待获得小球激活

当飞行中的小球碰到待获得小球时：

```typescript
// 在 SmallBall.onBeginContact 中
if (this._state === SmallBallState.PENDING) {
    const other = otherCollider.getComponent(SmallBall);
    if (other && (other.state === FLYING || other.state === LAUNCHING)) {
        // 激活此待获得小球
        director.emit('PENDING_BALL_ACTIVATED', this);
    }
}

// 激活后的行为
activate() {
    this.ballSprite.color.a = 255;  // 恢复不透明
    this.rigidBody.gravityScale = BALL_GRAVITY_SCALE;
    this.rigidBody.linearDamping = BALL_LINEAR_DAMPING;
    this.rigidBody.linearVelocity = new Vec2(0, BALL_INITIAL_SPEED);  // 垂直向上
    this.collider.sensor = false;
    this._state = SmallBallState.FLYING;
}
```

---

## 八、闲置位系统

### 8.1 闲置位定义

闲置位用于临时存放本回合激活并回收的待获得小球。

```typescript
// GameManager 中
private _idleSlotBalls: number[] = [];  // 闲置位小球数值数组
```

### 8.2 闲置位显示

位置：管道L形转弯处的正下方（与底部墙壁齐平）

显示内容：
- 第一个闲置位小球（带颜色和数值）
- 小球上方：向上箭头图标
- 小球下方：文字"N个"（N为闲置位小球总数）

```typescript
// IdleSlotDisplay 组件
updateDisplay() {
    const idleSlotBalls = GameManager.instance.idleSlotBalls;
    
    if (idleSlotBalls.length === 0) {
        this.hideAll();
        return;
    }
    
    // 显示第一个小球
    this.firstBallNode.active = true;
    this.updateBallVisual(idleSlotBalls[0]);
    
    // 显示箭头
    this.arrowNode.active = true;
    
    // 显示数量
    this.countLabel.string = idleSlotBalls.length + '个';
    this.countLabel.node.active = true;
}
```

### 8.3 闲置位处理流程

```
回合结束时：
1. 所有管道小球回收完毕（等待回收动画完成）
2. 进入 PROCESSING_IDLE 状态
3. 开始闲置位处理循环：
   a. 检查管道是否有空位 且 闲置位是否有小球
   b. 如果都满足：
      - 计算可进入管道的小球数量 = min(管道空位, 闲置位小球数)
      - 播放批量进入动画（所有小球同时开始，保持间距）
      - 动画结束后，将数值添加到管道末尾
      - 更新管道显示
   c. 执行合成检测和动画
   d. 如果合成后管道有新空位，回到步骤 a
   e. 循环结束条件：管道满 或 闲置位空
4. 进入下一回合（不清空闲置位，保留到下一回合发射前）
5. 下一回合发射时清空闲置位剩余小球
```

### 8.4 闲置位小球进入管道动画

```typescript
// 批量进入动画
playBatchIdleSlotRecycleAnimation(values: number[], startIndex: number) {
    const startX = PIPE_CORNER_X;  // 闲置位X坐标
    const startY = idleSlotY;      // 闲置位Y坐标
    
    for (let i = 0; i < values.length; i++) {
        const targetIndex = startIndex + i;
        const targetPos = pipeDisplay.getBallPosition(targetIndex);
        
        // 创建动画小球
        const animBall = createAnimationBall(values[i]);
        animBall.setPosition(startX, startY - i * verticalSpacing, 0);
        
        // 计算动画路径（垂直向上进入管道，然后沿管道移动到目标位置）
        const distance = calculatePathDistance(animBall.position, targetPos);
        const duration = distance / BALL_RECYCLE_SPEED;
        
        // 播放动画
        // ... tween 动画代码
    }
}
```

---

## 九、合成系统详细设计

### 9.1 合成规则

- 相邻的两个小球数值相同时可以合成
- 合成后数值翻倍（如 4+4=8）
- 合成顺序：从发射口（index=0）开始向后遍历
- 每次合成后重新从头遍历，直到没有可合成的

### 9.2 合成检测

```typescript
findMergeIndex(): number {
    const pipeBalls = GameManager.instance.pipeBalls;
    
    for (let i = 0; i < pipeBalls.length - 1; i++) {
        if (pipeBalls[i] === pipeBalls[i + 1]) {
            return i;  // 返回前一个小球的索引
        }
    }
    return -1;  // 没有可合成的
}
```

### 9.3 合成动画流程

```
1. 找到可合成的位置 index
2. 隐藏 PipeDisplay 所有小球
3. 为管道中所有小球创建动画小球（位置与 PipeDisplay 一致）
4. 播放移动动画：
   - index+1 位置的小球移动到 index 位置
   - index+1 之后的所有小球同时向前移动一位
5. 移动完成后：
   - 销毁 index 和 index+1 的动画小球
   - 执行数据合成：pipeBalls.splice(index, 2, pipeBalls[index] * 2)
   - 销毁其他动画小球
6. 创建合成后的小球动画球，播放缩放动画：
   - 放大到 BALL_MERGE_SCALE_MAX
   - 缩小到 BALL_MERGE_SCALE_MIN
7. 缩放完成后：
   - 销毁动画小球
   - 显示 PipeDisplay 所有小球
   - 更新最大合成值
8. 继续检测下一个可合成位置
```

### 9.4 合成动画参数

```typescript
BALL_MERGE_MOVE_SPEED = 1000      // 移动速度（像素/秒）
BALL_MERGE_SCALE_MAX = 1.4        // 最大放大倍数
BALL_MERGE_SCALE_MIN = 1.0        // 恢复缩放
BALL_MERGE_ANIM_DURATION = 0.5    // 缩放动画时长
```

---

## 十、回合系统详细设计

### 10.1 游戏状态枚举

```typescript
enum GameState {
    READY,           // 准备发射
    LAUNCHING,       // 发射中
    WAITING,         // 等待回收
    MERGING,         // 合成中
    PROCESSING_IDLE, // 处理闲置位回收
    PAUSED,          // 暂停
    GAME_OVER        // 游戏结束
}
```

### 10.2 游戏状态流转

```
READY（准备发射）
    ↓ 玩家触摸发射
LAUNCHING（发射中）
    ↓ 所有小球发射完毕
WAITING（等待回收）
    ↓ 所有小球回收完毕
PROCESSING_IDLE（处理闲置位）
    ↓ 闲置位处理完毕
MERGING（合成中）
    ↓ 合成完毕
    ↓ 检查游戏是否结束
READY 或 GAME_OVER
```

### 10.3 回合结束流程

```typescript
nextRound() {
    // 1. 重置发射状态
    this._ballsToLaunchThisRound = 0;
    this._ballsLaunchedThisRound = 0;
    
    // 2. 重置游戏速度
    this.resetGameSpeed();
    
    // 3. 重置一键收球状态
    ItemManager.instance.resetQuickRecall();
    
    // 4. 进入闲置位处理状态
    this.setGameState(GameState.PROCESSING_IDLE);
    
    // 5. 开始闲置位回收和合成循环
    this.processIdleSlotAndMerge();
}
```

### 10.4 进入下一回合

```typescript
proceedToNextRound() {
    // 1. 回合数+1
    this._currentRound++;
    GameConfig.currentRound = this._currentRound;
    
    // 2. 推进动态规则过渡阶段
    GameConfig.advanceDynamicRuleStage();
    
    // 3. 检查游戏是否结束
    if (this.checkGameOver()) {
        this.setGameState(GameState.GAME_OVER);
        return;
    }
    
    // 4. 大球上移一层
    const gameOver = BallManager.instance.moveAllBigBallsUp();
    if (gameOver) {
        this.setGameState(GameState.GAME_OVER);
        return;
    }
    
    // 5. 生成新的大球层
    BallManager.instance.generateBigBallLayer(1, this._currentRound, this.pipeSum);
    
    // 6. 进入准备状态
    this.setGameState(GameState.READY);
}
```

### 10.5 游戏结束检测

```typescript
checkGameOver(): boolean {
    // 检查是否有大球在第9层或以上
    for (const ball of BallManager.instance.getAllBigBalls()) {
        if (ball.layer >= FAIL_LAYER) {
            return true;
        }
    }
    return false;
}
```

---

## 十一、游戏加速系统

### 11.1 加速目的

防止小球卡在某个位置长时间无法回收，导致玩家等待过久。

### 11.2 加速配置

```typescript
// 格式：[开始秒数, 速度倍数]
// 注意：速度倍数必须为整数，小数会导致性能问题
GAME_SPEED_LEVELS = [
    [0, 1],      // 0秒开始，1倍速
    [15, 2],     // 15秒后，2倍速
    [25, 4],     // 25秒后，4倍速
    [33, 8],     // 33秒后，8倍速
    [38, 16],    // 38秒后，16倍速
    [42, 32],    // 42秒后，32倍速
    [45, 64],    // 45秒后，64倍速
];
```

### 11.3 加速实现

```typescript
// 在 GameManager.update() 中
update(deltaTime: number) {
    if (this._gameState === GameState.WAITING || this._gameState === GameState.LAUNCHING) {
        this.updateGameSpeed();
        
        // 手动执行额外的物理步进
        if (this._currentSpeedMultiplier > 1) {
            const physicsSystem = PhysicsSystem2D.instance;
            const extraSteps = this._currentSpeedMultiplier - 1;
            for (let i = 0; i < extraSteps; i++) {
                physicsSystem.step(physicsSystem.fixedTimeStep);
            }
        }
    }
}

updateGameSpeed() {
    const elapsedTime = (Date.now() - this._launchStartTime) / 1000;
    const newMultiplier = GameConfig.getGameSpeedMultiplier(elapsedTime);
    
    if (newMultiplier !== this._currentSpeedMultiplier) {
        this._currentSpeedMultiplier = newMultiplier;
        director.getScheduler().setTimeScale(newMultiplier);
    }
}
```

### 11.4 速度重置时机

- 发射开始时：重置为1倍速
- 回合结束时：重置为1倍速
- 游戏初始化时：重置为1倍速

---

## 十二、道具系统详细设计

### 12.1 道具数量与广告系统

**道具类型枚举**：
```typescript
enum ItemType {
    BOMB = 'bomb',
    DOUBLE = 'double',
    LASER = 'laser',
    SORT_PIPE = 'sortPipe'
}
```

**数量管理规则**：
- 道具数量保存在本地存储（localStorage），游戏重启后保留
- 初始数量由 `GameConfig.INITIAL_ITEM_COUNTS` 配置

**使用逻辑**：
1. 点击道具按钮时检查数量
2. 如果数量 > 0：消耗1个道具，执行效果
3. 如果数量 = 0：弹出激励广告，广告完成后执行效果（不消耗道具）

**UI显示**：
- 数量 >= 1：按钮上显示数字
- 数量 = 0：按钮上显示"广告"

**配置参数**：
```typescript
INITIAL_ITEM_COUNTS = {
    bomb: 0,
    double: 0,
    laser: 0,
    sortPipe: 0
};
```

### 12.2 道具按钮状态规则

**通用规则**：
- 所有道具按钮在非 READY 状态时置灰不可用
- 炸弹模式下，所有道具按钮置灰

**各道具特殊规则**：
| 道具 | 可用状态 | 置灰条件 |
|------|----------|----------|
| 一键收球 | WAITING/LAUNCHING 且倒计时结束 | 非WAITING/LAUNCHING状态 或 倒计时中 |
| 炸弹球 | READY 且非炸弹模式 | 非READY 或 已在炸弹模式 |
| 翻倍球 | READY | 非READY |
| 激光 | READY 且上4层有大球 | 非READY 或 上4层无大球 |
| 整理管道 | READY | 非READY |
| 增加管道容量 | READY 且未达最大容量 | 非READY 或 已达最大容量 |

### 12.3 一键收球（常驻功能，非道具）

**功能**：让所有飞行中的小球立即回收

**使用条件**：
- 游戏状态为 WAITING 或 LAUNCHING
- 发射后经过 QUICK_RECALL_COOLDOWN 秒

**配置参数**：
```typescript
QUICK_RECALL_COOLDOWN = 5;  // 冷却时间（秒）
```

**按钮显示**：
- 发射前：置灰，无文字
- 发射后倒计时中：置灰，显示倒计时数字（如"5"、"4"...）
- 倒计时结束：高亮，显示"收球"
- 小球全部回收后或游戏状态变为非WAITING/LAUNCHING：置灰，无文字

**实现逻辑**：
```typescript
useQuickRecall() {
    if (!this._isQuickRecallAvailable) return;
    if (gameState !== WAITING && gameState !== LAUNCHING) return;
    
    // 收集所有飞行中和待获得小球
    const flyingBalls = BallManager.instance.flyingBalls;
    const pendingBalls = BallManager.instance.pendingBalls;
    
    // 禁用物理，加速下落
    for (const ball of [...flyingBalls, ...pendingBalls]) {
        ball.collider.sensor = true;  // 不再与大球碰撞
        ball.rigidBody.gravityScale = 5;  // 加速下落
        ball.rigidBody.linearVelocity = new Vec2(0, -500);
        ball.recycle();  // 触发回收
    }
    
    this._isQuickRecallAvailable = false;
}
```

### 12.4 炸弹球

**功能**：发射一个炸弹，碰到大球时爆炸销毁范围内所有大球

**使用条件**：
- 游戏状态为 READY

**配置参数**：
```typescript
BOMB_BALL_SPEED = 50;          // 炸弹飞行速度
BOMB_BALL_RADIUS = 35;         // 炸弹碰撞器半径
BOMB_EXPLOSION_RADIUS = 200;   // 爆炸半径
```

**使用流程**：
```
1. 玩家点击炸弹按钮
2. 检查道具数量，决定是否播放广告
3. 进入炸弹模式：
   - GameManager._isBombMode = true
   - 发射口显示炸弹图标（覆盖在小球上方）
   - 炸弹按钮置灰
   - 其他道具按钮置灰
4. 玩家瞄准（与正常发射相同的操作）
5. 玩家松开触摸
6. 发射炸弹：
   - 隐藏发射口炸弹图标
   - 创建炸弹球实体
   - 设置炸弹速度 = 瞄准方向 × BOMB_BALL_SPEED
   - 退出炸弹模式
7. 炸弹飞行：
   - 不受重力影响（gravityScale = 0）
   - 碰到左右墙壁时反弹
   - 碰到底部墙壁时直接销毁（不爆炸）
   - 碰到大球时爆炸
8. 爆炸效果：
   - 以碰撞点为圆心，BOMB_EXPLOSION_RADIUS 为半径
   - 销毁范围内所有大球（无论数值多少）
   - 被销毁的大球正常产出待获得小球
```

### 12.5 翻倍球（翻倍点位）

**功能**：在碰撞区生成一个翻倍点位，穿过它的小球数值翻倍

**设计理念**：
翻倍球是一个"翻倍点位"，小球穿过时数值翻倍，**不会产生物理反弹**（collider.sensor = true）。这样的设计让玩家更容易理解"经过这个区域的球数值会翻倍"。

**使用条件**：
- 游戏状态为 READY

**配置参数**：
```typescript
DOUBLE_BALL_RADIUS = 33;          // 翻倍球半径
DOUBLE_BALL_HIT_COUNT = 3;        // 可被碰撞次数
DOUBLE_BALL_FLY_SPEED = 3000;     // 飞入速度（像素/秒）
DOUBLE_BALL_PRIORITY_LAYERS = 4;  // 优先放置的层数（从上往下）
```

**使用流程**：
```
1. 玩家点击翻倍按钮
2. 检查道具数量，决定是否播放广告
3. 查找放置位置：
   a. 优先在上4层（Layer 5-8）的空位中随机选择
   b. 空位定义：该位置没有大球，也没有其他翻倍球
   c. 如果上4层没有空位，向下查找（Layer 4, 3, 2, 1）
   d. 如果全部满，不执行任何操作
4. 立即记录目标位置到 _doubleBallTargetPositions（防止重复占用）
5. 创建翻倍球：
   - 初始位置：翻倍按钮位置
   - 播放飞入动画：从按钮位置飞到目标位置
6. 翻倍球特性：
   - 物理类型：Static
   - 碰撞器：sensor = true（小球直接穿过，不产生物理反弹）
   - 可被碰撞次数：DOUBLE_BALL_HIT_COUNT（默认3次）
   - 剩余次数 <= 0 时不再触发翻倍效果
7. 小球穿过翻倍球：
   - 检查 _remainingHits > 0
   - 小球数值 ×= 2
   - 翻倍球剩余次数 -= 1
   - 播放翻倍球缩放动画
   - 如果剩余次数为0，销毁翻倍球
8. 翻倍球持续性：
   - 如果本回合没有被碰撞3次，保留到下一回合
   - 同一小球可多次穿过同一翻倍球（每次都触发翻倍）
```

### 12.6 激光

**功能**：从发射口发出横向激光，向下扫描销毁大球

**使用条件**：
- 游戏状态为 READY
- 上 LASER_SWEEP_LAYERS 层有大球存在

**配置参数**：
```typescript
LASER_SWEEP_LAYERS = 4;       // 扫描层数
LASER_SWEEP_DURATION = 1.5;   // 扫描动画时长（秒）
LASER_WIDTH = 20;             // 激光宽度（视觉效果）
```

**使用流程**：
```
1. 玩家点击激光按钮
2. 检查上4层是否有大球，没有则不执行
3. 检查道具数量，决定是否播放广告
4. 显示激光效果节点（横向长条）
5. 激光初始位置：发射口Y坐标上方50像素
6. 播放扫描动画：
   - 激光向下移动
   - 移动范围：从第8层上方到第5层下方
   - 动画时长：LASER_SWEEP_DURATION
7. 逐层销毁（实时检测）：
   - 每帧检测激光Y坐标
   - 当激光Y坐标 <= 某层大球圆心Y坐标时，立即销毁该层所有大球
   - 被销毁的大球正常产出待获得小球
8. 动画结束后隐藏激光效果节点
```

### 12.7 整理管道

**功能**：将管道内小球按数值从大到小重新排序

**使用条件**：
- 游戏状态为 READY

**使用流程**：
```
1. 玩家点击整理按钮
2. 检查道具数量，决定是否播放广告
3. 对 _pipeBalls 数组进行降序排序
4. 更新管道显示
5. 进入 PROCESSING_IDLE 状态
6. 触发闲置位回收和合成循环（与回合结束相同）
7. 完成后恢复 READY 状态（不进入下一回合）
```

### 12.8 增加管道容量

**功能**：观看广告后增加管道容量

**使用条件**：
- 游戏状态为 READY
- 当前容量 < 最大容量（MAX_PIPE_CAPACITY）

**按钮位置**：
- 显示在管道末尾位置（当前容量的下一个槽位）
- 跟随管道容量变化自动移动

**配置参数**：
```typescript
MAX_PIPE_CAPACITY = 22;        // 最大管道容量
PIPE_CAPACITY_INCREASE = 1;    // 每次增加的容量
```

**使用流程**：
```
1. 玩家点击增加容量按钮
2. 播放激励广告
3. 广告完成后：
   - 增加管道容量
   - 如果闲置位有小球，触发闲置位回收和合成循环
   - 更新按钮位置
```

---

## 十三、UI系统详细设计

### 13.1 分数显示区域

位置：屏幕左上角

显示内容：
```
当前分数：123,456
最高分数：999,999
当前回合：第 12 回合
最高合成：[球图标] 2048
```

### 13.2 分数格式化规则

```typescript
formatScore(score: number): string {
    if (score < 10000) {
        return score.toLocaleString();  // 1,234
    } else if (score < 1000000) {
        return (score / 1000).toFixed(1) + 'K';  // 12.3K
    } else if (score < 1000000000) {
        return (score / 1000000).toFixed(1) + 'M';  // 12.3M
    } else {
        return (score / 1000000000).toFixed(1) + 'B';  // 12.3B
    }
}
```

### 13.3 瞄准线设置

```typescript
AIM_LINE_MAX_LENGTH = 600;    // 瞄准线最大长度
AIM_LINE_WIDTH = 6;           // 瞄准线宽度
AIM_LINE_DASH_LENGTH = 10;    // 瞄准线虚线长度
AIM_LINE_GAP_LENGTH = 10;     // 瞄准线虚线间隔
```

---

## 十四、场景节点结构

### 14.1 完整节点树

```
Canvas
├── Background                    // 背景层
│   └── BackgroundSprite          // 背景图片
│
├── GameArea                      // 游戏区域
│   ├── Walls                     // 墙壁容器
│   │   ├── TopWall               // 顶部墙壁（静态碰撞器）
│   │   ├── BottomWall            // 底部墙壁（静态碰撞器）
│   │   ├── LeftWall              // 左侧墙壁（静态碰撞器）
│   │   └── RightWall             // 右侧墙壁（静态碰撞器）
│   │
│   ├── CollisionArea             // 碰撞区容器
│   │   ├── BigBalls              // 大球容器
│   │   └── SmallBalls            // 小球容器
│   │
│   ├── Pipe                      // 管道显示区域
│   │   ├── BallContainer         // 管道小球容器
│   │   └── AddCapacityButton     // 增加容量按钮（跟随管道末尾）
│   │       └── CapacityLabel     // 容量显示文字
│   │
│   ├── Launcher                  // 发射器
│   │   ├── LaunchController      // 发射控制组件
│   │   ├── AimLine               // 瞄准线（Graphics组件）
│   │   └── BombDisplay           // 炸弹显示（默认隐藏）
│   │
│   └── IdleSlot                  // 闲置位显示
│       ├── FirstBall             // 第一个小球显示
│       ├── Arrow                 // 向上箭头
│       └── CountLabel            // 数量文字
│
├── UI                            // UI层
│   ├── ScoreDisplay              // 分数显示区域
│   │   ├── CurrentScoreLabel     // 当前分数
│   │   ├── HighScoreLabel        // 最高分数
│   │   ├── RoundLabel            // 当前回合
│   │   └── MaxBallNode           // 最高合成球显示
│   │       ├── BallSprite        // 球图标
│   │       └── ValueLabel        // 数值文字
│   │
│   └── ItemButtons               // 道具按钮区域
│       ├── QuickRecallBtn        // 一键收球按钮
│       │   └── CountdownLabel    // 倒计时文字
│       ├── BombBtn               // 炸弹按钮
│       │   └── CountLabel        // 数量/广告标签
│       ├── DoubleBallBtn         // 翻倍球按钮
│       │   └── CountLabel
│       ├── LaserBtn              // 激光按钮
│       │   └── CountLabel
│       └── SortPipeBtn           // 整理管道按钮
│           └── CountLabel
│
├── Effects                       // 特效层
│   └── LaserEffect               // 激光特效（默认隐藏）
│
├── DoubleBallContainer           // 翻倍球容器
│
├── PipeAnimator                  // 管道动画控制器（空节点，挂载组件）
│
└── Popups                        // 弹窗层
    └── GameOverPopup             // 游戏结束弹窗（默认隐藏）
```

### 14.2 关键节点组件配置

#### Pipe 节点
```
Pipe:
  - PipeDisplay 组件:
    - ballDisplayPrefab: SmallBall预制体
    - ballContainer: 指向BallContainer节点
    - launchPosX: 0
    - horizontalY: 450
    - horizontalSpacing: 50
    - horizontalSlots: 7
    - verticalSpacing: 50
```

#### Launcher 节点
```
Launcher:
  - Position: (0, 450, 0)
  - LaunchController组件:
    - aimLineNode: 指向AimLine节点
```

---

## 十五、预制体（Prefab）配置

### 15.1 SmallBall 预制体

```
SmallBall (Node)
├── UITransform: width=44, height=44 (BALL_RADIUS * 2)
├── Sprite: spriteFrame=圆形图片
├── RigidBody2D:
│   - type: Dynamic
│   - gravityScale: 2.5 (BALL_GRAVITY_SCALE)
│   - linearDamping: 0
│   - angularDamping: 0
│   - allowSleep: false
│   - bullet: true  // 高速物体，防止穿透
├── CircleCollider2D:
│   - radius: 22 (BALL_RADIUS，由代码动态设置)
│   - restitution: 0.6 (BALL_RESTITUTION)
│   - friction: 0
│   - enabledContactListener: true
├── SmallBall组件
└── ValueLabel (Node)
    └── Label: fontSize=16, color=黑色
```

### 15.2 BigBallCircle 预制体

```
BigBallCircle (Node)
├── UITransform: width=66, height=66 (BIG_BALL_RADIUS_CIRCLE * 2)
├── Sprite: spriteFrame=圆形图片
├── RigidBody2D:
│   - type: Static
├── CircleCollider2D:
│   - radius: 33 (BIG_BALL_RADIUS_CIRCLE，由代码动态设置)
│   - restitution: 0.2 (BIG_BALL_RESTITUTION)
│   - friction: 0
│   - enabledContactListener: true
├── BigBall组件:
│   - shape: CIRCLE
└── ValueLabel (Node)
    └── Label: fontSize=20, color=白色
```

### 15.3 BigBallDiamond 预制体

```
BigBallDiamond (Node)
├── UITransform: width=56, height=56
├── Rotation: (0, 0, 45)  // 旋转45度形成菱形
├── Sprite: spriteFrame=方形图片
├── RigidBody2D:
│   - type: Static
├── BoxCollider2D:
│   - size: (56, 56)
│   - restitution: 0.2
│   - friction: 0
│   - enabledContactListener: true
├── BigBall组件:
│   - shape: DIAMOND
└── ValueLabel (Node)
    └── Rotation: (0, 0, -45)  // 反向旋转，保持文字正向
    └── Label: fontSize=20, color=白色
```

### 15.4 BombBall 预制体

```
BombBall (Node)
├── UITransform: width=70, height=70
├── Sprite: spriteFrame=炸弹图片
├── RigidBody2D:
│   - type: Dynamic
│   - gravityScale: 0  // 不受重力
│   - linearDamping: 0
│   - allowSleep: false
│   - bullet: true
├── CircleCollider2D:
│   - radius: 35 (BOMB_BALL_RADIUS)
│   - restitution: 1  // 完全弹性，用于墙壁反弹
│   - friction: 0
│   - enabledContactListener: true
└── BombBall组件
```

### 15.5 DoubleBall 预制体

```
DoubleBall (Node)
├── UITransform: width=66, height=66
├── Sprite: spriteFrame=翻倍球图片（带×2标识）
├── RigidBody2D:
│   - type: Static
├── CircleCollider2D:
│   - radius: 33 (DOUBLE_BALL_RADIUS)
│   - sensor: true  // 只检测不碰撞
│   - enabledContactListener: true
├── DoubleBall组件
└── HitCountLabel (Node)
    └── Label: fontSize=16, 显示剩余次数
```

---

## 十六、脚本文件清单与职责

| 文件名 | 职责 |
|--------|------|
| GameConfig.ts | 所有游戏参数配置，包含静态方法用于数值生成 |
| GameManager.ts | 游戏主控制器，状态管理，回合流程，管道数据管理 |
| BallManager.ts | 小球和大球的创建、销毁、管理，道具效果执行 |
| ItemManager.ts | 道具系统管理，按钮状态控制，广告接口调用 |
| SmallBall.ts | 小球行为，碰撞处理，状态管理 |
| BigBall.ts | 大球行为，碰撞处理，动画 |
| BombBall.ts | 炸弹球行为，爆炸逻辑 |
| DoubleBall.ts | 翻倍球行为，碰撞计数 |
| WallCollider.ts | 墙壁类型标识 |
| LaunchController.ts | 发射输入处理，瞄准线绘制 |
| PipeDisplay.ts | 管道可视化显示，位置计算 |
| PipeAnimator.ts | 管道动画（回收、合成） |
| IdleSlotDisplay.ts | 闲置位显示 |
| ScoreDisplay.ts | 分数UI显示 |
| PhysicsConfig.ts | 物理系统配置（如果需要） |
| wx.d.ts | 微信小程序API类型声明 |

---

## 十七、极限情况处理

### 17.1 管道满时的处理
新小球进入闲置位，等待下一回合处理。

### 17.2 闲置位小球无法全部进入管道
循环处理直到管道满或闲置位空。剩余小球保留到下一回合发射前，发射时清空。

### 17.3 合成后管道有新空位
继续从闲置位取小球进入管道，循环处理。

### 17.4 大球到达第9层
立即游戏结束。

### 17.5 小球卡住无法回收
游戏加速机制会逐渐加快速度，最终让小球落下。保底弹射速度确保小球有足够的速度弹开。

### 17.6 炸弹碰到底部墙壁
炸弹直接销毁，不触发爆炸。

### 17.7 翻倍球没有被碰撞3次
翻倍球保留到下一回合。

### 17.8 翻倍球被碰撞超过3次
在 onBeginContact 和 onHitBySmallBall 开头检查 `_remainingHits <= 0`，如果是则直接返回，不执行任何操作。

### 17.9 激光扫描时上4层没有大球
按钮置灰，无法点击。

### 17.10 同时存在多个翻倍球
每个翻倍球独立计数，使用 `_doubleBallTargetPositions` 数组跟踪所有翻倍球位置，新翻倍球不会放置在已有翻倍球的位置。

---

## 十八、待开发功能

### 18.1 游戏结束UI
- 显示最终分数
- 显示最高合成球
- 重新开始按钮
- 分享按钮

### 18.2 微信好友排行榜
- 接入微信开放数据域
- 显示好友分数排名
- 超越好友提示

---

## 十九、初始化流程

### 19.1 游戏启动顺序

```
1. 场景加载完成
2. GameManager.onLoad()
   - 初始化单例
3. BallManager.onLoad()
   - 初始化单例
   - 初始化大球层数组
   - 注册事件监听
4. ItemManager.onLoad()
   - 初始化单例
   - 从本地存储加载道具数量
5. GameManager.start()
   - 获取组件引用（PipeDisplay, IdleSlotDisplay, PipeAnimator, ScoreDisplay）
   - 调用 initGame()
6. initGame()
   - 重置所有状态
   - 设置初始管道小球
   - 重置游戏速度
   - 重置产出概率加成
   - 重置动态规则过渡状态
   - 生成初始大球（3层）
   - 更新管道显示
   - 更新闲置位显示
   - 设置状态为 READY
```

### 19.2 初始大球生成

```typescript
generateInitialBigBalls() {
    // 生成3层大球
    for (let layer = 1; layer <= 3; layer++) {
        // 所有层都使用回合1的数值范围
        generateBigBallLayerWithCapacity(layer, layer, 1, 0);
    }
}
```

---

本文档包含了游戏的所有技术细节，可以作为完整的开发参考。如有任何遗漏或需要进一步说明的地方，请指出。
