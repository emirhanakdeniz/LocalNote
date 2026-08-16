export type Page = {
  id: string;
  title: string;
  parentId: string | null;
  position: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
  deletedAt?: string | null;
};
