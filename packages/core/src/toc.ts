import type { Chapter, TocEntry } from './model.ts';

/**
 * Krok 6: spis treści. Rozdziały (poziom 1) i sekcje z tytułem (poziom 2).
 * Sekcje bez tytułu (separator ***) nie mają własnych pozycji.
 * Niejawny rozdział („Wstęp”) i jego sekcje nie są numerowane.
 */
export function buildToc(chapters: readonly Chapter[]): TocEntry[] {
  let chapterNumber = 0;

  return chapters.map((chapter): TocEntry => {
    const numbered = !chapter.implicit;
    if (numbered) chapterNumber++;

    let sectionNumber = 0;
    const children: TocEntry[] = [];
    for (const section of chapter.sections) {
      if (section.title === null) continue;
      if (numbered) sectionNumber++;
      children.push({
        sectionId: section.id,
        chapterId: chapter.id,
        title: section.title,
        level: 2,
        number: numbered ? `${chapterNumber}.${sectionNumber}` : null,
        children: [],
      });
    }

    return {
      sectionId: chapter.sections[0]?.id ?? chapter.id,
      chapterId: chapter.id,
      title: chapter.title,
      level: 1,
      number: numbered ? String(chapterNumber) : null,
      children,
    };
  });
}
