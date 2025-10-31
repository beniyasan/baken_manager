"use client";

import { useMemo, useState } from "react";
import {
  ALL_TRACK_VALUES,
  CENTRAL_TRACK_GROUP_LABEL,
  CENTRAL_TRACK_VALUES,
  LOCAL_TRACK_GROUP_LABEL,
  LOCAL_TRACK_VALUES,
  TRACK_GROUPS,
  TRACK_SINGLE_OPTIONS,
  UNSPECIFIED_TRACK_OPTION,
} from "../constants";
import { useBetsContext } from "./BetsProvider";

const INPUT_CLASS =
  "w-full rounded-md border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/30";

const CHECKBOX_CLASS =
  "h-4 w-4 rounded border-white/20 bg-slate-900/70 text-emerald-400 focus:ring-emerald-300";

const PANEL_CLASS = "rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-lg shadow-emerald-500/10";

export const BetsFilters = () => {
  const {
    filters,
    setDateRange,
    setTrackFilters,
    setRaceNameFilter,
    resetFilters,
    hasActiveFilters,
  } = useBetsContext();

  const [collapsed, setCollapsed] = useState(true);

  const selectedTracks = useMemo(() => new Set(filters.tracks), [filters.tracks]);

  const handleTrackToggle = (track: string, checked: boolean) => {
    const next = new Set(selectedTracks);
    if (checked) {
      next.add(track);
    } else {
      next.delete(track);
    }
    setTrackFilters(Array.from(next));
  };

  const handleGroupToggle = (groupLabel: string, checked: boolean) => {
    const groupValues =
      groupLabel === CENTRAL_TRACK_GROUP_LABEL
        ? CENTRAL_TRACK_VALUES
        : groupLabel === LOCAL_TRACK_GROUP_LABEL
        ? LOCAL_TRACK_VALUES
        : [];

    if (!groupValues.length) {
      return;
    }

    const next = new Set(selectedTracks);
    groupValues.forEach((value) => {
      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
    });
    setTrackFilters(Array.from(next));
  };

  const toggleAllTracks = (checked: boolean) => {
    if (checked) {
      setTrackFilters(ALL_TRACK_VALUES);
    } else {
      setTrackFilters([]);
    }
  };

  const handleStartDateChange = (value: string) => {
    const normalized = value.trim();
    setDateRange(normalized ? normalized : null, filters.dateTo);
  };

  const handleEndDateChange = (value: string) => {
    const normalized = value.trim();
    setDateRange(filters.dateFrom, normalized ? normalized : null);
  };

  return (
    <div className={PANEL_CLASS}>
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-white">フィルター</h2>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="rounded-full border border-white/15 bg-slate-900/70 px-3 py-1 text-[11px] font-medium text-slate-200 transition hover:border-emerald-300/60 hover:text-white"
              >
                {collapsed ? "展開" : "最小化"}
              </button>
            </div>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => resetFilters()}
                className="text-xs font-medium text-emerald-200 underline-offset-4 hover:text-emerald-100 hover:underline"
              >
                条件をリセット
              </button>
            ) : null}
          </div>
          {!collapsed ? (
            <p className="mt-1 text-xs text-slate-400">レース名・期間・競馬場で一覧を絞り込みできます。</p>
          ) : hasActiveFilters ? (
            <p className="mt-1 text-xs text-emerald-200">フィルター適用中</p>
          ) : null}
        </div>

        {!collapsed ? (
          <>
            <label className="space-y-1 text-xs text-slate-300">
              <span>レース名</span>
              <input
                type="text"
                value={filters.raceName}
                placeholder="例: 有馬記念"
                onChange={(event) => setRaceNameFilter(event.target.value)}
                className={INPUT_CLASS}
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-300">
                <span>開始日</span>
                <input
                  type="date"
                  value={filters.dateFrom ?? ""}
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
              <label className="space-y-1 text-xs text-slate-300">
                <span>終了日</span>
                <input
                  type="date"
                  value={filters.dateTo ?? ""}
                  onChange={(event) => handleEndDateChange(event.target.value)}
                  className={INPUT_CLASS}
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>競馬場</span>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={selectedTracks.size === ALL_TRACK_VALUES.length}
                    onChange={(event) => toggleAllTracks(event.target.checked)}
                  />
                  <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">全選択</span>
                </label>
              </div>

              <div className="space-y-4">
                {TRACK_GROUPS.map((group) => {
                  const groupSelected = group.options.every((option) => selectedTracks.has(option.value));
                  return (
                    <div key={group.label} className="rounded-lg border border-white/10 bg-slate-950/40 p-4">
                      <div className="flex items-center justify-between text-xs text-slate-200">
                        <span className="font-semibold text-white">{group.label}</span>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            className={CHECKBOX_CLASS}
                            checked={groupSelected}
                            onChange={(event) => handleGroupToggle(group.label, event.target.checked)}
                          />
                          <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">まとめて選択</span>
                        </label>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
                        {group.options.map((option) => (
                          <label key={option.value} className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              className={CHECKBOX_CLASS}
                              checked={selectedTracks.has(option.value)}
                              onChange={(event) => handleTrackToggle(option.value, event.target.checked)}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
                  {TRACK_SINGLE_OPTIONS.map((option) => (
                    <label key={option.value} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        checked={selectedTracks.has(option.value)}
                        onChange={(event) => handleTrackToggle(option.value, event.target.checked)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      className={CHECKBOX_CLASS}
                      checked={selectedTracks.has(UNSPECIFIED_TRACK_OPTION.value)}
                      onChange={(event) => handleTrackToggle(UNSPECIFIED_TRACK_OPTION.value, event.target.checked)}
                    />
                    <span>{UNSPECIFIED_TRACK_OPTION.label}</span>
                  </label>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
