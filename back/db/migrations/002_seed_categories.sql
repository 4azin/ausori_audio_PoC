-- =============================================================
-- 002_seed_categories.sql — 카테고리 분류 시드 (taxonomy.json 원천)
-- 원천: ai/taxonomy.json (version 2.2)
-- 정책:
--   - 이름은 taxonomy 원본 표기 그대로 저장 (Ambience, Dialogue_VO, SFX, UI 등)
--   - ID는 taxonomy 선언 순서 기반 전역 순차 번호 → sound_assets_*.jsonl 의
--     major_id / mid_id / sub_id 와 정확히 일치
--   - 재실행 멱등성을 위해 ON CONFLICT DO NOTHING
-- =============================================================

BEGIN;

-- ------------------------------------------------------------
-- category_major (6)
-- ------------------------------------------------------------
INSERT INTO category_major (id, name) VALUES
    (1, 'Ambience'),
    (2, 'Cinematic'),
    (3, 'Dialogue_VO'),
    (4, 'Foley'),
    (5, 'SFX'),
    (6, 'Music')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- category_mid (55)
-- ------------------------------------------------------------
INSERT INTO category_mid (id, major_id, name) VALUES
    -- Ambience (1)
    (1, 1, 'Nature'),
    (2, 1, 'Urban'),
    (3, 1, 'Interior'),
    (4, 1, 'Exterior'),
    (5, 1, 'Weather'),
    (6, 1, 'Machine_Room'),
    (7, 1, 'Crowd'),
    (8, 1, 'Designed'),
    -- Cinematic (2)
    (9,  2, 'Riser'),
    (10, 2, 'Hit'),
    (11, 2, 'Whoosh'),
    (12, 2, 'Drone'),
    (13, 2, 'Stinger'),
    (14, 2, 'Texture'),
    (15, 2, 'Horror'),
    (16, 2, 'Sci_Fi'),
    (17, 2, 'Tension'),
    (18, 2, 'Transition'),
    (19, 2, 'Fantasy'),
    -- Dialogue_VO (3)
    (20, 3, 'Dialogue'),
    (21, 3, 'Narration'),
    (22, 3, 'Crowd_Dialogue'),
    (23, 3, 'Announcement'),
    (24, 3, 'Synthetic'),
    -- Foley (4)
    (25, 4, 'Footsteps'),
    (26, 4, 'Cloth'),
    (27, 4, 'Door_Window'),
    (28, 4, 'Object'),
    (29, 4, 'Body'),
    (30, 4, 'Furniture'),
    (31, 4, 'Food_Drink'),
    (32, 4, 'Liquid'),
    (33, 4, 'Material_Texture'),
    (34, 4, 'Writing'),
    -- SFX (5)
    (35, 5, 'Impact'),
    (36, 5, 'Explosion'),
    (37, 5, 'Weapon'),
    (38, 5, 'Vehicle'),
    (39, 5, 'Mechanical'),
    (40, 5, 'Electrical'),
    (41, 5, 'Animal'),
    (42, 5, 'Human'),
    (43, 5, 'Fire'),
    (44, 5, 'Water'),
    (45, 5, 'UI'),
    (46, 5, 'Electronic'),
    (47, 5, 'Communication'),
    (48, 5, 'Sports'),
    (49, 5, 'Instrument'),
    (50, 5, 'Cartoon'),
    -- Music (6)
    (51, 6, 'BGM'),
    (52, 6, 'Jingle'),
    (53, 6, 'Synth_Pad'),
    (54, 6, 'Score'),
    (55, 6, 'Percussion')
ON CONFLICT (major_id, name) DO NOTHING;

-- ------------------------------------------------------------
-- category_sub (JSONL 기준 실제 사용 271개 — flat 라벨 풀)
-- sub는 mid에 종속되지 않는 전역 id. 이름 중복 허용(예: Metal/Wood/Dark 등).
-- id는 sound_assets_*.jsonl 의 sub_id와 정확히 일치.
-- ------------------------------------------------------------
INSERT INTO category_sub (id, name) VALUES
    (1, 'Forest'), (2, 'Ocean'), (3, 'River'), (4, 'Birds'), (5, 'Insects'), (6, 'Wildlife'),
    (7, 'Underwater'), (8, 'City_Traffic'), (9, 'Street'), (10, 'Market'), (11, 'Subway'), (12, 'Sirens'),
    (13, 'Airport'), (14, 'Office'), (15, 'Restaurant'), (16, 'Hospital'), (17, 'School'), (18, 'Home'),
    (19, 'Mall'), (20, 'Bar'), (21, 'Kitchen'), (22, 'Roomtone'), (23, 'Park'), (26, 'Harbor'),
    (27, 'Highway'), (28, 'Rain'), (29, 'Thunder'), (30, 'Wind'), (32, 'Hail'), (33, 'Storm'),
    (34, 'Factory'), (35, 'Engine'), (36, 'HVAC'), (37, 'Construction'), (38, 'Walla'), (39, 'Children'),
    (40, 'Sports'), (41, 'Battle'), (42, 'Cheer'), (43, 'Sci_Fi'), (44, 'Fantasy'), (45, 'Horror'),
    (46, 'Abstract'), (47, 'Short'), (48, 'Long'), (49, 'Reverse'), (50, 'Swell'), (51, 'Tension'),
    (52, 'Cinematic'), (53, 'Sub'), (54, 'Orchestral'), (55, 'Hybrid'), (56, 'Trailer'), (57, 'Bass_Drop'),
    (58, 'Fast'), (59, 'Slow'), (60, 'Flyby'), (61, 'Sweep'), (62, 'Scene_Transition'), (63, 'Dark'),
    (64, 'Bright'), (65, 'Evolving'), (66, 'Granular'), (67, 'Noise'), (68, 'Orchestra'), (69, 'Synth'),
    (70, 'Brass'), (71, 'Horror'), (72, 'Organic'), (73, 'Synthetic'), (74, 'Metallic'), (75, 'Abstract'),
    (76, 'Industrial'), (77, 'Scare'), (78, 'Creep'), (79, 'Gore'), (80, 'Creature'), (81, 'Atmosphere'),
    (82, 'Laser'), (83, 'Hologram'), (84, 'Warp'), (85, 'Energy'), (86, 'Robot'), (87, 'Build'),
    (88, 'Sustain'), (90, 'Psychological'), (91, 'Cut'), (93, 'Swipe'), (94, 'Swoosh'), (95, 'Hit'),
    (96, 'Magic'), (97, 'Sparkle'), (98, 'Enchant'), (99, 'Portal'), (100, 'Spell'), (101, 'Conversation'),
    (103, 'Whisper'), (104, 'Documentary'), (105, 'Storytelling'), (106, 'Instructional'), (107, 'Walla'), (108, 'Chatter'),
    (109, 'Murmur'), (110, 'Public_Address'), (111, 'Broadcast'), (112, 'Intercom'), (113, 'AI'), (114, 'Robot'),
    (115, 'Vocoder'), (116, 'Concrete'), (117, 'Wood'), (118, 'Gravel'), (119, 'Grass'), (120, 'Metal'),
    (121, 'Carpet'), (122, 'Tile'), (123, 'Snow'), (124, 'Mud'), (125, 'Sand'), (126, 'Jacket'),
    (127, 'Dress'), (128, 'Denim'), (129, 'Leather'), (130, 'Nylon'), (131, 'Open'), (132, 'Close'),
    (133, 'Knock'), (134, 'Creak'), (135, 'Slide'), (136, 'Cup_Glass'), (137, 'Paper'), (138, 'Plastic'),
    (139, 'Metal'), (140, 'Wood'), (141, 'Box'), (142, 'Bag'), (143, 'Key'), (144, 'Clap'),
    (145, 'Snap'), (146, 'Slap'), (147, 'Stomp'), (148, 'Fall'), (149, 'Jump'), (150, 'Chair'),
    (151, 'Drawer'), (152, 'Cabinet'), (154, 'Chew'), (155, 'Sip'), (156, 'Pour'), (157, 'Swallow'),
    (158, 'Bottle'), (159, 'Pour'), (160, 'Splash'), (161, 'Drip'), (162, 'Bubble'), (163, 'Friction'),
    (164, 'Scrape'), (165, 'Shatter'), (166, 'Crumple'), (167, 'Crack'), (168, 'Ice'), (169, 'Pen'),
    (170, 'Pencil'), (171, 'Keyboard'), (172, 'Chalk'), (173, 'Punch'), (174, 'Slam'), (175, 'Metal'),
    (176, 'Wood'), (177, 'Body'), (178, 'Thud'), (179, 'Debris'), (180, 'Small'), (181, 'Large'),
    (182, 'Distant'), (183, 'Fireworks'), (184, 'Debris'), (185, 'Pistol'), (186, 'Rifle'), (187, 'Shotgun'),
    (188, 'Automatic'), (189, 'Sword'), (190, 'Bow'), (191, 'Laser'), (192, 'Reload'), (193, 'Car'),
    (194, 'Motorcycle'), (195, 'Truck'), (196, 'Helicopter'), (197, 'Airplane'), (198, 'Boat'), (199, 'Train'),
    (200, 'Bicycle'), (201, 'Motor'), (202, 'Gear'), (203, 'Lock'), (204, 'Switch'), (205, 'Hydraulic'),
    (206, 'Engine'), (207, 'Power_Tool'), (208, 'Spark'), (209, 'Buzz'), (210, 'Zap'), (211, 'Short_Circuit'),
    (212, 'Dog'), (213, 'Cat'), (214, 'Bird'), (215, 'Horse'), (216, 'Insect'), (217, 'Monster'),
    (218, 'Breath'), (219, 'Scream'), (220, 'Laugh'), (221, 'Grunt'), (222, 'Cough'), (223, 'Cry'),
    (224, 'Campfire'), (225, 'Torch'), (226, 'Inferno'), (227, 'Match'), (228, 'Splash'), (229, 'Drip'),
    (230, 'Underwater'), (231, 'Wave'), (232, 'Click'), (233, 'Beep'), (234, 'Notification'), (235, 'Alert'),
    (236, 'Error'), (238, 'Swipe'), (239, 'Success'), (240, 'Level_Up'), (241, 'Glitch'), (242, 'Digital'),
    (243, 'Synth'), (244, 'Alarm'), (245, 'Computer'), (246, 'Ring'), (247, 'Dial_Tone'), (248, 'Static'),
    (250, 'Ball'), (251, 'Whistle'), (252, 'Bat'), (253, 'Net'), (254, 'Guitar_Hit'), (255, 'Piano_Note'),
    (256, 'Cymbal'), (257, 'Drum_Hit'), (258, 'Boing'), (259, 'Splat'), (260, 'Pop'), (261, 'Squeak'),
    (262, 'Toy'), (263, 'Cinematic'), (264, 'Lo_fi'), (265, 'Electronic'), (266, 'Orchestral'), (267, 'Acoustic'),
    (268, 'Rock'), (269, 'Jazz'), (270, 'Hip_Hop'), (271, 'Intro'), (272, 'Outro'), (273, 'Notification'),
    (274, 'Ambient'), (275, 'Dark'), (276, 'Bright'), (277, 'Orchestral'), (280, 'Acoustic'), (281, 'Electronic'),
    (282, 'World')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 시퀀스 보정 (이후 자동 채번이 충돌 없이 이어지도록)
-- ------------------------------------------------------------
SELECT setval('category_major_id_seq', (SELECT COALESCE(MAX(id), 1) FROM category_major));
SELECT setval('category_mid_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM category_mid));
SELECT setval('category_sub_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM category_sub));

COMMIT;
