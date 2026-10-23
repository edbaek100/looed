# 우리끼리 결재실 — 무료 배포

백은동·전하영·맹가은·김경민의 전자결재 놀이 앱입니다. 입장 비밀번호와 결재방 링크를 친구끼리 공유합니다. 이름 선택, 순서 변경, 승인 도장, 문서 수정, 전체 승인 기록, JSON 백업을 지원합니다. 열린 화면은 약 10초마다 최신 기록을 확인합니다.

## 무료 구성

| 역할 | 서비스 | 설정 |
|---|---|---|
| 웹 앱 | Render Web Service | **Free** (`render.yaml`의 `plan: free`) |
| 문서·승인 기록 | Supabase PostgreSQL | **Free 조직/프로젝트** |
| 공개 주소·HTTPS | Render 기본 주소 | `onrender.com` 주소 사용 |

유료 Render 디스크, Starter 인스턴스, Render 데이터베이스는 사용하지 않습니다. Supabase Pro, 사용자 도메인, 유료 백업도 필요 없습니다. 무료 서비스의 정책과 한도는 바뀔 수 있으므로 생성 화면에서 Free인지 확인하고 유료 업그레이드는 선택하지 마세요. 한도를 넘으면 중단/제한을 받아들이는 구성입니다.

Render의 무료 서버는 유휴 상태에서 잠들 수 있어 첫 접속이 늦을 수 있습니다. 서버의 로컬 파일은 재배포·재시작 시 사라질 수 있으므로 **배포에서는 Supabase가 없으면 앱 시작 자체를 거부**합니다. 기록은 Supabase에 보관되어 Render 재배포와 분리됩니다. Supabase 무료 프로젝트도 장기 미사용 시 일시 중지될 수 있습니다. 해당 대시보드에서 복구해야 하며, 무료 서비스만으로 무기한 보관이나 무중단 운영을 보장할 수는 없습니다. 중요한 기록은 아래 백업 버튼으로 따로 보관하세요.

공식 안내: [Render Free](https://render.com/docs/free), [Supabase Free 요금제](https://supabase.com/pricing), [Supabase API 키](https://supabase.com/docs/guides/api/api-keys).

## 직접 해야 할 작업 — 순서대로

### 1. GitHub에 코드 올리기

이 프로젝트의 파일을 `edbaek100/looed`에 커밋하고 `main` 브랜치에 푸시합니다. GitHub 웹의 파일 업로드 기능을 써도 됩니다. 저장소는 비공개여도 됩니다. 명령줄을 쓰는 경우 **프로젝트 폴더에서** 실행하세요.

```sh
git add .gitignore .dockerignore .env.example Dockerfile README.md package.json render.yaml server.js auth.js store.js server.test.js auth.test.js store.test.js public supabase scripts
git commit -m "Add password-protected approval app with free Render and Supabase setup"
git branch -M main
git push -u origin main
```

위 `git branch -M main`은 이 저장소가 기존 안내처럼 아직 첫 커밋을 만드는 상태일 때만 사용하세요. 이미 작업 중인 브랜치가 있다면 평소 사용하는 PR/병합 절차를 따르세요. `.env`, 실제 비밀번호, DB 키, `data/`의 문서는 업로드하지 않습니다. `.gitignore`와 `.dockerignore`로 제외해 두었습니다.

### 2. Supabase 무료 프로젝트 만들기

1. [Supabase](https://supabase.com/)에 가입하고 **Free 조직**에서 새 프로젝트를 만듭니다. Pro 업그레이드나 유료 옵션은 선택하지 않습니다.
2. 프로젝트 이름과 데이터베이스 비밀번호를 설정합니다. 이 DB 비밀번호는 앱 입장 비밀번호와 다른 값이며 이 앱에 입력할 필요가 없습니다.
3. 프로젝트의 **SQL Editor**를 열고 [`supabase/schema.sql`](supabase/schema.sql)의 전체 내용을 실행합니다.
4. **Table Editor**에서 `approval_rooms` 테이블과 RLS 활성화를 확인합니다. 브라우저 공개 접근 정책을 추가하거나 RLS를 끄지 마세요.
5. 프로젝트 설정/API 또는 Connect 화면에서 **Project URL**을 확인합니다. `https://프로젝트참조.supabase.co` 형식입니다.
6. API Keys 화면의 **Legacy API keys**에서 `service_role` 키를 확인합니다. 이 버전은 서버 전용 **legacy `service_role` JWT 키**를 사용합니다. `anon`, `publishable`, `sb_secret_…` 키를 대신 넣지 마세요. 키를 받을 수 없다면 익명 접근을 열지 말고 설정을 확인하세요.

`service_role` 키는 RLS를 우회하므로 Render 서버 환경 변수에만 넣습니다. 친구에게 보내거나 채팅, GitHub, 브라우저 코드, 스크린샷에 넣지 마세요. SQL은 공개 역할의 권한을 제거하고 서버 역할에 필요한 조회·추가·수정 권한만 부여합니다.

### 3. Render 무료 Web Service 배포

1. [Render](https://render.com/)에 가입하고 GitHub 저장소 접근을 연결합니다.
2. **New → Blueprint**에서 `edbaek100/looed`의 `main` 브랜치를 선택합니다.
3. 루트의 `render.yaml`이 적용됐는지 확인합니다. 서비스는 Web Service, 런타임은 Docker, 플랜은 **Free**여야 합니다. Disk/Database 리소스는 없어야 합니다.
4. 요청되는 환경 변수에 다음을 입력합니다.

   | 변수 | 넣을 값 |
   |---|---|
   | `APP_PASSWORD` | 친구끼리 공유할 **12자 이상** 입장 비밀번호. 길고 추측하기 어려운 새 값을 권장합니다. |
   | `SUPABASE_URL` | 2단계의 Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | 2단계의 legacy `service_role` 키 |
   | `SESSION_SECRET` | Blueprint가 자동 생성하므로 직접 만들 필요 없습니다. |
   | `NODE_ENV` | 파일에서 `production`으로 지정되어 있습니다. |

5. 유료 리소스가 없는지 확인한 뒤 배포합니다. `/health`로 서버 상태를 점검합니다.
6. Render가 제공한 **실제 HTTPS 주소**를 엽니다. 이 안내에는 아직 생성되지 않은 사이트 주소를 임의로 적지 않았습니다.

Blueprint 대신 **New → Web Service**로 만들 때도 Runtime Docker, Instance Type Free, Health Check Path `/health`를 선택하고 위 변수를 직접 추가하면 됩니다. 이 경우 `SESSION_SECRET`은 `openssl rand -hex 32` 등으로 만든 32자 이상의 무작위 값을 사용하세요. 명령은 본인의 기기에서 실행하고 결과는 Render 환경 변수에만 입력하세요.

### 4. 배포 후 확인하고 친구 초대하기

1. 비공개/시크릿 창에서 주소를 열어 **비밀번호 입장 화면**이 나오는지 확인합니다.
2. 잘못된 비밀번호로 입장이 거부되는지 확인합니다.
3. 올바른 비밀번호로 입장해 **첫 결재 올리기**를 누릅니다. DB 설정 문제는 방 생성 시 오류로 표시됩니다. `/health` 성공만으로 DB 연결 성공을 뜻하지는 않습니다.
4. **초대 링크 복사**를 누릅니다. 끝의 `#room=…`까지 포함한 전체 링크를 친구에게 보냅니다. 비밀번호는 별도로 알려주세요.
5. 다른 기기/시크릿 창에서 같은 링크와 비밀번호로 들어와 순서를 바꾸고, 차례인 사람의 이름을 선택해 승인합니다. 약 10초 안에 양쪽에서 같은 도장과 기록이 보여야 합니다.
6. Render에서 수동 재배포한 뒤 **같은 방 링크**로 다시 접속해 문서와 승인 기록이 남아 있는지 확인합니다. 이것이 실제 외부 DB 영속성 확인입니다.
7. 필요할 때 **기록 백업 ↓**를 눌러 현재 문서·순서·도장·전체 기록이 포함된 JSON 파일을 보관합니다. Supabase 무료 플랜의 자동 백업을 전제로 하지 않습니다.

### 5. 이후 관리

- 비밀번호 변경: Render Environment의 `APP_PASSWORD`를 변경하고 재배포합니다. 모든 기존 로그인 쿠키가 무효화됩니다. 친구에게 새 비밀번호를 알려주세요. 문서와 기록은 남습니다.
- 키 유출: Supabase에서 서버 키를 교체하고 Render의 대응 값을 수정한 뒤 재배포합니다.
- 사용 후 **나가기**를 누르면 해당 브라우저의 로그인 쿠키를 지웁니다. 기본 로그인 유효기간은 7일입니다.
- 잘못된 비밀번호를 서버 전체에서 15분 동안 10번 입력하면 남은 시간 동안 로그인이 제한됩니다. 이 시도 제한은 메모리 기반이라 서버 재시작 시 초기화됩니다.
- 서버가 잠들면 첫 화면이 늦을 수 있습니다. Supabase가 중지되었다면 프로젝트 대시보드에서 재개한 뒤 다시 시도합니다. 유료로 변경하지 않아도 되는지 해당 서비스 안내를 확인하세요.
- 비밀번호와 링크를 모두 전달받은 사람은 입장할 수 있습니다. 공유 비밀번호는 친구의 실명을 인증하지 않으며, 입장한 친구는 네 이름 중 누구든 선택할 수 있습니다. 유출이 의심되면 비밀번호를 바꾸세요.
- 모든 방은 **앱 공통 입장 비밀번호**를 사용합니다. 방마다 다른 비밀번호를 설정하는 방식은 아닙니다. 방 목록을 공개하는 API는 없으며 방 링크는 무작위로 생성됩니다.

## 기존 로컬 기록 옮기기 (있는 경우만)

예전 버전의 `data/`에 보존할 결재방이 있다면 Render 배포 전에 실행합니다. `.env`에 위 Supabase URL과 서버 키를 안전하게 설정하고, 스키마를 먼저 적용합니다.

```sh
node scripts/import-local.js ./data
```

기존 방 ID를 유지하며 DB로 복사합니다. 이미 DB에 있는 ID는 건너뛰고 덮어쓰거나 로컬 원본을 삭제하지 않습니다. 기존 서비스와 호스트가 달라졌다면 새 Render 주소 뒤에 동일한 `#room=방ID`를 붙이세요. 이 스크립트는 기존 앱의 로컬 파일을 옮기는 도구이며 백업 JSON의 자동 복원 UI는 제공하지 않습니다.

## 로컬 개발과 검증

Node.js 22 이상, 외부 npm 패키지는 필요 없습니다.

```sh
cp .env.example .env
# .env에서 APP_PASSWORD(12자 이상), SESSION_SECRET(32자 이상)을 직접 설정
npm test
npm start
```

로컬 개발에서 Supabase 두 변수를 모두 비워 두면 `data/` 파일 저장소를 사용합니다. 운영 모드에서는 반드시 Supabase를 사용합니다. 파일 저장소는 단일 프로세스 개발용입니다. `.env`에 넣는 값에 `#`, 공백 등이 있으면 따옴표로 감싸세요. 프로덕션 비밀번호를 개발용으로 재사용하지 마세요.

테스트는 인증 우회 차단, 쿠키 변조/만료/비밀번호 변경, 로그인 시도 제한, 교차 출처 요청 차단, 동시 승인 충돌, 기록 50건 초과 보존, 새 앱 인스턴스의 로컬 기록 복원을 검사합니다. Supabase 어댑터는 모의 REST 응답으로 요청 형식·원자적 버전 검사를 검증합니다. 실제 Supabase 계정 연결, SQL 적용, Render 배포는 사용자 설정 후 4단계에서 별도로 확인해야 합니다.
