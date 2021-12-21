/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { KustomizationDocumentProvider } from './kustom-document';
import { KustomizeCli } from './kustomize';

export class PreviewManager {
  private previewDocument: vscode.TextDocument | undefined;
  private previewPath: string | undefined;

  constructor(private readonly docProvider: KustomizationDocumentProvider, private readonly kustomCli: KustomizeCli) {
    vscode.workspace.onDidCloseTextDocument((e) => {
      if (this.previewDocument && vscode.window.visibleTextEditors.length === 1) {
        vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        this.previewDocument = undefined;
      }
      if (e === this.previewDocument) {
        this.previewDocument = undefined;
      }
    });

    vscode.workspace.onDidSaveTextDocument(() => {
      if (this.previewDocument) {
        this.showKustomizePreview(this.previewPath);
      }
    });
  }

  async showKustomizePreview(path: string | undefined): Promise<void> {
    if (!path) {
      vscode.window.showWarningMessage('Cannot find path to preview!');
      return;
    }
    this.previewPath = path;
    const result = await this.kustomCli.preview(path);

    if (result.stderr) {
      vscode.window.showErrorMessage(result.stderr);
    }
    if (result.error) {
      vscode.window.showErrorMessage(result.error.message);
    }

    if (result.stdout) {
      if (this.previewDocument) {
        this.docProvider.addContent(this.previewDocument.uri, result.stdout, true);
      } else {
        const kustomUri = this.docProvider.createUri(path);
        this.docProvider.addContent(kustomUri, result.stdout);
        const doc = await vscode.workspace.openTextDocument(kustomUri);
        vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        this.previewDocument = doc;
      }
    }
  }
}
