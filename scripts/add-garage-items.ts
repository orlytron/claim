import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GARAGE_ITEMS = [
  { description: "e-bike", brand: "Electra", model: "Go!", qty: 4, unit_cost: 2000, age_years: 3, condition: "Good", category: "Sports" },
  { description: "standing golf bag", brand: "TaylorMade", model: "Flex Tech", qty: 1, unit_cost: 350, age_years: 2, condition: "Good", category: "Sports" },
  { description: "standing golf bag", brand: "Callaway", model: "Fairway w Stand", qty: 1, unit_cost: 300, age_years: 4, condition: "Average", category: "Sports" },
  { description: "complete golf club set", brand: "Callaway", model: "Graphite", qty: 3, unit_cost: 1500, age_years: 4, condition: "Average", category: "Sports" },
  { description: "golf club head covers", brand: "Callaway", model: "Faux leather", qty: 3, unit_cost: 390, age_years: 4, condition: "Average", category: "Sports" },
  { description: "golf cleats", brand: "Nike", model: "", qty: 3, unit_cost: 125, age_years: 4, condition: "Average", category: "Sports" },
  { description: "golf balls", brand: "Titleist", model: "", qty: 2, unit_cost: 58, age_years: 1, condition: "Like New", category: "Sports" },
  { description: "golf range finder", brand: "Precision", model: "", qty: 1, unit_cost: 330, age_years: 2, condition: "Good", category: "Electronics" },
  { description: "surfboard", brand: "Firewire", model: "6'6\"", qty: 1, unit_cost: 1200, age_years: 1, condition: "Like New", category: "Sports" },
  { description: "surfboard", brand: "Channel Islands", model: "9'4\"", qty: 1, unit_cost: 1400, age_years: 3, condition: "Good", category: "Sports" },
  { description: "surfboard", brand: "Pyzel", model: "6'2\"", qty: 1, unit_cost: 850, age_years: 2, condition: "Good", category: "Sports" },
  { description: "surfboard custom", brand: "Bones Board", model: "7'2\"", qty: 1, unit_cost: 1100, age_years: 2, condition: "Good", category: "Sports" },
  { description: "surfboard", brand: "CJ Nelson", model: "9'6\"", qty: 1, unit_cost: 1200, age_years: 2, condition: "Good", category: "Sports" },
  { description: "surfboard fins", brand: "Channel Islands", model: "", qty: 1, unit_cost: 60, age_years: 2, condition: "Good", category: "Sports" },
  { description: "surfboard fins", brand: "Firewire", model: "", qty: 1, unit_cost: 125, age_years: 2, condition: "Good", category: "Sports" },
  { description: "wetsuit Flashbomb", brand: "Rip Curl", model: "Flashbomb", qty: 1, unit_cost: 365, age_years: 2, condition: "Good", category: "Sports" },
  { description: "wetsuit", brand: "O'Neill", model: "", qty: 1, unit_cost: 400, age_years: 1, condition: "Like New", category: "Sports" },
  { description: "wetsuit", brand: "Rip Curl", model: "", qty: 1, unit_cost: 365, age_years: 1, condition: "Like New", category: "Sports" },
  { description: "wetsuit", brand: "Billabong", model: "", qty: 1, unit_cost: 400, age_years: 3, condition: "Good", category: "Sports" },
  { description: "wetsuit", brand: "O'Neill", model: "", qty: 1, unit_cost: 375, age_years: 3, condition: "Good", category: "Sports" },
  { description: "tennis racket", brand: "Babolat", model: "", qty: 2, unit_cost: 300, age_years: 2, condition: "Good", category: "Sports" },
  { description: "tennis racket Pro Staff", brand: "Wilson", model: "Pro Staff", qty: 1, unit_cost: 300, age_years: 3, condition: "Good", category: "Sports" },
  { description: "tennis racket", brand: "Head", model: "", qty: 1, unit_cost: 225, age_years: 3, condition: "Good", category: "Sports" },
  { description: "tennis balls case", brand: "Wilson", model: "", qty: 1, unit_cost: 130, age_years: 1, condition: "Like New", category: "Sports" },
  { description: "tennis bag", brand: "Babolat", model: "", qty: 2, unit_cost: 150, age_years: 2, condition: "Good", category: "Sports" },
  { description: "tennis cap", brand: "Assorted", model: "", qty: 5, unit_cost: 35, age_years: 3, condition: "Good", category: "Sports" },
  { description: "terry wrist band", brand: "Assorted", model: "", qty: 6, unit_cost: 10, age_years: 1, condition: "Like New", category: "Sports" },
  { description: "tent 8-person", brand: "North Face", model: "", qty: 1, unit_cost: 600, age_years: 5, condition: "Average", category: "Sports" },
  { description: "sleeping bag", brand: "Marmot", model: "", qty: 1, unit_cost: 300, age_years: 4, condition: "Average", category: "Sports" },
  { description: "sleeping bag", brand: "Sea to Summit", model: "", qty: 1, unit_cost: 360, age_years: 4, condition: "Average", category: "Sports" },
  { description: "sleeping bag", brand: "Marmot", model: "", qty: 1, unit_cost: 300, age_years: 3, condition: "Good", category: "Sports" },
  { description: "sleeping bag", brand: "Thermarest", model: "", qty: 1, unit_cost: 375, age_years: 4, condition: "Average", category: "Sports" },
  { description: "cooler", brand: "YETI", model: "", qty: 1, unit_cost: 250, age_years: 4, condition: "Average", category: "Sports" },
]

async function addGarageItems() {
  const { data: session } = await supabase
    .from('claim_session')
    .select('claim_items')
    .eq('id', 'trial')
    .single()

  if (!session) { console.error('No session found'); process.exit(1) }

  const existing = (session.claim_items || []) as any[]
  const newItems = GARAGE_ITEMS.map(item => ({
    room: 'Garage',
    description: item.description,
    brand: item.brand,
    model: item.model,
    qty: item.qty,
    unit_cost: item.unit_cost,
    age_years: item.age_years,
    age_months: 0,
    condition: item.condition,
    category: item.category,
    source: 'original',
  }))

  const newDescs = new Set(newItems.map(i => i.description.toLowerCase().trim()))
  const kept = existing.filter((i: any) => i.room !== 'Garage' || !newDescs.has(i.description.toLowerCase().trim()))
  const merged = [...kept, ...newItems]
  const newTotal = merged.reduce((s: number, i: any) => s + i.unit_cost * i.qty, 0)

  const { error } = await supabase.from('claim_session').update({ claim_items: merged, current_total: newTotal }).eq('id', 'trial')
  if (error) { console.error('Error:', error.message); process.exit(1) }

  const addedTotal = newItems.reduce((s, i) => s + i.unit_cost * i.qty, 0)
  console.log('✓ Added', newItems.length, 'garage items')
  console.log('✓ Added value: $' + addedTotal.toLocaleString())
  console.log('✓ New claim total: $' + newTotal.toLocaleString())
}

addGarageItems()
