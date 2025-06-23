import { getAvailableModels } from './models';

export function getDefaultChatModel(): string {
  // 1. 환경 변수에서 지정된 모델 확인
  const envModel = process.env.DEFAULT_CHAT_MODEL;
  
  if (envModel) {
    // 환경 변수에 지정된 모델이 실제로 사용 가능한지 확인
    const availableModels = getAvailableModels();
    const isModelAvailable = availableModels.some(m => m.id === envModel);
    
    if (isModelAvailable) {
      return envModel;
    } else {
      console.warn(`Default model ${envModel} is not available. Falling back to first available model.`);
    }
  }
  
  // 2. 첫 번째 사용 가능한 채팅 모델 사용
  const availableModels = getAvailableModels();
  const firstChatModel = availableModels.find(m => m.type === 'chat');
  
  if (firstChatModel) {
    return firstChatModel.id;
  }
  
  // 3. 최종 폴백
  return 'gpt-3.5-turbo';
}