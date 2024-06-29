import * as fs from 'fs';
import * as process from 'process';
import { Log } from '../../extension';


function loadJSON(filePath: string): any {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
}

export class TreeObject {
    id: number;
    domain: string | null;
    short_desc: string | null;
    full_desc: string | null;
    notes: string | null;
    examples: string | null;
    requirements: string | null;
    level: string | null;
    datasets: any[] | null;

	constructor(objects: any, id: number) {
		this.id = id;
		this.domain = objects[id]['DomainName'];
		this.short_desc = objects[id]['ShortDescription'];
		this.full_desc = objects[id]['FullDescription'];
		this.notes = objects[id]['Notes'];
		this.examples = objects[id]['Examples'];
		this.requirements = objects[id]['Requirements'];
		this.level = objects[id]['Level'];
		this.datasets = objects[id]['Datasets'];
	}

    equals(other: TreeObject): boolean {
        return (
            this.domain === other.domain &&
            this.short_desc === other.short_desc &&
            this.full_desc === other.full_desc &&
            this.notes === other.notes &&
            this.examples === other.examples &&
            this.requirements === other.requirements &&
            this.level === other.level &&
            this.datasets === other.datasets
        );
    }

    toString(): string {
        return `${this.level}: ${this.domain}`;
    }
}

export class TreeWalker {
    current_element_id = 0;
    choosen_categories_sorted: TreeObject[] = [];

    tree_build_info: any;
    tree: any;
    objects: any;
    datasets: any;
    levels_metainfo: any;

    constructor(path: string) {
        const treeData = loadJSON(path);
        if (!treeData || !treeData.tree || !treeData.objects) {
            Log.error('[ERROR] Wrong tree format');
            process.exit(1);
        }

        this.tree_build_info = treeData._build_info;
        this.tree = treeData.tree;
        this.objects = treeData.objects;
        this.datasets = treeData.datasets;
        this.levels_metainfo = treeData.levels_metainfo;

        this.reset();
    }

    get current_step(): string | null {
        return this.current_step_list[0].level;
    }

    get has_next_element(): boolean {
        return this.current_element.domain !== this.current_step_list[this.current_step_list.length - 1].domain;
    }

    get has_prev_element(): boolean {
        return this.current_element.domain !== this.current_step_list[0].domain;
    }

    get current_element(): TreeObject {
        return this.current_step_list[this.current_element_id];
    }

    get choosen_categories(): any {
        const categories: any = {};
        const datasets: any = {};
        for (const obj of this.choosen_categories_sorted) {
            categories[obj.level] = obj.domain;
            if (obj.datasets && obj.datasets.length > 0) {
                datasets[obj.level] = obj.datasets;
            }
        }

        categories['Datasets'] = datasets;
        return categories;
    }

    get current_subtree(): any {
        let subtree = this.tree;
        for (const obj of this.choosen_categories_sorted) {
            const idList = subtree.map((x: any) => x.id);
            if (idList.includes(obj.id)) {
                if ('subtrees' in subtree[idList.indexOf(obj.id)]) {
                    subtree = subtree[idList.indexOf(obj.id)].subtrees;
                }
            } else {
                Log.error(`[ERROR] Can not find categorization branch ${obj.id}! Try to return to the last correct branch.`);
                this.reset_to_step(obj.level);
                break;
            }
        }

        return subtree;
    }

    get current_step_list(): TreeObject[] {
        const objList: TreeObject[] = [];
        for (const obj of this.current_subtree) {
            if (!this.objects[obj.id]) {
                Log.error(`[ERROR] Can not find id ${obj.id} in tree objects list`);
            }

            objList.push(new TreeObject(this.objects, obj.id));
        }

        return objList;
    }

	get domain_names(): string[] {
		return this.current_step_list.map((element: TreeObject) => element.domain);
	}

	get_domain_full_description(domainName: string | false = false): string | null {
		var foundElement = this.current_element;
		if  (domainName){
			foundElement = this.current_step_list.find((element: TreeObject) => element.domain === domainName);
		}
		if (foundElement) {
			return foundElement.full_desc;
		} else {
			console.error(`[ERROR] Can not find domain with name ${domainName}`);
			return null;
		}
	}

    choose(choice: number | false = false): void {
        if (choice && choice < this.current_step_list.length) {
            this.current_element_id = choice;
        }

        this.choosen_categories_sorted.push(this.current_step_list[this.current_element_id]);
        this.current_element_id = 0;
    }

	choose_by_domain(domainName: string): boolean {
		const foundElement = this.current_step_list.find((element: TreeObject) => element.domain === domainName);
		if (foundElement) {
			this.current_element_id = this.current_step_list.indexOf(foundElement);
			this.choosen_categories_sorted.push(foundElement);
			return true;
		} else {
			console.error(`[ERROR] Can not find domain with name ${domainName}`);
			return false;
		}
	}

    reset(): void {
        this.choosen_categories_sorted = [];
        this.current_element_id = 0;
    }

    reset_to_step(step: string): void {
        const stepIndex = this.choosen_categories_sorted.findIndex((x: TreeObject) => x.level === step);
        if (stepIndex !== -1) {
            this.choosen_categories_sorted = this.choosen_categories_sorted.slice(0, stepIndex);
            this.current_element_id = 0;
        } else {
            Log.error('Incorrect tree level name');
        }
    }

    next_element(): void {
        if (this.has_next_element) {
            this.current_element_id += 1;
        }
    }

    prev_element(): void {
        if (this.has_prev_element) {
            this.current_element_id -= 1;
        }
    }

    select_element(element: TreeObject): boolean {
        const elementIndex = this.current_step_list.indexOf(element);
        if (elementIndex !== -1) {
            this.current_element_id = elementIndex;
            return true;
        } else {
            Log.error('There is no such Element in current level of category tree');
            return false;
        }
    }
}