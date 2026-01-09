# Otto Frontend Implementation Plan

## Overview
Implement a React frontend for Otto with:
1. Marketing landing page
2. Setup wizard for workspace onboarding (Slack + Asana OAuth)
3. AGENTS.md with strict coding standards

## Tech Stack
- **Framework**: Vite + React 19 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS v4
- **State**: Zustand (global) + React Hook Form (forms)
- **Data Fetching**: TanStack Query
- **Testing**: Vitest + Storybook + Playwright
- **Location**: `/Users/natkoersch/otto3-feature/frontend/web/`

## Critical Conventions (Agent-Ready Codebase)

### BANNED HOOKS (enforced via ESLint)
| Hook | Status | Alternative |
|------|--------|-------------|
| `useEffect` | BANNED | TanStack Query, Zustand, event handlers |
| `useMemo` | BANNED | React Compiler handles it |
| `useCallback` | BANNED | React Compiler handles it |
| `useLayoutEffect` | BANNED | Refs + event handlers |

### Required Tooling
- Strict TypeScript (`strict: true`, `noUncheckedIndexedAccess`)
- ESLint with `no-restricted-syntax` rules to ban hooks
- Vitest for unit tests
- Storybook for component documentation
- Playwright for E2E tests
- React Compiler (babel plugin) for automatic optimization

---

## Project Structure

```
web/
├── src/
│   ├── api/
│   │   ├── client.ts              # Type-safe fetch wrapper
│   │   └── queries/               # TanStack Query hooks
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   ├── layout/                # Header, Footer, PageContainer
│   │   ├── landing/               # Hero, Features, HowItWorks, CTA
│   │   └── setup/                 # WorkspaceForm, SlackConnect, AsanaConnect
│   ├── hooks/
│   │   └── use-setup-state.ts     # Zustand store for wizard
│   ├── pages/
│   │   ├── Landing.tsx
│   │   └── Setup.tsx
│   ├── routes/
│   │   └── index.tsx              # TanStack Router config
│   └── styles/
│       └── globals.css
├── tests/e2e/                     # Playwright tests
├── .eslintrc.cjs                  # Banned hooks enforcement
├── AGENTS.md                      # AI coding standards
├── vite.config.ts                 # React Compiler plugin
└── package.json
```

---

## Implementation Steps

### Phase 1: Project Scaffolding
1. Create `web/` directory
2. Initialize Vite + React + TypeScript
3. Configure path aliases (`@/` → `./src/`)
4. Install Tailwind CSS v4 with Vite plugin
5. Initialize shadcn/ui (Button, Card, Input, Form, Label)

### Phase 2: Tooling Setup
6. Configure ESLint with banned hooks rules:
   ```javascript
   'no-restricted-syntax': [
     'error',
     { selector: "CallExpression[callee.name='useEffect']", message: 'useEffect is BANNED' },
     { selector: "CallExpression[callee.name='useMemo']", message: 'useMemo is BANNED' },
     { selector: "CallExpression[callee.name='useCallback']", message: 'useCallback is BANNED' },
   ]
   ```
7. Set up Vitest with jsdom environment
8. Initialize Storybook 8
9. Set up Playwright
10. Configure Husky + lint-staged for pre-commit

### Phase 3: Core Infrastructure
11. Create API client with Zod validation
12. Set up TanStack Query provider
13. Create Zustand store for setup wizard state
14. Configure TanStack Router

### Phase 4: Landing Page
15. Layout components (Header, Footer)
16. Hero section with CTA button
17. Features grid (3-4 feature cards)
18. HowItWorks section (step-by-step)
19. Final CTA section
20. Storybook stories for all components

### Phase 5: Setup Wizard
21. WorkspaceForm (name, admin email) with validation
22. SlackConnect (OAuth redirect button)
23. AsanaConnect (OAuth redirect button)
24. SetupProgress stepper
25. SetupComplete confirmation
26. Unit tests for form validation

### Phase 6: Backend API Endpoints (in Express)
27. `POST /api/tenants` - Create tenant
28. `GET /api/oauth/slack/authorize` - Initiate Slack OAuth
29. `GET /api/oauth/asana/authorize` - Initiate Asana OAuth
30. `GET /api/oauth/callback` - Handle OAuth callback

### Phase 7: E2E Tests & Polish
31. Playwright tests for landing page
32. Playwright tests for setup wizard flow
33. Mobile responsive design
34. Loading/error states

### Phase 8: Documentation
35. Create comprehensive AGENTS.md
36. Update root README

---

## Key Files

| File | Purpose |
|------|---------|
| `web/vite.config.ts` | React Compiler plugin, Tailwind, path aliases |
| `web/eslint.config.js` | Banned hooks enforcement |
| `web/AGENTS.md` | AI agent coding standards |
| `web/src/api/client.ts` | Type-safe API client |
| `web/src/hooks/use-setup-state.ts` | Zustand wizard store |
| `web/src/components/landing/Hero.tsx` | Landing page hero |
| `web/src/components/setup/WorkspaceForm.tsx` | Setup wizard form |

---

## Dependencies

### Production
- react, react-dom (v19)
- @tanstack/react-query, @tanstack/react-router
- zustand
- react-hook-form, @hookform/resolvers, zod
- class-variance-authority, clsx, tailwind-merge

### Development
- vite, @vitejs/plugin-react, babel-plugin-react-compiler
- typescript, @types/react, @types/react-dom
- eslint, @typescript-eslint/*
- vitest, @testing-library/react, jsdom
- storybook, @storybook/react-vite
- playwright
- tailwindcss, @tailwindcss/vite
