import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // 기본 허용 도메인 목록
      const allowedDomains = [
        'http://localhost:3004',
        'https://select-ai-concierge-746568200185.asia-northeast3.run.app',
        'https://concierge.luxury-select.co.kr',
        baseUrl,
      ].filter(Boolean);

      // URL이 허용된 도메인 중 하나로 시작하는지 확인
      const isAllowed = allowedDomains.some((domain) =>
        url.startsWith(domain as string),
      );

      if (isAllowed) {
        return url;
      }

      // 상대 경로인 경우 baseUrl과 결합
      if (url.startsWith('/')) {
        return new URL(url, baseUrl).toString();
      }

      // 기본값으로 baseUrl 반환
      return baseUrl;
    },
  },
} satisfies NextAuthConfig;
