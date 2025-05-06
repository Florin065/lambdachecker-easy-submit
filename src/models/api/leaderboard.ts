export interface RankingResponse {
  ranking: RankListEntry[];
  paginate: boolean;
  total_pages: number;
}

export interface RankListEntry {
  username: string;
  points: number;
  max_submissions: MaxSubmissionMeta[];
}

export interface MaxSubmissionMeta {
  problem_id: number;
  grade: number;
  date: string;
  all_subs_count: number;
}

export interface ProblemTotalGrade {
  id: number;
  total: number;
}
