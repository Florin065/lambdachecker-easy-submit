import * as os from "os";
import * as fs from 'fs'; 
import path from "path";
import * as vscode from "vscode";
import axios from 'axios';
import FormData from 'form-data';

import { Language, languageExtensions } from "../models";
import { ProblemEditor } from "../webview";
import { splitMergedJavaFile } from '../utils/split';
import { mergeFiles } from '../utils/merge';

export class SubmissionFile {
  private fileUri: vscode.Uri;

  constructor(
    public problemId: number,
    public problemName: string,
    public problemLanguage: Language,
    public problemSkel: string
  ) {
    this.fileUri = vscode.Uri.file(this.getSubmissionPath());
  }

  public get Uri(): vscode.Uri {
    return this.fileUri;
  }

  static getSubmissionsFolderPath(): string {
    let submissionsFolderPath = vscode.workspace
      .getConfiguration("lambdaChecker")
      .get<string>("submissionsFolder", "");

    if (submissionsFolderPath === "") {
      submissionsFolderPath = path.join(os.homedir(), "lambdachecker");
    }

    return submissionsFolderPath;
  }

  getSubmissionPath(): string {
    return path.join(
      SubmissionFile.getSubmissionsFolderPath(),
      `${this.problemId}_${this.problemName.trim().replaceAll(" ", "_")}${
        languageExtensions[this.problemLanguage] || ".tmp"
      }`
    );
  }

  private async fileExists(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.fileUri);
      return true;
    } catch {}

    return false;
  }

  /**
   * Prepares the submission file for sending to the server
   * by merging the split files into a single file.
   * This is only relevant for Java files.
   */
  async prepareSubmission(): Promise<void> {
    const ext = path.extname(this.fileUri.fsPath);
    if (ext !== '.java') {
      return;
    }
  
    const fileBaseName = path.basename(this.fileUri.fsPath, ext);
    const splitDir = path.join(path.dirname(this.fileUri.fsPath), fileBaseName);
    const outputFile = this.fileUri.fsPath;
  
    try {
      mergeFiles(splitDir, outputFile);
      vscode.window.showInformationMessage(`✅ Merged successfully into ${path.basename(outputFile)}.`);
    } catch (e: any) {
      vscode.window.showErrorMessage(`❌ Merge failed: ${e.message}`);
    }
  }

  /**
   * Sends the file to the server for compilation and execution with Valgrind.
   * Displays the output in a new editor tab.
   */
  async runWithValgrind(): Promise<void> {
    const ext = path.extname(this.fileUri.fsPath);
    if (ext !== '.c') {
      return;
    }
  
    const fileBuffer = await vscode.workspace.fs.readFile(this.fileUri);
    const buffer = Buffer.from(fileBuffer.buffer);
  
    const formData = new FormData();
    formData.append('file', buffer, path.basename(this.fileUri.fsPath));
  
    try {
      const res = await axios.post('https://flask-production-b613.up.railway.app/run', formData, {
        headers: formData.getHeaders()
      });
  
      const { status, output, valgrind_output } = res.data;
  
      if (status === 'compile_error') {
        vscode.window.showErrorMessage(`🛠️ Compilation failed:\n${output}`);
        return;
      }
  
      const baseDir = path.dirname(this.fileUri.fsPath);
      const outputDir = path.join(baseDir, 'valgrind_outputs');
      const baseName = path.basename(this.fileUri.fsPath, '.c');
      const outputFilePath = path.join(outputDir, `${baseName}.txt`);
      const outputUri = vscode.Uri.file(outputFilePath);
  
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }
  
      await vscode.workspace.fs.writeFile(outputUri, Buffer.from(valgrind_output));
  
      const sourceEditor = vscode.window.visibleTextEditors.find(e =>
        e.document.uri.fsPath === this.fileUri.fsPath
      );
  
      const targetColumn = sourceEditor?.viewColumn ?? vscode.ViewColumn.One;
  
      const doc = await vscode.workspace.openTextDocument(outputUri);
      await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: targetColumn
      });
  
      vscode.window.showInformationMessage(`✅ Valgrind output saved: ${outputFilePath}`);
    } catch (err: any) {
      vscode.window.showErrorMessage(`❌ Valgrind server error: ${err.message}`);
    }
  }

  /**
   * Creates a file with the skeleton code, if it does not exist
   */
  async createSubmissionFile(override: boolean = false): Promise<void> {
    if (!(await this.fileExists()) || override) {
      await vscode.workspace.fs.writeFile(
        this.fileUri,
        Buffer.from(this.problemSkel)
      );
    }
  }

  async openInEditor(override: boolean = false): Promise<void> {
    await this.createSubmissionFile(override);
  
    if (override) {
      const ext = path.extname(this.fileUri.fsPath);
      if (ext === '.java') {
        const fileBaseName = path.basename(this.fileUri.fsPath, ext);
        const splitDir = path.join(path.dirname(this.fileUri.fsPath), fileBaseName);
        if (fs.existsSync(splitDir)) {
          fs.rmSync(splitDir, { recursive: true, force: true });
        }
      }
    }

    await ProblemEditor.show(this);
  
    const ext = path.extname(this.fileUri.fsPath);
    if (ext === '.java') {
      const fileBaseName = path.basename(this.fileUri.fsPath, ext);
      const outputDir = path.join(path.dirname(this.fileUri.fsPath), fileBaseName);
  
      try {
        splitMergedJavaFile(this.fileUri.fsPath, outputDir);
  
        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.java')).sort();
  
        for (const file of files) {
          const fullPath = path.join(outputDir, file);
          const doc = await vscode.workspace.openTextDocument(fullPath);
          await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.Active
          });
        }
  
        vscode.window.showInformationMessage(`✅ Problem split in ${files.length} files.`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`❌ Split failed: ${e.message}`);
      }
    }
  }

  async readSubmissionFile(): Promise<Uint8Array> {
    await this.prepareSubmission();
    
    await this.createSubmissionFile();

    await this.runWithValgrind();
    
    return await vscode.workspace.fs.readFile(this.fileUri);
  }
}
