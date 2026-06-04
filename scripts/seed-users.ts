import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function seedUsers() {
  const users = [
    {
      email: 'jefe@muni-ica.gob.pe',
      password: 'Jefe2026!',
      user_metadata: { rol: 'jefe', username: 'jefe_informatica' },
    },
    {
      email: 'tecnico1@muni-ica.gob.pe',
      password: 'Tecnico2026!',
      user_metadata: { rol: 'tecnico', username: 'tecnico_01' },
    },
    {
      email: 'tecnico2@muni-ica.gob.pe',
      password: 'Tecnico2026!',
      user_metadata: { rol: 'tecnico', username: 'tecnico_02' },
    },
  ]

  for (const user of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      user_metadata: user.user_metadata,
      email_confirm: true,
    })
    if (error) {
      console.error(`❌ ${user.email}:`, error.message)
    } else {
      console.log(`✅ ${user.email} — id: ${data.user.id}`)
    }
  }
}

seedUsers()
