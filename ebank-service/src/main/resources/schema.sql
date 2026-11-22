CREATE TABLE IF NOT EXISTS bank_account (
    id UUID PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    type VARCHAR(12) NOT NULL CHECK (type IN ('CURRENT', 'SAVINGS')),
    balance DECIMAL(14, 2) NOT NULL CHECK (balance >= 0),
    created_at DATE NOT NULL
);
