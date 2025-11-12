-- Migration: Fix customer_change_history table structure
-- This migration alters the table to match the expected API schema

-- Drop the old table and recreate with the correct structure
DROP TABLE IF EXISTS customer_change_history CASCADE;

CREATE TABLE customer_change_history (
    id SERIAL PRIMARY KEY,
    customerId INTEGER NOT NULL,
    changeDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changedBy VARCHAR(255) NOT NULL,
    oldFirstName VARCHAR(100),
    newFirstName VARCHAR(100),
    oldLastName VARCHAR(100),
    newLastName VARCHAR(100),
    oldIdNumber VARCHAR(50),
    newIdNumber VARCHAR(50),
    oldIdType VARCHAR(50),
    newIdType VARCHAR(50),
    oldPhone VARCHAR(50),
    newPhone VARCHAR(50),
    oldEmail VARCHAR(255),
    newEmail VARCHAR(255),
    oldAddress TEXT,
    newAddress TEXT,
    oldCity VARCHAR(100),
    newCity VARCHAR(100),
    oldState VARCHAR(100),
    newState VARCHAR(100),
    oldCountry VARCHAR(100),
    newCountry VARCHAR(100),
    oldNotes TEXT,
    newNotes TEXT,
    oldZipCode VARCHAR(20),
    newZipCode VARCHAR(20),
    oldApartment VARCHAR(50),
    newApartment VARCHAR(50),
    FOREIGN KEY (customerId) REFERENCES customers (id) ON DELETE CASCADE
);

-- Create index for better query performance
CREATE INDEX idx_customer_change_history_customer ON customer_change_history(customerId);
CREATE INDEX idx_customer_change_history_date ON customer_change_history(changeDate DESC);
