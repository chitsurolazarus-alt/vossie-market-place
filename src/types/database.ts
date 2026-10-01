export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      allowed_email_domains: {
        Row: {
          created_at: string
          domain: string
        }
        Insert: {
          created_at?: string
          domain: string
        }
        Update: {
          created_at?: string
          domain?: string
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          detail: Json | null
          id: number
          reason: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          detail?: Json | null
          id?: never
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          detail?: Json | null
          id?: never
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campuses: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      conversations: {
        Row: {
          buyer_id: string | null
          buyer_name: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          last_sender_id: string | null
          listing_cover: string | null
          listing_id: string | null
          listing_title: string | null
          origin: string
          seller_id: string
          seller_name: string | null
        }
        Insert: {
          buyer_id?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          listing_cover?: string | null
          listing_id?: string | null
          listing_title?: string | null
          origin?: string
          seller_id: string
          seller_name?: string | null
        }
        Update: {
          buyer_id?: string | null
          buyer_name?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          listing_cover?: string | null
          listing_id?: string | null
          listing_title?: string | null
          origin?: string
          seller_id?: string
          seller_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_last_sender_id_fkey"
            columns: ["last_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          sent_at: string | null
          subject: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          sent_at?: string | null
          subject: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          sent_at?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiries: {
        Row: {
          auto_confirmed: boolean
          buyer_confirmed_at: string | null
          buyer_disputed_at: string | null
          buyer_id: string | null
          completed_at: string | null
          completion_requested_at: string | null
          conversation_id: string
          created_at: string
          first_response_at: string | null
          id: string
          listing_id: string | null
          sale_happened: boolean | null
          seller_id: string
          source: string
          status: Database["public"]["Enums"]["enquiry_status"]
          updated_at: string
        }
        Insert: {
          auto_confirmed?: boolean
          buyer_confirmed_at?: string | null
          buyer_disputed_at?: string | null
          buyer_id?: string | null
          completed_at?: string | null
          completion_requested_at?: string | null
          conversation_id: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          listing_id?: string | null
          sale_happened?: boolean | null
          seller_id: string
          source?: string
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
        }
        Update: {
          auto_confirmed?: boolean
          buyer_confirmed_at?: string | null
          buyer_disputed_at?: string | null
          buyer_id?: string | null
          completed_at?: string | null
          completion_requested_at?: string | null
          conversation_id?: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          listing_id?: string | null
          sale_happened?: boolean | null
          seller_id?: string
          source?: string
          status?: Database["public"]["Enums"]["enquiry_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiries_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiries_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enquiry_events: {
        Row: {
          actor_id: string | null
          created_at: string
          data: Json
          enquiry_id: string
          id: number
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          enquiry_id: string
          id?: never
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          data?: Json
          enquiry_id?: string
          id?: never
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "enquiry_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enquiry_events_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
        }
        Relationships: []
      }
      featured_slots: {
        Row: {
          campus_id: string
          id: string
          is_override: boolean
          position: number
          seller_id: string
          slot_date: string
        }
        Insert: {
          campus_id: string
          id?: string
          is_override?: boolean
          position?: number
          seller_id: string
          slot_date: string
        }
        Update: {
          campus_id?: string
          id?: string
          is_override?: boolean
          position?: number
          seller_id?: string
          slot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_slots_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_slots_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          seller_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          seller_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          seller_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_bookings: {
        Row: {
          created_at: string
          host_note: string | null
          id: string
          message: string | null
          post_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          host_note?: string | null
          id?: string
          message?: string | null
          post_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          host_note?: string | null
          id?: string
          message?: string | null
          post_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_bookings_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hub_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_posts: {
        Row: {
          author_id: string | null
          body: string
          campus_id: string | null
          capacity: number | null
          cover_path: string | null
          created_at: string
          event_at: string | null
          id: string
          kind: string
          published: boolean
          rsvp_count: number
          title: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          author_id?: string | null
          body?: string
          campus_id?: string | null
          capacity?: number | null
          cover_path?: string | null
          created_at?: string
          event_at?: string | null
          id?: string
          kind: string
          published?: boolean
          rsvp_count?: number
          title: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          campus_id?: string | null
          capacity?: number | null
          cover_path?: string | null
          created_at?: string
          event_at?: string | null
          id?: string
          kind?: string
          published?: boolean
          rsvp_count?: number
          title?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_posts_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_rsvps: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "hub_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hub_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          alt: string
          created_at: string
          id: string
          listing_id: string
          path: string
          position: number
        }
        Insert: {
          alt: string
          created_at?: string
          id?: string
          listing_id: string
          path: string
          position?: number
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          listing_id?: string
          path?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_tags: {
        Row: {
          listing_id: string
          tag_id: string
        }
        Insert: {
          listing_id: string
          tag_id: string
        }
        Update: {
          listing_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_tags_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_views: {
        Row: {
          anon_hash: string | null
          created_at: string
          id: number
          listing_id: string
          view_date: string
          viewer_id: string | null
          viewer_key: string | null
        }
        Insert: {
          anon_hash?: string | null
          created_at?: string
          id?: never
          listing_id: string
          view_date?: string
          viewer_id?: string | null
          viewer_key?: string | null
        }
        Update: {
          anon_hash?: string | null
          created_at?: string
          id?: never
          listing_id?: string
          view_date?: string
          viewer_id?: string | null
          viewer_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          availability: Database["public"]["Enums"]["availability"]
          campus_id: string
          category_id: string | null
          created_at: string
          deleted_at: string | null
          delivered_on_campus: boolean
          description: string | null
          hidden_by_moderation: boolean
          id: string
          kind: Database["public"]["Enums"]["listing_kind"]
          moderation_hidden_at: string | null
          moderation_hidden_reason: string | null
          pickup_point_id: string | null
          price_is_from: boolean
          price_zar: number | null
          pricing_mode: Database["public"]["Enums"]["pricing_mode"]
          search: unknown
          seller_id: string
          swap_for: string | null
          title: string
          updated_at: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability"]
          campus_id: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_on_campus?: boolean
          description?: string | null
          hidden_by_moderation?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["listing_kind"]
          moderation_hidden_at?: string | null
          moderation_hidden_reason?: string | null
          pickup_point_id?: string | null
          price_is_from?: boolean
          price_zar?: number | null
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"]
          search?: unknown
          seller_id: string
          swap_for?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability"]
          campus_id?: string
          category_id?: string | null
          created_at?: string
          deleted_at?: string | null
          delivered_on_campus?: boolean
          description?: string | null
          hidden_by_moderation?: boolean
          id?: string
          kind?: Database["public"]["Enums"]["listing_kind"]
          moderation_hidden_at?: string | null
          moderation_hidden_reason?: string | null
          pickup_point_id?: string | null
          price_is_from?: boolean
          price_zar?: number | null
          pricing_mode?: Database["public"]["Enums"]["pricing_mode"]
          search?: unknown
          seller_id?: string
          swap_for?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_checkins: {
        Row: {
          checked_in_at: string
          created_at: string
          id: string
          mentor_id: string | null
          note: string | null
          seller_id: string
        }
        Insert: {
          checked_in_at?: string
          created_at?: string
          id?: string
          mentor_id?: string | null
          note?: string | null
          seller_id: string
        }
        Update: {
          checked_in_at?: string
          created_at?: string
          id?: string
          mentor_id?: string | null
          note?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_checkins_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_checkins_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_notes: {
        Row: {
          body: string
          created_at: string
          id: string
          mentor_id: string | null
          seller_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          mentor_id?: string | null
          seller_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          mentor_id?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_notes_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_notes_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          image_path: string | null
          kind: string
          read_at: string | null
          risk_flag: string | null
          sender_id: string | null
          swap_listing_id: string | null
          swap_listing_title: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          image_path?: string | null
          kind?: string
          read_at?: string | null
          risk_flag?: string | null
          sender_id?: string | null
          swap_listing_id?: string | null
          swap_listing_title?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          image_path?: string | null
          kind?: string
          read_at?: string | null
          risk_flag?: string | null
          sender_id?: string | null
          swap_listing_id?: string | null
          swap_listing_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_swap_listing_id_fkey"
            columns: ["swap_listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_swap_listing_id_fkey"
            columns: ["swap_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          email_daily_digest: boolean
          email_new_enquiry: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_daily_digest?: boolean
          email_new_enquiry?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_daily_digest?: boolean
          email_new_enquiry?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          conversation_id: string | null
          count: number
          created_at: string
          enquiry_id: string | null
          id: string
          read_at: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          conversation_id?: string | null
          count?: number
          created_at?: string
          enquiry_id?: string | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          conversation_id?: string | null
          count?: number
          created_at?: string
          enquiry_id?: string | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_zar: number
          buyer_id: string | null
          created_at: string
          enquiry_id: string | null
          id: string
          paystack_reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_zar: number
          buyer_id?: string | null
          created_at?: string
          enquiry_id?: string | null
          id?: string
          paystack_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_zar?: number
          buyer_id?: string | null
          created_at?: string
          enquiry_id?: string | null
          id?: string
          paystack_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: false
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_points: {
        Row: {
          approved: boolean
          campus_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          approved?: boolean
          campus_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          approved?: boolean
          campus_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          campus_id: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email: string | null
          id: string
          last_seen_at: string | null
          low_data_mode: boolean
          onboarding_seen: boolean
          phone: string | null
          popia_consent_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          seller_tour_seen: boolean
          suspended_until: string | null
          suspension_reason: string | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          campus_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          last_seen_at?: string | null
          low_data_mode?: boolean
          onboarding_seen?: boolean
          phone?: string | null
          popia_consent_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          seller_tour_seen?: boolean
          suspended_until?: string | null
          suspension_reason?: string | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          campus_id?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          last_seen_at?: string | null
          low_data_mode?: boolean
          onboarding_seen?: boolean
          phone?: string | null
          popia_consent_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          seller_tour_seen?: boolean
          suspended_until?: string | null
          suspension_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          body: string
          created_at: string
          id: string
          position: number
          seller_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          position?: number
          seller_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          position?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_context: {
        Row: {
          body: string
          created_at: string
          has_image: boolean
          id: number
          is_reported: boolean
          kind: string
          message_id: string | null
          position: number
          report_id: string
          sender_is_reported: boolean
          sender_role: string
          swap_title: string | null
        }
        Insert: {
          body: string
          created_at: string
          has_image?: boolean
          id?: never
          is_reported?: boolean
          kind: string
          message_id?: string | null
          position: number
          report_id: string
          sender_is_reported?: boolean
          sender_role: string
          swap_title?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          has_image?: boolean
          id?: never
          is_reported?: boolean
          kind?: string
          message_id?: string | null
          position?: number
          report_id?: string
          sender_is_reported?: boolean
          sender_role?: string
          swap_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_context_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          note: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string | null
          resolution: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_owner_id: string | null
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_owner_id?: string | null
          target_type: Database["public"]["Enums"]["report_target"]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_owner_id?: string | null
          target_type?: Database["public"]["Enums"]["report_target"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_target_owner_id_fkey"
            columns: ["target_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      request_responses: {
        Row: {
          created_at: string
          id: string
          listing_id: string | null
          message: string | null
          request_id: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id?: string | null
          message?: string | null
          request_id: string
          seller_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string | null
          message?: string | null
          request_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_responses_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_responses_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_responses_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          budget_zar: number | null
          buyer_id: string
          campus_id: string
          category_id: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          open_to_swap: boolean
          status: Database["public"]["Enums"]["request_status"]
          title: string
        }
        Insert: {
          budget_zar?: number | null
          buyer_id: string
          campus_id: string
          category_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          open_to_swap?: boolean
          status?: Database["public"]["Enums"]["request_status"]
          title: string
        }
        Update: {
          budget_zar?: number | null
          buyer_id?: string
          campus_id?: string
          category_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          open_to_swap?: boolean
          status?: Database["public"]["Enums"]["request_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          enquiry_id: string
          id: string
          reviewer_id: string
          thumbs_up: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          enquiry_id: string
          id?: string
          reviewer_id: string
          thumbs_up: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          enquiry_id?: string
          id?: string
          reviewer_id?: string
          thumbs_up?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_enquiry_id_fkey"
            columns: ["enquiry_id"]
            isOneToOne: true
            referencedRelation: "enquiries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_listings: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "browse_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_drafts: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_pickup_points: {
        Row: {
          pickup_point_id: string
          seller_id: string
        }
        Insert: {
          pickup_point_id: string
          seller_id: string
        }
        Update: {
          pickup_point_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_pickup_points_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_pickup_points_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_private: {
        Row: {
          seller_id: string
          whatsapp_e164: string | null
        }
        Insert: {
          seller_id: string
          whatsapp_e164?: string | null
        }
        Update: {
          seller_id?: string
          whatsapp_e164?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_private_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          approved_at: string | null
          bio: string | null
          business_name: string
          campus_id: string
          category_id: string | null
          contact_pref: Database["public"]["Enums"]["contact_pref"]
          created_at: string
          id: string
          mentor_id: string | null
          photo_url: string | null
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          slug_edited: boolean
          status: Database["public"]["Enums"]["seller_status"]
          submitted_at: string | null
          tagline: string | null
          user_id: string | null
          verified: boolean
        }
        Insert: {
          approved_at?: string | null
          bio?: string | null
          business_name: string
          campus_id: string
          category_id?: string | null
          contact_pref?: Database["public"]["Enums"]["contact_pref"]
          created_at?: string
          id?: string
          mentor_id?: string | null
          photo_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          slug_edited?: boolean
          status?: Database["public"]["Enums"]["seller_status"]
          submitted_at?: string | null
          tagline?: string | null
          user_id?: string | null
          verified?: boolean
        }
        Update: {
          approved_at?: string | null
          bio?: string | null
          business_name?: string
          campus_id?: string
          category_id?: string | null
          contact_pref?: Database["public"]["Enums"]["contact_pref"]
          created_at?: string
          id?: string
          mentor_id?: string | null
          photo_url?: string | null
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          slug_edited?: boolean
          status?: Database["public"]["Enums"]["seller_status"]
          submitted_at?: string | null
          tagline?: string | null
          user_id?: string | null
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_trust: {
        Row: {
          account_days: number
          confirmed_sales: number
          enquiries_14d: number
          enquiries_30d: number
          enquiries_90d: number
          hidden_listings_14d: number
          last_active_at: string | null
          last_listing_update_at: string | null
          listing_views_30d: number
          median_reply_seconds: number | null
          replied_90d: number
          reply_band: string | null
          reply_enquiries_30d: number
          response_rate: number | null
          seller_id: string
          tier: string
          updated_at: string
          verified: boolean
          whatsapp_30d: number
          whatsapp_leads_90d: number
        }
        Insert: {
          account_days?: number
          confirmed_sales?: number
          enquiries_14d?: number
          enquiries_30d?: number
          enquiries_90d?: number
          hidden_listings_14d?: number
          last_active_at?: string | null
          last_listing_update_at?: string | null
          listing_views_30d?: number
          median_reply_seconds?: number | null
          replied_90d?: number
          reply_band?: string | null
          reply_enquiries_30d?: number
          response_rate?: number | null
          seller_id: string
          tier?: string
          updated_at?: string
          verified?: boolean
          whatsapp_30d?: number
          whatsapp_leads_90d?: number
        }
        Update: {
          account_days?: number
          confirmed_sales?: number
          enquiries_14d?: number
          enquiries_30d?: number
          enquiries_90d?: number
          hidden_listings_14d?: number
          last_active_at?: string | null
          last_listing_update_at?: string | null
          listing_views_30d?: number
          median_reply_seconds?: number | null
          replied_90d?: number
          reply_band?: string | null
          reply_enquiries_30d?: number
          response_rate?: number | null
          seller_id?: string
          tier?: string
          updated_at?: string
          verified?: boolean
          whatsapp_30d?: number
          whatsapp_leads_90d?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_trust_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_trust_tier_fkey"
            columns: ["tier"]
            isOneToOne: false
            referencedRelation: "trust_tiers"
            referencedColumns: ["tier"]
          },
        ]
      }
      site_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      trust_tiers: {
        Row: {
          label: string
          min_account_days: number
          min_confirmed: number
          min_enquiries: number
          min_response_rate: number
          rank: number
          requires_verified: boolean
          summary: string
          tier: string
          updated_at: string
        }
        Insert: {
          label: string
          min_account_days?: number
          min_confirmed?: number
          min_enquiries?: number
          min_response_rate?: number
          rank: number
          requires_verified?: boolean
          summary: string
          tier: string
          updated_at?: string
        }
        Update: {
          label?: string
          min_account_days?: number
          min_confirmed?: number
          min_enquiries?: number
          min_response_rate?: number
          rank?: number
          requires_verified?: boolean
          summary?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_warnings: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          report_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          report_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          report_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warnings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warnings_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      browse_listings: {
        Row: {
          availability: Database["public"]["Enums"]["availability"] | null
          business_name: string | null
          campus_id: string | null
          campus_name: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          cover_alt: string | null
          cover_path: string | null
          created_at: string | null
          description: string | null
          id: string | null
          kind: Database["public"]["Enums"]["listing_kind"] | null
          price_is_from: boolean | null
          price_zar: number | null
          pricing_mode: Database["public"]["Enums"]["pricing_mode"] | null
          search: unknown
          seller_id: string | null
          seller_photo: string | null
          seller_reply_band: string | null
          seller_slug: string | null
          seller_tier: string | null
          seller_tier_label: string | null
          seller_verified: boolean | null
          swap_for: string | null
          tags: string[] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_campus_id_fkey"
            columns: ["campus_id"]
            isOneToOne: false
            referencedRelation: "campuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "seller_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_trust_tier_fkey"
            columns: ["seller_tier"]
            isOneToOne: false
            referencedRelation: "trust_tiers"
            referencedColumns: ["tier"]
          },
        ]
      }
    }
    Functions: {
      admin_assign_mentor: {
        Args: { p_mentor: string; p_reason?: string; p_seller: string }
        Returns: undefined
      }
      admin_moderate_listing: {
        Args: {
          p_action: string
          p_category?: string
          p_listing: string
          p_reason?: string
        }
        Returns: undefined
      }
      admin_resolve_report: {
        Args: {
          p_action: string
          p_days?: number
          p_note?: string
          p_report: string
        }
        Returns: undefined
      }
      admin_review_seller: {
        Args: { p_decision: string; p_reason?: string; p_seller: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          p_reason?: string
          p_role: Database["public"]["Enums"]["user_role"]
          p_user: string
        }
        Returns: undefined
      }
      admin_set_verified: {
        Args: { p_reason?: string; p_seller: string; p_verified: boolean }
        Returns: undefined
      }
      admin_unsuspend: {
        Args: { p_reason?: string; p_user: string }
        Returns: undefined
      }
      search_listings: {
        Args: {
          p_available_only?: boolean
          p_campus?: string
          p_category?: string
          p_kind?: Database["public"]["Enums"]["listing_kind"]
          p_limit?: number
          p_max?: number
          p_min?: number
          p_mode?: string
          p_offset?: number
          p_q?: string
          p_sort?: string
        }
        Returns: {
          listing_id: string
          total_count: number
        }[]
      }
    }
    Enums: {
      availability: "available" | "sold_out" | "paused"
      contact_pref: "in_app" | "whatsapp" | "both"
      enquiry_status: "new" | "in_progress" | "completed" | "declined"
      listing_kind: "product" | "service"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      pricing_mode: "cash" | "swap" | "both"
      report_reason:
        | "spam"
        | "scam"
        | "inappropriate"
        | "unsafe"
        | "wrong_category"
        | "other"
        | "prohibited_item"
        | "harassment"
        | "fake_profile"
      report_status: "pending" | "actioned" | "dismissed"
      report_target: "listing" | "user" | "request" | "seller" | "message"
      request_status: "open" | "fulfilled" | "closed"
      seller_status: "draft" | "pending" | "approved" | "rejected" | "suspended"
      user_role: "buyer" | "seller" | "mentor" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      availability: ["available", "sold_out", "paused"],
      contact_pref: ["in_app", "whatsapp", "both"],
      enquiry_status: ["new", "in_progress", "completed", "declined"],
      listing_kind: ["product", "service"],
      payment_status: ["pending", "paid", "failed", "refunded"],
      pricing_mode: ["cash", "swap", "both"],
      report_reason: [
        "spam",
        "scam",
        "inappropriate",
        "unsafe",
        "wrong_category",
        "other",
        "prohibited_item",
        "harassment",
        "fake_profile",
      ],
      report_status: ["pending", "actioned", "dismissed"],
      report_target: ["listing", "user", "request", "seller", "message"],
      request_status: ["open", "fulfilled", "closed"],
      seller_status: ["draft", "pending", "approved", "rejected", "suspended"],
      user_role: ["buyer", "seller", "mentor", "admin"],
    },
  },
} as const
