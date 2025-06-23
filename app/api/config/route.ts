import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hideModelSelector: process.env.HIDE_MODEL_SELECTOR === 'true',
    hideVisibilitySelector: process.env.HIDE_VISIBILITY_SELECTOR === 'true',
    hideSuggestedActions: process.env.HIDE_SUGGESTED_ACTIONS === 'true',
    hideSidebarLogo: process.env.HIDE_SIDEBAR_LOGO === 'true',
    defaultChatVisibility: process.env.DEFAULT_CHAT_VISIBILITY || 'private',
  });
}