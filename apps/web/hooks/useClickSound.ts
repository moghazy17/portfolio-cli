'use client';

import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'desk:sound';
const BUTTON_SELECTOR = 'button, a, summary, [role="button"]';
const subscribers = new Set<() => void>();

let muted = false;
let loaded = false;
let context: AudioContext | null = null;
let mouseGestureForFeedback = false;

function loadSetting(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try { muted = window.localStorage.getItem(STORAGE_KEY) === 'off'; }
  catch { /* Storage can be unavailable in private or restricted contexts. */ }
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => { subscribers.delete(callback); };
}

function getSnapshot(): boolean {
  loadSetting();
  return muted;
}

function getServerSnapshot(): boolean { return false; }

function finePointer(): boolean {
  try { return window.matchMedia('(pointer: fine)').matches; }
  catch { return false; }
}

type Sound = 'click' | 'tock';

function synthesize(audio: AudioContext, sound: Sound): void {
  const click = sound === 'click';
  const duration = click ? 0.024 : 0.042;
  const variation = 0.93 + Math.random() * 0.14;
  const start = audio.currentTime;
  const end = start + duration;
  const nodes: AudioNode[] = [];
  const keep = <T extends AudioNode>(node: T): T => { nodes.push(node); return node; };

  try {
    const noise = keep(audio.createBufferSource());
    const buffer = audio.createBuffer(1, Math.ceil((duration + 0.001) * audio.sampleRate), audio.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const filter = keep(audio.createBiquadFilter());
    filter.type = 'bandpass';
    filter.frequency.value = (click ? 2300 : 1350) * variation;
    filter.Q.value = 0.7;

    const noiseGain = keep(audio.createGain());
    noiseGain.gain.setValueAtTime(0, start);
    noiseGain.gain.linearRampToValueAtTime(click ? 0.055 : 0.038, start + (click ? 0.0012 : 0.002));
    noiseGain.gain.exponentialRampToValueAtTime(0.0004, end - 0.002);
    noiseGain.gain.linearRampToValueAtTime(0, end);
    noise.connect(filter).connect(noiseGain).connect(audio.destination);

    const tone = keep(audio.createOscillator());
    tone.type = 'sine';
    tone.frequency.setValueAtTime((click ? 820 : 470) * variation, start);
    tone.frequency.exponentialRampToValueAtTime((click ? 690 : 390) * variation, end);

    const toneGain = keep(audio.createGain());
    toneGain.gain.setValueAtTime(0, start);
    toneGain.gain.linearRampToValueAtTime(click ? 0.019 : 0.013, start + 0.0008);
    toneGain.gain.exponentialRampToValueAtTime(0.0002, end - 0.002);
    toneGain.gain.linearRampToValueAtTime(0, end);
    tone.connect(toneGain).connect(audio.destination);

    noise.onended = () => { for (const node of nodes) node.disconnect(); };
    noise.start(start);
    tone.start(start);
    noise.stop(end + 0.001);
    tone.stop(end + 0.001);
  } catch {
    for (const node of nodes) {
      try { node.disconnect(); } catch { /* Web Audio may have failed while wiring nodes. */ }
    }
  }
}

function play(sound: Sound): void {
  if (typeof window === 'undefined' || document.hidden || getSnapshot()) return;
  try {
    context ??= new AudioContext();
    const audio = context;
    if (audio.state === 'suspended') {
      void audio.resume().then(() => {
        if (!document.hidden && !getSnapshot()) synthesize(audio, sound);
      }).catch(() => { /* Audio can be blocked by the browser. */ });
    } else if (audio.state === 'running') {
      synthesize(audio, sound);
    }
  } catch { /* Web Audio can be unavailable or blocked. */ }
}

/** Play quiet plastic mouse clicks on the desktop's fine-pointer gestures. */
export function useClickSound(): void {
  useEffect(() => {
    loadSetting();
    const pressedButtons = new Set<number>();

    const down = (event: PointerEvent) => {
      mouseGestureForFeedback = false;
      if (event.pointerType !== 'mouse' || !finePointer() || document.hidden) return;
      mouseGestureForFeedback = true;
      const target = event.target;
      if (target instanceof Element && target.closest(BUTTON_SELECTOR)) pressedButtons.add(event.pointerId);
      play('click');
    };
    const up = (event: PointerEvent) => {
      const pressedButton = pressedButtons.delete(event.pointerId);
      if (pressedButton && event.pointerType === 'mouse' && finePointer() && !document.hidden) play('tock');
    };
    const cancel = (event: PointerEvent) => { pressedButtons.delete(event.pointerId); };
    const keydown = () => { mouseGestureForFeedback = false; };
    const clear = () => { pressedButtons.clear(); mouseGestureForFeedback = false; };

    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', cancel, true);
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('visibilitychange', clear);
    window.addEventListener('blur', clear);
    return () => {
      clear();
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', cancel, true);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('visibilitychange', clear);
      window.removeEventListener('blur', clear);
    };
  }, []);
}

/** Share the desktop sound setting with the Deskbar speaker toggle. */
export function useSoundSetting(): { muted: boolean; toggle: () => void } {
  const setting = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => {
    loadSetting();
    muted = !muted;
    try { window.localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on'); }
    catch { /* Keep the in-memory setting when storage is unavailable. */ }
    for (const notify of subscribers) notify();
    if (!muted && mouseGestureForFeedback) play('click');
    mouseGestureForFeedback = false;
  };
  return { muted: setting, toggle };
}
