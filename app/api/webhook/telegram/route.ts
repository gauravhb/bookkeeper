import { bot } from '@/lib/bots/telegram'

export async function POST(request: Request) {
  const body = await request.json()
  await bot.handleUpdate(body)
  return new Response('ok', { status: 200 })
}
