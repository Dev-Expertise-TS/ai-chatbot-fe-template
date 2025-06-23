#!/bin/bash

# AI Chatbot Frontend 개발 환경 초기화 스크립트

echo "🚀 AI Chatbot Frontend 개발 환경 초기화를 시작합니다..."
echo ""

# 스크립트 경로 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# 1. 환경 변수 설정
echo "📋 환경 변수 설정을 시작합니다..."
if [ -f "$SCRIPT_DIR/make_sure_env_local.sh" ]; then
    # source 명령을 사용하여 현재 셸에서 실행 (stdin 전달을 위해)
    source "$SCRIPT_DIR/make_sure_env_local.sh"
    if [ $? -ne 0 ]; then
        echo "❌ 환경 변수 설정 중 오류가 발생했습니다."
        exit 1
    fi
else
    echo "❌ make_sure_env_local.sh 파일을 찾을 수 없습니다."
    exit 1
fi

echo ""

# 2. 플레이스홀더 치환
echo "🔄 플레이스홀더 치환을 시작합니다..."
if [ -f "$SCRIPT_DIR/replace_placeholders.sh" ]; then
    bash "$SCRIPT_DIR/replace_placeholders.sh"
    if [ $? -ne 0 ]; then
        echo "❌ 플레이스홀더 치환 중 오류가 발생했습니다."
        exit 1
    fi
else
    echo "❌ replace_placeholders.sh 파일을 찾을 수 없습니다."
    exit 1
fi

echo ""
echo "✅ 개발 환경 초기화가 완료되었습니다!"
echo ""
echo "이제 VS Code Dev Container로 개발을 시작하세요."
echo ""