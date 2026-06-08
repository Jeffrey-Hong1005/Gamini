import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 경로 정의
// projectRoot = Games/
// gamesDir    = Games/games/ (각 게임 폴더가 여기에 위치)
const projectRoot = path.join(__dirname, "..");
const gamesDir = path.join(projectRoot, "games");
const frontendDir = path.join(projectRoot, "frontend");
const gamesDataPath = path.join(__dirname, "data", "games.json");

const app = express();
const PORT = process.env.PORT || 3000;

// ── 게임 레지스트리 로드 ───────────────────────────────
// games.json을 매 요청마다 읽어 서버 재시작 없이 게임 추가/수정 반영
function loadGames() {
  try {
    const raw = fs.readFileSync(gamesDataPath, "utf-8");
    const data = JSON.parse(raw);
    // enabled === false 인 게임은 목록에서 제외
    return (data.games || []).filter((g) => g.enabled !== false);
  } catch (err) {
    console.error("games.json 로드 실패:", err.message);
    return [];
  }
}

// ── 게임 정적 파일 서빙 ────────────────────────────────
// 각 게임 폴더(Games/<id>)를 /games/<id> 로 서빙.
// games.json에 등록된 게임만 노출하여 다른 폴더 노출을 방지.
function mountGameStatics() {
  const games = loadGames();
  const mounted = new Set();
  for (const game of games) {
    const folder = path.join(gamesDir, game.id);
    if (!mounted.has(game.id) && fs.existsSync(folder)) {
      app.use(`/games/${game.id}`, express.static(folder));
      mounted.add(game.id);
    }
  }
}
mountGameStatics();

// ── API ────────────────────────────────────────────────
// 전체 게임 목록
app.get("/api/games", (req, res) => {
  res.json({ games: loadGames() });
});

// 단일 게임 상세
app.get("/api/games/:id", (req, res) => {
  const game = loadGames().find((g) => g.id === req.params.id);
  if (!game) return res.status(404).json({ error: "게임을 찾을 수 없습니다." });
  res.json(game);
});

// 헬스 체크
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ── 프론트엔드 정적 파일 서빙 ──────────────────────────
app.use(express.static(frontendDir));

// SPA 폴백 (정의되지 않은 경로는 index.html로)
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🎮 게임 아케이드 서버 실행 중: http://localhost:${PORT}`);
});
