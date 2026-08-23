"use client";

import {
  MAX_BRIGHTNESS_PCT,
  MIN_BRIGHTNESS_PCT,
} from "@/lib/brightness";
import { useBrightness } from "@/lib/brightness-context";

export function BrightnessSlider() {
  const { pct, setBrightness } = useBrightness();
  return (
    <label
      data-testid="settings-brightness-field"
      className="flex items-center gap-3 text-[13px] text-zinc-300"
    >
      <span className="min-w-24 text-zinc-400">Brightness</span>
      <input
        data-testid="settings-brightness-slider"
        type="range"
        min={MIN_BRIGHTNESS_PCT}
        max={MAX_BRIGHTNESS_PCT}
        step={1}
        value={pct}
        aria-label="Brightness"
        aria-valuemin={MIN_BRIGHTNESS_PCT}
        aria-valuemax={MAX_BRIGHTNESS_PCT}
        aria-valuenow={pct}
        onChange={(e) => setBrightness(Number(e.target.value))}
        className="h-1 w-48 cursor-pointer appearance-none rounded bg-zinc-800 accent-emerald-500"
      />
      <span
        data-testid="settings-brightness-value"
        className="min-w-10 text-right font-mono text-[12px] text-zinc-400"
      >
        {pct}%
      </span>
    </label>
  );
}
