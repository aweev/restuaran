-- ============================================================================
-- Restaurant POS — development seed
--
-- Idempotent: re-running resets demo data to a known state.
--   psql "$DATABASE_URL" -f db/seed.sql
--
-- Every seeded password is: pos1234
-- (bcrypt hash below, cost 10 — rotate for anything real.)
--
-- Venue: "The Copper Fig" — 8 tables across Main / Patio / Bar, mid-size
-- modern European, open for dinner service.
-- ============================================================================

\set ON_ERROR_STOP on

TRUNCATE TABLE
  "AssignedOrder", "KitchenStaffAssignment", "PreparationTime",
  "LoyaltyRedemption", "LoyaltyActivity", "LoyaltyReward", "LoyaltyCustomer",
  "Feedback", "DeliveryInfo", "Payment", "ModifierSelection", "OrderItem", "Order",
  "MenuItemModifierOption", "MenuItemModifier", "MenuItem",
  "WaitlistEntry", "Reservation",
  "Ingredient", "Shift", "Table", "Customer", "PasswordResetToken", "AuditLog", "User"
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- Staff — one per persona so every role-based view has real data
-- ---------------------------------------------------------------------------
INSERT INTO "User"
  (id, name, email, password, role, phone, "hireDate", "isActive", "customPermissions")
VALUES
  ('user-owner',  'Nadia Haddad',   'owner@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'admin',
   '+1 555 0100', NOW() - INTERVAL '4 years', TRUE, '{}'),
  ('user-mgr',    'Marcus Oyelaran','manager@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'manager',
   '+1 555 0101', NOW() - INTERVAL '2 years', TRUE, '{}'),
  ('user-host',   'Priya Raman',    'host@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'host',
   '+1 555 0102', NOW() - INTERVAL '18 months', TRUE, '{}'),
  ('user-serve1', 'Tomas Lindqvist','waiter@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'waiter',
   '+1 555 0103', NOW() - INTERVAL '14 months', TRUE, '{}'),
  ('user-serve2', 'Amara Boateng',  'waiter2@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'waiter',
   '+1 555 0104', NOW() - INTERVAL '9 months', TRUE, '{}'),
  ('user-bar',    'Elena Marchetti', 'bartender@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'bartender',
   '+1 555 0105', NOW() - INTERVAL '11 months', TRUE, '{}'),
  ('user-cash',   'Jonas Berg',     'cashier@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'cashier',
   '+1 555 0106', NOW() - INTERVAL '6 months', TRUE, '{}'),
  ('user-kitchen', 'Chef Rosa Alvarez','kitchen@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'kitchen',
   '+1 555 0107', NOW() - INTERVAL '3 years', TRUE, '{}'),
  ('user-kitchen2','Sam Okafor',    'kitchen2@copperfig.test',
   '$2b$10$8AHP5bIW0ZPRZnN6wpf21e41LYhRJ95XgZ2HWL0IbquwcEiHXPEje', 'kitchen',
   '+1 555 0108', NOW() - INTERVAL '1 year', TRUE, '{}');

-- Staff on the floor right now (drives the "on shift" indicators).
INSERT INTO "Shift" ("userId", "startTime", "endTime", "breakMins", notes) VALUES
  ('user-mgr',     NOW() - INTERVAL '5 hours', NULL, 30, 'Floor lead'),
  ('user-host',    NOW() - INTERVAL '4 hours', NULL, 15, 'Host stand'),
  ('user-serve1',  NOW() - INTERVAL '4 hours', NULL, 30, 'Section A + Patio'),
  ('user-serve2',  NOW() - INTERVAL '4 hours', NULL, 30, 'Section B'),
  ('user-bar',     NOW() - INTERVAL '5 hours', NULL, 20, 'Bar'),
  ('user-cash',    NOW() - INTERVAL '4 hours', NULL, 30, 'Register 1'),
  ('user-kitchen', NOW() - INTERVAL '6 hours', NULL, 45, 'Hot line'),
  ('user-kitchen2',NOW() - INTERVAL '6 hours', NULL, 45, 'Garde manger / pastry');

-- ---------------------------------------------------------------------------
-- Floor plan — geometry laid out on a 12 x 8 grid
-- ---------------------------------------------------------------------------
INSERT INTO "Table"
  (id, number, capacity, status, "customerName", "customerCount", "startTime",
   "serverName", "serverId", "positionX", "positionY", shape, section)
VALUES
  ('table-t1', 'T1', 2, 'occupied', 'Walk-in',          2, NOW() - INTERVAL '48 minutes', 'Tomas Lindqvist','user-serve1', 1, 1, 'round',  'main'),
  ('table-t2', 'T2', 4, 'occupied', 'Okafor',           4, NOW() - INTERVAL '26 minutes', 'Tomas Lindqvist','user-serve1', 3, 1, 'square', 'main'),
  ('table-t3', 'T3', 4, 'dirty',    NULL,              NULL, NULL,                          NULL,              NULL,        5, 1, 'square', 'main'),
  ('table-t4', 'T4', 6, 'occupied', 'Nakamura',         5, NOW() - INTERVAL '71 minutes', 'Amara Boateng',  'user-serve2', 7, 1, 'rectangle','main'),
  ('table-t5', 'T5', 2, 'available',NULL,              NULL, NULL,                          NULL,              NULL,        1, 3, 'round',  'main'),
  ('table-t6', 'T6', 4, 'reserved', 'Delgado',          3, NULL,                           'Priya Raman',    'user-host',   3, 3, 'square', 'main'),
  ('table-p1', 'P1', 4, 'occupied', 'Whitfield',        4, NOW() - INTERVAL '12 minutes', 'Tomas Lindqvist','user-serve1', 1, 5, 'round',  'patio'),
  ('table-p2', 'P2', 2, 'available',NULL,              NULL, NULL,                          NULL,              NULL,        4, 5, 'round',  'patio'),
  ('table-b1', 'B1', 2, 'occupied', 'Ferreira',         2, NOW() - INTERVAL '9 minutes',  'Elena Marchetti','user-bar',    8, 3, 'round',  'bar'),
  ('table-b2', 'B2', 2, 'available',NULL,              NULL, NULL,                          NULL,              NULL,        10,3, 'round',  'bar');
-- ---------------------------------------------------------------------------
-- Menu — descriptions written to sell; prep times are promises the KDS escalates on
-- ---------------------------------------------------------------------------
INSERT INTO "MenuItem"
  (id, title, description, price, cost, category, type, available, popular,
   allergens, calories, "preparationMinutes", "spiceLevel", tags, "sortOrder", "isChefPick")
VALUES
  -- Starters
  ('mi-01','Sourdough & Cultured Butter','House levain, brown butter, Maldon, aged balsamic.',9.00,1.60,'breakfast','Veg',TRUE,TRUE,ARRAY['gluten','dairy'],340,4,0,ARRAY['vegetarian'],1,FALSE),
  ('mi-02','Whipped Ricotta & Honey','Barrel-aged ricotta, hot honey, thyme, sourdough crumb.',12.00,3.10,'breakfast','Veg',TRUE,FALSE,ARRAY['gluten','dairy'],410,6,0,ARRAY['vegetarian','gluten_free_option'],2,FALSE),
  ('mi-03','Charred Octopus','Smoked paprika potato, confit garlic, salsa verde, lemon.',18.00,7.40,'soups','Non Veg',TRUE,TRUE,ARRAY['seafood','molluscs'],320,12,1,ARRAY['gluten_free_option','chef_pick'],3,TRUE),
  ('mi-04','White Bean & Sage Soup','Cannellini, brown butter, crisp sage, grana.',10.00,2.20,'soups','Veg',TRUE,FALSE,ARRAY['dairy'],280,8,0,ARRAY['vegetarian','gluten_free_option'],4,FALSE),
  -- Mains
  ('mi-05','Truffle Tagliatelle','Hand-rolled egg pasta, black truffle, aged parmesan, brown butter.',26.00,8.90,'pasta','Veg',TRUE,TRUE,ARRAY['gluten','egg','dairy'],720,14,0,ARRAY['vegetarian','chef_pick'],5,TRUE),
  ('mi-06','Spicy Rigatoni','Calabrian chilli, San Marzano, vodka, smoked scamorza.',21.00,6.10,'pasta','Veg',TRUE,FALSE,ARRAY['gluten','dairy','spicy'],690,12,3,ARRAY['vegetarian','spicy'],6,FALSE),
  ('mi-07','Duck Confit','Slow-cooked leg, cherry gastrique, potato pavé, watercress.',34.00,14.20,'main','Non Veg',TRUE,TRUE,ARRAY[],640,22,1,ARRAY['chef_pick'],7,TRUE),
  ('mi-08','Herb-Crusted Rack of Lamb','Rostock, salsa verde, crushed potato, mint jus.',38.00,16.50,'main','Non Veg',TRUE,TRUE,ARRAY[],580,25,0,ARRAY['chef_pick'],8,TRUE),
  ('mi-09','Braised Short Rib','Red wine reduction, celeriac purée, glazed carrots.',36.00,15.80,'main','Non Veg',TRUE,FALSE,ARRAY[],700,26,0,ARRAY[],9,FALSE),
  ('mi-10','Cedar-Plank Salmon','Maple mustard glaze, charred lemon, grilled greens.',29.00,12.40,'main','Non Veg',TRUE,FALSE,ARRAY['fish'],520,16,0,ARRAY['gluten_free_option'],10,FALSE),
  ('mi-11','Wild Mushroom Risotto','Carnaroli, porcini stock, truffle oil, parmesan tuile.',24.00,7.90,'pasta','Veg',TRUE,FALSE,ARRAY['dairy'],610,18,0,ARRAY['vegetarian','gluten_free_option'],11,FALSE),
  ('mi-12','Fig & Burrata Salad','Black mission fig, basil oil, aged balsamic, sourdough.',16.00,4.60,'breakfast','Veg',TRUE,TRUE,ARRAY['dairy'],290,5,0,ARRAY['vegetarian'],12,FALSE),
  -- Burgers
  ('mi-13','The Copper Fig Burger','Dry-aged blend, aged cheddar, caramelised onion, house sauce.',19.00,7.10,'burgers','Non Veg',TRUE,TRUE,ARRAY['gluten','dairy','egg'],880,11,0,ARRAY['chef_pick'],13,TRUE),
  ('mi-14','Crispy Chicken Milanese','Parmesan crust, shaved fennel, arugula, lemon aioli.',18.00,6.40,'burgers','Non Veg',TRUE,FALSE,ARRAY['gluten','dairy','egg'],760,12,0,ARRAY[],14,FALSE),
  ('mi-15','Halloumi & Harissa Burger','Grilled halloumi, harissa, pickled red onion, tahini.',17.00,5.90,'burgers','Veg',TRUE,FALSE,ARRAY['gluten','dairy','sesame'],720,11,2,ARRAY['vegetarian','spicy'],15,FALSE),
  -- Sides
  ('mi-16','Truffle Parmesan Fries','Triple-cooked, truffle oil, parmesan, chive.',9.00,1.90,'sides','Veg',TRUE,TRUE,ARRAY['dairy'],430,7,0,ARRAY['vegetarian'],16,FALSE),
  ('mi-17','Charred Broccolini','Chilli, garlic, lemon, toasted almond.',10.00,2.80,'sides','Veg',TRUE,FALSE,ARRAY['nuts'],190,6,1,ARRAY['vegetarian','gluten_free_option'],17,FALSE),
  ('mi-18','Little Gem Salad','Buttermilk dressing, radish, dill, rye crumb.',11.00,2.60,'sides','Veg',TRUE,FALSE,ARRAY['dairy','gluten'],150,4,0,ARRAY['vegetarian'],18,FALSE),
  -- Desserts
  ('mi-19','Tiramisu','Mascarpone, espresso-soaked savoiardi, dark cocoa.',11.00,2.40,'desserts','Veg',TRUE,TRUE,ARRAY['gluten','dairy','egg'],420,3,0,ARRAY['vegetarian'],19,TRUE),
  ('mi-20','Dark Chocolate Delice','70% Valrhona, salted caramel, olive oil, creme fraiche.',12.00,3.20,'desserts','Veg',TRUE,TRUE,ARRAY['dairy'],480,3,0,ARRAY['vegetarian','gluten_free_option'],20,TRUE),
  ('mi-21','Poached Pear & Almond','Vanilla poaching, almond cream, toasted pistachio.',10.00,2.30,'desserts','Veg',TRUE,FALSE,ARRAY['nuts','dairy'],330,3,0,ARRAY['vegetarian','gluten_free_option'],21,FALSE),
  ('mi-22','Affogato','Espresso, vanilla bean gelato, amaretto.',9.00,1.80,'desserts','Veg',TRUE,FALSE,ARRAY['dairy','nuts'],290,2,0,ARRAY['vegetarian'],22,FALSE),
  -- Drinks
  ('mi-23','Espresso','Single-origin, 18g, 36g or double.',3.50,0.55,'drinks','Veg',TRUE,TRUE,ARRAY[],5,2,0,ARRAY['vegan','gluten_free_option'],23,FALSE),
  ('mi-24','Flat White','Double ristretto, textured milk.',5.00,0.90,'drinks','Veg',TRUE,TRUE,ARRAY['dairy'],150,3,0,ARRAY['vegetarian','gluten_free_option'],24,FALSE),
  ('mi-25','Seville Orange Spritz','Blood orange, soda, rosemary, zero proof.',8.00,1.60,'drinks','Veg',TRUE,FALSE,ARRAY[],90,2,0,ARRAY['vegan','zero_proof','gluten_free_option'],25,FALSE),
  ('mi-26','Sauvignon Blanc (glass)','Loire, mineral, herbaceous.',11.00,3.10,'drinks','Veg',TRUE,FALSE,ARRAY['sulphites'],120,1,0,ARRAY['vegan','gluten_free_option'],26,FALSE),
  ('mi-27','Old Fashioned','Bourbon, demerara, orange oil, Angostura.',15.00,3.40,'drinks','Non Veg',TRUE,TRUE,ARRAY[],220,3,0,ARRAY['gluten_free_option'],27,FALSE),
  ('mi-28','Garden Cooler','Cucumber, basil, lime, tonic, zero proof.',8.00,1.50,'drinks','Veg',TRUE,FALSE,ARRAY[],80,2,0,ARRAY['vegan','zero_proof','gluten_free_option'],28,FALSE);
-- ---------------------------------------------------------------------------
-- Modifiers — the ones that actually change a ticket
-- ---------------------------------------------------------------------------
INSERT INTO "MenuItemModifier" (id, name, required, multiple, "maxSelect", "sortOrder", "menuItemId") VALUES
  ('mod-steak-1','Steak temperature',   TRUE, FALSE,1,1,'mi-08'),
  ('mod-steak-2','Sauce on side',       FALSE,FALSE,1,2,'mi-08'),
  ('mod-burger-1','Cook temperature',    TRUE, FALSE,1,1,'mi-13'),
  ('mod-burger-2','Remove ingredient',   FALSE,TRUE, 4,2,'mi-13'),
  ('mod-burger-3','Add cheese',          FALSE,TRUE, 2,3,'mi-13'),
  ('mod-pasta-1','Pasta shape',          FALSE,FALSE,1,1,'mi-05'),
  ('mod-pasta-2','Add truffle',          FALSE,FALSE,1,2,'mi-05'),
  ('mod-salad-1','Dressing on side',     FALSE,FALSE,1,1,'mi-12'),
  ('mod-coffee-1','Oat milk',            FALSE,FALSE,1,1,'mi-24'),
  ('mod-coffee-2','Extra shot',          FALSE,FALSE,1,2,'mi-24');

INSERT INTO "MenuItemModifierOption" (id, name, price, "isDefault", "sortOrder", "modifierId") VALUES
  ('opt-steak-rare',    'Rare',                 0,  FALSE,1,'mod-steak-1'),
  ('opt-steak-medium',  'Medium rare',          0,  TRUE, 2,'mod-steak-1'),
  ('opt-steak-well',    'Well done',            0,  FALSE,3,'mod-steak-1'),
  ('opt-sauce-side',    'Sauce on the side',    0,  FALSE,1,'mod-steak-2'),
  ('opt-burger-rare',   'Rare',                 0,  FALSE,1,'mod-burger-1'),
  ('opt-burger-medium', 'Medium',               0,  TRUE, 2,'mod-burger-1'),
  ('opt-burger-well',   'Well done',            0,  FALSE,3,'mod-burger-1'),
  ('opt-burger-no-onion','No onion',            0,  FALSE,1,'mod-burger-2'),
  ('opt-burger-no-pickle','No pickles',         0,  FALSE,2,'mod-burger-2'),
  ('opt-burger-no-sauce','No house sauce',     0,  FALSE,3,'mod-burger-2'),
  ('opt-burger-cheddar','Extra aged cheddar',   2.50,FALSE,1,'mod-burger-3'),
  ('opt-burger-bacon',  'Smoked bacon',         3.00,FALSE,2,'mod-burger-3'),
  ('opt-pasta-keep',    'Keep tagliatelle',     0,  FALSE,1,'mod-pasta-1'),
  ('opt-pasta-fettuccine','Fettuccine instead', 0,  FALSE,2,'mod-pasta-1'),
  ('opt-pasta-truffle', 'Extra truffle shave',  8.00,FALSE,1,'mod-pasta-2'),
  ('opt-salad-side',    'Dressing on the side', 0,  FALSE,1,'mod-salad-1'),
  ('opt-coffee-oat',    'Oat milk',             0.60,FALSE,1,'mod-coffee-1'),
  ('opt-coffee-extra',  'Extra shot',           1.20,FALSE,1,'mod-coffee-2');

-- KDS ticket targets, mirroring the promise made on the menu.
INSERT INTO "PreparationTime" ("menuItemId", "timeInMinutes")
SELECT id, "preparationMinutes" FROM "MenuItem" WHERE "preparationMinutes" > 0;
-- ---------------------------------------------------------------------------
-- Customers & loyalty
-- ---------------------------------------------------------------------------
INSERT INTO "Customer"
  (id, name, email, phone, notes, allergies, "dietaryRestrictions", "favoriteItems",
   "seatingPreferences", "visitCount", "lastVisit", "totalSpent")
VALUES
  ('cust-01','Amara Boateng','amara@example.com','+1 555 0201','Anniversary in March. Prefers the window.','shellfish',
   'pescatarian','Truffle Tagliatelle, Dark Chocolate Delice','Window seat, corner',34,NOW() - INTERVAL '6 days',2140.50),
  ('cust-02','Kenji Nakamura','kenji@example.com','+1 555 0202',NULL,NULL,NULL,
   'Duck Confit, Garden Cooler','Quiet table, no music',18,NOW() - INTERVAL '2 days',1240.00),
  ('cust-03','Priya Deshmukh','priya.d@example.com','+1 555 0203','Vegetarian. Shared the burrata last time.','peanuts',
   'vegetarian','Wild Mushroom Risotto, Little Gem Salad','Any table',27,NOW() - INTERVAL '1 day',980.25),
  ('cust-04','Owen Whitfield','owen.w@example.com','+1 555 0204',NULL,NULL,NULL,
   'The Copper Fig Burger, Old Fashioned','Bar seating',12,NOW() - INTERVAL '4 hours',486.00),
  ('cust-05','Sofia Delgado','sofia.d@example.com','+1 555 0205','Gluten free — coeliac, not a preference.',NULL,
   'gluten_free','Cedar-Plank Salmon, Garden Cooler','Patio',9,NOW() - INTERVAL '9 days',742.00),
  ('cust-06','Rui Ferreira','rui.f@example.com','+1 555 0206',NULL,NULL,NULL,
   'Espresso, Affogato','Bar',41,NOW() - INTERVAL '3 hours',312.75),
  ('cust-07','Lena Fischer','lena.f@example.com','+1 555 0207','Bringing a client — needs a good table.',NULL,NULL,
   'Rack of Lamb, Sauvignon Blanc','Best table in the house',6,NOW() - INTERVAL '14 days',1320.00),
  ('cust-08','Tunde Bakare','tunde.b@example.com','+1 555 0208',NULL,NULL,NULL,
   'Braised Short Rib, Tiramisu','Middle of the room',22,NOW() - INTERVAL '3 days',1104.00);

INSERT INTO "LoyaltyReward" (id, name, description, "pointsCost", available) VALUES
  ('rew-01','Espresso on the house','Any espresso, any size.',100,TRUE),
  ('rew-02','Dessert for one','Chef''s choice from the dessert board.',250,TRUE),
  ('rew-03','Aperitivo for two','Spritz or glass of wine.',500,TRUE),
  ('rew-04','Chef''s tasting menu','Seven courses, for two.',1500,TRUE);

INSERT INTO "LoyaltyCustomer" (id, email, phone, name, points, tier, "joinDate", "lastActivity", "totalSpent", "visitsCount") VALUES
  ('loy-01','amara@example.com','+1 555 0201','Amara Boateng',  820,'gold',     NOW() - INTERVAL '14 months', NOW() - INTERVAL '6 days', 2140.50, 34),
  ('loy-02','kenji@example.com','+1 555 0202','Kenji Nakamura', 430,'silver',   NOW() - INTERVAL '8 months',  NOW() - INTERVAL '2 days', 1240.00, 18),
  ('loy-03','owen.w@example.com','+1 555 0204','Owen Whitfield', 190,'bronze',   NOW() - INTERVAL '2 months',  NOW() - INTERVAL '4 hours', 486.00, 12),
  ('loy-04','rui.f@example.com','+1 555 0206','Rui Ferreira',    95,'bronze',   NOW() - INTERVAL '3 weeks',  NOW() - INTERVAL '3 hours', 312.75, 6);

INSERT INTO "LoyaltyActivity" ("customerId", type, points, description, timestamp) VALUES
  ('loy-01','earn',       340,'Earned on visit #34',                 NOW() - INTERVAL '6 days'),
  ('loy-01','tier-up',      0,'Upgraded to gold',                     NOW() - INTERVAL '6 days'),
  ('loy-02','earn',       180,'Earned on visit #18',                  NOW() - INTERVAL '2 days'),
  ('loy-03','welcome',    100,'Welcome bonus',                        NOW() - INTERVAL '2 months'),
  ('loy-03','earn',        90,'Earned on visit #12',                  NOW() - INTERVAL '4 hours'),
  ('loy-04','welcome',    100,'Welcome bonus',                        NOW() - INTERVAL '3 weeks'),
  ('loy-04','earn',        35,'Earned on visit #6',                   NOW() - INTERVAL '3 hours');
-- ---------------------------------------------------------------------------
-- A day of service.
-- T4 is deliberately 71 minutes old and still open -> the floor should nudge.
-- T3 is dirty -> the bussing sweep has work. One ticket is over its target time.
-- ---------------------------------------------------------------------------
INSERT INTO "Order"
  (id, "tableId", "customerName", "customerId", status, "diningMode", "serverId",
   subtotal, tax, discount, tip, total, "isPaid", notes, "createdAt")
VALUES
  ('ord-1042','table-t4','Nakamura',   'cust-02','preparing',  'Dine in',   'user-serve2',
    134.00, 13.40,  0.00, 0.00, 147.40, FALSE,
    'Anniversary — hold the dessert course until they are ready. Seat 4 to pace, rest well done.',
    NOW() - INTERVAL '71 minutes'),
  ('ord-1043','table-t1','Walk-in',    NULL,      'ready',      'Dine in',   'user-serve1',
     28.00,  2.80,  0.00, 0.00,  30.80, FALSE, 'No courses, food straight out.', NOW() - INTERVAL '34 minutes'),
  ('ord-1044','table-t2','Okafor',     NULL,      'pending',    'Dine in',   'user-serve1',
     64.00,  6.40,  0.00, 0.00,  70.40, FALSE, NULL, NOW() - INTERVAL '6 minutes'),
  ('ord-1045','table-p1','Whitfield',  'cust-04','pending',    'Dine in',   'user-serve1',
     57.00,  5.70,  5.70, 0.00,  57.00, FALSE, 'Manager comp — kitchen overfired the first attempt.', NOW() - INTERVAL '12 minutes'),
  ('ord-1046','table-b1','Ferreira',   'cust-06','preparing',  'Dine in',   'user-bar',
      8.50,  0.85,  0.00, 0.00,   9.35, FALSE, NULL, NOW() - INTERVAL '9 minutes'),
  ('ord-1047','table-t4','Nakamura',   'cust-02','pending',    'Dine in',   'user-serve2',
     34.00,  3.40,  0.00, 0.00,  37.40, FALSE, 'Dessert course — fire on the nod from Tomas.', NOW() - INTERVAL '3 minutes'),
  ('ord-1040','table-t5','Delgado',    'cust-05','completed',  'Dine in',   'user-serve1',
     78.00,  7.80,  0.00, 9.00,  94.80, TRUE,  NULL, NOW() - INTERVAL '3 hours'),
  ('ord-1041','table-b2','Turner',     NULL,      'completed',  'Dine in',   'user-bar',
     22.00,  2.20,  0.00, 0.00,  24.20, TRUE,  'Bar tab', NOW() - INTERVAL '2 hours');

INSERT INTO "OrderItem"
  (id, "orderId", "menuItemId", title, price, quantity, "totalPrice", "specialInstructions", type, "course", "sentToKitchenAt")
VALUES
  -- #1042 Nakamura — the anniversary table
  ('oi-1042-1','ord-1042','mi-01','Sourdough & Cultured Butter', 9.00, 1,  9.00, NULL, 'Veg', 1, NOW() - INTERVAL '70 minutes'),
  ('oi-1042-2','ord-1042','mi-08','Herb-Crusted Rack of Lamb',  38.00, 2, 76.00, 'Both medium rare. Sauce on the side for one.', 'Non Veg', 2, NOW() - INTERVAL '69 minutes'),
  ('oi-1042-3','ord-1042','mi-16','Truffle Parmesan Fries',      9.00, 1,  9.00, NULL, 'Veg', 2, NOW() - INTERVAL '69 minutes'),
  ('oi-1042-4','ord-1042','mi-26','Sauvignon Blanc (glass)',    11.00, 2, 22.00, NULL, 'Veg', 2, NOW() - INTERVAL '69 minutes'),
  ('oi-1042-5','ord-1042','mi-20','Dark Chocolate Delice',      12.00, 2, 24.00, 'One without dairy on the side.', 'Veg', 3, NULL),
  -- #1043 Walk-in T1
  ('oi-1043-1','ord-1043','mi-23','Espresso',                    3.50, 2,  7.00, NULL, 'Veg', 1, NOW() - INTERVAL '33 minutes'),
  ('oi-1043-2','ord-1043','mi-13','The Copper Fig Burger',     19.00, 1, 19.00, 'No onion, extra cheddar.', 'Non Veg', 1, NOW() - INTERVAL '33 minutes'),
  ('oi-1043-3','ord-1043','mi-16','Truffle Parmesan Fries',      9.00, 1,  9.00, NULL, 'Veg', 1, NOW() - INTERVAL '33 minutes'),
  -- #1044 Okafor T2 — just fired
  ('oi-1044-1','ord-1044','mi-03','Charred Octopus',            18.00, 2, 36.00, 'One no molluscs — allergy.', 'Non Veg', 1, NOW() - INTERVAL '5 minutes'),
  ('oi-1044-2','ord-1044','mi-07','Duck Confit',                34.00, 1, 34.00, NULL, 'Non Veg', 2, NOW() - INTERVAL '5 minutes'),
  ('oi-1044-3','ord-1044','mi-17','Charred Broccolini',         10.00, 1, 10.00, NULL, 'Veg', 2, NOW() - INTERVAL '5 minutes'),
  ('oi-1044-4','ord-1044','mi-24','Flat White',                  5.00, 2, 10.00, 'Oat milk x1.', 'Veg', 1, NOW() - INTERVAL '5 minutes'),
  ('oi-1044-5','ord-1044','mi-16','Truffle Parmesan Fries',      9.00, 2, 18.00, NULL, 'Veg', 2, NOW() - INTERVAL '5 minutes'),
  -- #1045 Whitfield P1
  ('oi-1045-1','ord-1045','mi-12','Fig & Burrata Salad',        16.00, 1, 16.00, 'Dressing on the side.', 'Veg', 1, NOW() - INTERVAL '11 minutes'),
  ('oi-1045-2','ord-1045','mi-14','Crispy Chicken Milanese',    18.00, 1, 18.00, NULL, 'Non Veg', 2, NOW() - INTERVAL '11 minutes'),
  ('oi-1045-3','ord-1045','mi-16','Truffle Parmesan Fries',      9.00, 1,  9.00, NULL, 'Veg', 2, NOW() - INTERVAL '11 minutes'),
  ('oi-1045-4','ord-1045','mi-27','Old Fashioned',              15.00, 1, 15.00, NULL, 'Non Veg', 1, NOW() - INTERVAL '11 minutes'),
  -- #1046 Ferreira B1
  ('oi-1046-1','ord-1046','mi-23','Espresso',                    3.50, 2,  7.00, NULL, 'Veg', 1, NOW() - INTERVAL '8 minutes'),
  ('oi-1046-2','ord-1046','mi-22','Affogato',                    9.00, 1,  9.00, NULL, 'Veg', 1, NOW() - INTERVAL '8 minutes'),
  -- #1047 Nakamura dessert course, not yet fired
  ('oi-1047-1','ord-1047','mi-19','Tiramisu',                   11.00, 2, 22.00, NULL, 'Veg', 3, NULL),
  ('oi-1047-2','ord-1047','mi-24','Flat White',                  5.00, 1,  5.00, NULL, 'Veg', 3, NULL),
  ('oi-1047-3','ord-1047','mi-23','Espresso',                    3.50, 2,  7.00, NULL, 'Veg', 3, NULL);
-- Modifier selections on a few lines (the kitchen needs to see these).
INSERT INTO "ModifierSelection" (id, "orderItemId", "modifierId", "optionIds") VALUES
  ('ms-1','oi-1042-2','mod-steak-1', ARRAY['opt-steak-medium','opt-steak-rare']),
  ('ms-2','oi-1042-2','mod-steak-2', ARRAY['opt-sauce-side']),
  ('ms-3','oi-1043-2','mod-burger-1', ARRAY['opt-burger-medium']),
  ('ms-4','oi-1043-2','mod-burger-2', ARRAY['opt-burger-no-onion']),
  ('ms-5','oi-1043-2','mod-burger-3', ARRAY['opt-burger-cheddar']),
  ('ms-6','oi-1045-1','mod-salad-1',  ARRAY['opt-salad-side']),
  ('ms-7','oi-1044-4','mod-coffee-1', ARRAY['opt-coffee-oat']);

-- Settled payments for the two closed checks.
INSERT INTO "Payment" (id, "orderId", method, amount, tip, reference, timestamp) VALUES
  ('pay-1040-1','ord-1040','credit', 85.80, 9.00, 'AUTH-4471', NOW() - INTERVAL '2 hours 40 minutes'),
  ('pay-1040-2','ord-1040','cash',    9.00, 0.00, NULL,       NOW() - INTERVAL '2 hours 40 minutes'),
  ('pay-1041-1','ord-1041','debit',  24.20, 0.00, 'AUTH-4488', NOW() - INTERVAL '1 hour 50 minutes');

-- ---------------------------------------------------------------------------
-- Host stand
-- ---------------------------------------------------------------------------
INSERT INTO "Reservation"
  (id, "customerName", phone, email, "partySize", "tableId", date, time, status, notes)
VALUES
  ('res-01','Delgado',      '+1 555 0205','sofia.d@example.com', 3, 'table-t6', CURRENT_DATE, '19:30','confirmed','Window if possible. Coeliac — no gluten.'),
  ('res-02','Bakare',       '+1 555 0208','tunde.b@example.com',  2, NULL,        CURRENT_DATE, '20:00','confirmed','Bar if it is quiet.'),
  ('res-03','Fischer',      '+1 555 0207','lena.f@example.com',   4, NULL,        CURRENT_DATE, '20:15','pending',  'Client dinner — she asked for the best table.'),
  ('res-04','Osei',         '+1 555 0209',NULL,                     6, NULL,        CURRENT_DATE, '20:30','confirmed','Birthday — candle with the dessert.'),
  ('res-05','Marchetti',    '+1 555 0210',NULL,                     2, NULL,        CURRENT_DATE, '21:00','pending',  NULL),
  ('res-06','Abebe',        '+1 555 0211',NULL,                     8, NULL,        CURRENT_DATE, '21:30','pending',  'Large party — can we push two tables together?');

INSERT INTO "WaitlistEntry"
  (id, "customerName", "phoneNumber", "partySize", "estimatedWaitTime", notes, notified, "createdAt")
VALUES
  ('wl-01','Harper','+1 555 0212',2,25,  'Bar if it opens.',      FALSE, NOW() - INTERVAL '24 minutes'),
  ('wl-02','Ivanova','+1 555 0213',4,40,'Will take the bar.',     FALSE, NOW() - INTERVAL '17 minutes'),
  ('wl-03','Ncube','+1 555 0214',  2,10, 'Notified 4 min ago.',   TRUE,  NOW() - INTERVAL '31 minutes'),
  ('wl-04','Lindgren','+1 555 0215',5,55, 'Large party.',          FALSE, NOW() - INTERVAL '8 minutes');

-- ---------------------------------------------------------------------------
-- Inventory — three items deliberately below reorder so the alert is real
-- ---------------------------------------------------------------------------
INSERT INTO "Ingredient"
  (id, name, category, unit, "currentStock", "reorderLevel", "unitCost", "isActive")
VALUES
  ('ing-01','Heirloom tomatoes',    'produce','kg',  6.5,  8,  4.20,TRUE),
  ('ing-02','Burrata',              'dairy',  'ea', 14,   10,  3.80,TRUE),
  ('ing-03','Black truffle',        'pantry', 'kg',  0.4,  0.5,180.00,TRUE),
  ('ing-04','Dry-aged beef blend',  'meat',   'kg',  22,   15, 18.50,TRUE),
  ('ing-05','Octopus (whole)',      'seafood','kg',  3.2,  4, 22.00,TRUE),
  ('ing-06','Sourdough levain',     'bakery', 'kg',  9,   6,   2.10,TRUE),
  ('ing-07','Demerara sugar',       'pantry', 'kg',  11,   5,   1.30,TRUE),
  ('ing-08','Olive oil (EVOO)',     'pantry', 'L',   18,   10,  9.80,TRUE),
  ('ing-09','Duck confit legs',     'meat',   'ea',  7,    8,  11.40,TRUE),
  ('ing-10','Single-origin coffee', 'pantry', 'kg',  2.1,  3,  26.00,TRUE),
  ('ing-11','Valrhona 70%',         'pantry', 'kg',  4.5,  2,  19.00,TRUE),
  ('ing-12','Maldon sea salt',      'pantry', 'kg',  1.8,  1,   4.50,TRUE);

-- ---------------------------------------------------------------------------
-- Kitchen stations
-- ---------------------------------------------------------------------------
INSERT INTO "KitchenStaffAssignment" ("userId", "userName", station) VALUES
  ('user-kitchen', 'Chef Rosa Alvarez', 'hot_line'),
  ('user-kitchen2','Sam Okafor',       'garde_manger');

INSERT INTO "AssignedOrder" ("userId", "orderId") VALUES
  ('user-kitchen', 'ord-1042'),
  ('user-kitchen', 'ord-1043'),
  ('user-kitchen', 'ord-1044'),
  ('user-kitchen', 'ord-1046'),
  ('user-kitchen2','ord-1042'),
  ('user-kitchen2','ord-1044');

-- ---------------------------------------------------------------------------
-- A little history for reports/analytics
-- ---------------------------------------------------------------------------
INSERT INTO "Feedback" ("orderId", "tableId", rating, "foodQuality", "serviceQuality", ambience, comments, timestamp) VALUES
  ('ord-1040','table-t5',5,5,5,4,'The lamb was the best I have had outside Lyon. Booked again for June.', NOW() - INTERVAL '3 hours'),
  (NULL,     'table-b1',5,4,5,5,NULL,                                                              NOW() - INTERVAL '26 hours'),
  (NULL,     'table-t2',4,4,4,4,'Took a while for the mains, but the staff were lovely about it.',     NOW() - INTERVAL '28 hours'),
  (NULL,     'table-p1',3,3,4,3,'Burrata was warm, not cold. Otherwise fine.',                         NOW() - INTERVAL '30 hours');

INSERT INTO "AuditLog" ("userId", action, entity, "entityId", details, timestamp) VALUES
  ('user-owner','SEED','SYSTEM',NULL,'{"note":"Development seed loaded"}',NOW());
