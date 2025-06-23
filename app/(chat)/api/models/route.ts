import { NextResponse } from 'next/server';
import { getAvailableModels } from '@/lib/ai/models';

export async function GET() {
  try {
    const models = getAvailableModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.error('Failed to get models:', error);
    return NextResponse.json({ models: [] }, { status: 500 });
  }
}