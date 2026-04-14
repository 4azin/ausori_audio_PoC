export interface CategoryMajor {
  id: number;
  name: string;
}

export interface CategoryMid {
  id: number;
  majorId: number;
  name: string;
}

export interface CategorySub {
  id: number;
  midId: number;
  name: string;
}

export interface CategoryTree extends CategoryMajor {
  children: (CategoryMid & { children: CategorySub[] })[];
}
