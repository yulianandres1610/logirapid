-- Migration: Estandarizar nombres de columnas en customers a lowercase
-- Fecha: 2025-11-23
-- Razón: Resolver error 500 en búsqueda de clientes causado por inconsistencia camelCase vs lowercase

-- TABLA: customers
-- Renombrar columnas de camelCase a lowercase para consistencia con PostgreSQL

-- Verificar si las columnas existen antes de renombrar
DO $$
BEGIN
    -- firstName -> firstname
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'firstName'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "firstName" TO firstname;
    END IF;

    -- lastName -> lastname
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'lastName'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "lastName" TO lastname;
    END IF;

    -- idNumber -> idnumber
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'idNumber'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "idNumber" TO idnumber;
    END IF;

    -- idType -> idtype
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'idType'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "idType" TO idtype;
    END IF;

    -- createdBy -> createdby
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'createdBy'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "createdBy" TO createdby;
    END IF;

    -- createdAt -> createdat
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'createdAt'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "createdAt" TO createdat;
    END IF;

    -- zipCode -> zipcode
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'zipCode'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "zipCode" TO zipcode;
    END IF;

    -- company_id (si existe en camelCase)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'customers' AND column_name = 'companyId'
    ) THEN
        ALTER TABLE customers RENAME COLUMN "companyId" TO company_id;
    END IF;
END $$;

-- TABLA: customer_change_history
-- Estandarizar también esta tabla para mantener consistencia

DO $$
BEGIN
    -- Verificar si la tabla existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'customer_change_history'
    ) THEN
        -- firstName -> firstname
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'customer_change_history' AND column_name = 'firstName'
        ) THEN
            ALTER TABLE customer_change_history RENAME COLUMN "firstName" TO firstname;
        END IF;

        -- lastName -> lastname
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'customer_change_history' AND column_name = 'lastName'
        ) THEN
            ALTER TABLE customer_change_history RENAME COLUMN "lastName" TO lastname;
        END IF;

        -- changedAt -> changedat
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'customer_change_history' AND column_name = 'changedAt'
        ) THEN
            ALTER TABLE customer_change_history RENAME COLUMN "changedAt" TO changedat;
        END IF;

        -- changedBy -> changedby
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'customer_change_history' AND column_name = 'changedBy'
        ) THEN
            ALTER TABLE customer_change_history RENAME COLUMN "changedBy" TO changedby;
        END IF;
    END IF;
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Migración 28 completada: Columnas estandarizadas a lowercase';
END $$;
