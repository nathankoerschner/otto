# AGENTS.md - Otto Frontend Coding Standards

This document defines **strict coding standards** for AI agents working on the Otto frontend.
These rules are **non-negotiable** and enforced by ESLint, TypeScript, and CI checks.

---

## BANNED HOOKS

The following React hooks are **BANNED** and will cause lint errors:

| Hook              | Status   | Reason                                    | Alternative                                    |
|-------------------|----------|-------------------------------------------|------------------------------------------------|
| `useEffect`       | **BANNED** | Leads to race conditions, complexity      | TanStack Query, Zustand, event handlers        |
| `useMemo`         | **BANNED** | React Compiler handles optimization       | Write plain code                               |
| `useCallback`     | **BANNED** | React Compiler handles optimization       | Write plain functions                          |
| `useLayoutEffect` | **BANNED** | Rarely needed, use CSS                    | Refs + event handlers                          |

### Why These Are Banned

**React Compiler** (enabled via `babel-plugin-react-compiler`) automatically optimizes re-renders and memoization. Manual optimization with `useMemo`/`useCallback` is unnecessary and adds complexity.

For `useEffect`, the declarative patterns below are cleaner and more maintainable.

---

## Approved Patterns

### Data Fetching: Use TanStack Query

```typescript
// CORRECT: Declarative data fetching
import { useQuery } from '@tanstack/react-query'

function UserProfile({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['users', userId],
    queryFn: () => fetchUser(userId),
  })

  if (isLoading) return <Skeleton />
  if (error) return <ErrorMessage error={error} />
  return <ProfileCard user={user} />
}
```

```typescript
// WRONG: Imperative fetching with useEffect
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {  // LINT ERROR: useEffect is banned
    fetchUser(userId).then(setUser).finally(() => setLoading(false))
  }, [userId])
}
```

### Mutations: Use TanStack Query Mutations

```typescript
// CORRECT
const createTask = useMutation({
  mutationFn: (data: CreateTaskInput) => api.post('/tasks', data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
})

function handleSubmit(data: FormData) {
  createTask.mutate(data)
}
```

### Global State: Use Zustand

```typescript
// CORRECT: Zustand store
import { create } from 'zustand'

interface SetupStore {
  step: number
  tenantId: string | null
  setStep: (step: number) => void
  setTenantId: (id: string) => void
}

export const useSetupStore = create<SetupStore>((set) => ({
  step: 0,
  tenantId: null,
  setStep: (step) => set({ step }),
  setTenantId: (id) => set({ tenantId: id }),
}))
```

### Form State: Use React Hook Form + Zod

```typescript
// CORRECT: Form with validation
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
})

function WorkspaceForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  })

  function onSubmit(data: z.infer<typeof schema>) {
    // Handle form submission
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>
}
```

### Event Handling: Use Event Handlers

```typescript
// CORRECT: Direct event handlers
function SearchInput() {
  const [query, setQuery] = useState('')

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') {
      performSearch(query)
    }
  }

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={handleKeyDown}
    />
  )
}
```

### Refs for DOM Access

```typescript
// CORRECT: Refs for imperative DOM operations
function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  function handlePlay() {
    videoRef.current?.play()
  }

  return (
    <div>
      <video ref={videoRef} src={src} />
      <button onClick={handlePlay}>Play</button>
    </div>
  )
}
```

---

## TypeScript Requirements

- **Strict mode enabled** - no `any` types allowed (except in tests)
- **`noUncheckedIndexedAccess: true`** - array/object access returns `T | undefined`
- **`exactOptionalPropertyTypes: true`** - strict optional property handling
- **Interface over type** for object shapes
- **Zod schemas** for runtime validation of API responses

```typescript
// CORRECT: Zod schema for API response
import { z } from 'zod'

const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slackWorkspaceId: z.string(),
  asanaWorkspaceId: z.string(),
  createdAt: z.string().datetime(),
})

type Tenant = z.infer<typeof TenantSchema>
```

---

## Component Guidelines

### Props Interface

```typescript
// CORRECT: Clear props interface with JSDoc
interface ButtonProps {
  /** Button label text */
  children: React.ReactNode
  /** Click handler */
  onClick: () => void
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'destructive'
  /** Disable interactions */
  disabled?: boolean
  /** Show loading spinner */
  loading?: boolean
}
```

### Composition Over Configuration

```typescript
// CORRECT: Composable components
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// WRONG: Prop-heavy configuration
<Card
  title="Title"
  description="Description"
  content="Content here"
  actions={[{ label: 'Action', onClick: () => {} }]}
/>
```

---

## File Structure Requirements

Every component with logic MUST follow this structure:

```
ComponentName/
├── ComponentName.tsx          # Component implementation
├── ComponentName.stories.tsx  # Storybook stories
├── ComponentName.test.tsx     # Unit tests
└── index.ts                   # Re-export
```

Simple UI components (like those in `ui/`) can be single files.

---

## Testing Requirements

### Unit Tests (Vitest)
- Every component with logic MUST have tests
- Test user interactions, not implementation details
- Use `@testing-library/react` for component tests
- Mock API calls with MSW

### Storybook
- Every UI component MUST have stories
- Include states: default, loading, error, empty
- Use `autodocs` tag for documentation

### E2E Tests (Playwright)
- Critical user flows MUST have E2E tests
- Test on Chromium, Firefox, and WebKit
- Use page object pattern for complex flows

---

## Quick Reference

| Task                    | Solution                                      |
|-------------------------|-----------------------------------------------|
| Fetch data on mount     | `useQuery` with query key                     |
| Fetch data on event     | `useMutation` or `queryClient.fetchQuery`     |
| Global state            | Zustand store                                 |
| Form state              | React Hook Form + Zod                         |
| Derived state           | Compute inline or Zustand selector            |
| Side effect on event    | Event handler function                        |
| Interval/timer          | `useQuery` with `refetchInterval`             |
| DOM measurement         | Ref + event handler                           |

---

## Before Submitting Code

1. `bun run typecheck` - must pass
2. `bun run lint` - must pass (checks for banned hooks)
3. `bun run test:run` - must pass
4. `bun run build` - must succeed

---

## Git Commit Format

```
type(scope): description

Examples:
- feat(setup): add Slack OAuth flow
- fix(landing): correct hero image sizing
- test(workspace): add form validation tests
- docs: update AGENTS.md with new patterns
```

---

## Forbidden Practices

1. **Never use `useEffect` for data fetching** - Use TanStack Query
2. **Never use `useMemo` or `useCallback`** - React Compiler handles it
3. **Never use `any` type** - Define proper types
4. **Never commit without running lint** - CI will fail
5. **Never skip tests for components with logic** - Coverage matters
6. **Never use inline styles** - Use Tailwind classes
7. **Never import from `react` directly for optimization hooks** - They're banned

---

## Resources

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [React Hook Form Docs](https://react-hook-form.com/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS v4](https://tailwindcss.com/)
