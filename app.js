/* 模块1 复习笔记 · 单页应用（无依赖，file:// 直接可用） */
(function () {
  "use strict";
  const D = window.NOTES || { meta: {}, modules: [] };
  const LS = {
    prog: "m1notes.progress.v1",
    done: "m1notes.kpdone.v1",
  };
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const esc = (s) => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // 扁平化
  const flat = [];
  (D.modules || []).forEach((m) => (m.weeks || []).forEach((w) => (w.kps || []).forEach((k) => {
    flat.push({ kp: k, week: w, mod: m });
  })));
  const byId = new Map(flat.map((x) => [x.kp.id, x]));
  const LEVELS = ["掌握", "熟悉", "理解", "了解"];

  // 进度
  let kpDone = load(LS.done, {});
  let answerScore = load(LS.prog, {});
  let cur = null;
  let onlyHot = false;
  let query = "";

  function updateSidebarState() {
    const done = flat.filter((x) => kpDone[x.kp.id]).length;
    document.getElementById("progText").textContent = `${done} / ${flat.length} 已复习`;
    document.getElementById("progBar").style.width = flat.length ? (done / flat.length * 100) + "%" : "0";
  }

  function tagHtml(tags) {
    return (tags || []).map((t) => {
      let cls = "tag sub";
      if (t === "高频考点" || t === "高频") cls = "tag hot";
      else if (LEVELS.includes(t)) cls = "tag lv-" + t;
      return `<span class="${cls}">${esc(t)}</span>`;
    }).join("");
  }

  // ---------- 侧栏 ----------
  function renderTree() {
    const tree = document.getElementById("tree");
    tree.innerHTML = "";
    (D.modules || []).forEach((m) => {
      const md = document.createElement("div");
      md.className = "mod";
      const mbtn = document.createElement("button");
      mbtn.innerHTML = `<span class="tw open">▸</span>${esc(m.title)}`;
      md.appendChild(mbtn);
      const mwrap = document.createElement("div");

      (m.weeks || []).forEach((w) => {
        const wd = document.createElement("div");
        wd.className = "week";
        const wbtn = document.createElement("button");
        wbtn.innerHTML = `<span class="tw open">▸</span>${esc(w.title)}`;
        wd.appendChild(wbtn);
        const wwrap = document.createElement("div");

        (w.kps || []).forEach((k, i) => {
          const b = document.createElement("button");
          b.className = "kp";
          b.dataset.id = k.id;
          b.dataset.hot = (k.tags || []).some((t) => t === "高频考点" || t === "高频") ? "1" : "";
          b.innerHTML = `<span class="dot"></span><span class="n">${String(i + 1).padStart(2, "0")}</span>${esc(k.title)}`;
          b.addEventListener("click", () => go(k.id));
          wwrap.appendChild(b);
        });

        wbtn.addEventListener("click", () => {
          wwrap.hidden = !wwrap.hidden;
          wbtn.querySelector(".tw").classList.toggle("open", !wwrap.hidden);
        });
        wd.appendChild(wwrap);
        mwrap.appendChild(wd);
      });

      mbtn.addEventListener("click", () => {
        mwrap.hidden = !mwrap.hidden;
        mbtn.querySelector(".tw").classList.toggle("open", !mwrap.hidden);
      });
      md.appendChild(mwrap);
      tree.appendChild(md);
    });
    applyFilter();
    markActive();
    updateSidebarState();
  }

  function markActive() {
    document.querySelectorAll(".kp").forEach((el) => {
      el.classList.toggle("active", cur && el.dataset.id === cur.id);
      el.classList.toggle("done", !!kpDone[el.dataset.id]);
      if (cur && el.dataset.id === cur.id && el.scrollIntoView) {
        el.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function applyFilter() {
    const q = query.trim().toLowerCase();
    document.querySelectorAll(".kp").forEach((el) => {
      const item = byId.get(el.dataset.id);
      let ok = true;
      if (onlyHot && el.dataset.hot !== "1") ok = false;
      if (ok && q) {
        const hay = [item.kp.title, item.kp.one, ...(item.kp.tags || []),
          ...(item.kp.points || []).map((p) => (p.t || "") + " " + (p.s || "")),
          ...(item.kp.quiz || []).map((x) => x.q)].join(" ").toLowerCase();
        ok = hay.indexOf(q) >= 0;
      }
      el.classList.toggle("hide", !ok);
    });
    // 折叠状态：有命中就展开
    document.querySelectorAll(".mod, .week").forEach((wrap) => {
      const kids = wrap.querySelectorAll(".kp");
      if (!kids.length) return;
      const visible = [...kids].some((x) => !x.classList.contains("hide"));
      const body = wrap.querySelector("div");
      if (body) body.hidden = !visible;
      const tw = wrap.querySelector(".tw");
      if (tw) tw.classList.toggle("open", visible);
    });
  }

  // ---------- 内容 ----------
  function renderKp(item) {
    const { kp, week, mod } = item;
    const main = document.getElementById("main");
    const idx = flat.findIndex((x) => x.kp.id === kp.id);
    const prev = flat[idx - 1], next = flat[idx + 1];

    const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<em>$1</em>").replace(/`(.+?)`/g, "<code>$1</code>");

    const pts = (kp.points || []).map((p) => {
      return `<li>${fmt(p.t)}${p.s ? `<span class="src">${esc(p.s)}</span>` : ""}</li>`;
    }).join("");

    // 对比表：适合「几个受体/几种病/几种药」的横向对照
    const tables = (kp.tables || []).map((t) => `
      <div class="tblwrap">
        ${t.title ? `<div class="tbltitle">${fmt(t.title)}</div>` : ""}
        <table class="cmp">
          <thead><tr>${(t.head || []).map((h) => `<th>${fmt(h)}</th>`).join("")}</tr></thead>
          <tbody>${(t.rows || []).map((r) => `<tr>${r.map((c) => `<td>${c === "" ? "—" : fmt(c)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        ${t.note ? `<div class="tblnote">${fmt(t.note)}</div>` : ""}
        ${t.from ? `<div class="tblfrom">来源：${esc(t.from)}</div>` : ""}
      </div>`).join("");

    const figs = (kp.figs || []).map((f, i) =>
      `<figure><img loading="lazy" src="${esc(f.src)}" alt="${esc(f.cap || '')}" data-cap="${esc(f.cap || '')}">
       <figcaption>${esc(f.cap || "")}${f.from ? ` · <span style="color:#9aa5b1">${esc(f.from)}</span>` : ""}</figcaption></figure>`
    ).join("");

    const quiz = (kp.quiz || []).map((q, qi) => {
      const opts = (q.o || []).map((o, oi) =>
        `<button class="opt" data-q="${qi}" data-o="${oi}"><span class="k">${"ABCDE"[oi]}</span><span>${esc(o)}</span></button>`
      ).join("");
      return `<div class="q" data-q="${qi}">
        <div class="qhead"><div class="qt"><span class="no">${qi + 1}.</span>${esc(q.q)}</div></div>
        <div class="opts">${opts}</div>
        <div class="ans"><div class="why"><b>答案：</b>${"ABCDE"[q.a]}　${esc(q.why || "")}</div>
        <div class="from">出处：${esc(q.src || "自编")}</div></div>
      </div>`;
    }).join("");

    main.innerHTML = `
      <div class="crumb">${esc(mod.title)} · <b>${esc(week.title)}</b></div>
      <h2 class="kpt">${esc(kp.title)}</h2>
      <div class="tags">${tagHtml(kp.tags)}</div>
      ${kp.one ? `<div class="one">${esc(kp.one).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")}</div>` : ""}
      ${pts ? `<section class="block"><h3>要点</h3><ul class="pts">${pts}</ul></section>` : ""}
      ${tables ? `<section class="block"><h3>对比表</h3>${tables}</section>` : ""}
      ${figs ? `<section class="block"><h3>配图</h3>${figs}</section>` : ""}
      ${quiz ? `<section class="block"><h3>练习（${(kp.quiz || []).length} 题）</h3>
        <div class="score" id="score"></div><div class="quiz">${quiz}</div></section>` : ""}
      <button class="donebtn ${kpDone[kp.id] ? "on" : ""}" id="donebtn">${kpDone[kp.id] ? "✓ 已复习" : "标记为已复习"}</button>
      <div style="display:flex;gap:10px;margin-top:14px">
        ${prev ? `<button class="donebtn" data-go="${esc(prev.kp.id)}">← ${esc(prev.kp.title)}</button>` : ""}
        ${next ? `<button class="donebtn" data-go="${esc(next.kp.id)}">${esc(next.kp.title)} →</button>` : ""}
      </div>`;

    // 答题交互
    const scoreEl = document.getElementById("score");
    const answered = answerScore[kp.id] || {};
    const total = (kp.quiz || []).length;

    function paintScore() {
      if (!total) { scoreEl.style.display = "none"; return; }
      const right = Object.values(answered).filter((v) => v === 1).length;
      const wrong = Object.values(answered).filter((v) => v === 2).length;
      scoreEl.innerHTML = `共 ${total} 题 ｜ 答对 <b>${right}</b> ｜ 答错 <span style="color:var(--hot)">${wrong}</span> ｜ 未答 ${total - right - wrong}`;
    }

    main.querySelectorAll(".opt").forEach((btn) => {
      const qi = +btn.dataset.q, oi = +btn.dataset.o;
      const q = kp.quiz[qi];
      const qEl = btn.closest(".q");
      // 已有记录则回放
      if (answered[qi]) {
        if (oi === q.a) btn.classList.add("reveal-ok");
        if (answered[qi] === 2 && oi !== q.a && btn.classList.contains("pick")) btn.classList.add("pick-bad");
        qEl.querySelector(".ans").classList.add("show");
      }
      btn.addEventListener("click", () => {
        if (qEl.dataset.locked) return;
        qEl.dataset.locked = "1";
        const ok = oi === q.a;
        btn.classList.add(ok ? "pick-ok" : "pick-bad");
        if (!ok) qEl.querySelectorAll(".opt")[q.a].classList.add("reveal-ok");
        qEl.querySelector(".ans").classList.add("show");
        answered[qi] = ok ? 1 : 2;
        answerScore[kp.id] = answered; save(LS.prog, answerScore);
        paintScore();
      });
    });

    document.getElementById("donebtn").addEventListener("click", (e) => {
      kpDone[kp.id] = !kpDone[kp.id];
      save(LS.done, kpDone);
      e.target.classList.toggle("on", kpDone[kp.id]);
      e.target.textContent = kpDone[kp.id] ? "✓ 已复习" : "标记为已复习";
      markActive(); updateSidebarState();
    });
    main.querySelectorAll("[data-go]").forEach((b) =>
      b.addEventListener("click", () => go(b.dataset.go)));

    paintScore();
    // 图片放大
    main.querySelectorAll("figure img").forEach((img) => {
      img.addEventListener("click", () => {
        const lb = document.getElementById("lightbox");
        lb.querySelector("img").src = img.src;
        lb.querySelector(".lb-cap").textContent = img.dataset.cap || "";
        lb.hidden = false;
      });
    });
    main.scrollTop = 0;
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  function go(id) {
    const item = byId.get(id);
    if (!item) return;
    cur = item;
    location.hash = "#" + id;
    renderKp(item);
    markActive();
    document.title = item.kp.title + " · 模块1 复习笔记";
  }

  // ---------- 顶部工具 ----------
  document.getElementById("q").addEventListener("input", (e) => {
    query = e.target.value;
    applyFilter();
  });
  const hotBtn = document.getElementById("onlyHot");
  hotBtn.addEventListener("click", () => {
    onlyHot = !onlyHot;
    hotBtn.classList.toggle("on", onlyHot);
    applyFilter();
  });
  document.getElementById("resetProg").addEventListener("click", () => {
    if (!confirm("清空所有复习进度与答题记录？")) return;
    kpDone = {}; answerScore = {};
    save(LS.done, kpDone); save(LS.prog, answerScore);
    markActive(); updateSidebarState();
    if (cur) renderKp(cur);
  });
  document.getElementById("lightbox").addEventListener("click", (e) => {
    if (e.target.id === "lightbox" || e.target.tagName === "IMG") e.currentTarget.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;
    const i = flat.findIndex((x) => x.kp.id === (cur && cur.kp.id));
    if (e.key === "ArrowRight" && flat[i + 1]) go(flat[i + 1].kp.id);
    if (e.key === "ArrowLeft" && flat[i - 1]) go(flat[i - 1].kp.id);
    if (e.key === "Escape") document.getElementById("lightbox").hidden = true;
  });
  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (id && byId.has(id) && (!cur || cur.kp.id !== id)) go(id);
  });

  // ---------- 启动 ----------
  const totalQ = flat.reduce((a, x) => a + ((x.kp.quiz || []).length), 0);
  document.getElementById("meta").textContent =
    `${flat.length} 个知识点 · ${totalQ} 道练习 · 数据：${(D.meta && D.meta.generated) || ""}`;
  renderTree();
  const id = location.hash.slice(1);
  if (id && byId.has(id)) go(id);
  else if (flat.length) go(flat[0].kp.id);
})();
