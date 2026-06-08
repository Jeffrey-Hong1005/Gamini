#!/bin/bash
# Gamini 게임 포털 실행기 (맥에서 더블클릭으로 실행)
# - 백엔드(Express) 서버를 켜고, 브라우저로 http://localhost:3000 을 엽니다.

cd "$(dirname "$0")/backend" || exit 1

# 최초 1회 의존성 설치
if [ ! -d node_modules ]; then
  echo "📦 최초 실행: 의존성 설치 중..."
  npm install
fi

# 서버가 뜨면 브라우저 자동 열기
( sleep 1.5; open "http://localhost:3000" ) &

echo "🎮 Gamini 서버 시작 — 종료하려면 이 창에서 Ctrl + C"
npm start
