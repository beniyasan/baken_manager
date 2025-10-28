"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, InputHTMLAttributes, SelectHTMLAttributes, DragEvent } from "react";
import type { BetRecord, BetTicket } from "@/lib/types";
import { useBetsContext } from "./BetsProvider";
import { mergeOcrResults, parseOcrText } from "../utils/ocr";
import { uploadBetImage, removeBetImage } from "../utils/storage";
import { supabaseClient } from "@/lib/supabaseClient";
import type { PlanFeatures } from "@/lib/plans";
import { FEATURE_MESSAGES } from "@/lib/plans";

const BET_TYPES = [
  "単勝",
  "複勝",
  "枠連",
  "枠単",
  "枠複",
  "馬連",
  "馬単",
  "ワイド",
  "3連複",
  "3連単",
  "その他",
];

const RACE_SOURCES = [
  { value: "即pat", label: "即PAT" },
  { value: "Spat4", label: "SPAT4" },
];

const TRACK_OPTION_GROUPS = [
  {
    label: "中央競馬 (JRA)",
    options: [
      { value: "札幌", label: "札幌" },
      { value: "函館", label: "函館" },
      { value: "福島", label: "福島" },
      { value: "新潟", label: "新潟" },
      { value: "東京", label: "東京" },
      { value: "中山", label: "中山" },
      { value: "中京", label: "中京" },
      { value: "京都", label: "京都" },
      { value: "阪神", label: "阪神" },
      { value: "小倉", label: "小倉" },
    ],
  },
  {
    label: "地方競馬",
    options: [
      { value: "門別", label: "門別" },
      { value: "盛岡", label: "盛岡" },
      { value: "水沢", label: "水沢" },
      { value: "浦和", label: "浦和" },
      { value: "船橋", label: "船橋" },
      { value: "大井", label: "大井" },
      { value: "川崎", label: "川崎" },
      { value: "金沢", label: "金沢" },
      { value: "笠松", label: "笠松" },
      { value: "名古屋", label: "名古屋" },
      { value: "園田", label: "園田" },
      { value: "姫路", label: "姫路" },
      { value: "高知", label: "高知" },
      { value: "佐賀", label: "佐賀" },
      { value: "帯広", label: "帯広" },
    ],
  },
];

const TRACK_SINGLE_OPTIONS = [{ value: "その他", label: "その他" }];

const defaultTicket: BetTicket = {
  type: "",
  numbers: "",
  amount: 100,
};

const today = () => new Date().toISOString().split("T")[0];

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

const INPUT_BASE_CLASS =
  "w-full rounded-md border border-white/15 bg-slate-950/50 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-300/30";
const PRIMARY_BUTTON_CLASS =
  "rounded-md bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-md shadow-emerald-500/30 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70";
const SECONDARY_BUTTON_CLASS =
  "rounded-md border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:border-white/40";
const SMALL_BUTTON_CLASS =
  "rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60";
const PANEL_CLASS = "rounded-lg border border-white/10 bg-slate-900/50";
const DANGER_PANEL_CLASS = "rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200";

export type BetsFormProps = {
  editingBet: BetRecord | null;
  onCancelEdit: () => void;
  onSuccess: () => void;
  plan: PlanFeatures;
  planEnforced: boolean;
};

export const BetsForm = ({ editingBet, onCancelEdit, onSuccess, plan, planEnforced }: BetsFormProps) => {
  const { addBet, updateBet, bets } = useBetsContext();

  const [date, setDate] = useState<string>(today());
  const [source, setSource] = useState<string>("");
  const [raceName, setRaceName] = useState<string>("");
  const [track, setTrack] = useState<string>("");
  const [tickets, setTickets] = useState<BetTicket[]>([defaultTicket]);
  const [payout, setPayout] = useState<number>(0);
  const [memo, setMemo] = useState<string>("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!editingBet) {
      resetForm();
      return;
    }

    setDate(editingBet.date ?? today());
    setSource(editingBet.source ?? "");
    setRaceName(editingBet.raceName ?? "");
    setTrack(editingBet.track ?? "");
    setTickets(editingBet.bets.length ? editingBet.bets : [defaultTicket]);
    setPayout(editingBet.payout);
    setMemo(editingBet.memo ?? "");
    setExistingImagePath(editingBet.imagePath ?? null);
    setRemoveExistingImage(false);
    setSelectedFile(null);
    setImageData(null);
    setImagePreview(editingBet.imageUrl ?? null);
  }, [editingBet]);

  const resetForm = () => {
    setDate(today());
    setSource("");
    setRaceName("");
    setTrack("");
    setTickets([defaultTicket]);
    setPayout(0);
    setMemo("");
    setImageData(null);
    setImagePreview(null);
    setSelectedFile(null);
    setExistingImagePath(null);
    setRemoveExistingImage(false);
    setError(null);
  };

  const totalPurchase = useMemo(
    () => tickets.reduce((sum, ticket) => sum + (ticket.amount || 0), 0),
    [tickets]
  );

  const recoveryRate = useMemo(() => {
    if (totalPurchase <= 0) return 0;
    return (payout / totalPurchase) * 100;
  }, [payout, totalPurchase]);

  const handleTicketChange = (index: number, field: keyof BetTicket, value: string) => {
    setTickets((prev) =>
      prev.map((ticket, idx) =>
        idx === index
          ? {
              ...ticket,
              [field]: field === "amount" ? Number(value) || 0 : value,
            }
          : ticket
      )
    );
  };

  const addTicketRow = () => {
    setTickets((prev) => [...prev, { ...defaultTicket }]);
  };

  const removeTicketRow = (index: number) => {
    setTickets((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }

    setSelectedFile(file);
    setRemoveExistingImage(false);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setImageData(base64);
      setImagePreview(base64);
    };
    reader.onerror = () => {
      setError("画像の読み込みに失敗しました");
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processSelectedFile(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (isDragging) setIsDragging(false);
  };

  const planLimitNotice = useMemo(() => {
    if (!planEnforced || plan.maxBets === null) return null;
    const count = bets.length;
    const limit = plan.maxBets;
    return `登録済み件数: ${Math.min(count, limit)}/${limit}`;
  }, [bets.length, plan.maxBets, planEnforced]);

  const limitReached = useMemo(() => {
    if (!planEnforced || plan.maxBets === null) return false;
    return !editingBet && bets.length >= plan.maxBets;
  }, [bets.length, plan.maxBets, planEnforced, editingBet]);

  const ocrDisabled = planEnforced && !plan.ocrEnabled;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!source) {
      setError("購入元を選択してください");
      return;
    }

    if (!tickets.some((ticket) => ticket.type && ticket.numbers && ticket.amount > 0)) {
      setError("最低1つの買い目を入力してください");
      return;
    }

    if (limitReached && plan.maxBets !== null) {
      setError(FEATURE_MESSAGES.maxBets(plan.maxBets));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user) {
        throw new Error("ログインが必要です");
      }

      let imagePath = existingImagePath;
      let imageUrl = imagePreview;

      if (selectedFile) {
        const { path, url } = await uploadBetImage(user.id, selectedFile, existingImagePath ?? undefined);
        imagePath = path;
        imageUrl = url;
      } else if (removeExistingImage && existingImagePath) {
        await removeBetImage(existingImagePath).catch(() => undefined);
        imagePath = null;
        imageUrl = null;
      }

      const payload = {
        date,
        source,
        raceName: raceName || null,
        track: track || null,
        bets: tickets,
        payout,
        memo: memo || null,
        imagePath,
      };

      if (editingBet) {
        await updateBet(editingBet.id, payload);
      } else {
        await addBet(payload);
      }

      setImagePreview(imageUrl ?? null);
      resetForm();
      onSuccess();
    } catch (submitErr: any) {
      console.error("保存エラー", submitErr);
      setError(submitErr?.message ?? "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      reader.readAsDataURL(file);
    });

  const resolveImageBase64 = async () => {
    if (imageData) return imageData;
    if (selectedFile) {
      const base64 = await fileToBase64(selectedFile);
      setImageData(base64);
      return base64;
    }
    if (imagePreview) {
      if (imagePreview.startsWith("data:")) {
        setImageData(imagePreview);
        return imagePreview;
      }
      if (imagePreview.startsWith("http")) {
        const response = await fetch(imagePreview);
        if (!response.ok) {
          throw new Error("保存済み画像の取得に失敗しました");
        }
        const blob = await response.blob();
        const base64 = await fileToBase64(blob);
        setImageData(base64);
        return base64;
      }
    }
    return null;
  };

  const handleRunOcr = async () => {
    if (ocrDisabled) {
      setError(FEATURE_MESSAGES.ocrDisabled);
      return;
    }

    setError(null);
    setOcrLoading(true);
    try {
      const base64Image = await resolveImageBase64();
      if (!base64Image) {
        throw new Error("先に画像をアップロードしてください");
      }

      const response = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: base64Image }),
      });

      if (!response.ok) {
        const { error: message } = await response.json();
        throw new Error(message || "OCR処理に失敗しました");
      }

      const { text } = await response.json();
      if (!text) {
        throw new Error("OCR結果が取得できませんでした");
      }

      const parsed = parseOcrText(text);

      let structured;
      try {
        const structuredResponse = await fetch("/api/ocr/structure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (structuredResponse.ok) {
          structured = await structuredResponse.json();
        } else {
          const { error: structuredError } = await structuredResponse.json();
          console.warn("構造化OCRの呼び出しに失敗", structuredError);
        }
      } catch (structuredErr) {
        console.warn("構造化OCR 呼び出しエラー", structuredErr);
      }

      const merged = mergeOcrResults(parsed, structured);

      if (merged.date) setDate(merged.date);
      if (merged.source) setSource(merged.source);
      if (merged.raceName) setRaceName(merged.raceName);
      if (merged.track) setTrack(merged.track);
      if (merged.payout !== undefined) setPayout(merged.payout);
      if (merged.memo) setMemo(merged.memo);
      if (merged.bets.length) setTickets(merged.bets.map((ticket) => ({ ...ticket })));
    } catch (ocrError: any) {
      console.error("OCRエラー", ocrError);
      setError(ocrError?.message || "OCR処理に失敗しました");
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-xl shadow-emerald-500/10"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {editingBet ? "データ編集" : "新規データ追加"}
        </h2>
        {editingBet ? (
          <button
            type="button"
            onClick={() => {
              onCancelEdit();
              resetForm();
            }}
            className="text-sm text-slate-300 underline-offset-4 hover:text-white hover:underline"
          >
            編集をキャンセル
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          label="日付"
          type="date"
          value={date ?? ""}
          onChange={(event) => setDate(event.target.value)}
          required
        />

        <SelectField
          label="購入元"
          value={source}
          onChange={(event) => setSource(event.target.value)}
          required
          options={RACE_SOURCES}
        />

        <TextField
          className="sm:col-span-2"
          label="レース名"
          value={raceName}
          onChange={(event) => setRaceName(event.target.value)}
          placeholder="例: 東京11R 天皇賞"
        />

        <SelectField
          label="競馬場"
          value={track}
          onChange={(event) => setTrack(event.target.value)}
          optionGroups={TRACK_OPTION_GROUPS}
          options={TRACK_SINGLE_OPTIONS}
          placeholder="選択してください"
        />

        <TextField
          label="払戻金"
          type="number"
          min={0}
          value={payout}
          onChange={(event) => setPayout(Number(event.target.value) || 0)}
        />
      </div>

      <div className={`${PANEL_CLASS} mt-6 p-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">買い目入力</h3>
          <button type="button" onClick={addTicketRow} className={SMALL_BUTTON_CLASS}>
            行を追加
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {tickets.map((ticket, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-3 rounded-md border border-white/15 bg-slate-950/40 p-3 sm:grid-cols-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">券種</label>
                <select
                  value={ticket.type}
                  onChange={(event) => handleTicketChange(index, "type", event.target.value)}
                  className={INPUT_BASE_CLASS}
                  required
                >
                  <option value="">選択してください</option>
                  {BET_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-slate-300">馬番号</label>
                <input
                  value={ticket.numbers}
                  onChange={(event) => handleTicketChange(index, "numbers", event.target.value)}
                  placeholder="例: 1-2-3"
                  className={INPUT_BASE_CLASS}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">購入金額</label>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={ticket.amount}
                  onChange={(event) => handleTicketChange(index, "amount", event.target.value)}
                  className={INPUT_BASE_CLASS}
                  required
                />
              </div>
              <div className="sm:col-span-4">
                <button
                  type="button"
                  onClick={() => removeTicketRow(index)}
                  className="text-xs text-rose-300 transition hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={tickets.length <= 1}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`${PANEL_CLASS} mt-4 flex flex-wrap items-center gap-4 border-white/15 bg-slate-950/30 p-4 text-sm text-slate-200`}
        >
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">合計購入金額</p>
            <p className="mt-1 text-base font-semibold text-white">{formatCurrency(totalPurchase)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">回収率</p>
            <p
              className={`mt-1 text-base font-semibold ${
                recoveryRate >= 100 ? "text-emerald-300" : "text-white"
              }`}
            >
              {recoveryRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <label htmlFor="memo" className="text-sm font-medium text-slate-200">
          メモ
        </label>
        <textarea
          id="memo"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          rows={3}
          placeholder="コメントなど"
          className={`${INPUT_BASE_CLASS} min-h-[120px]`}
        />
      </div>

      <div className="mt-6 space-y-2">
        <label className="text-sm font-medium text-slate-200">画像</label>
        <div
          className={`rounded-lg border-2 border-dashed p-6 text-sm transition ${
            isDragging
              ? "border-emerald-400/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/20"
              : "border-white/20 bg-slate-950/30"
          } text-slate-200`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" ref={fileInputRef} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${SMALL_BUTTON_CLASS} mt-3 inline-flex items-center px-4`}
          >
            ファイルを選択
          </button>
          <p className="mt-2 text-xs text-slate-300">
            クリックまたはドラッグ＆ドロップで画像を選択できます。画像は Supabase Storage に保存されます。
          </p>
          {imagePreview && (
            <div className="mt-4 overflow-hidden rounded-lg border border-white/15 bg-slate-950/40">
              <img src={imagePreview} alt="プレビュー" className="h-auto w-full" />
            </div>
          )}
          {(existingImagePath || selectedFile) && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setImageData(null);
                setImagePreview(null);
                if (existingImagePath) {
                  setRemoveExistingImage(true);
                }
              }}
              className={`${SMALL_BUTTON_CLASS} mt-3 inline-flex items-center px-4`}
            >
              画像を削除
            </button>
          )}
          <button
            type="button"
            onClick={handleRunOcr}
            disabled={ocrLoading || ocrDisabled}
            className={`${PRIMARY_BUTTON_CLASS} mt-4 inline-flex items-center px-5 py-2 text-xs`}
          >
            {ocrLoading ? "解析中..." : "OCRで自動入力"}
          </button>
          {ocrDisabled && (
            <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <p>{FEATURE_MESSAGES.ocrDisabled}</p>
              {plan.upgradeUrl && (
                <a
                  href={plan.upgradeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-amber-200 underline decoration-dotted underline-offset-4 hover:text-amber-100"
                >
                  アップグレードの詳細を見る
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className={`${DANGER_PANEL_CLASS} mt-6`}>
          {error}
        </div>
      )}

      {planLimitNotice && (
        <div
          className={`mt-6 rounded-md border px-3 py-2 text-xs ${
            limitReached
              ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
              : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          <p>{planLimitNotice}</p>
          {limitReached && plan.maxBets !== null && (
            <p className="mt-1">
              {FEATURE_MESSAGES.maxBets(plan.maxBets)}
              {plan.upgradeUrl && (
                <a
                  href={plan.upgradeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-emerald-200 underline decoration-dotted underline-offset-4 hover:text-emerald-100"
                >
                  アップグレードはこちら
                </a>
              )}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={loading || limitReached} className={PRIMARY_BUTTON_CLASS}>
          {loading ? "保存中..." : "保存"}
        </button>
        <button type="button" onClick={resetForm} className={SECONDARY_BUTTON_CLASS}>
          フォームをリセット
        </button>
      </div>
    </form>
  );
};

const TextField = ({ label, className, ...props }: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) => (
  <div className={className ? `${className} space-y-1` : "space-y-1"}>
    <label className="text-sm font-medium text-slate-200">{label}</label>
    <input {...props} className={INPUT_BASE_CLASS} />
  </div>
);

type SelectOption = { value: string; label: string };

type SelectOptionGroup = { label: string; options: SelectOption[] };

const SelectField = ({
  label,
  options = [],
  optionGroups = [],
  placeholder = "選択してください",
  className,
  ...props
}: {
  label: string;
  options?: SelectOption[];
  optionGroups?: SelectOptionGroup[];
  placeholder?: string;
  className?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className={className ? `${className} space-y-1` : "space-y-1"}>
    <label className="text-sm font-medium text-slate-200">{label}</label>
    <select {...props} className={INPUT_BASE_CLASS}>
      <option value="">{placeholder}</option>
      {optionGroups.map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      ))}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);
