// ============================================================
//  Gamini — 인증 + 계정별 DB 모듈
//  - 자유 아이디(username) + 비밀번호 회원가입/로그인
//  - 구글 로그인
//  - 계정별 방문 데이터 / 게임 기록 저장·불러오기 (Realtime Database)
//  전역 API: window.GaminiAuth
// ============================================================

import { firebaseConfig, isConfigured, ID_DOMAIN } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, serverTimestamp, increment,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let app = null, auth = null, db = null, ready = false;
let currentUser = null;     // Firebase user
let currentProfile = null;  // /users/{uid} 데이터

if (isConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getDatabase(app);
    ready = true;
  } catch (e) {
    console.error("Firebase 초기화 실패:", e);
  }
} else {
  console.warn("Gamini: Firebase 미설정 — js/firebase-config.js 에 gamini 프로젝트 설정을 넣어주세요.");
}

// ── 유틸 ─────────────────────────────────────────────
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const idToEmail = (id) => `${id.toLowerCase()}@${ID_DOMAIN}`;
const emailToId = (email) =>
  email && email.endsWith("@" + ID_DOMAIN) ? email.split("@")[0] : null;

function friendlyError(e) {
  const c = (e && e.code) || "";
  if (c.includes("email-already-in-use")) return "이미 사용 중인 아이디입니다.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "아이디 또는 비밀번호가 올바르지 않습니다.";
  if (c.includes("weak-password")) return "비밀번호는 6자 이상이어야 합니다.";
  if (c.includes("too-many-requests")) return "시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";
  if (c.includes("network-request-failed")) return "네트워크 오류입니다. 연결을 확인해주세요.";
  if (c.includes("popup-closed-by-user")) return "구글 로그인 창이 닫혔습니다.";
  if (c.includes("operation-not-allowed")) return "이 로그인 방식이 Firebase 콘솔에서 아직 켜져 있지 않습니다.";
  return (e && e.message) || "알 수 없는 오류가 발생했습니다.";
}

// ── 계정 DB ───────────────────────────────────────────
function deriveUsername(user) {
  return emailToId(user.email) || user.displayName || (user.email ? user.email.split("@")[0] : "guest");
}

async function ensureUserRecord(user, provider) {
  if (!db) return null;
  const uref = ref(db, "users/" + user.uid);
  const snap = await get(uref);
  const username = deriveUsername(user);
  if (!snap.exists()) {
    const rec = {
      username,
      provider,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      visitCount: 1,
      games: {},
    };
    await set(uref, rec);
    return rec;
  } else {
    await update(uref, { lastLogin: serverTimestamp(), visitCount: increment(1) });
    const fresh = await get(uref);
    return fresh.val();
  }
}

// 게임 기록 저장 (게임 화면에서 호출). 최고점은 갱신 시에만 올림.
async function saveScore(gameId, score, extra = {}) {
  // 게스트(익명)는 개인 계정 기록을 남기지 않음 — 실제 로그인 계정만
  if (!db || !currentUser || currentUser.isAnonymous) return { ok: false, reason: "not-logged-in" };
  try {
    const gref = ref(db, `users/${currentUser.uid}/games/${gameId}`);
    const snap = await get(gref);
    const prevBest = snap.exists() && typeof snap.val().bestScore === "number" ? snap.val().bestScore : 0;
    await update(gref, {
      bestScore: Math.max(prevBest, score),
      lastScore: score,
      plays: increment(1),
      lastPlayed: serverTimestamp(),
      ...extra,
    });
    return { ok: true, best: Math.max(prevBest, score) };
  } catch (e) {
    console.error("saveScore 실패:", e);
    return { ok: false, reason: friendlyError(e) };
  }
}

async function getUserData() {
  if (!db || !currentUser) return null;
  const snap = await get(ref(db, "users/" + currentUser.uid));
  return snap.exists() ? snap.val() : null;
}

// ── 인증 동작 ─────────────────────────────────────────
async function signUp(id, pw, pw2) {
  if (!ready) throw new Error("Firebase가 아직 설정되지 않았습니다.");
  if (!USERNAME_RE.test(id)) throw new Error("아이디는 영문/숫자/밑줄(_) 3~20자여야 합니다.");
  if (pw.length < 6) throw new Error("비밀번호는 6자 이상이어야 합니다.");
  if (pw !== pw2) throw new Error("비밀번호가 일치하지 않습니다.");
  await createUserWithEmailAndPassword(auth, idToEmail(id), pw);
  // onAuthStateChanged 에서 계정 레코드 생성됨
}

async function logIn(id, pw) {
  if (!ready) throw new Error("Firebase가 아직 설정되지 않았습니다.");
  if (!id || !pw) throw new Error("아이디와 비밀번호를 입력해주세요.");
  await signInWithEmailAndPassword(auth, idToEmail(id), pw);
}

async function googleLogIn() {
  if (!ready) throw new Error("Firebase가 아직 설정되지 않았습니다.");
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

async function logOut() {
  if (auth) await signOut(auth);
}

// ── 인증 상태 추적 ────────────────────────────────────
if (ready) {
  onAuthStateChanged(auth, async (user) => {
    // 세션이 전혀 없으면 게스트(익명) 세션을 만들어 둠 → 모든 쓰기가 인증된 상태에서만 일어나도록
    if (!user) {
      currentUser = null; currentProfile = null;
      refreshHeader();
      signInAnonymously(auth).catch((e) =>
        console.warn("익명 로그인 실패(콘솔에서 익명 인증을 켜야 게스트 점수 등록이 됩니다):", e));
      return;
    }
    // 게스트(익명): uid는 가지지만 로그인 UI/계정 레코드는 만들지 않음
    if (user.isAnonymous) {
      currentUser = user;
      currentProfile = null;
      refreshHeader();
      document.dispatchEvent(new CustomEvent("gamini-auth", { detail: { user: null, profile: null, guest: true } }));
      return;
    }
    // 실제 계정 (아이디/비밀번호 또는 구글)
    currentUser = user;
    const provider = (user.providerData[0] && user.providerData[0].providerId) || "password";
    const prov = provider.includes("google") ? "google" : "password";
    try { currentProfile = await ensureUserRecord(user, prov); }
    catch (e) { console.error("계정 레코드 갱신 실패:", e); }
    refreshHeader();
    document.dispatchEvent(new CustomEvent("gamini-auth", { detail: { user: currentUser, profile: currentProfile } }));
  });
}

// ============================================================
//  UI: 모달 + 헤더
// ============================================================
function injectStyles() {
  if (document.getElementById("gaminiAuthStyles")) return;
  const css = `
  .ga-overlay{position:fixed;inset:0;background:rgba(8,8,14,.55);backdrop-filter:blur(3px);
    display:flex;align-items:center;justify-content:center;z-index:9999;}
  .ga-overlay.ga-hidden{display:none;}
  .ga-modal{width:340px;max-width:92vw;background:#fff;color:#222;border-radius:16px;
    padding:26px 24px;box-shadow:0 24px 70px rgba(0,0,0,.4);font-family:inherit;}
  .ga-modal h2{font-size:23px;margin:0 0 4px;font-weight:900;}
  .ga-sub{font-size:13px;color:#888;margin-bottom:18px;}
  .ga-field{width:100%;padding:12px 13px;margin:7px 0;border:1.5px solid #e2e2e8;border-radius:10px;
    font-size:15px;outline:none;transition:border-color .15s;box-sizing:border-box;}
  .ga-field:focus{border-color:#1fbf4f;}
  .ga-primary{width:100%;margin-top:12px;padding:13px;border:none;border-radius:10px;cursor:pointer;
    font-size:16px;font-weight:800;color:#fff;background:#1fbf4f;transition:filter .15s;}
  .ga-primary:hover{filter:brightness(1.06);}
  .ga-primary:disabled{opacity:.6;cursor:default;}
  .ga-divider{display:flex;align-items:center;gap:12px;margin:18px 0;color:#bdbdc6;font-size:13px;}
  .ga-divider::before,.ga-divider::after{content:"";flex:1;height:1px;background:#e6e6ec;}
  .ga-google{width:100%;padding:11px;border:1.5px solid #e2e2e8;border-radius:10px;cursor:pointer;
    background:#fff;font-size:15px;font-weight:700;color:#333;display:flex;align-items:center;
    justify-content:center;gap:10px;transition:background .15s;}
  .ga-google:hover{background:#f6f6f8;}
  .ga-google svg{width:18px;height:18px;}
  .ga-err{color:#e23b3b;font-size:13px;min-height:18px;margin-top:8px;text-align:center;}
  .ga-foot{margin-top:16px;text-align:center;font-size:13px;color:#777;}
  .ga-foot a{color:#1fbf4f;font-weight:700;cursor:pointer;text-decoration:none;}
  .ga-close{position:absolute;top:14px;right:16px;cursor:pointer;font-size:20px;color:#aaa;border:none;background:none;}
  .ga-modal{position:relative;}
  .ga-notice{background:#fff6e0;border:1px solid #f0d488;color:#8a6d1e;font-size:12px;
    border-radius:8px;padding:9px 11px;margin-bottom:14px;line-height:1.5;}
  .ga-prof-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0f0f4;font-size:14px;}
  .ga-prof-row b{color:#444;} .ga-prof-row span{color:#777;}
  .ga-rec{display:flex;justify-content:space-between;font-size:14px;padding:6px 0;}
  .ga-user-chip{cursor:pointer;font-weight:800;}
  `;
  const s = document.createElement("style");
  s.id = "gaminiAuthStyles"; s.textContent = css;
  document.head.appendChild(s);
}

const GOOGLE_SVG = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.5 2.5 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.2 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.5 10.7l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.7 2.2-6.4 0-11.8-3.7-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 48 24 48z"/></svg>`;

function modalsHtml() {
  const noticeIfUnconfigured = isConfigured ? "" :
    `<div class="ga-notice">⚠️ 아직 Firebase 설정 전입니다. <code>js/firebase-config.js</code>에 gamini 프로젝트 설정을 넣어야 실제 가입/로그인이 동작합니다.</div>`;
  return `
  <div class="ga-overlay ga-hidden" id="gaOverlay">
    <!-- 회원가입 -->
    <div class="ga-modal ga-hidden" id="gaSignup">
      <button class="ga-close" data-ga-close>×</button>
      <h2>회원가입</h2><div class="ga-sub">Gamini 계정을 만들어 기록을 저장하세요</div>
      ${noticeIfUnconfigured}
      <input class="ga-field" id="suUser" placeholder="아이디 (영문/숫자/_ 3~20자)" autocomplete="username" />
      <input class="ga-field" id="suPw" type="password" placeholder="비밀번호 (6자 이상)" autocomplete="new-password" />
      <input class="ga-field" id="suPw2" type="password" placeholder="비밀번호 재확인" autocomplete="new-password" />
      <button class="ga-primary" id="suSubmit">회원가입</button>
      <div class="ga-divider">or</div>
      <button class="ga-google" id="suGoogle">${GOOGLE_SVG}<span>구글로 시작하기</span></button>
      <div class="ga-err" id="suErr"></div>
      <div class="ga-foot">이미 계정이 있으신가요? <a data-ga-to="login">로그인</a></div>
    </div>
    <!-- 로그인 -->
    <div class="ga-modal ga-hidden" id="gaLogin">
      <button class="ga-close" data-ga-close>×</button>
      <h2>로그인</h2><div class="ga-sub">Gamini에 다시 오신 걸 환영해요</div>
      ${noticeIfUnconfigured}
      <input class="ga-field" id="liUser" placeholder="아이디" autocomplete="username" />
      <input class="ga-field" id="liPw" type="password" placeholder="비밀번호" autocomplete="current-password" />
      <button class="ga-primary" id="liSubmit">로그인</button>
      <div class="ga-divider">or</div>
      <button class="ga-google" id="liGoogle">${GOOGLE_SVG}<span>구글 로그인</span></button>
      <div class="ga-err" id="liErr"></div>
      <div class="ga-foot">계정이 없으신가요? <a data-ga-to="signup">회원가입</a></div>
    </div>
    <!-- 마이페이지 -->
    <div class="ga-modal ga-hidden" id="gaProfile">
      <button class="ga-close" data-ga-close>×</button>
      <h2>마이페이지</h2><div class="ga-sub" id="gaProfSub">내 계정 정보</div>
      <div id="gaProfBody"></div>
      <button class="ga-primary" id="gaLogout" style="background:#444;margin-top:18px;">로그아웃</button>
    </div>
  </div>`;
}

let modalsMounted = false;
function mountModals() {
  if (modalsMounted) return;
  injectStyles();
  const wrap = document.createElement("div");
  wrap.innerHTML = modalsHtml();
  document.body.appendChild(wrap.firstElementChild);
  modalsMounted = true;
  bindModalEvents();
}

function showOverlay(which) {
  mountModals();
  document.getElementById("gaOverlay").classList.remove("ga-hidden");
  ["gaSignup", "gaLogin", "gaProfile"].forEach((id) =>
    document.getElementById(id).classList.toggle("ga-hidden", id !== which));
}
function hideOverlay() {
  const o = document.getElementById("gaOverlay");
  if (o) o.classList.add("ga-hidden");
}

function setBusy(btn, busy, label) {
  if (!btn) return;
  btn.disabled = busy;
  if (busy) { btn.dataset.label = btn.textContent; btn.textContent = "처리 중…"; }
  else if (btn.dataset.label) { btn.textContent = label || btn.dataset.label; }
}

function bindModalEvents() {
  const o = document.getElementById("gaOverlay");
  o.addEventListener("click", (e) => { if (e.target === o) hideOverlay(); });
  o.querySelectorAll("[data-ga-close]").forEach((b) => b.onclick = hideOverlay);
  o.querySelectorAll("[data-ga-to]").forEach((a) =>
    a.onclick = () => showOverlay(a.dataset.gaTo === "login" ? "gaLogin" : "gaSignup"));

  // 회원가입
  const suErr = document.getElementById("suErr");
  document.getElementById("suSubmit").onclick = async () => {
    suErr.textContent = "";
    const btn = document.getElementById("suSubmit");
    try {
      setBusy(btn, true);
      await signUp(val("suUser"), val("suPw"), val("suPw2"));
      hideOverlay();
    } catch (e) { suErr.textContent = friendlyError(e); }
    finally { setBusy(btn, false, "회원가입"); }
  };
  document.getElementById("suGoogle").onclick = () => doGoogle(suErr);

  // 로그인
  const liErr = document.getElementById("liErr");
  document.getElementById("liSubmit").onclick = async () => {
    liErr.textContent = "";
    const btn = document.getElementById("liSubmit");
    try {
      setBusy(btn, true);
      await logIn(val("liUser"), val("liPw"));
      hideOverlay();
    } catch (e) { liErr.textContent = friendlyError(e); }
    finally { setBusy(btn, false, "로그인"); }
  };
  document.getElementById("liGoogle").onclick = () => doGoogle(liErr);
  // Enter 제출
  ["liPw", "liUser"].forEach((id) => document.getElementById(id).addEventListener("keydown",
    (e) => { if (e.key === "Enter") document.getElementById("liSubmit").click(); }));
  document.getElementById("suPw2").addEventListener("keydown",
    (e) => { if (e.key === "Enter") document.getElementById("suSubmit").click(); });

  document.getElementById("gaLogout").onclick = async () => { await logOut(); hideOverlay(); };
}

async function doGoogle(errEl) {
  errEl.textContent = "";
  try { await googleLogIn(); hideOverlay(); }
  catch (e) { errEl.textContent = friendlyError(e); }
}

const val = (id) => (document.getElementById(id)?.value || "").trim();

async function openProfile() {
  showOverlay("gaProfile");
  const body = document.getElementById("gaProfBody");
  body.innerHTML = `<div class="ga-sub">불러오는 중…</div>`;
  const data = await getUserData();
  if (!data) { body.innerHTML = `<div class="ga-sub">불러올 데이터가 없습니다.</div>`; return; }
  document.getElementById("gaProfSub").textContent = `${data.username} 님의 계정`;
  const created = data.createdAt ? new Date(data.createdAt).toLocaleDateString("ko-KR") : "-";
  const games = data.games || {};
  const recRows = Object.keys(games).length
    ? Object.entries(games).map(([gid, g]) =>
        `<div class="ga-rec"><b>${gid}</b><span>최고 ${g.bestScore ?? 0} · ${g.plays ?? 0}회</span></div>`).join("")
    : `<div class="ga-sub">아직 플레이 기록이 없어요.</div>`;
  body.innerHTML = `
    <div class="ga-prof-row"><b>아이디</b><span>${data.username}</span></div>
    <div class="ga-prof-row"><b>로그인 방식</b><span>${data.provider === "google" ? "구글" : "아이디"}</span></div>
    <div class="ga-prof-row"><b>가입일</b><span>${created}</span></div>
    <div class="ga-prof-row"><b>방문 횟수</b><span>${data.visitCount ?? 1}회</span></div>
    <div style="margin-top:14px;font-weight:800;color:#444;">🎮 게임 기록</div>
    ${recRows}`;
}

// 헤더의 #authArea 를 로그인 상태에 맞게 갱신
function refreshHeader() {
  const area = document.getElementById("authArea");
  if (!area) return;
  if (currentUser && !currentUser.isAnonymous) {
    const name = currentProfile?.username || deriveUsername(currentUser);
    area.innerHTML =
      `<span class="btn tilt ga-user-chip" id="userChip">👤 ${name}</span>` +
      `<span class="btn go tilt" id="logoutBtn">로그아웃</span>`;
  } else {
    area.innerHTML =
      `<span class="btn tilt" id="signupBtn">회원가입</span>` +
      `<span class="btn go tilt" id="loginBtn">로그인</span>`;
  }
}

// 헤더 버튼은 동적 렌더되므로 이벤트 위임 사용
document.addEventListener("click", (e) => {
  const t = e.target.closest("#signupBtn,#loginBtn,#userChip,#logoutBtn");
  if (!t) return;
  if (t.id === "signupBtn") showOverlay("gaSignup");
  else if (t.id === "loginBtn") showOverlay("gaLogin");
  else if (t.id === "userChip") openProfile();
  else if (t.id === "logoutBtn") logOut();
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideOverlay(); });

// 페이지 로드시 헤더 동기화 (app.js 렌더 이후를 대비해 약간 지연도)
refreshHeader();
setTimeout(refreshHeader, 600);

// ── 전역 노출 ─────────────────────────────────────────
window.GaminiAuth = {
  ready, isConfigured,
  signUp, logIn, googleLogIn, logOut,
  saveScore, getUserData,
  openSignup: () => showOverlay("gaSignup"),
  openLogin: () => showOverlay("gaLogin"),
  openProfile,
  refreshHeader,
  get user() { return currentUser; },
  get profile() { return currentProfile; },
};
