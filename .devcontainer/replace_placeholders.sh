#!/usr/bin/env bash

# AI Chatbot Frontend Template - Placeholder 치환 스크립트
# 이 스크립트는 프로젝트의 모든 파일에서 __REPLACE__로 시작하는 placeholder를 찾아
# 사용자로부터 값을 입력받아 치환합니다.

set -e

# 디버그 모드 설정 (환경변수로 제어 가능)
DEBUG=${DEBUG:-1}  # 기본값: 디버그 활성화

# 로그 파일 설정
LOG_DIR="/tmp"
LOG_FILE="$LOG_DIR/replace_placeholders_$(date +%Y%m%d_%H%M%S).log"

# 로그 함수
log_debug() {
    if [ "$DEBUG" -eq 1 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S.%3N')] $1" >> "$LOG_FILE"
    fi
}

# 시작 시간 기록
START_TIME=$(date +%s.%N)
log_debug "=== 스크립트 시작 ==="

# 스크립트 위치에서 프로젝트 루트로 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
cd "$PROJECT_ROOT"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== AI Chatbot Frontend Template - Placeholder 치환 스크립트 ===${NC}"
echo -e "프로젝트 루트: $PROJECT_ROOT"
echo -e "로그 파일: $LOG_FILE"
echo ""

log_debug "프로젝트 루트: $PROJECT_ROOT"

# 제외할 디렉토리 패턴
EXCLUDE_DIRS="node_modules|.git|__pycache__|cache|.cache|.next|.pnpm-store|.pnpm|dist|build"

# 모든 고유한 placeholder 찾기
echo -e "${YELLOW}프로젝트에서 placeholder를 검색 중...${NC}"
SEARCH_START=$(date +%s.%N)
log_debug "Placeholder 검색 시작"
# 길이 역순으로 정렬하여 긴 플레이스홀더부터 치환하도록 함
log_debug "grep 명령 실행 중..."
PLACEHOLDERS=$(grep -r "__REPLACE__[A-Z_]*" . --exclude-dir={node_modules,.git,__pycache__,cache,.cache,.next,.pnpm-store,.pnpm,dist,build} --exclude=".env.example" -h 2>/dev/null | grep -o "__REPLACE__[A-Z_]*" | grep -v "^__REPLACE__$" | sort | uniq | awk '{ print length, $0 }' | sort -rn | cut -d" " -f2-)

SEARCH_END=$(date +%s.%N)
SEARCH_TIME=$(echo "$SEARCH_END - $SEARCH_START" | bc)
log_debug "Placeholder 검색 완료 (소요시간: ${SEARCH_TIME}초)"

if [ -z "$PLACEHOLDERS" ]; then
    echo -e "${GREEN}치환할 placeholder가 없습니다.${NC}"
    log_debug "검색 결과: placeholder 없음"
    exit 0
fi

# 찾은 placeholder 표시
PLACEHOLDER_COUNT=$(echo "$PLACEHOLDERS" | wc -l)
log_debug "찾은 placeholder 개수: $PLACEHOLDER_COUNT"
echo -e "${GREEN}다음 placeholder들을 찾았습니다:${NC}"
echo "$PLACEHOLDERS" | nl -w2 -s'. '
echo ""

# 각 placeholder에 대한 설명을 임시 파일에 저장
DESC_FILE=$(mktemp)
cat > "$DESC_FILE" << 'EOF'
__REPLACE__APP_NAME|챗봇 웹앱(컨테이너/서비스) 이름
__REPLACE__APP_PORT|챗봇 웹앱 expose & 내부 포트 번호
__REPLACE__CUSTOM_AI_MODEL|사용할 커스텀 AI 모델 이름
__REPLACE__PROJECT_NAME|프로젝트/dev container 컴포즈 이름
__REPLACE__LOCAL_DB_HOST|로컬 데이터베이스 호스트
__REPLACE__LOCAL_DB_NAME|로컬 데이터베이스 이름
__REPLACE__LOCAL_DB_PORT|로컬 데이터베이스 expose 포트 번호
__REPLACE__LOCAL_DB_PW|로컬 데이터베이스 비밀번호
__REPLACE__LOCAL_DB_USER|로컬 데이터베이스 사용자명
__REPLACE__NETWORK|Docker 네트워크 이름
EOF

# 치환 값 저장할 임시 파일
REPL_FILE=$(mktemp)

# 각 placeholder에 대해 사용자 입력 받기
echo -e "${YELLOW}각 placeholder에 대한 값을 입력해주세요:${NC}"
echo ""

for placeholder in $PLACEHOLDERS; do
    # 설명 가져오기
    description=$(grep "^${placeholder}|" "$DESC_FILE" 2>/dev/null | cut -d'|' -f2)
    if [ -z "$description" ]; then
        description="값"
    fi
    
    # 사용자 입력 받기
    while true; do
        echo -ne "${BLUE}$placeholder${NC} ($description): "
        read -r value < /dev/tty
        if [ -n "$value" ]; then
            echo "${placeholder}|${value}" >> "$REPL_FILE"
            break
        else
            echo -e "${RED}값을 입력해주세요.${NC}"
        fi
    done
done

echo ""
echo -e "${YELLOW}입력하신 값들:${NC}"
while IFS='|' read -r key value; do
    echo -e "  ${BLUE}$key${NC} → ${GREEN}${value}${NC}"
done < "$REPL_FILE"

echo ""
echo -ne "${YELLOW}이대로 치환을 진행하시겠습니까? (y/N): ${NC}"
read -r confirm < /dev/tty

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo -e "${RED}치환을 취소했습니다.${NC}"
    exit 0
fi


# 치환 수행
echo ""
echo -e "${YELLOW}파일들을 치환 중...${NC}"

# 치환할 파일 목록 가져오기 (자기 자신은 제외)
# find 명령어에서 -prune을 사용하여 제외 디렉토리를 효율적으로 처리
FIND_START=$(date +%s.%N)
log_debug "파일 검색 시작 (find 명령)"

# 디버그를 위해 find 명령을 단계별로 실행
if [ "$DEBUG" -eq 1 ]; then
    log_debug "제외할 디렉토리 확인 중..."
    find . -type d \( -name "node_modules" -o -name ".git" -o -name "__pycache__" -o \
           -name "cache" -o -name ".cache" -o -name ".next" -o \
           -name ".pnpm-store" -o -name ".pnpm" -o -name "dist" -o \
           -name "build" \) -print 2>/dev/null | while read dir; do
        log_debug "  제외 디렉토리 발견: $dir"
    done
fi

# 더 명확한 find 명령 사용
FILES=$(find . \
    -path "./node_modules" -prune -o \
    -path "./.git" -prune -o \
    -path "./__pycache__" -prune -o \
    -path "./cache" -prune -o \
    -path "./.cache" -prune -o \
    -path "./.next" -prune -o \
    -path "./.pnpm-store" -prune -o \
    -path "./.pnpm" -prune -o \
    -path "./dist" -prune -o \
    -path "./build" -prune -o \
    -type f -name "*" ! -path "./.devcontainer/replace_placeholders.sh" ! -name ".env.example" \
    -print 2>/dev/null | xargs grep -l "__REPLACE__" 2>/dev/null || true)

FIND_END=$(date +%s.%N)
FIND_TIME=$(echo "$FIND_END - $FIND_START" | bc)
log_debug "파일 검색 완료 (소요시간: ${FIND_TIME}초)"

if [ -z "$FILES" ]; then
    echo -e "${GREEN}치환할 파일이 없습니다.${NC}"
    log_debug "치환할 파일 없음"
    exit 0
fi

# 파일 개수 로깅
FILE_COUNT=$(echo "$FILES" | wc -l)
log_debug "치환할 파일 개수: $FILE_COUNT"

# 각 파일 처리
PROCESS_START=$(date +%s.%N)
FILE_NUM=0
for file in $FILES; do
    FILE_NUM=$((FILE_NUM + 1))
    FILE_START=$(date +%s.%N)
    log_debug "[$FILE_NUM/$FILE_COUNT] 파일 처리 시작: $file"
    
    # 임시 파일 생성
    temp_file=$(mktemp)
    cp "$file" "$temp_file"
    
    # 모든 placeholder 치환
    REPLACEMENT_COUNT=0
    while IFS='|' read -r placeholder value; do
        # sed를 사용하여 치환 (macOS와 Linux 모두 호환)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|${placeholder}|${value}|g" "$temp_file"
        else
            sed -i "s|${placeholder}|${value}|g" "$temp_file"
        fi
        REPLACEMENT_COUNT=$((REPLACEMENT_COUNT + 1))
    done < "$REPL_FILE"
    
    # 원본 파일 교체
    mv "$temp_file" "$file"
    
    FILE_END=$(date +%s.%N)
    FILE_TIME=$(echo "$FILE_END - $FILE_START" | bc)
    log_debug "[$FILE_NUM/$FILE_COUNT] 파일 처리 완료: $file (${REPLACEMENT_COUNT}개 치환, ${FILE_TIME}초)"
    echo -e "  ${GREEN}✓${NC} $file"
done

PROCESS_END=$(date +%s.%N)
PROCESS_TIME=$(echo "$PROCESS_END - $PROCESS_START" | bc)
log_debug "모든 파일 처리 완료 (총 소요시간: ${PROCESS_TIME}초)"

echo ""
echo -e "${GREEN}모든 placeholder가 성공적으로 치환되었습니다!${NC}"

# 전체 실행 시간 계산
END_TIME=$(date +%s.%N)
TOTAL_TIME=$(echo "$END_TIME - $START_TIME" | bc)
log_debug "=== 스크립트 종료 (총 실행시간: ${TOTAL_TIME}초) ==="
echo ""
echo -e "${BLUE}디버그 로그가 저장되었습니다: ${LOG_FILE}${NC}"

# 임시 파일 정리
rm -f "$DESC_FILE" "$REPL_FILE"