import { create } from 'zustand';

const useVoiceStore = create((set) => ({
  // State
  isRecording: false,
  recordingDuration: 0,
  audioBlob: null,
  transcribedText: null,
  isTranscribing: false,
  volume: 0,
  averageVolume: 0,   // tracks overall average for silence detection
  error: null,

  // Actions
  setRecording: (isRecording) => set({ isRecording, error: null }),
  setRecordingDuration: (duration) => set({ recordingDuration: duration }),
  setAudioBlob: (blob) => set({ audioBlob: blob }),
  setTranscribedText: (text) => set({ transcribedText: text }),
  setTranscribing: (isTranscribing) => set({ isTranscribing }),
  setVolume: (volume) => set({ volume }),
  setAverageVolume: (averageVolume) => set({ averageVolume }),
  setError: (error) => set({ error, isRecording: false, isTranscribing: false }),

  reset: () => set({
    isRecording: false,
    recordingDuration: 0,
    audioBlob: null,
    transcribedText: null,
    isTranscribing: false,
    volume: 0,
    averageVolume: 0,
    error: null,
  }),
}));

export default useVoiceStore;
