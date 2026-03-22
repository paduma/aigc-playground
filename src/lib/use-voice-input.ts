"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface VoiceInputState {
  isListening: boolean;
  interimText: string;
  finalText: string;
  error: string | null;
  supported: boolean;
  spectrum: Uint8Array | null;
}

// 用 useSyncExternalStore 安全读取浏览器能力，避免 hydration mismatch
const emptySubscribe = () => () => { };
function getSupported() {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SR;
}
function getServerSupported() {
  return false;
}

export function useVoiceInput(opts?: {
  lang?: string;
  onResult?: (text: string) => void;
}) {
  const supported = useSyncExternalStore(emptySubscribe, getSupported, getServerSupported);

  // ── P0 fix: 用 ref 稳定 opts，避免 recognition.onresult 捕获 stale closure ──
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    interimText: "",
    finalText: "",
    error: null,
    supported: false,
    spectrum: null,
  });

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const startSpectrum = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(buf);
      setState((s) => ({ ...s, spectrum: new Uint8Array(buf) }));
      animRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, []);

  const stopSpectrum = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    setState((s) => ({ ...s, spectrum: null }));
  }, []);

  const start = useCallback(async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setState((s) => ({ ...s, error: "当前浏览器不支持语音识别，请使用 Chrome" }));
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const recognition = new SR();
      recognition.lang = optsRef.current?.lang ?? "zh-CN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }
        if (final) {
          setState((s) => ({ ...s, finalText: final, interimText: "" }));
          optsRef.current?.onResult?.(final);
        } else {
          setState((s) => ({ ...s, interimText: interim }));
        }
      };

      recognition.onend = () => {
        setState((s) => ({ ...s, isListening: false }));
        stopSpectrum();
        cleanup();
      };

      recognition.onerror = (e: any) => {
        if (e.error !== "no-speech" && e.error !== "aborted") {
          setState((s) => ({ ...s, error: `语音识别错误: ${e.error}` }));
        }
        setState((s) => ({ ...s, isListening: false }));
        stopSpectrum();
        cleanup();
      };

      recognition.start();
      recognitionRef.current = recognition;
      setState((s) => ({
        ...s,
        isListening: true,
        interimText: "",
        finalText: "",
        error: null,
      }));
      startSpectrum();
    } catch {
      // getUserMedia 成功但后续出错时，也要释放 stream
      stream?.getTracks().forEach((t) => t.stop());
      cleanup();
      setState((s) => ({ ...s, error: "麦克风权限被拒绝", isListening: false }));
    }
  }, [startSpectrum, stopSpectrum, cleanup]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    stopSpectrum();
    cleanup();
    setState((s) => ({ ...s, isListening: false }));
  }, [stopSpectrum, cleanup]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      cancelAnimationFrame(animRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close();
    };
  }, []);

  return { ...state, supported, start, stop };
}
