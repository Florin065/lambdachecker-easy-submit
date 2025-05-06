import * as vscode from "vscode";
import {
  Contest,
  ContestSubject,
  EnrollmentStatus,
  ProblemMetadataContestContext,
} from "../models";
import { ProblemItem, ProblemItemProps } from "./problemItem";

export interface ContestItemProps {
  type: string;
  subject?: ContestSubject;
  contestMetadata?: Contest;
  hasPassword?: boolean;

  children?: ContestItem[];
  status?: EnrollmentStatus;
}

export class ContestItem extends vscode.TreeItem {
  props: ContestItemProps;

  constructor(
    label: string,
    props: ContestItemProps,
    public partialPath: string
  ) {
    let collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    if (props.type === "problem") {
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    }

    super(label, collapsibleState);
    this.props = props;
  }
}
