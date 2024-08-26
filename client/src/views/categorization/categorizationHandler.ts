import { Normalization } from '../../models/content/normalization';
import { MetaInfo } from '../../models/metaInfo/metaInfo';

export class categorizationHandler {

	private rawsGranted: boolean;
	private rule: Normalization;
	private metainfo: MetaInfo;

	constructor(rule: Normalization) {
		this.rule = rule;
		this.metainfo = rule.getMetaInfo();
		this.rawsGranted = false;
	}

	// TODO: Здесь будет реализована работа с уже заданными категориями, 
	// будем читать их из метаинфы, считывать поле равок, которые уже задействованы, в категориях

	get rawsCategory() {
		this.rawsGranted = true;
		return {
			"level": "raws",
			"domains": this.range(1, this.rule.getUnitTests().length).map(String).unshift("all")
		};
	} 

	public revertRawsCategory() {
		this.rawsGranted = false;	
	}

	public isRawsGranted() {
		return this.rawsGranted;
	}

	private range(start = 0, end: number): number[] {
		return Array.from({length: end - start + 1}, (_, i) => start + i);
	}


}