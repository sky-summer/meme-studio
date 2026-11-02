/**
 * 部署配置：填写表情包接口（或其 HTTPS 反向代理）的地址。
 *
 * - 本地 `node server.js` 运行时留空即可，页面会自动走同源 /api 代理。
 * - 部署到 GitHub Pages 等 HTTPS 站点时必须填 HTTPS 地址，
 *   例如 Cloudflare Worker / cloudflared 隧道给出的 https://... 地址。
 * - 也可以在页面的「接口地址」输入框里填，改完会存到浏览器 localStorage。
 * - 仓库里不保存任何真实服务地址，按需自行填写。
 */
window.MEME_API_BASE = '';
