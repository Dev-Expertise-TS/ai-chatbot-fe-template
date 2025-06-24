# 개발 컨테이너 초기 구동 후 첫 채팅 실패 버그 수정 지시서

## 버그 현상
개발 컨테이너 최초 구동 후 첫 번째 채팅 시도 시 다음 에러 발생:
- HTTP 400 응답
- "Failed to save chat" 데이터베이스 에러
- 브라우저 사이트 데이터 삭제 후에는 정상 작동

## 근본 원인
미들웨어와 메인 페이지의 인증 처리 방식 불일치:
1. 브라우저에 이전 세션의 JWT 토큰이 남아있음
2. 미들웨어는 이 토큰을 유효하다고 판단하여 통과시킴
3. 실제 데이터베이스에는 해당 사용자가 존재하지 않음 (컨테이너 재시작으로 DB 초기화)
4. 채팅 저장 시 사용자를 찾을 수 없어 에러 발생

## 수정 방안

### 1. middleware.ts 수정
**파일**: `/workspace/middleware.ts`

**수정 내용**:
```typescript
// 기존 코드 (라인 36-40 부근)
const isTokenValid = await isTokenExpired(token.value);

if (isTokenValid) {
  return NextResponse.next();
}

// 수정 후 코드
const isTokenValid = await isTokenExpired(token.value);

if (isTokenValid) {
  // 토큰은 유효하지만 실제 사용자가 DB에 존재하는지 추가 검증
  try {
    const decoded = await jwtVerify(token.value, new TextEncoder().encode(process.env.AUTH_SECRET!));
    const userId = decoded.payload.userId as string;
    
    // getUserById를 호출하여 실제 DB에 사용자가 존재하는지 확인
    const user = await getUserById(userId);
    
    if (!user) {
      // DB에 사용자가 없으면 쿠키 삭제 후 게스트 인증으로 리다이렉트
      const response = NextResponse.redirect(new URL(`/api/auth/guest?redirectUrl=${encodeURIComponent(request.url)}`, request.url));
      response.cookies.delete('__Secure-authjs.session-token');
      response.cookies.delete('authjs.session-token');
      return response;
    }
    
    return NextResponse.next();
  } catch (error) {
    // 검증 실패 시 기존 로직 진행
  }
}
```

**필요한 import 추가**:
```typescript
import { getUserById } from '@/lib/db/queries';
import { jwtVerify } from 'jose';
```

### 2. app/(chat)/api/chat/route.ts 수정
**파일**: `/workspace/app/(chat)/api/chat/route.ts`

**수정 내용**:
```typescript
// 기존 코드 (라인 79-82 부근)
const session = await auth();

if (!session?.user) {
  return new ChatSDKError('unauthorized:user').toResponse();
}

// 수정 후 코드
const session = await auth();

if (!session?.user) {
  return new ChatSDKError('unauthorized:user').toResponse();
}

// 세션의 사용자가 실제 DB에 존재하는지 재확인
try {
  const dbUser = await getUserById(session.user.id);
  if (!dbUser) {
    // DB에 사용자가 없으면 명확한 에러 메시지와 함께 401 반환
    return new Response(
      JSON.stringify({
        code: 'invalid_session',
        message: 'Your session is invalid. Please refresh the page to sign in again.'
      }),
      { 
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Clear-Site-Data': '"cookies"' // 브라우저에 쿠키 삭제 지시
        }
      }
    );
  }
} catch (error) {
  console.error('Error verifying user:', error);
  return new ChatSDKError('internal:database').toResponse();
}
```

### 3. app/(chat)/page.tsx 수정
**파일**: `/workspace/app/(chat)/page.tsx`

**수정 내용**:
```typescript
// 기존 코드 (라인 20-24 부근)
const session = await auth();

if (!session?.user) {
  redirect('/api/auth/guest');
}

// 수정 후 코드
const session = await auth();

if (!session?.user) {
  redirect('/api/auth/guest');
}

// 세션이 있어도 실제 DB에 사용자가 존재하는지 확인
try {
  const dbUser = await getUserById(session.user.id);
  if (!dbUser) {
    // DB에 사용자가 없으면 게스트 인증으로 리다이렉트
    redirect('/api/auth/guest');
  }
} catch (error) {
  console.error('Error verifying user:', error);
  redirect('/api/auth/guest');
}
```

### 4. components/chat.tsx 클라이언트 에러 처리 개선
**파일**: `/workspace/components/chat.tsx`

**수정 내용**:
```typescript
// useChat 훅의 onError 콜백 추가 또는 수정
const { messages, append, reload, stop, setMessages, input, setInput, isLoading } = useChat({
  api: '/api/chat',
  id,
  body: {
    modelId: model.id,
  },
  onError: (error) => {
    console.error('Chat error:', error);
    
    // 세션 관련 에러인 경우 페이지 새로고침
    if (error.message?.includes('invalid_session') || 
        error.message?.includes('unauthorized') ||
        error.message?.includes('database')) {
      // 쿠키 삭제 후 새로고침
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      window.location.reload();
    }
  },
  onFinish: () => {
    // 기존 onFinish 로직
  },
});
```

### 5. 예방적 조치: DevContainer 스크립트 개선
**파일**: `/workspace/.devcontainer/init_dev_env.sh`

**추가 내용** (스크립트 끝부분):
```bash
# 개발 환경 초기화 완료 메시지에 쿠키 삭제 안내 추가
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  주의사항:"
echo "이전에 이 프로젝트를 실행한 적이 있다면,"
echo "브라우저의 쿠키/사이트 데이터를 삭제해주세요."
echo ""
echo "Chrome: 개발자 도구 > 애플리케이션 > 저장용량 > 사이트 데이터 삭제"
echo "Firefox: 개발자 도구 > 저장소 > 쿠키 > 모두 삭제"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

## 테스트 방법

1. 수정 사항 적용 후 개발 컨테이너 재시작
2. 브라우저 쿠키/사이트 데이터 삭제하지 않고 첫 채팅 시도
3. 자동으로 게스트 인증으로 리다이렉트되고 정상 작동 확인

## 장기적 개선 사항

1. **세션 검증 미들웨어 강화**
   - Redis 등을 활용한 세션 스토어 도입 고려
   - 개발 환경에서는 인메모리 세션 스토어 사용

2. **개발 환경 전용 설정**
   - 개발 환경에서는 컨테이너 시작 시 자동으로 모든 세션 무효화
   - 프로덕션과 개발 환경의 세션 관리 전략 분리

3. **에러 메시지 개선**
   - 사용자에게 더 명확한 에러 메시지 제공
   - 자동 복구 메커니즘 구현