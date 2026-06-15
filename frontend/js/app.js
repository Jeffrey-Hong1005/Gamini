/* ============================================================
   Gamini — 프론트엔드 로직
   /api/games 의 실제 게임 데이터로 포털을 렌더링하고,
   카드 클릭 시 iframe 모달로 게임을 실행한다.
   ============================================================ */

const state = {
  games: [],
  cat: "전체",
  search: "",
  heroIndex: 0,
  limit: 12, // 전체게임 그리드 초기 표시 개수
};

// ── 데이터 로드 ────────────────────────────────────────
async function loadGames() {
  try {
    const res = await fetch("/api/games");
    const data = await res.json();
    state.games = data.games || [];
  } catch (err) {
    console.error("게임 목록 로드 실패:", err);
    state.games = [];
  }
  render();
}

// ── 부분 렌더 헬퍼 ─────────────────────────────────────
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function thumb(game) {
  if (game.thumbnail) {
    return `<div class="thumb sk"><img src="${esc(game.thumbnail)}" alt="${esc(game.title)}"
      onerror="this.parentNode.classList.add('ph','hatch','x');this.remove();" />
      <div class="play-hint"><span>▶ 플레이</span></div></div>`;
  }
  return `<div class="thumb ph hatch x">게임 썸네일<div class="play-hint"><span>▶ 플레이</span></div></div>`;
}

function card(game) {
  const tags = (game.tags || []).slice(0, 3).map((t) => `<span class="tag">#${esc(t)}</span>`).join(" ");
  return `<div class="card sk tilt" data-id="${esc(game.id)}">
    ${thumb(game)}
    <div class="name">${esc(game.title)}</div>
    <div class="tags">${tags}</div>
  </div>`;
}

// ── 전체 렌더 ──────────────────────────────────────────
function render() {
  const app = document.getElementById("app");
  if (!state.games.length) {
    app.innerHTML = siteHead() + searchBar() +
      `<div class="sec"><div class="empty">아직 등록된 게임이 없어요. 곧 추가됩니다! 🎮</div></div>`;
    bindHeader();
    return;
  }
  app.innerHTML = siteHead() + searchBar() + heroSection() + recommendedSection() + allGamesSection();
  bindHeader();
  bindCards();
  bindHero();
  bindCats();
  bindRec();
  bindMore();
}

function siteHead() {
  const items = ["홈", "게임", "랭킹", "이벤트", "커뮤니티"];
  return `<div class="site-head">
    <div class="logo" id="homeLogo">Gamini<span class="dot">.</span></div>
    <div class="nav">${items.map((x, i) => `<span class="${i === 1 ? "active" : ""}">${x}</span>`).join("")}</div>
    <div class="head-right">
      <span class="pill tilt" id="searchToggle">🔍 검색</span>
      <span id="authArea">
        <span class="btn tilt" id="signupBtn">회원가입</span>
        <span class="btn go tilt" id="loginBtn">로그인</span>
      </span>
    </div>
  </div>`;
}

function searchBar() {
  return `<div class="searchbar" id="searchBar">
    <input type="text" id="searchInput" placeholder="게임 이름·장르·태그로 검색…" value="${esc(state.search)}" />
  </div>`;
}

function heroSection() {
  // 추천(featured) 게임 우선, 없으면 전체에서
  const heroes = state.games.filter((g) => g.featured);
  const list = heroes.length ? heroes : state.games;
  if (state.heroIndex >= list.length) state.heroIndex = 0;
  const h = list[state.heroIndex];
  const bg = h.banner || h.thumbnail;

  const thumbs = list.map((g, i) => `<div class="ht ${i === state.heroIndex ? "on" : ""}" data-hi="${i}">
    <small>${esc(g.heroTag || g.subtitle || (g.isNew ? "신작" : "추천"))}</small><b>${esc(g.title)}</b></div>`).join("");

  return `<div class="sec">
    <div class="hero sk">
      <div class="hero-ph ph hatch">
        ${bg ? `<img src="${esc(bg)}" alt="" onerror="this.remove()" /><div class="hero-shade"></div>` : ""}
        <div class="hero-copy">
          <span class="kick pill on">${esc(h.heroTag || (h.isNew ? "신작 출시" : "추천 게임"))}</span>
          <h1>${esc(h.title)}</h1>
          <p class="scribble">${esc(h.description || h.subtitle || "")}</p>
          <span class="btn go" id="heroPlay" data-id="${esc(h.id)}">지금 플레이 ▶</span>
        </div>
      </div>
      <div class="hero-thumbs" style="grid-template-columns:repeat(${list.length},1fr);">${thumbs}</div>
    </div>
  </div>`;
}

function recommendedSection() {
  const recs = state.games.filter((g) => g.featured || g.isNew);
  const list = recs.length ? recs : state.games;
  return `<div class="sec">
    <div class="sec-head"><h2>추천 게임</h2><span class="pill on tilt">#신규 인기</span>
      <div class="arrows"><button data-rec="-1">‹</button><button data-rec="1">›</button></div>
    </div>
    <div class="rec-rail" id="recRail">${list.map(card).join("")}</div>
  </div>`;
}

function allGamesSection() {
  const cats = ["전체", ...new Set(state.games.map((g) => g.genre).filter(Boolean))];
  const catRow = `<div class="cat-row">${cats.map((c) =>
    `<span class="pill ${state.cat === c ? "on" : ""} tilt" data-cat="${esc(c)}">${esc(c)}</span>`).join("")}</div>`;

  let list = state.games;
  if (state.cat !== "전체") list = list.filter((g) => g.genre === state.cat);
  if (state.search) {
    const q = state.search.toLowerCase();
    list = list.filter((g) =>
      g.title.toLowerCase().includes(q) ||
      (g.genre || "").toLowerCase().includes(q) ||
      (g.tags || []).some((t) => t.toLowerCase().includes(q)));
  }

  const shown = list.slice(0, state.limit);
  const cols = Math.min(Math.max(shown.length, 1), 4);
  const moreBtn = list.length > state.limit
    ? `<div class="more-row"><span class="btn tilt" id="moreBtn">더 보기 ▾</span></div>` : "";
  const gridHtml = list.length
    ? `<div class="grid lib" style="grid-template-columns:repeat(${cols},1fr);">${shown.map(card).join("")}</div>${moreBtn}`
    : `<div class="empty">검색/필터 결과가 없어요.</div>`;

  return `<div class="sec two-col">
    <div>
      <div class="sec-head"><h2>전체 게임</h2><span class="sub">장르로 추려보세요</span></div>
      ${catRow}
      ${gridHtml}
    </div>
    <aside class="sidebar">
      <div class="sec-head"><h2 style="font-size:24px;">🏆 수록 게임</h2></div>
      ${rankList(state.games.slice(0, 7))}
      <div style="height:20px;"></div>
      <div class="sec-head"><h2 style="font-size:24px;">📢 소식</h2></div>
      ${noticeCards()}
    </aside>
  </div>`;
}

function rankList(items) {
  return `<div class="rank sk">${items.map((g, i) => `<div class="rk" data-id="${esc(g.id)}">
    <span class="num ${i < 3 ? "top" : ""}">${i + 1}</span>
    <span class="mini sk hatch">${g.thumbnail ? `<img src="${esc(g.thumbnail)}" alt="" onerror="this.remove()" />` : ""}</span>
    <span class="nm">${esc(g.title)}</span>
    <span class="delta">${esc(g.genre || "")}</span></div>`).join("")}</div>`;
}

function noticeCards() {
  const newest = [...state.games].sort((a, b) =>
    String(b.releaseDate || "").localeCompare(String(a.releaseDate || "")))[0];
  const ev = (t, b) => `<div class="ev sk tilt"><div class="evph ph hatch x">배너</div>
    <div><b>${esc(t)}</b><div class="scribble" style="font-size:14px;">${esc(b)}</div></div></div>`;
  let html = ev("환영합니다 🎮", "간단한 게임을 모아 즐기는 Gamini 포털");
  if (newest) html += `<div style="height:10px;"></div>` + ev("신규 게임", `${newest.title} 플레이 가능!`);
  return html;
}

// ── 토스트 ─────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast"; el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// ── 게임 실행 ──────────────────────────────────────────
function playGame(id) {
  const game = state.games.find((g) => g.id === id);
  if (!game) return;
  if (game.placeholder || !game.playUrl) {
    showToast("🚧 준비 중인 게임이에요. 곧 만나요!");
    return;
  }
  const modal = document.getElementById("playModal");
  document.getElementById("playTitle").textContent = game.title;
  // 캐시 무력화: 게임을 항상 최신 버전으로 불러오도록 주소에 버전 값을 붙인다.
  const sep = game.playUrl.includes("?") ? "&" : "?";
  document.getElementById("playFrame").src = game.playUrl + sep + "v=" + Date.now();
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closePlay() {
  const modal = document.getElementById("playModal");
  modal.classList.add("hidden");
  document.getElementById("playFrame").src = "about:blank";
  document.body.style.overflow = "";
}

// ── 이벤트 바인딩 ──────────────────────────────────────
function bindHeader() {
  if (window.GaminiAuth) window.GaminiAuth.refreshHeader();
  const logo = document.getElementById("homeLogo");
  if (logo) logo.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const toggle = document.getElementById("searchToggle");
  if (toggle) toggle.onclick = () => {
    const bar = document.getElementById("searchBar");
    bar.classList.toggle("open");
    if (bar.classList.contains("open")) document.getElementById("searchInput").focus();
  };
  const input = document.getElementById("searchInput");
  if (input) input.oninput = (e) => {
    state.search = e.target.value.trim();
    state.limit = 12;
    rerenderAllGames();
  };
}

function bindCards() {
  document.querySelectorAll(".card[data-id]").forEach((el) =>
    el.addEventListener("click", () => playGame(el.dataset.id)));
  document.querySelectorAll(".rank .rk[data-id]").forEach((el) =>
    el.addEventListener("click", () => playGame(el.dataset.id)));
}

function bindHero() {
  const play = document.getElementById("heroPlay");
  if (play) play.onclick = () => playGame(play.dataset.id);
  document.querySelectorAll(".hero-thumbs .ht").forEach((el) =>
    el.addEventListener("click", () => {
      state.heroIndex = Number(el.dataset.hi);
      render();
    }));
}

function bindCats() {
  document.querySelectorAll(".cat-row .pill[data-cat]").forEach((el) =>
    el.addEventListener("click", () => {
      state.cat = el.dataset.cat;
      state.limit = 12;
      rerenderAllGames();
    }));
}

function bindRec() {
  const rail = document.getElementById("recRail");
  document.querySelectorAll(".arrows button[data-rec]").forEach((b) =>
    b.addEventListener("click", () => {
      if (rail) rail.scrollBy({ left: Number(b.dataset.rec) * 560, behavior: "smooth" });
    }));
}

function bindMore() {
  const more = document.getElementById("moreBtn");
  if (more) more.onclick = () => { state.limit += 12; rerenderAllGames(); };
}

// 전체게임 섹션만 다시 그려 검색/필터 시 화면 점프 방지
function rerenderAllGames() {
  const app = document.getElementById("app");
  const old = app.querySelector(".two-col");
  if (!old) { render(); return; }
  const wrap = document.createElement("div");
  wrap.innerHTML = allGamesSection();
  const fresh = wrap.firstElementChild;
  old.replaceWith(fresh);
  bindCards();
  bindCats();
  bindMore();
}

// ── 모달 버튼 ──────────────────────────────────────────
document.getElementById("closePlayBtn").onclick = closePlay;
document.getElementById("fullscreenBtn").onclick = () => {
  const frame = document.getElementById("playFrame");
  if (frame.requestFullscreen) frame.requestFullscreen();
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("playModal").classList.contains("hidden")) closePlay();
});

// ── 시작 ───────────────────────────────────────────────
loadGames();
