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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      conversion_messages: {
        Row: {
          created_at: string
          id: string
          input: string
          outputs: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input: string
          outputs?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input?: string
          outputs?: Json
          user_id?: string
        }
        Relationships: []
      }
      conversion_thread_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "conversion_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_threads: {
        Row: {
          context_dump: string | null
          created_at: string | null
          extracted: Json | null
          id: string
          job_description: string
          reminder_at: string | null
          sent_proposal: string
          stage: number
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_dump?: string | null
          created_at?: string | null
          extracted?: Json | null
          id?: string
          job_description?: string
          reminder_at?: string | null
          sent_proposal?: string
          stage?: number
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_dump?: string | null
          created_at?: string | null
          extracted?: Json | null
          id?: string
          job_description?: string
          reminder_at?: string | null
          sent_proposal?: string
          stage?: number
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      custom_hooks: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_strategies: {
        Row: {
          content: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_portfolios: {
        Row: {
          created_at: string
          data: Json
          id: string
          is_published: boolean
          job_excerpt: string | null
          niche: string | null
          slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          is_published?: boolean
          job_excerpt?: string | null
          niche?: string | null
          slug: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          is_published?: boolean
          job_excerpt?: string | null
          niche?: string | null
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_templates: {
        Row: {
          category: string
          created_at: string | null
          cta_style: string
          email_content: string
          hook_style: string
          id: string
          insight_approach: string
          name: string
          structure_analysis: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          cta_style?: string
          email_content: string
          hook_style?: string
          id?: string
          insight_approach?: string
          name: string
          structure_analysis?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          cta_style?: string
          email_content?: string
          hook_style?: string
          id?: string
          insight_approach?: string
          name?: string
          structure_analysis?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          fingerprint: string | null
          id: string
          path: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          path: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          id?: string
          path?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      portfolio_items: {
        Row: {
          created_at: string
          description: string
          id: string
          is_favorite: boolean
          is_primary: boolean
          niche: string | null
          niche_tags: string[]
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_favorite?: boolean
          is_primary?: boolean
          niche?: string | null
          niche_tags?: string[]
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_favorite?: boolean
          is_primary?: boolean
          niche?: string | null
          niche_tags?: string[]
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolio_samples: {
        Row: {
          category: string
          created_at: string | null
          id: string
          job_excerpt: string
          samples: Json
          slug: string
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          job_excerpt?: string
          samples: Json
          slug: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          job_excerpt?: string
          samples?: Json
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profile_images: {
        Row: {
          created_at: string
          id: string
          label: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          brands_worked: string[]
          created_at: string
          credentials: Json
          default_length: string
          default_plan: boolean
          drive_link: string | null
          email: string | null
          id: string
          my_story: string | null
          name: string | null
          niches: string[] | null
          phone: string | null
          skills: string[]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          brands_worked?: string[]
          created_at?: string
          credentials?: Json
          default_length?: string
          default_plan?: boolean
          drive_link?: string | null
          email?: string | null
          id: string
          my_story?: string | null
          name?: string | null
          niches?: string[] | null
          phone?: string | null
          skills?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          brands_worked?: string[]
          created_at?: string
          credentials?: Json
          default_length?: string
          default_plan?: boolean
          drive_link?: string | null
          email?: string | null
          id?: string
          my_story?: string | null
          name?: string | null
          niches?: string[] | null
          phone?: string | null
          skills?: string[]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      proposal_drafts: {
        Row: {
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_memory: {
        Row: {
          client_type: string | null
          created_at: string | null
          cta_id: string | null
          cta_line: string | null
          detected_niche: string | null
          hook_id: string | null
          id: string
          job_excerpt: string | null
          opening_line: string | null
          outcome: string | null
          outcome_at: string | null
          outcome_note: string | null
          overall_confidence: number | null
          platform: string | null
          primary_strategy: string | null
          required_human_review: boolean | null
          strategy_id: string | null
          user_id: string
        }
        Insert: {
          client_type?: string | null
          created_at?: string | null
          cta_id?: string | null
          cta_line?: string | null
          detected_niche?: string | null
          hook_id?: string | null
          id?: string
          job_excerpt?: string | null
          opening_line?: string | null
          outcome?: string | null
          outcome_at?: string | null
          outcome_note?: string | null
          overall_confidence?: number | null
          platform?: string | null
          primary_strategy?: string | null
          required_human_review?: boolean | null
          strategy_id?: string | null
          user_id: string
        }
        Update: {
          client_type?: string | null
          created_at?: string | null
          cta_id?: string | null
          cta_line?: string | null
          detected_niche?: string | null
          hook_id?: string | null
          id?: string
          job_excerpt?: string | null
          opening_line?: string | null
          outcome?: string | null
          outcome_at?: string | null
          outcome_note?: string | null
          overall_confidence?: number | null
          platform?: string | null
          primary_strategy?: string | null
          required_human_review?: boolean | null
          strategy_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      proposal_snippets: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposal_structures: {
        Row: {
          blocks: string[]
          created_at: string
          fingerprint: string
          golden_key_pattern: string | null
          id: string
          occurrences: number
          prompted_at_occurrence: number
          saved_as_template: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          blocks?: string[]
          created_at?: string
          fingerprint: string
          golden_key_pattern?: string | null
          id?: string
          occurrences?: number
          prompted_at_occurrence?: number
          saved_as_template?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          blocks?: string[]
          created_at?: string
          fingerprint?: string
          golden_key_pattern?: string | null
          id?: string
          occurrences?: number
          prompted_at_occurrence?: number
          saved_as_template?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          budget: string | null
          client_responded: boolean | null
          content: string
          converted: boolean
          created_at: string
          cta: string | null
          explanation: Json | null
          got_reply: boolean
          hook: string | null
          id: string
          include_plan: boolean
          job_analysis: Json | null
          job_description: string
          length: string
          milestones: Json | null
          portfolio_ids: string[]
          read_by_client: boolean
          responded_at: string | null
          strategy: string | null
          submitted: boolean
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget?: string | null
          client_responded?: boolean | null
          content?: string
          converted?: boolean
          created_at?: string
          cta?: string | null
          explanation?: Json | null
          got_reply?: boolean
          hook?: string | null
          id?: string
          include_plan?: boolean
          job_analysis?: Json | null
          job_description?: string
          length?: string
          milestones?: Json | null
          portfolio_ids?: string[]
          read_by_client?: boolean
          responded_at?: string | null
          strategy?: string | null
          submitted?: boolean
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget?: string | null
          client_responded?: boolean | null
          content?: string
          converted?: boolean
          created_at?: string
          cta?: string | null
          explanation?: Json | null
          got_reply?: boolean
          hook?: string | null
          id?: string
          include_plan?: boolean
          job_analysis?: Json | null
          job_description?: string
          length?: string
          milestones?: Json | null
          portfolio_ids?: string[]
          read_by_client?: boolean
          responded_at?: string | null
          strategy?: string | null
          submitted?: boolean
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      red_flag_words: {
        Row: {
          created_at: string | null
          id: string
          phrase: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          phrase: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          phrase?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          ref_id: string | null
          snapshot: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          ref_id?: string | null
          snapshot: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          ref_id?: string | null
          snapshot?: Json
          user_id?: string
        }
        Relationships: []
      }
      scout_outreach: {
        Row: {
          converted: boolean
          created_at: string | null
          dev_prompt_title: string | null
          email_body: string | null
          got_reply: boolean
          hook_rationale: string | null
          id: string
          job_description: string
          job_excerpt: string
          job_type: string | null
          read_by_client: boolean
          strategy_note: string | null
          subject_line: string | null
          submitted: boolean
          user_id: string | null
        }
        Insert: {
          converted?: boolean
          created_at?: string | null
          dev_prompt_title?: string | null
          email_body?: string | null
          got_reply?: boolean
          hook_rationale?: string | null
          id?: string
          job_description?: string
          job_excerpt?: string
          job_type?: string | null
          read_by_client?: boolean
          strategy_note?: string | null
          subject_line?: string | null
          submitted?: boolean
          user_id?: string | null
        }
        Update: {
          converted?: boolean
          created_at?: string | null
          dev_prompt_title?: string | null
          email_body?: string | null
          got_reply?: boolean
          hook_rationale?: string | null
          id?: string
          job_description?: string
          job_excerpt?: string
          job_type?: string | null
          read_by_client?: boolean
          strategy_note?: string | null
          subject_line?: string | null
          submitted?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      strategies: {
        Row: {
          created_at: string | null
          doc: Json
          id: string
          slug: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          doc: Json
          id?: string
          slug: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          doc?: Json
          id?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sub_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          brands_worked: string[] | null
          created_at: string | null
          credentials: Json | null
          drive_link: string | null
          email: string | null
          id: string
          label: string
          my_story: string | null
          name: string | null
          niche: string | null
          phone: string | null
          skills: string[] | null
          updated_at: string | null
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          brands_worked?: string[] | null
          created_at?: string | null
          credentials?: Json | null
          drive_link?: string | null
          email?: string | null
          id?: string
          label?: string
          my_story?: string | null
          name?: string | null
          niche?: string | null
          phone?: string | null
          skills?: string[] | null
          updated_at?: string | null
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          brands_worked?: string[] | null
          created_at?: string | null
          credentials?: Json | null
          drive_link?: string | null
          email?: string | null
          id?: string
          label?: string
          my_story?: string | null
          name?: string | null
          niche?: string | null
          phone?: string | null
          skills?: string[] | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      user_access: {
        Row: {
          user_id: string
          verified_at: string | null
        }
        Insert: {
          user_id: string
          verified_at?: string | null
        }
        Update: {
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      run_admin_sql: { Args: { sql: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
