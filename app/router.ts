import { createRouter, type RouterContext } from 'remix/router'
import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'

import controller, {
  createRootController,
  type RootControllerServices,
} from './actions/controller.tsx'
import { assets } from './assets.ts'
import { routes } from './routes.ts'

type AppRouterOptions = RootControllerServices

export function createAppRouter(options: AppRouterOptions = {}) {
  let appRouter = createRouter({
    middleware: [staticFiles('./public', { index: false }), formData(), render({ assets })],
  })

  appRouter.map(
    routes,
    Object.keys(options).length > 0 ? createRootController(options) : controller,
  )
  return appRouter
}

export const router = createAppRouter()

export type AppContext = RouterContext<typeof router>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}
