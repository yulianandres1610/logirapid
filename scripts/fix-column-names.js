const fs = require('fs');
const path = require('path');

// Comprehensive mapping of all column names from snake_case to lowercase
const columnMappings = {
  // package_orders table
  'customer_id': 'customerid',
  'customer_name': 'customername',
  'customer_address': 'customeraddress',
  'order_number': 'ordernumber',
  'scheduled_date': 'scheduleddate',
  'time_slot': 'timeslot',
  'created_by': 'createdby',
  'created_at': 'createdat',
  'updated_at': 'updatedat',
  'tax_amount': 'taxamount',
  'total_amount': 'totalamount',
  'box_count': 'boxcount',
  'box_price': 'boxprice',
  'additional_services': 'additionalservices',
  'payment_method': 'paymentmethod',
  'route_id': 'routeid',
  'stop_number': 'stopnumber',
  'service_packages': 'servicepackages',
  'service_quantities': 'servicequantities',
  'needs_box_construction': 'needsboxconstruction',
  'first_name': 'firstname',
  'last_name': 'lastname',
  'customer_notes': 'customernotes',

  // routes table
  'route_number': 'routenumber',
  'driver_id': 'driverid',
  'driver_name': 'drivername',
  'vehicle_id': 'vehicleid',
  'vehicle_plate': 'vehicleplate',
  'total_packages': 'totalpackages',
  'delivered_packages': 'deliveredpackages',
  'estimated_duration': 'estimatedduration',
  'actual_duration': 'actualduration',
  'start_time': 'starttime',
  'end_time': 'endtime',
  'time_windows': 'timewindows',
  'warehouse_id': 'warehouseid',
  'optimized_route': 'optimizedroute',
  'qr_code': 'qrcode',
  'mapbox_job_id': 'mapboxjobid',

  // warehouses table
  'zip_code': 'zipcode',
  'manager_name': 'managername',
  'manager_email': 'manageremail',
  'manager_phone': 'managerphone',
  'operating_hours': 'operatinghours',
  'custom_operating_hours': 'customoperatinghours',
  'total_area': 'totalarea',
  'opening_date': 'openingdate',

  // customers table
  'company_id': 'companyid',
  'company_name': 'companyname',
  'tax_id': 'taxid',
  'customer_type': 'customertype',
  'customer_status': 'customerstatus',
  'registration_date': 'registrationdate',
  'last_purchase_date': 'lastpurchasedate',
  'total_purchases': 'totalpurchases',
  'current_balance': 'currentbalance',
  'credit_limit': 'creditlimit',
  'payment_terms': 'paymentterms',
  'preferred_contact_method': 'preferredcontactmethod',
  'is_active': 'isactive',
  'last_contact_date': 'lastcontactdate',

  // vehicles table
  'license_plate': 'licenseplate',
  'fuel_type': 'fueltype',
  'purchase_date': 'purchasedate',
  'last_maintenance': 'lastmaintenance',
  'next_maintenance': 'nextmaintenance',
  'insurance_expiry': 'insuranceexpiry',
  'registration_expiry': 'registrationexpiry',
  'current_mileage': 'currentmileage',
  'fuel_efficiency': 'fuelefficiency',
  'cargo_capacity': 'cargocapacity',
  'max_weight': 'maxweight',
  'is_active': 'isactive',
  'assigned_driver_id': 'assigneddriverid',
  'current_location': 'currentlocation',
  'last_location_update': 'lastlocationupdate',

  // General columns
  'is_default': 'isdefault'
};

// Function to fix column names in a file
function fixColumnNamesInFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Fix column names in SQL queries
  for (const [oldName, newName] of Object.entries(columnMappings)) {
    // Fix in SELECT statements with alias
    const selectPattern = new RegExp(`\\b${oldName}\\s+as\\s+"`, 'gi');
    if (selectPattern.test(content)) {
      content = content.replace(selectPattern, `${newName} as "`);
      changed = true;
    }

    // Fix in WHERE clauses
    const wherePattern = new RegExp(`\\b${oldName}\\s*=`, 'gi');
    if (wherePattern.test(content)) {
      content = content.replace(wherePattern, `${newName} =`);
      changed = true;
    }

    // Fix in INSERT statements
    const insertPattern = new RegExp(`\\b${oldName}([,\\s\\)])`, 'gi');
    if (insertPattern.test(content)) {
      content = content.replace(insertPattern, `${newName}$1`);
      changed = true;
    }

    // Fix in UPDATE statements
    const updatePattern = new RegExp(`\\b${oldName}\\s*=\\s*\\$`, 'gi');
    if (updatePattern.test(content)) {
      content = content.replace(updatePattern, `${newName} = $`);
      changed = true;
    }

    // Fix in ORDER BY
    const orderPattern = new RegExp(`ORDER\\s+BY\\s+${oldName}\\b`, 'gi');
    if (orderPattern.test(content)) {
      content = content.replace(orderPattern, `ORDER BY ${newName}`);
      changed = true;
    }

    // Fix in field mappings
    const mappingPattern = new RegExp(`['"]?${oldName}['"]?\\s*:\\s*['"]${oldName}['"]`, 'g');
    if (mappingPattern.test(content)) {
      content = content.replace(mappingPattern, `${oldName}: '${newName}'`);
      changed = true;
    }

    // Fix response object mappings (e.g., newOrder.customer_id)
    const objPattern = new RegExp(`\\.${oldName.replace(/_/g, '_')}\\b`, 'g');
    if (objPattern.test(content)) {
      content = content.replace(objPattern, `.${newName}`);
      changed = true;
    }
  }

  // Special handling for NOW() timestamp updates
  content = content.replace(/updated_at\s*=\s*NOW\(\)/gi, 'updatedat = NOW()');
  content = content.replace(/created_at\s*=\s*NOW\(\)/gi, 'createdat = NOW()');

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${filePath}`);
  }
}

// API directories to scan
const apiDirs = [
  '/Users/yulianandresdiaz/Proyecto/LogiRapid/src/app/api'
];

// Recursively find all route.ts files
function findRouteFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findRouteFiles(fullPath));
    } else if (item === 'route.ts' || item === 'route.js') {
      files.push(fullPath);
    }
  }

  return files;
}

console.log('🔍 Scanning for API route files...');

for (const dir of apiDirs) {
  if (fs.existsSync(dir)) {
    const routeFiles = findRouteFiles(dir);
    console.log(`Found ${routeFiles.length} route files in ${dir}`);

    for (const file of routeFiles) {
      fixColumnNamesInFile(file);
    }
  }
}

console.log('✨ Column name fixes complete!');