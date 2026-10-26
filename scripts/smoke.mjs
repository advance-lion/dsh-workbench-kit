/**
 * dsh-workbench-kit · 本地冒烟自检（不需要跑起 GUI，不联网）
 *
 * 用桩件模拟浏览器侧的三件事，离线验证 lib/client.js 的注册契约与渲染输出：
 *   1. window.__ModuleLoader__.load 捕获工厂，再用桩 require 执行工厂体；
 *      （真实运行时 require("react") 由宿主的 PLATFORM_MODULES 基线提供。）
 *   2. 桩 slots / ctx 记录 slots.inject、slots.register、ctx.inject 的调用；
 *   3. 桩渲染器把 createElement 树打成 HTML，检查占位文案与属性透传。
 *   node scripts/smoke.mjs
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(here, '..')

const checks = []
const check = (label, ok, detail = '') => {
	checks.push({ label, ok })
	if (ok) console.log(`✓ ${label}`)
	else console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
}

/* ---------- 1. 载入 bundle，捕获工厂 ---------- */

let loaded
const windowStub = { __ModuleLoader__: { load: (entry) => { loaded = entry } } }
const source = readFileSync(join(packageRoot, 'lib', 'client.js'), 'utf8')
new Function('window', source)(windowStub)

check('bundle 调用 __ModuleLoader__.load', loaded !== undefined)
check('模块 id = 包名', loaded?.id === 'dsh-workbench-kit', `实际 ${loaded?.id}`)

/* ---------- 2. React 桩：createElement + 最小 hook 运行时 + 静态渲染 ---------- */

const flatten = (children) => children.flat(Number.POSITIVE_INFINITY).filter((c) => c !== null && c !== undefined && c !== false && c !== true)

/** 只够一次顶层渲染用的 hook 槽（框体只用一个 useState 表示对话栏开合）。 */
const hookState = []
let hookCursor = 0
let renderDepth = 0

const ReactStub = {
	createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: flatten(children) } }),
	useState: (initial) => {
		const index = hookCursor++
		if (!(index in hookState)) hookState[index] = typeof initial === 'function' ? initial() : initial
		return [hookState[index], (next) => { hookState[index] = typeof next === 'function' ? next(hookState[index]) : next }]
	},
	useCallback: (fn) => fn,
	useEffect: () => undefined,
	useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
}

const voidTags = new Set(['rect', 'path', 'circle', 'line'])
const render = (node) => {
	if (node === null || node === undefined || node === false) return ''
	if (typeof node === 'string' || typeof node === 'number') return String(node)
	if (Array.isArray(node)) return node.map(render).join('')
	if (typeof node.type === 'function') {
		if (renderDepth === 0) {
			hookState.length = 0
			hookCursor = 0
		}
		renderDepth += 1
		try {
			return render(node.type(node.props))
		} finally {
			renderDepth -= 1
		}
	}
	const attrs = Object.entries(node.props ?? {})
		.filter(([key, value]) => key !== 'children' && key !== 'style' && value !== undefined && value !== false)
		.map(([key, value]) => ` ${key === 'className' ? 'class' : key}="${String(value)}"`)
		.join('')
	const inner = flatten([node.props?.children ?? []]).map(render).join('')
	return voidTags.has(node.type) ? `<${node.type}${attrs}/>` : `<${node.type}${attrs}>${inner}</${node.type}>`
}

const factoryRequire = (spec) => {
	if (spec === 'react') return ReactStub
	throw new Error(`未声明的模块请求：${spec}`)
}
const mod = loaded.factory(factoryRequire)

check('导出 apply', typeof mod.apply === 'function')
check('导出 inject 且只依赖 slots', Array.isArray(mod.inject) && mod.inject.length === 1 && mod.inject[0] === 'slots', JSON.stringify(mod.inject))

/* ---------- 3. 桩 ctx：记录注册 ---------- */

const registrations = []
const injectedSlots = []
const slots = {
	inject: (name, callback) => {
		injectedSlots.push(name)
		callback()
	},
	register: (options, component) => {
		registrations.push({ slot: options?.name, options, component })
		return () => {}
	},
}
const optionalInjects = []
const tabTypes = []
const tabRegistry = { register: (definition) => (tabTypes.push(definition), () => {}) }
const ctx = {
	slots,
	inject: (deps, callback) => {
		optionalInjects.push(deps)
		callback({ slots, effect: (fn) => (fn(), () => {}), get: (name) => (name === 'sidebarRightTabs' ? tabRegistry : undefined) })
	},
}

mod.apply(ctx)

/* ---------- 4. 断言四处注册 ---------- */

const panellist = registrations.find((r) => r.slot === 'sidebar.panellist')
const main = registrations.find((r) => r.slot === 'main')
const view = registrations.find((r) => r.slot === 'conversation.view')
const pane = registrations.find((r) => r.slot === 'sidebar.right.pane.tab')
const label = panellist?.options.label
const viewLabel = view?.options.label
const guide = tabTypes[0]?.guide?.[0]

check('左栏注册到 sidebar.panellist', panellist !== undefined)
check('左栏条目有 id', panellist?.options.id === mod.PANEL_ID, `id=${panellist?.options.id}`)
check('左栏条目有 order', typeof panellist?.options.order === 'number')
check('左栏 label 解析出占位文案', (typeof label === 'function' ? label() : label) === 'xx工作台')
check('中栏注册到 main 且 key = 左栏 id', main?.options.key === panellist?.options.id, `key=${main?.options.key}`)
check('中栏与左栏是两个不同组件', main?.component !== panellist?.component)
check('视图条注册到 conversation.view', view !== undefined)
check('视图条 id = 面板 id', view?.options.id === mod.PANEL_ID, `id=${view?.options.id}`)
check('视图条排在画廊之后（order > 20）', typeof view?.options.order === 'number' && view.options.order > 20, `order=${view?.options.order}`)
check('视图条 label 解析出占位文案', (typeof viewLabel === 'function' ? viewLabel() : viewLabel) === 'xx工作台')
check('右栏可选等待 sidebarRightTabs', optionalInjects.some((deps) => deps.includes('sidebarRightTabs')))
check('右栏注册了 tab 类型', tabTypes.length === 1, `数量 ${tabTypes.length}`)
check('tab 类型 id = 面板正文的 key', tabTypes[0]?.id === pane?.options.key, `type=${tabTypes[0]?.id} key=${pane?.options.key}`)
check('tab 类型有 kind', typeof tabTypes[0]?.kind === 'string' && tabTypes[0].kind.length > 0, `kind=${tabTypes[0]?.kind}`)
check('tab 类型有 priority 与 title()', tabTypes[0]?.priority !== undefined && tabTypes[0]?.title() === 'xx工作台')
check('guide 入口框唯一且有 id / order / title()', guide !== undefined && (tabTypes[0].guide ?? []).length === 1
	&& typeof guide.id === 'string' && guide.id.length > 0 && typeof guide.order === 'number' && guide.title() === 'xx工作台')
check('slots.inject 声明了 sidebar.panellist / main / conversation.view', ['sidebar.panellist', 'main', 'conversation.view'].every((slot) => injectedSlots.includes(slot)), injectedSlots.join(','))

/* ---------- 4b. 通用框体的席位声明 ---------- */

const children = main?.options.children ?? {}
const seatNames = [mod.BODY_SLOT, mod.ASIDE_SLOT, mod.ACTIONS_SLOT]
check('main 座用 children 表声明了工作台自己的席位', seatNames.every((name) => children[name] !== undefined), Object.keys(children).join(','))
check('正文 / 对话栏席位是 single', children[mod.BODY_SLOT]?.kind === 'single' && children[mod.ASIDE_SLOT]?.kind === 'single')
check('动作位是 list（可挂多个按钮）', children[mod.ACTIONS_SLOT]?.kind === 'list')
check('席位作用域是 root', seatNames.every((name) => children[name]?.scope === 'root'))
check('席位声明只出现一次（视图条 / 右栏不带 children）', view?.options.children === undefined && pane?.options.children === undefined)
check('视图条 / 右栏用无席位变体', view?.component === mod.WorkbenchPlain && pane?.component === mod.WorkbenchPlain)
check('main 座用带席位的框体', main?.component === mod.WorkbenchFrame)

/* ---------- 5. 渲染 ---------- */

const blankHtml = render(ReactStub.createElement(mod.BlankWorkbench))
check('空白工作台渲染出占位文案', blankHtml.includes('xx工作台'), blankHtml.slice(0, 120))
const iconHtml = render(ReactStub.createElement(mod.WorkbenchIcon, { size: 16, active: true }))
check('图标渲染为 svg 且 aria-hidden', iconHtml.startsWith('<svg') && iconHtml.includes('aria-hidden="true"'), iconHtml.slice(0, 120))
check('图标使用传入的 size', iconHtml.includes('width="16"') && iconHtml.includes('height="16"'))
const guideIconHtml = render(ReactStub.createElement(guide.icon, { size: 26, className: 'x' }))
check('guide 图标接受 className（入口框传参形态）', guideIconHtml.includes('class="x"'))

/* ---------- 6. 框体：只渲染声明过的席位，且空席位有占位 ---------- */

const seatCalls = []
const renderSlotStub = (key, props, options) => {
	seatCalls.push({ key, options })
	return options?.fallback ?? null
}
const frameHtml = render(ReactStub.createElement(mod.WorkbenchFrame, { renderSlot: renderSlotStub }))
const requested = seatCalls.map((call) => call.key)
check('框体渲染时请求的席位都在 children 声明表里',
	requested.every((key) => children[key] !== undefined), requested.join(','))
check('框体渲染了正文席位与对话栏席位',
	requested.includes(mod.BODY_SLOT) && requested.includes(mod.ASIDE_SLOT), requested.join(','))
check('每个席位都传了 options（含 fallback 键）',
	seatCalls.every((call) => call.options !== undefined && 'fallback' in call.options))
const bodyCall = seatCalls.find((call) => call.key === mod.BODY_SLOT)
const asideCall = seatCalls.find((call) => call.key === mod.ASIDE_SLOT)
check('正文与对话栏席位都有非空 fallback（空席位显示占位）',
	bodyCall?.options?.fallback != null && asideCall?.options?.fallback != null)
check('框体标题栏渲染出名称与对话栏开关', frameHtml.includes('xx工作台') && frameHtml.includes('对话'))
check('空对话栏渲染出对话中心（未就绪态）', frameHtml.includes('data-dsh-workbench-kit="chat-center"'))
check('框体带上折叠状态标记（便于样式与外部定位）',
	frameHtml.includes('data-dsh-workbench-aside="open"'))
const plainHtml = render(ReactStub.createElement(mod.WorkbenchPlain))
check('无席位变体仍渲染出占位文案', plainHtml.includes('xx工作台'), plainHtml.slice(0, 120))
const noSeatHtml = render(ReactStub.createElement(mod.WorkbenchFrame, {}))
check('拿不到 renderSlot 时退化为占位（不抛错、入口不被摘掉）',
	noSeatHtml.includes('xx工作台') && noSeatHtml.includes('data-dsh-workbench-kit="chat-center"'), noSeatHtml.slice(0, 80))

/* ---------- 7. 对话中心：工作区映射 ---------- */

const workspaceItems = [
	{ workspaceId: 'w-other', title: '别的项目', path: 'C:\\Users\\demo\\Documents\\other', sessionIds: [] },
	{ workspaceId: 'w-invest', title: '投研工作台', path: 'C:\\Users\\demo\\Documents\\deepseek-harness\\投研工作台', sessionIds: [] },
]
check('按标题映射工作区', mod.findWorkspace(workspaceItems, '投研工作台')?.workspaceId === 'w-invest')
check('标题对不上时按目录名兜底', mod.findWorkspace(workspaceItems, 'deepseek-harness') === undefined
	&& mod.findWorkspace([{ workspaceId: 'w', path: 'C:/x/xx工作台' }], 'xx工作台')?.workspaceId === 'w')
check('没有同名工作区时返回 undefined', mod.findWorkspace(workspaceItems, 'xx工作台') === undefined)
check('路径拼接同时认 Windows 与 POSIX', mod.joinPath('C:\\a\\b', 'c') === 'C:\\a\\b\\c'
	&& mod.joinPath('/home/x/', 'y') === '/home/x/y')
check('目录名取最后一段（含反斜杠路径）', mod.baseName('C:\\Users\\a\\xx工作台') === 'xx工作台')

/* ---------- 8. 工作区路径推导 + 三条创建路径 ---------- */

const pickerCalls = []
const createdWorkspaces = []
const madeDirs = new Set()
/** 已有工作区：用来反推主目录（客户端拿不到 homedir）。 */
const seedItems = [
	{ workspaceId: 'w-invest', title: '投研工作台', path: 'C:\\Users\\demo\\Documents\\deepseek-harness\\投研工作台', sessionIds: [] },
]
/** canCreate 用来模拟宿主 `stat` 校验：目录不存在时 create 会抛 not a directory。 */
const makeWorkspacesStub = (items, canCreate = () => true) => ({
	list: { getSnapshot: () => ({ items, archivedSessionIds: [], pinnedSessionIds: [] }), subscribe: () => () => {} },
	create: async (input) => {
		if (!canCreate(input.path)) throw new Error(`cannot create a workspace at '${input.path}': path is not a directory`)
		createdWorkspaces.push(input)
		return { ok: true, value: { workspace: { workspaceId: 'w-new', title: mod.TITLE, path: input.path } } }
	},
})
const browsePicker = {
	createDirectory: async (parent, name) => {
		pickerCalls.push([parent, name])
		const created = parent + '\\' + name
		madeDirs.add(created)
		if (name === 'Documents') throw Object.assign(new Error('exists'), { code: 'directory-picker/exists' })
		return created
	},
}
const nativePicker = {
	// native 型：没有 createDirectory，只有系统对话框
	pickDirectory: async () => 'C:\\Users\\demo\\Documents\\xx工作台（对话框选的）',
}

check('从已有工作区路径反推主目录', mod.homeFromWorkspaces(seedItems) === 'C:\\Users\\demo')
check('反推不出主目录时为 undefined', mod.homeFromWorkspaces([{ path: '/srv/data/x' }]) === undefined)
check('计划路径 = 主目录/文档/deepseek-harness/工作台名',
	mod.plannedWorkspacePath(seedItems, mod.TITLE)?.target === 'C:\\Users\\demo\\Documents\\deepseek-harness\\xx工作台')

// 路径 1：目录已存在 → 直接注册，一个目录都不用建
pickerCalls.length = 0
createdWorkspaces.length = 0
madeDirs.clear()
const claimed = await mod.ensureWorkbenchWorkspace({ workspaces: makeWorkspacesStub(seedItems), picker: browsePicker, title: mod.TITLE })
check('目录已存在时直接注册、不建目录', claimed?.workspaceId === 'w-new' && pickerCalls.length === 0, `pickerCalls=${pickerCalls.length}`)
check('注册路径 = 文档/deepseek-harness/工作台名', createdWorkspaces[0]?.path === 'C:\\Users\\demo\\Documents\\deepseek-harness\\xx工作台')

// 路径 2：目录不存在 + browse 型能力 → 逐层建
pickerCalls.length = 0
createdWorkspaces.length = 0
madeDirs.clear()
const claimed2 = await mod.ensureWorkbenchWorkspace({
	workspaces: makeWorkspacesStub(seedItems, (path) => madeDirs.has(path)),
	picker: browsePicker,
	title: mod.TITLE,
})
check('browse 型能力下逐层建目录', pickerCalls.map((call) => call[1]).join(',') === 'Documents,deepseek-harness,xx工作台', pickerCalls.map((c) => c[1]).join(','))
check('建完目录后注册成功', claimed2?.workspaceId === 'w-new')

// 路径 3：目录不存在 + native 型能力（只有对话框）→ 按钮触发 pick
createdWorkspaces.length = 0
madeDirs.clear()
const claimed3 = await mod.ensureWorkbenchWorkspace({
	workspaces: makeWorkspacesStub(seedItems, (path) => path.includes('对话框')),
	picker: nativePicker,
	title: mod.TITLE,
	allowPick: true,
})
check('native 型能力走系统对话框', claimed3?.workspaceId === 'w-new' && String(createdWorkspaces[0]?.path).includes('对话框'), createdWorkspaces[0]?.path)

// 路径 3 的反面：自动尝试（allowPick=false）不弹对话框，只报错
madeDirs.clear()
let autoFailed = false
try {
	await mod.ensureWorkbenchWorkspace({
		workspaces: makeWorkspacesStub(seedItems, (path) => path.includes('对话框')),
		picker: nativePicker,
		title: mod.TITLE,
	})
} catch {
	autoFailed = true
}
check('自动尝试不弹对话框（allowPick=false 时直接失败）', autoFailed)

const existing = await mod.ensureWorkbenchWorkspace({ workspaces: makeWorkspacesStub([{ workspaceId: 'w-invest', title: mod.TITLE, sessionIds: [] }]), picker: browsePicker, title: mod.TITLE })
check('已有同名工作区时直接复用、不建目录', existing?.workspaceId === 'w-invest')

/* ---------- 9. 对话中心渲染：只列本工作区会话 ---------- */

const opened = []
const started = []
const chatBag = {
	ready: true,
	sessions: {
		subscribe: () => () => {},
		getSnapshot: () => ({ byId: { s1: { sessionId: 's1', displayTitle: '历史对话一' } } }),
	},
	workspaces: {
		subscribe: () => () => {},
		getSnapshot: () => ({
			items: [{ workspaceId: 'w-invest', title: mod.TITLE, path: 'C:\\Users\\demo\\Documents\\deepseek-harness\\xx工作台', sessionIds: ['s1', 's2'] }],
			archivedSessionIds: [],
		}),
	},
	ensureWorkspace: async () => {},
	startSession: (id) => started.push(id),
	openSession: (id) => opened.push(id),
}
const chatHtml = render(ReactStub.createElement(mod.ChatCenter, { chat: chatBag }))
check('对话中心列出本工作区会话标题', chatHtml.includes('历史对话一'), chatHtml.slice(0, 120))
check('对话中心显示工作区名与目录', chatHtml.includes(mod.TITLE) && chatHtml.includes('deepseek-harness'))
check('对话中心带新对话入口', chatHtml.includes('新对话'))
check('只有「+ 新对话」一个按钮（不再拆出「创建工作区」/「新会话」）',
	chatHtml.includes('+ 新对话') && !chatHtml.includes('创建工作区') && !chatHtml.includes('>新会话<'))
const noWorkspaceHtml = render(ReactStub.createElement(mod.ChatCenter, {
	chat: { ...chatBag, workspaces: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], archivedSessionIds: [] }) } },
}))
check('没有同名工作区时也有「+ 新对话」（点它会先建工作区）',
	noWorkspaceHtml.includes('+ 新对话') && !noWorkspaceHtml.includes('创建工作区'), noWorkspaceHtml.slice(0, 160))
check('没有工作区时提示会自动建目录', noWorkspaceHtml.includes('自动') && noWorkspaceHtml.includes('deepseek-harness'))

/* ---------- 汇总 ---------- */

const failed = checks.filter((c) => !c.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} 项通过`)
process.exit(failed.length === 0 ? 0 : 1)
