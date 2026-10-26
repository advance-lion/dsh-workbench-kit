/**
 * dsh-workbench-kit · 宿主半边（Node 侧）
 *
 * 本插件目前只贡献浏览器 UI（见 `lib/client.js`，由 `dsh.client` 声明发布为
 * `/plugins/dsh-workbench-kit/client.js`），宿主侧不注册任何服务、不启动后台任务。
 *
 * 之所以仍然需要一个可加载的宿主入口：profile 的 Loader 行
 * `- insert: [{ id: workbench-kit, name: dsh-workbench-kit }]`
 * 会把包名当模块解析，包必须能 import 成功。后续要加宿主能力（数据抓取、
 * HTTP 路由、工具）时，把服务注册写在下面的 `apply` 里。
 */

/** 插件行名；与 cordis.patch.yml 的 id 无关，仅用于诊断输出。 */
export const name = 'workbench-kit'

/** 宿主侧依赖：空数组表示不等待任何服务即可启动。 */
export const inject = []

/**
 * 宿主侧入口。
 * @param {import('@deepseek-ai/cordis').Context} _ctx 宿主上下文（当前未使用）。
 */
export function apply(_ctx) {}
