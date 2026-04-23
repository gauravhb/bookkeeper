import { bot } from '@/lib/bots/telegram'

export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }
  const body = await request.json()
  await bot.handleUpdate(body)
  return new Response('ok', { status: 200 })
}
