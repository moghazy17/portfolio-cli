import { content, contentVersion, generatedAt } from './generated';
import { toCVData, toProfile } from './view';

export { content, contentVersion, generatedAt };
export const cvData = toCVData(content);
export const profile = toProfile(content);
export const site = content.site;
