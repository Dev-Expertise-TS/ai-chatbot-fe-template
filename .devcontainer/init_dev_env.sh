#!/bin/bash

# AI Chatbot Frontend 개발 환경 초기화 스크립트

# 스크립트 경로 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# 공통 디버그 함수 로드
source "$SCRIPT_DIR/debug_common.sh"

# 디버그 초기화 (--debug 플래그 확인 및 로그 설정)
init_debug "init_dev_env" "$@"

# 시작 시간 기록
START_TIME=$(start_timer)

echo "🚀 AI Chatbot Frontend 개발 환경 초기화를 시작합니다..."
echo ""

log_debug "프로젝트 루트: $PROJECT_ROOT"

# 1. 환경 변수 설정
echo "📋 환경 변수 설정을 시작합니다..."
log_debug "환경 변수 설정 시작"
ENV_START=$(start_timer)

if [ -f "$SCRIPT_DIR/make_sure_env_local.sh" ]; then
    # --debug 플래그 전달
    DEBUG_FLAG=""
    if [ "$DEBUG" -eq 1 ]; then
        DEBUG_FLAG="--debug"
    fi
    
    # source 명령을 사용하여 현재 셸에서 실행 (stdin 전달을 위해)
    source "$SCRIPT_DIR/make_sure_env_local.sh" $DEBUG_FLAG
    if [ $? -ne 0 ]; then
        echo "❌ 환경 변수 설정 중 오류가 발생했습니다."
        log_debug "환경 변수 설정 실패"
        exit 1
    fi
    ENV_TIME=$(elapsed_time "$ENV_START")
    log_debug "환경 변수 설정 완료 (소요시간: ${ENV_TIME}초)"
else
    echo "❌ make_sure_env_local.sh 파일을 찾을 수 없습니다."
    log_debug "make_sure_env_local.sh 파일 없음"
    exit 1
fi

echo ""

# 2. 플레이스홀더 치환
echo "🔄 플레이스홀더 치환을 시작합니다..."
log_debug "플레이스홀더 치환 시작"
PLACEHOLDER_START=$(start_timer)

if [ -f "$SCRIPT_DIR/replace_placeholders.sh" ]; then
    # --debug 플래그 전달
    DEBUG_FLAG=""
    if [ "$DEBUG" -eq 1 ]; then
        DEBUG_FLAG="--debug"
    fi
    
    bash "$SCRIPT_DIR/replace_placeholders.sh" $DEBUG_FLAG
    if [ $? -ne 0 ]; then
        echo "❌ 플레이스홀더 치환 중 오류가 발생했습니다."
        log_debug "플레이스홀더 치환 실패"
        exit 1
    fi
    PLACEHOLDER_TIME=$(elapsed_time "$PLACEHOLDER_START")
    log_debug "플레이스홀더 치환 완료 (소요시간: ${PLACEHOLDER_TIME}초)"
else
    echo "❌ replace_placeholders.sh 파일을 찾을 수 없습니다."
    log_debug "replace_placeholders.sh 파일 없음"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  주의사항:"
echo "컨테이너 최초 빌드/런 후 첫 대화 시도시 오류가 말생한다면,"
echo "브라우저의 쿠키/사이트 데이터를 삭제해주세요."
echo ""
echo "Chrome: 개발자 도구 > 애플리케이션 > 저장용량 > 사이트 데이터 삭제"
echo "Firefox: 개발자 도구 > 저장소 > 쿠키 > 모두 삭제"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo ""
echo "✅ 개발 환경 초기화가 완료되었습니다!"
echo ""
echo "이제 VS Code Dev Container로 개발을 시작하세요."
echo ""

# 디버그 종료
finish_debug "init_dev_env" "$START_TIME"