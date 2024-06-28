import common from './common';
import sys from 'sys';

class TreeObject {
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
        this.domain = objects[id].get('DomainName', null);
        this.short_desc = objects[id].get('ShortDescription', null);
        this.full_desc = objects[id].get('FullDescription', null);
        this.notes = objects[id].get('Notes', null);
        this.examples = objects[id].get('Examples', null);
        this.requirements = objects[id].get('Requirements', null);
        this.level = objects[id].get('Level', null);
        this.datasets = objects[id].get('Datasets', null);
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

class TreeWalker {
    current_element_id = 0;
    choosen_categories_sorted: TreeObject[] = [];

    tree_build_info: any;
    tree: any;
    objects: any;
    datasets: any;
    levels_metainfo: any;

    constructor(tree: string) {
        const treeData = common.load_json(tree);
        if (!treeData || !treeData.tree || !treeData.objects) {
            console.error('[ERROR] Wrong tree format');
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
                console.error(`[ERROR] Can not find categorization branch ${obj.id}! Try to return to the last correct branch.`);
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
                console.error(`[ERROR] Can not find id ${obj.id} in tree objects list`);
            }

            objList.push(new TreeObject(this.objects, obj.id));
        }

        return objList;
    }

    choose(choice: number | false = false): void {
        if (choice && choice < this.current_step_list.length) {
            this.current_element_id = choice;
        }

        this.choosen_categories_sorted.push(this.current_step_list[this.current_element_id]);
        this.current_element_id = 0;
    }

    reset(): void {
        this.choosen_categories_sorted = [];
        this.current_element_id = 0;
    }

    reset_to_step(step: string): void {
        const stepIndex = this.choosen_categories_sorted.findIndex((x: TreeObject) => x.level === step);
        if (stepIndex !== -1) {
            this.choosen_categories_sorted = this.choosen_categories_sorted.slice(0, stepIndex + 1);
            this.current_element_id = 0;
        } else {
            console.error('Incorrect tree level name');
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
            console.error('There is no such Element in current level of category tree');
            return false;
        }
    }
}