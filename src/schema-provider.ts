/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/naming-convention
enum MODIFICATION_ACTIONS {
  'delete',
  'add',
}

interface SchemaAdditions {
  schema: string;
  action: MODIFICATION_ACTIONS.add;
  path: string;
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
}

interface SchemaDeletions {
  schema: string;
  action: MODIFICATION_ACTIONS.delete;
  path: string;
  key: string;
}

interface YamlExtensionAPI {
  registerContributor(
    schema: string,
    requestSchema: (resource: string) => string | undefined,
    requestSchemaContent: (uri: string) => Promise<string | undefined>,
    label?: string
  ): boolean;
  modifySchemaContent(schemaModifications: SchemaAdditions | SchemaDeletions): Promise<void>;
}
const VSCODE_YAML_EXTENSION_ID = 'redhat.vscode-yaml';

export class JSONSchemaContributor {
  private readonly uriCache = new Map<string, string>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  async registerContribution(): Promise<void> {
    const yamlPlugin = await this.activateYamlExtension();
    if (!yamlPlugin || !yamlPlugin.modifySchemaContent) {
      // activateYamlExtension has already alerted to users for errors.
      return;
    }

    yamlPlugin.registerContributor(
      'kustomize',
      this.requestYamlSchemaUriCallback.bind(this),
      this.requestYamlSchemaContentCallback.bind(this),
      'apiVersion:kustomize.config.k8s.io/v1beta1'
    );
  }

  private async activateYamlExtension(): Promise<YamlExtensionAPI | undefined> {
    const ext = vscode.extensions.getExtension(VSCODE_YAML_EXTENSION_ID);
    if (!ext) {
      vscode.window.showWarningMessage("Please install 'YAML Support by Red Hat' via the Extensions pane.");
      return undefined;
    }
    const yamlPlugin = await ext.activate();

    if (!yamlPlugin || !yamlPlugin.registerContributor) {
      vscode.window.showWarningMessage(
        "The installed Red Hat YAML extension doesn't support JSON schema contribution. Please upgrade 'YAML Support by Red Hat' via the Extensions pane."
      );
      return undefined;
    }

    if (!yamlPlugin || !yamlPlugin.modifySchemaContent) {
      vscode.window.showWarningMessage(
        "The installed Red Hat YAML extension doesn't support in memory schemas modification. Please upgrade 'YAML Support by Red Hat' via the Extensions pane."
      );
      return undefined;
    }
    return yamlPlugin;
  }

  private requestYamlSchemaUriCallback(resource: string): string | undefined {
    const textEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === resource);
    if (textEditor) {
      const schemaPath = 'kustomization.json';
      if (schemaPath) {
        let resourceUrl = vscode.Uri.parse(resource);
        const scheme = 'kustomize';
        resourceUrl = resourceUrl.with({ scheme });
        this.uriCache.set(resourceUrl.toString(), textEditor.document.uri.toString());
        return resourceUrl.toString();
      }
    }

    return undefined;
  }

  private async requestYamlSchemaContentCallback(uri: string): Promise<string | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    try {
      const doc = this.getDocument(uri);
      if (doc) {
        const schemaPath = 'kustomization.json';
        if (schemaPath) {
          const absPath = this.context.asAbsolutePath(path.join('schema', schemaPath));
          if (await fs.pathExists(absPath)) {
            return generateScheme(doc, absPath);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }

    return undefined;
  }

  private getDocument(tektonUri: string): vscode.TextDocument | undefined {
    if (this.uriCache.has(tektonUri)) {
      const resource = this.uriCache.get(tektonUri);
      const textEditor = vscode.window.visibleTextEditors.find((editor) => editor.document.uri.toString() === resource);
      if (textEditor) {
        return textEditor.document;
      }
    }
  }
}

function generateScheme(doc: vscode.TextDocument, schemaPath: string): Promise<string> {
  return fs.readFile(schemaPath, { encoding: 'UTF8' });
}
