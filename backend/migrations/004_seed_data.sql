-- Optional: Seed data for testing and development
-- WARNING: Do NOT run in production!

-- Sample items for testing
INSERT OR IGNORE INTO items (id, barcode, name, category, quantity, unit, min_stock, location)
VALUES
  ('item-001', '7501234567890', 'Diapers Size 3', 'diapers', 150, 'packs', 20, 'Shelf A-1'),
  ('item-002', '7501234567891', 'Baby Formula', 'formula', 45, 'cans', 15, 'Shelf A-2'),
  ('item-003', '7501234567892', 'T-Shirts (Size M)', 'clothing', 80, 'pieces', 30, 'Shelf B-1'),
  ('item-004', '7501234567893', 'Educational Toys Set', 'toys', 25, 'sets', 10, 'Shelf C-1'),
  ('item-005', '7501234567894', 'Books Bundle', 'books', 60, 'sets', 20, 'Shelf C-2'),
  ('item-006', '7501234567895', 'Shampoo', 'hygiene', 5, 'bottles', 15, 'Shelf D-1'),
  ('item-007', '7501234567896', 'Backpacks', 'school', 35, 'pieces', 15, 'Shelf D-2'),
  ('item-008', '7501234567897', 'Canned Food Pack', 'food', 100, 'cans', 40, 'Shelf E-1');
