# 점프 클라이머 친구 랭킹판 — 설정 가이드

이 가이드는 Firebase 무료 티어를 이용해 친구들과 공유되는 점수 랭킹을 만들고, 인터넷에 게임을 올리는 전체 과정을 안내합니다. 프로그래밍 지식이 거의 없어도 따라할 수 있도록 단계별로 작성했습니다. 소요 시간은 약 15~25분입니다.

게임 개요: 60초 안에 발판을 밟고 점프하면서 최대한 높이 올라가는 게임입니다. 점수는 도달한 높이(미터)입니다.

---

## 전체 흐름

1. Firebase 프로젝트 생성 (무료)
2. Realtime Database 만들기
3. 보안 규칙 설정
4. 게임 코드에 Firebase 설정 붙여넣기
5. 게임을 인터넷에 올려서 친구들에게 링크 공유

---

## 1단계 — Firebase 프로젝트 생성

1. https://console.firebase.google.com 접속 (Google 계정으로 로그인)
2. "프로젝트 만들기" 클릭
3. 프로젝트 이름 입력 (예: `jump-climber`) → 계속
4. Google Analytics는 **사용 안 함**으로 설정해도 됩니다 → 프로젝트 만들기
5. 잠시 후 "프로젝트가 준비되었습니다" → 계속

## 2단계 — Realtime Database 생성

1. 왼쪽 메뉴에서 **빌드 → Realtime Database** 클릭
2. "데이터베이스 만들기" 버튼 클릭
3. 위치는 기본값(미국) 또는 `asia-southeast1` 선택 → 다음
4. **보안 규칙은 일단 "테스트 모드로 시작"** 선택 → 사용 설정
   - 30일 동안 누구나 읽기/쓰기 가능 (나중에 3단계에서 변경)

## 3단계 — 보안 규칙 설정 (중요)

테스트 모드는 한 달 후 자동 차단되고, 누구나 모든 데이터를 지울 수 있어 위험합니다. 다음 규칙으로 바꿔주세요.

1. Realtime Database 페이지에서 상단의 **"규칙"** 탭 클릭
2. 기존 내용을 전부 지우고 아래 내용을 붙여넣기
3. **"게시"** 버튼 클릭

```json
{
  "rules": {
    "scores": {
      ".read": true,
      ".indexOn": ["score"],
      "$entry": {
        ".write": "!data.exists() && newData.hasChildren(['nickname', 'score']) && newData.child('nickname').isString() && newData.child('nickname').val().length <= 10 && newData.child('score').isNumber() && newData.child('score').val() >= 0 && newData.child('score').val() < 100000"
      }
    }
  }
}
```

이 규칙이 하는 일:
- 누구나 점수 목록을 **읽을** 수 있음
- 누구나 새 점수를 **추가**할 수 있지만, 기존 점수는 수정/삭제할 수 없음
- 닉네임은 문자열이고 10자 이하만 허용
- 점수는 0 이상의 숫자만 허용

## 4단계 — Firebase 설정값 가져와서 게임에 붙여넣기

1. Firebase 콘솔 왼쪽 위 ⚙️ → **프로젝트 설정** 클릭
2. "내 앱" 영역에서 **웹 아이콘 `</>`** 클릭
3. 앱 닉네임 입력 (예: `jump-web`) → 앱 등록 (호스팅 옵션은 일단 체크 안 해도 됨)
4. 화면에 표시되는 `firebaseConfig` 객체를 통째로 복사

복사한 내용은 이렇게 생겼을 겁니다:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "jump-climber.firebaseapp.com",
  databaseURL: "https://jump-climber-default-rtdb.firebaseio.com",
  projectId: "jump-climber",
  storageBucket: "jump-climber.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

5. `index.html` 파일을 텍스트 편집기(메모장, VS Code 등)로 열기
6. 파일 안에서 `▼▼▼ 여기에 본인 Firebase 설정을 붙여넣으세요 ▼▼▼` 부분을 찾기
7. 그 아래의 `const firebaseConfig = { ... }` 블록을 본인 것으로 **통째로 교체**
8. 저장

> ⚠️ `databaseURL` 항목이 반드시 포함되어 있어야 합니다. Firebase가 가끔 이 줄을 빼고 보여주는 경우가 있는데, 그러면 Realtime Database 페이지에서 URL을 확인해 직접 추가하세요.

## 5단계 — 게임 인터넷에 올리기

친구들이 링크 하나로 접속할 수 있게 인터넷에 올려야 합니다. 가장 쉬운 방법 3가지를 소개합니다.

### 방법 A — Netlify Drop (가장 간단, 계정 없이 시도 가능)

1. https://app.netlify.com/drop 접속
2. `index.html` 파일을 페이지에 드래그앤드롭
3. 잠시 후 `random-name-12345.netlify.app` 같은 URL이 발급됨
4. 그 URL을 친구들에게 공유

> 계정 없이 사용하면 24시간 후 사이트가 사라질 수 있습니다. 영구 사용하려면 무료 계정 가입 권장.

### 방법 B — Firebase Hosting (Firebase와 통합, 영구 무료)

Firebase를 이미 쓰고 있으니 같은 곳에 올리는 게 깔끔합니다. 다만 Firebase CLI 설치가 필요합니다.

```bash
# Node.js가 설치되어 있다는 가정
npm install -g firebase-tools
firebase login
firebase init hosting   # 폴더에서 실행, public 폴더 지정, SPA는 No
firebase deploy
```

배포 후 `https://your-project.web.app` URL이 발급됩니다.

### 방법 C — GitHub Pages (GitHub 계정 있으면 추천)

1. https://github.com 에 로그인
2. 새 저장소(repository) 만들기 (이름 예: `jump-climber`)
3. `index.html` 업로드 → Commit
4. 저장소 Settings → Pages → Source를 `main` 브랜치 / `/ (root)` 선택 → Save
5. 잠시 후 `https://본인유저명.github.io/jump-climber/` URL이 발급됨

---

## 잘 되는지 확인하기

1. 배포한 URL을 브라우저로 열기
2. 닉네임 입력 후 "시작"
3. 게임 오버 후 우측 랭킹판에 본인 점수가 뜨면 성공
4. 친구에게 같은 URL을 보내서 플레이하라고 하기
5. 친구의 점수도 우측에 실시간으로 나타남

---

## 자주 발생하는 문제

**"Firebase 미설정" 메시지가 계속 나옴**
→ `firebaseConfig` 값이 아직 `YOUR_API_KEY` 등 기본값입니다. 4단계를 다시 확인하세요.

**랭킹이 안 뜨고 "랭킹 불러오기 실패" 메시지가 뜸**
→ 보안 규칙이 잘못 설정됐을 가능성이 큽니다. 3단계의 규칙을 그대로 복사해서 게시했는지 확인하세요.

**점수 등록은 되는데 친구는 안 보임**
→ 친구가 다른 URL을 쓰고 있을 수 있습니다. 같은 URL에서 같은 Firebase 프로젝트를 바라봐야 합니다.

**Firebase 비용이 청구되나요?**
→ Realtime Database 무료 티어는 1GB 저장 + 월 10GB 다운로드를 허용합니다. 점수 데이터는 매우 가벼워서 친구 수십 명이 매일 플레이해도 무료 한도 안에서 쓸 수 있습니다. 다만 만약을 위해 콘솔에서 "결제 알림"을 설정해두는 것을 권장합니다.

---

## 운영 팁

- **부정 점수 방지**: 현재는 클라이언트가 점수를 그대로 서버에 보내므로 마음만 먹으면 조작이 가능합니다. 친구들끼리만 쓴다면 신뢰 기반으로 충분하지만, 공개적으로 운영한다면 Cloud Functions로 서버 측 검증 로직 추가를 고민해야 합니다.
- **랭킹 초기화**: Firebase 콘솔 → Realtime Database → `scores` 노드 옆 ⋮ → 삭제
- **닉네임 신고 들어오면**: 콘솔에서 해당 항목 수동 삭제
