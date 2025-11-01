// Script para probar el mejorado API de eltoque
const { ElToqueAPI } = require('./src/lib/eltoque-api.ts');

async function testAPI() {
  console.log('🚀 Iniciando prueba del API eltoque mejorado...\n');

  try {
    // Probar obtener estado de conexión
    console.log('1. Verificando estado de conexión...');
    const connectionStatus = await ElToqueAPI.getConnectionStatus();
    console.log('Estado de conexión:', connectionStatus);
    console.log('✅ Estado de conexión obtenido\n');

    // Probar obtener tasas formateadas
    console.log('2. Obteniendo tasas formateadas...');
    const formattedRates = await ElToqueAPI.getFormattedRates();
    console.log('Tasas formateadas:', formattedRates);
    console.log('✅ Tasas obtenidas exitosamente\n');

    // Probar obtener todas las tasas
    console.log('3. Obteniendo todas las tasas...');
    const allRates = await ElToqueAPI.getAllRates();
    console.log('Todas las tasas:', allRates);
    console.log('✅ Todas las tasas obtenidas exitosamente\n');

    console.log('🎉 Todas las pruebas pasaron exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Ejecutar la prueba
testAPI();