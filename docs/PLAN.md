# Plan implementacji: interaktywny czytnik skryptów do zajęć

Dokument weryfikuje wstępną koncepcję architektury („architektura-skrypt-w-edukacyjnych”) i rozpisuje prace na małe, kolejne kroki.
Wersje bibliotek sprawdzone 2026-11-09: `marked@18.1.3`, `lit@3.3.3`, `dompurify@3.4.17`, `mermaid@12.3.0`, `katex@0.18.x` (`marked-katex-extension@5.1.13` wspiera `katex <0.19`), `github-slugger@2.0.0`.

---

## 0. Ustalenia

| Temat | Decyzja |
|---|---|
| Źródło skryptu | Aplikacja hosta przekazuje treść jako argument (string markdown). Biblioteka niczego nie pobiera z sieci. |
| Autorzy | Nauczyciele. Można narzucić prostą konwencję (`***` jako separator sekcji, `{#id}`, `id=` w quizie). Walidator podpowiada, co poprawić. |
| Język UI | Tylko polski. Wszystkie teksty interfejsu w jednym module `strings.pl.ts`, bez frameworka i18n (łatwo dodać później). |
| Wzory i diagramy | Wymagane: wzory LaTeX (KaTeX) i diagramy (Mermaid). |
| Przeglądarki | Aktualne Chrome, Edge (Chromium), Firefox, Safari (desktop i mobile). Bez IE i starego Edge (EdgeHTML). |
| Spis treści | Jest od pierwszej wersji czytnika i prowadzi do rozdziałów i sekcji. |
| Charakter UI | Ciągłe czytanie z prowadzeniem po sekcjach, a nie slajdy (pkt 2). |
| Tempo | Funkcje dostarczane schodkowo, każdy krok to działająca, używalna wersja (pkt 8). |

---

## 1. Werdykt w skrócie

Koncepcja z załącznika jest dobra i większość decyzji zostaje:

| Decyzja z załącznika | Ocena |
|---|---|
| Rezygnacja z paginacji w stylu Kindle (strona = piksele ekranu) | **Zostaje.** Uzasadnienie (cięcie bloków, desynchronizacja w sesji na żywo, zmienna wysokość quizów) jest trafne. |
| Podział semantyczny: rozdział (H2) → sekcja (H3 / `***`) → bloki | **Zostaje**, z poprawkami reguł (pkt 4). |
| `marked.lexer()` zamiast `marked.parse()` + własny mapper | **Zostaje.** Sprawdzone: renderowanie pojedynczego tokenu przez `marked.parser([token])` działa, także z linkami referencyjnymi (`[x][1]`), bo lexer rozwiązuje je już na etapie tokenizacji. |
| Warstwy: Lexer → Mapper → Stan → UI (Lit) | **Zostaje**, ale warstwa stanu nie może być Lit Reactive Controllerem (pkt 3.3). |
| Biblioteka nie otwiera WebSocketów, tylko wystawia stan i zdarzenia | **Zostaje.** |
| `BlockRegistry` (typ bloku → Web Component) | **Zostaje.** Rozszerzam go o rejestr po stronie parsera (pkt 6). |
| ID z indeksów (`ch0-sec2-blk1`) | **Do zmiany** (pkt 4.3). |
| Blok `rawHtml` bez sanityzacji | **Do zmiany**, to luka XSS (pkt 4.4). |
| Quiz jako YAML/JSON w bloku kodu | **Do zmiany**: składnia markdownowa w bloku `quiz` (pkt 6.2). |

### Czy „jak Kindle” to dobry pomysł?

Paginacja w stylu Kindle: nie. Wygoda czytania w stylu Kindle: tak. Warto przejąć to, co nie zależy od pikseli:

- ustawienia czytelnika: rozmiar czcionki, motyw (jasny / sepia / ciemny), szerokość kolumny ~65–75 znaków;
- zapamiętanie pozycji (po `sectionId`, nie po numerze strony) i powrót do niej;
- pasek postępu liczony z sekcji (np. „Rozdział 3, sekcja 4 z 7, 42% skryptu”);
- tryb skupienia: aktywna sekcja wyraźna, pozostałe przygaszone;
- nawigacja klawiaturą;
- później: zakreślenia i notatki przypięte do `blockId`.

---

## 2. Doświadczenie czytania: czym różnimy się od prezentacji (reveal.js, remark)

Prezentacja to sekwencja ekranów o stałym rozmiarze, a odbiorca ogląda to, co pokazuje prelegent. Skrypt jest tekstem do czytania i pracy, także samodzielnej. Stąd zasady projektowe:

| Prezentacja HTML | Czytnik skryptów |
|---|---|
| Slajd o stałej wielkości, treść skalowana do ekranu | Treść płynie w kolumnie tekstu, wysokość wynika z treści |
| Przejście = podmiana całego ekranu (animacja slajdu) | Przejście = przewinięcie do sekcji, kontekst przed i po zostaje widoczny |
| Mało tekstu na ekranie, slajd to ilustracja do wykładu | Pełny tekst z kodem, wzorami i tabelami. Skrypt jest samodzielnym materiałem |
| Tempo narzuca prowadzący | Tempo ustala czytelnik. Prowadzący najwyżej wskazuje miejsce i odblokowuje dalszą treść |
| Nawigacja liniowa (następny / poprzedni slajd) | Nawigacja przez spis treści, wyszukiwanie, linki wewnętrzne, powrót do ostatniej pozycji |
| Brak stanu czytelnika | Postęp, odpowiedzi w quizach, ukończone sekcje, później notatki |

W praktyce w UI oznacza to:

- **Brak trybu pełnoekranowych slajdów.** Rozdział to jedna przewijana strona, a sekcje to wyróżnione obszary w tym przepływie, nie osobne ekrany.
- **Aktywna sekcja zamiast aktualnego slajdu.** Sekcję wskazuje fokus (znacznik na marginesie, lekkie przygaszenie reszty w trybie skupienia), a nie podmiana treści.
- **Przyciski „poprzednia / następna sekcja” tylko pomagają.** Głównym sposobem poruszania się jest przewijanie i spis treści.
- **Prowadzący wskazuje, a nie przełącza.** W sesji student widzi znacznik „prowadzący jest tutaj” i może do niego wrócić jednym kliknięciem. Sam nie jest przerzucany na siłę, chyba że włączy tryb podążania.
- **Brak animacji przejść między slajdami.** Animacje są tylko funkcjonalne (pojawienie się odblokowanej sekcji, płynne przewinięcie) i wyłączają się przy `prefers-reduced-motion`.

---

## 3. Architektura

### 3.1 Struktura repozytorium

Monorepo (pnpm workspaces). Fizyczny podział na pakiety sprawia, że separacji warstw nie da się złamać przypadkiem: `core` nie ma w zależnościach ani `lit`, ani DOM.

```
packages/
  core/          # czysty TS, bez DOM: model, pipeline, store, typy zdarzeń sync
  elements/      # Lit Web Components, zależy od core
  blocks-quiz/   # (krok 9) plugin quizu: parser + komponent
apps/
  playground/    # Vite, przykładowe skrypty, ręczne testy, demo prowadzący/student
fixtures/        # przykładowe pliki .md (także przypadki brzegowe) wspólne dla testów
```

Alternatywa: jeden pakiet z subpath exports (`skrypt/core`, `skrypt/elements`). Jest prostszy, ale granice trzeba by pilnować lintem. Przy planowanych pluginach (quiz, sync) monorepo szybciej się zwróci.

### 3.2 Pipeline (pakiet `core`)

Każdy krok to czysta funkcja z osobnymi testami:

```
string .md (od hosta)
  │ 1. preprocess   wycięcie front matter (YAML) → metadata; normalizacja końców linii
  │ 2. lex          marked.lexer() (+ rozszerzenie KaTeX) → Token[]
  │ 3. group        maszyna stanów: Token[] → drzewo Chapter/Section z tokenami
  │ 4. blocks       tokeny → ContentBlock (rejestr parserów bloków: math, mermaid, quiz, callout, ...)
  │ 5. ids          deterministyczne ID (slug + jawne ID), wykrywanie duplikatów
  │ 6. toc          spis treści (rozdziały, sekcje, numeracja) wyliczony z drzewa
  │ 7. validate     diagnostyka dla autora (ostrzeżenia, nie wyjątki)
  ▼
ScriptDocument (serializowalny JSON) + Diagnostic[]
  │ 8. render       (osobny moduł) blok markdown → HTML → sanityzacja
  ▼
UI
```

Model `ScriptDocument` przechowuje bloki markdown jako **tokeny lub źródło markdown, nie gotowy HTML**. Renderowanie do HTML (krok 8) to osobny, wymienialny moduł. Dzięki temu:
- ten sam model może wyrenderować aplikacja w React bez Web Components (tryb headless);
- sanityzację i rozszerzenia (KaTeX, Mermaid, podświetlanie składni) konfiguruje się w jednym miejscu;
- testy struktury nie zależą od formatu HTML.

### 3.3 Stan (pakiet `core`)

Store w czystym TS (prosty `subscribe/getState/dispatch` lub `@preact/signals-core`), bez zależności od Lit. W `elements` cienki adapter `ReactiveController` subskrybuje store. Aplikacja w React/Vue może używać tego samego store bezpośrednio.

Stan dzieli się na trzy niezależne części:

```ts
interface ReaderState {
  navigation: { chapterId: string; sectionId: string };       // gdzie jestem
  progress:   { completed: Set<string>; answers: Record<string, QuizAnswer> }; // co zrobiłem
  session?:   SessionState;                                    // co narzuca prowadzący
}

interface SessionState {
  role: 'instructor' | 'student';
  docVersion: string;            // hash treści; różne wersje skryptu = ostrzeżenie
  instructorSectionId: string;
  unlockedUpTo: number;          // indeks w płaskiej kolejności sekcji
  follow: boolean;               // czy student podąża automatycznie
}
```

Dostępność sekcji liczy jedna funkcja `isSectionAccessible(state, sectionId)`, która składa reguły (polityki): blokada przez nierozwiązany quiz, blokada przez prowadzącego. Pierwszeństwo: w sesji decyduje prowadzący, a blokady quizowe działają tylko w trybie samodzielnym.

Trwałość postępu idzie przez interfejs `StorageAdapter` (domyślnie `localStorage`, host może podpiąć własny backend).

### 3.4 Publiczne API wejścia

Host przekazuje treść, biblioteka jej nie pobiera:

```ts
// użycie bez UI (core)
const { document, diagnostics } = parseScript(markdown, { plugins: [mathPlugin, mermaidPlugin] });

// użycie z UI (elements)
const reader = document.createElement('skrypt-reader');
reader.markdown = markdownFromHost;   // albo:
reader.document = parsedDocument;     // gotowy ScriptDocument (np. sparsowany na serwerze)
reader.addEventListener('skrypt-diagnostics', (e) => console.warn(e.detail));
```

Właściwości, a nie atrybuty HTML: skrypty mają dziesiątki kilobajtów, a atrybuty to złe miejsce na duże teksty. Zmiana `markdown` parsuje dokument od nowa, a nawigacja próbuje utrzymać pozycję po `sectionId`.

---

## 4. Reguły parsowania i poprawki względem załącznika

### 4.1 Konwencja dla autorów

Konwencja trafi do krótkiego poradnika dla nauczycieli (`docs/poradnik-autora.md`, krok 4) z przykładowym skryptem.

| Markdown | Znaczenie |
|---|---|
| Front matter `---` YAML `---` na początku pliku | metadane: `title`, `id`, `version` |
| `# H1` | tytuł skryptu (jeśli brak w front matter) |
| treść między H1 a pierwszym H2 | rozdział „Wstęp” (niejawny) |
| `## H2` | nowy rozdział |
| `### H3` | nowa sekcja z tytułem |
| `***` | nowa sekcja bez tytułu (konwencja obowiązkowa) |
| `####`–`######` | zwykła treść sekcji (nie trafia do spisu treści) |
| `$...$`, `$$...$$` | wzory (KaTeX) |
| ```` ```mermaid ```` | diagram |
| ```` ```quiz ````, ```` ```callout ```` | bloki interaktywne z rejestru |
| `## Tytuł {#wlasne-id}` | jawne, stabilne ID |

### 4.2 Pułapki potwierdzone testem na `marked@18`

1. **Front matter nie jest obsługiwany przez marked.** `---\ntitle: Test\n---` daje token `hr` oraz nagłówek H2 „title: Test”, czyli mapper utworzyłby fałszywy rozdział. Front matter trzeba wyciąć przed lexerem (krok 1).
2. **`---` bezpośrednio pod linią tekstu to nagłówek H2 (setext), a nie separator.** `Tekst\n---` daje `heading depth:2`, czyli nowy rozdział zamiast nowej sekcji. Dlatego konwencja to `***`. Walidator ostrzega o nagłówkach setext (token ma `raw` bez `#`) i o `---` w treści. Pojedyncze `---` otoczone pustymi liniami parser mimo to traktuje jak separator sekcji (z ostrzeżeniem), żeby nie gubić intencji autora.
3. **Surowy HTML przechodzi bez zmian.** `<script>alert(1)</script>` w .md trafia do wyniku dosłownie (opcję `sanitize` usunięto z marked).

### 4.3 Identyfikatory

ID z indeksów zmieniają się po każdej edycji skryptu. Wstawienie jednej sekcji w środku semestru przesuwa wszystkie późniejsze ID, a zapisane odpowiedzi z quizów i postęp trafiają wtedy do złych sekcji. Zasady:

- rozdział / sekcja: jawne `{#id}` → w przeciwnym razie slug z tytułu (`github-slugger`, obsługuje polskie znaki) → dla sekcji bez tytułu `${chapterId}-s${n}`;
- duplikaty dostają sufiks `-2`, `-3` i ostrzeżenie w walidatorze;
- unikalność dotyczy rodzaju elementu (osobne pule: rozdziały, sekcje, bloki). Powód: rozdział „Pętle” i jego sekcja „Pętle” to częsty, w pełni poprawny układ. W atrybutach `id` elementów DOM UI dodaje prefiksy (`ch-`, `sec-`);
- slug zachowuje polskie znaki (`pętla-for`), bo `github-slugger` nie transliteruje;
- quiz: wymagane jawne `id` (bo wiąże się z zapisanymi odpowiedziami); brak ID = ostrzeżenie + ID wyliczone;
- zwykłe bloki: indeks w sekcji (nie trzeba ich trwale przechowywać);
- `docVersion` = hash treści; w sesji wspólnej klient z inną wersją dostaje ostrzeżenie.

### 4.4 Bezpieczeństwo

Biblioteka będzie osadzana w cudzych aplikacjach, więc HTML z markdown sanityzujemy zawsze:
- `DOMPurify` w kroku render, domyślnie włączony, z konfigurowalną listą dozwolonych tagów (musi przepuszczać MathML/HTML z KaTeX);
- Mermaid z `securityLevel: 'strict'`, SVG diagramu również przez DOMPurify;
- w Lit `unsafeHTML` tylko na wyniku sanityzacji, w jednym miejscu kodu;
- linki zewnętrzne z `rel="noopener noreferrer"`.

### 4.5 Shadow DOM: rzeczy do zaplanowania

- Linki kotwicowe (`#sekcja`) nie działają natywnie przez granicę shadow root. Trzeba przechwycić kliknięcie i wywołać nawigację w store. Dotyczy też spisu treści.
- Style KaTeX i motywu podświetlania składni dołączamy do shadow root (`adoptedStyleSheets`).
- **Czcionki KaTeX:** reguły `@font-face` zadeklarowane wewnątrz shadow root nie są stosowane przez przeglądarki. Deklaracje czcionek trzeba wstrzyknąć raz do `document.head` (albo host dołącza `katex.css` sam; obie opcje opisane w README).
- Motywy hosta: CSS custom properties (`--skrypt-font-size`, `--skrypt-accent`) i `::part()`.
- Przewijanie do sekcji: `scrollIntoView({ block: 'start' })`. Przy `center` długa sekcja ma ucięty początek. Respektować `prefers-reduced-motion`.

---

## 5. Wzory i diagramy

| | Wzory | Diagramy |
|---|---|---|
| Biblioteka | KaTeX 0.18.x przez `marked-katex-extension` | Mermaid 12 |
| Składnia | `$x^2$` inline, `$$...$$` blokowo | blok ```` ```mermaid ```` |
| Kiedy renderowane | przy renderowaniu bloku (synchronicznie, szybko) | asynchronicznie, gdy blok zbliża się do widoku (`IntersectionObserver`) |
| Ładowanie | dynamiczny `import()`, tylko jeśli dokument zawiera wzory | dynamiczny `import()`, tylko jeśli dokument zawiera diagram |
| Błąd w treści | czytelny komunikat w miejscu wzoru + `Diagnostic` | komunikat w miejscu diagramu + `Diagnostic`, reszta strony działa |

Mermaid jest duży (kilkaset KB), więc ładujemy go leniwie i tylko gdy jest potrzebny. Diagram dostaje zarezerwowane miejsce przed renderem, żeby treść nie skakała. Motyw Mermaid (jasny / ciemny) podąża za ustawieniem czytnika.

W `core` wzory i diagramy to zwykłe bloki (`math`, `mermaid`) ze źródłem tekstowym. Renderuje je dopiero warstwa UI, więc `core` pozostaje bez DOM.

---

## 6. Bloki specjalne i quizy

### 6.1 Rejestr dwustronny

Stan po kroku 3: po stronie UI rejestr mapuje typ bloku na funkcję zwracającą szablon Lit (`registerBlockView('quiz', (block, ctx) => html\`...\`)`), a nie na nazwę tagu. Daje to to samo co `BlockView` poniżej, bez dynamicznych szablonów statycznych.

Plugin bloku rejestruje dwie rzeczy, każdą w swoim pakiecie:

```ts
// core: jak zamienić token na blok
interface BlockParser<T> { lang: string; parse(source: string, ctx): T | Diagnostic[] }
// elements: czym go wyświetlić
interface BlockView { type: string; tagName: string }
```

Mermaid jest pierwszym pluginem w tym rejestrze, więc rejestr powstaje już przy diagramach, a quiz z niego tylko korzysta. Nowe typy bloków (fiszki, symulator kodu) nie wymagają zmian w mapperze ani w `<skrypt-reader>`.

### 6.2 Składnia quizu

Zamiast YAML (dodatkowa zależność, wcięcia sprawiają kłopot nauczycielom) treść bloku w markdownie, parsowana tym samym `marked.lexer()`:

````md
```quiz id=petle-1
Co wypisze `for i in range(3): print(i)`?

- [ ] 1 2 3
- [x] 0 1 2
- [ ] 0 1 2 3

> Wyjaśnienie: `range(3)` zaczyna od 0 i kończy przed 3.
```
````

Pytanie może zawierać kod inline i wzory. Opcje są zapisane jako task listy, które marked parsuje natywnie (`checked: true/false`). Cytat służy jako wyjaśnienie. Atrybuty (`id=...`) trafiają do info stringa bloku kodu.

Ograniczenie: wewnątrz ```` ``` ```` nie da się wstawić bloku kodu bez użycia czterech backticków na zewnątrz. Jeśli to okaże się uciążliwe, później można dodać kontenery `:::quiz ... :::` jako rozszerzenie marked.

---

## 7. Komponenty UI (pakiet `elements`)

| Komponent | Odpowiedzialność |
|---|---|
| `<skrypt-reader>` | publiczne API: `markdown` / `document`, `mode`, `syncState`; zdarzenia; układ |
| `<skrypt-toc>` | spis treści: rozdziały i sekcje, numeracja, aktualna pozycja, później stany (ukończona / zablokowana / prowadzący tu jest) |
| `<skrypt-chapter>` | rozdział jako jedna przewijana strona z sekcjami |
| `<skrypt-section>` | sekcja: wyróżnienie aktywnej, stan blokady, znacznik prowadzącego |
| `<skrypt-block-markdown>` | wyrenderowany, zsanityzowany HTML (z wzorami) |
| `<skrypt-block-mermaid>` | leniwie renderowany diagram |
| `<skrypt-settings>` | czcionka, motyw, szerokość kolumny |
| `<skrypt-follow-banner>` | „Wróć do prowadzącego (sekcja 3.2)” |

### 7.1 Spis treści

- Na początku dokumentu, przed treścią pierwszego rozdziału. Z tego miejsca czytelnik zaczyna lekturę.
- Poza tym dostępny cały czas: na szerokim ekranie jako panel boczny, na wąskim jako wysuwany panel otwierany przyciskiem.
- Pokazuje rozdziały (H2) i sekcje z tytułem (H3). Sekcje bez tytułu (`***`) nie mają osobnych pozycji.
- Kliknięcie przenosi do sekcji (zmiana rozdziału, jeśli trzeba, potem przewinięcie). Aktualna pozycja jest podświetlona.
- Dane spisu wylicza `core` (krok pipeline'u `toc`), więc host może zbudować własny spis.
- Dostępność: element `<nav>` z etykietą, lista zagnieżdżona, `aria-current` na aktywnej pozycji, pełna obsługa klawiaturą.

Aktywną sekcję podczas przewijania śledzi `IntersectionObserver`. Wynik trafia do store, a nie do stanu komponentu.

Prefiks tagów: `skrypt-` (unikalny, krótki). Sam `script-` łatwo pomylić z `<script>` i bardziej grozi kolizją nazw.

Zdarzenia publiczne (typowane, `bubbles + composed`):
`skrypt-ready`, `skrypt-navigate`, `skrypt-progress`, `skrypt-quiz-answer`, `skrypt-session-change`, `skrypt-diagnostics`.

---

## 8. Plan prac: małe kroki

Każdy krok kończy się działającą wersją w `apps/playground`, którą można pokazać i używać. Kolejny krok zaczynamy po akceptacji poprzedniego. Kroki 1–5 dają pierwszą użyteczną wersję (czytnik ze spisem treści), a dalsze dokładają funkcje po kolei.

### Faza A: czytanie (pierwsza użyteczna wersja)

**Krok 1. Fundament** ✅
- pnpm workspaces, TypeScript `strict`, Vite (library mode), Vitest, ESLint + Prettier, GitHub Actions (lint, typecheck, testy).
- Fixture'y `.md`: realny skrypt (kod, tabele, wzory, diagram) i przypadki brzegowe.
- *Gotowe gdy:* CI zielone, `pnpm dev` uruchamia pusty playground.

**Krok 2. Parser struktury (`core`)** ✅
- Model `ScriptDocument`, `Chapter`, `Section`, `ContentBlock`, `Diagnostic`; `parseScript(markdown)`.
- Front matter, grupowanie H2/H3/`***`, ID, spis treści, walidator.
- Testy przypadków brzegowych: brak H1, treść przed H2, H3 przed H2, front matter, setext, `---` w treści, puste sekcje, duplikaty nagłówków, polskie znaki w slugach.
- *Gotowe gdy:* fixture'y dają oczekiwane drzewo i spis treści, `core` nie importuje `lit` ani API DOM.

**Krok 3. Czytnik ze spisem treści (`elements`)** ✅
- Moduł render (marked parser + DOMPurify), store nawigacji, adapter `ReactiveController`.
- `<skrypt-reader>` przyjmuje `markdown` od hosta, wyświetla spis treści na początku i jako panel; rozdział jako przewijana strona; przejście do sekcji ze spisu; linki kotwicowe.
- Typografia i układ na telefon i desktop, teksty UI z `strings.pl.ts`.
- *Gotowe gdy:* realny skrypt da się przeczytać od spisu treści do końca, każda pozycja spisu prowadzi we właściwe miejsce, test XSS z fixture'a nie wykonuje skryptu.

**Krok 4. Wzory i diagramy**
- KaTeX (leniwie, czcionki w `document.head`), Mermaid jako pierwszy plugin rejestru bloków (leniwie, przy zbliżeniu do widoku), podświetlanie składni kodu.
- Błędy we wzorach i diagramach jako komunikaty w miejscu bloku i `Diagnostic`.
- Poradnik autora (`docs/poradnik-autora.md`).
- *Gotowe gdy:* fixture z wzorami i diagramami renderuje się poprawnie w Chrome, Firefox i Safari; dokument bez wzorów i diagramów nie ładuje KaTeX ani Mermaid.

**Krok 5. Prowadzenie po sekcjach**
- Śledzenie aktywnej sekcji przy przewijaniu, podświetlenie w spisie treści.
- Przyciski i skróty klawiszowe: poprzednia / następna sekcja, poprzedni / następny rozdział.
- Pasek postępu, zapamiętanie pozycji (`StorageAdapter`), zdarzenie `skrypt-navigate`.
- *Gotowe gdy:* po przeładowaniu czytelnik wraca do tej samej sekcji, cała nawigacja działa z klawiatury.

### Faza B: wygoda czytania

**Krok 6. Ustawienia czytelnika:** rozmiar czcionki, motyw jasny / sepia / ciemny (także dla diagramów), szerokość kolumny; zapis w `StorageAdapter`.

**Krok 7. Tryb skupienia:** przygaszenie sekcji poza aktywną, znacznik na marginesie.

**Krok 8. Stopniowe odkrywanie (opcja):** kolejna sekcja pojawia się po „Dalej”; animacja wyłączana przy `prefers-reduced-motion`.

### Faza C: interakcja

**Krok 9. Quiz:** pakiet `blocks-quiz`, składnia z pkt 6.2, zapis odpowiedzi, zdarzenie `skrypt-quiz-answer`.

**Krok 10. Blokowanie sekcji quizem:** polityka dostępu w trybie samodzielnym, stany sekcji w spisie treści.

**Krok 11. Callout:** drugi prosty plugin, sprawdza, czy rejestr bloków jest ogólny.

### Faza D: sesja z prowadzącym

**Krok 12. Stan sesji:** `SessionState`, `docVersion`, polityka dostępu prowadzącego, wejście `syncState` i zdarzenie `skrypt-session-change`.

**Krok 13. Widok studenta:** znacznik „prowadzący jest tutaj” w treści i spisie, baner powrotu, tryb podążania, odblokowane sekcje dostępne do przeglądania.

**Krok 14. Demo bez backendu:** interfejs `SyncTransport` i implementacja na `BroadcastChannel` w playground (dwie karty = prowadzący i student).
- *Gotowe gdy:* prowadzący przesuwa i odblokowuje sekcje, student podąża, może cofnąć się do odblokowanych sekcji i wrócić jednym kliknięciem.

### Później (poza zakresem planu)
Adapter WebSocket jako osobny pakiet, statystyki odpowiedzi dla prowadzącego, wyszukiwanie w skrypcie, notatki i zakreślenia, kontenery `:::`, kolejne języki UI, publikacja na npm.

---

## 9. Otwarte pytania

1. Czy stopniowe odkrywanie (krok 8) ma być domyślnie włączone, czy opcjonalne?
