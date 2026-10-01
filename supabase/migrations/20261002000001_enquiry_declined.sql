-- Phase 4 (1/2): a new enum value must be committed before it can be used.
alter type public.enquiry_status add value if not exists 'declined';
