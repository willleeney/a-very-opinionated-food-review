export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          slug: string
          office_location: Json | null
          tagline: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          office_location?: Json | null
          tagline?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          office_location?: Json | null
          tagline?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      organisation_members: {
        Row: {
          id: string
          organisation_id: string
          user_id: string
          role: 'admin' | 'member'
          created_at: string | null
        }
        Insert: {
          id?: string
          organisation_id: string
          user_id: string
          role?: 'admin' | 'member'
          created_at?: string | null
        }
        Update: {
          id?: string
          organisation_id?: string
          user_id?: string
          role?: 'admin' | 'member'
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invites: {
        Row: {
          id: string
          organisation_id: string
          email: string
          token: string
          invited_by: string
          created_at: string | null
          expires_at: string | null
        }
        Insert: {
          id?: string
          organisation_id: string
          email: string
          token?: string
          invited_by: string
          created_at?: string | null
          expires_at?: string | null
        }
        Update: {
          id?: string
          organisation_id?: string
          email?: string
          token?: string
          invited_by?: string
          created_at?: string | null
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_requests: {
        Row: {
          id: string
          organisation_id: string
          user_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          organisation_id: string
          user_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          organisation_id?: string
          user_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_requests_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          type: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          type: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          type?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rating: number | null
          restaurant_id: string | null
          user_id: string | null
          organisation_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          restaurant_id?: string | null
          user_id?: string | null
          organisation_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          restaurant_id?: string | null
          user_id?: string | null
          organisation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: Json | null
        }
        Insert: {
          key: string
          value?: Json | null
        }
        Update: {
          key?: string
          value?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Convenience types
export type Restaurant = Database['public']['Tables']['restaurants']['Row']
export type Review = Database['public']['Tables']['reviews']['Row']
export type Organisation = Database['public']['Tables']['organisations']['Row']
export type OrganisationMember = Database['public']['Tables']['organisation_members']['Row']
export type OrganisationInvite = Database['public']['Tables']['organisation_invites']['Row']
export type OrganisationRequest = Database['public']['Tables']['organisation_requests']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']

export type RestaurantWithReviews = Restaurant & {
  reviews: (Review & { profile?: Profile | null; isOrgMember?: boolean })[]
  avgRating: number | null
  distance: number | null
}

export type OrganisationWithMembership = Organisation & {
  role: 'admin' | 'member'
}

export type OfficeLocation = {
  lat: number
  lng: number
}
