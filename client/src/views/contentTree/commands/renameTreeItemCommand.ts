import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { ContentTreeProvider } from '../contentTreeProvider';
import { RuleBaseItem } from '../../../models/content/ruleBaseItem';
import { DialogHelper } from '../../../helpers/dialogHelper';
import { ContentHelper } from '../../../helpers/contentHelper';
import { Configuration } from '../../../models/configuration';
import { ViewCommand } from '../../../models/command/command';

export class RenameTreeItemCommand extends ViewCommand {

	constructor(private config: Configuration, private selectedItem: RuleBaseItem) {
		super();
	}

	public async execute(): Promise<void> {

		const ruleDirPath = this.selectedItem.getDirectoryPath();

		let stopExecution = false;
		vscode.workspace.textDocuments.forEach( td => {
			const openFilePath = td.fileName;

			// Есть несохраненные пути в переименовываемом правиле.
			if(td.isDirty && openFilePath.includes(ruleDirPath)) {
				const fileName = path.basename(openFilePath);
				stopExecution = true;
				DialogHelper.showInfo(`Файл '${fileName}' не сохранен. Сохраните его и повторите действие.`);
			}
		});

		if(stopExecution) {
			return;
		}

		const oldRuleName = this.selectedItem.getName();
		const userInput = await vscode.window.showInputBox( 
			{
				ignoreFocusOut: true,
				value : oldRuleName,
				placeHolder: 'Новое название правила',
				prompt: 'Новое название правила',
				validateInput: (v) => {
					return ContentHelper.validateContentItemName(v);
				}
			}
		);

		if(!userInput) {
			return;
		}
		
		try {
			// Получаем директорию для исходного правила, дабы удалить ее после переименования.
			const oldRuleDirectoryPath = this.selectedItem.getDirectoryPath();

			const newRuleName = userInput.trim();
			await this.selectedItem.rename(newRuleName);
			await this.selectedItem.save();

			// Если мы меняем не имя правила, а его регистр, то удалять правило не надо. 
			// Иначе в Windows мы удалим новое правило.
			const oldRuleNameLowerCase = oldRuleName.toLocaleLowerCase();
			if(newRuleName.toLocaleLowerCase() !== oldRuleNameLowerCase) {
				// Удаляем старое правило и сохраняем новое.
				await fs.promises.rmdir(oldRuleDirectoryPath, { recursive: true });
			}
	
			// Обновить дерево и открыть корреляцию.
			await vscode.commands.executeCommand(ContentTreeProvider.refreshTreeCommand);
			await vscode.commands.executeCommand(ContentTreeProvider.onRuleClickCommand, this.selectedItem);
		}
		catch(error) {
			DialogHelper.showInfo("Не удалось переименовать объект");
			return;
		}
	}
}
