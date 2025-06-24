# CX DM AI Chatbot FE Temp

CX DM AI Chatbot Web Frontend 개발 속도 향상을 위한 템플릿 레포지토리 입니다.

## 개발 시작하기

### 사전 요구사항

- Docker Desktop
- VS Code
- VS Code Dev Containers extension

### 초기 설정 (중요!)

**⚠️ 주의: Dev Container를 시작하기 전에 반드시 아래 단계를 먼저 수행해야 합니다.**

이 템플릿은 프로젝트 전반에 플레이스홀더(`__REPLACE__`로 시작하는 값들)를 포함하고 있습니다.
Dev Container를 시작하기 전에 이 값들을 실제 값으로 치환해야 합니다.
이 템플릿에는 대화형 초기화 스크립트를 제공합니다. 그러나 이 스크립트는 일회용으로써 한번 초기화 된 후 이를 추적하여 지속적인 수정/업데이트가 가능하도록 하는 스크립트는 없습니다. 따라서 초기화에 잘못된 값을 입력한 경우, 직접 찾아서 고치기 힘들 다면 레포지토리 폴더를 삭제하고 처음부터 다시 시작하는 것을 권합니다.

#### 1. 초기화 스크립트 실행

터미널에서 다음 명령을 실행하세요:

```bash
# 프로젝트 루트에서 실행
./.devcontainer/init_dev_env.sh
```

이 스크립트는 다음 작업을 수행합니다:

- 환경 변수 파일(`.env.local`) 생성 및 설정
- 프로젝트 내 모든 플레이스홀더 값 치환

#### 2. 환경 변수 설정

스크립트 실행 시 다음과 같은 환경 변수를 입력하게 됩니다:

**필수 환경 변수:**

- `AUTH_SECRET`: 인증용 시크릿 키 (32자 이상 권장)
- `POSTGRES_URL`: PostgreSQL 연결 URL

**선택 환경 변수:**

- `OPENAI_API_KEY`: OpenAI API 키
- `XAI_API_KEY`: xAI API 키
- 기타 AI 모델 관련 설정

**환경 변수 기본값 지원:**

`.env.init_default` 파일이 존재하는 경우, 스크립트가 자동으로 이 파일의 값을 기본값으로 사용합니다:

- 환경 변수 입력 시 녹색으로 기본값이 표시됩니다
- Enter 키를 눌러 기본값을 그대로 사용할 수 있습니다
- 팀이나 프로젝트별로 `.env.init_default` 파일을 관리하여 개발 환경을 표준화할 수 있습니다

예시 `.env.init_default`:

```bash
# 개발 환경 기본값
AUTH_SECRET=dev-secret-key-for-local-development
POSTGRES_URL=postgresql://postgres:password@localhost:5432/devdb
OPENAI_API_KEY=sk-your-dev-api-key
```

#### 3. 플레이스홀더 치환

다음과 같은 프로젝트 설정값을 입력하게 됩니다:

- 애플리케이션 이름
- 포트 번호
- 데이터베이스 설정
- Docker 네트워크 이름
- 기타 프로젝트별 설정

### Dev Container 시작

위 초기 설정이 완료된 후:

1. VS Code에서 프로젝트 폴더 열기
2. `Ctrl+Shift+P` (또는 `Cmd+Shift+P`)로 명령 팔레트 열기
3. "Dev Containers: Reopen in Container" 선택
4. 컨테이너가 빌드되고 시작될 때까지 대기

### 개발 서버 실행

Dev Container 내에서:

```bash
npm run dev
```

브라우저에서 `http://localhost:[설정한 포트]`로 접속하여 확인할 수 있습니다.

## 알려진 문제 해결법

### 1. 웹앱 정상 구동 상태에서 채팅 시도시 404 또는 400 에러가 발생하는 경우

웹 브라우저의 인스펙터 패널을 열고 모든 사용자 데이터를 지워 주세요.
브라우저에 남아 있는 캐시성 데이터가 문제인 것으로 보입니다. 정확한 원인은 파악하지 못한 상황입니다. 그러나 해결법은 찾았습니다.

- **구글 크롬 브라우저에서의 예**:
  1. 좌측 상단 부근 `크롬 맞춤 설정 및 제어 (세로로 나열 된 점 세 개 버튼)`메뉴
  2. `도구 더보기`
  3. `개발자 도구`
  4. 개발자 도구 패널 상단의 `애플리케이션` 탭
  5. `어플리케이션` 좌측 패널의 `저장용량` 탭
  6. 세번째 섹션에서 `타사 쿠키 포함` 체크인
  7. 동 섹션에서 `사이트 데이터 삭제 버튼` 클릭
  - ![MacOS 구글 크롭 브라우저에서 사이트 데이터 삭제 버튼의 위치](./documentation_assets/trouble_shoot_1.png)
