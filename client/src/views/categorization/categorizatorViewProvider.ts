import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {Configuration} from "../../models/configuration" 
import { RuleBaseItem } from '../../models/content/ruleBaseItem';
import { MustacheFormatter } from '../mustacheFormatter';

export class CategorizatorViewProvider {

	private _view?: vscode.WebviewPanel;
	private _rule: RuleBaseItem;


	public static readonly viewId = 'CategorizationView';
	public static showCategorizatorCommand = "CategorizationView.showCategorizator";


	constructor(
		private readonly _config: Configuration,
		private readonly _formatter: MustacheFormatter
	) { }


	public static init(config: Configuration): CategorizatorViewProvider {
		
		// Создаем панель действий с кнопкой
		// Скорее всего надо куда-то перенести 
		// TODO: Убрать эту команду и создать вызов команды через ПКМ tree-provider
		let action = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
		action.command = this.showCategorizatorCommand;
		action.text = '$(rocket) Categorizator';
		action.tooltip = 'Нажмите, чтобы запустить мастер категоризации';
		action.show();

		const categorizationTemplateFilePath = path.join(
			config.getExtensionPath(), "client", "templates", "Categorizator.html");
		const categorizationTemplateContent = fs.readFileSync(categorizationTemplateFilePath).toString();

		const categorizatorViewProvider = new CategorizatorViewProvider(
			config, 
			new MustacheFormatter(categorizationTemplateContent)
		);


		config.getContext().subscriptions.push(
			vscode.commands.registerCommand(
				CategorizatorViewProvider.showCategorizatorCommand,
				async () => {
					categorizatorViewProvider.showCategorizator();
				}
			)
		);	


		return categorizatorViewProvider;
	}

	public async showCategorizator(): Promise<void> {
		    // Создаем новое окно
			this._view = vscode.window.createWebviewPanel(
				CategorizatorViewProvider.viewId, // Идентификатор окна
				'<Имя файла - формулы нормализации>', // Заголовок окна
				vscode.ViewColumn.One, // Колонка, в которой будет отображаться окно
				{
					enableScripts: true, // Включаем поддержку JavaScript
				}
			);

			// Создаем обработчик входящих сообщений
			this._view.webview.onDidReceiveMessage(
				(message) => {
					// TODO: Сделать метод для обработки событий, возможно связать с Updater
				  vscode.window.showInformationMessage(`Hello, you choose ${message.command}`)
				},
				this
			  );

			//   Задаем отображение html страницы 
			// TODO: Перевести обработку через formatter и updateWebView, возможно понадобиться Updater
			const categorizatorHtml = this._formatter.format({})
			this._view.webview.html = categorizatorHtml
	}

	private async updateWebView(): Promise<void> {
		if (!this._view) {
			return;
		}
		const categorizatorHtml = this._formatter.format({});

	}
}