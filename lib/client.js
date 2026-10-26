/**
 * dsh-workbench-kit · 浏览器半边（客户端 bundle）
 *
 * 这是本包的 `./client` 导出，由 dsh-client-modules 以
 * `window.__ModuleLoader__.load({ id, factory })` 形式在浏览器里注册为工厂，
 * 首次物化时才执行工厂体（factory），因此文件顶部不产生任何副作用。
 *
 * 它只做四件事（就是「工作台框架」的第一层：入口骨架）：
 *
 *   1) 左栏入口 —— root 作用域 list slot `sidebar.panellist` 里的一行图标；
 *      同一 id 寻址 root 作用域 keyed slot `main` 里的页面组件，
 *      点这一行 = `ctx.layout.selectPanel(id)` = 中栏换成该页面。
 *   2) 中栏页面 —— 一张空白工作台，先用文字占位 `xx工作台`。
 *   3) 中栏视图条 —— 会话面板内部的 list slot `conversation.view`，与
 *      「对话 / 轨迹 / 画廊」并列的一个视图标签（图像工作台的「画廊」挂在同一处）。
 *   4) 右栏入口 —— 右栏 tab 类型（`ctx.sidebarRightTabs`）带一个 guide 入口框，
 *      它出现在右栏「开始」页的按钮列表里（与「图像工作台」同一位置）；
 *      正文注册在 slot `sidebar.right.pane.tab`。
 *
 * 依赖说明：`react` / `react/jsx-runtime` 由宿主作为 PLATFORM_MODULES 基线提供，
 * 不必写进 `dsh.client.inject`（本包只 require `react`，未声明任何非基线模块）。
 */

window.__ModuleLoader__.load({
	id: "dsh-workbench-kit",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		/**
		 * 占位文案。框架层先把入口跑通，真实工作台名与内容随后替换这里。
		 */
		const TITLE = "xx工作台";

		/**
		 * 左栏面板 id：list slot 条目的 `id` 与 keyed slot 的 `key` 必须是同一个值，
		 * 这样点击左栏那一行就会选中同名主面板。
		 */
		const PANEL_ID = "workbench-kit";

		/** 右栏 tab 类型的身份（在全部 tab 注册中唯一，包名是天然取值）。 */
		const TAB_ID = "dsh-workbench-kit";

		/** 右栏页类型名：`ctx.sidebarRight.openTab(kind)` 用它寻址。 */
		const TAB_KIND = "workbench";

		/* ---------------- 通用框体留的席位（本插件自己声明的 slot） ----------------
		 * 声明方式：在 `main` 的注册里写 children 表 —— slot 必须先被某个父级注册
		 * 声明出来，别人才能注册进去；而「声明即渲染授权」：只有声明它的那个注册，
		 * 才能在自己的组件里用 props.renderSlot(key) 把它渲染出来。
		 * 所以席位声明挂在工作台的主座（左栏入口 → `main`）上，另外两个入口用
		 * 不带席位的简化组件（WorkbenchPlain），避免同一个 slot 被声明两次。
		 */
		const BODY_SLOT = "workbench.body";       // 正文席位：真正的场景工作台放这里
		const ASIDE_SLOT = "workbench.aside";     // 右侧对话栏席位：b 接入的位置
		const ACTIONS_SLOT = "workbench.actions"; // 标题栏动作位（list，可挂多个按钮）
		const ASIDE_WIDTH = 340;                  // 对话栏宽度；折叠后正文自动满宽
		/** 自动建工作区时，放在「文档」下的那一层目录名。 */
		const HARNESS_DIR = "deepseek-harness";
		/** 对话栏折叠状态的 localStorage 键。 */
		const ASIDE_STATE_KEY = "dsh.workbench-kit.aside-open";

		/**
		 * 读对话栏折叠状态（默认展开）。存储不可用（隐私模式 / 非浏览器）时退回展开。
		 * @returns {boolean} 是否展开。
		 */
		function readAsideOpen() {
			try {
				const raw = globalThis.localStorage?.getItem(ASIDE_STATE_KEY);
				if (raw === void 0 || raw === null) return true;
				return raw !== "0";
			} catch {
				return true;
			}
		}

		/**
		 * 记住对话栏折叠状态。写失败只影响「记不住」，不影响 UI。
		 * @param {boolean} open 是否展开。
		 */
		function writeAsideOpen(open) {
			try {
				globalThis.localStorage?.setItem(ASIDE_STATE_KEY, open ? "1" : "0");
			} catch {
				/* 存不了就算了，界面照常工作 */
			}
		}

		/**
		 * 左栏入口图标，同时用作右栏 guide 入口框的图标。
		 * 侧边栏以 `renderSlot("sidebar.panellist", { size, active })` 渲染，
		 * guide 入口框以 `{ size, className }` 渲染，因此两者都读。
		 * @param {{ size?: number, active?: boolean, className?: string }} props 图标 share。
		 * @returns {import('react').ReactElement} 图标元素。
		 */
		function WorkbenchIcon({ size = 16, active = false, className } = {}) {
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: active ? 1.9 : 1.6,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					className,
					"aria-hidden": "true",
					focusable: "false",
				},
				[
					h("rect", { key: "frame", x: 3, y: 4.5, width: 18, height: 15, rx: 2.5 }),
					h("path", { key: "split", d: "M9.5 4.5v15" }),
					h("path", { key: "bar", d: "M12.5 9h5.5" }),
					h("path", { key: "bar2", d: "M12.5 12.5h5.5" }),
				],
			);
		}

		/**
		 * 空白工作台。中栏主面板与右栏面板共用同一个组件：
		 * 两者都是「点进去看到的那张工作台」，因此外观保持一致。
		 *
		 * 顶部内边距读布局发布的 `--dsh-frame-top-clearance`，让内容避开
		 * Windows 标题栏 / macOS 顶带——与插件管理器等入口型页面同一约定。
		 *
		 * @returns {import('react').ReactElement} 居中的占位工作台。
		 */
		function BlankWorkbench() {
			return h(
				"div",
				{
					"data-dsh-workbench-kit": "blank",
					style: {
						boxSizing: "border-box",
						height: "100%",
						width: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						paddingTop: "var(--dsh-frame-top-clearance, 0px)",
						background: "var(--dsw-alias-bg-base, transparent)",
					},
				},
				h(
					"span",
					{
						style: {
							fontSize: 32,
							fontWeight: 600,
							letterSpacing: "0.12em",
							color: "var(--dsw-alias-text-3, var(--dsw-alias-text-2, #9aa0a6))",
							userSelect: "none",
						},
					},
					TITLE,
				),
			);
		}

		/**
		 * 对话栏座位空着时的提示卡。b（侧边对话）接进来之前，这一列显示它，
		 * 告诉使用者这一列是留给谁的、以及怎么把它填上。
		 * @returns {import('react').ReactElement} 提示卡。
		 */
		function AsidePlaceholder() {
			return h(
				"div",
				{
					"data-dsh-workbench-kit": "aside-placeholder",
					style: {
						boxSizing: "border-box",
						margin: 12,
						padding: 16,
						border: "1px dashed var(--dsw-alias-border-l3, rgba(128,128,128,.35))",
						borderRadius: 10,
						display: "flex",
						flexDirection: "column",
						gap: 8,
						color: "var(--dsw-alias-label-tertiary, #9aa0a6)",
						fontSize: 12,
						lineHeight: 1.7,
					},
				},
				[
					h("span", { key: "title", style: { fontSize: 13, color: "var(--dsw-alias-label-secondary, #6b7280)" } }, "对话席位（待接入）"),
					h("span", { key: "slot" }, [`插槽 `, h("code", { key: "code" }, ASIDE_SLOT)]),
					h(
						"span",
						{ key: "how" },
						"任何插件执行 ctx.slots.inject(\"workbench.aside\", …) 注册进来的组件都会出现在这一列；折叠后工作台正文占满整宽。",
					),
				],
			);
		}

		/**
		 * 对话中心：这一列就是「工作台专属工作区」的会话管理面。
		 *
		 * 映射规则（本插件唯一的约定）：工作台名 == 工作区的标题/目录名。
		 *  - 找到同名工作区 → 只列它名下的会话（workspace.sessionIds）；
		 *  - 没找到 → 按需在「文档/deepseek-harness/<工作台名>」建目录并注册成工作区，
		 *    然后同样只列这个工作区的会话。
		 * 会话本身不复制、不另存：它打开的还是左侧同一个会话（uiWorkspace.openSession），
		 * 所以「对话内容映射在左侧」天然成立，这里只是按工作区过滤后的入口。
		 *
		 * @param {{
		 *   chat: {
		 *     ready: boolean, error: string|null,
		 *     sessions: {subscribe: Function, getSnapshot: Function}|null,
		 *     workspaces: {subscribe: Function, getSnapshot: Function}|null,
		 *     ensureWorkspace: Function|null, startSession: Function|null, openSession: Function|null
		 *   }
		 * }} props
		 * @returns {import('react').ReactElement} 对话中心。
		 */
		function ChatCenter({ chat }) {
			const workspaces = chat?.workspaces;
			const sessions = chat?.sessions;
			// 订阅用箭头包一层：store 的 subscribe/getSnapshot 可能是方法，直接传引用会丢 this。
			const workspaceState = React.useSyncExternalStore(
				workspaces ? (listener) => workspaces.subscribe(listener) : noopSubscribe,
				workspaces ? () => workspaces.getSnapshot() : emptyWorkspaceState,
			);
			const sessionState = React.useSyncExternalStore(
				sessions ? (listener) => sessions.subscribe(listener) : noopSubscribe,
				sessions ? () => sessions.getSnapshot() : emptySessionState,
			);
			const [busy, setBusy] = React.useState(false);
			const [failure, setFailure] = React.useState(null);
			const [autoTried, setAutoTried] = React.useState(false);

			const items = workspaceState?.items ?? [];
			const match = findWorkspace(items, TITLE);

			const claim = React.useCallback(async (allowPick = false) => {
				if (typeof chat?.ensureWorkspace !== "function") return;
				setBusy(true);
				setFailure(null);
				try {
					await chat.ensureWorkspace({ allowPick });
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			}, [chat]);

			// 没有同名工作区就自动认领一次（注册已有目录 / browse 型能力建目录）。
			// 自动这一次**不弹系统对话框**；失败后不重试，交给按钮（按钮才允许弹）。
			React.useEffect(() => {
				if (autoTried || match !== undefined || !chat?.ready) return;
				if (workspaceState?.phase !== "ready") return;
				setAutoTried(true);
				claim(false);
			}, [autoTried, match, chat, workspaceState?.phase, claim]);

			const rows = match === undefined
				? []
				: (match.sessionIds ?? [])
						.filter((id) => !(workspaceState?.archivedSessionIds ?? []).includes(id))
						.map((id) => sessionState?.byId?.[id] ?? { sessionId: id })
						.map((row) => ({
							id: row.sessionId ?? row.id,
							title: row.displayTitle || row.title || "（未命名对话）",
							updatedAt: row.updatedAt ?? row.lastActivityAt ?? null,
							running: row.status === "running" || row.busy === true,
						}));

			const header = h(
				"div",
				{ key: "ws", style: { padding: "12px 14px 8px", display: "flex", flexDirection: "column", gap: 4 } },
				[
					h(
						"div",
						{ key: "name", style: { fontSize: 12, fontWeight: 600, color: "var(--dsw-alias-label-primary, #1f2328)" } },
						match === undefined ? "工作区未绑定" : match.title || TITLE,
					),
					h(
						"div",
						{
							key: "path",
							title: match?.path ?? "",
							style: {
								fontSize: 11,
								color: "var(--dsw-alias-label-tertiary, #9aa0a6)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							},
						},
						match?.path ?? (chat?.ready ? "点击下方按钮创建" : "会话服务未就绪"),
					),
				],
			);

			// 一个按钮做完两件事：没有工作区就先建（或绑定已有的），再在这个工作区里开新会话。
			// 目录不存在且选择器是 native 型时，这一步会弹系统对话框（用户可在其中新建文件夹）。
			const newConversation = React.useCallback(async () => {
				if (chat?.ready !== true) return;
				setBusy(true);
				setFailure(null);
				try {
					let workspace = match;
					if (workspace === undefined) {
						if (typeof chat.ensureWorkspace !== "function") throw new Error("工作区服务未就绪");
						workspace = await chat.ensureWorkspace({ allowPick: true });
					}
					const workspaceId = workspace?.workspaceId;
					if (typeof workspaceId !== "string") throw new Error("没能拿到工作区，无法新建会话");
					if (typeof chat.startSession !== "function") throw new Error("会话服务未就绪，无法新建会话");
					await chat.startSession(workspaceId);
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			}, [chat, match]);

			const actions = h(
				"div",
				{ key: "actions", style: { display: "flex", gap: 6, padding: "0 14px 10px" } },
				[
					h(
						"button",
						{
							key: "new",
							type: "button",
							disabled: busy || chat?.ready !== true,
							onClick: () => newConversation(),
							title: "没有工作区时先建好（或绑定同名工作区），再把新会话放进去",
							style: buttonStyle(true),
						},
						busy ? "处理中…" : "+ 新对话",
					),
				],
			);

			const list = h(
				"div",
				{ key: "list", style: { flex: 1, minHeight: 0, overflow: "auto", padding: "0 8px 12px" } },
				[
					failure !== null &&
						h(
							"div",
							{
								key: "failure",
								style: { margin: "0 6px 8px", fontSize: 11, lineHeight: 1.6, color: "var(--dsw-alias-label-danger, #d33)" },
							},
							`创建工作区失败：${failure}`,
						),
					match === undefined &&
						h(
							"div",
							{
								key: "hint",
								style: {
									margin: "0 6px",
									padding: 12,
									border: "1px dashed var(--dsw-alias-border-l3, rgba(128,128,128,.35))",
									borderRadius: 10,
									fontSize: 11,
									lineHeight: 1.7,
									color: "var(--dsw-alias-label-tertiary, #9aa0a6)",
								},
							},
							[
								h("div", { key: "t" }, `还没有叫「${TITLE}」的工作区。`),
								h(
									"div",
									{ key: "p" },
									`点上方「+ 新对话」会自动建好 ~/Documents/${HARNESS_DIR}/${TITLE} 并注册为工作区，然后把新会话放进去；已有同名工作区就直接绑上。`,
								),
							],
						),
					match !== undefined && rows.length === 0 &&
						h(
							"div",
							{ key: "empty", style: { margin: "8px 6px", fontSize: 11, color: "var(--dsw-alias-label-tertiary, #9aa0a6)" } },
							"这个工作区还没有对话。",
						),
					rows.map((row) =>
						h(
							"button",
							{
								key: row.id,
								type: "button",
								onClick: () => chat?.openSession?.(row.id),
								title: row.id,
								style: {
									display: "flex",
									alignItems: "center",
									gap: 8,
									width: "100%",
									padding: "8px 10px",
									margin: "2px 0",
									font: "inherit",
									fontSize: 12,
									textAlign: "left",
									color: "var(--dsw-alias-label-primary, #1f2328)",
									background: "transparent",
									border: "none",
									borderRadius: 7,
									cursor: "pointer",
								},
							},
							[
								h("span", { key: "dot", style: { flex: "none", width: 6, height: 6, borderRadius: 3, background: row.running ? "#3ba55d" : "var(--dsw-alias-border-l2, rgba(128,128,128,.4))" } }),
								h(
									"span",
									{ key: "title", style: { flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
									row.title,
								),
								h("span", { key: "arrow", style: { flex: "none", opacity: 0.45 } }, "›"),
							],
						),
					),
				],
			);

			return h("div", { "data-dsh-workbench-kit": "chat-center", style: { display: "flex", flexDirection: "column", height: "100%", minHeight: 0 } }, [
				header,
				actions,
				list,
			]);
		}

		/** 空 store 占位：服务未就绪时 useSyncExternalStore 也必须有稳定引用。 */
		function noopSubscribe() {
			return () => {};
		}
		const EMPTY_WORKSPACE_STATE = Object.freeze({ items: [], archivedSessionIds: [], pinnedSessionIds: [], phase: "pending" });
		const EMPTY_SESSION_STATE = Object.freeze({ byId: {} });
		function emptyWorkspaceState() {
			return EMPTY_WORKSPACE_STATE;
		}
		function emptySessionState() {
			return EMPTY_SESSION_STATE;
		}

		/**
		 * 按名字找本工作台对应的工作区：先比标题，再比目录名。
		 * @param {Array<{workspaceId: string, title?: string, path?: string}>} items 工作区列表。
		 * @param {string} title 工作台名。
		 * @returns {object|undefined} 命中的工作区。
		 */
		function findWorkspace(items, title) {
			const wanted = String(title).trim();
			return items.find((item) => String(item.title ?? "").trim() === wanted)
				?? items.find((item) => String(baseName(item.path ?? "")).trim() === wanted);
		}

		/** 取路径最后一段（同时认 `/` 与 `\`）。 */
		function baseName(path) {
			const parts = String(path).split(/[\\/]/).filter((part) => part.length > 0);
			return parts.length === 0 ? "" : parts[parts.length - 1];
		}

		/** 拼 Windows / POSIX 路径。 */
		function joinPath(parent, child) {
			const separator = String(parent).includes("\\") && !String(parent).includes("/") ? "\\" : "/";
			return String(parent).replace(/[\\/]+$/, "") + separator + child;
		}

		/** 对话中心里的小按钮样式。 */
		function buttonStyle(primary) {
			return {
				flex: "none",
				height: 26,
				padding: "0 10px",
				font: "inherit",
				fontSize: 11,
				borderRadius: 7,
				cursor: "pointer",
				color: primary ? "#fff" : "var(--dsw-alias-label-secondary, #6b7280)",
				background: primary ? "var(--dsw-alias-brand-fill, #2f6fed)" : "var(--dsw-alias-bg-layer-1, transparent)",
				border: primary ? "none" : "0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,.35))",
			};
		}

		/**
		 * 通用框体：标题栏（图标 + 名称 + 动作位 + 对话栏开关）＋ 正文席位 ＋ 右侧对话栏。
		 *
		 * 它自己不产出任何业务内容：正文与对话栏都是席位，内容由注册进
		 * `workbench.body` / `workbench.aside` 的组件决定，空着时各自显示占位。
		 * 折叠状态记在 localStorage（刷新、换面板都保持）；存储不可用时退回默认展开。
		 *
		 * @param {{ renderSlot: Function, chat?: object }} props 席位渲染器（由渲染层注入；
		 *   只能渲染本注册 children 表里声明过的 key，越界会抛 SlotOwnershipError）。
		 * @returns {import('react').ReactElement} 框体。
		 */
		function WorkbenchFrame({ renderSlot, chat }) {
			// 席位渲染器由渲染层以 props.renderSlot 注入。万一这一份没拿到（例如被当成
			// 无席位变体用），退化成「只渲染 fallback」：宁可没有席位，也别让一个
			// TypeError 把整个入口判死（slot 条目崩溃会被摘掉，入口直接消失）。
			const seat =
				typeof renderSlot === "function"
					? renderSlot
					: (_key, _props, options) => options?.fallback ?? null;
			const [asideOpen, setAsideOpen] = React.useState(readAsideOpen);
			const toggleAside = React.useCallback(() => {
				setAsideOpen((open) => {
					writeAsideOpen(!open);
					return !open;
				});
			}, []);
			const body = seat(BODY_SLOT, {}, { fallback: h(BlankWorkbench) });
			const actions = seat(ACTIONS_SLOT, {}, { fallback: null });
			return h(
				"div",
				{
					"data-dsh-workbench-kit": "frame",
					"data-dsh-workbench-aside": asideOpen ? "open" : "collapsed",
					style: {
						boxSizing: "border-box",
						height: "100%",
						width: "100%",
						display: "flex",
						flexDirection: "column",
						minHeight: 0,
						paddingTop: "var(--dsh-frame-top-clearance, 0px)",
						background: "var(--dsw-alias-bg-base, transparent)",
					},
				},
				[
					h(
						"div",
						{
							key: "header",
							style: {
								boxSizing: "border-box",
								flex: "none",
								display: "flex",
								alignItems: "center",
								gap: 10,
								minHeight: 44,
								padding: "0 12px 0 16px",
								borderBottom: "0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,.25))",
							},
						},
						[
							h(WorkbenchIcon, { key: "icon", size: 16, active: true }),
							h(
								"span",
								{
									key: "title",
									style: {
										fontSize: 13,
										fontWeight: 600,
										letterSpacing: "0.04em",
										color: "var(--dsw-alias-label-primary, #1f2328)",
									},
								},
								TITLE,
							),
							h("span", { key: "spacer", style: { flex: 1, minWidth: 8 } }),
							h("span", { key: "actions", style: { display: "flex", alignItems: "center", gap: 6 } }, actions),
							h(
								"button",
								{
									key: "asideToggle",
									type: "button",
									title: asideOpen ? "收起对话栏" : "展开对话栏",
									"aria-expanded": asideOpen,
									onClick: toggleAside,
									style: {
										flex: "none",
										display: "flex",
										alignItems: "center",
										gap: 4,
										height: 26,
										padding: "0 10px",
										font: "inherit",
										fontSize: 12,
										color: "var(--dsw-alias-label-secondary, #6b7280)",
										background: "var(--dsw-alias-bg-layer-1, transparent)",
										border: "0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,.35))",
										borderRadius: 7,
										cursor: "pointer",
									},
								},
								[asideOpen ? "对话 ▸" : "◂ 对话"],
							),
						],
					),
					h(
						"div",
						{ key: "row", style: { flex: 1, minHeight: 0, display: "flex", alignItems: "stretch" } },
						[
							h("div", { key: "body", style: { flex: 1, minWidth: 0, minHeight: 0, display: "flex" } }, body),
							asideOpen &&
								h(
									"div",
									{
										key: "aside",
										style: {
											flex: `0 0 ${ASIDE_WIDTH}px`,
											width: ASIDE_WIDTH,
											minHeight: 0,
											display: "flex",
											flexDirection: "column",
											borderLeft: "0.5px solid var(--dsw-alias-border-l3, rgba(128,128,128,.25))",
										},
									},
									[
										h(
											"div",
											{
												key: "asideHeader",
												style: {
													flex: "none",
													display: "flex",
													alignItems: "center",
													gap: 8,
													minHeight: 36,
													padding: "0 8px 0 14px",
												},
											},
											[
												h(
													"span",
													{
														key: "asideLabel",
														style: {
															flex: 1,
															fontSize: 12,
															color: "var(--dsw-alias-label-secondary, #6b7280)",
														},
													},
													"对话",
												),
												h(
													"button",
													{
														key: "asideCollapse",
														type: "button",
														title: "收起对话栏",
														onClick: toggleAside,
														style: {
															flex: "none",
															width: 24,
															height: 24,
															font: "inherit",
															fontSize: 12,
															lineHeight: 1,
															color: "var(--dsw-alias-label-secondary, #6b7280)",
															background: "transparent",
															border: "none",
															cursor: "pointer",
														},
													},
													"▸",
												),
											],
										),
										h(
											"div",
											{ key: "asideSeat", style: { flex: 1, minHeight: 0, overflow: "auto" } },
											// 席位内容优先：谁注册进 workbench.aside 就显示谁；
											// 没人注册时显示对话中心（工作区映射 + 会话列表）。
											seat(ASIDE_SLOT, { chat }, { fallback: h(ChatCenter, { chat }) }),
										),
									],
								),
						],
					),
				],
			);
		}

		/**
		 * 不带席位的简化工作台：给「会话视图条」和「右栏面板」两个入口用。
		 *
		 * 那两处不需要（也不该）再声明一套席位——同一个 slot 只能被一个注册声明，
		 * 而且右栏那一列本来就窄。所以它们只显示正文占位。
		 *
		 * @returns {import('react').ReactElement} 空白工作台。
		 */
		function WorkbenchPlain() {
			return h(BlankWorkbench);
		}


		/**
		 * 本插件需要的基础服务。只声明 `slots`：它由 UI 渲染层提供，任何 Web
		 * 组合都有。右栏能力用 `ctx.inject([...])` 可选等待（见 apply），
		 * 这样「右栏插件缺失」不会连其它入口一起拖死。
		 */
		const inject = ["slots"];

		/**
		 * 对话中心的服务袋。apply 里把可用的服务填进来；框体通过注册的 inject 拿到它。
		 * 用可变对象是为了让「服务晚到」也能被同一份引用感知到（组件自己订阅 store）。
		 * @param {string} title 工作台名（= 要映射到的工作区名）。
		 * @returns {object} 服务袋。
		 */
		function createChatBridge(title) {
			return {
				ready: false,
				title,
				navigation: false,
				sessions: null,
				workspaces: null,
				ensureWorkspace: null,
				startSession: null,
				openSession: null,
			};
		}

		/**
		 * 按需拿到「工作台专属工作区」：没有同名工作区时注册
		 * `~/Documents/deepseek-harness/<工作台名>`（目录不存在再想办法建）。
		 *
		 * 为什么分三层：宿主的目录选择器有两种能力 —— `browse`（应用内浏览，
		 * 可 list / createDirectory）和 `native`（系统对话框，只能 pick）。
		 * 本机是 native，实测报
		 * `directoryPicker.list needs the browse capability; the composed picker serves "native"`，
		 * 所以顺序是：
		 *   1. 目录已经存在（比如由宿主侧建好）→ 直接 workspaces.create 注册；
		 *   2. browse 型能力在位 → 逐层建目录再注册；
		 *   3. native 型能力 → 弹系统对话框选一个目录（用户可在对话框里新建）。
		 *
		 * @param {{ workspaces: object, picker: object|undefined, title: string, allowPick?: boolean }} input
		 *   allowPick=false 时绝不弹对话框（用于「打开工作台时自动尝试」）。
		 * @returns {Promise<object>} 命中的或新建的工作区。
		 */
		async function ensureWorkbenchWorkspace({ workspaces, picker, title, allowPick = false }) {
			const state = workspaces.list.getSnapshot();
			const found = findWorkspace(state?.items ?? [], title);
			if (found !== void 0) return found;
			const items = state?.items ?? [];
			const planned = plannedWorkspacePath(items, title);
			const problems = [];

			// 1. 目录已存在：create 内部会 stat 校验，存在就直接成功（这是最快路径）。
			if (planned !== void 0) {
				try {
					return settleWorkspace(await step("注册工作区", () => workspaces.create({ path: planned.target })), workspaces, title);
				} catch (error) {
					problems.push(error.message);
				}
				// 2. browse 型能力：逐层建（native 型会在这里以 directory-picker/unavailable 失败）。
				if (typeof picker?.createDirectory === "function") {
					try {
						await createTree(picker, planned.home, ["Documents", HARNESS_DIR, title]);
						return settleWorkspace(await step("注册工作区", () => workspaces.create({ path: planned.target })), workspaces, title);
					} catch (error) {
						problems.push(error.message);
					}
				}
			}

			// 3. native 型能力：让用户用系统对话框选（对话框里可以新建文件夹）。
			if (allowPick && typeof picker?.pickDirectory === "function") {
				const picked = await step("选择目录", () => picker.pickDirectory());
				if (typeof picked === "string" && picked.length > 0) {
					return settleWorkspace(await step("注册工作区", () => workspaces.create({ path: picked })), workspaces, title);
				}
				problems.push("已取消目录选择");
			}

			throw new Error(problems.length > 0 ? problems.join("；") : "无法创建工作区（目录能力与工作区服务都不可用）");
		}

		/**
		 * 收下 workspaces.create 的返回（两种形状都见过：Remote 结果 `{ok, value:{workspace}}`
		 * 或直接是 workspace 行），拿不到就回查一次列表。
		 * @param {any} result create 的返回。
		 * @param {object} workspaces 工作区服务。
		 * @param {string} title 工作台名。
		 * @returns {object} 工作区行。
		 */
		function settleWorkspace(result, workspaces, title) {
			if (result?.ok === false) throw new Error(result?.error?.message ?? "注册工作区失败");
			const workspace = result?.value?.workspace ?? result?.workspace ?? result?.value ?? result;
			if (workspace === undefined || workspace === null || typeof workspace !== "object") {
				return findWorkspace(workspaces.list.getSnapshot()?.items ?? [], title);
			}
			return workspace;
		}

		/**
		 * 推出默认工作区路径：主目录从**已有工作区的路径**里反推（客户端拿不到 homedir）。
		 * @param {Array<{path?: string}>} items 现有工作区。
		 * @param {string} title 工作台名。
		 * @returns {{home: string, target: string}|undefined} 计划路径；推不出主目录时为 undefined。
		 */
		function plannedWorkspacePath(items, title) {
			const home = homeFromWorkspaces(items);
			if (home === void 0) return void 0;
			return { home, target: joinPath(joinPath(joinPath(home, "Documents"), HARNESS_DIR), title) };
		}

		/**
		 * 从已有工作区路径反推用户主目录：`C:\Users\X\…` 或 `/home/x/…`。
		 * @param {Array<{path?: string}>} items 现有工作区。
		 * @returns {string|undefined} 主目录。
		 */
		function homeFromWorkspaces(items) {
			for (const item of items) {
				const path = String(item?.path ?? "");
				const windows = /^([A-Za-z]:\\Users\\[^\\]+)(\\|$)/.exec(path);
				if (windows !== null) return windows[1];
				const posix = /^(\/(?:home|Users)\/[^/]+)(\/|$)/.exec(path);
				if (posix !== null) return posix[1];
			}
			return void 0;
		}

		/**
		 * 逐层建目录（browse 型目录能力才有）。
		 * @param {object} picker 目录能力。
		 * @param {string} home 已存在的起点目录。
		 * @param {string[]} names 依次要建的子目录名。
		 */
		async function createTree(picker, home, names) {
			let parent = home;
			for (const name of names) {
				await ensureDirectory(picker, parent, name);
				parent = joinPath(parent, name);
			}
		}

		/**
		 * 把一步操作的失败包成「哪一步 + 真实原因」，这样界面上的红字就能直接定位。
		 * @param {string} label 步骤名。
		 * @param {() => Promise<any>} run 操作。
		 * @returns {Promise<any>} 操作结果。
		 */
		async function step(label, run) {
			try {
				return await run();
			} catch (error) {
				const rpc = error?.rpcError;
				const detail = rpc !== void 0
					? `${rpc.code ?? "?"}: ${rpc.message ?? ""}`
					: error?.code !== void 0
						? `${error.code}: ${error.message ?? ""}`
						: error?.message ?? String(error);
				throw new Error(`${label} → ${detail}`);
			}
		}

		/**
		 * 建一层目录，已存在则忽略。
		 * @param {object} picker 宿主目录能力。
		 * @param {string} parent 已存在的父目录。
		 * @param {string} name 子目录名。
		 */
		async function ensureDirectory(picker, parent, name) {
			try {
				await picker.createDirectory(parent, name);
			} catch (error) {
				const message = String(error?.rpcError?.code ?? error?.code ?? "") + " " + String(error?.message ?? "");
				if (!/exists/i.test(message)) {
					const detail = error?.rpcError ? `${error.rpcError.code}: ${error.rpcError.message}` : message.trim();
					throw new Error(`创建目录 ${name} → ${detail}`);
				}
			}
		}

		/**
		 * 注册三处入口与它们指向的工作台框体。
		 * @param {import('@deepseek-ai/cordis').Context} ctx 浏览器插件上下文。
		 */
		function apply(ctx) {
			/* ---------------- 对话中心：工作区映射 + 会话管理 ---------------- */

			// 依赖逐个可选等待：任一缺失只让对话中心降级，不牵连三个入口。
			//  - sessions / workspaces：客户端 store（会话与工作区投影，workspaces 自带 sessionIds）
			//  - uiWorkspace：导航服务（startSession / openSession / pickDirectory），
			//    同时它也是目录能力的持有者（listDirectory / createDirectory 都挂在它身上），
			//    所以不必注入 `remote` —— 那样会撞上 cordis 服务访问守卫。
			//    本机目录选择器是 native 能力（只能 pick），list/createDirectory 会被宿主拒绝，
			//    因此「建工作区」的主路径是「注册已存在的目录」，兜底才是系统对话框。
			const chat = createChatBridge(TITLE);
			ctx.inject(["sessions", "workspaces", "uiWorkspace"], (env) => {
				const sessions = env.get("sessions");
				const workspaces = env.get("workspaces");
				const navigation = env.get("uiWorkspace");
				if (sessions === void 0 || workspaces === void 0) return;
				Object.assign(chat, {
					ready: true,
					// uiWorkspace 就是目录能力的持有者；缺它时对话中心仍可列/开会话，
					// 只是「创建工作区」会报错并说明原因。
					navigation: navigation !== void 0,
					sessions: sessions.list,
					workspaces: workspaces.list,
					ensureWorkspace: (options) =>
						ensureWorkbenchWorkspace({
							workspaces,
							// 传服务本身（不是解构出来的方法），方法调用时 this 才不会丢。
							picker: navigation,
							title: TITLE,
							// 只有用户点按钮时才允许弹系统目录对话框。
							allowPick: options?.allowPick === true,
						}),
					startSession: (workspaceId) => navigation?.startSession?.(workspaceId),
					openSession: (sessionId) => navigation?.openSession?.(sessionId),
				});
				return () => {
					chat.ready = false;
				};
			});

			/* ---------------- 左栏：中栏主面板入口 ---------------- */

			// 声明感知注册：无论侧边栏（声明方）先于还是后于本插件激活都生效。
			ctx.slots.inject("sidebar.panellist", () =>
				ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: PANEL_ID,
						// 排在「插件」之后（插件用 order 0）。
						order: 10,
						label: () => TITLE,
					},
					WorkbenchIcon,
				),
			);

			// 同一 id 指向的页面：选中即渲染到中栏（keyed slot `main`）。
			// 这是工作台的「主座」：通用框体的席位在这里声明（children 表），
			// 因此只有这个组件能 renderSlot 出这些席位。
			ctx.slots.inject("main", () =>
				ctx.slots.register(
					{
						name: "main",
						key: PANEL_ID,
						// 对话中心的服务袋（可晚到；组件自己订阅 store）。
						inject: () => ({ chat }),
						children: {
							[BODY_SLOT]: { kind: "single", scope: "root" },
							[ASIDE_SLOT]: { kind: "single", scope: "root" },
							[ACTIONS_SLOT]: { kind: "list", scope: "root" },
						},
					},
					WorkbenchFrame,
				),
			);

			/* ---------------- 中栏视图条：对话 / 轨迹 / 画廊 / xx工作台 ---------------- */

			// 会话面板（`main` 的 conversation 座）内部还有一条视图带：它的子 slot
			// `conversation.view`（list，scope: session）就是「对话 / 轨迹 / 画廊」那三个
			// 标签的来源，激活项由 `renderSlot("conversation.view", …, { only: viewId })`
			// 渲染进会话的正文区。图像工作台正是用它把「画廊」挂在那里（order 20）。
			ctx.slots.inject("conversation.view", () =>
				ctx.slots.register(
					{
						name: "conversation.view",
						id: PANEL_ID,
						// 排在「画廊」之后。
						order: 30,
						label: () => TITLE,
					},
					WorkbenchPlain,
				),
			);

			/* ---------------- 右栏：开始页入口 + 面板正文 ---------------- */

			ctx.inject(["sidebarRightTabs"], (right) => {
				// 1) tab 类型：guide 里的入口框会出现在右栏「开始」页的按钮列表。
				right.effect(
					() =>
						right.get("sidebarRightTabs").register({
							id: TAB_ID,
							kind: TAB_KIND,
							priority: "extension",
							title: () => TITLE,
							// guide 入口框：右栏「开始」页里的那一个按钮。
							// 同一类型的多个入口框之间 id 必须唯一。
							guide: [{ id: TAB_ID, order: 100, title: () => TITLE, icon: WorkbenchIcon }],
						}),
					"dsh-workbench-kit: 右栏 tab 类型",
				);

				// 2) 该类型的正文：key 必须等于上面注册的 id。
				const register = right.slots.register.bind(right.slots);
				right.slots.inject("sidebar.right.pane.tab", () =>
					register(
						{
							name: "sidebar.right.pane.tab",
							key: TAB_ID,
						},
						WorkbenchPlain,
					),
				);
			});
		}

		exports.TITLE = TITLE;
		exports.PANEL_ID = PANEL_ID;
		exports.TAB_ID = TAB_ID;
		exports.TAB_KIND = TAB_KIND;
		exports.BODY_SLOT = BODY_SLOT;
		exports.ASIDE_SLOT = ASIDE_SLOT;
		exports.ACTIONS_SLOT = ACTIONS_SLOT;
		exports.BlankWorkbench = BlankWorkbench;
		exports.AsidePlaceholder = AsidePlaceholder;
		exports.ChatCenter = ChatCenter;
		exports.WorkbenchFrame = WorkbenchFrame;
		exports.WorkbenchPlain = WorkbenchPlain;
		exports.WorkbenchIcon = WorkbenchIcon;
		exports.findWorkspace = findWorkspace;
		exports.baseName = baseName;
		exports.joinPath = joinPath;
		exports.ASIDE_STATE_KEY = ASIDE_STATE_KEY;
		exports.readAsideOpen = readAsideOpen;
		exports.writeAsideOpen = writeAsideOpen;
		exports.homeFromWorkspaces = homeFromWorkspaces;
		exports.plannedWorkspacePath = plannedWorkspacePath;
		exports.createChatBridge = createChatBridge;
		exports.ensureWorkbenchWorkspace = ensureWorkbenchWorkspace;
		exports.apply = apply;
		exports.inject = inject;

		return module.exports;
	},
});
