# AI 로 대시보드 만들기

GasStart 는 특정 AI 에 묶여 있지 않습니다. 저장소 루트의 **`AGENTS.md`** 한 파일에 프로젝트 규칙(구조, 서버 함수 추가 규칙,
검증 명령)이 들어 있고, 주요 도구들이 이 파일을 자동으로 읽습니다. 도구별 진입점:

| 도구 | 읽는 파일 | 사용 |
|---|---|---|
| OpenAI Codex (CLI / IDE / 클라우드) | `AGENTS.md` | 저장소 폴더에서 `codex` 실행 |
| Cursor | `AGENTS.md`, `.cursor/rules/gasstart.mdc` | 폴더 열고 Agent 모드 |
| Windsurf | `AGENTS.md`, `.windsurf/rules/gasstart.md` | 폴더 열고 Cascade |
| Devin / Jules 등 클라우드 에이전트 | `AGENTS.md` | 저장소 연결 |
| GitHub Copilot (VS Code / 코딩 에이전트) | `.github/copilot-instructions.md` → `AGENTS.md` | 채팅·에이전트 모드 |
| Claude Code | `CLAUDE.md` → `AGENTS.md` | 폴더에서 `claude` 실행 |
| 그 외 (Aider, Gemini CLI, Cline…) | 직접 지정 | 첫 메시지에 "먼저 `AGENTS.md` 를 읽어" |

규칙을 바꾸고 싶으면 `AGENTS.md` 만 고치세요 — 나머지 파일은 포인터입니다.

## 0. 시작 전 체크

1. `npm run setup` 이 끝나 웹앱이 뜨는 상태
2. `npm run dev` 로 로컬에서 mock 데이터가 보이는 상태 — AI 가 UI 를 고칠 때 배포 없이 즉시 확인할 수 있어야 반복이 빠릅니다
3. 시트의 `data` 탭에 **실제 쓰려는 컬럼**이 있으면 가장 좋습니다. AI 에게 컬럼 이름과 예시 행 몇 개를 그대로 붙여 주세요.

## 1. 반복 루프

```
요청(프롬프트) → AI 가 packages/* 수정 → npm run dev 로 확인 → npm run push:dev → /dev URL 확인 → deploy:dev
```

AI 에게 마지막에 항상 **`npm run check`** 를 돌려 달라고 하세요. 두 명령이 통과하면 push 는 거의 항상 성공합니다.

## 2. 프롬프트 레시피

복사해서 컬럼 이름만 바꿔 쓰세요.

### 내 데이터 스키마로 바꾸기

> 시트 `data` 탭의 컬럼이 `order_date, region, product, amount, qty` 로 바뀌었어.
> `packages/shared/src/index.ts` 의 `DataPoint` 를 이 스키마로 바꾸고, `transform.ts` 의 변환·KPI 를 맞춰 줘.
> `mock/data.json` 과 `packages/gas/src/sample.ts`, `python/src/gasstart_sheets/sample.py` 의 샘플도 같은 스키마로 다시 생성해.
> 끝나면 `npm run check`.

### 차트 추가

> `region` 별 `amount` 합계를 보여 주는 가로 막대 차트를 라인 차트 아래에 추가해 줘.
> Recharts 를 쓰고, 색은 `styles.css` 의 `--series-*` 토큰을 순서대로 써. 라인 차트의 카테고리 순서와 색이 일치해야 해.
> 데이터가 없을 땐 빈 상태 문구를 보여 줘.

### 필터 추가

> 헤더 아래에 기간 필터(최근 7/30/90일/전체)와 `category` 다중 선택 필터를 한 줄로 넣어 줘.
> 필터는 `App.tsx` 의 `points` 를 걸러서 KPI·차트·표가 모두 같은 결과를 보도록 해.
> 카테고리 색은 필터로 일부를 숨겨도 바뀌지 않아야 해(색은 엔티티에 고정).

### 서버 함수 추가 (시트 쓰기)

> 대시보드에서 메모를 입력하면 `notes` 탭에 `(timestamp, user, text)` 로 추가되는 기능을 만들어 줘.
> 규칙: `packages/gas/src/main.ts` 에 `addNote(text)` export, `packages/shared` 의 `ServerApi` 에 시그니처, `packages/gas/vite.config.ts` 의 `globals` 에 이름 추가.
> 클라이언트는 `runGas("addNote", text)` 를 써. 사용자 이메일은 `Session.getActiveUser().getEmail()` 을 시도하고 빈 문자열이면 "anonymous".

### 여러 탭 읽기

> `getDashboardData` 가 `data` 외에 `targets` 탭(`category, monthly_target`)도 읽어서 함께 반환하도록 바꿔 줘.
> `DashboardData` 타입에 `targets: Row[]` 를 추가하고, KPI 에 "목표 달성률" 타일을 넣어.

### 자동 갱신 / 트리거

> 시트가 5분마다 외부 API 에서 데이터를 받아오도록 시간 기반 트리거용 함수 `refreshData()` 를 `main.ts` 에 추가하고,
> 편집기에서 트리거를 설정하는 방법을 README 에 적어 줘. `UrlFetchApp` 을 쓰면 `appsscript.json` 의 `oauthScopes` 에 `https://www.googleapis.com/auth/script.external_request` 를 추가해야 해.

### Python ETL

> `python/examples/` 에 우리 사내 API(`https://api.example.com/sales?from=&to=`) 를 호출해 `data` 탭 스키마로 변환해 `write_df` 하는 스크립트를 만들어 줘.
> 인증은 `get_client()` 그대로(토큰 캐시). 날짜 범위는 argparse 로 받고, 기본은 최근 30일.

### 스타일 / 브랜딩

> `styles.css` 의 토큰만 바꿔서 회사 색(#0B3D91 주색, #F5A623 강조)으로 테마를 맞춰 줘.
> 다크 모드 값도 함께 정하고, 차트 시리즈 색은 인접 색이 색약 사용자에게도 구분되도록 유지해.

## 3. AI 에게 알려 주면 좋은 제약

- Apps Script 서버 코드는 **브라우저 API 가 없고**, `google.script.run` 으로 넘기는 값은 **JSON 직렬화 가능한 것만**(Date 는 문자열로).
- 웹앱은 iframe 안에서 돌아가며 **외부 `<script src>` 를 못 씁니다** — 라이브러리는 npm 으로 설치해 번들에 포함.
- 단일 HTML 크기가 커지면 로딩이 느려집니다. 지도·대형 차트 라이브러리는 필요할 때만.
- 서버 호출은 왕복 1초 안팎이므로 **한 번에 모아서** 가져오고(`getDashboardData` 처럼), 클라이언트에서 필터링.
- 시트는 DB 가 아닙니다 — 수십만 행이면 `getDataRange().getValues()` 가 느려지니 집계는 Python/서버에서 미리.

## 4. 검증 체크리스트 (AI 에게 시키기)

```bash
npm run typecheck        # 서버·클라이언트·공용 타입 모두
npm run build            # dist/ 3개 파일, index.html 에 외부 참조 없음
npm run dev              # mock 으로 UI 확인 (?empty 로 빈 상태도)
npm run push:dev         # /dev URL 에서 실데이터로 확인
cd python; pytest        # Python 을 건드렸다면
```
