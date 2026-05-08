import Pusher from 'pusher'
import PusherJS from 'pusher-js'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

// Lazy singleton — only instantiated in the browser to avoid SSR crashes
let _pusherClient: PusherJS | null = null

export function getPusherClient(): PusherJS {
  if (_pusherClient) return _pusherClient
  _pusherClient = new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  })
  return _pusherClient
}
