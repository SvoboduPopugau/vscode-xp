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
import { ExtensionState  } from '../../models/applicationState';
import { ExceptionHelper } from '../../helpers/exceptionHelper';

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
			(message) => {
				this.recieveMessageFromWebview(message);
			},
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

		if (ExtensionState.get().isExecutedState()) {
			DialogHelper.showWarning(
				Configuration.get().getMessage("WaitForCommandToFinishExecuting")
			);
			return true;
		}

		try {
			
			ExtensionState.get().startExecutionState();
			await this.executeCommand(message);
		}
		catch (error) {
			ExceptionHelper.show(error, `Ошибка выполнения команды '${message.command}'`);
			return true;
		}
		finally {
			ExtensionState.get().stopExecutionState();
		}
	}

	private async executeCommand(message: any){
		switch (message.command)  {
			case 'showError':  {
				const error = this.config.getMessage(`View.Categorizator.Error.${message.value}`);
				vscode.window.showErrorMessage(error);
				break;
			}
			case 'getDesctiption': {
				// TODO: Нужно брать описание нужного нам значения у TreeWalker 
				var description = `Описание нашего, горячо любимого ${message.value}`

				await this.updateDescription(description);
				break;
			}
			case 'nextStep': {
				// TODO: Нужно брать имя домена и его возможные значения у TreeWalker
				const domainName = `DomainName`;
				const values = ['Узел 1', 'Узел 2', 'Узел 3', 'Узел 4',  'Узел 5'];

				await this.nextStep(domainName, values);
				break;
			}
		}
		return;
	}

	public async updateDescription(value: string): Promise<boolean>  {
		return this._view.webview.postMessage({
			'command':  'updateDescription',
			'value': value
			});
	}

	public async nextStep(domainName: string, values: string[]): Promise<boolean>  	{
		return this._view.webview.postMessage({
			'command':  'nextStep',
			'domain': domainName,
			'values': values
			});
	}

	private getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
		return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
	}
}