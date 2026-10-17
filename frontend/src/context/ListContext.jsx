import { makeListContext } from './makeListContext.jsx';

const anime = makeListContext('anime');
export const ListProvider = anime.Provider;
export const useList = anime.useKindList;
