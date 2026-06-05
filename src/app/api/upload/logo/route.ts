import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const filename = `logo.${ext}`
  const dest = path.join(process.cwd(), 'public', 'uploads', filename)
  await writeFile(dest, buffer)

  return NextResponse.json({ url: `/uploads/${filename}` })
}
