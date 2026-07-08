const STORAGE_KEY = "wordDungeonWebDataV1";
const FAST_MS = 3000;
const SLOW_MS = 6000;
const TIMEOUT_MS = 12000;
const MIN_REPLAY_GAP = 3;
const ROOM_COUNT = 2;
const ROOM_BASE_SECONDS = 14;
const ROOM_SECONDS_PER_WORD = 8;
const ROOM_MIN_SECONDS = 32;
const ROOM_MAX_SECONDS = 95;
const URGENT_SECONDS = 5;
const DEFAULT_WORDS = [
  ["apple", "苹果"],
  ["protect", "保护"],
  ["abandon", "放弃"],
  ["curious", "好奇的"],
  ["forest", "森林"],
  ["ancient", "古老的"],
  ["discover", "发现"],
  ["treasure", "宝藏"],
  ["dangerous", "危险的"],
  ["escape", "逃离"],
];
const HERO_SHEET_URL = "./assets/hero-actions-alpha.png";
const GAMEPLAY_SHEET_URL = "./assets/gameplay-sprites-alpha.png";
const ROOM_SHEET_URL = "./assets/room-backgrounds.png";
const HERO_ACTIONS = ["idle", "walk", "dash", "attack", "hurt"];
const HERO_ROWS = { boy: 0, girl: 1 };
const GAMEPLAY_GRID = { cols: 6, rows: 4 };
const GAMEPLAY_SPRITES = {
  slimeGreen: [0, 0],
  slimeBlue: [1, 0],
  slimePurple: [2, 0],
  slimeOrange: [3, 0],
  slimeRed: [4, 0],
  officeDesk: [0, 1],
  filingCabinet: [1, 1],
  waterDispenser: [2, 1],
  bookshelf: [3, 1],
  stoneColumn: [4, 1],
  podium: [0, 2],
  tree: [1, 2],
  bush: [2, 2],
  log: [3, 2],
  mossyStone: [4, 2],
  chest: [0, 3],
  sword: [1, 3],
  boomerang: [2, 3],
  pickupGlow: [3, 3],
  fruit: [4, 3],
  shield: [4, 3],
  boots: [5, 3],
  freeze: [5, 3],
};
const ROOM_BACKGROUNDS = {
  office: [14, 48, 476, 342],
  library: [520, 48, 496, 342],
  forest: [1038, 48, 480, 342],
};
const SLIME_SPRITES = ["slimeGreen", "slimeBlue", "slimePurple", "slimeOrange", "slimeRed"];
const OBSTACLE_BY_THEME = {
  office: ["officeDesk", "filingCabinet", "waterDispenser"],
  library: ["bookshelf", "stoneColumn", "podium"],
  forest: ["tree", "bush", "log", "mossyStone"],
  boss: ["bookshelf", "stoneColumn", "mossyStone"],
};
const ROOMS = [
  ["第 1 局 森林庭院", "round", 0, "forest"],
  ["第 2 局 学术图书馆", "round", 0, "library"],
];

const state = {
  view: "student",
  taskId: "",
  playerName: localStorage.getItem("wordDungeonPlayerName") || "小勇士",
  avatar: localStorage.getItem("wordDungeonHero") || "boy",
  data: loadData(),
  currentSession: null,
  game: null,
  remoteTaskLoading: new Set(),
  remoteSessionLoaded: new Set(),
};

function uid(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

function nowText() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "");
    if (parsed?.tasks?.length) return parsed;
  } catch {}
  const data = { tasks: [], sessions: [] };
  const sampleId = createTaskRecord(data, "示例任务：森林宝藏复习", DEFAULT_WORDS, true);
  data.lastTaskId = sampleId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function createTaskRecord(data, taskName, pairs, isSample = false) {
  const taskId = uid("task");
  data.tasks.push({
    task_id: taskId,
    task_name: taskName.trim() || "未命名复习任务",
    created_at: nowText(),
    status: "open",
    is_sample: isSample,
    words: pairs.map(([en, zh], index) => ({
      word_id: `w_${String(index + 1).padStart(3, "0")}`,
      en: en.trim(),
      zh: zh.trim(),
      order: index,
    })),
  });
  data.lastTaskId = taskId;
  return taskId;
}

function getTask(taskId = state.taskId, fallback = true) {
  return state.data.tasks.find((task) => task.task_id === taskId) || (fallback ? state.data.tasks[0] : null);
}

function sessionsFor(taskId) {
  return state.data.sessions
    .filter((session) => session.task_id === taskId)
    .sort((a, b) => b.end_at.localeCompare(a.end_at));
}

function parseWordPairs(raw) {
  const pairs = [];
  const errors = [];
  const warnings = [];
  const seenEn = new Map();
  const seenZh = new Map();
  raw.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const text = line.trim();
    if (!text) return;
    const sep = [",", "，", "\t", ":", "："].find((item) => text.includes(item));
    if (!sep) {
      errors.push(`第 ${lineNo} 行缺少分隔符：请使用 英文,中文`);
      return;
    }
    const [left, ...rest] = text.split(sep);
    const en = left.trim();
    const zh = rest.join(sep).trim();
    if (!en || !zh) {
      errors.push(`第 ${lineNo} 行存在空值`);
      return;
    }
    if (!/^[A-Za-z][A-Za-z -]*$/.test(en)) {
      errors.push(`第 ${lineNo} 行英文包含异常字符：${en}`);
      return;
    }
    const enKey = en.toLowerCase();
    if (seenEn.has(enKey)) {
      errors.push(`第 ${lineNo} 行英文重复：${en}`);
      return;
    }
    if (seenZh.has(zh)) {
      errors.push(`第 ${lineNo} 行中文重复：${zh}`);
      return;
    }
    seenEn.set(enKey, lineNo);
    seenZh.set(zh, lineNo);
    pairs.push([en, zh]);
  });
  if (pairs.length < 6) warnings.push("建议至少 6 个词，否则地牢节奏会偏短。");
  if (pairs.length > 20) warnings.push("V1.0 建议单次 10-20 词；超过 20 词建议拆分任务。");
  return { pairs, errors, warnings };
}

function shell(content, opts = {}) {
  const hideNav = opts.hideNav || false;
  return `
    ${hideNav ? "" : `
      <header class="topbar">
        <div class="brand"><span class="brand-mark">W</span><span>Word Dungeon 单词地牢</span></div>
        <nav class="nav">
          <button data-nav="teacher">创建任务</button>
          <button data-nav="student">学生进入</button>
          <button data-nav="results">老师结果</button>
        </nav>
      </header>
    `}
    ${content}
  `;
}

function routeFromUrl() {
  const params = new URLSearchParams(location.search);
  const taskFromUrl = params.get("task");
  const taskData = params.get("taskData");
  if (taskData) {
    const imported = importTaskData(taskData);
    if (imported) state.taskId = imported.task_id;
  }
  if (taskFromUrl) state.taskId = taskFromUrl;
  if (!state.taskId) state.taskId = state.data.lastTaskId || state.data.tasks[0]?.task_id || "";
  const hash = location.hash.replace("#", "");
  if (["student"].includes(hash)) state.view = hash;
  if (taskFromUrl) state.view = "student";
}

async function saveTaskToCloud(task) {
  try {
    const response = await fetch("/api/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });
    if (!response.ok) return { ok: false };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false };
  }
}

async function loadTaskFromCloud(taskId) {
  if (!taskId || state.remoteTaskLoading.has(taskId) || getTask(taskId, false)) return getTask(taskId, false);
  state.remoteTaskLoading.add(taskId);
  try {
    const response = await fetch(`/api/task?id=${encodeURIComponent(taskId)}`);
    if (!response.ok) return null;
    const { task } = await response.json();
    if (!task?.task_id) return null;
    const existing = getTask(task.task_id, false);
    if (!existing) {
      state.data.tasks.push(task);
      state.data.lastTaskId = task.task_id;
      saveData();
    }
    return task;
  } catch {
    return null;
  } finally {
    state.remoteTaskLoading.delete(taskId);
  }
}

async function saveSessionToCloud(session) {
  try {
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });
  } catch {}
}

async function loadSessionsFromCloud(taskId) {
  if (!taskId || state.remoteSessionLoaded.has(taskId)) return;
  state.remoteSessionLoaded.add(taskId);
  try {
    const response = await fetch(`/api/session?taskId=${encodeURIComponent(taskId)}`);
    if (!response.ok) return;
    const { sessions } = await response.json();
    if (!Array.isArray(sessions)) return;
    const known = new Set(state.data.sessions.map((session) => session.session_id));
    let changed = false;
    sessions.forEach((session) => {
      if (session?.session_id && !known.has(session.session_id)) {
        state.data.sessions.push(session);
        changed = true;
      }
    });
    if (changed) {
      saveData();
      if (state.view === "results" && state.taskId === taskId) render();
    }
  } catch {}
}

function importTaskData(encoded) {
  try {
    const json = decodeURIComponent(escape(atob(encoded.replace(/-/g, "+").replace(/_/g, "/"))));
    const incoming = JSON.parse(json);
    if (!incoming?.task_id || !Array.isArray(incoming.words)) return null;
    const existing = state.data.tasks.find((task) => task.task_id === incoming.task_id);
    if (existing) return existing;
    const task = {
      task_id: incoming.task_id,
      task_name: incoming.task_name || "分享复习任务",
      created_at: incoming.created_at || nowText(),
      status: "open",
      is_shared: true,
      words: incoming.words.map((word, index) => ({
        word_id: word.word_id || `w_${String(index + 1).padStart(3, "0")}`,
        en: word.en,
        zh: word.zh,
        order: index,
      })),
    };
    state.data.tasks.push(task);
    state.data.lastTaskId = task.task_id;
    saveData();
    return task;
  } catch {
    return null;
  }
}

function encodeTaskData(task) {
  const payload = {
    task_id: task.task_id,
    task_name: task.task_name,
    created_at: task.created_at,
    words: task.words.map(({ word_id, en, zh, order }) => ({ word_id, en, zh, order })),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function navigate(view) {
  state.view = view;
  if (view !== "student") history.replaceState(null, "", `#${view}`);
  render();
}

function render() {
  const app = document.querySelector("#app");
  if (state.game) {
    state.game.destroy();
    state.game = null;
  }
  if (state.view === "teacher") state.view = "student";
  if (state.view === "student") app.innerHTML = renderStudentGateV2();
  if (state.view === "game") {
    app.innerHTML = renderGame();
    startGame();
  }
  if (state.view === "settlement") app.innerHTML = renderSettlementV2();
  if (state.view === "results") app.innerHTML = renderResults();
  bindCommon();
}

function bindCommon() {
  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });
}

function renderTeacher() {
  const sample = DEFAULT_WORDS.map(([en, zh]) => `${en},${zh}`).join("\n");
  return shell(`
    <main class="screen">
      <div class="two-column">
        <section class="card">
          <h1 class="page-title">创建复习任务</h1>
          <p class="muted">粘贴词对后生成学生链接。学生端只看到游戏入口，不会提前展示词表。</p>
          <label class="field">
            <span>任务名称</span>
            <input id="taskName" value="今日抗遗忘挑战" />
          </label>
          <label class="field">
            <span>词对输入</span>
            <textarea id="wordInput" spellcheck="false">${sample}</textarea>
          </label>
          <div class="button-row">
            <button class="ghost-button" id="sampleWords">使用示例词表</button>
            <button class="ghost-button" id="checkWords">检查格式</button>
            <button class="primary-button" id="createTask">生成学生链接</button>
          </div>
          <div id="createStatus" class="status">已填入示例词表。</div>
          <div id="shareBox" class="share-box hidden"></div>
        </section>
        <aside class="card">
          <h2 class="section-title">词表预览</h2>
          <table class="preview-list">
            <thead><tr><th>英文</th><th>中文</th></tr></thead>
            <tbody id="previewBody"></tbody>
          </table>
        </aside>
      </div>
    </main>
  `);
}

function bindTeacher() {
  const wordInput = document.querySelector("#wordInput");
  const previewBody = document.querySelector("#previewBody");
  const status = document.querySelector("#createStatus");
  const shareBox = document.querySelector("#shareBox");
  const refresh = () => {
    const { pairs, errors, warnings } = parseWordPairs(wordInput.value);
    previewBody.innerHTML = pairs.map(([en, zh]) => `<tr><td>${escapeHtml(en)}</td><td>${escapeHtml(zh)}</td></tr>`).join("");
    status.classList.toggle("error", errors.length > 0);
    if (errors.length) status.textContent = `存在格式问题：${errors.slice(0, 3).join("；")}`;
    else if (warnings.length) status.textContent = `可创建，但提示：${warnings.join("；")}`;
    else status.textContent = `格式正确，共 ${pairs.length} 个词。`;
    return { pairs, errors, warnings };
  };
  document.querySelector("#sampleWords").addEventListener("click", () => {
    wordInput.value = DEFAULT_WORDS.map(([en, zh]) => `${en},${zh}`).join("\n");
    refresh();
  });
  document.querySelector("#checkWords").addEventListener("click", refresh);
  document.querySelector("#createTask").addEventListener("click", async () => {
    const { pairs, errors, warnings } = refresh();
    if (errors.length || !pairs.length) return;
    if (warnings.length && !confirm(`${warnings.join("\n")}\n\n仍然创建任务吗？`)) return;
    const taskId = createTaskRecord(state.data, document.querySelector("#taskName").value, pairs, false);
    state.taskId = taskId;
    saveData();
    const task = getTask(taskId, false);
    const cloud = await saveTaskToCloud(task);
    const url = studentUrl(taskId);
    const offlineUrl = studentUrl(taskId, task);
    shareBox.classList.remove("hidden");
    shareBox.innerHTML = `
      <strong>任务已创建</strong>
      <span class="muted">任务码：${taskId}</span>
      <span class="muted">${cloud.ok ? "云端保存成功：推荐链接可直接发给学生。" : "当前未检测到云端存储：请先使用零后端可用链接，或在 Vercel 配置 KV 后使用推荐链接。"}</span>
      <label class="field"><span>部署后推荐链接（需云端数据存储）</span><input readonly value="${url}" /></label>
      <label class="field"><span>零后端可用链接（词表随链接携带，不用重新部署）</span><input readonly value="${offlineUrl}" /></label>
      <div class="button-row">
        <button class="small-button" id="copyLink">复制推荐链接</button>
        <button class="small-button" id="copyOfflineLink">复制零后端链接</button>
        <button class="small-button" id="openStudent">打开学生端</button>
      </div>
    `;
    document.querySelector("#copyLink").addEventListener("click", () => copyText(url));
    document.querySelector("#copyOfflineLink").addEventListener("click", () => copyText(offlineUrl));
    document.querySelector("#openStudent").addEventListener("click", () => {
      history.replaceState(null, "", `?task=${encodeURIComponent(taskId)}#student`);
      state.view = "student";
      render();
    });
  });
  refresh();
}

function studentUrl(taskId, embeddedTask = null) {
  const base = `${location.origin}${location.pathname}`;
  const query = embeddedTask
    ? `taskData=${encodeURIComponent(encodeTaskData(embeddedTask))}`
    : `task=${encodeURIComponent(taskId)}`;
  if (location.protocol === "file:") return `${location.href.split("?")[0]}?${query}#student`;
  return `${base}?${query}#student`;
}

async function copyText(text, message = "已复制。") {
  try {
    await navigator.clipboard.writeText(text);
    alert(message);
  } catch {
    prompt("复制以下内容：", text);
  }
}

function renderStudentGate() {
  const task = getTask(state.taskId, false);
  if (!task && state.taskId) {
    loadTaskFromCloud(state.taskId).then((remoteTask) => {
      if (remoteTask && state.view === "student") render();
    });
  }
  const safeName = escapeHtml(state.playerName || "小勇士");
  return shell(`
    <main class="student-gate">
      <div class="gate-content">
        <section>
          <h1 class="gate-title">欢迎${safeName}，快来用智慧打败这些怪物吧！</h1>
          <p class="gate-subtitle">捡起中文线索，找到对应英文怪物。每个线索只有一次攻击机会，认真观察再出手。</p>
          <div class="monster-stage" aria-hidden="true">
            <div class="floor-tile"></div>
            <div class="gate-hero"></div>
            <div class="meaning-chip">中文线索</div>
            <div class="gate-monster one"></div>
            <div class="gate-monster two"></div>
          </div>
        </section>
        <section class="start-panel">
          <label class="field">
            <span>你的昵称</span>
            <input id="playerName" maxlength="12" value="${safeName}" />
          </label>
          <label class="field">
            <span>任务码</span>
            <input id="studentTaskId" value="${escapeHtml(task?.task_id || state.taskId || "")}" />
          </label>
          <div>
            <strong>选择你的勇士</strong>
            <div class="avatar-grid" id="avatarGrid">
              ${[
                ["boy", "男勇士"],
                ["girl", "女勇士"],
              ].map(([id, label]) => `
                <button class="avatar-choice ${state.avatar === id ? "is-active" : ""}" data-avatar="${id}">
                  <span class="avatar-face avatar-${id}"></span>
                  <span class="avatar-label">${label}</span>
                </button>
              `).join("")}
            </div>
          </div>
          <button class="primary-button" id="startGameButton">开始游戏</button>
          <p id="studentStatus" class="status">${task ? `${escapeHtml(task.task_name)}｜预计 3 分钟` : "正在查找任务。若一直未找到，请检查任务码或让老师复制零后端链接。"}</p>
        </section>
      </div>
    </main>
  `, { hideNav: true });
}

function bindStudentGate() {
  document.querySelector("#playerName").addEventListener("input", (event) => {
    state.playerName = event.target.value.trim() || "小勇士";
    localStorage.setItem("wordDungeonPlayerName", state.playerName);
    const title = document.querySelector(".gate-title");
    title.textContent = `欢迎${state.playerName}，快来用智慧打败这些怪物吧！`;
  });
  document.querySelector("#studentTaskId").addEventListener("input", (event) => {
    state.taskId = event.target.value.trim();
    const task = getTask(state.taskId, false);
    document.querySelector("#studentStatus").textContent = task ? `${task.task_name}｜预计 3 分钟` : "未找到任务，请检查任务码。";
  });
  document.querySelectorAll("[data-avatar]").forEach((button) => {
    button.addEventListener("click", () => {
      state.avatar = button.dataset.avatar;
      localStorage.setItem("wordDungeonHero", state.avatar);
      document.querySelectorAll("[data-avatar]").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
  document.querySelector("#startGameButton").addEventListener("click", async () => {
    const taskId = document.querySelector("#studentTaskId").value.trim();
    let task = getTask(taskId, false);
    if (!task) task = await loadTaskFromCloud(taskId);
    if (!task) {
      document.querySelector("#studentStatus").textContent = "未找到任务，请检查任务码。";
      return;
    }
    state.taskId = taskId;
    state.data.lastTaskId = taskId;
    state.playerName = document.querySelector("#playerName").value.trim() || "小勇士";
    localStorage.setItem("wordDungeonPlayerName", state.playerName);
    saveData();
    state.view = "game";
    render();
  });
}

function renderGame() {
  return shell(`
    <main class="game-layout game-immersive">
      <section class="game-main">
        <div class="canvas-wrap">
          <canvas id="gameCanvas"></canvas>
          <div class="game-hud" aria-live="polite">
            <div class="room-badge">
              <span id="roomText">准备进入地牢</span>
              <small id="roundText">第 1 / 2 局</small>
            </div>
            <div id="countdownBadge" class="countdown-badge">--:--</div>
            <div class="status-cluster">
              <span id="hpText" class="stat-pill">♥♥♥</span>
              <span id="shieldText" class="stat-pill">护盾 0</span>
              <span id="scoreText" class="stat-pill">能量 0</span>
              <span id="comboText" class="stat-pill">连击 0</span>
              <span id="continueText" class="stat-pill">救援 1</span>
            </div>
          </div>
          <div id="targetText" class="target-chip">未携带中文词义</div>
          <div id="feedbackBox" class="game-feedback">捡起一个中文词义，开始挑战。</div>
          <div class="game-actions">
            <button class="glass-button" id="skipMeaning" type="button">放弃词义</button>
            <button class="glass-button" id="backToStudent" type="button">返回开始页</button>
          </div>
          <div id="gameHelp" class="game-help">
            <button id="helpToggle" class="help-button" type="button" aria-label="查看操作说明">?</button>
            <div class="help-popover">
              <strong>操作说明</strong>
              <span>方向键 / WASD 移动；鼠标或触屏按住主角拖动。</span>
              <span>走到中文意思旁边拾取，再点击对应英文怪物发射武器。</span>
              <span>没有把握时可以放弃当前词义，它会进入待复习列表。</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  `, { hideNav: true });
}

function startGame() {
  const task = getTask(state.taskId, false);
  if (!task) {
    state.view = "student";
    render();
    return;
  }
  state.game = new WordDungeonGame(task, state.playerName, state.avatar, (session) => {
    state.currentSession = session;
    state.data.sessions.push(session);
    saveData();
    saveSessionToCloud(session);
    state.view = "settlement";
    render();
  });
}

class Scheduler {
  constructor(words) {
    this.words = words;
    this.stats = new Map();
    this.words.forEach((word) => this.stats.set(word.word_id, {
      word_id: word.word_id,
      en: word.en,
      zh: word.zh,
      first_result: null,
      attempt_count: 0,
      error_count: 0,
      timeout_count: 0,
      slow_count: 0,
      fast_correct_streak: 0,
      correct_count: 0,
      correction_result: null,
      correction_success_count: 0,
      response_times: [],
      exposure_count: 0,
      priority_weight: 2,
      is_boss_candidate: false,
      boss_failed: false,
    }));
    this.interactionIndex = 0;
    this.recent = [];
    this.delayedReplay = new Map();
    this.attempts = [];
  }
  word(id) {
    return this.words.find((word) => word.word_id === id);
  }
  eligible(includeRecent = false) {
    const recentSet = new Set(this.recent.slice(-MIN_REPLAY_GAP));
    const ids = this.words
      .filter((word) => this.stats.get(word.word_id).exposure_count < 3 || this.words.length < 6)
      .filter((word) => includeRecent || !recentSet.has(word.word_id) || this.words.length <= MIN_REPLAY_GAP)
      .map((word) => word.word_id);
    return ids.length ? ids : this.words.map((word) => word.word_id);
  }
  weightedPick(pool, count) {
    const available = [...new Set(pool)];
    const chosen = [];
    while (available.length && chosen.length < count) {
      const total = available.reduce((sum, id) => sum + Math.max(1, this.stats.get(id).priority_weight), 0);
      let marker = Math.random() * total;
      let picked = available[available.length - 1];
      for (const id of available) {
        marker -= Math.max(1, this.stats.get(id).priority_weight);
        if (marker <= 0) {
          picked = id;
          break;
        }
      }
      chosen.push(picked);
      available.splice(available.indexOf(picked), 1);
    }
    return chosen;
  }
  chooseRoom(kind, count) {
    let ids = [];
    if (kind === "boss") {
      const boss = this.chooseBoss();
      ids = [boss, ...shuffle(this.eligible(true).filter((id) => id !== boss)).slice(0, count - 1)];
    } else {
      const eligible = this.eligible();
      const uncovered = eligible.filter((id) => this.stats.get(id).exposure_count === 0);
      const due = [...this.delayedReplay.entries()]
        .filter(([id, at]) => this.interactionIndex >= at && eligible.includes(id))
        .map(([id]) => id)
        .sort((a, b) => this.stats.get(b).priority_weight - this.stats.get(a).priority_weight);
      if (kind === "warmup") ids.push(...uncovered.slice(0, count));
      if (kind === "normal") ids.push(...uncovered.slice(0, Math.max(1, Math.floor(count / 2))), ...due.slice(0, count));
      if (kind === "reinforce") ids.push(...due.slice(0, count), ...uncovered.slice(0, count));
      ids = [...new Set(ids)].slice(0, count);
      if (ids.length < count) ids.push(...this.weightedPick(eligible.filter((id) => !ids.includes(id)), count - ids.length));
    }
    ids = [...new Set(ids)].slice(0, Math.min(count, this.words.length));
    ids.forEach((id) => this.stats.get(id).exposure_count += 1);
    return ids.map((id) => this.word(id));
  }
  bossScore(id) {
    const s = this.stats.get(id);
    return 3 * s.error_count + 2 * s.timeout_count + 2 * s.slow_count - s.correction_success_count + Math.max(0, s.priority_weight - 2);
  }
  chooseBoss() {
    let best = this.words[0].word_id;
    let score = -Infinity;
    this.words.forEach((word) => {
      const next = this.bossScore(word.word_id);
      if (next > score) {
        best = word.word_id;
        score = next;
      }
    });
    this.stats.get(best).is_boss_candidate = true;
    return best;
  }
  record(targetId, selectedId, responseMs, roomName, opts = {}) {
    const stat = this.stats.get(targetId);
    const correct = selectedId === targetId && !opts.skip;
    const result = opts.skip || responseMs >= TIMEOUT_MS ? "timeout" : correct ? "correct" : "wrong";
    stat.attempt_count += 1;
    stat.response_times.push(responseMs);
    if (!stat.first_result) stat.first_result = result;
    else if (correct && ["wrong", "timeout"].includes(stat.first_result)) {
      stat.correction_result = "correct";
      stat.correction_success_count += 1;
    }
    if (correct) {
      stat.correct_count += 1;
      if (responseMs <= FAST_MS) {
        stat.fast_correct_streak += 1;
        if (stat.fast_correct_streak >= 2) stat.priority_weight = Math.max(0, stat.priority_weight - 2);
      } else if (responseMs > SLOW_MS) {
        stat.slow_count += 1;
        stat.priority_weight += 2;
        stat.fast_correct_streak = 0;
      }
      if (stat.correction_result === "correct") stat.priority_weight = Math.max(0, stat.priority_weight - 1);
      this.delayedReplay.delete(targetId);
    } else {
      stat.fast_correct_streak = 0;
      if (result === "timeout") {
        stat.timeout_count += 1;
        stat.priority_weight += 4;
      } else {
        stat.error_count += 1;
        stat.priority_weight += stat.error_count === 1 ? 3 : 5;
      }
      if (opts.boss) stat.boss_failed = true;
      this.delayedReplay.set(targetId, this.interactionIndex + MIN_REPLAY_GAP);
    }
    this.interactionIndex += 1;
    this.recent.push(targetId);
    const attempt = {
      word_id: targetId,
      target_word_id: selectedId,
      attempt_no: stat.attempt_count,
      correct,
      result,
      response_time_ms: responseMs,
      room: roomName,
      timestamp: nowText(),
    };
    this.attempts.push(attempt);
    return attempt;
  }
  summaries() {
    return this.words.map((word) => {
      const s = this.stats.get(word.word_id);
      const avg = s.response_times.length ? Math.round(s.response_times.reduce((a, b) => a + b, 0) / s.response_times.length) : 0;
      let finalStatus = "建议复习";
      if (s.error_count >= 2 || s.timeout_count > 0 || s.boss_failed) finalStatus = "重点复习";
      else if (["wrong", "timeout"].includes(s.first_result)) finalStatus = s.correction_result === "correct" ? "建议复习" : "重点复习";
      else if (avg > SLOW_MS) finalStatus = "基本掌握";
      else if (s.correct_count > 0) finalStatus = "稳定";
      return {
        word_id: word.word_id,
        en: word.en,
        zh: word.zh,
        first_result: s.first_result || "not_seen",
        attempt_count: s.attempt_count,
        error_count: s.error_count,
        response_time_ms: avg,
        correction_result: s.correction_result,
        exposure_count: s.exposure_count,
        priority_weight: s.priority_weight,
        is_boss_candidate: s.is_boss_candidate,
        final_status: finalStatus,
      };
    });
  }
}

class WordDungeonGame {
  constructor(task, playerName, avatar, onFinish) {
    this.task = task;
    this.playerName = playerName;
    this.avatar = avatar;
    this.onFinish = onFinish;
    this.canvas = document.querySelector("#gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.roomText = document.querySelector("#roomText");
    this.roundText = document.querySelector("#roundText");
    this.countdownBadge = document.querySelector("#countdownBadge");
    this.hpText = document.querySelector("#hpText");
    this.shieldText = document.querySelector("#shieldText");
    this.scoreText = document.querySelector("#scoreText");
    this.comboText = document.querySelector("#comboText");
    this.continueText = document.querySelector("#continueText");
    this.target = document.querySelector("#targetText");
    this.feedback = document.querySelector("#feedbackBox");
    this.scheduler = new Scheduler(task.words);
    this.roundWordGroups = splitWordsForRooms(task.words);
    this.heroSheet = loadImage(HERO_SHEET_URL);
    this.gameplaySheet = loadImage(GAMEPLAY_SHEET_URL);
    this.roomSheet = loadImage(ROOM_SHEET_URL);
    this.audio = new AudioEngine();
    this.audio.unlock();
    this.startedAt = performance.now();
    this.roomStartedAt = performance.now();
    this.roomIndex = -1;
    this.roomName = "";
    this.roomKind = "";
    this.roomDurationMs = ROOM_MIN_SECONDS * 1000;
    this.deadlineAt = 0;
    this.lastUrgentSecond = null;
    this.roomTransitioning = false;
    this.hp = 3;
    this.maxHp = 3;
    this.score = 0;
    this.combo = 0;
    this.continues = 1;
    this.shield = 0;
    this.currentTargetId = null;
    this.currentTargetZh = "";
    this.pickupAt = 0;
    this.player = { x: 110, y: 110, r: 20 };
    this.dragging = false;
    this.dragTarget = null;
    this.keys = new Set();
    this.monsters = [];
    this.meanings = [];
    this.items = [];
    this.projectiles = [];
    this.obstacles = [];
    this.freezeUntil = 0;
    this.bootsUntil = 0;
    this.lastHitAt = 0;
    this.attackLockUntil = 0;
    this.bossId = null;
    this.bossPhase = 0;
    this.bossAttempts = 0;
    this.attackUntil = 0;
    this.hurtUntil = 0;
    this.heroAction = "idle";
    this.facing = 1;
    this.running = true;
    this.last = performance.now();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement);
    this.bind();
    this.resize();
    this.nextRoom();
    requestAnimationFrame((now) => this.tick(now));
  }
  bind() {
    this.onKeyDown = (event) => this.keys.add(event.key.toLowerCase());
    this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointerdown", (event) => this.pointerDown(event));
    this.canvas.addEventListener("pointermove", (event) => this.pointerMove(event));
    this.canvas.addEventListener("pointerup", (event) => this.pointerUp(event));
    this.canvas.addEventListener("pointercancel", () => this.dragging = false);
    document.querySelector("#skipMeaning").addEventListener("click", () => this.skipCurrent());
    document.querySelector("#helpToggle").addEventListener("click", () => {
      document.querySelector("#gameHelp").classList.toggle("is-open");
    });
    document.querySelector("#backToStudent").addEventListener("click", () => {
      if (confirm("返回后当前游戏不会保存为完成结果，确定返回吗？")) {
        this.destroy();
        state.view = "student";
        render();
      }
    });
  }
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    this.width = Math.max(320, rect.width);
    this.height = Math.max(320, rect.height);
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  destroy() {
    this.running = false;
    this.resizeObserver.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }
  pointerPos(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  pointerDown(event) {
    const p = this.pointerPos(event);
    this.pointerStart = p;
    this.pointerMoved = false;
    this.canvas.setPointerCapture(event.pointerId);
    const monster = this.monsters.find((m) => m.alive && pointInRect(p, monsterRect(m)));
    const meaning = this.meanings.find((m) => m.active && pointInRect(p, m.rect));
    const onPlayer = dist(p, this.player) < 54;
    if (this.currentTargetId && monster) {
      this.attack(monster);
      return;
    }
    if (!this.currentTargetId && meaning) {
      if (this.canPickMeaning(meaning)) {
        this.pickMeaning(meaning);
      } else {
        this.dragging = true;
        this.dragTarget = rectCenter(meaning.rect);
        this.setFeedback("走到中文意思旁边才能拿起它。");
      }
      return;
    }
    if (onPlayer || !this.currentTargetId) {
      this.dragging = true;
      this.dragTarget = p;
    }
  }
  pointerMove(event) {
    if (!this.dragging) return;
    const p = this.pointerPos(event);
    this.dragTarget = p;
    if (dist(p, this.pointerStart) > 8) this.pointerMoved = true;
  }
  pointerUp(event) {
    if (this.dragging) {
      const p = this.pointerPos(event);
      this.dragTarget = p;
      this.dragging = false;
      return;
    }
    if (!this.pointerMoved && this.currentTargetId) {
      const p = this.pointerPos(event);
      const monster = this.monsters.find((m) => m.alive && pointInRect(p, monsterRect(m)));
      if (monster) this.attack(monster);
    }
  }
  nextRoom() {
    this.roomIndex += 1;
    if (this.roomIndex >= this.roundWordGroups.length) {
      this.end("completed");
      return;
    }
    const [name, kind, count, theme] = ROOMS[this.roomIndex] || ROOMS[ROOMS.length - 1];
    const roomWords = this.roundWordGroups[this.roomIndex] || [];
    this.roomName = name;
    this.roomKind = kind;
    this.roomTheme = theme;
    this.roomStartedAt = performance.now();
    this.roomDurationMs = roomDurationMs(roomWords.length);
    this.deadlineAt = this.roomStartedAt + this.roomDurationMs;
    this.lastUrgentSecond = null;
    this.roomTransitioning = false;
    this.currentTargetId = null;
    this.currentTargetZh = "";
    this.projectiles = [];
    this.player.x = 94;
    this.player.y = 94;
    this.obstacles = this.makeObstacles(false, theme);
    this.spawnRoom(roomWords);
    this.setFeedback(`${name}：本局 ${roomWords.length} 个词，倒计时结束前清理它们。`);
  }
  spawnRoom(words) {
    words.forEach((word) => {
      const stat = this.scheduler.stats.get(word.word_id);
      if (stat) stat.exposure_count += 1;
    });
    this.meanings = words.map((word) => this.makeMeaning(word));
    this.monsters = words.map((word, index) => this.makeMonster(word, false, index));
    this.items = this.roomKind === "warmup" || Math.random() > 0.55 ? [] : [this.makeItem()];
  }
  spawnBossPhase() {
    const bossWord = this.scheduler.word(this.bossId);
    const distractors = shuffle(this.task.words.filter((word) => word.word_id !== bossWord.word_id)).slice(0, 2);
    this.meanings = [this.makeMeaning(bossWord)];
    this.monsters = [this.makeMonster(bossWord, true, 4), ...distractors.map((word, index) => this.makeMonster(word, false, index))];
    this.items = [];
    this.setFeedback(`Boss 挑战 ${this.bossPhase + 1}/2：再次确认待复习单词。`);
  }
  makeObstacles(boss = false, theme = this.roomTheme || "office") {
    const w = this.width;
    const h = this.height;
    if (boss) return addObstacleSprites([[w * 0.36, h * 0.42, w * 0.58, h * 0.48], [w * 0.14, h * 0.67, w * 0.3, h * 0.74], [w * 0.72, h * 0.22, w * 0.84, h * 0.29]], "boss");
    const variants = [
      [[w * 0.31, h * 0.25, w * 0.46, h * 0.31], [w * 0.67, h * 0.56, w * 0.86, h * 0.63]],
      [[w * 0.2, h * 0.5, w * 0.35, h * 0.57], [w * 0.56, h * 0.27, w * 0.75, h * 0.34]],
      [[w * 0.4, h * 0.45, w * 0.58, h * 0.52], [w * 0.18, h * 0.75, w * 0.34, h * 0.82]],
    ];
    return addObstacleSprites(variants[Math.floor(Math.random() * variants.length)], theme);
  }
  randomFreeRect(width, height) {
    for (let i = 0; i < 80; i++) {
      const x = rand(70, this.width - width - 40);
      const y = rand(80, this.height - height - 45);
      const rect = [x, y, x + width, y + height];
      if (!this.obstacles.some((obs) => overlap(rect, obs))) return rect;
    }
    return [90, 140, 90 + width, 140 + height];
  }
  makeMeaning(word) {
    return { word_id: word.word_id, zh: word.zh, rect: this.randomFreeRect(112, 38), active: true };
  }
  makeMonster(word, boss, index = 0) {
      const width = Math.max(88, Math.min(146, 24 + word.en.length * 11));
    const height = boss ? 58 : 44;
    const rect = this.randomFreeRect(width, height);
    const speed = boss ? 42 : this.roomKind === "warmup" ? 30 : 48;
    const angle = Math.random() * Math.PI * 2;
    return {
      word_id: word.word_id,
      en: word.en,
      sprite: boss ? "slimeRed" : SLIME_SPRITES[index % SLIME_SPRITES.length],
      x: (rect[0] + rect[2]) / 2,
      y: (rect[1] + rect[3]) / 2,
      w: width,
      h: height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      boss,
      alive: true,
      flashUntil: 0,
    };
  }
  makeItem() {
    const types = ["fruit", "shield", "boots", "freeze"];
    const labels = { fruit: "果", shield: "盾", boots: "靴", freeze: "停" };
    const type = types[Math.floor(Math.random() * types.length)];
    const rect = this.randomFreeRect(40, 40);
    return { type, label: labels[type], x: (rect[0] + rect[2]) / 2, y: (rect[1] + rect[3]) / 2, active: true };
  }
  tick(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt, now);
    this.draw(now);
    requestAnimationFrame((next) => this.tick(next));
  }
  update(dt, now) {
    if (!this.roomTransitioning && now >= this.deadlineAt) {
      this.handleRoomTimeout();
      this.updateHud(now);
      return;
    }
    this.updatePlayer(dt, now);
    this.updateMonsters(dt, now);
    this.updateProjectiles(dt, now);
    this.checkPickups();
    this.checkCollisions(now);
    this.updateHud(now);
  }
  updatePlayer(dt, now) {
    const speed = now < this.bootsUntil ? 245 : 176;
    let dx = 0;
    let dy = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;
    if (this.dragTarget) {
      const vx = this.dragTarget.x - this.player.x;
      const vy = this.dragTarget.y - this.player.y;
      const length = Math.hypot(vx, vy);
      if (length > 4) {
        dx += vx / length;
        dy += vy / length;
      }
      if (!this.dragging && length < 8) this.dragTarget = null;
    }
    this.heroAction = now < this.hurtUntil ? "hurt" : now < this.attackUntil ? "attack" : "idle";
    if (!dx && !dy) return;
    const len = Math.hypot(dx, dy);
    this.heroAction = now < this.bootsUntil ? "dash" : "walk";
    this.facing = dx < -0.15 ? -1 : dx > 0.15 ? 1 : this.facing;
    const old = { x: this.player.x, y: this.player.y };
    this.player.x = clamp(this.player.x + (dx / len) * speed * dt, 26, this.width - 26);
    this.player.y = clamp(this.player.y + (dy / len) * speed * dt, 26, this.height - 26);
    if (this.obstacles.some((obs) => overlap(playerRect(this.player), obs))) {
      this.player.x = old.x;
      this.player.y = old.y;
    }
  }
  updateMonsters(dt, now) {
    if (now < this.freezeUntil) return;
    this.monsters.forEach((monster) => {
      if (!monster.alive) return;
      monster.x += monster.vx * dt;
      monster.y += monster.vy * dt;
      const rect = monsterRect(monster);
      if (rect[0] < 16 || rect[2] > this.width - 16) {
        monster.vx *= -1;
        monster.x = clamp(monster.x, monster.w / 2 + 16, this.width - monster.w / 2 - 16);
      }
      if (rect[1] < 16 || rect[3] > this.height - 16) {
        monster.vy *= -1;
        monster.y = clamp(monster.y, monster.h / 2 + 16, this.height - monster.h / 2 - 16);
      }
      if (this.obstacles.some((obs) => overlap(monsterRect(monster), obs))) {
        monster.vx *= -1;
        monster.vy *= -1;
      }
    });
  }
  updateProjectiles(dt, now) {
    this.projectiles.forEach((projectile) => {
      if (projectile.done) return;
      const target = projectile.target;
      if (!target.alive) {
        projectile.done = true;
        return;
      }
      const dx = target.x - projectile.x;
      const dy = target.y - projectile.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      projectile.angle = Math.atan2(dy, dx);
      projectile.spin += dt * 12;
      projectile.x += (dx / length) * projectile.speed * dt;
      projectile.y += (dy / length) * projectile.speed * dt;
      if (length < 28) {
        projectile.done = true;
        this.resolveProjectile(projectile);
      }
    });
    this.projectiles = this.projectiles.filter((projectile) => !projectile.done || now - projectile.createdAt < 300);
  }
  checkPickups() {
    const pRect = playerRect(this.player);
    if (!this.currentTargetId) {
      const meaning = this.meanings.find((item) => item.active && this.canPickMeaning(item) && overlap(pRect, item.rect));
      if (meaning) this.pickMeaning(meaning);
    }
    this.items.forEach((item) => {
      if (item.active && overlap(pRect, [item.x - 20, item.y - 20, item.x + 20, item.y + 20])) {
        item.active = false;
        this.applyItem(item.type);
      }
    });
  }
  canPickMeaning(meaning) {
    return dist(this.player, rectCenter(meaning.rect)) < 66 || overlap(playerRect(this.player), meaning.rect);
  }
  checkCollisions(now) {
    const pRect = playerRect(this.player);
    const hit = this.monsters.find((monster) => monster.alive && overlap(pRect, monsterRect(monster)));
    if (!hit || now - this.lastHitAt < 950) return;
    this.lastHitAt = now;
    if (this.shield > 0) {
      this.shield -= 1;
      this.setFeedback("护盾挡住了一次碰撞。");
    } else {
      this.hp -= 1;
      this.setFeedback("碰到怪物，扣 1 点生命；这不会计入单词错误。");
    }
    this.hurtUntil = now + 650;
    this.audio.play("hurt");
    if (this.hp <= 0) {
      if (this.continues > 0) {
        this.continues -= 1;
        this.hp = 2;
        this.player.x = 94;
        this.player.y = 94;
        this.setFeedback("救援成功：保留学习记录，回到房间入口。");
      } else {
        this.end("incomplete");
      }
    }
  }
  handleRoomTimeout() {
    if (this.roomTransitioning) return;
    this.roomTransitioning = true;
    this.audio.play("timeout");
    const timeoutMs = TIMEOUT_MS;
    this.projectiles.filter((projectile) => !projectile.done).forEach((projectile) => {
      this.scheduler.record(projectile.targetId, projectile.selectedId, timeoutMs, this.roomName, { skip: true });
    });
    this.projectiles = [];
    if (this.currentTargetId) {
      this.scheduler.record(this.currentTargetId, null, timeoutMs, this.roomName, { skip: true });
    }
    this.meanings.filter((item) => item.active).forEach((item) => {
      this.scheduler.record(item.word_id, null, timeoutMs, this.roomName, { skip: true });
      item.active = false;
    });
    this.currentTargetId = null;
    this.currentTargetZh = "";
    this.combo = 0;
    this.setFeedback("本局倒计时结束，未完成的词已进入复习清单。");
    setTimeout(() => this.nextRoom(), 950);
  }
  pickMeaning(meaning) {
    if (this.currentTargetId) return;
    meaning.active = false;
    this.currentTargetId = meaning.word_id;
    this.currentTargetZh = meaning.zh;
    this.pickupAt = performance.now();
    this.audio.play("pickup");
    this.setFeedback(`当前目标：${meaning.zh}。找到对应英文怪物并点击。`);
  }
  attack(monster) {
    const now = performance.now();
    if (!this.currentTargetId || now < this.attackLockUntil) return;
    if (this.projectiles.some((projectile) => !projectile.done)) {
      this.setFeedback("武器正在飞行，等它击中后再继续。");
      return;
    }
    this.attackLockUntil = now + 450;
    const responseMs = Math.round(now - this.pickupAt);
    this.attackUntil = now + 520;
    this.facing = monster.x < this.player.x ? -1 : 1;
    this.projectiles.push({
      x: this.player.x,
      y: this.player.y - 10,
      target: monster,
      targetId: this.currentTargetId,
      selectedId: monster.word_id,
      responseMs,
      roomName: this.roomName,
      boss: this.roomKind === "boss",
      weapon: this.avatar === "girl" ? "boomerang" : "sword",
      speed: 540,
      angle: 0,
      spin: 0,
      createdAt: now,
      done: false,
    });
    this.audio.play("shoot");
    this.currentTargetId = null;
    this.currentTargetZh = "";
    this.setFeedback("单词武器发射！命中后才会判定。");
  }
  resolveProjectile(projectile) {
    const attempt = this.scheduler.record(projectile.targetId, projectile.selectedId, projectile.responseMs, projectile.roomName, { boss: projectile.boss });
    if (attempt.correct) {
      this.combo += 1;
      this.score += 100 + Math.min(5, this.combo) * 10;
      projectile.target.alive = false;
      this.audio.play("hit");
      if (projectile.boss) {
        this.bossPhase += 1;
        if (this.bossPhase >= 2) setTimeout(() => this.end("completed"), 700);
        else setTimeout(() => this.spawnBossPhase(), 800);
      } else {
        this.setFeedback(this.combo >= 2 ? `正确！Combo ${this.combo}` : "正确！怪物被击败。");
        if (this.combo === 3 && Math.random() < 0.6) this.items.push(this.makeItem());
        this.checkRoomDone();
      }
    } else {
      this.combo = 0;
      projectile.target.flashUntil = performance.now() + 550;
      this.audio.play("miss");
      this.setFeedback("这个词需要再遇见一次；本次不会显示答案。");
      if (projectile.boss) {
        this.bossAttempts += 1;
        if (this.bossAttempts >= 3) setTimeout(() => this.end("completed"), 750);
        else setTimeout(() => this.spawnBossPhase(), 850);
      } else {
        this.checkRoomDone();
      }
    }
  }
  skipCurrent() {
    if (!this.currentTargetId) {
      this.setFeedback("当前没有携带词义。");
      return;
    }
    const responseMs = Math.max(TIMEOUT_MS, Math.round(performance.now() - this.pickupAt));
    this.scheduler.record(this.currentTargetId, null, responseMs, this.roomName, { skip: true, boss: this.roomKind === "boss" });
    this.currentTargetId = null;
    this.currentTargetZh = "";
    this.combo = 0;
    this.setFeedback("已跳过，这个词会作为待复习单词处理。");
    if (this.roomKind === "boss") {
      this.bossAttempts += 1;
      if (this.bossAttempts >= 3) setTimeout(() => this.end("completed"), 750);
      else setTimeout(() => this.spawnBossPhase(), 850);
    } else {
      this.checkRoomDone();
    }
  }
  checkRoomDone() {
    if (!this.roomTransitioning && !this.meanings.some((item) => item.active)) {
      this.roomTransitioning = true;
      const isLastRoom = this.roomIndex >= this.roundWordGroups.length - 1;
      this.setFeedback(isLastRoom ? "第二局完成，正在生成复习结果。" : "本局完成，准备进入下一局。");
      setTimeout(() => this.nextRoom(), 850);
    }
  }
  applyItem(type) {
    this.audio.play("pickup");
    if (type === "fruit") {
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.setFeedback("生命果实：恢复 1 点生命。");
    } else if (type === "shield") {
      this.shield += 1;
      this.setFeedback("护盾：抵挡下一次碰撞。");
    } else if (type === "boots") {
      this.bootsUntil = performance.now() + 9000;
      this.setFeedback("疾跑靴：移动速度短暂提高。");
    } else {
      this.freezeUntil = performance.now() + 3000;
      this.setFeedback("时停闪电：怪物暂停 3 秒。");
    }
  }
  setFeedback(text) {
    this.feedback.textContent = text;
  }
  updateHud(now) {
    const hearts = "♥".repeat(this.hp) + "♡".repeat(Math.max(0, this.maxHp - this.hp));
    const remainingSec = Math.max(0, Math.ceil((this.deadlineAt - now) / 1000));
    this.roomText.textContent = this.roomName.replace(/^第\s*\d\s*局\s*/, "");
    this.roundText.textContent = `第 ${Math.min(this.roomIndex + 1, this.roundWordGroups.length)} / ${this.roundWordGroups.length} 局`;
    this.countdownBadge.textContent = formatClock(remainingSec);
    this.countdownBadge.classList.toggle("is-danger", remainingSec <= URGENT_SECONDS);
    if (remainingSec > 0 && remainingSec <= URGENT_SECONDS && remainingSec !== this.lastUrgentSecond) {
      this.lastUrgentSecond = remainingSec;
      this.audio.play("urgent");
    }
    this.hpText.textContent = hearts;
    this.shieldText.textContent = `护盾 ${this.shield}`;
    this.scoreText.textContent = `能量 ${this.score}`;
    this.comboText.textContent = `连击 ${this.combo}`;
    this.continueText.textContent = `救援 ${this.continues}`;
    if (this.currentTargetId) {
      this.target.textContent = `已携带：${this.currentTargetZh}｜寻找对应英文怪物`;
      this.target.classList.add("is-active");
    } else {
      this.target.textContent = "未携带中文词义";
      this.target.classList.remove("is-active");
    }
  }
  draw(now) {
    const c = this.ctx;
    c.clearRect(0, 0, this.width, this.height);
    if (!this.drawRoomBackground()) {
      c.fillStyle = "#e8f1e9";
      c.fillRect(0, 0, this.width, this.height);
      c.strokeStyle = "#d7e5da";
      c.lineWidth = 1;
      for (let x = 0; x < this.width; x += 48) {
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.height); c.stroke();
      }
      for (let y = 0; y < this.height; y += 48) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(this.width, y); c.stroke();
      }
    }
    c.strokeStyle = "#6d8376";
    c.lineWidth = 4;
    c.strokeRect(14, 14, this.width - 28, this.height - 28);
    this.obstacles.forEach((obs) => {
      if (!this.drawGameSprite(obs.sprite || "mossyStone", obs[0], obs[1] - 16, obs[2] - obs[0], obs[3] - obs[1] + 28)) {
        c.fillStyle = "#8aa094";
        c.strokeStyle = "#60766a";
        c.lineWidth = 2;
        c.fillRect(obs[0], obs[1], obs[2] - obs[0], obs[3] - obs[1]);
        c.strokeRect(obs[0], obs[1], obs[2] - obs[0], obs[3] - obs[1]);
      }
    });
    this.items.filter((item) => item.active).forEach((item) => {
      if (!this.drawGameSprite(item.type, item.x - 25, item.y - 25, 50, 50)) {
        c.fillStyle = "#fef3c7";
        c.strokeStyle = "#f2b84b";
        c.lineWidth = 2;
        circle(c, item.x, item.y, 18);
        c.fill(); c.stroke();
        text(c, item.label, item.x, item.y + 1, 13, "#1f2937", "bold");
      }
    });
    this.projectiles.forEach((projectile) => {
      if (projectile.done && now - projectile.createdAt > 260) return;
      c.save();
      c.translate(projectile.x, projectile.y);
      c.rotate(projectile.weapon === "boomerang" ? projectile.spin : projectile.angle);
      this.drawGameSprite(projectile.weapon, -24, -24, 48, 48);
      c.restore();
    });
    this.meanings.filter((item) => item.active).forEach((item) => {
      roundedRect(c, item.rect[0], item.rect[1], item.rect[2] - item.rect[0], item.rect[3] - item.rect[1], 8, "#ecfeff", "#0891b2");
      text(c, item.zh, (item.rect[0] + item.rect[2]) / 2, (item.rect[1] + item.rect[3]) / 2 + 1, 15, "#1f2937", "bold");
    });
    this.monsters.filter((monster) => monster.alive).forEach((monster) => {
      const rect = monsterRect(monster);
      if (now < monster.flashUntil) {
        roundedRect(c, rect[0] - 4, rect[1] - 4, monster.w + 8, monster.h + 8, 12, "rgba(254,226,226,0.75)", "#d94841", 2);
      }
      if (!this.drawGameSprite(monster.sprite, monster.x - monster.w / 2, monster.y - monster.h * 0.95, monster.w, monster.h * 1.45)) {
        const fill = now < monster.flashUntil ? "#fee2e2" : monster.boss ? "#fef2f2" : "#fff7ed";
        roundedRect(c, rect[0], rect[1], monster.w, monster.h, 8, fill, monster.boss ? "#d94841" : "#f97316", monster.boss ? 3 : 2);
      }
      if (monster.boss) text(c, "BOSS", monster.x, rect[1] - 12, 11, "#d94841", "bold");
      roundedRect(c, rect[0], rect[3] - 18, monster.w, 28, 8, "rgba(255,247,237,0.94)", monster.boss ? "#d94841" : "#f97316", 2);
      text(c, monster.en, monster.x, rect[3] - 4, 15, "#1f2937", "bold", "Segoe UI");
    });
    if (!this.drawHero()) {
      c.fillStyle = "#dbeafe";
      c.strokeStyle = "#2563eb";
      c.lineWidth = 3;
      circle(c, this.player.x, this.player.y, this.player.r);
      c.fill(); c.stroke();
      text(c, "你", this.player.x, this.player.y + 1, 14, "#2563eb", "bold");
    }
    if (this.currentTargetZh) text(c, this.currentTargetZh, this.player.x, this.player.y + 34, 12, "#135c45", "bold");
  }
  drawRoomBackground() {
    if (!this.roomSheet.complete || !ROOM_BACKGROUNDS[this.roomTheme]) return false;
    const [sx, sy, sw, sh] = ROOM_BACKGROUNDS[this.roomTheme];
    const scale = Math.max(this.width / sw, this.height / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (this.width - dw) / 2;
    const dy = (this.height - dh) / 2;
    this.ctx.drawImage(this.roomSheet, sx, sy, sw, sh, dx, dy, dw, dh);
    return true;
  }
  drawHero() {
    if (!this.heroSheet.complete) return false;
    const col = Math.max(0, HERO_ACTIONS.indexOf(this.heroAction));
    const row = HERO_ROWS[this.avatar] ?? 0;
    const sw = this.heroSheet.naturalWidth / 5;
    const sh = this.heroSheet.naturalHeight / 2;
    const w = 72;
    const h = 86;
    const x = this.player.x - w / 2;
    const y = this.player.y - h * 0.72;
    this.ctx.save();
    if (this.facing < 0) {
      this.ctx.translate(this.player.x, 0);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(this.heroSheet, col * sw, row * sh, sw, sh, -w / 2, y, w, h);
    } else {
      this.ctx.drawImage(this.heroSheet, col * sw, row * sh, sw, sh, x, y, w, h);
    }
    this.ctx.restore();
    return true;
  }
  drawGameSprite(name, x, y, w, h, alpha = 1) {
    if (!this.gameplaySheet.complete || !GAMEPLAY_SPRITES[name]) return false;
    const [col, row] = GAMEPLAY_SPRITES[name];
    const sw = this.gameplaySheet.naturalWidth / GAMEPLAY_GRID.cols;
    const sh = this.gameplaySheet.naturalHeight / GAMEPLAY_GRID.rows;
    const oldAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.gameplaySheet, col * sw, row * sh, sw, sh, x, y, w, h);
    this.ctx.globalAlpha = oldAlpha;
    return true;
  }
  end(status) {
    if (!this.running) return;
    if (status === "completed") this.audio.play("win");
    this.destroy();
    const summaries = this.scheduler.summaries();
    const seen = summaries.filter((row) => row.first_result !== "not_seen");
    const firstCorrect = seen.filter((row) => row.first_result === "correct").length;
    const firstAccuracy = seen.length ? firstCorrect / seen.length : 0;
    const responseValues = seen.map((row) => row.response_time_ms).filter(Boolean);
    const avgResponse = responseValues.length ? Math.round(responseValues.reduce((a, b) => a + b, 0) / responseValues.length) : 0;
    const focus = summaries
      .filter((row) => ["建议复习", "重点复习"].includes(row.final_status))
      .sort((a, b) => (b.final_status === "重点复习") - (a.final_status === "重点复习") || b.priority_weight - a.priority_weight)
      .slice(0, 5);
    this.onFinish({
      session_id: uid("session"),
      task_id: this.task.task_id,
      task_name: this.task.task_name,
      player_name: this.playerName,
      start_at: new Date(Date.now() - (performance.now() - this.startedAt)).toLocaleString(),
      end_at: nowText(),
      completion_status: status,
      duration_sec: Math.max(1, Math.round((performance.now() - this.startedAt) / 1000)),
      word_count: this.task.words.length,
      score: this.score,
      first_accuracy: firstAccuracy,
      avg_response_ms: avgResponse,
      correction_success_count: summaries.filter((row) => row.correction_result === "correct").length,
      focus_words: focus,
      word_attempts: this.scheduler.attempts,
      word_summaries: summaries,
    });
  }
}

function renderSettlement() {
  const session = state.currentSession || state.data.sessions[state.data.sessions.length - 1];
  const focusText = session.focus_words.length ? session.focus_words.map((w) => `${w.en}（${w.zh}）`).join("、") : "暂无明显薄弱词";
  const studentReport = buildStudentReport(session);
  return shell(`
    <main class="screen">
      <section class="card">
        <h1 class="page-title">${escapeHtml(session.player_name)}，今天的地牢已完成</h1>
        <p class="muted">${session.completion_status === "completed" ? "已完成" : "未完整完成"}｜复习 ${session.word_count} 词｜用时 ${session.duration_sec} 秒｜分数 ${session.score}</p>
        <div class="settlement-grid">
          <div class="metric">首次正确率<strong>${Math.round(session.first_accuracy * 100)}%</strong></div>
          <div class="metric">二次修正<strong>${session.correction_success_count} 词</strong></div>
        </div>
        <div class="feedback-box">值得再遇见一次：${escapeHtml(focusText)}</div>
        <div class="copy-card">
          <div class="copy-card-head">
            <h2 class="section-title">今日复习报告</h2>
            <button class="small-button" id="copyStudentReport">复制</button>
          </div>
          <pre id="studentReportText">${escapeHtml(studentReport)}</pre>
        </div>
        <table class="word-detail-list">
          <thead><tr><th>英文</th><th>中文</th><th>首次</th><th>平均反应</th><th>标签</th></tr></thead>
          <tbody>
            ${session.word_summaries.map((row) => `
              <tr><td>${escapeHtml(row.en)}</td><td>${escapeHtml(row.zh)}</td><td>${translateResult(row.first_result)}</td><td>${row.response_time_ms ? (row.response_time_ms / 1000).toFixed(1) + "s" : "-"}</td><td>${row.final_status}</td></tr>
            `).join("")}
          </tbody>
        </table>
        <div class="button-row" style="margin-top:16px">
          <button class="ghost-button" id="again">再次挑战</button>
          <button class="primary-button" id="goResults">老师结果页</button>
        </div>
      </section>
    </main>
  `);
}

function bindSettlement() {
  const report = document.querySelector("#studentReportText")?.textContent || "";
  document.querySelector("#copyStudentReport")?.addEventListener("click", () => copyText(report, "今日复习报告已复制。"));
  document.querySelector("#again").addEventListener("click", () => navigate("student"));
  document.querySelector("#goResults").addEventListener("click", () => navigate("results"));
}

function renderResults() {
  const tasks = state.data.tasks;
  const selectedTask = getTask();
  loadSessionsFromCloud(selectedTask.task_id);
  const taskSessions = sessionsFor(selectedTask.task_id);
  return shell(`
    <main class="screen">
      <section class="card">
        <h1 class="page-title">老师结果页</h1>
        <label class="field">
          <span>选择任务</span>
          <select id="resultTask" style="min-height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;background:#fff">
            ${tasks.map((task) => `<option value="${task.task_id}" ${task.task_id === selectedTask.task_id ? "selected" : ""}>${escapeHtml(task.task_name)}（${task.task_id}）</option>`).join("")}
          </select>
        </label>
        ${taskSessions.length ? `
          <p class="muted">点击某个学生记录，可以查看词级详情并复制发给家长的话术。</p>
          <table class="result-table">
            <thead><tr><th>昵称</th><th>完成</th><th>首次正确率</th><th>平均反应</th><th>薄弱词</th><th>完成时间</th></tr></thead>
            <tbody>
              ${taskSessions.map((session) => `
                <tr data-session="${session.session_id}">
                  <td>${escapeHtml(session.player_name)}</td>
                  <td>${session.completion_status}</td>
                  <td>${Math.round(session.first_accuracy * 100)}%</td>
                  <td>${session.avg_response_ms ? (session.avg_response_ms / 1000).toFixed(1) + "s" : "-"}</td>
                  <td>${escapeHtml(session.focus_words.slice(0, 3).map((w) => w.en).join("、") || "-")}</td>
                  <td>${session.end_at}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <div id="sessionDetail" style="margin-top:16px"></div>
        ` : `<div class="empty">尚无人完成任务</div>`}
      </section>
    </main>
  `);
}

function bindResults() {
  document.querySelector("#resultTask").addEventListener("change", (event) => {
    state.taskId = event.target.value;
    state.data.lastTaskId = state.taskId;
    saveData();
    render();
  });
  document.querySelectorAll("[data-session]").forEach((row) => {
    row.addEventListener("click", () => {
      const session = state.data.sessions.find((item) => item.session_id === row.dataset.session);
      const feedbacks = buildTeacherFeedbacks(session);
      document.querySelector("#sessionDetail").innerHTML = `
        <h2 class="section-title">${escapeHtml(session.player_name)} 的词级详情</h2>
        <div class="copy-card teacher-feedback-card">
          <div class="copy-card-head">
            <div>
              <h3>家长反馈话术</h3>
              <p class="muted">可直接复制转发，默认只展开未过关单词。</p>
            </div>
            <div class="copy-actions">
              <select id="feedbackVersion">
                ${feedbacks.map((item, index) => `<option value="${index}">${escapeHtml(item.title)}</option>`).join("")}
              </select>
              <button class="small-button" id="copyTeacherFeedback">复制</button>
            </div>
          </div>
          <textarea id="teacherFeedbackText" readonly>${escapeHtml(feedbacks[0].text)}</textarea>
        </div>
        <table class="word-detail-list">
          <thead><tr><th>英文</th><th>中文</th><th>首次</th><th>错误</th><th>标签</th></tr></thead>
          <tbody>${session.word_summaries.map((item) => `
            <tr><td>${escapeHtml(item.en)}</td><td>${escapeHtml(item.zh)}</td><td>${translateResult(item.first_result)}</td><td>${item.error_count}</td><td>${item.final_status}</td></tr>
          `).join("")}</tbody>
        </table>
      `;
      const feedbackVersion = document.querySelector("#feedbackVersion");
      const feedbackText = document.querySelector("#teacherFeedbackText");
      feedbackVersion.addEventListener("change", () => {
        feedbackText.value = feedbacks[Number(feedbackVersion.value)]?.text || feedbacks[0].text;
      });
      document.querySelector("#copyTeacherFeedback").addEventListener("click", () => {
        copyText(feedbackText.value, "家长反馈话术已复制。");
      });
    });
  });
}

function bindViewSpecific() {
  if (state.view === "teacher") bindTeacher();
  if (state.view === "student") bindStudentGateV2();
  if (state.view === "settlement") bindSettlementV2();
  if (state.view === "results") bindResults();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char]);
}

function translateResult(value) {
  return { correct: "正确", wrong: "错误", timeout: "超时", not_seen: "未出现" }[value] || "-";
}

function splitWordsForRooms(words) {
  if (!words.length) return [];
  const roomCount = Math.min(ROOM_COUNT, words.length);
  const perRoom = Math.ceil(words.length / roomCount);
  return Array.from({ length: roomCount }, (_, index) =>
    words.slice(index * perRoom, (index + 1) * perRoom)
  ).filter((group) => group.length);
}

function roomDurationMs(wordCount) {
  const seconds = clamp(ROOM_BASE_SECONDS + wordCount * ROOM_SECONDS_PER_WORD, ROOM_MIN_SECONDS, ROOM_MAX_SECONDS);
  return seconds * 1000;
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function sessionDate(session) {
  return String(session.end_at || nowText()).slice(0, 10);
}

function isWordPassed(row) {
  return ["稳定", "基本掌握"].includes(row.final_status);
}

function unpassedWords(session) {
  return session.word_summaries.filter((row) => !isWordPassed(row));
}

function wordPassText(row) {
  return isWordPassed(row) ? "已过关" : row.final_status;
}

function buildStudentReport(session) {
  const unpassed = unpassedWords(session);
  const lines = [
    "【Word Dungeon 单词地牢复习结果】",
    `日期：${sessionDate(session)}`,
    `昵称：${session.player_name}`,
    `总单词数：${session.word_count}`,
    `未过关单词数：${unpassed.length}`,
    `首次正确率：${Math.round(session.first_accuracy * 100)}%`,
    `用时：${session.duration_sec} 秒`,
    "",
    "单词过关情况：",
    ...session.word_summaries.map((row, index) =>
      `${index + 1}. ${row.en} - ${row.zh}：${wordPassText(row)}`
    ),
  ];
  return lines.join("\n");
}

function buildTeacherFeedbacks(session) {
  const unpassed = unpassedWords(session);
  const passedCount = Math.max(0, session.word_count - unpassed.length);
  const accuracy = Math.round(session.first_accuracy * 100);
  const weakText = unpassed.length
    ? unpassed.map((row) => `${row.en}（${row.zh}）`).join("、")
    : "本次没有明显未过关单词";
  const avgText = session.avg_response_ms ? `${(session.avg_response_ms / 1000).toFixed(1)} 秒` : "暂无";
  const commonStats = `今天共复习 ${session.word_count} 个单词，已过关 ${passedCount} 个，未过关 ${unpassed.length} 个，首次正确率 ${accuracy}%，平均反应时间 ${avgText}。`;
  return [
    {
      title: "稳健反馈版",
      text: `${session.player_name}小朋友今天完成了 Word Dungeon 单词复习。\n${commonStats}\n需要继续巩固的单词：${weakText}。\n整体完成度不错，建议明天先用 3-5 分钟快速复盘这些词，再进入新的学习内容。`,
    },
    {
      title: "鼓励成长版",
      text: `今天${session.player_name}小朋友在单词地牢里表现很投入。\n${commonStats}\n目前需要再练一练的词是：${weakText}。\n这些词并不是“不会”，而是还需要多见几次。保持今天这种专注度，下一次会更稳。`,
    },
    {
      title: "家校沟通版",
      text: `家长您好，${session.player_name}小朋友今天已完成单词闯关复习。\n${commonStats}\n本次未过关单词：${weakText}。\n今晚可以不用额外拉长学习时间，只需要请孩子口头复述这些词的中文意思，帮助把游戏中的短时记忆转成稳定记忆。`,
    },
  ];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function addObstacleSprites(rects, theme = "office") {
  const pool = OBSTACLE_BY_THEME[theme] || OBSTACLE_BY_THEME.office;
  return rects.map((rect, index) => {
    rect.sprite = pool[Math.floor(Math.random() * pool.length)] || pool[index % pool.length];
    return rect;
  });
}

function rectCenter(rect) {
  return { x: (rect[0] + rect[2]) / 2, y: (rect[1] + rect[3]) / 2 };
}

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }
  unlock() {
    if (!this.enabled || this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  play(name) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.connect(this.ctx.destination);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    const makeOsc = (type, startFreq, endFreq, duration) => {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + duration);
    };

    if (name === "pickup") {
      makeOsc("sine", 520, 880, 0.18);
    } else if (name === "shoot") {
      makeOsc("triangle", 760, 240, 0.16);
    } else if (name === "hit") {
      makeOsc("square", 260, 620, 0.14);
      setTimeout(() => this.play("pickup"), 30);
    } else if (name === "miss") {
      makeOsc("sawtooth", 180, 80, 0.2);
    } else if (name === "hurt") {
      makeOsc("sawtooth", 160, 55, 0.24);
    } else if (name === "urgent") {
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      makeOsc("square", 880, 880, 0.1);
    } else if (name === "timeout") {
      makeOsc("sawtooth", 220, 90, 0.3);
    } else if (name === "win") {
      [440, 660, 880].forEach((freq, index) => {
        const osc = this.ctx.createOscillator();
        const localGain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        localGain.gain.setValueAtTime(0.0001, now + index * 0.12);
        localGain.gain.exponentialRampToValueAtTime(0.1, now + index * 0.12 + 0.01);
        localGain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.22);
        osc.connect(localGain);
        localGain.connect(this.ctx.destination);
        osc.start(now + index * 0.12);
        osc.stop(now + index * 0.12 + 0.24);
      });
    }
  }
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pointInRect(p, rect) {
  return p.x >= rect[0] && p.x <= rect[2] && p.y >= rect[1] && p.y <= rect[3];
}

function overlap(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function playerRect(p) {
  return [p.x - 20, p.y - 20, p.x + 20, p.y + 20];
}

function monsterRect(m) {
  return [m.x - m.w / 2, m.y - m.h / 2, m.x + m.w / 2, m.y + m.h / 2];
}

function circle(c, x, y, r) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
}

function roundedRect(c, x, y, w, h, r, fill, stroke, width = 2) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  c.strokeStyle = stroke;
  c.lineWidth = width;
  c.stroke();
}

function text(c, value, x, y, size, color, weight = "normal", family = '"Microsoft YaHei UI"') {
  c.fillStyle = color;
  c.font = `${weight} ${size}px ${family}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillText(value, x, y);
}

function renderStudentGateV2() {
  const task = getTask(state.taskId, true);
  if (task && state.taskId !== task.task_id) {
    state.taskId = task.task_id;
    state.data.lastTaskId = task.task_id;
    saveData();
  }
  const safeName = escapeHtml(state.playerName || "小勇士");
  const previewWords = (task?.words || []).slice(0, 4);
  return shell(`
    <main class="student-gate dungeon-home">
      <div class="gate-content home-gate-content">
        <section class="dungeon-hero-copy">
          <p class="brand-pill">单词地牢</p>
          <h1 class="gate-title">Word Dungeon</h1>
          <p class="gate-subtitle">看中文线索，选择正确英文，在地牢房间里完成一局词汇挑战。</p>
          <div class="dungeon-word-preview" aria-label="本局单词预览">
            ${previewWords.map((word) => `<span>${escapeHtml(word.en)}</span>`).join("")}
          </div>
          <p class="home-note">本局 ${task?.words.length || 10} 词 · 横屏体验 · 结算后可复制复习结果</p>
        </section>
        <section class="start-panel dungeon-start-panel">
          <label class="field">
            <span>你的昵称</span>
            <input id="playerName" maxlength="12" value="${safeName}" />
          </label>
          <div>
            <strong>选择你的勇士</strong>
            <div class="avatar-grid" id="avatarGrid">
              ${[
                ["boy", "男勇士"],
                ["girl", "女勇士"],
              ].map(([id, label]) => `
                <button class="avatar-choice ${state.avatar === id ? "is-active" : ""}" data-avatar="${id}">
                  <span class="avatar-face avatar-${id}"></span>
                  <span class="avatar-label">${label}</span>
                </button>
              `).join("")}
            </div>
          </div>
          <button class="primary-button start-wide" id="startGameButton">开始3分钟挑战</button>
          <p id="studentStatus" class="status">${escapeHtml(task?.task_name || "示例任务")} · 准备进入地牢</p>
        </section>
      </div>
    </main>
  `, { hideNav: true });
}

function bindStudentGateV2() {
  document.querySelector("#playerName")?.addEventListener("input", (event) => {
    state.playerName = event.target.value.trim() || "小勇士";
    localStorage.setItem("wordDungeonPlayerName", state.playerName);
  });
  document.querySelectorAll("[data-avatar]").forEach((button) => {
    button.addEventListener("click", () => {
      state.avatar = button.dataset.avatar;
      localStorage.setItem("wordDungeonHero", state.avatar);
      document.querySelectorAll("[data-avatar]").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
  document.querySelector("#startGameButton")?.addEventListener("click", () => {
    const task = getTask(state.taskId, true);
    if (!task) {
      document.querySelector("#studentStatus").textContent = "暂时没有可用词汇，请刷新页面后再试。";
      return;
    }
    state.taskId = task.task_id;
    state.data.lastTaskId = task.task_id;
    state.playerName = document.querySelector("#playerName").value.trim() || "小勇士";
    localStorage.setItem("wordDungeonPlayerName", state.playerName);
    saveData();
    state.view = "game";
    render();
  });
}

function isWordPassedV2(row) {
  return ["稳定", "基本掌握", "已过关"].includes(row.final_status);
}

function unpassedWordsV2(session) {
  return session.word_summaries.filter((row) => !isWordPassedV2(row));
}

function wordPassTextV2(row) {
  return isWordPassedV2(row) ? "已过关" : "重点复习";
}

function buildStudentReportV2(session) {
  const unpassed = unpassedWordsV2(session);
  const lines = [
    "【Word Dungeon 单词地牢复习结果】",
    `日期：${sessionDate(session)}`,
    `昵称：${session.player_name}`,
    `总单词数：${session.word_count}`,
    `未过关单词数：${unpassed.length}`,
    `首次正确率：${Math.round(session.first_accuracy * 100)}%`,
    `用时：${session.duration_sec} 秒`,
    "",
    "单词过关情况：",
    ...session.word_summaries.map((row, index) =>
      `${index + 1}. ${row.en} - ${row.zh}：${wordPassTextV2(row)}`
    ),
  ];
  return lines.join("\n");
}

function renderSettlementV2() {
  const session = state.currentSession || state.data.sessions[state.data.sessions.length - 1];
  if (!session) {
    return shell(`
      <main class="screen">
        <section class="card">
          <h1 class="page-title">还没有生成复习结果</h1>
          <button class="primary-button" id="again">返回开始页</button>
        </section>
      </main>
    `, { hideNav: true });
  }
  const report = buildStudentReportV2(session);
  const unpassedCount = unpassedWordsV2(session).length;
  return shell(`
    <main class="screen settlement-screen">
      <section class="card result-card">
        <p class="brand-pill">学习结算</p>
        <h1 class="page-title">${escapeHtml(session.player_name)}，今天的地牢挑战完成啦</h1>
        <div class="settlement-grid unified-result-grid">
          <div class="metric">完成词数<strong>${session.word_count - unpassedCount}/${session.word_count}</strong></div>
          <div class="metric">未过关<strong>${unpassedCount}</strong></div>
          <div class="metric">首次正确率<strong>${Math.round(session.first_accuracy * 100)}%</strong></div>
          <div class="metric">用时<strong>${session.duration_sec} 秒</strong></div>
          <div class="metric">分数<strong>${session.score}</strong></div>
        </div>
        <div class="copy-card">
          <div class="copy-card-head">
            <h2 class="section-title">今日复习报告</h2>
            <button class="small-button" id="copyStudentReport">复制</button>
          </div>
          <pre id="studentReportText">${escapeHtml(report)}</pre>
        </div>
        <div class="button-row result-button-row">
          <button class="ghost-button" id="again">再来一局</button>
          <button class="primary-button" id="backHome">返回开始页</button>
        </div>
      </section>
    </main>
  `, { hideNav: true });
}

function bindSettlementV2() {
  const report = document.querySelector("#studentReportText")?.textContent || "";
  document.querySelector("#copyStudentReport")?.addEventListener("click", () => copyText(report, "今日复习报告已复制。"));
  document.querySelector("#again")?.addEventListener("click", () => navigate("student"));
  document.querySelector("#backHome")?.addEventListener("click", () => navigate("student"));
}

function boot() {
  routeFromUrl();
  render();
}

const originalRender = render;
render = function rerender() {
  originalRender();
  bindViewSpecific();
};

window.addEventListener("hashchange", () => {
  routeFromUrl();
  render();
});

boot();
