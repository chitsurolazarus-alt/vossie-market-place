-- Phase 5 (1/3): new enum values must be committed before use.
-- UI reason labels: scam = "Scam or fraud", prohibited_item, inappropriate = "Offensive content", harassment,
-- fake_profile, wrong_category = "Wrong category or spam", other.
alter type public.report_reason add value if not exists 'prohibited_item';
alter type public.report_reason add value if not exists 'harassment';
alter type public.report_reason add value if not exists 'fake_profile';
alter type public.report_target add value if not exists 'seller';
alter type public.report_target add value if not exists 'message';
