/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { KustomizationDocumentProvider, PREVIEW_SCHEMA } from './kustom-document';
import { KustomizeCli } from './kustomize';
import { PreviewManager } from './kustomize-preview';
import { JSONSchemaContributor } from './schema-provider';
import { detectCli } from './tools';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  new JSONSchemaContributor(context).registerContribution();

  const cli = await detectCli('kustomize');
  if (!cli) {
    const result = await vscode.window.showErrorMessage('Cannot find "kustomize" cli, to get this extension working you need to install it', 'Install', 'Cancel');
    if (result === 'Install') {
      vscode.env.openExternal(vscode.Uri.parse('https://kubectl.docs.kubernetes.io/installation/kustomize/'));
    }
    return;
  }
  const kustomDocProvider = new KustomizationDocumentProvider();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEMA, kustomDocProvider));

  const kustomize = new KustomizeCli(cli);

  const previewManager = new PreviewManager(kustomDocProvider, kustomize);

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-kustomize.build', (res) => {
      kustomize.build(res);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-kustomize.preview', (res) => {
      previewManager.showKustomizePreview(res);
    })
  );
}

// this method is called when your extension is deactivated
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function deactivate() {}
