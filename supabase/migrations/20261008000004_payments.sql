-- Stage 8: payment requests (seller asks, buyer pays) with MockPay and Paystack providers.
-- All writes happen in server code with the service role after explicit checks; users can only read their own rows.
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  seller_id uuid not null references public.seller_profiles(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  item_zar int not null check (item_zar between 1 and 100000),
  delivery_zar int not null default 0 check (delivery_zar between 0 and 5000),
  total_zar int generated always as (item_zar + delivery_zar) stored,
  note text check (char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending','paid','cancelled','failed')),
  provider text check (provider in ('mockpay','paystack')),
  reference text not null unique,
  provider_ref text,
  paid_at timestamptz,
  expires_at timestamptz not null default now() + interval '3 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payment_requests_conversation_idx on public.payment_requests (conversation_id, created_at desc);
create index payment_requests_seller_idx on public.payment_requests (seller_id);
create index payment_requests_buyer_idx on public.payment_requests (buyer_id);
create index payment_requests_listing_idx on public.payment_requests (listing_id);

alter table public.payment_requests enable row level security;
create policy payment_requests_party_read on public.payment_requests for select to authenticated
  using (buyer_id = (select auth.uid())
         or seller_id in (select s.id from public.seller_profiles s where s.user_id = (select auth.uid())));

-- Append-only provider event log (webhook idempotency and audit). No policies: service role only.
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.payment_requests(id) on delete cascade,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now(),
  unique (request_id, type)
);
alter table public.payment_events enable row level security;

alter publication supabase_realtime add table public.payment_requests;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_enquiry','new_message','status_change','completion_request','completion_confirmed','moderation','report_update','seller_review','warning','hub_booking','hub_update','payment_request','payment_received'));

insert into public.site_settings (key, value, description) values
  ('payment_provider', '{"provider": "mockpay"}', 'Which provider takes payments when the payments flag is on: mockpay (test, no real money) or paystack')
on conflict (key) do nothing;
update public.feature_flags set enabled = true, description = 'Payment requests in chat (MockPay by default; Paystack via the payment_provider setting)' where key = 'payments';
