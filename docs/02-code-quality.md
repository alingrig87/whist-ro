# Commit 02 — Code Quality: ESLint + Prettier + Husky + Commitlint

## 🇬🇧 English

### Requirements

Automated code quality enforcement:
- Consistent formatting (no tabs vs spaces debates)
- Lint errors caught before commit
- Commit messages follow Conventional Commits spec (needed for changelog generation)

### What Was Implemented

| File | Purpose |
|------|---------|
| `.eslintrc.cjs` | ESLint rules for TypeScript + React hooks |
| `.prettierrc` | Formatting config (2 spaces, single quotes, no semicolons) |
| `.husky/pre-commit` | Runs lint-staged before every commit |
| `.husky/commit-msg` | Validates commit message format |
| `commitlint.config.cjs` | Conventional Commits config |

### Conventional Commits Format

```
<type>(<scope>): <short description>

feat(game): add bidding phase UI
fix(scoring): correct trick count after trump play
docs(lobby): explain table join flow
refactor(cards): extract shuffle into pure function
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Why lint-staged (not lint everything)

Running ESLint on all files in a large project takes seconds. `lint-staged` only
lints the files you're about to commit — instant feedback, no slowdown.

---

## 🇷🇴 Română

### Ce s-a implementat

Instrumente de calitate cod rulate automat la fiecare commit:
- **ESLint** — detectează bug-uri potențiale și bad practices
- **Prettier** — formatare automată (nu mai dezbați tabs vs spaces)
- **Husky** — git hooks: `pre-commit` rulează lint, `commit-msg` validează mesajul
- **Commitlint** — mesajele de commit urmează Conventional Commits

### Formatul Conventional Commits

```
feat(game): adaugă UI pentru faza de licitație
fix(scoring): corectează numărul de levate după trump
docs(lobby): explică fluxul de join la masă
```

### De ce lint-staged

ESLint pe tot proiectul durează câteva secunde. `lint-staged` lintează **doar
fișierele staged** (cele pe care le commitem acum) — feedback instant.
