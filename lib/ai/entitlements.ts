import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';
import { getAllAvailableModelIds } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

// 하드코딩된 모델 ID 배열
const ALL_MODEL_IDS = getAllAvailableModelIds();

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 100,
    availableChatModelIds: ALL_MODEL_IDS,
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: ALL_MODEL_IDS,
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
