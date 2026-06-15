// ============================================================
//  Gamini — 사이트 전체 Firebase 설정 (공용)
//  포털(gamini-auth.js)과 각 게임이 이 한 파일을 공유합니다.
//
//  ▼▼▼ 사용 방법 ▼▼▼
//  1) https://console.firebase.google.com 에서 새 프로젝트 'gamini' 생성
//  2) 빌드(웹) 앱 추가 → 표시되는 firebaseConfig 값을 아래에 붙여넣기
//  3) Realtime Database 생성 (테스트 또는 규칙 설정)
//  4) Authentication → 로그인 방법에서 '이메일/비밀번호'와 'Google' 사용 설정
//  5) Authentication → 설정 → 승인된 도메인에
//     localhost 와 jeffrey-hong1005.github.io 추가
//  ▲▲▲ 여기까지 콘솔에서 ▲▲▲
// ============================================================

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// 설정이 실제 값으로 채워졌는지 확인 (placeholder 그대로면 false)
export const isConfigured = !firebaseConfig.apiKey.includes("YOUR_");

// 자유 아이디(username)를 Firebase 이메일/비밀번호 인증에 매핑할 때 쓰는 가짜 도메인
export const ID_DOMAIN = "gamini.local";
