/* 刷题版块：CMExam 数据（window.QUIZ 索引 + quiz-q/*.js 分片）→ 按人体系统 / 难度 / 题型筛题
   66k 题放在一个文件里会有 40 MB+，所以按系统分片，选中哪个系统才注入哪个分片的 <script>。 */
(function () {
  "use strict";
  var D = window.QUIZ;
  var SYS = D.systems, COUNTS = D.counts, CHUNKS = D.chunks;
  var KEY = "m1quiz.v1";
  var LS = load();

  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(KEY));
      if (!o || !o.r) o = { r: {} };
      if (!o.c) o.c = {};
      return o;
    } catch (e) { return { r: {}, c: {} }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(LS)); } catch (e) {} }

  var QS = [];              // 已载入的题（全局扁平数组）
  var loaded = {}, loading = {}, queue = [], isLoading = false, loadedChunks = 0;
  var S = { sys: 0, diffs: {}, types: {}, kw: "", mode: "seq", deck: [], pos: 0, sel: [], graded: false };

  var $ = function (id) { return document.getElementById(id); };
  var card = $("card"), LETTERS = "ABCDE", TOTAL = COUNTS.reduce(function (a, b) { return a + b; }, 0);

  $("src").textContent = "CMExam · " + TOTAL + " 题 · 按人体系统归类";

  /* ---------- 分片加载 ---------- */
  function loadHint() {
    var el = $("loaded");
    if (el) el.textContent = "已载入 " + loadedChunks + " / " + Object.keys(CHUNKS).length + " 组";
  }
  function mergeChunk(si) {
    var rows = (window.QCH || {})[si];
    if (!rows) return;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];                       // [id, diff, type, q, opts, ans, exp, dept, disc, comp, grp]
      QS.push([r[0], si, r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]]);
    }
    loaded[si] = 1; loadedChunks++;
  }
  function pump() {
    loadHint();
    if (isLoading || !queue.length) return;
    var si = queue.shift();
    if (loaded[si]) { loading[si] = 0; pump(); return; }
    isLoading = true;
    var s = document.createElement("script");
    s.src = CHUNKS[si];
    s.onload = function () {
      mergeChunk(si); isLoading = false; loading[si] = 0;
      buildDeck(true); pump();
    };
    s.onerror = function () {
      isLoading = false; loading[si] = 0;
      card.innerHTML = '<div class="empty">题库分片加载失败：' + CHUNKS[si] + "<br>请确认 <code>quiz-q/</code> 目录与本页在同一文件夹。</div>";
      pump();
    };
    document.head.appendChild(s);
  }
  function ensure(sis, then) {
    var need = 0;
    sis.forEach(function (si) {
      if (loaded[si] || loading[si]) return;
      loading[si] = 1; queue.push(si); need++;
    });
    if (then) afterEnsure.push(then);
    if (need) pump(); else flushEnsure();
  }
  var afterEnsure = [];
  function flushEnsure() {
    if (queue.length || isLoading) return;
    var fns = afterEnsure.slice(); afterEnsure = [];
    fns.forEach(function (f) { f(); });
  }

  /* ---------- 侧栏 ---------- */
  function renderSys() {
    var html = '<li data-sys="-1" class="' + (S.sys === -1 ? "on" : "") + '">全部系统<span class="n">' + TOTAL + "</span></li>";
    for (var i = 0; i < SYS.length; i++) {
      if (!COUNTS[i]) continue;
      html += '<li data-sys="' + i + '" class="' + (S.sys === i ? "on " : "") + (SYS[i][2] === "cross" ? "cross" : "") + '">' +
        SYS[i][1] + '<span class="n">' + COUNTS[i] + "</span></li>";
    }
    $("sysList").innerHTML = html;
  }
  function renderDiff() {
    var names = ["", "★ 易", "★★ 较易", "★★★ 中", "★★★★ 较难", "★★★★★ 难"];
    var h = "";
    for (var d = 1; d <= 5; d++) h += '<span data-d="' + d + '" class="' + (S.diffs[d] ? "on" : "") + '">' + names[d] + "</span>";
    h += '<span data-d="0" class="' + (S.diffs[0] ? "on" : "") + '">未标注</span>';
    $("diffChips").innerHTML = h;
  }
  function renderType() {
    $("typeChips").innerHTML =
      '<span data-t="1" class="' + (S.types[1] ? "on" : "") + '">单选</span>' +
      '<span data-t="2" class="' + (S.types[2] ? "on" : "") + '">多选</span>';
  }

  /* ---------- 题池 ---------- */
  function filtered() {
    var out = [];
    for (var i = 0; i < QS.length; i++) {
      var q = QS[i];
      if (S.sys !== -1 && q[1] !== S.sys) continue;
      if (Object.keys(S.diffs).length) {
        if (S.diffs[0]) { if (q[2] !== null) continue; }
        else if (!q[2] || !S.diffs[q[2]]) continue;
      }
      if (Object.keys(S.types).length && !S.types[q[3]]) continue;
      if (S.kw && (q[4] + " " + q[7]).toLowerCase().indexOf(S.kw) < 0) continue;
      out.push(i);
    }
    return out;
  }

  function buildDeck(keepPos) {
    var base = filtered();
    if (S.mode === "wrong") base = base.filter(function (i) { return LS.r[QS[i][0]] === 0; });
    else if (S.mode === "undone") base = base.filter(function (i) { return LS.r[QS[i][0]] === undefined; });
    else if (S.mode === "rand") {
      var pool = base.slice();
      for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      base = pool.slice(0, 20);
    } else {
      base = base.slice().sort(function (a, b) { return QS[a][1] - QS[b][1] || QS[a][0] - QS[b][0]; });
    }
    S.deck = base;
    if (!keepPos) S.pos = 0;
    if (S.pos >= S.deck.length) S.pos = Math.max(0, S.deck.length - 1);
    S.sel = []; S.graded = false;
    render();
  }

  /* ---------- 渲染 ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function render() {
    renderSys(); renderDiff(); renderType();
    var pool = S.deck.length;
    $("pool").textContent = pool;
    var doneN = 0, okN = 0;
    for (var i = 0; i < S.deck.length; i++) {
      var v = LS.r[QS[S.deck[i]][0]];
      if (v !== undefined) { doneN++; if (v === 1) okN++; }
    }
    $("done").textContent = doneN;
    $("acc").textContent = doneN ? Math.round((okN / doneN) * 100) + "%" : "—";
    var pct = pool ? Math.round((doneN / pool) * 100) : 0;
    $("progBar").style.width = pct + "%";
    $("progTxt").textContent = pct + "%";
    $("pos").textContent = pool ? (S.pos + 1) + " / " + pool : "—";
    $("prev").disabled = S.pos <= 0;
    $("next").disabled = S.pos >= pool - 1;
    loadHint();

    if (!pool) {
      card.innerHTML = '<div class="empty">' +
        (queue.length || isLoading ? "正在载入题库…" : "这个筛选条件下没有题目。<br>换个系统、放宽难度，或切换刷题模式。") +
        "</div>";
      return;
    }
    var q = QS[S.deck[S.pos]];
    var qid = q[0], prev = LS.r[qid];
    S.graded = prev !== undefined;
    if (S.graded) S.sel = (LS.c[qid] || []).slice(); else S.sel = [];

    var tags = '<span class="tag sys">' + esc(SYS[q[1]][1]) + "</span>";
    if (q[2]) tags += '<span class="tag d' + q[2] + '">' + "★".repeat(q[2]) + " 难度 " + q[2] + "</span>";
    else tags += '<span class="tag">难度未标注</span>';
    tags += q[3] === 2 ? '<span class="tag multi">多选</span>' : '<span class="tag">单选</span>';
    if (D.depts[q[8]]) tags += '<span class="tag">' + esc(D.depts[q[8]]) + "</span>";
    if (D.discs[q[9]]) tags += '<span class="tag">' + esc(D.discs[q[9]]) + "</span>";
    if (D.comps[q[10]]) tags += '<span class="tag">' + esc(D.comps[q[10]]) + "</span>";

    var opts = "";
    for (var k = 0; k < q[5].length; k++) {
      var cls = "opt";
      if (S.graded) {
        if (q[6].indexOf(k) >= 0) cls += " ok lock";
        else if (prev === 0 && S.sel.indexOf(k) >= 0) cls += " bad lock";
        else cls += " lock";
      } else if (S.sel.indexOf(k) >= 0) cls += " sel";
      opts += '<li class="' + cls + '" data-k="' + k + '"><span class="k">' + LETTERS[k] + "</span><span>" + esc(q[5][k]) + "</span></li>";
    }

    var verdict = "";
    if (S.graded) {
      var mine = S.sel.length ? S.sel.map(function (i) { return LETTERS[i]; }).join("") : "未选";
      verdict = '<div class="verdict show ' + (prev === 1 ? "good" : "bad") + '">' +
        (prev === 1 ? "✅ 回答正确" : "❌ 回答错误") +
        "　你的答案：<b>" + mine + "</b>　正确答案：<b>" + q[6].map(function (i) { return LETTERS[i]; }).join("") + "</b>" +
        (q[7] ? '<div class="exp"><span class="lab">解析</span>' + esc(q[7]) + "</div>" : '<div class="exp"><span class="lab">解析</span>数据集未提供解析。</div>') +
        "</div>";
    }

    card.innerHTML =
      '<div class="qtag">' + tags + "</div>" +
      '<p class="qtext">' + esc(q[4]) + "</p>" +
      '<ul class="opts" id="opts">' + opts + "</ul>" +
      (q[3] === 2 && !S.graded ? '<button class="submit show" id="submit">提交答案</button>' : "") +
      verdict +
      '<div class="meta"><span>题号 #' + qid + "</span>" +
      (D.grps[q[11]] ? "<span>疾病分组：" + esc(D.grps[q[11]]) + "</span>" : "") +
      "<span>来源：CMExam（Apache-2.0）</span></div>";
  }

  /* ---------- 作答 ---------- */
  function pick(k) {
    if (S.graded) return;
    var q = QS[S.deck[S.pos]];
    if (q[3] === 2) {
      var i = S.sel.indexOf(k);
      if (i >= 0) S.sel.splice(i, 1); else S.sel.push(k);
      var li = document.querySelectorAll("#opts li");
      for (var n = 0; n < li.length; n++) li[n].classList.toggle("sel", S.sel.indexOf(n) >= 0);
    } else { S.sel = [k]; grade(); }
  }
  function grade() {
    if (S.graded) return;
    var q = QS[S.deck[S.pos]];
    if (!S.sel.length) return;
    var ok = S.sel.length === q[6].length && S.sel.every(function (v) { return q[6].indexOf(v) >= 0; });
    LS.r[q[0]] = ok ? 1 : 0;
    LS.c[q[0]] = S.sel.slice().sort(function (a, b) { return a - b; });
    save(); render();
  }
  function go(d) {
    if (S.pos + d < 0 || S.pos + d >= S.deck.length) return;
    S.pos += d; S.sel = []; S.graded = false; render();
  }

  /* ---------- 事件 ---------- */
  $("sysList").addEventListener("click", function (e) {
    var li = e.target.closest("li"); if (!li) return;
    S.sys = Number(li.dataset.sys);
    if (S.sys === -1) {
      var all = Object.keys(CHUNKS).map(Number);
      card.innerHTML = '<div class="empty">正在载入全部题库（' + Math.round(TOTAL / 1000) + "k 题）…</div>";
      ensure(all, function () { buildDeck(); });
      renderSys();
    } else {
      ensure([S.sys], function () { buildDeck(); });
      render();
    }
  });
  $("modes").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    S.mode = b.dataset.mode;
    Array.prototype.forEach.call(this.children, function (x) { x.classList.toggle("on", x === b); });
    buildDeck();
  });
  $("diffChips").addEventListener("click", function (e) {
    var s = e.target.closest("span"); if (!s) return;
    var d = Number(s.dataset.d);
    if (S.diffs[d]) delete S.diffs[d];
    else { S.diffs = {}; S.diffs[d] = 1; }
    buildDeck();
  });
  $("typeChips").addEventListener("click", function (e) {
    var s = e.target.closest("span"); if (!s) return;
    var t = Number(s.dataset.t);
    if (S.types[t]) delete S.types[t]; else S.types[t] = 1;
    buildDeck();
  });
  $("q").addEventListener("input", function () {
    S.kw = this.value.trim().toLowerCase(); buildDeck();
  });
  $("reset").addEventListener("click", function () {
    if (!confirm("清空所有作答记录？")) return;
    LS = { r: {}, c: {} }; save(); buildDeck();
  });
  $("prev").addEventListener("click", function () { go(-1); });
  $("next").addEventListener("click", function () { go(1); });
  card.addEventListener("click", function (e) {
    var li = e.target.closest("#opts li");
    if (li) { pick(Number(li.dataset.k)); return; }
    if (e.target.id === "submit") grade();
  });
  document.addEventListener("keydown", function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") { go(-1); return; }
    if (e.key === "ArrowRight") { go(1); return; }
    if (e.key === "Enter") {
      if (!S.graded) {
        var q = QS[S.deck[S.pos]];
        if (q && q[3] === 2) grade(); else go(1);
      } else go(1);
      return;
    }
    var m = /^[a-eA-E1-5]$/.exec(e.key);
    if (m) {
      var ch = m[0].toLowerCase();
      pick(ch >= "a" ? ch.charCodeAt(0) - 97 : Number(ch) - 1);
    }
  });

  /* ---------- 启动：先载入当前系统（默认神经系统） ---------- */
  renderSys(); renderDiff(); renderType();
  card.innerHTML = '<div class="empty">正在载入「' + SYS[S.sys][1] + "」题库…</div>";
  ensure([S.sys], function () { buildDeck(); });
})();
