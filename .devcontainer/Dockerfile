FROM node:22

# 개발 도구 설치
RUN apt-get update && apt-get install -y \
    git \
    vim \
    curl \
    wget \
    sudo \
    apt-transport-https \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# node 사용자에게 sudo 권한 부여 (비밀번호 없이)
RUN echo "node ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# node 사용자의 UID/GID를 1000으로 설정 (일반적인 호스트 사용자와 일치)
RUN usermod -u 1000 node && groupmod -g 1000 node

# corepack을 먼저 활성화
RUN corepack enable

# pnpm을 corepack으로 설치 및 활성화
RUN corepack prepare pnpm@latest --activate

# install web search mcp
RUN mkdir /mcp-need-clone
RUN cd /mcp-need-clone && git clone https://github.com/pskill9/web-search.git
RUN cd /mcp-need-clone/web-search && npm install && npm run build

# 작업 디렉토리 설정 및 node 사용자에게 소유권 부여
WORKDIR /workspace
RUN chown -R node:node /workspace && \
    chmod -R 755 /workspace

# node 사용자로 전환
USER node

# uv 설치 (node 사용자 권한으로)
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# npm 전역 디렉토리 설정
RUN mkdir -p ~/.npm-global && \
    npm config set prefix ~/.npm-global

# pnpm global store 디렉토리 생성 및 권한 설정
RUN mkdir -p /home/node/.local/share/pnpm/store && \
    chown -R node:node /home/node/.local/share/pnpm && \
    chmod -R 755 /home/node/.local/share/pnpm

# 환경 변수 설정 - PATH에 모든 필요한 경로 추가
ENV NPM_GLOBAL="/home/node/.npm-global/bin"
ENV UV_HOME="/home/node/.local/bin"
ENV PATH="${UV_HOME}:${NPM_GLOBAL}:${PATH}"

# shell 설정에도 PATH 추가 (인터랙티브 셸용)
RUN echo 'export PATH="/home/node/.local/bin:/home/node/.npm-global/bin:$PATH"' >> ~/.bashrc && \
    echo 'export PATH="/home/node/.local/bin:/home/node/.npm-global/bin:$PATH"' >> ~/.profile

# 포트 노출
EXPOSE __REPLACE__APP_PORT

# VS Code Dev Container는 sleep infinity로 컨테이너를 유지
CMD ["sleep", "infinity"]