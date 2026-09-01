# Apps Script 를 서버리스 플랫폼으로 쓰기 — 회사 대시보드 가이드

"서버 없이, 인프라팀 없이, 비용 없이 사내 대시보드/웹앱을 띄우고 **같은 회사 사람만** 보게 하고 싶다."
GasStart 가 겨냥하는 바로 그 경우를 위해 Google Apps Script(GAS)의 동작 원리와 설정을 정리했습니다.

## 1. Apps Script 는 무엇인가

- Google 이 운영하는 **관리형 JavaScript 실행 환경**(V8). 코드를 올리면 Google 서버에서 실행됩니다. 서버·컨테이너·도메인·SSL·스케일링을 사용자가 관리하지 않습니다.
- Google Workspace 데이터(Sheets, Drive, Gmail, Calendar…)에 **로그인한 사용자 권한으로** 바로 접근합니다. API 키·서비스 계정 없이 `SpreadsheetApp.openById()` 한 줄이면 됩니다.
- **웹앱 배포**: `doGet()` 이 반환한 HTML 을 `https://script.google.com/macros/s/<id>/exec` 로 서빙합니다. GasStart 는 여기에 React 번들을 실어 보냅니다.
- 비용: Workspace/Gmail 계정에 **포함**(별도 과금 없음). 대신 할당량(§6)이 있습니다.
- 데이터는 회사 Google 테넌트 밖으로 나가지 않습니다 — 외부 서버가 없으므로 보안 검토가 단순해집니다.

```
브라우저 ──HTTPS──▶ script.google.com (Google 인증·권한 검사)
                       └─ doGet() → index.html (React)
                       └─ google.script.run.getDashboardData() → Code.js → SpreadsheetApp → 시트
```

## 2. 두 개의 축: `executeAs` × `access`

`packages/gas/appsscript.json` 의 `webapp` 블록이 웹앱 보안 모델의 전부입니다.

### `executeAs` — 코드가 **누구의 권한**으로 실행되나

| 값 | 의미 | 시트 접근 | 승인(OAuth) 화면 | `Session.getActiveUser()` |
|---|---|---|---|---|
| `USER_DEPLOYING` (GasStart 기본) | 배포자 권한으로 실행 | 배포자가 볼 수 있는 시트를 방문자도 봄. 시트를 방문자에게 공유할 필요 없음 | 배포자만 1회 | Workspace 같은 도메인이면 방문자 이메일, 아니면 빈 값 |
| `USER_ACCESSING` | 방문자 본인 권한으로 실행 | 방문자에게 시트 공유가 되어 있어야 함 | **방문자마다** 1회 승인 | 방문자 이메일 |

### `access` — **누가** 웹앱을 열 수 있나

| 값 | 열 수 있는 사람 | 로그인 |
|---|---|---|
| `MYSELF` | 배포자만 | 필요 |
| `DOMAIN` | 배포자와 **같은 Workspace 조직**의 사용자 | 필요 |
| `ANYONE` | Google 계정이 있는 누구나 | 필요 |
| `ANYONE_ANONYMOUS` | 누구나 | 불필요 |

`DOMAIN` 은 **Google Workspace 계정에서만** 선택 가능합니다(개인 gmail 에는 조직이 없음).

### 회사 시나리오별 추천 조합

| 시나리오 | executeAs | access | 설명 |
|---|---|---|---|
| **팀 공용 KPI 대시보드** (모두 같은 데이터) | `USER_DEPLOYING` | `DOMAIN` | 가장 단순. 시트는 배포자(또는 서비스용 공용 계정)만 소유. 방문자는 승인 화면 없이 바로 봄 |
| **사용자마다 다른 데이터** (본인 부서 행만) | `USER_ACCESSING` | `DOMAIN` | 시트를 조직에 공유하거나, 코드에서 `getActiveUser()` 로 행을 필터. 각 사용자가 첫 방문에 승인 |
| **외부 고객·파트너에게 공개** | `USER_DEPLOYING` | `ANYONE` | 배포자 데이터를 읽기 전용으로 노출. **쓰기 함수는 반드시 가드**(§4) |
| **완전 공개 페이지**(로그인 없이) | `USER_DEPLOYING` | `ANYONE_ANONYMOUS` | 사용자 식별 불가. 쓰기 함수 제거, 민감 데이터 금지 |
| 개인용 / 개발 중 | `USER_DEPLOYING` | `MYSELF` | GasStart 기본값 |

## 3. 회사 도메인 담당자만 보게 하기 — 실제 설정

```jsonc
// packages/gas/appsscript.json
"webapp": {
  "executeAs": "USER_DEPLOYING",
  "access": "DOMAIN"
}
```

```bash
npm run ship:prod      # = push:prod + deploy:prod (또는 ship:dev)
```

- 배포 계정은 **회사 Workspace 계정**이어야 합니다(`clasp login` 시 그 계정으로). 개인 gmail 로 배포하면 `DOMAIN` 을 쓸 수 없습니다.
- 다른 도메인 사용자가 열면 Google 이 "권한이 없습니다" 페이지를 보여 줍니다. 코드가 실행되기 **전에** Google 이 막으므로 앱 코드에서 따로 인증을 구현할 필요가 없습니다.
- **더 좁히기(특정 부서만)**: `access` 는 도메인 단위까지만 지원합니다. 그 안에서 더 좁히려면 코드에서 확인합니다:

```ts
// packages/gas/src/main.ts
const ALLOWED = ["finance@example.com", "ops-lead@example.com"];      // 또는 Google 그룹을 시트에 관리
function assertAllowed() {
  const email = Session.getActiveUser().getEmail();               // DOMAIN + Workspace 에서는 항상 채워짐
  if (!ALLOWED.includes(email)) throw new Error("Not authorized");
}
export function getDashboardData() { assertAllowed(); /* … */ }
```

  Google 그룹 멤버십으로 판단하려면 `GroupsApp.getGroupByEmail("dash-viewers@example.com").hasUser(email)` (스코프 `https://www.googleapis.com/auth/groups` 추가).

- **방문자 이메일 표시/감사 로그**: `Session.getActiveUser().getEmail()` 을 `console.log` 로 남기면 Cloud Logging 에 누가 언제 봤는지 남습니다(§7).

### `USER_ACCESSING` 으로 사용자별 데이터 보여 주기

1. `appsscript.json`: `"executeAs": "USER_ACCESSING"`, `"access": "DOMAIN"`
2. 시트를 조직(또는 대상 그룹)에 **뷰어**로 공유 — 방문자 권한으로 읽으므로 공유가 없으면 오류
3. 스코프: 각 방문자가 승인하므로 `oauthScopes` 는 계속 최소로. 다른 시트를 열면 `spreadsheets.currentonly` → `spreadsheets`
4. 코드: `readTable()` 결과를 `Session.getActiveUser().getEmail()` 기준으로 필터. 이 모드에서는 `assertDeployer()` 가 항상 통과(active == effective)하므로 쓰기 가드는 허용 목록 방식으로 바꿉니다.
5. 첫 방문에 각 사용자가 승인 화면을 봅니다. Workspace 조직 **내부** 앱은 "확인되지 않은 앱" 경고가 붙지 않는 것이 일반적입니다(조직 정책에 따라 다름 — 아래 §5).

## 4. 서버 함수는 공개 엔드포인트다

`main.ts` 에서 `export` 한 모든 함수는 웹앱을 열 수 있는 사람이 브라우저 콘솔에서 `google.script.run.함수명()` 으로 **직접 호출**할 수 있습니다. UI 에 버튼이 없어도요.

- `USER_DEPLOYING` 이면 그 호출이 **배포자 권한**으로 실행됩니다. 쓰기·삭제 함수는 `assertDeployer()`(GasStart 의 `seedSampleData` 참고) 또는 허용 목록으로 반드시 보호하세요.
- 인자는 검증하세요(시트 이름·범위를 인자로 받으면 다른 탭을 덮어쓸 수 있음).
- 반환값은 방문자에게 그대로 보입니다. 보여 주지 않을 열/행은 서버에서 제거.
- 필요 없는 함수는 export 하지 마세요(`setup`, `showConfig` 처럼 편집기용 유틸은 운영 배포에서 빼도 됩니다).

## 5. Workspace 관리자 관점

관리자가 확인·통제할 수 있는 항목(관리 콘솔):

| 항목 | 위치 | 영향 |
|---|---|---|
| Apps Script 사용 허용 | 앱 → Google Workspace → Drive 및 Docs → Google Apps Script | 꺼져 있으면 사용자가 스크립트를 만들거나 실행할 수 없음 |
| Apps Script API | 같은 곳 → "사용자가 Apps Script API 를 사용할 수 있음" | 꺼져 있으면 **clasp 가 동작하지 않음**(`npm run setup` 2단계에서 감지) |
| OAuth 앱 액세스 제어 | 보안 → API 제어 → 앱 액세스 제어 | "제한됨" 정책이면 내부 스크립트도 신뢰 목록에 올려야 할 수 있음 |
| 외부 공유 | 앱 → Drive → 공유 설정 | `ANYONE` 배포·외부 시트 공유 가능 여부 |
| 감사 로그 | 보고 → 감사 및 조사 → Apps Script | 스크립트 실행·승인 기록 |

**"확인되지 않은 앱" 경고**: 개인 gmail 에서는 미심사 OAuth 앱이라 배포자 첫 승인 시 경고가 뜹니다(`docs/deploy.md §6`). Workspace 에서는 같은 조직 사용자에게 내부 앱으로 취급되어 경고 없이 승인 화면만 나오는 것이 보통이며, 관리자가 OAuth 정책을 "제한"으로 두면 스크립트를 신뢰 앱으로 등록해야 합니다.

**GCP 프로젝트 연결**: 기본은 Google 이 숨겨서 관리하는 프로젝트입니다. 회사 표준 GCP 프로젝트에 연결하면(편집기 → 프로젝트 설정) 조직 소유의 OAuth 동의 화면, Cloud Logging 보존 정책, `clasp run-function` 사용, 다른 Google API(BigQuery 등) 활성화가 가능합니다. 규제 산업이라면 처음부터 연결하는 것을 권합니다.

## 6. 한계와 할당량 (설계 전에 알아야 할 것)

숫자는 2026 년 기준 대략값이며 계정 종류(개인/Workspace)에 따라 다릅니다. 확정은 [공식 할당량 문서](https://developers.google.com/apps-script/guides/services/quotas) 로.

| 항목 | 값 | 대시보드에 미치는 영향 |
|---|---|---|
| 1회 실행 시간 | **6분** | `getDashboardData` 가 6분 안에 끝나야 함. 수십만 행이면 집계를 미리(Python/트리거) |
| 동시 실행 | 사용자당 약 30 | 수백 명이 동시에 새로고침하면 지연 가능. 캐시(`CacheService`, 최대 6시간) 권장 |
| URL Fetch (외부 API 호출) | 개인 2만/일, Workspace 10만/일 | 외부 데이터 수집은 트리거로 모아서 |
| 트리거 총 실행 시간 | 개인 90분/일, Workspace 6시간/일 | 5분 주기 ETL 트리거는 1회 실행이 짧아야 함 |
| 응답 크기 | `google.script.run` 반환값은 수 MB 수준이 실용 한계 | 행이 많으면 페이지네이션/집계 후 반환 |
| 스프레드시트 | 1천만 셀 | 시트는 DB 가 아님. 원장 데이터는 BigQuery/DB 에, 시트에는 집계만 |
| **커스텀 도메인 불가** | URL 은 항상 `script.google.com/macros/s/…` | 회사 도메인이 필요하면 `dash.company.com` → 웹앱 URL 리다이렉트, 또는 Google Sites 에 임베드(`XFrameOptionsMode.ALLOWALL` 필요) |
| 콜드 스타트 | 첫 요청 1~3초 | 정상. 로딩 상태 UI 로 대응(GasStart 포함) |
| 정적 파일 없음 | 이미지·폰트·JS 를 별도 URL 로 서빙 불가 | 모두 `index.html` 에 인라인(GasStart 빌드가 처리). 큰 이미지는 Drive 공개 링크 |

## 7. 운영: 로그, 버전, 트리거

- **로그**: `console.log()` 는 Cloud Logging 으로. 편집기 → 실행 탭에서 각 호출의 로그·오류·소요 시간 확인. `npm run open:dev`.
- **버전/롤백**: `deploy` 는 새 버전을 만들어 같은 URL 에 연결. 이전 버전으로 되돌리기: `npm run clasp -- prod list-versions` → `npm run clasp -- prod update-deployment <deploymentId> -V <version>`.
- **테스트 URL**: `/dev` 는 push 즉시 반영·편집 권한자만 접근(`docs/deploy.md §2`). 사용자에게는 `/exec` 만 공유.
- **정기 작업(트리거)**: 편집기 → 트리거 → 시간 기반. 예: 매 시간 외부 API → 시트 갱신(`UrlFetchApp`, 스코프 `script.external_request` 추가). 트리거는 **스크립트 소유자 권한**으로 실행.
- **캐시**: 자주 바뀌지 않는 집계는 `CacheService.getScriptCache()` 에 JSON 으로 몇 분 캐시하면 동시 접속에 강해집니다.
- **알림**: 오류 시 `MailApp.sendEmail` 로 담당자 알림(스코프 `script.send_mail`).

## 8. 체크리스트 — 사내 배포 전

- [ ] 배포 계정은 회사 Workspace 계정(개인 계정 퇴사 시 앱이 사라짐). 가능하면 **공용 서비스 계정 성격의 사용자 계정**으로 배포
- [ ] `access` 를 `DOMAIN` 으로, 필요하면 코드에서 허용 목록/그룹 확인
- [ ] 시트에 쓰는 함수마다 가드 확인, 불필요한 export 제거
- [ ] `oauthScopes` 최소화(사용하는 서비스만)
- [ ] 시트 공유 범위 점검 — `USER_DEPLOYING` 이면 시트를 공유하지 않아도 대시보드가 동작하므로, 시트는 편집자만 공유
- [ ] 개인정보가 있으면 반환값에서 제거하고, 접근 로그(`getActiveUser`) 남기기
- [ ] prod 는 별도 스크립트/시트(`npm run setup:prod`), `deploymentId` 를 `.clasp.prod.json` 에 유지해 URL 고정
- [ ] 관리자와 Apps Script API·OAuth 정책 확인(§5)
