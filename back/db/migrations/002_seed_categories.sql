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
-- category_sub (총 257개, 전역 순차 id)
-- ------------------------------------------------------------
INSERT INTO category_sub (id, mid_id, name) VALUES
    -- Ambience / Nature (1) — 7
    (1, 1, 'Forest'), (2, 1, 'Ocean'), (3, 1, 'River'), (4, 1, 'Birds'),
    (5, 1, 'Insects'), (6, 1, 'Wildlife'), (7, 1, 'Underwater'),
    -- Ambience / Urban (2) — 6
    (8, 2, 'City_Traffic'), (9, 2, 'Street'), (10, 2, 'Market'),
    (11, 2, 'Subway'), (12, 2, 'Sirens'), (13, 2, 'Airport'),
    -- Ambience / Interior (3) — 9
    (14, 3, 'Office'), (15, 3, 'Restaurant'), (16, 3, 'Hospital'),
    (17, 3, 'School'), (18, 3, 'Home'), (19, 3, 'Mall'),
    (20, 3, 'Bar'), (21, 3, 'Kitchen'), (22, 3, 'Roomtone'),
    -- Ambience / Exterior (4) — 5
    (23, 4, 'Park'), (24, 4, 'Parking_Lot'), (25, 4, 'Stadium'),
    (26, 4, 'Harbor'), (27, 4, 'Highway'),
    -- Ambience / Weather (5) — 6
    (28, 5, 'Rain'), (29, 5, 'Thunder'), (30, 5, 'Wind'),
    (31, 5, 'Snow'), (32, 5, 'Hail'), (33, 5, 'Storm'),
    -- Ambience / Machine_Room (6) — 4
    (34, 6, 'Factory'), (35, 6, 'Engine'), (36, 6, 'HVAC'), (37, 6, 'Construction'),
    -- Ambience / Crowd (7) — 5
    (38, 7, 'Walla'), (39, 7, 'Children'), (40, 7, 'Sports'),
    (41, 7, 'Battle'), (42, 7, 'Cheer'),
    -- Ambience / Designed (8) — 4
    (43, 8, 'Sci_Fi'), (44, 8, 'Fantasy'), (45, 8, 'Horror'), (46, 8, 'Abstract'),

    -- Cinematic / Riser (9) — 5
    (47, 9, 'Short'), (48, 9, 'Long'), (49, 9, 'Reverse'),
    (50, 9, 'Swell'), (51, 9, 'Tension'),
    -- Cinematic / Hit (10) — 6
    (52, 10, 'Cinematic'), (53, 10, 'Sub'), (54, 10, 'Orchestral'),
    (55, 10, 'Hybrid'), (56, 10, 'Trailer'), (57, 10, 'Bass_Drop'),
    -- Cinematic / Whoosh (11) — 5
    (58, 11, 'Fast'), (59, 11, 'Slow'), (60, 11, 'Flyby'),
    (61, 11, 'Sweep'), (62, 11, 'Scene_Transition'),
    -- Cinematic / Drone (12) — 5
    (63, 12, 'Dark'), (64, 12, 'Bright'), (65, 12, 'Evolving'),
    (66, 12, 'Granular'), (67, 12, 'Noise'),
    -- Cinematic / Stinger (13) — 4
    (68, 13, 'Orchestra'), (69, 13, 'Synth'), (70, 13, 'Brass'), (71, 13, 'Horror'),
    -- Cinematic / Texture (14) — 5
    (72, 14, 'Organic'), (73, 14, 'Synthetic'), (74, 14, 'Metallic'),
    (75, 14, 'Abstract'), (76, 14, 'Industrial'),
    -- Cinematic / Horror (15) — 5
    (77, 15, 'Scare'), (78, 15, 'Creep'), (79, 15, 'Gore'),
    (80, 15, 'Creature'), (81, 15, 'Atmosphere'),
    -- Cinematic / Sci_Fi (16) — 5
    (82, 16, 'Laser'), (83, 16, 'Hologram'), (84, 16, 'Warp'),
    (85, 16, 'Energy'), (86, 16, 'Robot'),
    -- Cinematic / Tension (17) — 4
    (87, 17, 'Build'), (88, 17, 'Sustain'), (89, 17, 'Release'), (90, 17, 'Psychological'),
    -- Cinematic / Transition (18) — 5
    (91, 18, 'Cut'), (92, 18, 'Fade'), (93, 18, 'Swipe'),
    (94, 18, 'Swoosh'), (95, 18, 'Hit'),
    -- Cinematic / Fantasy (19) — 5
    (96, 19, 'Magic'), (97, 19, 'Sparkle'), (98, 19, 'Enchant'),
    (99, 19, 'Portal'), (100, 19, 'Spell'),

    -- Dialogue_VO / Dialogue (20) — 3
    (101, 20, 'Conversation'), (102, 20, 'Argument'), (103, 20, 'Whisper'),
    -- Dialogue_VO / Narration (21) — 3
    (104, 21, 'Documentary'), (105, 21, 'Storytelling'), (106, 21, 'Instructional'),
    -- Dialogue_VO / Crowd_Dialogue (22) — 3
    (107, 22, 'Walla'), (108, 22, 'Chatter'), (109, 22, 'Murmur'),
    -- Dialogue_VO / Announcement (23) — 3
    (110, 23, 'Public_Address'), (111, 23, 'Broadcast'), (112, 23, 'Intercom'),
    -- Dialogue_VO / Synthetic (24) — 3
    (113, 24, 'AI'), (114, 24, 'Robot'), (115, 24, 'Vocoder'),

    -- Foley / Footsteps (25) — 10
    (116, 25, 'Concrete'), (117, 25, 'Wood'), (118, 25, 'Gravel'),
    (119, 25, 'Grass'), (120, 25, 'Metal'), (121, 25, 'Carpet'),
    (122, 25, 'Tile'), (123, 25, 'Snow'), (124, 25, 'Mud'), (125, 25, 'Sand'),
    -- Foley / Cloth (26) — 5
    (126, 26, 'Jacket'), (127, 26, 'Dress'), (128, 26, 'Denim'),
    (129, 26, 'Leather'), (130, 26, 'Nylon'),
    -- Foley / Door_Window (27) — 5
    (131, 27, 'Open'), (132, 27, 'Close'), (133, 27, 'Knock'),
    (134, 27, 'Creak'), (135, 27, 'Slide'),
    -- Foley / Object (28) — 8
    (136, 28, 'Cup_Glass'), (137, 28, 'Paper'), (138, 28, 'Plastic'),
    (139, 28, 'Metal'), (140, 28, 'Wood'), (141, 28, 'Box'),
    (142, 28, 'Bag'), (143, 28, 'Key'),
    -- Foley / Body (29) — 6
    (144, 29, 'Clap'), (145, 29, 'Snap'), (146, 29, 'Slap'),
    (147, 29, 'Stomp'), (148, 29, 'Fall'), (149, 29, 'Jump'),
    -- Foley / Furniture (30) — 4
    (150, 30, 'Chair'), (151, 30, 'Drawer'), (152, 30, 'Cabinet'), (153, 30, 'Table'),
    -- Foley / Food_Drink (31) — 5
    (154, 31, 'Chew'), (155, 31, 'Sip'), (156, 31, 'Pour'),
    (157, 31, 'Swallow'), (158, 31, 'Bottle'),
    -- Foley / Liquid (32) — 4
    (159, 32, 'Pour'), (160, 32, 'Splash'), (161, 32, 'Drip'), (162, 32, 'Bubble'),
    -- Foley / Material_Texture (33) — 6
    (163, 33, 'Friction'), (164, 33, 'Scrape'), (165, 33, 'Shatter'),
    (166, 33, 'Crumple'), (167, 33, 'Crack'), (168, 33, 'Ice'),
    -- Foley / Writing (34) — 4
    (169, 34, 'Pen'), (170, 34, 'Pencil'), (171, 34, 'Keyboard'), (172, 34, 'Chalk'),

    -- SFX / Impact (35) — 7
    (173, 35, 'Punch'), (174, 35, 'Slam'), (175, 35, 'Metal'),
    (176, 35, 'Wood'), (177, 35, 'Body'), (178, 35, 'Thud'), (179, 35, 'Debris'),
    -- SFX / Explosion (36) — 5
    (180, 36, 'Small'), (181, 36, 'Large'), (182, 36, 'Distant'),
    (183, 36, 'Fireworks'), (184, 36, 'Debris'),
    -- SFX / Weapon (37) — 8
    (185, 37, 'Pistol'), (186, 37, 'Rifle'), (187, 37, 'Shotgun'),
    (188, 37, 'Automatic'), (189, 37, 'Sword'), (190, 37, 'Bow'),
    (191, 37, 'Laser'), (192, 37, 'Reload'),
    -- SFX / Vehicle (38) — 8
    (193, 38, 'Car'), (194, 38, 'Motorcycle'), (195, 38, 'Truck'),
    (196, 38, 'Helicopter'), (197, 38, 'Airplane'), (198, 38, 'Boat'),
    (199, 38, 'Train'), (200, 38, 'Bicycle'),
    -- SFX / Mechanical (39) — 7
    (201, 39, 'Motor'), (202, 39, 'Gear'), (203, 39, 'Lock'),
    (204, 39, 'Switch'), (205, 39, 'Hydraulic'), (206, 39, 'Engine'),
    (207, 39, 'Power_Tool'),
    -- SFX / Electrical (40) — 4
    (208, 40, 'Spark'), (209, 40, 'Buzz'), (210, 40, 'Zap'), (211, 40, 'Short_Circuit'),
    -- SFX / Animal (41) — 6
    (212, 41, 'Dog'), (213, 41, 'Cat'), (214, 41, 'Bird'),
    (215, 41, 'Horse'), (216, 41, 'Insect'), (217, 41, 'Monster'),
    -- SFX / Human (42) — 6
    (218, 42, 'Breath'), (219, 42, 'Scream'), (220, 42, 'Laugh'),
    (221, 42, 'Grunt'), (222, 42, 'Cough'), (223, 42, 'Cry'),
    -- SFX / Fire (43) — 4
    (224, 43, 'Campfire'), (225, 43, 'Torch'), (226, 43, 'Inferno'), (227, 43, 'Match'),
    -- SFX / Water (44) — 4
    (228, 44, 'Splash'), (229, 44, 'Drip'), (230, 44, 'Underwater'), (231, 44, 'Wave'),
    -- SFX / UI (45) — 9
    (232, 45, 'Click'), (233, 45, 'Beep'), (234, 45, 'Notification'),
    (235, 45, 'Alert'), (236, 45, 'Error'), (237, 45, 'Hover'),
    (238, 45, 'Swipe'), (239, 45, 'Success'), (240, 45, 'Level_Up'),
    -- SFX / Electronic (46) — 5
    (241, 46, 'Glitch'), (242, 46, 'Digital'), (243, 46, 'Synth'),
    (244, 46, 'Alarm'), (245, 46, 'Computer'),
    -- SFX / Communication (47) — 4
    (246, 47, 'Ring'), (247, 47, 'Dial_Tone'), (248, 47, 'Static'), (249, 47, 'Feedback'),
    -- SFX / Sports (48) — 4
    (250, 48, 'Ball'), (251, 48, 'Whistle'), (252, 48, 'Bat'), (253, 48, 'Net'),
    -- SFX / Instrument (49) — 4
    (254, 49, 'Guitar_Hit'), (255, 49, 'Piano_Note'), (256, 49, 'Cymbal'), (257, 49, 'Drum_Hit'),
    -- SFX / Cartoon (50) — 5
    (258, 50, 'Boing'), (259, 50, 'Splat'), (260, 50, 'Pop'),
    (261, 50, 'Squeak'), (262, 50, 'Toy'),

    -- Music / BGM (51) — 8
    (263, 51, 'Cinematic'), (264, 51, 'Lo_fi'), (265, 51, 'Electronic'),
    (266, 51, 'Orchestral'), (267, 51, 'Acoustic'), (268, 51, 'Rock'),
    (269, 51, 'Jazz'), (270, 51, 'Hip_Hop'),
    -- Music / Jingle (52) — 3
    (271, 52, 'Intro'), (272, 52, 'Outro'), (273, 52, 'Notification'),
    -- Music / Synth_Pad (53) — 3
    (274, 53, 'Ambient'), (275, 53, 'Dark'), (276, 53, 'Bright'),
    -- Music / Score (54) — 3
    (277, 54, 'Orchestral'), (278, 54, 'Electronic'), (279, 54, 'Hybrid'),
    -- Music / Percussion (55) — 3
    (280, 55, 'Acoustic'), (281, 55, 'Electronic'), (282, 55, 'World')
ON CONFLICT (mid_id, name) DO NOTHING;

-- ------------------------------------------------------------
-- 시퀀스 보정 (이후 자동 채번이 충돌 없이 이어지도록)
-- ------------------------------------------------------------
SELECT setval('category_major_id_seq', (SELECT COALESCE(MAX(id), 1) FROM category_major));
SELECT setval('category_mid_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM category_mid));
SELECT setval('category_sub_id_seq',   (SELECT COALESCE(MAX(id), 1) FROM category_sub));

COMMIT;
