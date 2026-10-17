import { makeListContext } from './makeListContext.jsx';

const manga = makeListContext('manga');
export const MangaListProvider = manga.Provider;
export const useMangaList = manga.useKindList;
