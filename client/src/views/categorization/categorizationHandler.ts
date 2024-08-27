import * as os from 'os'

import { Normalization } from '../../models/content/normalization';
import { MetaInfo } from '../../models/metaInfo/metaInfo';
import { Log } from '../../extension';


export class CategorizationHandler {

	private rawsGranted: boolean;
	private rule: Normalization;
	private static categoryBorder = '########';


	constructor(rule: Normalization) {
		this.rule = rule;
		this.rawsGranted = false;
	}

	// TODO: Здесь будет реализована работа с уже заданными категориями, 
	// будем читать их из метаинфы, считывать поле равок, которые уже задействованы, в категориях

	get rawsDomains(): string[] {
		var domains = CategorizationHandler.range(1, this.rule.getUnitTests().length).map(String);
		domains.unshift("all");
		return domains
	}

	public revertRawsCategory() {
		this.rawsGranted = false;	
	}

	public isRawsGranted() {
		return this.rawsGranted;
	}

	public async saveCategory(category: string): Promise<void>  {
		const converted_category = CategorizationHandler.convertCategoryText(category)
		this.rule.addCategorization(converted_category);
		await this.rule.saveMetaInfoAndLocalizations();
	}

	private static convertCategoryText(text: string): string  {
		var lines = text.split(/\r?\n/);
		Log.info(String(lines.length));
		lines = lines.map(line => '# ' + line);
		lines.unshift(this.categoryBorder);
		lines.push(this.categoryBorder);
		return lines.join(os.EOL);
	}

	private static range(start = 0, end: number): number[] {
		return Array.from({length: end - start + 1}, (_, i) => start + i);
	}


}