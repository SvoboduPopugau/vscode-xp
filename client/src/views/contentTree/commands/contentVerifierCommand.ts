import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { DialogHelper } from '../../../helpers/dialogHelper';
import { Correlation } from '../../../models/content/correlation';
import { ContentItemStatus, RuleBaseItem } from '../../../models/content/ruleBaseItem';
import { ContentTreeProvider } from '../contentTreeProvider';
import { TestHelper } from '../../../helpers/testHelper';
import { SiemjManager } from '../../../models/siemj/siemjManager';
import { Configuration } from '../../../models/configuration';
import { RunIntegrationTestDialog } from '../../runIntegrationDialog';
import { SiemJOutputParser } from '../../../models/siemj/siemJOutputParser';
import { IntegrationTestRunner } from '../../../models/tests/integrationTestRunner';
import { ContentTreeBaseItem } from '../../../models/content/contentTreeBaseItem';
import { ExceptionHelper } from '../../../helpers/exceptionHelper';
import { Enrichment } from '../../../models/content/enrichment';
import { Log } from '../../../extension';
import { FileSystemHelper } from '../../../helpers/fileSystemHelper';
import { Normalization } from '../../../models/content/normalization';
import { TestStatus } from '../../../models/tests/testStatus';
import { BaseUnitTest } from '../../../models/tests/baseUnitTest';
import { ViewCommand } from './viewCommand';

/**
 * Проверяет контент по требованиям. В настоящий момент реализована только проверка интеграционных тестов и локализаций.
 * TODO: учесть обновление дерева контента пользователем во время операции.
 * TODO: после обновления дерева статусы item-ам присваиваться не будут, нужно обновить список обрабатываемых рулей.
 */
export class ContentVerifierCommand extends ViewCommand {
	constructor(private readonly config: Configuration, private parentItem: ContentTreeBaseItem) {
		super();
	}

	async execute() : Promise<void> {
		this._integrationTestTmpFilesPath = this.config.getRandTmpSubDirectoryPath();

		return await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			cancellable: true,
		}, async (progress, token) => {

			// Сбрасываем статус правил в исходный
			// TODO: Добавить поддержку других типов
			// const items = parentItem.getChildren();
			const totalChildItems = this.getChildrenRecursively(this.parentItem);
			const rules = totalChildItems.filter(i => (i instanceof RuleBaseItem)).map<RuleBaseItem>(r => r as RuleBaseItem);
			if(rules.length === 0) {
				DialogHelper.showInfo(`В директории ${this.parentItem.getName()} не найдено контента для проверки`);
				return;
			}

			// TODO: Обновление статуса ведет к обновлению дерева и утраты управления состоянием узлов.
			// for(const rule of rules) {
			// 	rule.setStatus(ContentItemStatus.Default);
			// }
			// ContentTreeProvider.refresh(parentItem);

			Log.info(`В ${this.parentItem.getName()} директории начата проверка ${rules.length} правил`);
			try {
				for(const rule of rules) {
					progress.report({ message: `Проверка правила ${rule.getName()}`});
					await this.testRule(rule, progress, token);
					await ContentTreeProvider.refresh(rule);
				}

				DialogHelper.showInfo(`Проверка директории ${this.parentItem.getName()} завершена`);
			}
			catch(error) {
				ExceptionHelper.show(error, "Неожиданная ошибка проверки контента");
			}
		});

		// TODO: Удалить временную директорию this._integrationTestTmpFilesPath
	}

	// private async buildAllArtifacts(rules: RuleBaseItem[], options: {progress: any, cancellationToken: vscode.CancellationToken}) : Promise<void> {
	// 	// Подбираем настройки сборки графа корреляции
	// 	for(const rule of rules) {
	// 		if(rule instanceof Correlation) {
	// 			// options.progress.report({ message: `Получение зависимостей правила ${rule.getName()} для корректной сборки графа корреляций` });
	// 			const ritd = new RunIntegrationTestDialog(this.config);
	// 			const runOptions = await ritd.getIntegrationTestRunOptions(rule);
	// 		}
	// 	}
	// }

	private async testRule(rule: RuleBaseItem, progress: any, cancellationToken: vscode.CancellationToken) {

		// В отдельную директорию положим все временные файлы, чтобы не путаться.
		if(fs.existsSync(this._integrationTestTmpFilesPath)) {
			await FileSystemHelper.deleteAllSubDirectoriesAndFiles(this._integrationTestTmpFilesPath);
		}
		
		const ruleTmpFilesRuleName = path.join(this._integrationTestTmpFilesPath, rule.getName());
		if(!fs.existsSync(ruleTmpFilesRuleName)) {
			await fs.promises.mkdir(ruleTmpFilesRuleName, {recursive: true});
		}

		// Тестирование нормализаций
		if(rule instanceof Normalization) {
			const tests = rule.getUnitTests();

			// Сбрасываем результаты предыдущих тестов.
			tests.forEach(t => t.setStatus(TestStatus.Unknown));
			const testHandler = async (unitTest : BaseUnitTest) => {
				const rule = unitTest.getRule();
				const testRunner = rule.getUnitTestRunner();
				return testRunner.run(unitTest);
			};
	
			// Запускаем все тесты
			for (let test of tests) {
				try {
					test = await testHandler(test);
				}
				catch(error) {
					test.setStatus(TestStatus.Failed);
					Log.error(error);
				} 
			}

			// Проверяем результаты тестов и меняем статус в UI.
			if(tests.every(t => t.getStatus() === TestStatus.Success)) {
				rule.setStatus(ContentItemStatus.Verified, "Тесты прошли проверку");
				return;
			}
			rule.setStatus(ContentItemStatus.Unverified, "Тесты не прошли проверку");

			ContentTreeProvider.refresh(rule);
		}

		if(rule instanceof Correlation || rule instanceof Enrichment) {
			progress.report({ message: `Получение зависимостей правила ${rule.getName()} для корректной сборки графа корреляций` });
			const ritd = new RunIntegrationTestDialog(this.config, ruleTmpFilesRuleName);
			const options = await ritd.getIntegrationTestRunOptions(rule);
			options.cancellationToken = cancellationToken;
	
			progress.report({ message: `Проверка интеграционных тестов правила ${rule.getName()}`});
			const outputParser = new SiemJOutputParser();
			const testRunner = new IntegrationTestRunner(this.config, outputParser);
	
			// TODO: исключить лишнюю сборку артефактов
			const siemjResult = await testRunner.run(rule, options);
	
			if (!siemjResult.testsStatus) {
				rule.setStatus(ContentItemStatus.Unverified, "Интеграционные тесты не прошли проверку");
				return;
			}

			rule.setStatus(ContentItemStatus.Verified, "Интеграционные тесты прошли проверку");
		}

		// TODO: временно отключены тесты локализаций, так как siemkb_tests.exe падает со следующей ошибкой:
		// TEST_RULES :: log4cplus:ERROR Unable to open file: C:\Users\user\AppData\Local\Temp\eXtraction and Processing\tmp\5239e794-c14a-7526-113c-52479c1694d6\AdAstra_TraceMode_File_Suspect_Operation_Inst_Fldr\2024-04-18_19-06-45_unknown_sdk_227gsqqu\AdAstra_TraceMode_File_Suspect_Operation_Inst_Fldr\tests\raw_events_4_norm_enr.log
		// TEST_RULES :: Error: SDK: Cannot open fpta db C:\Users\user\AppData\Local\Temp\eXtraction and Processing\tmp\5239e794-c14a-7526-113c-52479c1694d6\AdAstra_TraceMode_File_Suspect_Operation_Inst_Fldr\2024-04-18_19-06-45_unknown_sdk_227gsqqu\AdAstra_TraceMode_File_Suspect_Operation_Inst_Fldr\tests\raw_events_4_fpta.db : it's not exists
		// if(rule instanceof Correlation) {
		// 	progress.report({ message: `Проверка локализаций правила ${rule.getName()}`});
			
		// 	const siemjManager = new SiemjManager(this.config);
		// 	const locExamples = await siemjManager.buildLocalizationExamples(rule, ruleTmpFilesRuleName);

		// 	if (locExamples.length === 0) {
		// 		rule.setStatus(ContentItemStatus.Unverified, "Локализации не были получены");
		// 		return;
		// 	}

		// 	const verifiedLocalization = locExamples.some(le => TestHelper.isDefaultLocalization(le.ruText));
		// 	if(verifiedLocalization) {
		// 		rule.setStatus(ContentItemStatus.Unverified, "Локализация не прошла проверку, обнаружен пример локализации по умолчанию");
		// 	} else {
		// 		rule.setStatus(ContentItemStatus.Verified, "Интеграционные тесты и локализации прошли проверку");
		// 	}

		// 	rule.setLocalizationExamples(locExamples);
		// }
	}

	private getChildrenRecursively(parentItem: ContentTreeBaseItem): ContentTreeBaseItem[] {
		const items = parentItem.getChildren();
		const totalItems:  ContentTreeBaseItem[] = [];
		totalItems.push(...items);
		for(const item of items) {
			const childItems = this.getChildrenRecursively(item);
			totalItems.push(...childItems);
		}
		return totalItems;
	}

	private _integrationTestTmpFilesPath: string
}