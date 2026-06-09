const db = require('./src/config/database');

(async () => {
  try {
    const [vars] = await db.query("SHOW VARIABLES LIKE 'character_set_%';");
    console.log('character_set variables:');
    console.log(vars);

    const [tables] = await db.query("SHOW TABLE STATUS WHERE Name = 'cursos';");
    console.log('\nSHOW TABLE STATUS FOR cursos:');
    console.log(tables);

    const [create] = await db.query("SHOW CREATE TABLE cursos;");
    console.log('\nSHOW CREATE TABLE cursos:');
    console.log(create[0]['Create Table']);
  } catch (err) {
    console.error('ERROR', err);
  } finally {
    process.exit(0);
  }
})();