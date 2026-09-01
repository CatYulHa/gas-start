# GasStart

**Google Apps Script 스타터 키트** — 서버·인프라 없이 회사 안에서(또는 개인적으로) 대시보드/웹앱을 띄우기 위한 템플릿.
TypeScript 로 짜고, `clasp` 로 dev/prod 를 나눠 배포하고, React + Vite 대시보드를 단일 HTML 로 번들해 GAS 웹앱으로 서빙하고,
Python(pandas + gspread) 으로 스프레드시트에 데이터를 적재합니다. 같은 회사 도메인만 접근하게 하는 설정은 [docs/apps-script-guide.md](./docs/apps-script-guide.md).

[English README](./README.en.md)

```
Python ETL ──write──▶  Google Sheets (DB 역할)  ◀──read──  Apps Script (TS)  ──HtmlService──▶  React 대시보드
gasstart-sheets seed          `data` 탭                   getDashboardData()   google.script.run     KPI · 차트 · 표
```

## 특징

| 영역 | 내용 |
|---|---|
| **clasp 환경 분리** | `.clasp.dev.json` / `.clasp.prod.json` 을 스크립트가 자동 스왑. `npm run push:dev`, `npm run deploy:prod` 한 줄로 끝 |
| **TypeScript 서버** | clasp 3 은 TS 를 직접 변환하지 않으므로 Vite + `@gas-plugin/unplugin` 이 `dist/Code.js` 하나로 번들. `export` 제거·전역 함수 보존·`appsscript.json` 복사 자동 |
| **React 대시보드** | Vite + `vite-plugin-singlefile` → `dist/index.html` 한 파일. `doGet()` 이 그대로 서빙. 로컬 `npm run dev` 는 mock 데이터로 동작 |
| **타입 공유** | `packages/shared` 의 `ServerApi` 로 `google.script.run` 호출을 타입 안전하게 |
| **Python ETL** | `gasstart-sheets` CLI/라이브러리. OAuth **토큰 캐시**(`.secrets/token.json`) — 첫 실행만 브라우저, 이후 무인 실행 |
| **CI** | GitHub Actions 로 typecheck·build·pytest, 선택적 prod 자동 배포 워크플로 |

## 요구 사항

- Node.js ≥ 20 (`.nvmrc` = 24), npm ≥ 9
- Python ≥ 3.11 (Python 파트를 쓸 때만)
- Google 계정 + [Apps Script API 활성화](https://script.google.com/home/usersettings) (`clasp login` 전에 켜 두세요)

## 시작하기 — 명령 하나

```bash
git clone https://github.com/CatYulHa/gas-start.git GasStart && cd GasStart
npm install
npm run setup
```

`npm run setup` 이 순서대로 처리합니다.

| 단계 | 하는 일 |
|---|---|
| 1. Google 로그인 | `clasp login` — 브라우저가 열리고, 토큰은 `~/.clasprc.json` 에 저장됩니다 (다음부터는 묻지 않음) |
| 2. Apps Script API 확인 | 계정의 [Apps Script API 토글](https://script.google.com/home/usersettings)이 꺼져 있으면(기본값) 설정 페이지를 자동으로 열고, 켜신 뒤 Enter 를 누르면 재확인합니다 |
| 3. 프로젝트 생성 | **새 스프레드시트 + 거기에 바운드된 Apps Script** 를 만들고 `scriptId` 를 `packages/gas/.clasp.dev.json` 에 저장 (시트 ID 설정 불필요) |
| 4. 빌드 | React 대시보드 → `dist/index.html`, TypeScript 서버 → `dist/Code.js` |
| 5. Push | `clasp push -f` |
| 6. 배포 | `clasp create-deployment` → `deploymentId` 저장 (다음 배포부터는 같은 URL 에 업데이트) |
| 7. 열기 | 웹앱 URL 을 브라우저로 열고 편집기·시트 링크를 출력 |

브라우저에는 **"👋 Hello, GasStart!"** 대시보드가 뜹니다 (기본은 본인만 열 수 있는 `MYSELF` 배포 — 공유 방법은 [docs/deploy.md §7](./docs/deploy.md)). 첫 방문에 Google 이 "승인 필요" 를 한 번 물으면 *권한 검토* 로 허용하고,
**Load sample data** 버튼을 누르면 서버 함수 `seedSampleData()` 가 `data` 시트에 90일 × 3 카테고리를 채우고 KPI·차트·표가 나타납니다.
여기서부터는 `packages/dashboard/src/App.tsx` 와 `packages/gas/src/main.ts` 를 고쳐 쓰면 됩니다.

> 이미 만든 스크립트가 있다면 `.clasp.example.json` 을 `.clasp.dev.json` 으로 복사해 `scriptId` 를 넣고 `npm run setup` 을 실행하세요 — 생성 단계만 건너뜁니다.
> 옵션: `npm run setup -- --type standalone`(시트 없이 독립 스크립트; 이때는 스크립트 속성 `SPREADSHEET_ID` 필요), `--title "My App"`, `--env staging`, `--no-open`, `--dry-run`.

### 이후 일상 명령

```bash
npm run dev          # http://localhost:5173 — 배포 없이 mock 데이터로 UI 개발 (?empty 로 환영 화면 미리보기)
npm run push:dev     # 빌드 + 업로드 (에디터의 "테스트 배포" URL 에 즉시 반영)
npm run deploy:dev   # 새 버전을 같은 웹앱 URL 로 게시
npm run sheet:dev    # 바운드 스프레드시트 열기 · open:dev 는 편집기 · web:dev 는 웹앱
npm run setup:prod   # prod 환경도 같은 절차로 한 번에 (별도 시트 + 스크립트)
```

## dev / prod 분리 원리

clasp 는 현재 폴더의 `.clasp.json` 하나만 읽습니다. GasStart 는 환경별 파일을 두고
`scripts/clasp.mjs` 가 실행 직전에 clasp 가 이해하는 필드만 `.clasp.json` 으로 복사합니다.

```
packages/gas/
├─ .clasp.example.json   ← 커밋됨 (템플릿)
├─ .clasp.dev.json       ← git-ignored  {"scriptId": "...", "rootDir": "dist", "deploymentId": ""}
├─ .clasp.prod.json      ← git-ignored
└─ .clasp.json           ← 스크립트가 매번 생성 (건드리지 마세요)
```

| 명령 | 동작 |
|---|---|
| `npm run setup` / `setup:prod` | 로그인 → 생성 → 빌드 → push → 배포 → 열기 를 한 번에 (`scripts/setup.mjs`) |
| `npm run create:<env>` | `clasp create-script --type sheets`(기본, 새 시트 + 바운드 스크립트) 후 scriptId 를 `.clasp.<env>.json` 에 저장. `-- --type standalone` 가능 |
| `npm run push:<env>` | `npm run build` → `clasp push -f` |
| `npm run deploy:<env>` | `deploymentId` 가 비어 있으면 `create-deployment` 후 id 를 자동 저장, 있으면 `update-deployment` (URL 유지) |
| `npm run web:<env>` | `clasp open-web-app` |
| `npm run open:<env>` / `sheet:<env>` | 에디터 / 바운드 스프레드시트 열기 |
| `npm run status:dev` · `deployments:prod` | 파일 상태 / 배포 목록 |
| `npm run clasp -- <env> <clasp 명령>` | 그 외 모든 clasp 명령 패스스루 (`npm run clasp -- prod list-versions`) |

`staging` 처럼 새 환경이 필요하면 `npm run setup -- --env staging` 한 번이면 됩니다.

## 프로젝트 구조

```
GasStart/
├─ AGENTS.md                     AI 코딩 도구용 프로젝트 규칙 (CLAUDE.md 등은 포인터)
├─ docs/                         deploy.md · apps-script-guide.md · ai-guide.md
├─ package.json                  npm workspaces 루트 · 모든 명령의 진입점
├─ scripts/setup.mjs             한 방 부트스트랩 (로그인→생성→빌드→push→배포→열기)
├─ scripts/clasp.mjs             환경 스왑 + clasp 래퍼 (lib.mjs 공용)
├─ packages/
│  ├─ shared/src/index.ts        Row · DashboardData · ServerApi (양쪽 공용 타입)
│  ├─ gas/                       Apps Script 서버 (TypeScript)
│  │  ├─ src/main.ts             doGet · getDashboardData · seedSampleData · ping · setup · showConfig
│  │  ├─ src/sample.ts           데모 데이터 생성기 (Python sample.py 와 동일 스키마)
│  │  ├─ src/sheets.ts           readTable / writeTable (헤더 → 객체 배열)
│  │  ├─ src/config.ts           바운드 시트 자동 인식, 독립 스크립트면 SPREADSHEET_ID 속성
│  │  ├─ appsscript.json         V8 · oauthScopes(currentonly, userinfo.email) · webapp { USER_DEPLOYING, MYSELF }
│  │  └─ vite.config.ts          → dist/Code.js (+ appsscript.json 복사)
│  └─ dashboard/                 React 19 + Vite 8 + Recharts
│     ├─ src/lib/gas.ts          runGas("getDashboardData") — Promise 래퍼 + mock 폴백
│     ├─ src/App.tsx             KPI 타일 · 카테고리별 라인 차트 · 테이블
│     ├─ src/components/Welcome.tsx  시트가 비어 있을 때의 Hello World + 샘플 데이터 버튼
│     └─ vite.config.ts          → ../gas/dist/index.html (single file)
└─ python/                       gasstart-sheets (pandas + gspread)
   ├─ src/gasstart_sheets/auth.py     OAuth 토큰 캐시 (.secrets/token.json)
   ├─ src/gasstart_sheets/sheets.py   read_df / write_df
   ├─ src/gasstart_sheets/cli.py      auth · read · write · seed
   └─ examples/etl_sample.py          공개 CSV → pandas → 시트
```

### 서버 함수 추가하기

1. `packages/gas/src/main.ts` 에 `export function myFn(...)` 작성
2. `packages/shared/src/index.ts` 의 `ServerApi` 에 시그니처 추가
3. `packages/gas/vite.config.ts` 의 `globals` 배열에 함수 이름 추가 (tree-shaking 방지)
4. 대시보드에서 `await runGas("myFn", ...)` — 이름/인자/반환 타입이 컴파일 타임에 검사됩니다

## Python — 시트 읽기/쓰기 (토큰 캐시 인증)

옛 Google API 퀵스타트의 `token.pickle` 패턴과 같습니다: **OAuth 클라이언트 파일 1개 + 캐시된 토큰 1개.**
첫 실행에만 브라우저가 열리고, 이후엔 `.secrets/token.json` 을 재사용해 무인으로 돕니다.

### 1) OAuth 클라이언트 만들기 (1회)

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성/선택
2. **API 및 서비스 → 라이브러리** 에서 *Google Sheets API*, *Google Drive API* 사용 설정
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID → 애플리케이션 유형: 데스크톱 앱**
4. JSON 다운로드 → 저장소 루트의 `.secrets/credentials.json` 으로 저장 (git-ignored; `.secrets/` 는 현재 폴더에서 상위로 자동 탐색되므로 `python/` 안에서 실행해도 됩니다)
5. OAuth 동의 화면이 "테스트" 상태라면 **테스트 사용자**에 본인 계정 추가

### 2) 설치 및 인증

```bash
cd python
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"                             # 또는: uv pip install -e ".[dev]"

gasstart-sheets auth        # 브라우저 동의 → .secrets/token.json 생성
gasstart-sheets auth        # 두 번째부터는 브라우저 없이 즉시 통과
```

### 3) 사용

```bash
gasstart-sheets seed  <SHEET_ID_or_URL>                 # 샘플 90일 × 3 카테고리 → data 탭
gasstart-sheets read  <SHEET_ID_or_URL> data --out out.csv
gasstart-sheets write out.csv <SHEET_ID_or_URL> data    # --append 로 이어 붙이기
python examples/etl_sample.py <SHEET_ID_or_URL>          # ETL 예제
```

```python
from gasstart_sheets import get_client, read_df, write_df

gc = get_client()                                   # 토큰 캐시 자동 사용
df = read_df(gc, "<SHEET_ID>", "data")
summary = df.groupby("category", as_index=False)["value"].sum()
write_df(gc, "<SHEET_ID>", "summary", summary)
```

| 환경변수 | 용도 |
|---|---|
| `GASSTART_CREDENTIALS` | OAuth 클라이언트 파일 경로 (기본 `.secrets/credentials.json`) |
| `GASSTART_TOKEN` | 캐시 토큰 경로 (기본 `.secrets/token.json`) |
| `GASSTART_SERVICE_ACCOUNT` | 지정 시 서비스 계정 JSON 으로 인증 (CI/봇용, 시트를 서비스 계정 이메일과 공유해야 함) |

토큰을 새로 받으려면 `gasstart-sheets auth --reset`.

## AI 코딩 도구와 함께 쓰기

Codex · Cursor · Windsurf · Devin · Copilot · Claude Code 등 어떤 AI 든 저장소를 열면 루트의 **`AGENTS.md`** 를 읽고
프로젝트 규칙(서버 함수 추가 3단계, JSON 직렬화, 검증 명령)을 따르게 되어 있습니다.
"`region` 별 매출 막대 차트 추가해 줘" 같은 프롬프트 레시피와 도구별 사용법은 **[docs/ai-guide.md](./docs/ai-guide.md)** 에 있습니다.

## 더 읽기

- **[docs/deploy.md](./docs/deploy.md)** — `setup` 이 로컬/홈/Google 에 무엇을 만드는지, `/dev` vs `/exec`, dev→prod 흐름, 다른 PC 에서 이어 쓰기, 삭제·정리, "확인하지 않은 앱" 경고 설명
- **[docs/apps-script-guide.md](./docs/apps-script-guide.md)** — 회사에서 서버리스로 배포하기: Apps Script 동작 원리, `executeAs × access` 매트릭스, **같은 회사 도메인만 보게 하기(`DOMAIN`)**, 사용자별 데이터, 관리자 정책, 할당량과 한계, 운영
- **[docs/ai-guide.md](./docs/ai-guide.md)** — AI 로 대시보드 확장하기
- **[SECURITY.md](./SECURITY.md)** — 보안 기본값과 취약점 신고
- **[python/README.md](./python/README.md)** — Python ETL 패키지

## CI / 자동 배포

- `.github/workflows/ci.yml`: Node typecheck + build(산출물 검증) · Python 3.11–3.13 ruff + pytest
- `.github/workflows/deploy.yml`: 수동 실행(`workflow_dispatch`). 로컬 `~/.clasprc.json` 을 시크릿 `CLASPRC_JSON` 으로,
  `CLASP_PROD_SCRIPT_ID`(+ 선택 `CLASP_PROD_DEPLOYMENT_ID`) 를 등록하면 prod push + deploy. 태그 트리거는 주석 해제해 사용

## 보안 메모

- `appsscript.json` 의 `oauthScopes` 는 `spreadsheets.currentonly`(바운드 시트 하나만) 로 최소화되어 있습니다. 다른 시트를 `openById` 로 열거나 `UrlFetchApp` 을 쓰면 해당 스코프를 추가하세요.
- `appsscript.json` 의 `webapp.access` 기본값은 **`MYSELF`**(배포자 본인만) 입니다. 공유하려면 `DOMAIN`(Workspace) 또는 `ANYONE` 으로 바꾸고 `push` + `deploy` — [docs/deploy.md §7](./docs/deploy.md). `executeAs: USER_DEPLOYING` 이므로 방문자는 승인 없이, 스크립트는 배포자 권한으로 실행됩니다. 시트에 **쓰는** 서버 함수는 `assertDeployer()` 가드를 두세요(`seedSampleData` 참고).
- 취약점 신고와 보안 기본값 설명: [SECURITY.md](./SECURITY.md)
- `.clasp.*.json`(scriptId), `.secrets/`(OAuth 클라이언트·토큰·서비스 계정) 는 커밋 금지 — `.gitignore` 에 이미 포함

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| PowerShell: `npm.ps1 파일을 로드할 수 없습니다` (PSSecurityException) | Windows 실행 정책. `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 한 번 실행(관리자 불필요) 또는 `npm.cmd run setup` 으로 우회 |
| `User has not enabled the Apps Script API` | `npm run setup` 이 2단계에서 자동으로 설정 페이지를 열어 줍니다. 수동이면 https://script.google.com/home/usersettings 에서 켠 뒤 1~2분 후 재시도 |
| `Missing packages/gas/.clasp.dev.json` | `npm run create:dev` 또는 `.clasp.example.json` 복사 후 scriptId 입력 |
| 웹앱에 "No spreadsheet configured" | 독립(standalone) 스크립트일 때만 발생 — 스크립트 속성 `SPREADSHEET_ID` 설정 또는 `setup("<ID>")` 실행 |
| 웹앱에 "Authorization required" | 첫 방문 시 정상. 배포한 계정으로 열고 *권한 검토* → 허용 |
| "Google 에서 확인하지 않은 앱" 경고 | 미심사 OAuth 앱에 붙는 기본 경고. 배포자 본인만 1회 `고급 → (안전하지 않음)으로 이동 → 허용`. 다른 사용자는 승인 화면을 보지 않음(`executeAs: USER_DEPLOYING`). 자세히: [docs/deploy.md §6](./docs/deploy.md) |
| 스코프를 바꿨는데 "권한이 없습니다" | `appsscript.json` 의 `oauthScopes` 변경 후엔 push → 웹앱 재방문 시 재승인 필요. `openById` 를 쓰면 `spreadsheets.currentonly` 대신 `spreadsheets` |
| `Project file already exists` | `packages/gas/.clasp.json` 이 남아 있음 — 삭제 후 재실행 (래퍼가 보통 자동 처리) |
| 웹앱에 `Script function not found: getDashboardData` | 함수가 `vite.config.ts` 의 `globals` 에 없거나 push 안 됨 → `npm run push:dev` |
| 배포 후 변경이 반영 안 됨 | `create-deployment` 는 새 버전 생성. 테스트는 `/dev` URL(에디터 → 배포 → 테스트 배포), 운영은 `deploy:prod` 재실행 |
| clasp 명령이 예전 문서와 다름 | clasp 3 은 `create-script`, `create-deployment`, `list-deployments` 등으로 바뀜(구 이름은 alias). `npx clasp --help` |
| Python `AuthError: No cached token...` | `.secrets/credentials.json` 위치 확인 후 `gasstart-sheets auth` |
| Python `access_denied` / 403 | OAuth 동의 화면 테스트 사용자에 계정 추가, Sheets/Drive API 사용 설정 |

## 라이선스

MIT. GasStart 는 개인 프로젝트로 Google LLC 와 무관하며, Google 이 보증·후원하지 않습니다. Google Apps Script, Google Sheets 는 Google LLC 의 상표입니다.
