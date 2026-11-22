INSERT INTO bank_account (id, customer_id, type, balance, created_at)
SELECT seed.id, seed.customer_id, seed.type, seed.balance, seed.created_at
FROM (VALUES
    (UUID '9f3df0d1-c49e-4380-922c-17c33ce98754', 1, 'CURRENT', 45200.00, DATE '2026-10-21'),
    (UUID '723ff522-342f-4fe8-9377-253320b65eb6', 2, 'SAVINGS', 76500.00, DATE '2026-10-15'),
    (UUID '0436a67b-486d-4946-860e-6a32a7c736a0', 3, 'CURRENT', 18750.00, DATE '2026-10-12'),
    (UUID '6258808f-9af7-4cad-8133-db8f1753b8db', 4, 'CURRENT', 32150.00, DATE '2026-09-28'),
    (UUID 'ad7e7783-41ec-45bc-8ec1-88fe4188e963', 5, 'SAVINGS', 62500.00, DATE '2026-09-02'),
    (UUID '9a0fce42-02ca-4b20-88fc-2799ba2d7f3b', 6, 'CURRENT', 24600.00, DATE '2026-08-25'),
    (UUID '60bac3c3-0163-4d29-9a04-972de1de907d', 1, 'SAVINGS', 38200.00, DATE '2026-07-18'),
    (UUID '4f58c879-7cc7-459e-af3f-d0467835d3e7', 3, 'SAVINGS', 21400.00, DATE '2026-06-12')
) seed(id, customer_id, type, balance, created_at)
WHERE NOT EXISTS (SELECT 1 FROM bank_account a WHERE a.id = seed.id);
