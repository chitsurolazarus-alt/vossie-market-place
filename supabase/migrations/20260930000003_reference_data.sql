-- Reference data (safe to run in production)
insert into public.allowed_email_domains (domain) values ('vossie.net'), ('eduvos.com');
insert into public.allowed_emails (email, note) values
  ('chitsurolazarus@gmail.com', 'Team testing address');

insert into public.campuses (name, slug, city) values
  ('Eduvos Midrand', 'midrand', 'Midrand'),
  ('Eduvos Durban', 'durban', 'Durban');

insert into public.categories (name, slug, sort_order) values
  ('Food', 'food', 1), ('Beauty', 'beauty', 2), ('Tutoring', 'tutoring', 3),
  ('Design', 'design', 4), ('Tech', 'tech', 5), ('Fashion', 'fashion', 6),
  ('Construction', 'construction', 7), ('Trading', 'trading', 8),
  ('Events', 'events', 9), ('Other', 'other', 10);

insert into public.pickup_points (campus_id, name, description)
select c.id, p.name, p.description from public.campuses c
cross join (values
  ('Library entrance', 'Busy, well-lit and monitored. Meet just outside the main doors.'),
  ('Student centre', 'Ground-floor seating area near the student centre.'),
  ('Main gate security desk', 'Next to campus security, ideal for evening handovers.'),
  ('Cafeteria', 'Public seating in the cafeteria during open hours.')
) as p(name, description);

insert into public.feature_flags (key, enabled, description) values
  ('reviews', false, 'Post-transaction reviews'),
  ('payments', false, 'Paystack payments'),
  ('looking_for', true, 'Looking For request board');
