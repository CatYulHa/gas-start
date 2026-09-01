# 배포와 상태 관리

`npm run setup` 이 무엇을 어디에 만들고, 이후 dev/prod 를 어떻게 운영·정리하는지 정리한 문서입니다.

## 1. 실행하면 무엇이 어디에 남나

### 로컬 (이 저장소 폴더)

| 경로 | 내용 | git |
|---|---|---|
| `node_modules/` | npm 의존성 | 무시 |
| `packages/gas/dist/` | 빌드 산출물 3개 — `Code.js`(서버), `index.html`(React 전체가 인라인된 단일 파일), `appsscript.json`. **이 3개가 그대로 Apps Script 에 업로드됩니다.** React 소스(`packages/dashboard/src`)는 로컬에만 있고 Google 에는 번들 결과만 올라갑니다 | 무시 |
| `packages/gas/.clasp.dev.json` | dev 환경 식별자 — `scriptId`, `parentId`(시트 ID), `deploymentId` | 무시 (비밀은 아니지만 사람마다 다름) |
| `packages/gas/.clasp.prod.json` | prod 환경 식별자 (setup:prod 후) | 무시 |
| `packages/gas/.clasp.json` | 래퍼가 명령 직전마다 재생성하는 clasp 용 파일 | 무시 |

### 홈 디렉터리

| 경로 | 내용 |
|---|---|
| `~/.clasprc.json` | `clasp login` 토큰(refresh token 포함). 이 PC 의 모든 GasStart 클론이 공유. `clasp logout` 으로 삭제 |
| `.secrets/token.json` (저장소 안) | Python `gasstart-sheets` 의 OAuth 토큰 — Python 을 쓸 때만 생김 |

### Google 계정 (Drive / Apps Script)

| 리소스 | 생성 명령 | 확인 |
|---|---|---|
| 스프레드시트 **"GasStart Demo (dev)"** | setup 3단계 (`create-script --type sheets`) | `npm run sheet:dev` |
| 그 시트에 바운드된 Apps Script 프로젝트 | 같은 단계 | `npm run open:dev` |
| 웹앱 배포 1개 (`AKfycb…`) | setup 6단계 | `npm run deployments:dev`, `npm run web:dev` |

Google 쪽 리소스는 **계정에 귀속**되며 저장소를 지워도 남습니다. 다른 PC 에서 같은 프로젝트를 쓰려면 `.clasp.dev.json` 만 복사하면 됩니다(아래 §4).

## 2. 명령 치트시트

```bash
# 최초 1회
npm run setup                 # dev: 로그인 → API 확인 → 시트+스크립트 생성 → 빌드 → push → 배포 → 열기
npm run setup:prod            # prod: 같은 절차, 별도 시트 + 스크립트 + 배포

# 개발 루프
npm run dev                   # 로컬 mock 데이터로 React 개발 (http://localhost:5173, ?empty 로 환영 화면)
npm run push:dev              # 빌드 + 업로드. "테스트 배포" URL(/dev) 에는 즉시 반영
npm run deploy:dev            # dev 웹앱 URL(/exec) 에 새 버전 게시
npm run web:dev               # dev 웹앱 열기
npm run open:dev              # Apps Script 편집기 (실행 로그, 트리거, 스크립트 속성)
npm run sheet:dev             # 바운드 스프레드시트 열기

# 운영
npm run push:prod && npm run deploy:prod    # prod 에 게시 (URL 고정)
npm run deployments:prod                    # 배포 목록
npm run clasp -- prod list-versions         # 그 외 clasp 명령 패스스루

# 점검
npm run typecheck && npm run build          # CI 와 동일
npm run status:dev                          # 어떤 파일이 push 되는지
```

### /dev 와 /exec 의 차이

| URL | 무엇 | 언제 |
|---|---|---|
| `https://script.google.com/macros/s/<scriptId>/dev` | **테스트 배포** — `push` 한 최신 코드를 항상 실행. 스크립트 편집 권한이 있는 사람만 접근 | 개발 중 빠른 확인 (`push:dev` 후 새로고침) |
| `https://script.google.com/macros/s/<deploymentId>/exec` | **버전 배포** — `deploy` 시점의 스냅숏 | 다른 사람에게 주는 URL |

`push` 만 하면 `/exec` 는 바뀌지 않습니다. 반영하려면 `deploy`.

## 3. dev → prod 흐름

```
   개발자 PC                         Google
┌───────────────┐   push:dev     ┌──────────────────────────┐
│ packages/*    │ ─────────────▶ │ dev 스크립트 + dev 시트   │ /dev 로 확인
│  (소스)       │   deploy:dev   │  └ dev 배포 (/exec)       │
│               │                └──────────────────────────┘
│  npm run build│   push:prod    ┌──────────────────────────┐
│  → dist/      │ ─────────────▶ │ prod 스크립트 + prod 시트 │
│               │   deploy:prod  │  └ prod 배포 (/exec, 고정)│ 사용자에게 공유
└───────────────┘                └──────────────────────────┘
```

- dev 와 prod 는 **완전히 별개의 스크립트·시트·URL** 입니다. 같은 소스를 서로 다른 `scriptId` 로 push 할 뿐입니다.
- prod 시트에 실데이터가 있다면 `seedSampleData` 버튼은 데이터를 **덮어씁니다** — 운영 전환 후에는 `Welcome.tsx` 의 버튼을 제거하거나 `main.ts` 에서 `seedSampleData` 를 지우세요.
- `deployments:prod` 로 이전 버전 목록을 보고, 롤백은 `npm run clasp -- prod update-deployment <deploymentId> -V <versionNumber>`.
- 배포용 계정을 분리하고 싶다면 `clasp login --user prod` 후 `npm run clasp -- prod --user prod push`(clasp 의 `--user` 옵션) 를 쓰거나, CI(`.github/workflows/deploy.yml`) 에서 prod 를 게시하세요.

## 4. 다른 PC / 다른 클론에서

| 상황 | 할 일 |
|---|---|
| **같은 프로젝트를 이어서 개발** | 원래 PC 의 `packages/gas/.clasp.dev.json` 을 복사해 오고 `npm install && npm run setup` — 로그인만 새로 하고 생성 단계는 건너뜁니다 |
| **완전히 새로 시작(다른 유저, 포크)** | `git clone → npm install → npm run setup` — 그 계정에 새 시트·스크립트·배포가 생깁니다 |
| `.clasp.dev.json` 을 잃음 | `npm run clasp -- dev list-scripts` 로 scriptId 를 찾아 `.clasp.example.json` 을 복사해 채우기. deploymentId 는 `npm run clasp -- dev list-deployments` |

## 5. 정리(삭제)

```bash
npm run clasp -- dev delete-script      # dev Apps Script 프로젝트 삭제 (Drive 휴지통) — 시트는 남음
# 시트는 Drive 에서 직접 삭제: npm run sheet:dev 로 열어 파일 → 휴지통
rm packages/gas/.clasp.dev.json         # 로컬 식별자 제거 → 다음 setup 은 새로 생성
npx clasp logout                        # ~/.clasprc.json 삭제
```

## 6. 첫 방문 시 "Google 에서 확인하지 않은 앱" 경고

웹앱 URL 을 처음 열면 Google 이 **"이 앱은 Google 에서 확인하지 않았습니다"** 경고를 보여 줍니다. 원인과 대응:

- **왜**: 모든 Apps Script 는 기본으로 Google 이 자동 생성한 GCP 프로젝트에 속하고, 이 프로젝트는 OAuth 앱 심사(verification)를 받지 않았기 때문입니다. 스프레드시트 접근 스코프는 "민감" 등급이라 미심사 앱은 경고가 붙습니다. 코드의 문제가 아닙니다.
- **누가 보나**: `appsscript.json` 의 `executeAs: USER_DEPLOYING` 덕분에 **배포한 본인만, 최초 1회** 승인하면 됩니다. 이후 URL 을 받은 다른 사용자는 승인 화면 자체를 보지 않습니다(스크립트가 배포자 권한으로 실행).
- **통과 방법**: `고급` → `GasStart Demo (dev)(안전하지 않음)으로 이동` → `허용`. 본인이 만든 스크립트이므로 안전합니다.
- **완화**: 이 스타터는 `appsscript.json` 에 `oauthScopes: ["…/spreadsheets.currentonly"]` 로 **바운드된 시트 하나만** 접근하는 최소 권한을 명시합니다. 승인 문구가 "이 스크립트가 설치된 스프레드시트 보기·관리" 로 좁아집니다. (`--type standalone` 으로 만들어 `SPREADSHEET_ID` 로 다른 시트를 여는 경우엔 `https://www.googleapis.com/auth/spreadsheets` 로 바꿔야 합니다.)
- **경고를 완전히 없애려면**: (a) Google Workspace 조직 계정에서 OAuth 동의 화면을 **내부(Internal)** 로 두면 조직원에게는 경고가 없습니다. (b) 개인(gmail) 계정은 표준 GCP 프로젝트를 연결하고 OAuth 동의 화면을 설정한 뒤 Google 의 **앱 인증(브랜드 + 민감 스코프 심사)** 을 통과해야 하며, 홈페이지·개인정보처리방침 URL 이 필요합니다. 개인 대시보드용이라면 굳이 필요 없습니다.

## 7. 웹앱 공유 범위 (`webapp.access`)

기본값은 **`MYSELF`** — 배포한 본인만 열 수 있습니다. 오픈소스 템플릿의 안전한 기본값이며, 데모 확인에는 충분합니다.
다른 사람에게 URL 을 주려면 `packages/gas/appsscript.json` 을 바꾸고 다시 게시합니다:

| 값 | 누가 열 수 있나 | 용도 |
|---|---|---|
| `MYSELF` | 배포자 본인 | 개인 대시보드, 개발 중 (기본) |
| `DOMAIN` | 같은 Google Workspace 조직의 로그인 사용자 | 사내 대시보드 |
| `ANYONE` | Google 에 로그인한 모든 사용자 | 공개 데모 |
| `ANYONE_ANONYMOUS` | 로그인 없이 누구나 | 완전 공개. `getActiveUser()` 가 항상 빈 값이라 소유자 가드가 동작하지 않음 → 쓰기 함수 제거 필요 |

```bash
# appsscript.json 의 "access" 수정 후
npm run push:dev && npm run deploy:dev
```

`executeAs: USER_DEPLOYING` 이므로 어떤 값이든 **방문자는 승인 화면을 보지 않고**, 스크립트는 배포자 권한으로 시트를 읽습니다.
그래서 시트에 **쓰는** 함수는 반드시 `assertDeployer()`(`main.ts`) 같은 가드를 두세요 — 없으면 URL 을 아는 누구나 배포자 권한으로 데이터를 바꿀 수 있습니다.
