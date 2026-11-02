/**
 * 部署配置：线上环境使用的接口地址。
 *
 * - 本地 `node server.js` 运行时留空即可，页面会自动走同源 /api 代理。
 * - 线上默认直接使用原始 HTTP 接口地址（不在界面任何位置展示）。
 *   注意：HTTPS 页面（GitHub Pages）请求 http:// 接口会被浏览器以混合内容拦截，
 *   需要 HTTPS 代理时把这里换成代理域名即可（见 worker/ 目录）。
 * - 也可以在页面的「接口地址」输入框里填，改完会存到浏览器 localStorage。
 */
window.MEME_API_BASE = 'http://120.48.4.118:2233';
