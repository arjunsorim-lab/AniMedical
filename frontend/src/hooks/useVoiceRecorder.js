import { useCallback, useRef, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import useVoiceStore from '../store/useVoiceStore';

const MAX_RECORDING_SECONDS = 60;

/**
 * Custom hook for voice recording using MediaRecorder + Web Audio API.
 *
 * Features:
 * - Real-time volume levels for visualizer
 * - Auto-stop after 60 seconds
 * - Minimum volume threshold (rejects silent recordings)
 * - Permission error handling with user-facing toasts
 * - Proper cleanup on unmount
 */
export default function useVoiceRecorder() {
  const mediaRecorderRef  = useRef(null);
  const audioContextRef   = useRef(null);
  const analyserRef       = useRef(null);
  const animFrameRef      = useRef(null);
  const chunksRef         = useRef([]);
  const streamRef         = useRef(null);
  const timerRef          = useRef(null);
  const autoStopRef       = useRef(null);
  const volumeSamplesRef  = useRef([]);

  const {
    isRecording,
    setRecording,
    setRecordingDuration,
    setAudioBlob,
    setVolume,
    setAverageVolume,
    setError,
    reset,
  } = useVoiceStore();

  // Clean up on unmount
  useEffect(() => {
    return () => { cleanupAll(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanupAll = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  /**
   * Start analysing volume from the mic stream
   */
  const startAnalyser = useCallback((stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source       = audioContext.createMediaStreamSource(stream);
      const analyser     = audioContext.createAnalyser();
      analyser.fftSize               = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current     = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate RMS volume from waveform values centered at 128.
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const sample = (dataArray[i] - 128) / 128;
          sum += sample * sample;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        setVolume(rms);
        volumeSamplesRef.current.push(rms);

        animFrameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (e) {
      console.warn('Audio analyser error:', e);
    }
  }, [setVolume]);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(async () => {
    try {
      reset();
      volumeSamplesRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current  = stream;
      chunksRef.current  = [];

      // Determine best MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const durationSeconds = useVoiceStore.getState().recordingDuration;
        const blob            = new Blob(chunksRef.current, { type: mimeType });

        // Average volume across the session
        const samples = volumeSamplesRef.current;
        const avg = samples.length > 0
          ? samples.reduce((a, b) => a + b, 0) / samples.length
          : 0;
        setAverageVolume(avg);

        /* ── Quality checks ─────────────── */
        // Silently drop accidental taps (< ~800 ms)
        if (durationSeconds < 1 && samples.length < 8) {
          toast('Hold to record, then tap to stop', { icon: '🎤', duration: 2500 });
          setRecording(false);
          setVolume(0);
          doCleanup();
          return;
        }

        // Backend VAD now performs final speech detection.

        setAudioBlob(blob);
        setRecording(false);
        setVolume(0);
        doCleanup();
      };

      recorder.onerror = () => {
        const msg = 'Recording failed. Please try again.';
        setError(msg);
        toast.error(msg);
        cleanupAll();
      };

      // Start recording — collect data every 100ms
      recorder.start(100);
      setRecording(true);

      // Start volume analyser
      startAnalyser(stream);

      // Duration timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingDuration(seconds);
      }, 1000);

      // Auto-stop after MAX_RECORDING_SECONDS
      autoStopRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      }, MAX_RECORDING_SECONDS * 1000);

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        const msg = 'Microphone access denied — please allow microphone in browser settings.';
        setError(msg);
        toast.error(msg);
      } else if (err.name === 'NotFoundError') {
        const msg = 'No microphone found — please connect a microphone.';
        setError(msg);
        toast.error(msg);
      } else {
        const msg = 'Could not access microphone. Please try again.';
        setError(msg);
        toast.error(msg);
      }
    }
  }, [reset, setRecording, setRecordingDuration, setAudioBlob, setVolume, setAverageVolume, setError, startAnalyser, cleanupAll]);

  /**
   * Internal cleanup after onstop (separate from full cleanupAll so mic release stays here)
   */
  function doCleanup() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  /**
   * Stop recording (user-initiated or auto-stop)
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { startRecording, stopRecording };
}
