# dsh-workbench-kit

「场景工作台」框架的**入口骨架 + 通用框体 + 对话中心**。做三件事：

- 把工作台挂上 DSH 的三条入口（左栏图标列、会话视图条、右栏「开始」页），点开是同一个工作台；
- 工作台本体是一个**通用框体**：标题栏 + 正文席位 + 可折叠的右侧对话栏（只留接口，不写业务）；
- 对话栏里是**对话中心**：按「工作台名 == 工作区名」映射到专属工作区，只列该工作区的会话；
  没有工作区时自动在 `~/Documents/deepseek-harness/<工作台名>` 建目录并注册。

```
dsh-workbench-kit/
├── package.json          # dsh.manifestVersion / dsh.bundle / dsh.client.platform
├── cordis.patch.yml      # 把一个 workbench-kit 条目插进 profile
├── lib/
│   ├── index.js          # 宿主半边（Node）：当前为空实现
│   └── client.js         # 浏览器半边：三处入口 + 通用框体 + 对话中心
├── scripts/
│   └── smoke.mjs         # 离线自检：加载契约 + 注册 + 渲染 + 工作区映射
└── README.md
```

## 入口是怎么挂上去的

| 入口 | 机制 | 关键参数 | 指向的组件 |
|---|---|---|---|
| 左栏图标列（`新会话` 下方、「工作区」上方） | list slot `sidebar.panellist` | `id: "workbench-kit"`, `order: 10`（「插件」是 0） | `WorkbenchIcon` |
| 左栏点击后的中栏页面 | keyed slot `main` | `key` 必须 === 上面那个 `id` | `WorkbenchFrame`（带席位） |
| 会话视图条（`对话 / 轨迹 / 画廊` 之后） | list slot `conversation.view` | `id: "workbench-kit"`, `order: 30`（「画廊」是 20） | `WorkbenchPlain` |
| 右栏「开始」页按钮 + 右栏面板 | `ctx.sidebarRightTabs.register(...)` + keyed slot `sidebar.right.pane.tab` | `id: "dsh-workbench-kit"`, `kind: "workbench"`；tab 正文的 `key` = 那个 `id` | `WorkbenchPlain` |

全部用 `ctx.slots.inject(slot, () => ctx.slots.register(...))`：声明感知，插件先于或后于声明方加载都生效。
右栏能力用 `ctx.inject(["sidebarRightTabs"], …)` 可选等待，右栏插件缺失时只有右栏入口缺席。

## 通用框体与席位

框体（`WorkbenchFrame`）不产出业务内容，只摆三个**席位**：

```
┌──────────────────────────────────────────────────────┬──────────────────┐
│ ▤ xx工作台              [workbench.actions] [对话 ▸] │ 对话             │
├──────────────────────────────────────────────────────┤ ───────────────  │
│                                                      │ 对话中心          │
│            workbench.body（占位：xx工作台）            │（或谁注册进       │
│                                                      │  workbench.aside）│
└──────────────────────────────────────────────────────┴──────────────────┘
```

| 席位 | kind | 用途 |
|---|---|---|
| `workbench.body` | `single` | 正文：将来真正的场景工作台注册在这里 |
| `workbench.aside` | `single` | 右侧对话栏：**b（侧边对话）接入的位置**；空着时显示对话中心 |
| `workbench.actions` | `list` | 标题栏动作位，可挂多个按钮 |

接入方式就是普通注册，不需要改本插件（约定参考 `plugin-manager` 的 `plugins.*` 席位）：

```js
// 谁想把界面放进对话栏，就这样注册
ctx.slots.inject("workbench.aside", () =>
  ctx.slots.register({ name: "workbench.aside", registrant: "你的插件名" }, 你的对话组件));
```

三条硬规则（都在 `@deepseek-ai/dsh-client-ui-slots` 里校验）：

1. **slot 必须先被声明**：`register` 到没人声明的 key 会抛 `slot "…" is not declared`，
   声明写在某个父级注册的 `children` 表里（本插件写在 `main` 座上）。
2. **同一个 slot 只能被声明一次**：所以席位只在 `main` 座声明，另外两个入口用不带席位的
   `WorkbenchPlain`，否则第二次注册就抛 `already declared`。
3. **声明即渲染授权**：只有声明它的那个注册才能用 `props.renderSlot(key)` 渲染（越界抛
   `SlotOwnershipError`）。空席位靠 `renderSlot(key, props, { fallback })` 的 `fallback` 显示占位。

折叠：`useState`，默认展开；标题栏「对话 ▸」和对话栏自己的「▸」都能收起，收起后正文满宽。
宽度是常量 `ASIDE_WIDTH`（340），暂不支持拖拽。

## 对话中心（工作区映射 + 会话管理）

对话栏没人注册席位时，里面就是对话中心：只管理「这个工作台专属工作区」下的会话。

映射规则只有一条：**工作台名 == 工作区标题（或目录名）**。

界面上只有**一个按钮** `+ 新对话`，它把两件事合成一步：

| 点下去时的状态 | 行为 |
|---|---|
| 已有同名工作区 | 直接在里面开新会话（`uiWorkspace.startSession`），左侧自动归到同一组 |
| 没有同名工作区 | 先建好/绑定工作区（见下节三条路径），再开新会话 |
| 会话服务未就绪 | 按钮禁用，栏头显示「会话服务未就绪」，三个入口照常工作 |

要点：

- **不复制会话**：点开的还是左侧同一个会话（`uiWorkspace.openSession`），「对话内容映射在左侧」天然成立，
  这里只是按工作区过滤后的第二入口。
- 工作台名与工作区名对不上时不会硬建：先按目录名兜底匹配，仍没有才建（避免同名重复建）。
- 打开工作台时会**自动认领一次**（只走不需要弹窗的两条路径），这样栏头与历史列表立刻是工作区视角；
  需要弹系统对话框的那条路径只在点 `+ 新对话` 时才走。
- 依赖 `sessions` / `workspaces` / `uiWorkspace` 三个客户端服务（`uiWorkspace` 同时是目录能力的持有者）。
  任一缺失只让对话中心降级，不影响三个入口。

### 建工作区的三条路径（按顺序试）

宿主 `workspaces.create(path)` 要求目录**已存在**（`dsh-workspace` 会 `stat` 校验），而客户端**没有**
通用 fs 通道；目录选择器又分两种能力 —— `browse`（应用内浏览，可 `list` / `createDirectory`）和
`native`（系统对话框，只能 `pick`）。所以：

| 顺序 | 条件 | 动作 |
|---|---|---|
| 1（主路径） | 目标目录已存在 | 直接 `workspaces.create({path})` 注册 |
| 2 | 目录不存在且选择器是 `browse` 型 | 逐层 `createDirectory` 建 `Documents/deepseek-harness/<工作台名>`，再注册 |
| 3（兜底） | 目录不存在且选择器是 `native` 型 | 弹系统对话框选目录（对话框里可新建），再注册 |

本机是 **native** 型，第 2 步会被宿主拒绝：
`directoryPicker.list needs the browse capability; the composed picker serves "native"`。
所以「打开工作台就自动认领」只走第 1、2 步（**不会弹窗**，失败就静默留按钮）；
点「创建工作区」才允许第 3 步弹对话框。

主目录怎么来：客户端拿不到 homedir，用**已有工作区的路径**反推（`C:\Users\X\…` 或 `/home/x/…`），
再拼 `Documents/deepseek-harness/<工作台名>`；一个工作区都没有时反推不出，直接走对话框。

## 安装 / 卸载

```powershell
# 安装（本机已装）
& '…\dsh.cmd' plugin --profile desktop add <本目录>

# 卸载
& '…\dsh.cmd' plugin --profile desktop remove dsh-workbench-kit
```

装载时机：profile 可热重载时改动立即生效，否则重启 DSH 后生效。改完 `lib/client.js` 后刷新页面即可
（客户端 bundle 按行重新拉取）。

## 自检

```powershell
cd plugins\dsh-workbench-kit
node scripts\smoke.mjs      # 62 项
```

不联网、不依赖 GUI：桩 `window.__ModuleLoader__` 捕获工厂，桩 `slots`/`ctx` 记录注册，桩渲染器
（含最小 hook 运行时 + `useSyncExternalStore`）把 `createElement` 树打成 HTML，桩 `renderSlot` 记录
框体请求了哪些席位，桩 picker/workspaces 记录建目录与注册调用。覆盖：包 id、slot 名、id/key 配对、
label/title 文案、席位声明与渲染授权、空席位 fallback、拿不到 `renderSlot` 时退化、工作区映射
（标题 / 目录名 / 缺失）、自动建目录三层与路径、对话中心渲染。**页面是否真的显示出来**只能看 GUI。

## 验收（怎么做才算挂上了）

1. 刷新 Web 页面（F5）：应出现三处入口。
2. 点左栏 `xx工作台`：中栏是框体 —— 标题栏 + 正文占位 + 右侧对话栏。
3. 对话栏里若还没有同名工作区，会显示「创建工作区」；点一下应当建出
   `~/Documents/deepseek-harness/xx工作台` 并在左栏出现同名工作区分组。
4. 点「+ 新对话」应落在这个工作区里；点列表里的一行应打开左侧对应会话。
5. 若入口没出现：重启 DSH（本包是新加的 bundle 行，运行中的宿主未必重读 profile）。

## 改哪里

| 想改的事 | 改这里 |
|---|---|
| 工作台名（`xx工作台` → 真名字） | `lib/client.js` 的 `TITLE`（**同时决定工作区映射**） |
| 正文内容 | 注册进 `workbench.body`；临时占位改 `BlankWorkbench` |
| 对话栏内容 | 注册进 `workbench.aside`；空着时的对话中心改 `ChatCenter` |
| 标题栏按钮 | 注册进 `workbench.actions`（list） |
| 对话栏宽度 | `ASIDE_WIDTH` |
| 对话栏默认收起 | `WorkbenchFrame` 里 `useState(true)` → `false` |
| 自动建工作区的目录名 | `HARNESS_DIR`（默认 `deepseek-harness`） |
| 左栏 / 视图条排序 | 各注册里的 `order`（插件 0、本插件 10；画廊 20、本插件 30） |
| 右栏「开始」页排序 | guide 条目的 `order` |

## 已知边界

- 只有入口、框体与对话中心；正文还没有任何业务功能，也没有设置项与快捷键。
- 框体折叠状态是组件本地 state：换面板 / 刷新后回到展开。
- 对话栏宽度固定，不支持拖拽；没有「全屏工作台」开关。
- 对话中心只做「列 + 打开 + 新建」：重命名 / 归档 / 删除会话沿用左侧菜单，这里没做。
- 自动建工作区依赖 `ctx.remote.directoryPicker`（宿主目录能力）。若该能力不可用，只会在对话中心
  报错并保留「创建工作区」按钮，不会硬失败。
- 视图条那条入口是纯文字标签（那一条本来就只有文字）；且非「对话」视图激活时输入框不在屏上，
  若要「工作台正文 + 输入框常驻」需另做布局。
- 席位只在左栏入口（`main` 座）那一份框体上；视图条与右栏用不带席位的 `WorkbenchPlain`。
- 若 b 是「右栏 tab 类型」形态（如 `dsh-better-sidebar` 的 `侧边对话(beta)`），它落点是宿主右栏，
  不是 `workbench.aside`；那种情况需要一个适配器（框体里加按钮去 `openTab` 把它开到右栏）。
- 宿主半边是空实现：不注册服务、不开 HTTP 路由、不加工具。
