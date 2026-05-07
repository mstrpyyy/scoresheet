import Pusher from 'pusher'
import PusherJS from 'pusher-js'

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
})

// Singleton for client-side usage (only instantiate in the browser)
const globalForPusher = global as unknown as { pusherClient: PusherJS }

export const pusherClient =
  globalForPusher.pusherClient ??
  new PusherJS(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  })

if (process.env.NODE_ENV !== 'production') globalForPusher.pusherClient = pusherClient
