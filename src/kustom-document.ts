/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';

export const PREVIEW_SCHEMA = 'kustomize-preview';

export class KustomizationDocumentProvider implements vscode.TextDocumentContentProvider {
  private readonly onDidChangeEventEmitter = new vscode.EventEmitter<vscode.Uri>();
  onDidChange?: vscode.Event<vscode.Uri> | undefined = this.onDidChangeEventEmitter.event;

  private contentCache = new Map<string, string>();

  provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
    if (this.contentCache.has(uri.toString())) {
      return this.contentCache.get(uri.toString());
    }
  }

  addContent(uri: vscode.Uri, content: string): void {
    this.contentCache.set(uri.toString(), content);
  }

  createUri(res: string): vscode.Uri {
    return vscode.Uri.parse(`${PREVIEW_SCHEMA}://${res}/kustomization-preview.yaml`);
  }
}
