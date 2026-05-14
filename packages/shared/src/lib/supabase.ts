import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getConfig } from './config'

const { supabaseUrl, supabaseAnonKey } = getConfig()

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
