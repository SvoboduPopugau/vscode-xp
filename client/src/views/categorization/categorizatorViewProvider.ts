import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as os from 'os'

import { Configuration } from "../../models/configuration" 
import { RuleBaseItem } from '../../models/content/ruleBaseItem';
import { MustacheFormatter } from '../mustacheFormatter';
import { Normalization } from '../../models/content/normalization';
import { DialogHelper } from '../../helpers/dialogHelper';
import { Log } from '../../extension';
import { FileSystemHelper } from '../../helpers/fileSystemHelper';
import { ExtensionState  } from '../../models/applicationState';
import { ExceptionHelper } from '../../helpers/exceptionHelper';
import { TreeWalker } from './categorizatorTreeWalker'
import { get } from 'http';
import { categorizationHandler } from './categorizationHandler';

export class CategorizatorViewProvider {

	public static readonly viewId = 'CategorizationView';
	public static showCategorizatorCommand = 'CategorizationView.showCategorizator';
	private static categoryBorder = '########';

	private _view?: vscode.WebviewPanel;
	private rule: Normalization;
	private _treeWalker: TreeWalker;
	private _categorizationHandler: categorizationHandler;


	constructor(
		private readonly config: Configuration,
		private readonly _templatePath: string,
	) { 
		this._treeWalker = new TreeWalker(
			path.join(this.config.getExtensionPath(), "client",  "src", "views", "categorization", "categorization_tree.json")
		)
	  }


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
		this._categorizationHandler = new categorizationHandler(this.rule);

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

		Log.info(`WebView ${CategorizatorViewProvider.name} была загружена/обновлена.`);

		const resourcesUri = this.config.getExtensionUri();
		const extensionBaseUri = this._view.webview.asWebviewUri(resourcesUri);

		const webviewUri = this.getUri(this._view.webview, this.config.getExtensionUri(), ["client", "out", "ui.js"]);


		const plain = {
			"ExtensionBaseUri": extensionBaseUri,
			"RuleName": this.rule.getName(),
			"LevelName": this._treeWalker.current_step,
			"domains": encodeURIComponent(this._treeWalker.domain_names.join('|')),

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
				const description = this.getDescription(message);
				await this.updateDescription(description);
				break;
			}
			case 'nextStep': {
				var level = '';
				var domains = [];
				if (message.level != 'raws'){
					this._treeWalker.choose_by_domain(message.domain);
				}

				if (this._treeWalker.current_step != 'Finish') {
					level = this._treeWalker.current_step;
					domains = this._treeWalker.domain_names;
				} else if (message.level != 'raws') {
					level = `raws`;
					domains = this.range(1, this.rule.getUnitTests().length).map(String);
					domains.unshift('all');
				}

				await this.nextStep(level, domains);
				break;
			}
			// BUG: После того, как выбрали равку при нажатии на кнопку назад у нас убирается не равка, а уровень категории, 
			// и потом мы обратно сможем вернуться на выбор равки, но тогда их будет две - непорядок
			case 'prevStep': {
				if (message.level == 'raws') {
					const level = `raws`;
					var domains = [];
					domains = this.range(1, this.rule.getUnitTests().length).map(String);
					domains.unshift('all');
				} else {
					this._treeWalker.reset_to_step(message.level);
	
					const level = this._treeWalker.current_step;
					const domains  = this._treeWalker.domain_names;
				}

				await this.prevStep(level, domains);
				break;
			}
			case 'saveCategory': {
				const category_text = message.value;
				await this.saveCategory(category_text);
				this._treeWalker.reset();

				this.reset_view();
				DialogHelper.showInfo(this.config.getMessage('View.Categorizator.Info.CategorySaved'));
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

	public async nextStep(levelName: string, domains: string[]): Promise<boolean>  	{
		return this._view.webview.postMessage({
			'command':  'nextStep',
			'level': levelName,
			'domains': domains
			});
	}

	public async prevStep(levelName: string, domains: string[]): Promise<boolean>  	{
		return this._view.webview.postMessage({
			'command':  'prevStep',
			'level': levelName,
			'domains': domains
			});
	}

	public async saveCategory(category: string): Promise<void>  {
		const converted_category = CategorizatorViewProvider.convertCategoryText(category)
		this.rule.addCategorization(converted_category);
		await this.rule.saveMetaInfoAndLocalizations();
	}

	public async reset_view(): Promise<boolean>   {
		return this._view.webview.postMessage({
			'command': 'resetView'
		});
	}

	private static convertCategoryText(text: string): string  {
		var lines = text.split(/\r?\n/);
		Log.info(String(lines.length));
		lines = lines.map(line => '# ' + line);
		lines.unshift(this.categoryBorder);
		lines.push(this.categoryBorder);
		return lines.join(os.EOL);
	}

	private getDescription(message: any): string {
		var description = '';
		if (message.level != 'raws'){
			description = this._treeWalker.get_domain_full_description(message.domain);
		} else {
			if (message.domain == 'all'){
				description = 'Категория относится ко всем тестам нормализации';
			} else {
				description = `Категория относится к тесту нормализации №${message.domain}`;
			}
		}
		return description;
	}

	private range(start = 0, end: number): number[] {
		return Array.from({length: end - start + 1}, (_, i) => start + i);
	}

	private getUri(webview: vscode.Webview, extensionUri: vscode.Uri, pathList: string[]) {
		return webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, ...pathList));
	}
}