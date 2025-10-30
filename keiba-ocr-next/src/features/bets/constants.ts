export type TrackOption = {
  value: string;
  label: string;
};

export type TrackOptionGroup = {
  label: string;
  options: TrackOption[];
};

export const CENTRAL_TRACK_GROUP_LABEL = "中央競馬 (JRA)";
export const LOCAL_TRACK_GROUP_LABEL = "地方競馬";

export const TRACK_GROUPS: TrackOptionGroup[] = [
  {
    label: CENTRAL_TRACK_GROUP_LABEL,
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
    label: LOCAL_TRACK_GROUP_LABEL,
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

export const TRACK_SINGLE_OPTIONS: TrackOption[] = [{ value: "その他", label: "その他" }];

export const UNSPECIFIED_TRACK_OPTION: TrackOption = {
  value: "__UNSPECIFIED__",
  label: "競馬場未設定",
};

export const CENTRAL_TRACK_VALUES = TRACK_GROUPS.find(
  (group) => group.label === CENTRAL_TRACK_GROUP_LABEL,
)?.options.map((option) => option.value) ?? [];

export const LOCAL_TRACK_VALUES = TRACK_GROUPS.find(
  (group) => group.label === LOCAL_TRACK_GROUP_LABEL,
)?.options.map((option) => option.value) ?? [];

export const ALL_TRACK_VALUES = [
  ...TRACK_GROUPS.flatMap((group) => group.options.map((option) => option.value)),
  ...TRACK_SINGLE_OPTIONS.map((option) => option.value),
  UNSPECIFIED_TRACK_OPTION.value,
];
