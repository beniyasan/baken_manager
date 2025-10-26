"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, InputHTMLAttributes, SelectHTMLAttributes } from "react";
import type { BetRecord, BetTicket } from "@/lib/types";
import { useBetsContext } from "./BetsProvider";
import { mergeOcrResults, parseOcrText } from "../utils/ocr";
import { uploadBetImage, removeBetImage } from "../utils/storage";
import { supabaseClient } from "@/lib/supabaseClient";

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

const TRACK_OPTIONS = [
  "札幌",
  "函館",
  "福島",
  "新潟",
  "東京",
  "中山",
  "中京",
  "京都",
  "阪神",
  "小倉",
  "門別",
  "盛岡",
  "水沢",
  "浦和",
  "船橋",
  "大井",
  "川崎",
  "金沢",
  "笠松",
  "名古屋",
  "園田",
  "姫路",
  "高知",
  "佐賀",
  "帯広",
];

const defaultTicket: BetTicket = {
  type: "",
  numbers: "",
  amount: 100,
};

const today = () => new Date().toISOString().split("T")[0];

const formatCurrency = (value: number) => `¥${value.toLocaleString()}`;

export type BetsFormProps = {
  editingBet: BetRecord | null;
  onCancelEdit: () => void;
  onSuccess: () => void;
};

export const BetsForm = ({ editingBet, onCancelEdit, onSuccess }: BetsFormProps) => {
  const { addBet, updateBet } = useBetsContext();

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

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingBet ? "データ編集" : "新規データ追加"}
        </h2>
        {editingBet ? (
          <button
            type="button"
            onClick={() => {
              onCancelEdit();
              resetForm();
            }}
            className="text-sm text-slate-500 underline-offset-4 hover:text-slate-700 hover:underline"
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
          options={TRACK_OPTIONS.map((name) => ({ value: name, label: name }))}
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

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">買い目入力</h3>
          <button
            type="button"
            onClick={addTicketRow}
            className="rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
          >
            行を追加
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {tickets.map((ticket, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">券種</label>
                <select
                  value={ticket.type}
                  onChange={(event) => handleTicketChange(index, "type", event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
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
                <label className="text-xs font-medium text-slate-500">馬番号</label>
                <input
                  value={ticket.numbers}
                  onChange={(event) => handleTicketChange(index, "numbers", event.target.value)}
                  placeholder="例: 1-2-3"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">購入金額</label>
                <input
                  type="number"
                  min={100}
                  step={100}
                  value={ticket.amount}
                  onChange={(event) => handleTicketChange(index, "amount", event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>
              <div className="sm:col-span-4">
                <button
                  type="button"
                  onClick={() => removeTicketRow(index)}
                  className="text-xs text-rose-500 hover:text-rose-600"
                  disabled={tickets.length <= 1}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">合計購入金額</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(totalPurchase)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-slate-400">回収率</p>
            <p
              className={`mt-1 text-base font-semibold ${
                recoveryRate >= 100 ? "text-emerald-600" : "text-slate-900"
              }`}
            >
              {recoveryRate.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <label htmlFor="memo" className="text-sm font-medium text-slate-700">
          メモ
        </label>
        <textarea
          id="memo"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          rows={3}
          placeholder="コメントなど"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="mt-6 space-y-2">
        <label className="text-sm font-medium text-slate-700">画像</label>
        <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          <input type="file" accept="image/*" onChange={handleImageSelect} />
          <p className="mt-2 text-xs text-slate-500">画像は Supabase Storage に保存されます。</p>
      {imagePreview && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
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
              className="mt-3 inline-flex items-center rounded-md border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >
              画像を削除
            </button>
          )}
          <button
            type="button"
          onClick={handleRunOcr}
          disabled={ocrLoading || (!selectedFile && !imageData && !imagePreview)}
            className="mt-4 inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {ocrLoading ? "解析中..." : "OCRで自動入力"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
          {error}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-md border border-slate-200 px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          フォームをリセット
        </button>
      </div>
    </form>
  );
};

const TextField = ({ label, className, ...props }: { label: string; className?: string } & InputHTMLAttributes<HTMLInputElement>) => (
  <div className={className ? `${className} space-y-1` : "space-y-1"}>
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <input
      {...props}
      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
    />
  </div>
);

const SelectField = ({
  label,
  options,
  placeholder = "選択してください",
  className,
  ...props
}: {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
} & SelectHTMLAttributes<HTMLSelectElement>) => (
  <div className={className ? `${className} space-y-1` : "space-y-1"}>
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <select
      {...props}
      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);
