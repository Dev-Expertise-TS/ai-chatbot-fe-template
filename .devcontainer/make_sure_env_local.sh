#!/usr/bin/env bash

# 스크립트 경로
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# 공통 디버그 함수 로드
source "$SCRIPT_DIR/debug_common.sh"

# 디버그 초기화 (--debug 플래그 확인 및 로그 설정)
init_debug "make_sure_env_local" "$@"

# 시작 시간 기록
START_TIME=$(start_timer)

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
ENV_EXAMPLE="$PROJECT_ROOT/.env.example"
ENV_LOCAL="$PROJECT_ROOT/.env.local"
ENV_DEFAULT="$PROJECT_ROOT/.env.init_default"

# 필수 환경 변수 목록
REQUIRED_VARS=("AUTH_SECRET" "POSTGRES_URL")

# 기존 .env.local 파일이 있으면 삭제
if [ -f "$ENV_LOCAL" ]; then
    echo -e "${YELLOW}⚠️  기존 .env.local 파일을 삭제합니다...${NC}"
    log_debug "기존 .env.local 파일 삭제"
    rm -f "$ENV_LOCAL"
fi

# .env.example을 복사하여 새로운 .env.local 생성
echo -e "${BLUE}📋 .env.example을 복사하여 새로운 .env.local 파일을 생성합니다...${NC}"
log_debug ".env.example을 .env.local로 복사 중"
cp "$ENV_EXAMPLE" "$ENV_LOCAL"
echo -e "${GREEN}✅ .env.local 파일이 생성되었습니다.${NC}"
echo ""
log_debug ".env.local 파일 생성 완료"

# 환경 변수 읽기 함수
read_env_var() {
    local var_name=$1
    local file_path=$2
    grep "^${var_name}=" "$file_path" 2>/dev/null | cut -d '=' -f2-
}

# 환경 변수 설정 함수
set_env_var() {
    local var_name=$1
    local var_value=$2
    local file_path=$3
    
    # 임시 파일 생성
    local temp_file=$(mktemp)
    
    # 기존 파일을 읽어서 해당 변수를 찾아 교체
    local found=false
    while IFS= read -r line; do
        if [[ "$line" =~ ^${var_name}= ]]; then
            echo "${var_name}=${var_value}" >> "$temp_file"
            found=true
        else
            echo "$line" >> "$temp_file"
        fi
    done < "$file_path"
    
    # 변수를 찾지 못했으면 추가
    if [ "$found" = "false" ]; then
        echo "${var_name}=${var_value}" >> "$temp_file"
    fi
    
    # 임시 파일을 원본으로 이동
    mv "$temp_file" "$file_path"
}

# 환경 변수 입력 함수
prompt_for_env_var() {
    local var_name=$1
    local current_value=$2
    local is_required=$3
    local description=$4
    local default_value=$5
    local prompt_message="$var_name"
    
    # 필수 여부 표시
    if [ "$is_required" = "true" ]; then
        prompt_message="${prompt_message} (필수)"
    else
        prompt_message="${prompt_message} (선택)"
    fi
    
    # 현재 값 표시 (비밀번호 형태의 값은 일부만 표시)
    if [ -n "$current_value" ]; then
        if [[ "$current_value" == *"****"* ]] || [ ${#current_value} -gt 20 ]; then
            display_value="${current_value:0:10}..."
        else
            display_value="$current_value"
        fi
        prompt_message="${prompt_message} [현재값: ${display_value}]"
    else
        prompt_message="${prompt_message} [현재값: 없음]"
    fi
    
    # .env.init_default 값이 있고 현재 값과 다르면 표시
    if [ -n "$default_value" ] && [ "$default_value" != "$current_value" ]; then
        if [[ "$default_value" == *"****"* ]] || [ ${#default_value} -gt 20 ]; then
            default_display="${default_value:0:10}..."
        else
            default_display="$default_value"
        fi
        prompt_message="${prompt_message} ${GREEN}[기본값: ${default_display}]${NC}"
    fi
    
    # 설명이 있으면 표시
    if [ -n "$description" ]; then
        echo -e "${YELLOW}📌 ${description}${NC}" >&2
    fi
    
    echo -e "${BLUE}${prompt_message}${NC}" >&2
    echo -n "새로운 값을 입력하세요 (Enter로 건너뛰기): " >&2
    read -r new_value < /dev/tty
    
    # 입력값 처리
    if [ -z "$new_value" ]; then
        # 입력값이 없는 경우
        if [ -z "$current_value" ]; then
            # 현재 값도 없는 경우
            if [ "$is_required" = "true" ]; then
                echo -e "${YELLOW}⚠️  경고: 필수 환경 변수 ${var_name}이 설정되지 않았습니다. 애플리케이션이 정상 동작하지 않을 수 있습니다.${NC}" >&2
            fi
        elif [[ "$current_value" == "****" ]]; then
            # 기본값이 ****인 경우
            echo -e "${YELLOW}⚠️  경고: ${var_name}의 값이 ****로 설정되어 있습니다. 애플리케이션이 정상 동작하지 않을 수 있습니다.${NC}" >&2
        fi
        echo "$current_value"
    else
        echo "$new_value"
    fi
}

echo -e "${GREEN}🔧 환경 변수 설정을 시작합니다...${NC}"
echo ""
echo "각 환경 변수에 대해 새로운 값을 입력하거나 Enter를 눌러 현재 값을 유지하세요."
echo ""

# 임시 파일 생성
TEMP_FILE=$(mktemp)
cp "$ENV_LOCAL" "$TEMP_FILE"

# 환경 변수와 설명을 저장할 임시 파일
DESC_FILE=$(mktemp)

# .env.example에서 환경 변수와 주석 추출
current_description=""
while IFS= read -r line; do
    # 주석 라인이면 설명으로 저장
    if [[ "$line" =~ ^[[:space:]]*#[[:space:]]*(.+)$ ]]; then
        comment="${BASH_REMATCH[1]}"
        # URL이나 "필수!", "선택사항" 같은 단독 라인은 제외
        if [[ ! "$comment" =~ ^(http|필수!|선택사항).*$ ]]; then
            if [ -z "$current_description" ]; then
                current_description="$comment"
            else
                current_description="$current_description $comment"
            fi
        fi
        continue
    fi
    
    # 빈 줄이면 설명 초기화
    if [[ -z "$line" ]]; then
        current_description=""
        continue
    fi
    
    # 환경 변수 라인이면 처리
    if [[ "$line" =~ ^([A-Z_]+[A-Z0-9_]*)= ]]; then
        var_name="${BASH_REMATCH[1]}"
        
        # 현재까지 수집한 설명이 있으면 저장
        if [ -n "$current_description" ]; then
            echo "${var_name}|${current_description}" >> "$DESC_FILE"
        fi
        current_description=""
    fi
done < "$ENV_EXAMPLE"

# 다시 파일을 읽어서 환경 변수 처리
while IFS= read -r line; do
    # 빈 줄이나 주석은 건너뛰기
    if [[ -z "$line" ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
        continue
    fi
    
    # 환경 변수 이름 추출
    if [[ "$line" =~ ^([A-Z_]+[A-Z0-9_]*)= ]]; then
        var_name="${BASH_REMATCH[1]}"
        
        # 현재 값 가져오기
        current_value=$(read_env_var "$var_name" "$ENV_LOCAL")
        
        # .env.init_default에서 기본값 가져오기 (존재하는 경우)
        default_value=""
        if [ -f "$ENV_DEFAULT" ]; then
            default_value=$(read_env_var "$var_name" "$ENV_DEFAULT")
        fi
        
        # .env.init_default에 값이 있으면 무조건 사용 (최우선)
        if [ -n "$default_value" ]; then
            current_value="$default_value"
        elif [ -z "$current_value" ]; then
            # .env.init_default에 없고 현재 값도 없으면 .env.example에서 가져오기
            current_value=$(read_env_var "$var_name" "$ENV_EXAMPLE")
        fi
        
        # 필수 여부 확인
        is_required="false"
        for required_var in "${REQUIRED_VARS[@]}"; do
            if [ "$var_name" = "$required_var" ]; then
                is_required="true"
                break
            fi
        done
        
        # __REPLACE__ 플레이스홀더가 있는 경우 건너뛰기
        if [[ "$current_value" == *"__REPLACE__"* ]]; then
            echo -e "${BLUE}${var_name}: 플레이스홀더가 포함된 환경 변수입니다. 건너뜁니다.${NC}" >&2
            # 현재 값 그대로 유지
            set_env_var "$var_name" "$current_value" "$TEMP_FILE"
        else
            # 설명 가져오기
            description=$(grep "^${var_name}|" "$DESC_FILE" 2>/dev/null | cut -d'|' -f2-)
            
            # 사용자 입력 받기
            new_value=$(prompt_for_env_var "$var_name" "$current_value" "$is_required" "$description" "$default_value")
            
            # 값 설정
            if [ -n "$new_value" ]; then
                set_env_var "$var_name" "$new_value" "$TEMP_FILE"
            fi
        fi
        
        echo "" >&2
    fi
done < "$ENV_EXAMPLE"

# 임시 파일을 원본으로 복사
mv "$TEMP_FILE" "$ENV_LOCAL"

# 정리 작업 수행
echo -e "${BLUE}📋 환경 파일을 정리하는 중...${NC}"

# 1단계: **** 값을 가진 환경 변수 주석 처리
CLEANUP_TEMP=$(mktemp)

while IFS= read -r line; do
    # 환경 변수 라인인지 확인
    if [[ "$line" =~ ^([A-Z_]+[A-Z0-9_]*)=(.*)$ ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_value="${BASH_REMATCH[2]}"
        
        # **** 값은 주석 처리
        if [[ "$var_value" == "****" ]]; then
            echo "# $line" >> "$CLEANUP_TEMP"
            echo -e "${YELLOW}  - ${var_name}을(를) 주석 처리했습니다 (기본값: ****)${NC}"
        else
            echo "$line" >> "$CLEANUP_TEMP"
        fi
    else
        # 환경 변수가 아닌 라인은 그대로 유지
        echo "$line" >> "$CLEANUP_TEMP"
    fi
done < "$ENV_LOCAL"

# 첫 번째 정리 결과를 다시 .env.local로
mv "$CLEANUP_TEMP" "$ENV_LOCAL"

# 2단계: 중복 라인 제거
echo -e "${BLUE}📋 중복 라인을 제거하는 중...${NC}"
DEDUP_TEMP=$(mktemp)

# 중복 제거
SEEN_FILE=$(mktemp)
last_was_empty=false

while IFS= read -r line; do
    # 빈 줄 처리 (연속된 빈 줄 방지)
    if [[ -z "$line" ]]; then
        if [[ "$last_was_empty" == "false" ]]; then
            echo "" >> "$DEDUP_TEMP"
            last_was_empty=true
        fi
        continue
    fi
    last_was_empty=false
    
    # 중복 체크
    if ! grep -Fxq "$line" "$SEEN_FILE" 2>/dev/null; then
        echo "$line" >> "$DEDUP_TEMP"
        echo "$line" >> "$SEEN_FILE"
    fi
done < "$ENV_LOCAL"

# 임시 파일 정리
rm -f "$SEEN_FILE"

# 최종 정리된 파일로 교체
mv "$DEDUP_TEMP" "$ENV_LOCAL"

echo -e "${GREEN}✅ 환경 변수 설정이 완료되었습니다!${NC}"
echo ""
echo -e "${BLUE}설정된 환경 변수는 ${ENV_LOCAL} 파일에서 확인할 수 있습니다.${NC}"

# 임시 파일 정리
rm -f "$DESC_FILE"

# 디버그 종료
finish_debug "make_sure_env_local" "$START_TIME"