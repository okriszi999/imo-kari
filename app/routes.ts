import { get, post, route } from 'remix/routes'

export const routes = route({
  assets: get('/assets/*path'),
  home: get('/'),
  draw: post('/'),
  wishlist: post('/wishlist'),
  hintRequest: post('/hint-request'),
  setPin: post('/set-pin'),
})
