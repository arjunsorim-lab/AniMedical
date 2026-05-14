import useChatStore from '../store/useChatStore';
import useVoiceStore from '../store/useVoiceStore';

/**
 * Unified Request Lifecycle State
 * 
 * Instead of checking scattered booleans (isLoading, isStreaming, isRecording, etc.),
 * components can use this hook to get a single deterministic status string.
 * 
 * @returns {'idle' | 'recording' | 'transcribing' | 'loading' | 'streaming' | 'error'}
 */
export default function useAppStatus() {
  const isRecording = useVoiceStore((s) => s.isRecording);
  const isTranscribing = useVoiceStore((s) => s.isTranscribing);
  const voiceError = useVoiceStore((s) => s.error);

  const isLoading = useChatStore((s) => s.isLoading);
  const isStreaming = useChatStore((s) => s.isStreaming);

  if (voiceError) return 'error';
  if (isRecording) return 'recording';
  if (isTranscribing) return 'transcribing';
  if (isStreaming) return 'streaming';
  if (isLoading) return 'loading';

  return 'idle';
}
