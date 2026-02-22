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
          cuisine: string
          type: string | null
          categories: string[]
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          cuisine: string
          type?: string | null
          categories?: string[]
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          cuisine?: string
          type?: string | null
          categories?: string[]
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
          dish: string | null
          photo_url: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          restaurant_id?: string | null
          user_id?: string | null
          organisation_id?: string | null
          dish?: string | null
          photo_url?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number | null
          restaurant_id?: string | null
          user_id?: string | null
          organisation_id?: string | null
          dish?: string | null
          photo_url?: string | null
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
      tags: {
        Row: {
          id: string
          name: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string | null
        }
        Relationships: []
      }
      review_tags: {
        Row: {
          id: string
          review_id: string
          tag_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          review_id: string
          tag_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          review_id?: string
          tag_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_tags_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          name: string | null
          email: string | null
          display_name: string | null
          is_private: boolean
          avatar_url: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          name?: string | null
          email?: string | null
          display_name?: string | null
          is_private?: boolean
          avatar_url?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string | null
          email?: string | null
          display_name?: string | null
          is_private?: boolean
          avatar_url?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      follow_requests: {
        Row: {
          id: string
          requester_id: string
          target_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          requester_id: string
          target_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          requester_id?: string
          target_id?: string
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
      user_follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string | null
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
export type UserFollow = Database['public']['Tables']['user_follows']['Row']
export type FollowRequest = Database['public']['Tables']['follow_requests']['Row']
export type Tag = Database['public']['Tables']['tags']['Row']
export type ReviewTag = Database['public']['Tables']['review_tags']['Row']

// Category type
export type RestaurantCategory = 'lunch' | 'dinner' | 'coffee' | 'brunch' | 'pub'

// Review with tags
export type ReviewWithTags = Review & {
  profile?: Profile | null
  isOrgMember?: boolean
  tags?: Tag[]
}

export type RestaurantWithReviews = Restaurant & {
  reviews: ReviewWithTags[]
  avgRating: number | null
  topTags?: { tag: Tag; count: number }[]
}

export type OrganisationWithMembership = Organisation & {
  role: 'admin' | 'member'
}

export type OfficeLocation = {
  lat: number
  lng: number
}

// Social filter type
export type SocialFilter = 'everyone' | 'following' | 'followers' | 'just_me' | string // string for org slugs
