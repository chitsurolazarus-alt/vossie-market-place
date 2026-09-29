
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "allowed_email_domains": {
                  Row: {
                    "created_at": string,"domain": string
                  }
                  Insert: {
                    "created_at"?: string,"domain": string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string
                  }
                  Relationships: [
                    
                  ]
                },"allowed_emails": {
                  Row: {
                    "created_at": string,"email": string,"note": string | null
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"note"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"note"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"detail": Json | null,"id": number,"target_id": string | null,"target_type": string | null
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"detail"?: Json | null,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"detail"?: Json | null,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"campuses": {
                  Row: {
                    "active": boolean,"city": string | null,"created_at": string,"id": string,"name": string,"slug": string
                  }
                  Insert: {
                    "active"?: boolean,"city"?: string | null,"created_at"?: string,"id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "active"?: boolean,"city"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"categories": {
                  Row: {
                    "active": boolean,"id": string,"name": string,"slug": string,"sort_order": number
                  }
                  Insert: {
                    "active"?: boolean,"id"?: string,"name": string,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "active"?: boolean,"id"?: string,"name"?: string,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    
                  ]
                },"conversations": {
                  Row: {
                    "buyer_id": string,"created_at": string,"id": string,"listing_id": string | null,"seller_id": string
                  }
                  Insert: {
                    "buyer_id": string,"created_at"?: string,"id"?: string,"listing_id"?: string | null,"seller_id": string
                  }
                  Update: {
                    "buyer_id"?: string,"created_at"?: string,"id"?: string,"listing_id"?: string | null,"seller_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "seller_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"enquiries": {
                  Row: {
                    "conversation_id": string,"created_at": string,"id": string,"status": Database["public"]['Enums']["enquiry_status"],"updated_at": string
                  }
                  Insert: {
                    "conversation_id": string,"created_at"?: string,"id"?: string,"status"?: Database["public"]['Enums']["enquiry_status"],"updated_at"?: string
                  }
                  Update: {
                    "conversation_id"?: string,"created_at"?: string,"id"?: string,"status"?: Database["public"]['Enums']["enquiry_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enquiries_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"feature_flags": {
                  Row: {
                    "description": string | null,"enabled": boolean,"key": string
                  }
                  Insert: {
                    "description"?: string | null,"enabled"?: boolean,"key": string
                  }
                  Update: {
                    "description"?: string | null,"enabled"?: boolean,"key"?: string
                  }
                  Relationships: [
                    
                  ]
                },"featured_slots": {
                  Row: {
                    "campus_id": string,"id": string,"is_override": boolean,"position": number,"seller_id": string,"slot_date": string
                  }
                  Insert: {
                    "campus_id": string,"id"?: string,"is_override"?: boolean,"position"?: number,"seller_id": string,"slot_date": string
                  }
                  Update: {
                    "campus_id"?: string,"id"?: string,"is_override"?: boolean,"position"?: number,"seller_id"?: string,"slot_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "featured_slots_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "featured_slots_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "seller_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"follows": {
                  Row: {
                    "created_at": string,"seller_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"seller_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"seller_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "follows_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "seller_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "follows_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_images": {
                  Row: {
                    "alt": string,"created_at": string,"id": string,"listing_id": string,"path": string,"position": number
                  }
                  Insert: {
                    "alt": string,"created_at"?: string,"id"?: string,"listing_id": string,"path": string,"position"?: number
                  }
                  Update: {
                    "alt"?: string,"created_at"?: string,"id"?: string,"listing_id"?: string,"path"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_images_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_tags": {
                  Row: {
                    "listing_id": string,"tag_id": string
                  }
                  Insert: {
                    "listing_id": string,"tag_id": string
                  }
                  Update: {
                    "listing_id"?: string,"tag_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_tags_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_tags_tag_id_fkey"
      columns: ["tag_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id"]
    }
                  ]
                },"listing_views": {
                  Row: {
                    "created_at": string,"id": number,"listing_id": string,"view_date": string,"viewer_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"listing_id": string,"view_date"?: string,"viewer_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"listing_id"?: string,"view_date"?: string,"viewer_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "listing_views_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listing_views_viewer_id_fkey"
      columns: ["viewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"listings": {
                  Row: {
                    "availability": Database["public"]['Enums']["availability"],"campus_id": string,"category_id": string | null,"created_at": string,"deleted_at": string | null,"delivered_on_campus": boolean,"description": string | null,"hidden_by_moderation": boolean,"id": string,"kind": Database["public"]['Enums']["listing_kind"],"pickup_point_id": string | null,"price_is_from": boolean,"price_zar": number | null,"pricing_mode": Database["public"]['Enums']["pricing_mode"],"search": unknown,"seller_id": string,"swap_for": string | null,"title": string,"updated_at": string
                  }
                  Insert: {
                    "availability"?: Database["public"]['Enums']["availability"],"campus_id": string,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"delivered_on_campus"?: boolean,"description"?: string | null,"hidden_by_moderation"?: boolean,"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"],"pickup_point_id"?: string | null,"price_is_from"?: boolean,"price_zar"?: number | null,"pricing_mode"?: Database["public"]['Enums']["pricing_mode"],"search"?: unknown,"seller_id": string,"swap_for"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "availability"?: Database["public"]['Enums']["availability"],"campus_id"?: string,"category_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"delivered_on_campus"?: boolean,"description"?: string | null,"hidden_by_moderation"?: boolean,"id"?: string,"kind"?: Database["public"]['Enums']["listing_kind"],"pickup_point_id"?: string | null,"price_is_from"?: boolean,"price_zar"?: number | null,"pricing_mode"?: Database["public"]['Enums']["pricing_mode"],"search"?: unknown,"seller_id"?: string,"swap_for"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "listings_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_pickup_point_id_fkey"
      columns: ["pickup_point_id"]
isOneToOne: false
      referencedRelation: "pickup_points"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "listings_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "seller_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"messages": {
                  Row: {
                    "body": string,"conversation_id": string,"created_at": string,"id": string,"read_at": string | null,"sender_id": string
                  }
                  Insert: {
                    "body": string,"conversation_id": string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"read_at"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_zar": number,"buyer_id": string,"created_at": string,"enquiry_id": string | null,"id": string,"paystack_reference": string | null,"status": Database["public"]['Enums']["payment_status"]
                  }
                  Insert: {
                    "amount_zar": number,"buyer_id": string,"created_at"?: string,"enquiry_id"?: string | null,"id"?: string,"paystack_reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Update: {
                    "amount_zar"?: number,"buyer_id"?: string,"created_at"?: string,"enquiry_id"?: string | null,"id"?: string,"paystack_reference"?: string | null,"status"?: Database["public"]['Enums']["payment_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_enquiry_id_fkey"
      columns: ["enquiry_id"]
isOneToOne: false
      referencedRelation: "enquiries"
      referencedColumns: ["id"]
    }
                  ]
                },"pickup_points": {
                  Row: {
                    "approved": boolean,"campus_id": string,"created_at": string,"description": string | null,"id": string,"name": string
                  }
                  Insert: {
                    "approved"?: boolean,"campus_id": string,"created_at"?: string,"description"?: string | null,"id"?: string,"name": string
                  }
                  Update: {
                    "approved"?: boolean,"campus_id"?: string,"created_at"?: string,"description"?: string | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pickup_points_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"campus_id": string | null,"created_at": string,"deleted_at": string | null,"display_name": string | null,"id": string,"low_data_mode": boolean,"onboarding_seen": boolean,"phone": string | null,"popia_consent_at": string | null,"role": Database["public"]['Enums']["user_role"],"seller_tour_seen": boolean
                  }
                  Insert: {
                    "avatar_url"?: string | null,"campus_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"id": string,"low_data_mode"?: boolean,"onboarding_seen"?: boolean,"phone"?: string | null,"popia_consent_at"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"seller_tour_seen"?: boolean
                  }
                  Update: {
                    "avatar_url"?: string | null,"campus_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string | null,"id"?: string,"low_data_mode"?: boolean,"onboarding_seen"?: boolean,"phone"?: string | null,"popia_consent_at"?: string | null,"role"?: Database["public"]['Enums']["user_role"],"seller_tour_seen"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": string,"note": string | null,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string,"status": Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"reason": Database["public"]['Enums']["report_reason"],"reporter_id": string,"status"?: Database["public"]['Enums']["report_status"],"target_id": string,"target_type": Database["public"]['Enums']["report_target"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"note"?: string | null,"reason"?: Database["public"]['Enums']["report_reason"],"reporter_id"?: string,"status"?: Database["public"]['Enums']["report_status"],"target_id"?: string,"target_type"?: Database["public"]['Enums']["report_target"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"request_responses": {
                  Row: {
                    "created_at": string,"id": string,"listing_id": string | null,"message": string | null,"request_id": string,"seller_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string | null,"message"?: string | null,"request_id": string,"seller_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"listing_id"?: string | null,"message"?: string | null,"request_id"?: string,"seller_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_responses_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_responses_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_responses_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "seller_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"requests": {
                  Row: {
                    "budget_zar": number | null,"buyer_id": string,"campus_id": string,"category_id": string | null,"created_at": string,"deadline": string | null,"description": string | null,"id": string,"open_to_swap": boolean,"status": Database["public"]['Enums']["request_status"],"title": string
                  }
                  Insert: {
                    "budget_zar"?: number | null,"buyer_id": string,"campus_id": string,"category_id"?: string | null,"created_at"?: string,"deadline"?: string | null,"description"?: string | null,"id"?: string,"open_to_swap"?: boolean,"status"?: Database["public"]['Enums']["request_status"],"title": string
                  }
                  Update: {
                    "budget_zar"?: number | null,"buyer_id"?: string,"campus_id"?: string,"category_id"?: string | null,"created_at"?: string,"deadline"?: string | null,"description"?: string | null,"id"?: string,"open_to_swap"?: boolean,"status"?: Database["public"]['Enums']["request_status"],"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "requests_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"reviews": {
                  Row: {
                    "body": string | null,"created_at": string,"enquiry_id": string,"id": string,"reviewer_id": string,"thumbs_up": boolean
                  }
                  Insert: {
                    "body"?: string | null,"created_at"?: string,"enquiry_id": string,"id"?: string,"reviewer_id": string,"thumbs_up": boolean
                  }
                  Update: {
                    "body"?: string | null,"created_at"?: string,"enquiry_id"?: string,"id"?: string,"reviewer_id"?: string,"thumbs_up"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "reviews_enquiry_id_fkey"
      columns: ["enquiry_id"]
isOneToOne: true
      referencedRelation: "enquiries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reviews_reviewer_id_fkey"
      columns: ["reviewer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_listings": {
                  Row: {
                    "created_at": string,"listing_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"listing_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"listing_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_listings_listing_id_fkey"
      columns: ["listing_id"]
isOneToOne: false
      referencedRelation: "listings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_listings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_drafts": {
                  Row: {
                    "data": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "data"?: NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "data"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_drafts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_pickup_points": {
                  Row: {
                    "pickup_point_id": string,"seller_id": string
                  }
                  Insert: {
                    "pickup_point_id": string,"seller_id": string
                  }
                  Update: {
                    "pickup_point_id"?: string,"seller_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_pickup_points_pickup_point_id_fkey"
      columns: ["pickup_point_id"]
isOneToOne: false
      referencedRelation: "pickup_points"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_pickup_points_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "seller_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_private": {
                  Row: {
                    "seller_id": string,"whatsapp_e164": string | null
                  }
                  Insert: {
                    "seller_id": string,"whatsapp_e164"?: string | null
                  }
                  Update: {
                    "seller_id"?: string,"whatsapp_e164"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_private_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: true
      referencedRelation: "seller_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seller_profiles": {
                  Row: {
                    "approved_at": string | null,"bio": string | null,"business_name": string,"campus_id": string,"category_id": string | null,"contact_pref": Database["public"]['Enums']["contact_pref"],"created_at": string,"id": string,"mentor_id": string | null,"photo_url": string | null,"slug": string,"slug_edited": boolean,"status": Database["public"]['Enums']["seller_status"],"submitted_at": string | null,"tagline": string | null,"user_id": string,"verified": boolean
                  }
                  Insert: {
                    "approved_at"?: string | null,"bio"?: string | null,"business_name": string,"campus_id": string,"category_id"?: string | null,"contact_pref"?: Database["public"]['Enums']["contact_pref"],"created_at"?: string,"id"?: string,"mentor_id"?: string | null,"photo_url"?: string | null,"slug": string,"slug_edited"?: boolean,"status"?: Database["public"]['Enums']["seller_status"],"submitted_at"?: string | null,"tagline"?: string | null,"user_id": string,"verified"?: boolean
                  }
                  Update: {
                    "approved_at"?: string | null,"bio"?: string | null,"business_name"?: string,"campus_id"?: string,"category_id"?: string | null,"contact_pref"?: Database["public"]['Enums']["contact_pref"],"created_at"?: string,"id"?: string,"mentor_id"?: string | null,"photo_url"?: string | null,"slug"?: string,"slug_edited"?: boolean,"status"?: Database["public"]['Enums']["seller_status"],"submitted_at"?: string | null,"tagline"?: string | null,"user_id"?: string,"verified"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "seller_profiles_campus_id_fkey"
      columns: ["campus_id"]
isOneToOne: false
      referencedRelation: "campuses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_profiles_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_profiles_mentor_id_fkey"
      columns: ["mentor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seller_profiles_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "id": string,"name": string
                  }
                  Insert: {
                    "id"?: string,"name": string
                  }
                  Update: {
                    "id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "availability": "available"|"sold_out"|"paused","contact_pref": "in_app"|"whatsapp"|"both","enquiry_status": "new"|"in_progress"|"completed","listing_kind": "product"|"service","payment_status": "pending"|"paid"|"failed"|"refunded","pricing_mode": "cash"|"swap"|"both","report_reason": "spam"|"scam"|"inappropriate"|"unsafe"|"wrong_category"|"other","report_status": "pending"|"actioned"|"dismissed","report_target": "listing"|"user"|"request","request_status": "open"|"fulfilled"|"closed","seller_status": "draft"|"pending"|"approved"|"rejected"|"suspended","user_role": "buyer"|"seller"|"mentor"|"admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "availability": ["available", "sold_out", "paused"],"contact_pref": ["in_app", "whatsapp", "both"],"enquiry_status": ["new", "in_progress", "completed"],"listing_kind": ["product", "service"],"payment_status": ["pending", "paid", "failed", "refunded"],"pricing_mode": ["cash", "swap", "both"],"report_reason": ["spam", "scam", "inappropriate", "unsafe", "wrong_category", "other"],"report_status": ["pending", "actioned", "dismissed"],"report_target": ["listing", "user", "request"],"request_status": ["open", "fulfilled", "closed"],"seller_status": ["draft", "pending", "approved", "rejected", "suspended"],"user_role": ["buyer", "seller", "mentor", "admin"]
          }
        }
} as const

