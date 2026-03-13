import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { kvPut, kvGet, kvDelete } from '@/lib/quorum'

const PutSchema = z.object({ key: z.string().min(1), value: z.string() })
const GetSchema = z.object({ key: z.string().min(1) })
const DeleteSchema = z.object({ key: z.string().min(1) })

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const parsed = GetSchema.safeParse({ key: searchParams.get('key') })
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
    }
    const result = await kvGet(parsed.data.key)
    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = PutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
    }
    const result = await kvPut(parsed.data.key, parsed.data.value)
    return NextResponse.json({ data: result, error: null }, { status: result.success ? 200 : 409 })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = DeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
    }
    const result = await kvDelete(parsed.data.key)
    return NextResponse.json({ data: result, error: null }, { status: result.success ? 200 : 409 })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
