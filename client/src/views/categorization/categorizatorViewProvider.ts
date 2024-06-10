import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {Configuration} from "../../models/configuration" 
import { RuleBaseItem } from '../../models/content/ruleBaseItem';
import { MustacheFormatter } from '../mustacheFormatter';
import { Normalization } from '../../models/content/normalization';
import { DialogHelper } from '../../helpers/dialogHelper';
import { Log } from '../../extension';
import { FileSystemHelper } from '../../helpers/fileSystemHelper';

export class CategorizatorViewProvider {

	public static readonly viewId = 'CategorizationView';
	public static showCategorizatorCommand = "CategorizationView.showCategorizator";

	private _view?: vscode.WebviewPanel;
	private rule: RuleBaseItem;

	


	constructor(
		private readonly config: Configuration,
		private readonly _templatePath: string,
	) { }


	public static init(config: Configuration): void {

		const templatePath = path.join(
			config.getExtensionPath(), "client", "templates", "Categorizator.html");

		const provider = new CategorizatorViewProvider(
			config, 
			templatePath
		);

		// Подписываемся на команду показа категоризатора
		config.getContext().subscriptions.push(
			vscode.commands.registerCommand(
				CategorizatorViewProvider.showCategorizatorCommand,
				async (rule: Normalization) => {
					// Обновляем юнит тесты для формулы нормализации, чтобы было возможно увидеть актуальные тесты при их модификации
					if (!rule) {
						DialogHelper.showError("Формула не успела еще загрузиться. Повторите еще раз");
						return;
					}

					rule.reloadUnitTests();
					provider.showCategorizator(rule);
				}
			)
		);	

	}

	public async showCategorizator(rule: Normalization): Promise<void> {

		Log.debug(`Категоризатор открыт для формулы нормализации ${rule.getName()}`);

		if (this._view)  {
			Log.debug(`Открытый ранее категоризатор для формулы нормализации  ${this.rule.getName()} был автоматически закрыт`);

			this.rule = null;
			this._view.dispose();
		}

		if (!(rule instanceof Normalization)) {
			DialogHelper.showWarning(`Категоризатор не поддерживает правил кроме формул нормализации`);
			return;
		}

		this.rule = rule;

		const viewTitle = this.config.getMessage("View.Categorizator.Title", this.rule.getName())
		const resources = [vscode.Uri.joinPath(this.config.getExtensionUri(), "client", "out"),
			vscode.Uri.joinPath(this.config.getExtensionUri(),  "client", "templates", "styles"),
			vscode.Uri.joinPath(this.config.getExtensionUri(), 	"client", "templates", "js")
		];

		// Создаем новое окно
		this._view = vscode.window.createWebviewPanel(
			CategorizatorViewProvider.viewId, 
			viewTitle, 
			vscode.ViewColumn.One, 
			{
				retainContextWhenHidden: true,
				enableScripts: true,
				enableFindWidget: true,
				localResourceRoots: resources
			}
		);

		this._view.onDidDispose(async (e: void) => {
			this._view = undefined;
			// TODO: Возможно подчистить хвосты, если создавали какие-то изменения в файловой системе
		}, 
			this);

		// Создаем обработчик входящих сообщений
		this._view.webview.onDidReceiveMessage(
			this.recieveMessageFromWebview,
			this
		);
		
		await this.updateWebView();
	}

	private async updateWebView(): Promise<void> {
		if (!this._view) {
			return;
		}

		Log.debug(`WebView ${CategorizatorViewProvider.name} была загружена/обновлена.`);

		const resourcesUri = this.config.getExtensionUri();
		const extensionBaseUri = this._view.webview.asWebviewUri(resourcesUri);

		const webviewUri = this.getUri(this._view.webview, this.config.getExtensionUri(), ["client", "out", "ui.js"]);


		const plain = {
			"IntegrationTests": [],
			"ExtensionBaseUri": extensionBaseUri,
			"RuleName": this.rule.getName(),

			// Локализация вьюшки
			"Locale" : {
				"NextStep": this.config.getMessage("View.Categorizator.NextStep"),
				"PreviousStep": this.config.getMessage("View.Categorizator.PreviousStep"),
				"Save" : this.config.getMessage('View.Categorizator.Save'),
				"GategorizationProcess": this.config.getMessage("View.Categorizator.GategorizationProcess"),
				"ChooseValue": this.config.getMessage("View.Categorizator.ChooseValue"),
				"ValueDescription": this.config.getMessage("View.Categorizator.ValueDescription")
			}
		};
		const template = await FileSystemHelper.readContentFile(this._templatePath);
		const formatter = new MustacheFormatter(template);
		const htmlContent = formatter.format(plain);
		this._view.webview.html = htmlContent;
	}

	private async recieveMessageFromWebview(message: any) {
		// TODO: Добавить обработчик событий приходящих из вьюшки
		return false;
	}

	private getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
		return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
	}
}