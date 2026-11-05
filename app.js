/* 表情包工坊 —— 对接 meme-generator 接口渲染表情包 */
(() => {
  'use strict';

  const CACHE_KEY = 'meme-studio:info:v1';
  const API_BASE = '/api';
  const MAX_IMAGE_SLOTS = 4;
  const MAX_TEXT_SLOTS = 6;
  const INFO_CONCURRENCY = 4;

  /* ---------------- DOM ---------------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    status: $('status'),
    search: $('search'),
    tplMeta: $('tplMeta'),
    tplList: $('tplList'),
    imageField: $('imageField'),
    imageHint: $('imageHint'),
    drop: $('drop'),
    file: $('file'),
    dropTitle: $('dropTitle'),
    dropSub: $('dropSub'),
    qq: $('qq'),
    qqBtn: $('qqBtn'),
    qqTip: $('qqTip'),
    thumbs: $('thumbs'),
    textField: $('textField'),
    textRows: $('textRows'),
    argsField: $('argsField'),
    args: $('args'),
    argsHint: $('argsHint'),
    render: $('render'),
    download: $('download'),
    sheet: $('sheet'),
    reset: $('reset'),
    ph: $('ph'),
    tplPreview: $('tplPreview'),
    preview: $('preview'),
    previewVideo: $('previewVideo'),
    stageTag: $('stageTag'),
    hint: $('hint'),
    stats: $('stats'),
  };

  const state = {
    base: API_BASE,
    keys: [],
    info: new Map(),
    previews: new Map(),
    selected: null,
    params: null,
    images: [],
    texts: [],
    result: null,
    busy: false,
  };

  /* ---------------- 接口层 ---------------- */
  function apiUrl(path) {
    return `${state.base}${path}`;
  }

  function readJson(text) {
    return JSON.parse(String(text).replace(/^\uFEFF+/, ''));
  }

  async function probe(base) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`${base}/meme/version`, { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) return null;
      const version = (await res.text()).trim();
      return { base, version };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /* 只走同源 /api：由服务器上的 Nginx 或 server.js 转发到真实接口 */
  async function resolveBase() {
    return probe(API_BASE);
  }

  const infoQueue = [];
  let infoActive = 0;

  function queueInfo(key) {
    if (state.info.has(key) || infoQueue.includes(key)) return;
    infoQueue.push(key);
    pumpInfo();
  }

  function pumpInfo() {
    while (infoActive < INFO_CONCURRENCY && infoQueue.length) {
      const key = infoQueue.shift();
      infoActive++;
      loadInfo(key)
        .then((info) => onInfoLoaded(key, info))
        .catch(() => {})
        .finally(() => {
          infoActive--;
          pumpInfo();
        });
    }
  }

  const inflight = new Map();

  function loadInfo(key) {
    const cached = state.info.get(key);
    if (cached) return Promise.resolve(cached);
    if (inflight.has(key)) return inflight.get(key);
    const task = fetch(apiUrl(`/memes/${encodeURIComponent(key)}/info`), { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`info ${res.status}`);
        return res.json();
      })
      .then((info) => {
        state.info.set(key, info);
        persistSoon();
        return info;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, task);
    return task;
  }

  let persistTimer = 0;
  function persistSoon() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      const out = {};
      state.info.forEach((info, key) => {
        if (info && info.params_type) out[key] = { keywords: info.keywords || [], p: info.params_type };
      });
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(out));
      } catch {
        /* 容量不足时忽略 */
      }
    }, 3000);
  }

  function restoreCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      Object.entries(JSON.parse(raw)).forEach(([key, v]) => {
        state.info.set(key, { key, keywords: v.keywords || [], params_type: v.p, cached: true });
      });
    } catch {
      /* 忽略损坏的缓存 */
    }
  }

  /* ---------------- 模板列表 ---------------- */
  let filterTimer = 0;

  function labelOf(key) {
    const info = state.info.get(key);
    const kw = info && info.keywords && info.keywords[0];
    return kw ? `${kw} · ${key}` : key;
  }

  function matches(key) {
    const q = el.search.value.trim().toLowerCase();
    if (!q) return true;
    if (key.toLowerCase().includes(q)) return true;
    const info = state.info.get(key);
    return !!info && (info.keywords || []).some((kw) => String(kw).toLowerCase().includes(q));
  }

  function renderList() {
    const frag = document.createDocumentFragment();
    let count = 0;
    for (const key of state.keys) {
      if (!matches(key)) continue;
      count++;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tpl-item' + (key === state.selected ? ' active' : '');
      btn.dataset.key = key;
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', key === state.selected ? 'true' : 'false');
      btn.textContent = labelOf(key);
      frag.appendChild(btn);
    }
    el.tplList.replaceChildren(frag);
    el.tplMeta.textContent = count === state.keys.length ? `${count} 个模板` : `${count} / ${state.keys.length}`;
    if (!state.busy) el.sheet.textContent = `模板总览图（${count}）`;
    el.tplList.scrollTop = 0;
  }

  function onInfoLoaded(key, info) {
    const node = el.tplList.querySelector(`.tpl-item[data-key="${CSS.escape(key)}"]`);
    if (node) node.textContent = labelOf(key);
    if (key === state.selected) {
      state.params = info.params_type;
      buildForm(info);
    }
    if (el.search.value.trim()) {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(renderList, 400);
    }
  }

  /* ---------------- 表单 ---------------- */
  function maxImagesOf(p) {
    if (!p || !p.max_images) return 0;
    return p.max_images < 0 ? MAX_IMAGE_SLOTS : Math.min(p.max_images, MAX_IMAGE_SLOTS);
  }

  function maxTextsOf(p) {
    if (!p || !p.max_texts) return 0;
    return p.max_texts < 0 ? MAX_TEXT_SLOTS : Math.min(p.max_texts, MAX_TEXT_SLOTS);
  }

  function buildForm(info) {
    const p = info.params_type || {};
    const slots = maxImagesOf(p);
    const texts = maxTextsOf(p);
    const minImages = Math.max(0, Math.min(p.min_images || 0, slots));
    const minTexts = Math.max(0, Math.min(p.min_texts || 0, texts));

    state.images = state.images.slice(0, Math.max(slots, 1));
    state.texts = Array.from({ length: texts }, (_, i) => state.texts[i] || '');

    /* 图片区 */
    el.imageField.hidden = slots === 0;
    if (slots) {
      el.imageHint.textContent =
        (minImages ? `必填 ${minImages} 张` : '可选') + (p.max_images < 0 ? '，可多张' : slots > 1 ? `，最多 ${slots} 张` : '');
      el.dropTitle.textContent = state.images.length ? `已选 ${state.images.length} 张，点击更换` : '点击或拖入图片';
      el.dropSub.textContent = slots > 1 ? `需要 ${minImages}~${slots} 张图片` : p.max_images < 0 ? '可上传多张' : '需要 1 张图片';
    }

    /* 文字区 */
    el.textField.hidden = texts === 0;
    const rows = document.createDocumentFragment();
    for (let i = 0; i < texts; i++) {
      const wrap = document.createElement('div');
      wrap.className = 'text-row';
      const label = document.createElement('label');
      label.className = 'text-label';
      label.htmlFor = `text-${i}`;
      label.innerHTML = `<span>文字 ${i + 1}</span>${i < minTexts ? '<em>必填</em>' : '<em class="opt">可选</em>'}`;
      const input = document.createElement('input');
      input.type = 'text';
      input.id = `text-${i}`;
      input.maxLength = 200;
      input.dataset.index = String(i);
      input.value = state.texts[i] || '';
      const preset = (p.default_texts || [])[i];
      input.placeholder = preset ? String(preset).slice(0, 24) : i < minTexts ? '必填内容' : '留空则不填';
      input.addEventListener('input', () => {
        state.texts[i] = input.value;
        syncReady();
      });
      wrap.append(label, input);
      rows.appendChild(wrap);
    }
    el.textRows.replaceChildren(rows);

    /* 高级参数 */
    const argsType = p.args_type;
    el.argsField.hidden = !argsType;
    if (argsType) {
      const props = (argsType.args_model && argsType.args_model.properties) || {};
      el.argsHint.textContent = Object.keys(props).join(' / ') || 'JSON';
      el.args.placeholder = JSON.stringify(defaultArgs(props), null, 2);
    }

    renderThumbs();
    syncReady();
  }

  function defaultArgs(props) {
    const out = {};
    Object.entries(props).forEach(([name, schema]) => {
      if (schema && schema.default !== undefined) out[name] = schema.default;
      else if (schema && schema.type === 'array') out[name] = [];
      else if (schema && schema.type === 'string') out[name] = '';
      else if (schema && schema.type === 'integer') out[name] = 0;
    });
    return out;
  }

  function renderThumbs() {
    if (!state.images.length) {
      el.thumbs.replaceChildren();
      return;
    }
    const frag = document.createDocumentFragment();
    state.images.forEach((file, i) => {
      const box = document.createElement('div');
      box.className = 'thumb';
      const img = document.createElement('img');
      img.alt = file.name;
      img.src = URL.createObjectURL(file);
      img.onload = () => URL.revokeObjectURL(img.src);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'thumb-del';
      del.textContent = '×';
      del.title = '移除';
      del.addEventListener('click', () => {
        state.images.splice(i, 1);
        el.dropTitle.textContent = state.images.length ? `已选 ${state.images.length} 张，点击更换` : '点击或拖入图片';
        renderThumbs();
        syncReady();
      });
      box.append(img, del);
      frag.appendChild(box);
    });
    el.thumbs.replaceChildren(frag);
  }

  function syncReady(quiet) {
    const p = state.params;
    if (!state.selected || !p || state.busy) {
      el.render.disabled = true;
      return;
    }
    const minImages = Math.min(p.min_images || 0, maxImagesOf(p));
    const minTexts = Math.min(p.min_texts || 0, maxTextsOf(p));
    const imagesOk = state.images.length >= minImages && state.images.length <= Math.max(maxImagesOf(p), minImages);
    const textsOk = Array.from({ length: minTexts }).every((_, i) => (state.texts[i] || '').trim());
    el.render.disabled = !(imagesOk && textsOk);
    if (!imagesOk) el.hint.textContent = `这个模板需要至少 ${minImages} 张图片`;
    else if (!textsOk) el.hint.textContent = `这个模板需要填写前 ${minTexts} 个文字`;
    else if (!quiet) el.hint.textContent = '准备就绪，点击「生成表情包」';
  }

  /* ---------------- 生成 ---------------- */
  function setStatus(text, kind) {
    el.status.textContent = text;
    el.status.className = 'status' + (kind ? ` ${kind}` : '');
  }

  function showResult(blob, key) {
    if (state.result) URL.revokeObjectURL(state.result.url);
    const url = URL.createObjectURL(blob);
    const type = blob.type || 'image/png';
    const ext = type.includes('gif')
      ? 'gif'
      : type.includes('webp')
        ? 'webp'
        : type.includes('mp4')
          ? 'mp4'
          : type.includes('jpeg')
            ? 'jpg'
            : 'png';
    state.result = { url, type, ext, size: blob.size, key };

    const isVideo = type.startsWith('video');
    el.tplPreview.hidden = true;
    el.stageTag.hidden = true;
    el.preview.hidden = isVideo;
    el.previewVideo.hidden = !isVideo;
    el.ph.hidden = true;
    if (isVideo) {
      el.previewVideo.src = url;
      el.previewVideo.play().catch(() => {});
    } else {
      el.preview.src = url;
    }
    el.download.disabled = false;
    el.stats.textContent = `输出 ${type.split('/')[1]} · ${(blob.size / 1024).toFixed(0)} KB`;
  }

  function showTemplatePreview(url) {
    if (state.result) return;
    el.tplPreview.src = url;
    el.tplPreview.hidden = false;
    el.stageTag.hidden = false;
    el.ph.hidden = true;
  }

  function clearResult() {
    if (state.result) URL.revokeObjectURL(state.result.url);
    state.result = null;
    el.preview.hidden = true;
    el.preview.removeAttribute('src');
    el.previewVideo.hidden = true;
    el.previewVideo.removeAttribute('src');
    el.download.disabled = true;
    el.stats.textContent = '';

    const cached = state.selected ? state.previews.get(state.selected) : null;
    if (cached) {
      showTemplatePreview(cached);
      return;
    }
    el.tplPreview.hidden = true;
    el.tplPreview.removeAttribute('src');
    el.stageTag.hidden = true;
    el.ph.hidden = false;
  }

  /* 文档 GET /memes/{key}/preview：模板示例图 */
  function loadTemplatePreview(key) {
    if (state.previews.has(key)) {
      showTemplatePreview(state.previews.get(key));
      return;
    }
    fetch(apiUrl(`/memes/${encodeURIComponent(key)}/preview`), { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`preview ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (key !== state.selected) return;
        const url = URL.createObjectURL(blob);
        state.previews.set(key, url);
        if (state.previews.size > 8) {
          const oldest = state.previews.keys().next().value;
          URL.revokeObjectURL(state.previews.get(oldest));
          state.previews.delete(oldest);
        }
        showTemplatePreview(url);
      })
      .catch(() => {});
  }

  /* 文档 POST /memes/render_list：把当前筛选的模板（默认全部）渲染成一张总览图 */
  const SHEET_TIMEOUT = 180000;

  function sheetLabel() {
    if (!state.keys.length) return '模板总览图';
    return `模板总览图（${state.keys.filter(matches).length}）`;
  }

  async function renderSheet() {
    if (state.busy || !state.base || !state.keys.length) return;
    const list = state.keys.filter(matches);
    if (!list.length) {
      el.hint.textContent = '当前筛选没有匹配的模板';
      return;
    }
    state.busy = true;
    el.sheet.disabled = true;
    el.render.disabled = true;
    el.sheet.textContent = '渲染中…';

    const started = Date.now();
    const ticker = setInterval(() => {
      const sec = Math.round((Date.now() - started) / 1000);
      el.hint.textContent = `正在渲染 ${list.length} 个模板的总览图…已用 ${sec} 秒（模板越多越慢，请稍候）`;
    }, 1000);
    el.hint.textContent = `正在渲染 ${list.length} 个模板的总览图…`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), SHEET_TIMEOUT);
    let finalHint = '';
    try {
      const res = await fetch(apiUrl('/memes/render_list'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          meme_list: list.map((key) => ({ meme_key: key, disabled: false, labels: [] })),
          text_template: '{index}.{keywords}',
          add_category_icon: true,
        }),
      });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || type.includes('json')) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      showResult(blob, `list-${list.length}`);
      el.preview.title = '点击查看原图';
      finalHint = `总览图已生成，共 ${list.length} 个模板 · ${(blob.size / 1024 / 1024).toFixed(1)} MB，点击预览可看原图`;
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      finalHint = /abort/i.test(msg)
        ? `总览图渲染超时（${SHEET_TIMEOUT / 1000} 秒），可先筛选再生成`
        : `总览图生成失败：${msg.slice(0, 120)}`;
    } finally {
      clearInterval(ticker);
      clearTimeout(timer);
      state.busy = false;
      el.sheet.disabled = false;
      el.sheet.textContent = sheetLabel();
      syncReady(true);
      if (finalHint) el.hint.textContent = finalHint;
    }
  }

  async function generate() {
    if (!state.selected || state.busy) return;
    const key = state.selected;
    const p = state.params || {};
    const fd = new FormData();
    state.images.slice(0, maxImagesOf(p)).forEach((file) => fd.append('images', file, file.name));
    const textCount = maxTextsOf(p);
    const minTexts = Math.min(p.min_texts || 0, textCount);
    const vals = Array.from({ length: textCount }, (_, i) => (state.texts[i] || '').trim());
    let sendCount = textCount;
    while (sendCount > minTexts && !vals[sendCount - 1]) sendCount--;
    for (let i = 0; i < sendCount; i++) fd.append('texts', vals[i]);
    const argsRaw = el.argsField.hidden ? '' : el.args.value.trim();
    if (argsRaw) {
      try {
        JSON.parse(argsRaw);
      } catch {
        el.hint.textContent = '高级参数不是合法 JSON';
        return;
      }
      fd.append('args', argsRaw);
    }

    state.busy = true;
    el.render.disabled = true;
    el.render.textContent = '生成中…';
    el.hint.textContent = '正在请求服务端渲染…';
    let doneMsg = '';
    try {
      const res = await fetch(apiUrl(`/memes/${encodeURIComponent(key)}/`), { method: 'POST', body: fd });
      const type = res.headers.get('content-type') || '';
      if (!res.ok || type.includes('json') || type.includes('text/plain')) {
        let detail = `HTTP ${res.status}`;
        try {
          const txt = await res.text();
          try {
            const data = JSON.parse(txt);
            detail = data.detail || data.message || detail;
            if (typeof detail !== 'string') detail = JSON.stringify(detail);
          } catch {
            detail = txt || detail;
          }
        } catch {
          /* 忽略 */
        }
        throw new Error(detail);
      }
      showResult(await res.blob(), key);
      doneMsg = '生成成功，可下载或继续调整参数';
    } catch (err) {
      clearResult();
      const msg = String(err && err.message ? err.message : err);
      el.hint.textContent = /Failed to fetch|NetworkError|abort/i.test(msg)
        ? '请求失败：接口不可达，或浏览器跨域被拦截（请用 node server.js 启动本地代理）'
        : `生成失败：${msg.slice(0, 160)}`;
    } finally {
      state.busy = false;
      el.render.textContent = '生成表情包';
      syncReady(true);
      if (doneMsg) el.hint.textContent = doneMsg;
    }
  }

  /* ---------------- 选择模板 ---------------- */
  function selectTemplate(key) {
    if (state.selected === key) return;
    state.selected = key;
    state.params = null;
    state.texts = [];
    el.args.value = '';
    el.tplList.querySelectorAll('.tpl-item').forEach((node) => {
      const on = node.dataset.key === key;
      node.classList.toggle('active', on);
      node.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const node = el.tplList.querySelector(`.tpl-item[data-key="${CSS.escape(key)}"]`);
    if (node) node.scrollIntoView({ block: 'nearest' });
    clearResult();
    loadTemplatePreview(key);
    el.hint.textContent = '正在读取模板参数…';
    el.render.disabled = true;
    loadInfo(key)
      .then((info) => onInfoLoaded(key, info))
      .catch(() => {
        el.hint.textContent = '模板参数读取失败，稍后再试';
      });
  }

  /* ---------------- 事件 ---------------- */
  el.search.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(renderList, 120);
  });

  el.tplList.addEventListener('click', (e) => {
    const btn = e.target.closest('.tpl-item');
    if (btn) selectTemplate(btn.dataset.key);
  });

  /* 可见项懒加载模板信息（关键词） */
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) queueInfo(entry.target.dataset.key);
      });
    },
    { root: el.tplList, rootMargin: '120px' }
  );
  const observeList = new MutationObserver(() => {
    el.tplList.querySelectorAll('.tpl-item').forEach((node) => observer.observe(node));
  });
  observeList.observe(el.tplList, { childList: true });

  el.drop.addEventListener('click', (e) => {
    if (e.target === el.file) return;
    el.file.click();
  });
  el.drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.file.click();
    }
  });
  el.file.addEventListener('change', () => {
    addFiles(el.file.files);
    el.file.value = '';
  });
  ['dragenter', 'dragover'].forEach((evt) =>
    el.drop.addEventListener(evt, (e) => {
      e.preventDefault();
      el.drop.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    el.drop.addEventListener(evt, (e) => {
      e.preventDefault();
      el.drop.classList.remove('dragover');
    })
  );
  el.drop.addEventListener('drop', (e) => addFiles(e.dataTransfer && e.dataTransfer.files));

  function addFiles(fileList) {
    const slots = maxImagesOf(state.params);
    if (!slots) return;
    const next = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!next.length) return;
    const room = slots - state.images.length;
    state.images = state.images.concat(next.slice(0, Math.max(room, 0)));
    el.drop.classList.toggle('loaded', state.images.length > 0);
    el.dropTitle.textContent = state.images.length ? `已选 ${state.images.length} 张，点击更换` : '点击或拖入图片';
    renderThumbs();
    syncReady();
  }

  /* ---------------- QQ 头像 ---------------- */
  const QQ_RE = /^[1-9]\d{4,11}$/;
  /* 优先走同源代理（server.js 已实现 /api/qq-avatar），失败再直连头像源 */
  const QQ_SOURCES = [
    (qq) => apiUrl(`/qq-avatar?qq=${qq}`),
    (qq) => `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=640`,
    (qq) => `https://qlogo2.store.qq.com/qzone/${qq}/${qq}/640`,
  ];

  function setQQTip(text, bad) {
    el.qqTip.textContent = text || '';
    el.qqTip.hidden = !text;
    el.qqTip.classList.toggle('bad', !!bad);
  }

  async function fetchQQAvatar(qq) {
    for (const build of QQ_SOURCES) {
      try {
        const res = await fetch(build(qq), { cache: 'no-store' });
        if (!res.ok) continue;
        const type = res.headers.get('content-type') || '';
        if (!type.startsWith('image/')) continue;
        const blob = await res.blob();
        if (blob.size < 256) continue;
        return blob;
      } catch {
        /* 换下一个头像源 */
      }
    }
    return null;
  }

  async function useQQAvatar() {
    const raw = el.qq.value.trim();
    if (!raw) {
      setQQTip('先输入 QQ 号，多个号用逗号 / 空格分隔', true);
      el.qq.focus();
      return;
    }
    const list = raw.split(/[\s,，、]+/).filter(Boolean);
    const bad = list.find((qq) => !QQ_RE.test(qq));
    if (bad) {
      setQQTip(`「${bad}」不是有效 QQ 号（5~12 位数字）`, true);
      el.qq.focus();
      return;
    }
    const slots = maxImagesOf(state.params);
    if (!slots) {
      setQQTip('当前模板不需要图片，换个模板再用头像', true);
      return;
    }

    el.qqBtn.disabled = true;
    el.qqBtn.textContent = '获取中…';
    const ok = [];
    const failed = [];
    for (let i = 0; i < list.length; i++) {
      const qq = list[i];
      setQQTip(
        list.length > 1
          ? `正在获取第 ${i + 1}/${list.length} 个头像（QQ ${qq}）…`
          : `正在获取 QQ ${qq} 的头像…`
      );
      try {
        const blob = await fetchQQAvatar(qq);
        if (!blob) throw new Error('empty');
        const type = blob.type || 'image/jpeg';
        const ext = type.includes('png')
          ? 'png'
          : type.includes('webp')
            ? 'webp'
            : type.includes('gif')
              ? 'gif'
              : 'jpg';
        /* 槽位满了就顶掉最早的一张，保证新头像一定进得去 */
        if (state.images.length >= slots) {
          state.images = state.images.slice(state.images.length - slots + 1);
        }
        addFiles([new File([blob], `qq-${qq}.${ext}`, { type })]);
        ok.push(qq);
      } catch {
        failed.push(qq);
      }
    }
    el.qqBtn.disabled = false;
    el.qqBtn.textContent = '取头像';

    if (ok.length && !failed.length) setQQTip(`已填入 ${ok.join('、')} 的头像`);
    else if (ok.length) setQQTip(`已填入 ${ok.join('、')} 的头像；${failed.join('、')} 获取失败`, true);
    else setQQTip(`头像获取失败：${failed.join('、')}`, true);
  }

  el.qqBtn.addEventListener('click', useQQAvatar);
  el.qq.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      useQQAvatar();
    }
  });
  el.qq.addEventListener('input', () => {
    if (!el.qqTip.classList.contains('bad')) setQQTip('');
  });

  el.render.addEventListener('click', generate);
  el.sheet.addEventListener('click', renderSheet);
  el.preview.addEventListener('click', () => {
    if (state.result) window.open(state.result.url, '_blank', 'noopener');
  });
  el.download.addEventListener('click', () => {
    if (!state.result) return;
    const a = document.createElement('a');
    a.href = state.result.url;
    a.download = `meme-${state.result.key}-${Date.now()}.${state.result.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  el.reset.addEventListener('click', () => {
    state.images = [];
    state.texts = [];
    el.args.value = '';
    el.file.value = '';
    el.drop.classList.remove('loaded');
    el.dropTitle.textContent = '点击或拖入图片';
    el.thumbs.replaceChildren();
    clearResult();
    const cached = state.selected ? state.info.get(state.selected) : null;
    if (cached && cached.params_type) {
      state.params = cached.params_type;
      buildForm(cached);
      el.hint.textContent = '已重置，重新填写内容后再生成';
    }
  });

  /* ---------------- 连接与启动 ---------------- */
  function resetUi() {
    state.keys = [];
    state.selected = null;
    state.params = null;
    state.texts = [];
    state.images = [];
    el.thumbs.replaceChildren();
    el.textRows.replaceChildren();
    el.textField.hidden = true;
    el.imageField.hidden = true;
    el.argsField.hidden = true;
    el.dropTitle.textContent = '点击或拖入图片';
    el.drop.classList.remove('loaded');
    el.render.disabled = true;
    el.sheet.disabled = true;
    el.tplList.replaceChildren();
    state.previews.forEach((url) => URL.revokeObjectURL(url));
    state.previews.clear();
    clearResult();
  }

  async function connect(hit) {
    resetUi();
    setStatus(`已连接 · ${hit.version.replace(/"/g, '')}`, 'ok');

    try {
      const res = await fetch(apiUrl('/memes/keys'), { cache: 'no-store' });
      const keys = readJson(await res.text());
      if (!Array.isArray(keys) || !keys.length) throw new Error('模板列表为空');
      state.keys = keys.sort((a, b) => a.localeCompare(b));
      renderList();
      el.sheet.disabled = false;
      el.hint.textContent = `共 ${keys.length} 个模板，先选一个开始`;
      const preferred = ['5000choyen', 'ayachi_holdsign', 'always_like', 'mihoyo_funina_holdsign'];
      const first = preferred.find((k) => state.keys.includes(k)) || state.keys[0];
      selectTemplate(first);
      state.keys.forEach(queueInfo);
    } catch (err) {
      setStatus('模板加载失败', 'bad');
      el.tplMeta.textContent = '加载失败';
      el.hint.textContent = `读取模板列表失败：${String(err.message || err).slice(0, 120)}`;
    }
  }

  async function boot() {
    restoreCache();
    setStatus('连接中…', 'wait');
    const hit = await resolveBase();
    if (!hit) {
      setStatus('接口不可达', 'bad');
      el.tplMeta.textContent = '加载失败';
      el.hint.textContent =
        '无法连接同源 /api：请确认服务器上的 Nginx 已转发 /api/，或直接用 node server.js 启动服务';
      return;
    }
    connect(hit);
  }

  boot();
})();
