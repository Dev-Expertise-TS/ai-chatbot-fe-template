#!/usr/bin/env bash

# 공통 디버그 로그 함수 정의
# 모든 .devcontainer/*.sh 스크립트에서 이 파일을 source하여 사용

# 디버그 모드 플래그 (기본값: 비활성화)
DEBUG=${DEBUG:-0}

# 로그 디렉토리 설정
LOG_BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/tmp"

# 로그 디렉토리 생성 함수
ensure_log_dir() {
    if [ ! -d "$LOG_BASE_DIR" ]; then
        mkdir -p "$LOG_BASE_DIR"
    fi
}

# 로그 파일 경로 생성 함수
# 사용법: setup_log_file "script_name"
setup_log_file() {
    local script_name="$1"
    ensure_log_dir
    LOG_FILE="$LOG_BASE_DIR/${script_name}_$(date +%Y%m%d_%H%M%S).log"
}

# 로그 함수
log_debug() {
    if [ "$DEBUG" -eq 1 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] $1" >> "$LOG_FILE"
    fi
}

# 명령줄 인자에서 --debug 플래그 확인
check_debug_flag() {
    for arg in "$@"; do
        if [ "$arg" = "--debug" ]; then
            DEBUG=1
            return 0
        fi
    done
    return 1
}

# 디버그 초기화 함수
# 사용법: init_debug "script_name" "$@"
init_debug() {
    local script_name="$1"
    shift
    
    # --debug 플래그 확인
    if check_debug_flag "$@"; then
        DEBUG=1
    fi
    
    # 로그 파일 설정
    if [ "$DEBUG" -eq 1 ]; then
        setup_log_file "$script_name"
        log_debug "=== ${script_name} 시작 ==="
        log_debug "명령줄 인자: $*"
        
        # 디버그 모드 안내 출력
        echo "디버그 모드 활성화됨"
        echo "로그 파일: $LOG_FILE"
        echo ""
    fi
}

# 실행 시간 측정 함수
# 사용법: START_TIME=$(start_timer)
start_timer() {
    date +%s.%N
}

# 경과 시간 계산 함수
# 사용법: elapsed_time "$START_TIME"
elapsed_time() {
    local start_time="$1"
    local end_time=$(date +%s.%N)
    echo "$end_time - $start_time" | bc
}

# 디버그 종료 함수
# 사용법: finish_debug "script_name" "$START_TIME"
finish_debug() {
    local script_name="$1"
    local start_time="$2"
    
    if [ "$DEBUG" -eq 1 ] && [ -n "$start_time" ]; then
        local total_time=$(elapsed_time "$start_time")
        log_debug "=== ${script_name} 종료 (총 실행시간: ${total_time}초) ==="
    fi
}