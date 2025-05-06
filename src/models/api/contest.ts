import { ProblemMetadataContestContext } from "./problem";

export enum ContestSubject {
  DSA = "SDA",
  OOP = "POO",
}

export const getAcademicYearsRange = (): string[] =>
  [...Array(new Date().getFullYear() - 2022)].map(
    (_, offset) => `${2022 + offset - 1}-${2022 + offset}`
  );

export enum EnrollmentStatus {
  ENROLLED = "ENROLLED",
  NOT_ENROLLED = "NOT_ENROLLED",
}

export interface ContestResponse {
  current_time: string;
  contest: Contest;
}

export interface Contest {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  user_id: number;
  subject_abbreviation: ContestSubject;
  description: string;
  problems: ProblemMetadataContestContext[];
  password: boolean;

  prize?: string;
  scoring?: string;
  rules?: string;

  collab_username?: string;
  collab_id?: number;
}

export interface ContestCreate {
  name: string;
  start_date: string;
  end_date: string;
  user_id?: number;
  collab_username?: string;
  subject_abbreviation: ContestSubject;
  description: string;
  password?: string;
  prize?: string;
  scoring?: string;
  rules?: string;
  problems?: number[];
  quotas?: number[];
}

export interface ContestCreateResponse {
  status: string;
  message: string;
  id: number;
}
