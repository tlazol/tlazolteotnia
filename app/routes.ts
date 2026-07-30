import { index, type RouteConfig, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('api/reactions/:slug', 'routes/api.reactions.$slug.ts'),
  route('app/lean-learning', 'routes/lean-learning.tsx'),
  route('app/lean-learning/:lesson', 'routes/lean-learning.$lesson.tsx'),
  route('blog', 'routes/blog.tsx'),
  route('blog/:slug', 'routes/blog.$slug.tsx')
] satisfies RouteConfig
