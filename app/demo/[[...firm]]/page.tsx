import type { Metadata } from 'next'
import { DemoPage } from '@/components/DemoPage'
import { firmName, type Audience } from '@/content/site'

type Props = {
  params: Promise<{ firm?: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const firm = firmName((await params).firm?.[0])
  return { title: firm ? `Vera · prepared for ${firm}` : 'Vera · AI back office for construction' }
}

export default async function Page({ params, searchParams }: Props) {
  const [{ firm }, sp] = await Promise.all([params, searchParams])
  // ?for=developer was the developer view; it now shows the feedback view.
  const audience: Audience = sp.for === 'developer' ? 'review' : 'contractor'
  return <DemoPage firm={firmName(firm?.[0])} audience={audience} />
}
