export interface FeedbackResult {
  id: number;
  reference: string;         // laundry.feedback.name (e.g. "FBK/2026/00001")
  order_id: number;
  rating: number;
  would_recommend?: boolean;
  comment?: string;
  submitted_at: string;      // date_submitted → ISO 8601
}

export interface SubmitFeedbackInput {
  order_id: number;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  would_recommend?: boolean;
}
