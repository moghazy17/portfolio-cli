import { content, contentVersion, generatedAt } from './generated';
import { toCVData, toProfile } from './view';

export { itemIds, slugify } from './items';
export type { ItemId, ItemKind } from './items';

export { content, contentVersion, generatedAt };
export const cvData = toCVData(content);
export const profile = toProfile(content);
export const site = content.site;
