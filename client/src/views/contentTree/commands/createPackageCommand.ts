import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { KbHelper } from '../../../helpers/kbHelper';
import { RuleBaseItem } from '../../../models/content/ruleBaseItem';
import { ContentTreeProvider } from '../contentTreeProvider';
import { FileSystemHelper } from '../../../helpers/fileSystemHelper';
import { Configuration } from '../../../models/configuration';
import { YamlHelper } from '../../../helpers/yamlHelper';
import { MetaInfo } from '../../../models/metaInfo/metaInfo';
import { ContentFolder } from '../../../models/content/contentFolder';
import { ViewCommand } from '../../../models/command/command';

export class CreatePackageCommand extends ViewCommand {

	public constructor(private config: Configuration, private selectedItem: RuleBaseItem) {
		super();
	}
	
	public async execute() : Promise<void> {

		const userInput = await vscode.window.showInputBox(
			{
				ignoreFocusOut: true,
				placeHolder: 'Название пакета',
				prompt: 'Название пакета',
				// TODO: убрать дублирование кода валидации
				// Учесть отличие локализации
				validateInput: (v) => {
					const trimmed = v.trim();
					// Корректность имени директории с точки зрения ОС.
					if(trimmed.includes(">") || trimmed.includes("<") || trimmed.includes(":") || trimmed.includes("\"") || trimmed.includes("/") || trimmed.includes("|") || trimmed.includes("?") || trimmed.includes("*"))
						return "Название пакета содержит недопустимые символы";

					if(trimmed === '')
						return "Название пакета должно содержать хотя бы один символ";

					// Не используем штатные директории контента.
					const contentSubDirectories = KbHelper.getContentSubDirectories();
					if(contentSubDirectories.includes(trimmed))
						return "Это название пакета зарезервировано и не может быть использовано";

					// Английский язык
					const englishAlphabet = /^[a-z0-9_]*$/;
					if(!englishAlphabet.test(trimmed)) {
						return "Используйте только строчные английские буквы, цифры и символ подчеркивания";
					}

					// Невозможность создать уже созданную директорию.
					const newFolderPath = path.join(this.selectedItem.getParentPath(), trimmed);
					if(fs.existsSync(newFolderPath))
						return "Пакет с таким названием уже существует";
				}
			}
		);

		if(!userInput) {
			return;
		}

		const packageName = userInput.trim();
		const selectedItemDirPath = this.selectedItem.getDirectoryPath();

		// Пакет
		const newPackagePath = path.join(selectedItemDirPath, packageName);
		await fs.promises.mkdir(newPackagePath, {recursive: true});

		const aggregationPath = path.join(newPackagePath, "aggregation_rules");
		await fs.promises.mkdir(aggregationPath, {recursive: true});

		const normalizationPath = path.join(newPackagePath, "normalization_formulas");
		await fs.promises.mkdir(normalizationPath, {recursive: true});

		const correlationPath = path.join(newPackagePath, "correlation_rules");
		await fs.promises.mkdir(correlationPath, {recursive: true});

		const enrichmentPath = path.join(newPackagePath, "enrichment_rules");
		await fs.promises.mkdir(enrichmentPath, {recursive: true});

		const tablesPath = path.join(newPackagePath, "tabular_lists");
		await fs.promises.mkdir(tablesPath, {recursive: true});

		// Пакет -> _meta
		const metaPath = path.join(newPackagePath, ContentFolder.PACKAGE_METAINFO_DIRNAME);
		await fs.promises.mkdir(metaPath, {recursive: true});

		// Пакет -> _meta -> metainfo.yaml
		const metainfoPath = path.join(metaPath, MetaInfo.METAINFO_FILENAME);

		const contentPrefix = Configuration.get().getContentPrefix();
		let defaultMetainfoObject: any;
		if(contentPrefix !== "") {
			const objectId = KbHelper.generateObjectId(packageName, contentPrefix, 'PKG');
			defaultMetainfoObject = {
				ObjectId: objectId,
				Version: "1.0.0"
			};
		} else {
			defaultMetainfoObject = {
				Version: "1.0.0"
			};
		}

		const defaultMetainfoContent = YamlHelper.stringify(defaultMetainfoObject);
		await FileSystemHelper.writeContentFile(metainfoPath, defaultMetainfoContent);

		await ContentTreeProvider.refresh();
	}
}
