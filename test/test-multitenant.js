// Usar fetch nativo de Node.js 18+ (disponible globalmente)
// Si estás usando Node.js < 18, instala node-fetch: npm install node-fetch@2
if (typeof fetch === 'undefined') {
  console.error('Error: Se requiere Node.js 18+ (con fetch nativo)');
  console.error('Versión actual de Node.js:', process.version);
  console.error('Instalar Node.js 18+ o instalar node-fetch: npm install node-fetch@2');
  process.exit(1);
}

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
let accessToken = '';
let companyId = null;
let adminUserId = null;
let dinerUserId = null;

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${step}. ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`   ${message}`, 'blue');
}

async function testMultitenant() {
  try {
    log('\n🧪 Iniciando pruebas multitenant...', 'yellow');
    log(`   URL base: ${BASE_URL}\n`, 'blue');

    // 1. Crear Company
    logStep('1', 'Creando company y administrador...');
    const companyData = {
      company: {
        name: `Empresa Test ${Date.now()}`,
        taxId: `20-${Math.floor(Math.random() * 100000000)}-9`,
        industryType: 'Restaurantes',
        contactEmail: `contacto${Date.now()}@empresatest.com`,
        address: 'Av. Test 123',
        state: 'Buenos Aires',
        postalCode: '1000',
        country: 'Argentina',
        numberOfCanteens: 2,
        canteenCapacity: 100,
      },
      admin: {
        email: `admin${Date.now()}@empresatest.com`,
        password: 'Admin123!',
        firsName: 'Juan',
        lastName: 'Pérez',
      },
    };

    const companyResponse = await fetch(`${BASE_URL}/auth/register-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(companyData),
    });
    const companyResponseData = await companyResponse.json();

    if (!companyResponse.ok) {
      throw new Error(`Error al crear company: ${JSON.stringify(companyResponseData)}`);
    }

    companyId = companyResponseData.company.id;
    adminUserId = companyResponseData.admin.id;
    const adminUsername = companyResponseData.admin.username;

    logSuccess('Company creada exitosamente');
    logInfo(`Company ID: ${companyId}`);
    logInfo(`Company Name: ${companyResponseData.company.name}`);
    logInfo(`Admin ID: ${adminUserId}`);
    logInfo(`Admin Username: ${adminUsername}`);
    logInfo(`Admin Email: ${companyResponseData.admin.email}`);

    // 2. Login
    logStep('2', 'Haciendo login con el administrador...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: adminUsername,
        password: 'Admin123!',
      }),
    });
    const loginResponseData = await loginResponse.json();

    if (!loginResponse.ok) {
      throw new Error(`Error en login: ${JSON.stringify(loginResponseData)}`);
    }

    accessToken = loginResponseData.access_token;
    logSuccess('Login exitoso');
    logInfo(`Token: ${accessToken.substring(0, 30)}...`);

    // 3. Crear Usuario Diner
    logStep('3', 'Creando usuario diner...');
    const dinerData = {
      email: `diner${Date.now()}@empresatest.com`,
      firsName: 'María',
      lastName: 'González',
    };

    const dinerResponse = await fetch(`${BASE_URL}/auth/register-diner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(dinerData),
    });
    const dinerResponseData = await dinerResponse.json();

    if (!dinerResponse.ok) {
      throw new Error(`Error al crear diner: ${JSON.stringify(dinerResponseData)}`);
    }

    dinerUserId = dinerResponseData.id;
    logSuccess('Usuario diner creado exitosamente');
    logInfo(`Diner ID: ${dinerUserId}`);
    logInfo(`Diner Email: ${dinerResponseData.email}`);
    logInfo(`Diner Company ID: ${dinerResponseData.company.id}`);

    // Verificar que el companyId sea el correcto
    if (dinerResponseData.company.id === companyId) {
      logSuccess('Aislamiento de datos: El diner pertenece al tenant correcto');
    } else {
      logError(
        `Aislamiento de datos: El diner tiene companyId ${dinerResponseData.company.id}, esperado ${companyId}`
      );
    }

    // 4. Crear Usuario Kitchen Admin
    logStep('4', 'Creando usuario kitchen_admin...');
    const kitchenAdminData = {
      email: `kitchen${Date.now()}@empresatest.com`,
      firsName: 'Carlos',
      lastName: 'Rodríguez',
    };

    const kitchenAdminResponse = await fetch(`${BASE_URL}/auth/register-kitchen-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(kitchenAdminData),
    });
    const kitchenAdminResponseData = await kitchenAdminResponse.json();

    if (!kitchenAdminResponse.ok) {
      throw new Error(`Error al crear kitchen_admin: ${JSON.stringify(kitchenAdminResponseData)}`);
    }

    logSuccess('Usuario kitchen_admin creado exitosamente');
    logInfo(`Kitchen Admin ID: ${kitchenAdminResponseData.id}`);
    logInfo(`Kitchen Admin Email: ${kitchenAdminResponseData.email}`);
    logInfo(`Kitchen Admin Company ID: ${kitchenAdminResponseData.company.id}`);

    // Verificar que el companyId sea el correcto
    if (kitchenAdminResponseData.company.id === companyId) {
      logSuccess(
        'Aislamiento de datos: El kitchen_admin pertenece al tenant correcto'
      );
    } else {
      logError(
        `Aislamiento de datos: El kitchen_admin tiene companyId ${kitchenAdminResponseData.company.id}, esperado ${companyId}`
      );
    }

    // 5. Listar Usuarios
    logStep('5', 'Listando usuarios del tenant...');
    const usersResponse = await fetch(`${BASE_URL}/users`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const usersResponseData = await usersResponse.json();

    if (!usersResponse.ok) {
      throw new Error(`Error al listar usuarios: ${JSON.stringify(usersResponseData)}`);
    }

    logSuccess(`Usuarios encontrados: ${usersResponseData.length}`);
    usersResponseData.forEach((user) => {
      logInfo(`- ${user.email} (${user.role}) - Company ID: ${user.company.id}`);
    });

    // Verificar que todos los usuarios pertenezcan al mismo tenant
    const allSameTenant = usersResponseData.every(
      (user) => user.company.id === companyId
    );
    if (allSameTenant) {
      logSuccess(
        'Aislamiento de datos: Todos los usuarios pertenecen al mismo tenant'
      );
    } else {
      logError('Aislamiento de datos: Algunos usuarios pertenecen a otros tenants');
    }

    // 6. Obtener Usuario por ID
    logStep('6', 'Obteniendo usuario diner por ID...');
    const userResponse = await fetch(`${BASE_URL}/users/${dinerUserId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const userResponseData = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error(`Error al obtener usuario: ${JSON.stringify(userResponseData)}`);
    }

    logSuccess('Usuario obtenido exitosamente');
    logInfo(`Usuario: ${userResponseData.email}`);
    logInfo(`Company ID: ${userResponseData.company.id}`);
    logInfo(`Role: ${userResponseData.role}`);

    // Verificar que el usuario pertenezca al tenant correcto
    if (userResponseData.company.id === companyId) {
      logSuccess('Aislamiento de datos: El usuario pertenece al tenant correcto');
    } else {
      logError(
        `Aislamiento de datos: El usuario tiene companyId ${userResponseData.company.id}, esperado ${companyId}`
      );
    }

    // 7. Verificar que no se puede acceder a usuarios de otros tenants
    logStep('7', 'Verificando aislamiento de datos entre tenants...');
    
    // Crear una segunda company
    const company2Data = {
      company: {
        name: `Empresa Test 2 ${Date.now()}`,
        taxId: `20-${Math.floor(Math.random() * 100000000)}-9`,
        industryType: 'Tech',
        contactEmail: `contacto2${Date.now()}@empresatest.com`,
      },
      admin: {
        email: `admin2${Date.now()}@empresatest.com`,
        password: 'Admin123!',
        firsName: 'Pedro',
        lastName: 'Martínez',
      },
    };

    const company2Response = await fetch(`${BASE_URL}/auth/register-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company2Data),
    });
    const company2ResponseData = await company2Response.json();

    if (!company2Response.ok) {
      throw new Error(`Error al crear company 2: ${JSON.stringify(company2ResponseData)}`);
    }

    const company2Id = company2ResponseData.company.id;
    const admin2Username = company2ResponseData.admin.username;

    logInfo(`Company 2 creada con ID: ${company2Id}`);

    // Login con el admin de la segunda company
    const login2Response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: admin2Username,
        password: 'Admin123!',
      }),
    });
    const login2ResponseData = await login2Response.json();

    if (!login2Response.ok) {
      throw new Error(`Error en login 2: ${JSON.stringify(login2ResponseData)}`);
    }

    const accessToken2 = login2ResponseData.access_token;
    logInfo('Login con admin de Company 2 exitoso');

    // Intentar acceder al usuario de Company 1 con el token de Company 2
    try {
      const user1Response = await fetch(`${BASE_URL}/users/${dinerUserId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken2}`,
        },
      });
      
      if (user1Response.ok) {
        logError(
          'Aislamiento de datos FALLIDO: Se pudo acceder a un usuario de otro tenant'
        );
      } else if (user1Response.status === 404) {
        logSuccess(
          'Aislamiento de datos: Correctamente bloqueado el acceso a usuario de otro tenant (404)'
        );
      } else if (user1Response.status === 403) {
        logSuccess(
          'Aislamiento de datos: Correctamente bloqueado el acceso a usuario de otro tenant (403)'
        );
      }
    } catch (error) {
      logError(
        `Aislamiento de datos: Error inesperado: ${error.message}`
      );
    }

    // Listar usuarios con token de Company 2 (debe estar vacío o solo tener usuarios de Company 2)
    const users2Response = await fetch(`${BASE_URL}/users`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken2}`,
      },
    });
    const users2ResponseData = await users2Response.json();

    if (!users2Response.ok) {
      throw new Error(`Error al listar usuarios 2: ${JSON.stringify(users2ResponseData)}`);
    }

    const usersFromCompany1 = users2ResponseData.filter(
      (user) => user.company.id === companyId
    );

    if (usersFromCompany1.length === 0) {
      logSuccess(
        'Aislamiento de datos: Los usuarios de Company 1 no son visibles para Company 2'
      );
    } else {
      logError(
        `Aislamiento de datos: Se encontraron ${usersFromCompany1.length} usuarios de Company 1 en Company 2`
      );
    }

    log('\n✅ Todas las pruebas completadas exitosamente!', 'green');
    log('\n📊 Resumen:', 'yellow');
    logInfo(`Company 1 ID: ${companyId}`);
    logInfo(`Company 2 ID: ${company2Id}`);
    logInfo(`Total usuarios en Company 1: ${usersResponseData.length}`);
    logInfo(`Total usuarios en Company 2: ${users2ResponseData.length}`);
  } catch (error) {
    logError('\n❌ Error en las pruebas');
    logError(`Error: ${error.message}`);
    if (error.stack) {
      logInfo(`Stack: ${error.stack}`);
    }
    logInfo(`URL base: ${BASE_URL}`);
    logInfo('Verifica que el servidor esté corriendo en el puerto correcto');
    process.exit(1);
  }
}

// Ejecutar pruebas
if (require.main === module) {
  testMultitenant().catch((error) => {
    logError(`Error fatal: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { testMultitenant };

