# Plan implementacji: interaktywny czytnik skryptów do zajęć

Dokument weryfikuje wstępną koncepcję architektury („architektura-skrypt-w-edukacyjnych”) i rozpisuje prace na etapy.
Wersje bibliotek sprawdzone 2026-11-09: `marked@18.1.3`, `lit@3.3.3`.

---

## 1. Werdykt w skrócie

Koncepcja jest dobra i większość decyzji zostaje:

| Decyzja z załącznika | Ocena |
|---|---|
| Rezygnacja z paginacji w stylu Kindle (strona = piksele ekranu) | **Zostaje.** Uzasadnienie (cięcie bloków, desynchronizacja w sesji na żywo, zmienna wysokość quizów) jest trafne. |
| Podział semantyczny: rozdział (H2) → sekcja (H3 / `---`) → bloki | **Zostaje**, z poprawkami reguł (pkt 3). |
| `marked.lexer()` zamiast `marked.parse()` + własny mapper | **Zostaje.** Sprawdzone: renderowanie pojedynczego tokenu przez `marked.parser([token])` działa, także z linkami referencyjnymi (`[x][1]`), bo lexer rozwiązuje je już na etapie tokenizacji. |
| Warstwy: Lexer → Mapper → Stan → UI (Lit) | **Zostaje**, ale warstwa stanu nie może być Lit Reactive Controllerem (pkt 2.3). |
| Biblioteka nie otwiera WebSocketów, tylko wystawia stan i zdarzenia | **Zostaje.** |
| `BlockRegistry` (typ bloku → Web Component) | **Zostaje.** Rozszerzam go o rejestr po stronie parsera (pkt 4). |
| ID z indeksów (`ch0-sec2-blk1`) | **Do zmiany** (pkt 3.3). |
| Blok `rawHtml` bez sanityzacji | **Do zmiany**, to luka XSS (pkt 3.4). |
| Quiz jako YAML/JSON w bloku kodu | **Do zmiany**: składnia markdownowa w bloku `quiz` (pkt 4.2). |

### Czy „jak Kindle” to dobry pomysł?

Paginacja w stylu Kindle: nie. Wygoda czytania w stylu Kindle: tak. Warto przejąć to, co nie zależy od pikseli:

- ustawienia czytelnika: rozmiar czcionki, motyw (jasny / sepia / ciemny), szerokość kolumny ~65–75 znaków;
- zapamiętanie pozycji (po `sectionId`, nie po numerze strony) i powrót do niej;
- pasek postępu liczony z sekcji (np. „Rozdział 3, sekcja 4 z 7, 42% skryptu”);
- tryb skupienia: aktywna sekcja wyraźna, pozostałe przygaszone;
- nawigacja klawiaturą (←/→ między sekcjami, PgUp/PgDn między rozdziałami);
- później: zakreślenia i notatki przypięte do `blockId`.

Jeśli potrzebny jest efekt „przewracania kartek”, stroną może być **sekcja**. Wtedy „strona 4” znaczy to samo u każdego uczestnika.

---

## 2. Architektura

### 2.1 Struktura repozytorium

Monorepo (pnpm workspaces). Fizyczny podział na pakiety sprawia, że separacji warstw nie da się złamać przypadkiem: `core` nie ma w zależnościach ani `lit`, ani DOM.

```
packages/
  core/          # czysty TS, bez DOM: model, pipeline, store, typy zdarzeń sync
  elements/      # Lit Web Components, zależy od core
  blocks-quiz/   # (etap 3) plugin quizu: parser + komponent
apps/
  playground/    # Vite, przykładowe skrypty, ręczne testy, demo prowadzący/student
fixtures/        # przykładowe pliki .md (także przypadki brzegowe) wspólne dla testów
```

Alternatywa: jeden pakiet z subpath exports (`skrypt/core`, `skrypt/elements`). Jest prostszy, ale granice trzeba by pilnować lintem. Przy planowanych pluginach (quiz, sync) monorepo szybciej się zwróci.

### 2.2 Pipeline (pakiet `core`)

Każdy krok to czysta funkcja z osobnymi testami:

```
string .md
  │ 1. preprocess   wycięcie front matter (YAML) → metadata; normalizacja końców linii
  │ 2. lex          marked.lexer() → Token[]
  │ 3. group        maszyna stanów: Token[] → drzewo Chapter/Section z tokenami
  │ 4. blocks       tokeny → ContentBlock (rejestr parserów bloków: quiz, callout, ...)
  │ 5. ids          deterministyczne ID (slug + jawne ID), wykrywanie duplikatów
  │ 6. validate     diagnostyka dla autora (ostrzeżenia, nie wyjątki)
  ▼
ScriptDocument (serializowalny JSON) + Diagnostic[]
  │ 7. render       (osobny moduł) blok markdown → HTML → sanityzacja
  ▼
UI
```

Ważne: model `ScriptDocument` przechowuje bloki markdown jako **tokeny lub źródło markdown, nie gotowy HTML**. Renderowanie do HTML (krok 7) to osobny, wymienialny moduł. Dzięki temu:
- ten sam model może wyrenderować aplikacja w React bez Web Components (tryb headless);
- sanityzację i rozszerzenia (KaTeX, podświetlanie składni) konfiguruje się w jednym miejscu;
- testy struktury nie zależą od formatu HTML.

### 2.3 Stan (pakiet `core`)

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

Dostępność sekcji liczy jedna funkcja `isSectionAccessible(state, sectionId)`, która składa reguły (polityki): blokada przez nierozwiązany quiz, blokada przez prowadzącego. Pierwszeństwo reguł trzeba ustalić jawnie. Proponuję: w sesji decyduje prowadzący, a blokady quizowe działają tylko w trybie samodzielnym.

Trwałość postępu idzie przez interfejs `StorageAdapter` (domyślnie `localStorage`, host może podpiąć własny backend).

---

## 3. Reguły parsowania i poprawki względem załącznika

### 3.1 Konwencja dla autorów

| Markdown | Znaczenie |
|---|---|
| Front matter `---` YAML `---` na początku pliku | metadane: `title`, `id`, `lang`, `version` |
| `# H1` | tytuł skryptu (jeśli brak w front matter) |
| treść między H1 a pierwszym H2 | rozdział „Wstęp” (niejawny) |
| `## H2` | nowy rozdział |
| `### H3` | nowa sekcja z tytułem |
| `***` (lub `---` z pustą linią przed) | nowa sekcja bez tytułu |
| `####`–`######` | zwykła treść sekcji |
| ```` ```quiz ````, ```` ```callout ```` itd. | bloki specjalne z rejestru |
| `## Tytuł {#wlasne-id}` | jawne, stabilne ID |

### 3.2 Pułapki potwierdzone testem na `marked@18`

1. **Front matter nie jest obsługiwany przez marked.** Sprawdziłem, że `---\ntitle: Test\n---` daje token `hr` oraz nagłówek H2 „title: Test”, czyli mapper utworzyłby fałszywy rozdział. Front matter trzeba wyciąć przed lexerem (krok 1).
2. **`---` bezpośrednio pod linią tekstu to nagłówek H2 (setext), a nie separator.** `Tekst\n---` daje `heading depth:2`, czyli nowy rozdział zamiast nowej sekcji. W dokumentacji dla autorów zalecić `***` jako separator sekcji. Walidator powinien ostrzegać o nagłówkach setext (token ma `raw` bez `#`, więc łatwo je wykryć).
3. **Surowy HTML przechodzi bez zmian.** `<script>alert(1)</script>` w .md trafia do wyniku dosłownie (opcję `sanitize` usunięto z marked).

### 3.3 Identyfikatory

ID z indeksów zmieniają się po każdej edycji skryptu. Wstawienie jednej sekcji w środku semestru przesuwa wszystkie późniejsze ID, a zapisane odpowiedzi z quizów i postęp trafiają wtedy do złych sekcji. Proponuję:

- rozdział / sekcja: jawne `{#id}` → w przeciwnym razie slug z tytułu (`github-slugger`, obsługuje polskie znaki) → dla sekcji bez tytułu `${chapterId}-s${n}`;
- duplikaty dostają sufiks `-2`, `-3` i ostrzeżenie w walidatorze;
- quiz: wymagane jawne `id` (bo wiąże się z zapisanymi odpowiedziami); brak ID = ostrzeżenie + ID wyliczone;
- zwykłe bloki: indeks w sekcji (nie trzeba ich trwale przechowywać);
- `docVersion` = hash treści; w sesji wspólnej klient z inną wersją dostaje ostrzeżenie.

### 3.4 Bezpieczeństwo

Skrypty mogą pochodzić od różnych autorów, a biblioteka będzie osadzana w cudzych aplikacjach, więc HTML z markdown sanityzujemy zawsze:
- `DOMPurify` w kroku render, domyślnie włączony, z konfigurowalną listą dozwolonych tagów;
- w Lit `unsafeHTML` tylko na wyniku sanityzacji, w jednym miejscu kodu;
- linki zewnętrzne z `rel="noopener noreferrer"`.

### 3.5 Shadow DOM: rzeczy do zaplanowania

- Linki kotwicowe (`#sekcja`) nie działają natywnie przez granicę shadow root. Trzeba przechwycić kliknięcie i wywołać nawigację w store.
- Style KaTeX / motywu podświetlania składni należy dołączyć do shadow root (`adoptedStyleSheets`).
- Motywy hosta: CSS custom properties (`--skrypt-font-size`, `--skrypt-accent`) i `::part()`.
- Przewijanie do sekcji prowadzącego: `scrollIntoView({ block: 'start' })`. Przy `center` długa sekcja ma ucięty początek. Respektować `prefers-reduced-motion`.

---

## 4. Bloki specjalne i quizy

### 4.1 Rejestr dwustronny

Plugin bloku rejestruje dwie rzeczy, każdą w swoim pakiecie:

```ts
// core: jak zamienić token na blok
interface BlockParser<T> { lang: string; parse(source: string, ctx): T | Diagnostic[] }
// elements: czym go wyświetlić
interface BlockView { type: string; tagName: string }
```

Nowe typy bloków (fiszki, symulator kodu, wykres) nie wymagają zmian w mapperze ani w `<script-reader>`.

### 4.2 Składnia quizu

Zamiast YAML (dodatkowa zależność, wcięcia sprawiają kłopot nauczycielom) proponuję treść bloku w markdownie, parsowaną tym samym `marked.lexer()`:

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

Ograniczenie: wewnątrz ```` ``` ```` nie da się wstawić bloku kodu bez użycia czterech backticków na zewnątrz. Jeśli to okaże się uciążliwe, w późniejszym etapie można dodać kontenery `:::quiz ... :::` jako rozszerzenie marked.

---

## 5. Komponenty UI (pakiet `elements`)

| Komponent | Odpowiedzialność |
|---|---|
| `<skrypt-reader>` | publiczne API: `src` / `markdown` / `document`, `mode`, `syncState`; zdarzenia; układ |
| `<skrypt-toc>` | spis treści, stan sekcji (ukończona / zablokowana / prowadzący tu jest) |
| `<skrypt-chapter>` | rozdział jako jeden widok, sekcje w ciągłym przewijaniu |
| `<skrypt-section>` | sekcja: wyróżnienie aktywnej, stan blokady, znacznik prowadzącego |
| `<skrypt-block-markdown>` | wyrenderowany, zsanityzowany HTML |
| `<skrypt-settings>` | czcionka, motyw, szerokość kolumny |
| `<skrypt-follow-banner>` | „Wróć do prowadzącego (sekcja 3.2)” |

Aktywną sekcję podczas przewijania śledzi `IntersectionObserver`. Wynik trafia do store, a nie do stanu komponentu.

Prefiks tagów: `skrypt-` (unikalny, krótki). Sam `script-` łatwo pomylić z `<script>` i bardziej grozi kolizją nazw.

Zdarzenia publiczne (typowane, `bubbles + composed`):
`skrypt-ready`, `skrypt-navigate`, `skrypt-progress`, `skrypt-quiz-answer`, `skrypt-session-change`, `skrypt-diagnostics`.

---

## 6. Etapy prac

Każdy etap kończy się działającym demo w `apps/playground`.

### Etap 0: Fundament (≈1–2 dni)
- pnpm workspaces, TypeScript `strict`, Vite (library mode) dla pakietów, Vitest, ESLint + Prettier.
- GitHub Actions: lint, typecheck, testy.
- Zestaw fixture'ów `.md`: realny skrypt (kod, tabele, wzory), przypadki brzegowe.
- **Gotowe gdy:** CI zielone, `pnpm dev` uruchamia pusty playground.

### Etap 1: Core i pipeline (≈1 tydzień)
- Model `ScriptDocument`, `Chapter`, `Section`, `ContentBlock`, `Diagnostic`.
- Kroki 1–6 pipeline'u jako osobne moduły; `parseScript(md, options)` jako publiczne API.
- Testy przypadków brzegowych: brak H1, treść przed H2, H3 przed H2, front matter, setext, `---` vs `***`, puste sekcje, duplikaty nagłówków, polskie znaki w slugach, nieznany typ bloku.
- Snapshoty struktury (bez HTML).
- **Gotowe gdy:** fixture'y parsują się do oczekiwanego drzewa, walidator zgłasza ostrzeżenia, `core` nie importuje `lit` ani API DOM.

### Etap 2: Render i statyczny czytnik (≈1–1,5 tygodnia)
- Moduł render: marked parser + DOMPurify; KaTeX i podświetlanie składni jako opcjonalne, ładowane leniwie.
- Store nawigacji + adapter `ReactiveController`.
- `<skrypt-reader>`, `<skrypt-toc>`, `<skrypt-chapter>`, `<skrypt-section>`, nawigacja klawiaturą, linki kotwicowe, deep link (`?section=id` przez zdarzenie do hosta).
- Wygoda czytania: typografia, ustawienia, zapamiętana pozycja, postęp.
- Tryb stopniowego odkrywania (przycisk „Dalej”) jako opcja.
- **Gotowe gdy:** realny skrypt czyta się wygodnie na telefonie i desktopie, test XSS z fixture'a nie wykonuje skryptu, podstawowa dostępność (focus, aria, klawiatura).

### Etap 3: Bloki interaktywne (≈1 tydzień)
- Rejestr bloków (parser + widok), pakiet `blocks-quiz`.
- Odpowiedzi i postęp w store + `StorageAdapter`.
- Polityka blokowania sekcji do rozwiązania quizu (tryb samodzielny).
- `callout` jako drugi, prosty plugin, który sprawdza, czy rejestr jest ogólny.
- **Gotowe gdy:** quiz z fixture'a działa, blokuje dalszą sekcję, odpowiedź przetrwa przeładowanie strony.

### Etap 4: API sesji z prowadzącym (≈1–1,5 tygodnia)
- `SessionState` w store, polityka dostępu prowadzącego, `docVersion`.
- Tryby `instructor` / `student`, „soft lock” i baner powrotu.
- Interfejs `SyncTransport` (send / onMessage); w playground implementacja na `BroadcastChannel` (dwie karty przeglądarki = prowadzący i student, bez backendu).
- **Gotowe gdy:** w dwóch kartach prowadzący przesuwa i odblokowuje sekcje, student podąża, może cofnąć się do odblokowanych i wrócić jednym kliknięciem.

### Później (poza zakresem planu)
Adapter WebSocket jako osobny pakiet, statystyki odpowiedzi dla prowadzącego, notatki i zakreślenia, kontenery `:::`, diagramy (Mermaid), publikacja na npm.

---

## 7. Otwarte pytania

1. Skąd będą ładowane skrypty: URL, upload, z aplikacji hosta? Od tego zależy domyślne źródło dla `<skrypt-reader>`.
2. Kto pisze skrypty i czy można im narzucić konwencję (`***`, `{#id}`, `id=` w quizie)? Jeśli nie, walidator i domyślne zachowania muszą być bardziej wyrozumiałe.
3. Język UI: tylko polski czy od początku i18n (PL/EN)?
4. Czy wzory matematyczne (KaTeX) są potrzebne już w etapie 2?
5. Wymagane przeglądarki: zakładam ostatnie 2 wersje Chrome/Firefox/Safari, bez IE i starego Edge.
