import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

/**
 * Product Services & Box Tracking Migration
 *
 * This migration adds:
 * - product_services: Links products to their composite services
 * - company_service_pricing: Company-specific pricing for services
 * - box_tracking: Unique tracking codes for boxes/packages
 * - box_tracking_history: Audit trail for box status changes
 * - service_sales: Individual service sales for partial purchases
 * - Modifications to existing tables for margin validation
 */

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting product-services migration...')

    // ========================================
    // STEP 1: Create product_services table
    // ========================================
    console.log('📋 Creating product_services table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS product_services (
          id SERIAL PRIMARY KEY,
          product_id INTEGER NOT NULL REFERENCES product_catalog(id) ON DELETE CASCADE,
          service_code VARCHAR(50) NOT NULL,
          service_name VARCHAR(255) NOT NULL,
          description TEXT,
          sequence_order INTEGER NOT NULL DEFAULT 1,
          inclusion_type VARCHAR(20) NOT NULL DEFAULT 'included',
          base_price DECIMAL(15,2) DEFAULT 0,
          generates_box_tracking BOOLEAN DEFAULT false,
          requires_prior_box BOOLEAN DEFAULT false,
          is_mandatory BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT unique_product_service UNIQUE (product_id, service_code)
        )
      `)
      console.log('✅ product_services table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ product_services table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for product_services
    console.log('📋 Creating indexes for product_services...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_product_services_product ON product_services(product_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_product_services_code ON product_services(service_code)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_product_services_active ON product_services(is_active)`)
      console.log('✅ Indexes created for product_services')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 2: Create company_service_pricing table
    // ========================================
    console.log('📋 Creating company_service_pricing table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS company_service_pricing (
          id SERIAL PRIMARY KEY,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          product_service_id INTEGER NOT NULL REFERENCES product_services(id) ON DELETE CASCADE,
          mi_costo DECIMAL(15,2) NOT NULL DEFAULT 0,
          precio_venta DECIMAL(15,2) NOT NULL DEFAULT 0,
          margen DECIMAL(15,2) DEFAULT 0,
          margen_pct DECIMAL(5,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          CONSTRAINT unique_company_service_pricing UNIQUE (company_id, product_service_id)
        )
      `)
      console.log('✅ company_service_pricing table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ company_service_pricing table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for company_service_pricing
    console.log('📋 Creating indexes for company_service_pricing...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_company_service_pricing_company ON company_service_pricing(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_company_service_pricing_service ON company_service_pricing(product_service_id)`)
      console.log('✅ Indexes created for company_service_pricing')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 3: Create box_tracking table
    // ========================================
    console.log('📋 Creating box_tracking table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS box_tracking (
          id SERIAL PRIMARY KEY,
          tracking_code VARCHAR(100) UNIQUE NOT NULL,
          product_id INTEGER NOT NULL REFERENCES product_catalog(id),
          product_name VARCHAR(255) NOT NULL,
          company_id INTEGER NOT NULL REFERENCES companies(id),
          customer_id INTEGER REFERENCES customers(id),
          customer_name VARCHAR(255),
          box_type VARCHAR(50),
          box_dimensions VARCHAR(50),
          current_status VARCHAR(50) NOT NULL DEFAULT 'created',
          current_location VARCHAR(255),
          warehouse_id INTEGER REFERENCES warehouses(id),
          weight_lb DECIMAL(10,2),
          weight_kg DECIMAL(10,2),
          created_at TIMESTAMP DEFAULT NOW(),
          box_delivered_at TIMESTAMP,
          confeccionada_at TIMESTAMP,
          recogida_at TIMESTAMP,
          entregada_at TIMESTAMP,
          updated_at TIMESTAMP DEFAULT NOW(),
          created_by_user_id INTEGER REFERENCES users(id),
          notes TEXT
        )
      `)
      console.log('✅ box_tracking table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ box_tracking table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for box_tracking
    console.log('📋 Creating indexes for box_tracking...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_code ON box_tracking(tracking_code)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_status ON box_tracking(current_status)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_company ON box_tracking(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_customer ON box_tracking(customer_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_product ON box_tracking(product_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_created ON box_tracking(created_at)`)
      console.log('✅ Indexes created for box_tracking')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 4: Create box_tracking_history table
    // ========================================
    console.log('📋 Creating box_tracking_history table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS box_tracking_history (
          id SERIAL PRIMARY KEY,
          box_tracking_id INTEGER NOT NULL REFERENCES box_tracking(id) ON DELETE CASCADE,
          previous_status VARCHAR(50),
          new_status VARCHAR(50) NOT NULL,
          location VARCHAR(255),
          warehouse_id INTEGER REFERENCES warehouses(id),
          changed_by_user_id INTEGER REFERENCES users(id),
          changed_by_user_name VARCHAR(255),
          changed_at TIMESTAMP DEFAULT NOW(),
          notes TEXT,
          metadata JSONB DEFAULT '{}'
        )
      `)
      console.log('✅ box_tracking_history table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ box_tracking_history table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for box_tracking_history
    console.log('📋 Creating indexes for box_tracking_history...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_history_box ON box_tracking_history(box_tracking_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_box_tracking_history_changed ON box_tracking_history(changed_at)`)
      console.log('✅ Indexes created for box_tracking_history')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 5: Create service_sales table
    // ========================================
    console.log('📋 Creating service_sales table...')
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS service_sales (
          id SERIAL PRIMARY KEY,
          box_tracking_id INTEGER NOT NULL REFERENCES box_tracking(id),
          product_service_id INTEGER NOT NULL REFERENCES product_services(id),
          service_code VARCHAR(50) NOT NULL,
          service_name VARCHAR(255) NOT NULL,
          company_id INTEGER NOT NULL REFERENCES companies(id),
          customer_id INTEGER REFERENCES customers(id),
          sold_by_user_id INTEGER REFERENCES users(id),
          sold_by_user_name VARCHAR(255),
          precio_unitario DECIMAL(15,2) NOT NULL,
          cantidad INTEGER DEFAULT 1,
          subtotal DECIMAL(15,2) NOT NULL,
          descuento DECIMAL(15,2) DEFAULT 0,
          descuento_reason TEXT,
          total DECIMAL(15,2) NOT NULL,
          status VARCHAR(20) DEFAULT 'paid',
          package_order_id INTEGER REFERENCES package_orders(id),
          created_at TIMESTAMP DEFAULT NOW(),
          paid_at TIMESTAMP,
          completed_at TIMESTAMP,
          cancelled_at TIMESTAMP,
          notes TEXT
        )
      `)
      console.log('✅ service_sales table created')
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('ℹ️ service_sales table already exists')
      } else {
        throw error
      }
    }

    // Create indexes for service_sales
    console.log('📋 Creating indexes for service_sales...')
    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_service_sales_box ON service_sales(box_tracking_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_service_sales_company ON service_sales(company_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_service_sales_customer ON service_sales(customer_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_service_sales_order ON service_sales(package_order_id)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_service_sales_status ON service_sales(status)`)
      await db.query(`CREATE INDEX IF NOT EXISTS idx_service_sales_created ON service_sales(created_at)`)
      console.log('✅ Indexes created for service_sales')
    } catch (error: any) {
      console.log('ℹ️ Index creation note:', error.message)
    }

    // ========================================
    // STEP 6: Add columns to product_catalog
    // ========================================
    console.log('📋 Adding columns to product_catalog...')
    try {
      await db.query(`
        ALTER TABLE product_catalog
        ADD COLUMN IF NOT EXISTS is_composite BOOLEAN DEFAULT false
      `)
      console.log('✅ Added is_composite column to product_catalog')
    } catch (error: any) {
      console.log('ℹ️ is_composite column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE product_catalog
        ADD COLUMN IF NOT EXISTS has_box_tracking BOOLEAN DEFAULT false
      `)
      console.log('✅ Added has_box_tracking column to product_catalog')
    } catch (error: any) {
      console.log('ℹ️ has_box_tracking column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE product_catalog
        ADD COLUMN IF NOT EXISTS max_commission_percentage DECIMAL(5,2) DEFAULT 100
      `)
      console.log('✅ Added max_commission_percentage column to product_catalog')
    } catch (error: any) {
      console.log('ℹ️ max_commission_percentage column note:', error.message)
    }

    // ========================================
    // STEP 7: Add columns to company_product_pricing
    // ========================================
    console.log('📋 Adding columns to company_product_pricing...')
    try {
      await db.query(`
        ALTER TABLE company_product_pricing
        ADD COLUMN IF NOT EXISTS max_commission_amount DECIMAL(15,2) DEFAULT 0
      `)
      console.log('✅ Added max_commission_amount column to company_product_pricing')
    } catch (error: any) {
      console.log('ℹ️ max_commission_amount column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE company_product_pricing
        ADD COLUMN IF NOT EXISTS total_configured_commissions DECIMAL(15,2) DEFAULT 0
      `)
      console.log('✅ Added total_configured_commissions column to company_product_pricing')
    } catch (error: any) {
      console.log('ℹ️ total_configured_commissions column note:', error.message)
    }

    // ========================================
    // STEP 8: Add product_service_id to company_commission_config
    // ========================================
    console.log('📋 Adding product_service_id to company_commission_config...')
    try {
      await db.query(`
        ALTER TABLE company_commission_config
        ADD COLUMN IF NOT EXISTS product_service_id INTEGER REFERENCES product_services(id)
      `)
      console.log('✅ Added product_service_id column to company_commission_config')
    } catch (error: any) {
      console.log('ℹ️ product_service_id column note:', error.message)
    }

    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_commission_config_service ON company_commission_config(product_service_id)`)
      console.log('✅ Index created for company_commission_config.product_service_id')
    } catch (error: any) {
      console.log('ℹ️ Index note:', error.message)
    }

    // ========================================
    // STEP 8.5: Add service tracking columns to employee_commissions
    // ========================================
    console.log('📋 Adding service tracking columns to employee_commissions...')
    try {
      await db.query(`
        ALTER TABLE employee_commissions
        ADD COLUMN IF NOT EXISTS product_service_id INTEGER REFERENCES product_services(id)
      `)
      console.log('✅ Added product_service_id column to employee_commissions')
    } catch (error: any) {
      console.log('ℹ️ product_service_id column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE employee_commissions
        ADD COLUMN IF NOT EXISTS product_service_code VARCHAR(50)
      `)
      console.log('✅ Added product_service_code column to employee_commissions')
    } catch (error: any) {
      console.log('ℹ️ product_service_code column note:', error.message)
    }

    try {
      await db.query(`
        ALTER TABLE employee_commissions
        ADD COLUMN IF NOT EXISTS product_service_name VARCHAR(255)
      `)
      console.log('✅ Added product_service_name column to employee_commissions')
    } catch (error: any) {
      console.log('ℹ️ product_service_name column note:', error.message)
    }

    try {
      await db.query(`CREATE INDEX IF NOT EXISTS idx_employee_commissions_service ON employee_commissions(product_service_id)`)
      console.log('✅ Index created for employee_commissions.product_service_id')
    } catch (error: any) {
      console.log('ℹ️ Index note:', error.message)
    }

    // ========================================
    // STEP 9: Create tracking code sequence
    // ========================================
    console.log('📋 Creating tracking code sequence...')
    try {
      await db.query(`
        CREATE SEQUENCE IF NOT EXISTS box_tracking_code_seq START 1
      `)
      console.log('✅ box_tracking_code_seq sequence created')
    } catch (error: any) {
      console.log('ℹ️ Sequence note:', error.message)
    }

    // ========================================
    // STEP 10: Create function to generate tracking codes
    // ========================================
    console.log('📋 Creating tracking code generator function...')
    try {
      await db.query(`
        CREATE OR REPLACE FUNCTION generate_box_tracking_code(p_company_id INTEGER)
        RETURNS VARCHAR(100) AS $$
        DECLARE
          v_code VARCHAR(100);
          v_date VARCHAR(8);
          v_seq INTEGER;
        BEGIN
          v_date := TO_CHAR(NOW(), 'YYYYMMDD');
          v_seq := NEXTVAL('box_tracking_code_seq');
          v_code := 'BOX-' || LPAD(p_company_id::TEXT, 4, '0') || '-' || v_date || '-' || LPAD(v_seq::TEXT, 6, '0');
          RETURN v_code;
        END;
        $$ LANGUAGE plpgsql;
      `)
      console.log('✅ generate_box_tracking_code function created')
    } catch (error: any) {
      console.log('ℹ️ Function note:', error.message)
    }

    // ========================================
    // STEP 11: Create default services for existing composite products
    // ========================================
    console.log('📋 Creating default services for composite products...')
    try {
      // Find products that should have services (paquetería products)
      const productsResult = await db.query(`
        SELECT id, name, category
        FROM product_catalog
        WHERE category IN ('recogida', 'paqueteria', 'caja')
          AND NOT EXISTS (
            SELECT 1 FROM product_services ps WHERE ps.product_id = product_catalog.id
          )
      `)

      let servicesCreated = 0
      for (const product of productsResult.rows) {
        // Mark as composite and has_box_tracking
        await db.query(`
          UPDATE product_catalog
          SET is_composite = true, has_box_tracking = true
          WHERE id = $1
        `, [product.id])

        // Create default services for each product
        const defaultServices = [
          { code: 'ENTREGA_CAJA', name: 'Entrega de Caja', order: 1, generates_tracking: true },
          { code: 'CONFECCION', name: 'Confección de Caja', order: 2, generates_tracking: false },
          { code: 'RECOGIDA', name: 'Recogida de Caja', order: 3, generates_tracking: false }
        ]

        for (const svc of defaultServices) {
          try {
            await db.query(`
              INSERT INTO product_services (
                product_id, service_code, service_name,
                sequence_order, inclusion_type, generates_box_tracking,
                is_mandatory, is_active
              ) VALUES ($1, $2, $3, $4, 'included', $5, true, true)
              ON CONFLICT (product_id, service_code) DO NOTHING
            `, [product.id, svc.code, svc.name, svc.order, svc.generates_tracking])
            servicesCreated++
          } catch (err) {
            // Ignore individual insert errors
          }
        }
      }
      console.log(`✅ Created ${servicesCreated} default services for composite products`)
    } catch (error: any) {
      console.log('ℹ️ Default services note:', error.message)
    }

    // ========================================
    // STEP 12: Verify migration status
    // ========================================
    console.log('📋 Verifying migration status...')

    const productServicesCount = await db.query(`SELECT COUNT(*) as count FROM product_services`)
    const companyServicePricingCount = await db.query(`SELECT COUNT(*) as count FROM company_service_pricing`)
    const boxTrackingCount = await db.query(`SELECT COUNT(*) as count FROM box_tracking`)
    const boxTrackingHistoryCount = await db.query(`SELECT COUNT(*) as count FROM box_tracking_history`)
    const serviceSalesCount = await db.query(`SELECT COUNT(*) as count FROM service_sales`)

    // Check if columns exist
    const productCatalogCols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'product_catalog'
      AND column_name IN ('is_composite', 'has_box_tracking', 'max_commission_percentage')
    `)

    const companyProductPricingCols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'company_product_pricing'
      AND column_name IN ('max_commission_amount', 'total_configured_commissions')
    `)

    const companyCommissionConfigCols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'company_commission_config'
      AND column_name = 'product_service_id'
    `)

    // Check composite products
    const compositeProducts = await db.query(`
      SELECT COUNT(*) as count FROM product_catalog WHERE is_composite = true
    `)

    console.log('🎉 Migration completed successfully!')

    return NextResponse.json({
      success: true,
      message: 'Product services migration completed',
      data: {
        tablesCreated: [
          'product_services',
          'company_service_pricing',
          'box_tracking',
          'box_tracking_history',
          'service_sales'
        ],
        columnsAdded: {
          product_catalog: productCatalogCols.rows.map((r: any) => r.column_name),
          company_product_pricing: companyProductPricingCols.rows.map((r: any) => r.column_name),
          company_commission_config: companyCommissionConfigCols.rows.map((r: any) => r.column_name)
        },
        currentState: {
          productServices: parseInt(productServicesCount.rows[0]?.count || '0'),
          companyServicePricing: parseInt(companyServicePricingCount.rows[0]?.count || '0'),
          boxTracking: parseInt(boxTrackingCount.rows[0]?.count || '0'),
          boxTrackingHistory: parseInt(boxTrackingHistoryCount.rows[0]?.count || '0'),
          serviceSales: parseInt(serviceSalesCount.rows[0]?.count || '0'),
          compositeProducts: parseInt(compositeProducts.rows[0]?.count || '0')
        },
        functionsCreated: ['generate_box_tracking_code(company_id)'],
        sequencesCreated: ['box_tracking_code_seq']
      }
    })

  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed'
    }, { status: 500 })
  }
}
