const fs = require('fs');
const path = require('path');

// Lista de archivos que necesitan verificación
const filesToCheck = [
  'src/app/api/crm/orders/route.ts',
  'src/app/api/crm/notes/route.ts',
  'src/app/api/crm/orders/notes/route.ts',
];

// Función para verificar si un archivo importa funciones inexistentes
function checkImports(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Buscar imports desde @/lib/database con múltiples funciones
    const importMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]@\/lib\/database['"]/);

    if (importMatch && importMatch[1]) {
      const imports = importMatch[1]
        .split(',')
        .map(i => i.trim())
        .filter(i => i && i !== 'db');

      if (imports.length > 0) {
        console.log(`\n❌ ${filePath} imports non-existent functions:`);
        console.log(`   Functions: ${imports.join(', ')}`);
        return true;
      }
    }

    return false;
  } catch (error) {
    console.log(`⚠️  Could not read ${filePath}: ${error.message}`);
    return false;
  }
}

// Función simplificada para cambiar solo el import
function fixImport(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Reemplazar cualquier import desde @/lib/database con solo db
    const fixedContent = content.replace(
      /import\s*{[^}]+}\s*from\s*['"]@\/lib\/database['"]/,
      "import { db } from '@/lib/database'"
    );

    if (fixedContent !== content) {
      // Hacer backup
      fs.writeFileSync(filePath + '.backup', content);
      // Escribir el archivo arreglado
      fs.writeFileSync(filePath, fixedContent);
      console.log(`✅ Fixed import in ${filePath}`);
      console.log(`   Backup saved as ${filePath}.backup`);
      return true;
    }

    return false;
  } catch (error) {
    console.log(`❌ Error fixing ${filePath}: ${error.message}`);
    return false;
  }
}

console.log('🔍 Checking CRM API files for incorrect imports...\n');

let needsFix = [];

// Verificar archivos
filesToCheck.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (checkImports(fullPath)) {
    needsFix.push(fullPath);
  }
});

if (needsFix.length === 0) {
  console.log('\n✅ All CRM API files have correct imports!');
} else {
  console.log(`\n📝 Found ${needsFix.length} files that need fixing.`);
  console.log('\n⚠️  These files import functions that no longer exist in lib/database.');
  console.log('⚠️  They need to be rewritten to use PostgreSQL queries directly.\n');

  console.log('Would you like to:\n');
  console.log('1. Just fix the imports (will cause runtime errors)');
  console.log('2. See which functions each file is trying to use');
  console.log('3. Exit\n');

  // For now, just list the files that need manual rewriting
  console.log('Files that need to be rewritten:');
  needsFix.forEach(file => {
    console.log(`  - ${file}`);
  });

  console.log('\n⚠️  These files need to be manually rewritten to use PostgreSQL queries.');
  console.log('They are likely using SQLite-specific functions for CRM orders and notes.');
}