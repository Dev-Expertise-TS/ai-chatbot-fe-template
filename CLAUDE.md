# AI Chatbot Frontend Template

- **모든 대화는 한국어로 진행한다.**
- **모든 아티팩트는 한국어로 작성한다.**

## 프로젝트 개요

AI Chatbot Frontend Application을 빠르게 구축하기 위한 템플릿 레포지토리

- VS Code Dev Container 사용
- Vercel의 Chatbot SDK 사용
  - [@vercel/ai-chatbot](https://github.com/vercel/ai-chatbot.git)의 코드 베이스를 클론 하여 시작함.

## 진행 사항 (2025-06-23)

### 완료된 작업 ✅

- [x] **초기화 스크립트 체계 구축**
  - [x] `init_dev_env.sh` 도입점 스크립트 생성
  - [x] `make_sure_env_local.sh` 환경 변수 설정 스크립트 생성
    - [x] `.env.local` 파일 존재 여부 확인 로직
    - [x] 대화식 환경 변수 입력 기능
    - [x] 필수 환경 변수 미입력 시 경고 메시지
    - [x] `****` 기본값 유지 시 경고 메시지
    - [x] `__REPLACE__` 플레이스홀더 포함 변수는 입력 받지 않도록 처리
  - [x] 환경 파일 정리 로직 추가
    - [x] `****` 값을 가진 환경 변수 자동 주석 처리
    - [x] 중복 라인 제거 (마지막 단계에서 수행)

- [x] **스크립트 파일 구조 정리**
  - [x] 모든 스크립트를 `.devcontainer` 디렉토리로 이동
  - [x] 스크립트 내 경로를 `.devcontainer` 기준으로 수정
  - [x] 모든 쉘 스크립트에 실행 권한(chmod +x) 부여

- [x] **Dev Container 설정 수정**
  - [x] `devcontainer.json`에서 `initializeCommand` 제거
  - [x] 수동 초기화 프로세스로 변경

- [x] **문서화**
  - [x] README.md에 Dev Container 실행 전 필수 초기화 과정 상세 안내
  - [x] 환경 변수 설정 가이드
  - [x] 플레이스홀더 치환 과정 설명

- [x] **한글화 및 UX 개선**
  - [x] `.env.example` 파일의 모든 영어 주석을 한글로 번역
  - [x] 환경 변수 입력 시 각 변수에 대한 설명 자동 표시
    - [x] `.env.example`의 주석을 파싱하여 안내 문구로 활용
    - [x] 📌 아이콘과 함께 노란색으로 설명 표시
    - [x] URL, "필수!", "선택사항" 같은 단독 라인은 자동 필터링

- [x] **환경 변수 기본값 지원**
  - [x] `.env.init_default` 파일 도입
  - [x] `make_sure_env_local.sh` 스크립트에서 `.env.init_default` 값을 기본값으로 사용
  - [x] 환경 변수 입력 시 `.env.init_default`의 값을 녹색으로 표시하여 기본값 안내
  - [x] `.env.local`에 값이 없을 때 `.env.init_default`의 값으로 자동 설정

### 주요 특징

1. **안전한 초기화 프로세스**: Dev Container 시작 전 모든 플레이스홀더와 환경 변수를 설정하여 컨테이너 시작 실패 방지
2. **자동 정리 기능**: 불필요한 환경 변수 자동 주석 처리 및 중복 제거
3. **사용자 친화적**: 대화식 입력과 명확한 안내 메시지 제공
4. **완전한 한글 지원**: 모든 설명과 안내가 한글로 제공되어 한국 개발자의 접근성 향상
5. **스마트한 기본값 지원**: `.env.init_default` 파일을 통해 개발 환경별 기본값 제공
