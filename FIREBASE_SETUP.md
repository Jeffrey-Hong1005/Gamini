# Gamini — Firebase 연결 전체 가이드

> 사용자 등록 · 게임 기록 저장을 실제로 동작시키기 위한 단계별 안내입니다.
> **코드는 이미 다 작성되어 있습니다.** 이 문서의 작업만 마치면 회원가입/로그인/점수 저장이 바로 동작합니다.

---

## 0. 지금 어디까지 되어 있나 (현재 상태)

| 항목 | 상태 | 위치 |
|------|------|------|
| 회원가입·로그인 UI/로직 | ✅ 완성 | `docs/js/gamini-auth.js` |
| 구글 로그인 | ✅ 완성 | 같은 파일 |
| 게임 기록 저장 `saveScore()` | ✅ 완성 | 같은 파일 |
| 게임 내 점수 저장 호출 | ✅ 완성 | `docs/games/jumpingAI/index.html` |
| DB 보안 규칙 | ✅ 작성됨(미배포) | `database.rules.json` |
| **Firebase 설정값** | ❌ **비어 있음(placeholder)** | `docs/js/firebase-config.js` |

➡️ **딱 하나, `firebase-config.js`의 값이 `YOUR_API_KEY` 같은 가짜 값이라 지금은 동작하지 않습니다.**
아래 단계를 따라 실제 값으로 채우고 콘솔 설정을 켜면 끝납니다.

---

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 → 본인 Google 계정으로 로그인
2. **프로젝트 만들기(Create a project)** 클릭
3. 프로젝트 이름: `gamini` (원하는 이름 가능)
4. Google 애널리틱스는 꺼도 됩니다(Disable) → **만들기**

---

## 2. 웹 앱 등록하고 설정값 복사하기

1. 프로젝트 대시보드에서 **`</>` (웹) 아이콘** 클릭
2. 앱 닉네임: `gamini-web` 입력 → **앱 등록**
   - "Firebase Hosting"은 체크 안 해도 됩니다(GitHub Pages 사용 중이므로).
3. 화면에 아래 같은 `firebaseConfig` 블록이 나옵니다. **이 값을 통째로 복사해 두세요.**

```js
const firebaseConfig = {
  apiKey: "AIzaSy....",
  authDomain: "gamini-xxxx.firebaseapp.com",
  databaseURL: "https://gamini-xxxx-default-rtdb.firebaseio.com",
  projectId: "gamini-xxxx",
  storageBucket: "gamini-xxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef...",
};
```

> ⚠️ `databaseURL`이 보이지 않으면 **3단계(Realtime Database 생성)를 먼저** 한 뒤
> 다시 프로젝트 설정(⚙️ → 프로젝트 설정 → 내 앱)에서 확인하면 나옵니다.

---

## 3. Realtime Database 생성

1. 왼쪽 메뉴 **빌드(Build) → Realtime Database**
2. **데이터베이스 만들기** 클릭
3. 위치: `asia-southeast1`(싱가포르) 권장 → 다음
4. 보안 규칙: 일단 **"잠금 모드(locked mode)"** 선택 → 사용 설정
   - (규칙은 5단계에서 우리가 만든 `database.rules.json`으로 교체합니다.)

> ⚠️ "Firestore"가 아니라 반드시 **"Realtime Database"** 를 만들어야 합니다.
> 이 프로젝트 코드는 Realtime Database(`firebase-database.js`)를 사용합니다.

---

## 4. 로그인(Authentication) 방식 켜기

1. 왼쪽 메뉴 **빌드(Build) → Authentication → 시작하기**
2. **Sign-in method** 탭에서 아래 3가지를 켭니다:

   | 방식 | 용도 | 필수 여부 |
   |------|------|-----------|
   | **이메일/비밀번호** | 아이디+비밀번호 회원가입 | ✅ 필수 |
   | **Google** | 구글 로그인 버튼 | ✅ 필수 |
   | **익명(Anonymous)** | 게스트 점수/랭킹 등록 | ✅ 필수 |

   - 이메일/비밀번호: 사용 설정 토글만 켜면 됩니다(이메일 링크는 끔).
   - Google: 사용 설정 + 프로젝트 지원 이메일 선택 → 저장.
   - 익명: 사용 설정 토글만 켜면 됩니다.

   > 셋 중 하나라도 안 켜면 해당 기능에서 `operation-not-allowed` 오류가 납니다.
   > 특히 **익명**을 안 켜면 비로그인 상태의 게스트 점수 등록이 막힙니다.

3. **Settings(설정) → 승인된 도메인(Authorized domains)** 으로 이동해
   다음 두 도메인이 있는지 확인하고, 없으면 추가합니다:
   - `localhost` (보통 기본 포함)
   - `jeffrey-hong1005.github.io` ← GitHub Pages 배포 도메인

---

## 5. 보안 규칙 배포 (database.rules.json 적용)

이 프로젝트에는 이미 안전한 규칙(`database.rules.json`)이 작성되어 있습니다.
콘솔에 그대로 붙여넣어 적용하세요.

1. **Realtime Database → 규칙(Rules)** 탭 이동
2. 편집창의 내용을 모두 지우고, `Gamini/database.rules.json` 파일 내용을 **그대로 복사·붙여넣기**
3. **게시(Publish)** 클릭

이 규칙이 보장하는 것:
- `users/{uid}` : 본인만 자기 데이터 읽기/쓰기 가능
- `scores` : 누구나 읽기(랭킹 표시), 쓰기는 로그인된 사용자가 본인 uid로 1회만
- 점수 범위(0~1,000,000), 닉네임 길이(≤12자) 등 값 검증

---

## 6. 설정값을 코드에 넣기 ⭐ (가장 중요)

2단계에서 복사한 `firebaseConfig` 값을 아래 **두 파일**에 똑같이 붙여넣습니다.

- `Gamini/docs/js/firebase-config.js`  ← 실제 배포(GitHub Pages)에서 사용
- `Gamini/frontend/js/firebase-config.js`  ← 로컬 개발용 (동일 값)

`firebase-config.js`의 이 부분을:

```js
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

2단계에서 복사한 **실제 값으로 교체**하면 됩니다.
(`isConfigured`는 자동으로 `true`가 되어 가짜설정 경고가 사라집니다.)

> 💡 이 값들은 비밀키가 아니라 **공개되어도 되는 클라이언트 식별값**입니다.
> 실제 보안은 5단계의 DB 규칙과 4단계의 승인 도메인으로 지켜집니다.
> 따라서 GitHub에 그대로 커밋해도 괜찮습니다.

---

## 7. 동작 확인 (테스트)

### 로컬에서
1. `Gamini/start.command` 실행 (또는 `docs/` 폴더를 로컬 서버로 띄우기)
   - ⚠️ 파일을 더블클릭(`file://`)으로 열면 ES 모듈/팝업이 막힙니다. 반드시 로컬 **서버**로 여세요.
2. 포털 우측 상단 **회원가입** → 아이디(영문/숫자/_ 3~20자) + 비밀번호(6자 이상)로 가입
3. 가입 후 **👤 아이디** 칩 클릭 → 마이페이지에 계정 정보가 보이면 인증 OK
4. 게임(점핑AI) 플레이 → 게임오버 후 다시 마이페이지 → **게임 기록(최고점/플레이 횟수)** 이 쌓이면 저장 OK

### 콘솔에서 확인
- **Authentication → Users** : 가입한 계정이 보임
- **Realtime Database → 데이터** :
  - `users/{uid}` 에 `username`, `games/jumpingAI/bestScore` 등이 생김
  - `scores` 에 랭킹 항목이 생김

---

## 8. 자주 나는 오류와 해결

| 증상 | 원인 | 해결 |
|------|------|------|
| "Firebase 미설정" 경고 | config가 아직 placeholder | 6단계 다시 확인 |
| `auth/operation-not-allowed` | 해당 로그인 방식 미사용 설정 | 4단계에서 이메일/구글/익명 켜기 |
| `auth/unauthorized-domain` | 승인 도메인 누락 | 4-3단계에 도메인 추가 |
| `PERMISSION_DENIED` | 규칙 미배포 또는 로그인 안 됨 | 5단계 규칙 게시, 로그인 상태 확인 |
| 게스트 점수 등록 안 됨 | 익명 로그인 미사용 | 4단계에서 익명 켜기 |
| 모듈/팝업 안 뜸 | `file://`로 직접 열기 | 로컬 서버로 실행 |

---

## 요약 체크리스트

- [ ] 1. Firebase 프로젝트 생성
- [ ] 2. 웹 앱 등록 + `firebaseConfig` 복사
- [ ] 3. Realtime Database 생성 (Firestore 아님)
- [ ] 4. Auth: 이메일/비밀번호 · Google · 익명 켜기 + 승인 도메인 추가
- [ ] 5. `database.rules.json` 규칙 게시
- [ ] 6. `docs/js/firebase-config.js` + `frontend/js/firebase-config.js` 값 채우기
- [ ] 7. 회원가입 → 게임 플레이 → 기록 저장 확인

> 6단계(설정값 붙여넣기)는 제가 대신 해드릴 수 있습니다.
> 2단계에서 복사한 `firebaseConfig` 값을 알려주시면 두 파일에 정확히 넣어 드리겠습니다.
