#!/bin/bash
set -e

# 스크립트 경로 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 공통 디버그 함수 로드
source "$SCRIPT_DIR/debug_common.sh"

# 디버그 초기화 (--debug 플래그 확인 및 로그 설정)
init_debug "setup_container" "$@"

# 시작 시간 기록
START_TIME=$(start_timer)

echo "====================================="
echo "Dev Container Setup Script"
echo "====================================="

log_debug "Dev Container 설정 시작"

# 1. Install Google Cloud SDK
echo ""
echo "Step 1: Installing Google Cloud SDK..."
echo "-------------------------------------"
GCLOUD_START=$(start_timer)
log_debug "Google Cloud SDK 설치 시작"

# Add Google Cloud SDK distribution URI as a package source
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

# Import the Google Cloud public key
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -

# Update and install Google Cloud SDK
sudo apt-get update && sudo apt-get install -y google-cloud-sdk

echo "Google Cloud SDK installed successfully!"
echo ""
echo "Step 2: Initializing Google Cloud SDK..."
echo "-------------------------------------"
echo "Please follow the prompts to authenticate and configure gcloud:"
gcloud init

echo "Step 3: Install Claude Code and add MCP Servers locally"
echo "-------------------------------------"
read -p "Claude Code와 MCP 서버들을 설치하시겠습니까? (y/N): " install_claude

if [[ "$install_claude" =~ ^[Yy]$ ]]; then
    echo "Claude Code를 설치합니다..."
    npm install -g @anthropic-ai/claude-code
    
    echo "MCP 서버들을 추가합니다..."
    claude mcp add -s user context7 npx -- -y @upstash/context7-mcp@latest
    claude mcp add -s user desktop-commander npx -- -y @wonderwhy-er/desktop-commander
    claude mcp add -s user playwright npx -- -y @playwright/mcp@latest
    claude mcp add -s user time uvx -- mcp-server-time --local-timezone Asia/Seoul
    claude mcp add -s user fetch uvx -- mcp-server-fetch
    claude mcp add -s user sequential-thinking npx -- -y @modelcontextprotocol/server-sequential-thinking
    claude mcp add -s user web-search node /mcp-need-clone/web-search/build/index.js
    echo "Claude Code와 MCP 서버 설치가 완료되었습니다!"
else
    echo "Claude Code 설치를 건너뛰었습니다."
fi

# 3. Run the original postCreateCommand
echo ""
echo "Step 4: Checking and fixing permissions..."
echo "-------------------------------------"
# node_modules 볼륨의 권한 확인 및 수정
echo "Preparing node_modules directory..."
# node_modules 디렉토리가 없으면 생성
if [ ! -d "/workspace/node_modules" ]; then
    echo "Creating node_modules directory..."
    sudo mkdir -p /workspace/node_modules
fi

# 항상 권한을 확인하고 설정 (볼륨이 root로 생성될 수 있으므로)
echo "Setting node_modules permissions..."
sudo chown -R node:node /workspace/node_modules
sudo chmod -R 755 /workspace/node_modules

# .pnpm 디렉토리도 미리 생성하고 권한 설정
if [ ! -d "/workspace/node_modules/.pnpm" ]; then
    echo "Creating .pnpm directory..."
    mkdir -p /workspace/node_modules/.pnpm
fi

# .next 디렉토리 권한 확인 및 수정
if [ -d "/workspace/.next" ]; then
    echo "Checking .next permissions..."
    if [ ! -w "/workspace/.next" ]; then
        echo "Fixing .next permissions..."
        sudo chown -R node:node /workspace/.next
        sudo chmod -R 755 /workspace/.next
    fi
fi

# pnpm global store 디렉토리 확인
echo "Ensuring pnpm global store directory exists..."
mkdir -p /home/node/.local/share/pnpm/store

echo ""
echo "Step 5: Running original setup commands..."
echo "-------------------------------------"
echo "Installing pnpm dependencies..."
pnpm install

echo "Running database migrations..."
pnpm db:migrate

echo ""
echo "====================================="
echo "Dev Container setup completed!"
echo "====================================="

# 디버그 종료
finish_debug "setup_container" "$START_TIME"