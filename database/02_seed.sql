-- =====================================================================
-- 02_seed.sql  -  Sample data (illustrative network inspired by BMTC, not official data)
-- Run after 01_schema.sql. Safe to run again: ON CONFLICT / NOT EXISTS guards.
-- 15 stops, 5 routes, 20 route_stops, 4 buses, 7 trips, 28 trip_stop_times, 10 delay reports
-- =====================================================================

INSERT INTO stops(stop_id,stop_code,stop_name,area,latitude,longitude) VALUES
(1,'BLR001','Majestic','Gandhinagar',12.9767,77.5713),
(2,'BLR002','Mantri Square','Malleshwaram',13.0108,77.5700),
(3,'BLR003','Yeshwanthpur','Yeshwanthpur',13.0285,77.5407),
(4,'BLR004','Shivajinagar','Shivajinagar',12.9857,77.6057),
(5,'BLR005','KR Market','Chickpete',12.9634,77.5770),
(6,'BLR006','Lalbagh West Gate','Lalbagh',12.9507,77.5848),
(7,'BLR007','Jayanagar 4th Block','Jayanagar',12.9250,77.5838),
(8,'BLR008','BTM Layout','BTM Layout',12.9166,77.6101),
(9,'BLR009','Koramangala','Koramangala',12.9352,77.6245),
(10,'BLR010','Indiranagar','Indiranagar',12.9784,77.6408),
(11,'BLR011','Domlur','Domlur',12.9609,77.6387),
(12,'BLR012','Hebbal','Hebbal',13.0358,77.5970),
(13,'BLR013','Banashankari','Banashankari',12.9255,77.5468),
(14,'BLR014','Electronic City Phase 1','Electronic City',12.8452,77.6602),
(15,'BLR015','Marathahalli','Marathahalli',12.9591,77.6974)
ON CONFLICT(stop_id) DO NOTHING;
INSERT INTO routes(route_id,route_code,route_name) VALUES
(1,'R-A','North-West Connector'),(2,'R-B','Central-South Connector'),(3,'R-C','Central-East Connector'),(4,'R-D','South-East Connector'),(5,'R-E','Central-North Connector')
ON CONFLICT(route_id) DO NOTHING;
INSERT INTO route_stops(route_id,stop_id,stop_sequence) VALUES
(1,1,1),(1,2,2),(1,3,3),
(2,1,1),(2,5,2),(2,6,3),(2,7,4),(2,13,5),
(3,1,1),(3,4,2),(3,10,3),(3,11,4),
(4,7,1),(4,8,2),(4,9,3),(4,11,4),(4,15,5),
(5,4,1),(5,12,2),(5,3,3)
ON CONFLICT DO NOTHING;
INSERT INTO buses(bus_id,registration_no,capacity,status) VALUES
(1,'KA-01-SAMPLE-001',45,'ACTIVE'),(2,'KA-01-SAMPLE-002',45,'ACTIVE'),(3,'KA-01-SAMPLE-003',35,'ACTIVE'),(4,'KA-01-SAMPLE-004',45,'ACTIVE')
ON CONFLICT(bus_id) DO NOTHING;
INSERT INTO trips(trip_id,route_id,bus_id,service_date,planned_start,trip_status) VALUES
(1,1,1,CURRENT_DATE,'08:00','COMPLETED'),(2,2,2,CURRENT_DATE,'08:15','COMPLETED'),(3,3,3,CURRENT_DATE,'08:30','COMPLETED'),(4,4,4,CURRENT_DATE,'09:00','COMPLETED'),(5,5,1,CURRENT_DATE,'09:15','COMPLETED'),(6,2,2,CURRENT_DATE,'17:00','SCHEDULED'),(7,3,3,CURRENT_DATE,'17:15','SCHEDULED')
ON CONFLICT(trip_id) DO NOTHING;
INSERT INTO trip_stop_times(trip_id,stop_sequence,stop_id,scheduled_arrival,actual_arrival) VALUES
(1,1,1,CURRENT_DATE+'08:00'::time,CURRENT_DATE+'08:02'::time),(1,2,2,CURRENT_DATE+'08:12'::time,CURRENT_DATE+'08:18'::time),(1,3,3,CURRENT_DATE+'08:25'::time,CURRENT_DATE+'08:34'::time),
(2,1,1,CURRENT_DATE+'08:15'::time,CURRENT_DATE+'08:20'::time),(2,2,5,CURRENT_DATE+'08:25'::time,CURRENT_DATE+'08:34'::time),(2,3,6,CURRENT_DATE+'08:35'::time,CURRENT_DATE+'08:47'::time),(2,4,7,CURRENT_DATE+'08:50'::time,CURRENT_DATE+'09:05'::time),(2,5,13,CURRENT_DATE+'09:00'::time,CURRENT_DATE+'09:16'::time),
(3,1,1,CURRENT_DATE+'08:30'::time,CURRENT_DATE+'08:31'::time),(3,2,4,CURRENT_DATE+'08:40'::time,CURRENT_DATE+'08:45'::time),(3,3,10,CURRENT_DATE+'08:55'::time,CURRENT_DATE+'09:03'::time),(3,4,11,CURRENT_DATE+'09:05'::time,CURRENT_DATE+'09:15'::time),
(4,1,7,CURRENT_DATE+'09:00'::time,CURRENT_DATE+'09:04'::time),(4,2,8,CURRENT_DATE+'09:10'::time,CURRENT_DATE+'09:18'::time),(4,3,9,CURRENT_DATE+'09:20'::time,CURRENT_DATE+'09:30'::time),(4,4,11,CURRENT_DATE+'09:35'::time,CURRENT_DATE+'09:48'::time),(4,5,15,CURRENT_DATE+'09:50'::time,CURRENT_DATE+'10:08'::time),
(5,1,4,CURRENT_DATE+'09:15'::time,CURRENT_DATE+'09:16'::time),(5,2,12,CURRENT_DATE+'09:28'::time,CURRENT_DATE+'09:35'::time),(5,3,3,CURRENT_DATE+'09:42'::time,CURRENT_DATE+'09:53'::time),
(6,1,1,CURRENT_DATE+'17:00'::time,NULL),(6,2,5,CURRENT_DATE+'17:10'::time,NULL),(6,3,6,CURRENT_DATE+'17:20'::time,NULL),(6,4,7,CURRENT_DATE+'17:35'::time,NULL),
(7,1,1,CURRENT_DATE+'17:15'::time,NULL),(7,2,4,CURRENT_DATE+'17:25'::time,NULL),(7,3,10,CURRENT_DATE+'17:40'::time,NULL),(7,4,11,CURRENT_DATE+'17:50'::time,NULL)
ON CONFLICT DO NOTHING;
-- Insert sample reports only once (they have no fixed ID, so ON CONFLICT cannot catch repeats).
INSERT INTO delay_reports(trip_id,stop_id,delay_minutes,cause,observed_at)
SELECT * FROM (VALUES
(1,2,6,'Traffic congestion',NOW()-INTERVAL '3 days'),(1,3,9,'Traffic congestion',NOW()-INTERVAL '3 days'),
(2,5,9,'High passenger volume',NOW()-INTERVAL '2 days'),(2,6,12,'Traffic congestion',NOW()-INTERVAL '2 days'),(2,7,15,'Traffic congestion',NOW()-INTERVAL '2 days'),
(3,10,8,'High passenger volume',NOW()-INTERVAL '1 day'),(3,11,10,'Traffic congestion',NOW()-INTERVAL '1 day'),
(4,9,10,'Traffic congestion',NOW()-INTERVAL '1 day'),(4,15,18,'Vehicle issue',NOW()-INTERVAL '1 day'),(5,12,7,'Unknown',NOW()-INTERVAL '12 hours')
) AS v(trip_id,stop_id,delay_minutes,cause,observed_at)
WHERE NOT EXISTS (SELECT 1 FROM delay_reports);

-- Seed rows above use explicit IDs. Move each identity counter past them so that
-- later INSERTs without an ID (from the app or the admin page) do not collide.
SELECT setval(pg_get_serial_sequence('stops','stop_id'),   (SELECT MAX(stop_id)  FROM stops));
SELECT setval(pg_get_serial_sequence('routes','route_id'), (SELECT MAX(route_id) FROM routes));
SELECT setval(pg_get_serial_sequence('buses','bus_id'),    (SELECT MAX(bus_id)   FROM buses));
SELECT setval(pg_get_serial_sequence('trips','trip_id'),   (SELECT MAX(trip_id)  FROM trips));
