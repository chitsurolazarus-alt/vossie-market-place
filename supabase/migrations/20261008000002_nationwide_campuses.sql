-- Stage 6: every Eduvos campus is in the table from day one; only launched campuses are active.
alter table public.campuses add column if not exists province text;

update public.campuses set province = 'Gauteng' where slug = 'midrand';
update public.campuses set province = 'KwaZulu-Natal' where slug = 'durban';

insert into public.campuses (name, slug, city, province, active) values
  ('Eduvos Pretoria', 'pretoria', 'Pretoria', 'Gauteng', false),
  ('Eduvos Bedfordview', 'bedfordview', 'Bedfordview', 'Gauteng', false),
  ('Eduvos Vanderbijlpark', 'vanderbijlpark', 'Vanderbijlpark', 'Gauteng', false),
  ('Eduvos Potchefstroom', 'potchefstroom', 'Potchefstroom', 'North West', false),
  ('Eduvos Mbombela', 'mbombela', 'Mbombela', 'Mpumalanga', false),
  ('Eduvos East London', 'east-london', 'East London', 'Eastern Cape', false),
  ('Eduvos Nelson Mandela Bay', 'nelson-mandela-bay', 'Gqeberha', 'Eastern Cape', false),
  ('Eduvos Tyger Valley', 'tyger-valley', 'Bellville', 'Western Cape', false),
  ('Eduvos Mowbray', 'mowbray', 'Cape Town', 'Western Cape', false),
  ('Eduvos Bloemfontein', 'bloemfontein', 'Bloemfontein', 'Free State', false)
on conflict (slug) do nothing;

alter table public.campuses alter column province set not null;

insert into public.pickup_points (campus_id, name, description)
select c.id, p.name, p.description from public.campuses c
cross join (values
  ('Library entrance', 'Busy, well-lit and monitored. Meet just outside the main doors.'),
  ('Student centre', 'Ground-floor seating area near the student centre.'),
  ('Main gate security desk', 'Next to campus security, ideal for evening handovers.'),
  ('Cafeteria', 'Public seating in the cafeteria during open hours.')
) as p(name, description)
where not exists (select 1 from public.pickup_points x where x.campus_id = c.id);
