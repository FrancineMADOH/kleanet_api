export interface FaqCategory {
  id: number;
  name: string;
}

export interface FaqItem {
  id: number;
  reference: string;       // laundry.faq.name (e.g. "FAQ/2026/00001")
  question: string;
  answer: string;
  category: FaqCategory | null;
  sequence: number;
}

export interface ListFaqQuery {
  category_id?: number;
}
