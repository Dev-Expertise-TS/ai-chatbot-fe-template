import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 간단한 헬스체크
    // 실제 프로덕션에서는 데이터베이스 연결 상태 등을 확인할 수 있습니다
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'select-ai-concierge',
        version: process.env.npm_package_version || '1.0.0',
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}