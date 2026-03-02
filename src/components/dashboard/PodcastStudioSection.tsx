'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Mic, PauseCircle, PlayCircle, Radio, Square, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PaperAnalysis } from '@/lib/types';

interface PodcastSegment {
  speaker: string;
  content: string;
}

interface PodcastScript {
  title: string;
  intro: string;
  segments: PodcastSegment[];
  outro: string;
}

interface PodcastStudioSectionProps {
  analysis: PaperAnalysis;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export default function PodcastStudioSection({ analysis }: PodcastStudioSectionProps) {
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [pendingSeek, setPendingSeek] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [error, setError] = useState('');

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const resumeCharRef = useRef(0);
  const boundarySupportedRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);

  const fullNarration = useMemo(() => {
    if (!script) return '';
    const segmentText = script.segments.map((segment) => `${segment.speaker}: ${segment.content}`).join(' ');
    return `${script.title}. ${script.intro}. ${segmentText}. ${script.outro}`.replace(/\s+/g, ' ').trim();
  }, [script]);

  const totalDuration = useMemo(() => {
    if (!fullNarration) return 0;
    const words = fullNarration.split(/\s+/).filter(Boolean).length;
    return Math.max(20, Math.round(words / 2.35));
  }, [fullNarration]);

  const playbackSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const charToTime = (charIndex: number): number => {
    if (!fullNarration || totalDuration <= 0) return 0;
    const ratio = clamp(charIndex / fullNarration.length, 0, 1);
    return ratio * totalDuration;
  };

  const timeToChar = (seconds: number): number => {
    if (!fullNarration || totalDuration <= 0) return 0;
    const ratio = clamp(seconds / totalDuration, 0, 1);
    return Math.floor(ratio * fullNarration.length);
  };

  const clearFallbackTimer = () => {
    if (fallbackTimerRef.current) {
      window.clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  };

  const clearSpeech = () => {
    if (typeof window === 'undefined') return;
    if (utteranceRef.current) {
      utteranceRef.current.onstart = null;
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
      utteranceRef.current.onboundary = null;
    }
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    clearFallbackTimer();
  };

  const startSpeakingAt = (seconds: number) => {
    if (!playbackSupported || !fullNarration) return;

    clearSpeech();
    const synth = window.speechSynthesis;
    const startTime = clamp(seconds, 0, totalDuration || 0);
    const startChar = timeToChar(startTime);
    const text = fullNarration.slice(startChar);

    if (!text.trim()) {
      setCurrentTime(totalDuration);
      setPendingSeek(totalDuration);
      setIsSpeaking(false);
      setIsPaused(false);
      return;
    }

    resumeCharRef.current = startChar;
    boundarySupportedRef.current = false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onboundary = (event) => {
      if (typeof event.charIndex !== 'number') return;
      boundarySupportedRef.current = true;
      const absoluteChar = clamp(startChar + event.charIndex, 0, fullNarration.length);
      resumeCharRef.current = absoluteChar;
      const nextTime = charToTime(absoluteChar);
      setCurrentTime(nextTime);
      if (!isSeeking) setPendingSeek(nextTime);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentTime(totalDuration);
      setPendingSeek(totalDuration);
      resumeCharRef.current = fullNarration.length;
      clearFallbackTimer();
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      clearFallbackTimer();
      setError('Audio playback failed. Please retry.');
    };

    utteranceRef.current = utterance;

    fallbackTimerRef.current = window.setInterval(() => {
      if (boundarySupportedRef.current || isSeeking) return;
      setCurrentTime((prev) => {
        const next = clamp(prev + 0.35, 0, totalDuration);
        resumeCharRef.current = timeToChar(next);
        if (!isSeeking) setPendingSeek(next);
        return next;
      });
    }, 350);

    synth.speak(utterance);
  };

  const generateScript = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/paper/podcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: analysis.metadata,
          tldr: analysis.tldr,
          explanations: analysis.explanations,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: PodcastScript;
      };

      if (!response.ok || !result.success || !result.data) {
        setError(result.error || 'Could not generate podcast script.');
        return;
      }

      clearSpeech();
      setScript(result.data);
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentTime(0);
      setPendingSeek(0);
      resumeCharRef.current = 0;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate podcast script.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!playbackSupported || !fullNarration) return;

    if (!isSpeaking) {
      setError('');
      startSpeakingAt(currentTime);
      return;
    }

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    window.speechSynthesis.pause();
    setIsPaused(true);
  };

  const stopAudio = () => {
    if (!playbackSupported) return;
    clearSpeech();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const restartAudio = () => {
    setCurrentTime(0);
    setPendingSeek(0);
    resumeCharRef.current = 0;
    if (isSpeaking) startSpeakingAt(0);
  };

  const commitSeek = (target: number) => {
    const safe = clamp(target, 0, totalDuration);
    setCurrentTime(safe);
    setPendingSeek(safe);
    resumeCharRef.current = timeToChar(safe);

    if (isSpeaking) {
      startSpeakingAt(safe);
    }
  };

  useEffect(() => {
    if (isSeeking) return;
    setPendingSeek(currentTime);
  }, [currentTime, isSeeking]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        clearSpeech();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-teal)/0.16)]">
          <Mic className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-teal))' }} />
        </div>
        <div>
          <h2 className="section-title">Paper to Podcast</h2>
          <p className="section-subtitle">Generate an audio-friendly script and control playback like a real player</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={generateScript} disabled={isLoading} className="landing-cta-primary">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
            Generate podcast script
          </button>

          <button onClick={togglePlayPause} disabled={!script || !playbackSupported} className="stat-pill">
            {isSpeaking && !isPaused ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
            {isSpeaking && !isPaused ? 'Pause' : 'Play'}
          </button>

          <button onClick={stopAudio} disabled={!isSpeaking} className="stat-pill">
            <Square className="h-4 w-4" />
            Stop
          </button>

          <button onClick={restartAudio} disabled={!script} className="stat-pill">
            <RotateCcw className="h-4 w-4" />
            Restart
          </button>
        </div>

        {!playbackSupported && (
          <p className="mt-3 text-sm" style={{ color: 'hsl(var(--accent-rose))' }}>
            This browser does not support in-app speech playback.
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm" style={{ color: 'hsl(var(--accent-rose))' }}>
            {error}
          </p>
        )}

        {script && (
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-secondary) / 0.65)' }}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-bold" style={{ color: 'hsl(var(--text-secondary))' }}>
                Playback progress
              </p>
              <p className="text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                {formatTime(currentTime)} / {formatTime(totalDuration)}
              </p>
            </div>

            <input
              type="range"
              min={0}
              max={Math.max(totalDuration, 1)}
              step={1}
              value={isSeeking ? pendingSeek : currentTime}
              onMouseDown={() => setIsSeeking(true)}
              onTouchStart={() => setIsSeeking(true)}
              onChange={(event) => setPendingSeek(Number(event.target.value))}
              onMouseUp={() => {
                setIsSeeking(false);
                commitSeek(pendingSeek);
              }}
              onTouchEnd={() => {
                setIsSeeking(false);
                commitSeek(pendingSeek);
              }}
              onKeyUp={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') {
                  commitSeek(Number((event.currentTarget as HTMLInputElement).value));
                }
              }}
              className="w-full accent-[hsl(var(--accent-blue))]"
              aria-label="Podcast progress"
            />
          </div>
        )}

        {script ? (
          <div className="mt-5 space-y-3">
            <div className="reading-card p-4">
              <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-teal))' }}>
                Episode Title
              </p>
              <p className="mt-1 text-lg font-extrabold" style={{ color: 'hsl(var(--text-primary))' }}>
                {script.title}
              </p>
            </div>

            <div className="reading-card p-4">
              <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-blue))' }}>
                Intro
              </p>
              <p className="reading-small mt-2" style={{ color: 'hsl(var(--text-secondary))' }}>
                {script.intro}
              </p>
            </div>

            {script.segments.map((segment, index) => (
              <div key={`${segment.speaker}-${index}`} className="reading-card p-4">
                <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-indigo))' }}>
                  {segment.speaker}
                </p>
                <p className="reading-small mt-2" style={{ color: 'hsl(var(--text-secondary))' }}>
                  {segment.content}
                </p>
              </div>
            ))}

            <div className="reading-card p-4">
              <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-cyan))' }}>
                Outro
              </p>
              <p className="reading-small mt-2" style={{ color: 'hsl(var(--text-secondary))' }}>
                {script.outro}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--text-muted))' }}>
            Generate a script to convert this paper into a concise listening format.
          </div>
        )}
      </div>
    </motion.section>
  );
}
