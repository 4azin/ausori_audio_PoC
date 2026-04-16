export interface CategoryMajor {
  id: number;
  name: string;
}

export interface CategoryMid {
  id: number;
  majorId: number;
  name: string;
}

/**
 * sub 는 mid 에 종속되지 않는 flat 라벨 풀.
 * "특정 mid 하위에서 실제로 사용되는 sub" 는 sound_assets 테이블에서 도출.
 */
export interface CategorySub {
  id: number;
  name: string;
}

export interface CategoryTree extends CategoryMajor {
  /** 각 mid 의 children 은 sound_assets 데이터에 등장한 sub 만 포함 */
  children: (CategoryMid & { children: CategorySub[] })[];
}
