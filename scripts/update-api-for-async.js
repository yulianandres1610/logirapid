#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Lista de archivos que necesitan actualización
const apiFiles = [
  'src/app/api/**/*.ts'
];

// Función para actualizar un archivo
function updateFile(filePath) {
  console.log(`Processing: ${filePath}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Patrones a reemplazar para agregar await
  const patterns = [
    {
      // db.prepare().run()
      regex: /(?<!await\s+)db\.prepare\(/g,
      replacement: 'await db.prepare('
    },
    {
      // stmt.run()
      regex: /const\s+(\w+)\s*=\s*(?<!await\s+)db\.prepare/g,
      replacement: 'const $1 = await db.prepare'
    },
    {
      // Direct calls without await
      regex: /(?<!await\s+)(stmt|result)\.run\(/g,
      replacement: 'await $1.run('
    },
    {
      // .all() calls without await
      regex: /(?<!await\s+)\.all\(/g,
      replacement: '.all('
    },
    {
      // .get() calls without await
      regex: /(?<!await\s+)\.get\(/g,
      replacement: '.get('
    }
  ];

  // Aplicar cada patrón
  patterns.forEach(({ regex, replacement }) => {
    const newContent = content.replace(regex, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  // Guardar si hubo cambios
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated: ${filePath}`);
  } else {
    console.log(`  No changes needed: ${filePath}`);
  }
}

// Procesar todos los archivos API
apiFiles.forEach(pattern => {
  const files = glob.sync(pattern);
  files.forEach(file => {
    const filePath = path.resolve(file);
    // Solo procesar archivos TypeScript que importan database
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes("from '@/lib/database'") || content.includes('from "@/lib/database"')) {
      updateFile(filePath);
    }
  });
});

console.log('\n✅ API files updated for async PostgreSQL operations');