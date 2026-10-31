export interface Service {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  icon: string;
  imageUrl: string | null;
  isPublished: boolean;
  sortOrder: number;
  durationMinutes: number | null;
  priceCents: number | null;
  showPrice: boolean;
  createdAt: string;
  updatedAt: string;
}
