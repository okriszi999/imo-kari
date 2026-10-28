import { router } from '../app/router.ts'

export default {
  fetch(request: Request): Promise<Response> {
    return router.fetch(request)
  },
}
