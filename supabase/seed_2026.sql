-- 2026 roster and race calendar, checked against formula1.com on 2026-10-15.
-- Sporting results are deliberately not imported: the game manager enters them.
-- Sprint qualifying times below are UTC; normal deadlines are Saturday 00:00 Europe/Rome.

insert into public.seasons(year) values (2026) on conflict (year) do nothing;

insert into public.constructors(legacy_key, canonical_name) values
  ('f1_2026_racing_bulls','Racing Bulls'),
  ('f1_2026_audi','Audi'),
  ('f1_2026_cadillac','Cadillac')
on conflict (canonical_name) do nothing;

insert into public.drivers(legacy_key, first_name, last_name) values
  ('f1_2026_antonelli','Kimi','Antonelli'),
  ('f1_2026_hadjar','Isack','Hadjar'),
  ('f1_2026_lindblad','Arvid','Lindblad'),
  ('f1_2026_colapinto','Franco','Colapinto'),
  ('f1_2026_bearman','Oliver','Bearman'),
  ('f1_2026_bortoleto','Gabriel','Bortoleto')
on conflict (legacy_key) do nothing;

insert into public.season_constructors(season_id, constructor_id, display_name)
select s.id, c.id, v.display_name
from public.seasons s
join (values
  ('Mercedes','Mercedes'), ('Ferrari','Ferrari'), ('McLaren','McLaren'),
  ('Red Bull','Red Bull Racing'), ('Racing Bulls','Racing Bulls'),
  ('Alpine F1 Team','Alpine'), ('Haas F1 Team','Haas F1 Team'),
  ('Audi','Audi'), ('Williams','Williams'),
  ('Aston Martin','Aston Martin'), ('Cadillac','Cadillac')
) as v(canonical_name,display_name) on true
join public.constructors c on c.canonical_name = v.canonical_name
where s.year = 2026 on conflict do nothing;

insert into public.season_drivers(season_id, driver_id, constructor_id, short_name)
select s.id, d.id, c.id, v.short_name
from public.seasons s
join (values
  ('russell','Mercedes','RUS'),('f1_2026_antonelli','Mercedes','ANT'),
  ('leclerc','Ferrari','LEC'),('hamilton','Ferrari','HAM'),
  ('norris','McLaren','NOR'),('piastri','McLaren','PIA'),
  ('max_verstappen','Red Bull','VER'),('f1_2026_hadjar','Red Bull','HAD'),
  ('lawson','Racing Bulls','LAW'),('f1_2026_lindblad','Racing Bulls','LIN'),
  ('gasly','Alpine F1 Team','GAS'),('f1_2026_colapinto','Alpine F1 Team','COL'),
  ('ocon','Haas F1 Team','OCO'),('f1_2026_bearman','Haas F1 Team','BEA'),
  ('hulkenberg','Audi','HUL'),('f1_2026_bortoleto','Audi','BOR'),
  ('sainz','Williams','SAI'),('albon','Williams','ALB'),
  ('alonso','Aston Martin','ALO'),('stroll','Aston Martin','STR'),
  ('perez','Cadillac','PER'),('bottas','Cadillac','BOT')
) as v(driver_key,constructor_name,short_name) on true
join public.drivers d on d.legacy_key = v.driver_key
join public.constructors c on c.canonical_name = v.constructor_name
where s.year = 2026 on conflict do nothing;

insert into public.races (
  season_id, round, name, circuit, city, country, race_date,
  has_sprint, sprint_qualifying_starts_at, lineup_deadline_at
)
select s.id, v.round, v.name, v.circuit, v.city, v.country, v.race_date,
  v.sprint_qualifying_starts_at is not null, v.sprint_qualifying_starts_at,
  coalesce(v.sprint_qualifying_starts_at,
    (v.friday_date + 1)::timestamp at time zone 'Europe/Rome')
from public.seasons s
join (values
  (1,'Australia','Albert Park Grand Prix Circuit','Melbourne','Australia',date '2026-03-08',date '2026-03-06',null::timestamptz),
  (2,'China','Shanghai International Circuit','Shanghai','China',date '2026-03-15',date '2026-03-13',timestamptz '2026-03-13 07:30:00+00'),
  (3,'Japan','Suzuka International Racing Course','Suzuka','Japan',date '2026-03-29',date '2026-03-27',null::timestamptz),
  (4,'Miami','Miami International Autodrome','Miami','United States',date '2026-05-03',date '2026-05-01',timestamptz '2026-05-01 20:30:00+00'),
  (5,'Canada','Circuit Gilles-Villeneuve','Montréal','Canada',date '2026-05-24',date '2026-05-22',timestamptz '2026-05-22 20:30:00+00'),
  (6,'Monaco','Circuit de Monaco','Monte Carlo','Monaco',date '2026-06-07',date '2026-06-05',null::timestamptz),
  (7,'Barcelona-Catalunya','Circuit de Barcelona-Catalunya','Barcelona','Spain',date '2026-06-14',date '2026-06-12',null::timestamptz),
  (8,'Austria','Red Bull Ring','Spielberg','Austria',date '2026-06-28',date '2026-06-26',null::timestamptz),
  (9,'Great Britain','Silverstone Circuit','Silverstone','United Kingdom',date '2026-07-05',date '2026-07-03',timestamptz '2026-07-03 15:30:00+00'),
  (10,'Belgium','Circuit de Spa-Francorchamps','Stavelot','Belgium',date '2026-07-19',date '2026-07-17',null::timestamptz),
  (11,'Hungary','Hungaroring','Mogyoród','Hungary',date '2026-07-26',date '2026-07-24',null::timestamptz),
  (12,'Netherlands','Circuit Zandvoort','Zandvoort','Netherlands',date '2026-08-23',date '2026-08-21',timestamptz '2026-08-21 14:30:00+00'),
  (13,'Italy','Autodromo Nazionale Monza','Monza','Italy',date '2026-09-06',date '2026-09-04',null::timestamptz),
  (14,'Spain','Circuito de Madrid','Madrid','Spain',date '2026-09-13',date '2026-09-11',null::timestamptz),
  (15,'Azerbaijan','Baku City Circuit','Baku','Azerbaijan',date '2026-09-26',date '2026-09-25',null::timestamptz),
  (16,'Bahrain Grand Prix in Malaysia','Sepang International Circuit','Sepang','Malaysia',date '2026-10-04',date '2026-10-02',null::timestamptz),
  (17,'Singapore','Marina Bay Street Circuit','Singapore','Singapore',date '2026-10-11',date '2026-10-09',timestamptz '2026-10-09 12:30:00+00'),
  (18,'United States','Circuit of The Americas','Austin','United States',date '2026-10-25',date '2026-10-23',null::timestamptz),
  (19,'Mexico','Autódromo Hermanos Rodríguez','Mexico City','Mexico',date '2026-11-01',date '2026-10-30',null::timestamptz),
  (20,'Brazil','Autódromo José Carlos Pace','São Paulo','Brazil',date '2026-11-08',date '2026-11-06',null::timestamptz),
  (21,'Las Vegas','Las Vegas Strip Circuit','Las Vegas','United States',date '2026-11-21',date '2026-11-20',null::timestamptz),
  (22,'Qatar','Lusail International Circuit','Lusail','Qatar',date '2026-11-29',date '2026-11-27',null::timestamptz),
  (23,'Abu Dhabi','Yas Marina Circuit','Abu Dhabi','United Arab Emirates',date '2026-12-06',date '2026-12-04',null::timestamptz)
) as v(round,name,circuit,city,country,race_date,friday_date,sprint_qualifying_starts_at) on true
where s.year = 2026 on conflict (season_id, round) do nothing;

insert into public.season_scoring_rules (
  season_id, gp_finish_points, sprint_finish_points, gp_grid_points, sprint_grid_points,
  gp_position_delta, sprint_position_delta, gp_fastest_lap, sprint_fastest_lap,
  driver_of_the_day, fastest_pit_stop, gp_retirement, sprint_retirement
) select id, array[25,18,15,12,10,8,6,4,2,1], array[8,7,6,5,4,3,2,1],
  array[10,6,3], array[5,3,1], 2, 1, 5, 3, 5, 5, -10, -5
from public.seasons where year = 2026 on conflict (season_id) do nothing;
