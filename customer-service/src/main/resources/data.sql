INSERT INTO customer (id, name, email)
SELECT seed.id, seed.name, seed.email
FROM (VALUES
    (1, 'Salma Idrissi', 'salma.idrissi@example.com'),
    (2, 'Yassine El Amrani', 'yassine.elamrani@example.com'),
    (3, 'Lina Berrada', 'lina.berrada@example.com'),
    (4, 'Omar Bennani', 'omar.bennani@example.com'),
    (5, 'Sara Alaoui', 'sara.alaoui@example.com'),
    (6, 'Adam Tazi', 'adam.tazi@example.com')
) seed(id, name, email)
WHERE NOT EXISTS (SELECT 1 FROM customer c WHERE c.id = seed.id);
